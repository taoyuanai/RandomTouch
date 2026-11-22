/* 收益：集合 earn 汇总 + 平台分成；提现走 withdrawals（pending/done）。
 * 提现在事务内锁创作者行，避免并发重复提现。
 */
const { pool, withTx } = require('../db');
const { AppError } = require('../http/errors');
const config = require('../config');

async function configNum(db, k, d) {
  const [rows] = await db.query('SELECT v FROM app_config WHERE k = ?', [k]);
  const n = rows[0] ? Number(rows[0].v) : NaN;
  return Number.isFinite(n) ? n : d;
}

async function snapshot(db, userId) {
  const [cRows] = await db.query('SELECT id FROM creators WHERE user_id = ?', [userId]);
  const creator = cRows[0];
  const threshold = await configNum(db, 'withdraw_threshold', config.withdrawThreshold);
  if (!creator) {
    return {
      total: 0, avail: 0, pending: 0, withdrawn: 0, threshold,
      bySet: [], platform: 0, txns: [],
    };
  }
  const [aggRows] = await db.query(
    'SELECT COALESCE(SUM(earn),0) AS earn FROM sets WHERE creator_id = ?',
    [creator.id]
  );
  // 平台分成只归属运营账号（app_config.platform_creator_id），不是每个创作者都有
  const platformCreatorId = await configNum(db, 'platform_creator_id', 0);
  const platform = Number(platformCreatorId) && Number(platformCreatorId) === Number(creator.id)
    ? await configNum(db, 'platform_income', 0)
    : 0;
  const [wRows] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status='done' THEN amount ELSE 0 END),0) AS withdrawn,
       COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) AS pending
     FROM withdrawals WHERE creator_id = ?`,
    [creator.id]
  );
  const w = wRows[0] || {};
  const total = round2(Number(aggRows[0].earn || 0) + platform);
  const withdrawn = Number(w.withdrawn || 0);
  const pending = Number(w.pending || 0);
  const [bySetRows] = await db.query(
    'SELECT id, title, buyers, price, earn FROM sets WHERE creator_id = ? AND price > 0 AND earn > 0 ORDER BY earn DESC',
    [creator.id]
  );
  const [txns] = await db.query(
    'SELECT d, t, amt, meta FROM income_txns WHERE creator_id = ? ORDER BY ts DESC, id DESC',
    [creator.id]
  );
  return {
    total,
    avail: Math.max(0, round2(total - withdrawn - pending)),
    pending: round2(pending),
    withdrawn: round2(withdrawn),
    threshold,
    bySet: bySetRows.map(r => ({
      id: r.id, title: r.title,
      buyers: Number(r.buyers || 0), price: Number(r.price || 0), earn: Number(r.earn || 0),
    })),
    platform: round2(platform),
    txns: txns.map(t => ({ d: t.d, t: t.t, amt: Number(t.amt || 0), meta: t.meta })),
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

async function getIncome(userId) {
  return snapshot(pool, userId);
}

async function withdraw(userId) {
  return withTx(async (conn) => {
    // 锁创作者行，序列化同一账号的提现
    const [cRows] = await conn.query('SELECT id FROM creators WHERE user_id = ? FOR UPDATE', [userId]);
    const creator = cRows[0];
    if (!creator) throw new AppError('INTERNAL', '未达提现门槛', true);
    const snap = await snapshot(conn, userId);
    if (snap.avail <= 0 || snap.avail < snap.threshold) {
      throw new AppError('INTERNAL', '未达提现门槛', true);
    }
    await conn.query(
      "INSERT INTO withdrawals (creator_id, amount, status, ts) VALUES (?,?, 'pending', ?)",
      [creator.id, snap.avail, Date.now()]
    );
    return snapshot(conn, userId);
  });
}

module.exports = { getIncome, withdraw };
