/* 订阅页聚合：全部基于 draw_logs / progress / stamps 计算。 */
const { pool } = require('../db');
const { safeGet, safeSet } = require('../redis');
const time = require('./time');
const { buildPayloads, SET_SELECT } = require('./setPayload');

const DAY = 86400000;

async function getFeed(userId) {
  const cacheKey = `feed:${userId}`;
  const cached = await safeGet(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* ignore */ }
  }

  const [rows] = await pool.query(
    `${SET_SELECT} JOIN user_set_progress p ON p.set_id = s.id AND p.user_id = ?
     WHERE s.status = 'published' ORDER BY s.id ASC`,
    [userId]
  );
  const payloads = await buildPayloads(pool, userId, rows, { summary: true, poolText: false });

  const todayRows = [];
  const subRows = [];
  const doneRows = [];
  let waitingN = 0, cardsN = 0, emptied = 0, activeN = 0;

  for (const p of payloads) {
    const u = p.progress;
    const active = !!p.subscribed;
    const res = p.type === 'resident';
    const got = u.got || [];
    if (active) activeN++;
    cardsN += u.drawn || 0;
    const doneSet = !res && p.count > 0 && got.length >= p.count;
    if (doneSet) emptied++;
    const todayIdx = u.todayIdx != null
      ? u.todayIdx
      : (u.todayDrawn && got.length ? got[got.length - 1] : null);
    const stamped = todayIdx != null && !!(u.recs && u.recs[todayIdx]);
    const row = {
      setId: p.id, title: p.title, covT: p.covT, todayIdx, got,
      count: p.count, drawn: u.drawn || 0, resident: res, price: p.price,
      subscribed: active,
    };

    if (doneSet) {
      doneRows.push(Object.assign({}, row, { status: 'done' }));
    } else if (!active) {
      /* 已取消订阅：保留进度与卡片，但不再进入今日/订阅中 */
      continue;
    } else if (u.todayDrawn || u.trialToday) {
      if (!stamped) { waitingN++; subRows.push(Object.assign({}, row, { status: 'waiting_reply' })); }
      else subRows.push(Object.assign({}, row, { status: 'stamped' }));
    } else {
      const locked = p.price > 0 && !p.own && !u.unlocked && (u.trialUsed || 0) >= p.trial;
      todayRows.push(Object.assign({}, row, { status: locked ? 'locked' : 'can_draw' }));
    }
  }

  /* 周目标与召回：统一用 draw_logs */
  const [logs] = await pool.query(
    'SELECT set_id, day_key, ts FROM draw_logs WHERE user_id = ? ORDER BY ts ASC',
    [userId]
  );
  const tk = time.todayKey();
  const mk = time.weekMondayKey();
  const daySet = new Set();
  let lastTs = 0;
  for (const l of logs) {
    if (l.ts > lastTs) lastTs = l.ts;
    if (l.day_key >= mk && l.day_key <= tk) daySet.add(l.day_key);
  }
  const doneDays = daySet.size;
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const k = time.keyPlus(mk, i);
    dots.push({ dateKey: k, drawn: daySet.has(k), isToday: k === tk, isPast: k < tk });
  }

  let greeting = null;
  if (lastTs) {
    const a = Date.parse(tk + 'T00:00:00Z');
    const b = Date.parse(time.dateKeyOf(lastTs) + 'T00:00:00Z');
    const absent = Math.max(0, Math.round((a - b) / DAY));
    if (absent >= 3) {
      greeting = {
        days: absent,
        suggestSetId: todayRows.length ? todayRows[0].setId : null,
        canDrawN: todayRows.length,
      };
    }
  }

  /* 周记可生成：collect 集抽满 7 张且未标记 */
  let weekly = null;
  for (const p of payloads) {
    if (!p.subscribed || p.type !== 'collect') continue;
    const n = logs.filter(l => l.set_id === p.id).length;
    if (n < 7) continue;
    const weekNo = Math.ceil(n / 7);
    const [[mark]] = await pool.query(
      'SELECT 1 AS x FROM weekly_marks WHERE user_id = ? AND set_id = ? AND week_no = ?',
      [userId, p.id, weekNo]
    );
    if (!mark) { weekly = { setId: p.id, weekNo }; break; }
  }

  const out = {
    total: activeN,
    today: todayRows,
    subscribed: subRows,
    done: doneRows,
    stats: { canDraw: todayRows.length, cards: cardsN, emptied, waiting: waitingN },
    weekGoal: logs.length
      ? { done: doneDays, total: 7, left: Math.max(0, 7 - doneDays), full: doneDays >= 7, dots }
      : null,
    greeting,
    weekly,
  };

  await safeSet(cacheKey, JSON.stringify(out), 30);
  return out;
}

module.exports = { getFeed };
