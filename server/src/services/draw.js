/* 抽卡：幂等 + 北京时间跨天 + 试抽额度 + 剩余卡池均匀随机 + 原子写入。
 * 正确性完全由 MySQL 事务 + 行锁 + draw_requests 唯一键保证；Redis 仅快路径。
 * 无保底、无权重（产品决策）。
 */
const crypto = require('crypto');
const { withTx } = require('../db');
const { safeGet, safeSet, safeDel } = require('../redis');
const { setNotFound, unlockRequired } = require('../http/errors');
const time = require('./time');
const { SET_SELECT, payloadInTx } = require('./setPayload');

function randomInt(n) { return n > 0 ? crypto.randomInt(0, n) : 0; }

async function weekProgressOf(db, userId) {
  const tk = time.todayKey();
  const mk = time.weekMondayKey();
  const [rows] = await db.query(
    'SELECT DISTINCT day_key FROM draw_logs WHERE user_id = ? AND day_key BETWEEN ? AND ?',
    [userId, mk, tk]
  );
  const done = rows.length;
  return { done, total: 7, left: Math.max(0, 7 - done), full: done >= 7 };
}

async function loadSet(db, setId) {
  const [rows] = await db.query(`${SET_SELECT} WHERE s.id = ?`, [setId]);
  return rows[0] || null;
}

async function cardAt(db, setId, idx) {
  const [rows] = await db.query('SELECT w, b FROM set_cards WHERE set_id = ? AND idx = ?', [setId, idx]);
  return rows[0] ? { w: rows[0].w, b: rows[0].b } : null;
}

