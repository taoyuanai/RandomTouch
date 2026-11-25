/* 解锁 / 订阅：幂等，返回最新 SetPayload。 */
const { withTx } = require('../db');
const { safeDel } = require('../redis');
const { setNotFound } = require('../http/errors');
const { SET_SELECT, payloadInTx } = require('./setPayload');

async function ensureProgress(conn, userId, setId, unlockedDefault, now) {
  await conn.query(
    `INSERT IGNORE INTO user_set_progress
      (user_id, set_id, drawn, today_drawn, trial_today, today_idx, unlocked, trial_used, last_draw_date, created_at, updated_at)
     VALUES (?,?,0,0,0,NULL,?,0,NULL,?,?)`,
    [userId, setId, unlockedDefault ? 1 : 0, now, now]
  );
}

async function loadSetRow(db, setId) {
  const [rows] = await db.query(`${SET_SELECT} WHERE s.id = ?`, [setId]);
  return rows[0] || null;
}

/* 注意：v1 按契约「模拟支付完成」。正式收款必须改为支付回调驱动，
 * 客户端不提供支付凭证（见 contract.md unlock 一节）。 */
async function unlock(userId, setIdInput) {
  const setId = Number(setIdInput);
  const out = await withTx(async (conn) => {
    const set = await loadSetRow(conn, setId);
    if (!set) throw setNotFound();
    const own = Number(set.creator_user_id) === Number(userId);
    const now = Date.now();
    await ensureProgress(conn, userId, setId, true, now);
    await conn.query(
      'UPDATE user_set_progress SET unlocked = 1, subscribed = 1, updated_at = ? WHERE user_id = ? AND set_id = ?',
      [now, userId, setId]
    );
    return { set: await payloadInTx(conn, userId, setId), own };
  });
  await safeDel(`feed:${userId}`);
  return { set: out.set };
}

async function subscribeSet(userId, setIdInput) {
  const setId = Number(setIdInput);
  const out = await withTx(async (conn) => {
    const set = await loadSetRow(conn, setId);
    if (!set) throw setNotFound();
    const own = Number(set.creator_user_id) === Number(userId);
    const free = Number(set.price) === 0;
    const now = Date.now();
    await ensureProgress(conn, userId, setId, free || own, now);
    await conn.query(
      'UPDATE user_set_progress SET subscribed = 1, updated_at = ? WHERE user_id = ? AND set_id = ?',
      [now, userId, setId]
    );
    return { set: await payloadInTx(conn, userId, setId) };
  });
  await safeDel(`feed:${userId}`);
  return { set: out.set };
}

/* 取消订阅：只关订阅标记，保留 user_set_progress / user_set_cards / stamps。 */
async function unsubscribeSet(userId, setIdInput) {
  const setId = Number(setIdInput);
  const out = await withTx(async (conn) => {
    const set = await loadSetRow(conn, setId);
    if (!set) throw setNotFound();
    await conn.query(
      'UPDATE user_set_progress SET subscribed = 0, updated_at = ? WHERE user_id = ? AND set_id = ?',
      [Date.now(), userId, setId]
    );
    return { set: await payloadInTx(conn, userId, setId) };
  });
  await safeDel(`feed:${userId}`);
  return { set: out.set };
}

module.exports = { unlock, subscribeSet, unsubscribeSet, ensureProgress, loadSetRow };
