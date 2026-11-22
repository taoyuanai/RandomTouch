#!/usr/bin/env node
/* 从 services/mock/seed.js 导入卡集/创作者/互动/收益种子。
 * 幂等：app_config.seed_version 一致则跳过；--force 强制重导（会先清空受控表）。
 *
 * 用法：node db/seed.js [--force]
 */
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');
const time = require('../src/services/time');

const SEED_VERSION = '2026-11-20-id19';
const seedPath = path.resolve(__dirname, '../../services/mock/seed.js');
const seed = require(seedPath);

const DAY = 86400000;

function parseIntOr(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function toDateKey(md, now) {
  if (!md) return null;
  const m = String(md).match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = time.todayKey(now).slice(0, 4);
  return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}
function parseDisplayTime(text, now) {
  const baseToday = Date.parse(`${time.todayKey(now)}T00:00:00+08:00`);
  const m = String(text || '').match(/(今天|昨天)\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const dayOffset = m[1] === '昨天' ? -1 : 0;
    return baseToday + dayOffset * DAY + Number(m[2]) * 3600000 + Number(m[3]) * 60000;
  }
  const m2 = String(text || '').match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (m2) {
    const y = time.todayKey(now).slice(0, 4);
    return Date.parse(`${y}-${String(m2[1]).padStart(2, '0')}-${String(m2[2]).padStart(2, '0')}T${m2[3]}:${m2[4]}:00+08:00`);
  }
  return now;
}

async function main() {
  const force = process.argv.includes('--force');
  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password,
    database: config.db.database, charset: 'utf8mb4',
    multipleStatements: true, decimalNumbers: true, dateStrings: true,
    timezone: '+08:00',
  });
  const now = Date.now();

  try {
    const [cfgRows] = await conn.query("SELECT v FROM app_config WHERE k = 'seed_version'");
    const current = cfgRows[0] && cfgRows[0].v;
    if (!force && current === SEED_VERSION) {
      console.log(`[seed] 已是 ${SEED_VERSION}，跳过（--force 可重导）`);
      return;
    }

    await conn.beginTransaction();
    if (force) {
      // 只清内容表，不动用户进度/订单
      await conn.query('DELETE FROM set_cards');
      await conn.query('DELETE FROM comments');
      await conn.query('DELETE FROM sets');
      await conn.query('DELETE FROM creators');
      await conn.query('DELETE FROM income_txns');
    }

    /* 1) 创作者 */
    const creatorIds = {};
    const names = new Set(Object.keys(seed.FANS || {}));
    (seed.DEMO.sets || []).forEach(s => names.add(s.creator));
    names.add('打工人小王'); // 演示账号的创作者身份
    names.delete(undefined);
    for (const name of names) {
      const fans = parseIntOr(seed.FANS && seed.FANS[name], 0);
      await conn.query(
        'INSERT INTO creators (name, base_fans, created_at) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE base_fans = VALUES(base_fans)',
        [name, fans, now]
      );
      const [rows] = await conn.query('SELECT id FROM creators WHERE name = ?', [name]);
      creatorIds[name] = rows[0].id;
    }

    /* 2) 卡集 + 卡 */
    let setCount = 0, cardCount = 0;
    for (const s of (seed.DEMO.sets || [])) {
      const pool = Array.isArray(s.pool) ? s.pool : [];
      const count = pool.length; // 以卡池为权威，修正种子 count 不一致
      const cid = creatorIds[s.creator];
      await conn.query(
        `INSERT INTO sets
          (id, title, cov_t, cov_s, cover, cover_image, cat, type, price, trial, \`count\`,
           signature_idx, signature_note, intro, creator_id, heat, released_at, date_text,
           disclaimer, likes, status, total_drawn, earn, buyers, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), cov_t=VALUES(cov_t), cov_s=VALUES(cov_s), cover=VALUES(cover),
           cover_image=VALUES(cover_image), cat=VALUES(cat), type=VALUES(type),
           price=VALUES(price), trial=VALUES(trial), \`count\`=VALUES(\`count\`),
           signature_idx=VALUES(signature_idx), signature_note=VALUES(signature_note),
           intro=VALUES(intro), creator_id=VALUES(creator_id), heat=VALUES(heat),
           released_at=VALUES(released_at), date_text=VALUES(date_text),
           disclaimer=VALUES(disclaimer), status=VALUES(status),
           total_drawn=VALUES(total_drawn), earn=VALUES(earn), buyers=VALUES(buyers)`,
        [
          s.id, s.title, s.covT || s.title, s.covS || '', s.cover || 'c1',
          s.coverImage || '', s.cat, s.type || 'collect', s.price || 0, s.trial || 0,
          count, parseIntOr(s.signatureIdx, -1), s.signatureNote || '',
          s.intro || '', cid, s.heat || 0, toDateKey(s.date, now), s.date || '',
          s.disclaimer || '', 0, 'published',
          s.totalDrawn || 0, s.earn || 0, s.buyers || 0, now,
        ]
      );
      setCount++;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i] || {};
        await conn.query(
          'INSERT INTO set_cards (set_id, idx, w, b) VALUES (?,?,?,?) ' +
          'ON DUPLICATE KEY UPDATE w=VALUES(w), b=VALUES(b)',
          [s.id, i, String(c.w || ''), String(c.b || '')]
        );
        cardCount++;
      }
    }

    /* 3) 点赞数（liked 是每用户状态，种子不迁移） */
    for (const [sid, soc] of Object.entries(seed.SOCIAL_SEED || {})) {
      await conn.query('UPDATE sets SET likes = ? WHERE id = ?', [soc.likes || 0, Number(sid)]);
    }

    /* 4) 留言 */
    let commentCount = 0;
    for (const [sid, list] of Object.entries(seed.COMMENTS_SEED || {})) {
      for (const c of list) {
        const ts = parseDisplayTime(c.time, now);
        await conn.query(
          `INSERT INTO comments (id, set_id, user_id, name, avatar, text, is_creator, status, created_ts)
           VALUES (?,?,NULL,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE name=VALUES(name), avatar=VALUES(avatar), text=VALUES(text),
             is_creator=VALUES(is_creator), created_ts=VALUES(created_ts)`,
          [c.id, Number(sid), c.name || '', c.avatar || (c.name || '签').slice(0, 1),
           c.text || '', c.creator ? 1 : 0, 'visible', ts]
        );
        commentCount++;
      }
    }

    /* 5) 收益流水（演示创作者） */
    const demoCreatorId = creatorIds['打工人小王'];
    if (demoCreatorId) {
      const [existTxns] = await conn.query('SELECT COUNT(*) AS n FROM income_txns WHERE creator_id = ?', [demoCreatorId]);
      if (!existTxns[0].n) {
        for (const t of (seed.TXN_SEED || [])) {
          const ts = Date.parse(`${time.todayKey(now).slice(0, 4)}-${String(t.d).padStart(5, '0')}T12:00:00+08:00`);
          await conn.query(
            'INSERT INTO income_txns (creator_id, d, t, amt, meta, ts) VALUES (?,?,?,?,?,?)',
            [demoCreatorId, t.d || '', t.t || '', t.amt || 0, t.meta || '', Number.isFinite(ts) ? ts : now]
          );
        }
      }
    }

    /* 6) 全局配置 */
    await conn.query("INSERT INTO app_config (k, v) VALUES ('platform_income', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [String(seed.PLATFORM_INCOME || 0)]);
    await conn.query("INSERT INTO app_config (k, v) VALUES ('withdraw_threshold', '100') ON DUPLICATE KEY UPDATE v=VALUES(v)");
    // 平台分成只归属运营账号（测试环境 = 演示创作者），不发给所有创作者
    if (demoCreatorId) {
      await conn.query(
        "INSERT INTO app_config (k, v) VALUES ('platform_creator_id', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
        [String(demoCreatorId)]
      );
    }
    await conn.query("INSERT INTO app_config (k, v) VALUES ('seed_version', ?) ON DUPLICATE KEY UPDATE v=VALUES(v)", [SEED_VERSION]);

    await conn.commit();
    console.log(`[seed] 完成 ${SEED_VERSION}: ${setCount} 集 / ${cardCount} 卡 / ${commentCount} 留言`);
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('[seed] 失败:', err && err.message ? err.message : err);
  process.exit(1);
});