async function draw(userId, setIdInput, requestIdInput) {
  const setId = Number(setIdInput);
  let rid = String(requestIdInput || '').slice(0, 64);
  if (!rid) {
    // 契约要求客户端生成；缺失时仍生成一个，避免把两次不同的点击当成同一次
    rid = 'srv' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  }

  const cacheKey = `idem:draw:${userId}:${rid}`;
  const cached = await safeGet(cacheKey);
  if (cached) {
    try { return Object.assign({}, JSON.parse(cached), { result: 'already' }); } catch (e) { /* fallthrough */ }
  }

  const out = await withTx(async (conn) => {
    /* 1) 幂等：同一 requestId 永远返回同一结果 */
    const [reqRows] = await conn.query(
      'SELECT result_json FROM draw_requests WHERE user_id = ? AND request_id = ? FOR UPDATE',
      [userId, rid]
    );
    if (reqRows.length) {
      return Object.assign({}, parseJson(reqRows[0].result_json), { result: 'already' });
    }

    /* 2) 卡集 */
    const set = await loadSet(conn, setId);
    if (!set) throw setNotFound();
    const own = Number(set.creator_user_id) === Number(userId);
    const isResident = set.type === 'resident';

    const [[{ n: cardN }]] = await conn.query(
      'SELECT COUNT(*) AS n FROM set_cards WHERE set_id = ?', [setId]
    );
    const total = Number(cardN || 0);
    if (total <= 0) throw setNotFound();

    /* 3) 进度行加锁（不存在则先建） */
    const now = Date.now();
    const today = time.todayKey(now);
    const unlockedDefault = Number(set.price) === 0 || own ? 1 : 0;
    await conn.query(
      `INSERT IGNORE INTO user_set_progress
        (user_id, set_id, drawn, today_drawn, trial_today, today_idx, unlocked, trial_used, last_draw_date, created_at, updated_at)
       VALUES (?,?,0,0,0,NULL,?,0,NULL,?,?)`,
      [userId, setId, unlockedDefault, now, now]
    );
    const [pRows] = await conn.query(
      'SELECT * FROM user_set_progress WHERE user_id = ? AND set_id = ? FOR UPDATE',
      [userId, setId]
    );
    let p = pRows[0];

    /* 4) 跨天翻转 */
    if (p.last_draw_date !== today && (Number(p.today_drawn) || Number(p.trial_today))) {
      await conn.query(
        'UPDATE user_set_progress SET today_drawn = 0, trial_today = 0, today_idx = NULL, updated_at = ? WHERE user_id = ? AND set_id = ?',
        [now, userId, setId]
      );
      p = Object.assign({}, p, { today_drawn: 0, trial_today: 0, today_idx: null });
    }

    /* 4.1) 抽卡即订阅（含取消后重新抽） */
    if (!Number(p.subscribed)) {
      await conn.query(
        'UPDATE user_set_progress SET subscribed = 1, updated_at = ? WHERE user_id = ? AND set_id = ?',
        [now, userId, setId]
      );
      p = Object.assign({}, p, { subscribed: 1 });
    }

    /* 5) 已集齐 */
    const [gotRows] = await conn.query(
      'SELECT idx FROM user_set_cards WHERE user_id = ? AND set_id = ? ORDER BY first_ts ASC',
      [userId, setId]
    );
    const got = gotRows.map(r => Number(r.idx));
    if (!isResident && got.length >= total) {
      return { result: 'completed', set: await payloadInTx(conn, userId, setId) };
    }

    /* 6) 今日已抽：重放今日卡 */
    if (Number(p.today_drawn) || Number(p.trial_today)) {
      let idx = p.today_idx != null ? Number(p.today_idx) : (got.length ? got[got.length - 1] : 0);
      const card = await cardAt(conn, setId, idx);
      return {
        result: 'already', idx, card,
        set: await payloadInTx(conn, userId, setId),
      };
    }

    /* 7) 试抽门禁 */
    const paid = Number(set.price) > 0 && !own;
    const isTrial = paid && !Number(p.unlocked);
    if (isTrial && Number(p.trial_used) >= Number(set.trial)) {
      throw unlockRequired(set.price);
    }

    /* 8) 选卡：collect 在未收集里均匀随机；resident 全池 */
    let idx;
    if (isResident) {
      idx = randomInt(total);
    } else {
      const gotSet = new Set(got);
      const left = [];
      for (let i = 0; i < total; i++) if (!gotSet.has(i)) left.push(i);
      if (!left.length) {
        return { result: 'completed', set: await payloadInTx(conn, userId, setId) };
      }
      idx = left[randomInt(left.length)];
    }
    const card = await cardAt(conn, setId, idx);
    const sigFirst = idx === Number(set.signature_idx) && !got.includes(idx);

    const wpBefore = await weekProgressOf(conn, userId);

    /* 9) 写入 */
    if (isTrial) {
      await conn.query(
        'UPDATE user_set_progress SET trial_used = trial_used + 1, trial_today = 1, today_idx = ?, last_draw_date = ?, drawn = drawn + 1, updated_at = ? WHERE user_id = ? AND set_id = ?',
        [idx, today, now, userId, setId]
      );
    } else {
      await conn.query(
        'UPDATE user_set_progress SET today_drawn = 1, today_idx = ?, last_draw_date = ?, drawn = drawn + 1, updated_at = ? WHERE user_id = ? AND set_id = ?',
        [idx, today, now, userId, setId]
      );
    }
    await conn.query(
      'INSERT IGNORE INTO user_set_cards (user_id, set_id, idx, first_ts) VALUES (?,?,?,?)',
      [userId, setId, idx, now]
    );
    await conn.query(
      'INSERT INTO draw_logs (user_id, set_id, card_idx, is_trial, request_id, ts, day_key) VALUES (?,?,?,?,?,?,?)',
      [userId, setId, idx, isTrial ? 1 : 0, rid, now, today]
    );
    if (own) {
      await conn.query('UPDATE sets SET total_drawn = total_drawn + 1, heat = heat + 1 WHERE id = ?', [setId]);
    } else {
      await conn.query('UPDATE sets SET heat = heat + 1 WHERE id = ?', [setId]);
    }

    const wpAfter = await weekProgressOf(conn, userId);

    /* 10) 组装 */
    const [[{ n: gotAfter }]] = await conn.query(
      'SELECT COUNT(*) AS n FROM user_set_cards WHERE user_id = ? AND set_id = ?', [userId, setId]
    );
    const done = !isResident && Number(gotAfter) >= total;
    const result = {
      result: 'drawn',
      idx,
      card,
      set: await payloadInTx(conn, userId, setId),
      done,
      sig: { firstReveal: sigFirst, isSig: idx === Number(set.signature_idx) },
      weekGoal: {
        done: wpAfter.done, total: 7, full: wpAfter.full,
        justFull: wpAfter.full && !wpBefore.full,
      },
    };

    /* 11) 幂等落库 */
    await conn.query(
      'INSERT INTO draw_requests (user_id, request_id, set_id, result_json, created_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE result_json = result_json',
      [userId, rid, setId, JSON.stringify(result), now]
    );
    return result;
  });

  if (out.result === 'drawn') {
    await safeSet(cacheKey, JSON.stringify(out), 86400);
  }
  await safeDel(`feed:${userId}`);
  return out;
}

function parseJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return null; }
}

module.exports = { draw, weekProgressOf, loadSet };
