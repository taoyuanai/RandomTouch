/* SetPayload 组装：契约 §2。客户端 applySetPayload 依赖 subscribed/progress。
 * 批量查询，避免逐集 N+1。
 */
const { pool } = require('../db');
const time = require('./time');

const SET_SELECT = `
  SELECT s.*, c.name AS creator_name, c.user_id AS creator_user_id, c.base_fans AS creator_base_fans
  FROM sets s JOIN creators c ON c.id = s.creator_id
`;

function toBool(v) { return !!Number(v); }

function recOf(r) {
  return {
    img: r.img_url || r.img_file_id || '',
    imgFileID: r.img_file_id || '',
    note: r.note || '',
    date: r.date_text || '',
    stampDate: r.stamp_date || '',
    dateText: r.stamp_date || '',
    dayText: r.day_text || '',
    sec: { text: r.sec_text || 'pass', media: r.sec_media || 'none' },
  };
}

async function fansOf(db, creatorId) {
  const [rows] = await db.query(
    'SELECT c.base_fans + (SELECT COUNT(*) FROM follows f WHERE f.creator_id = c.id) AS fans FROM creators c WHERE c.id = ?',
    [creatorId]
  );
  return rows[0] ? Number(rows[0].fans || 0) : 0;
}

async function buildPayloads(db, userId, rows) {
  if (!rows || !rows.length) return [];
  const ids = rows.map(r => r.id);

  const [cards] = await db.query(
    'SELECT set_id, idx, w, b FROM set_cards WHERE set_id IN (?) ORDER BY set_id, idx',
    [ids]
  );
  const [progs] = await db.query(
    'SELECT * FROM user_set_progress WHERE user_id = ? AND set_id IN (?)',
    [userId, ids]
  );
  const [gots] = await db.query(
    'SELECT set_id, idx, first_ts FROM user_set_cards WHERE user_id = ? AND set_id IN (?) ORDER BY first_ts ASC, idx ASC',
    [userId, ids]
  );
  const [stamps] = await db.query(
    'SELECT * FROM stamps WHERE user_id = ? AND set_id IN (?) ORDER BY id ASC',
    [userId, ids]
  );
  const [likedRows] = await db.query(
    'SELECT set_id FROM set_likes WHERE user_id = ? AND set_id IN (?)',
    [userId, ids]
  );
  const [logs] = await db.query(
    'SELECT set_id, card_idx, ts FROM draw_logs WHERE user_id = ? AND set_id IN (?) ORDER BY ts ASC, id ASC',
    [userId, ids]
  );

  const cardMap = new Map();
  for (const c of cards) {
    if (!cardMap.has(c.set_id)) cardMap.set(c.set_id, []);
    cardMap.get(c.set_id).push({ w: c.w, b: c.b });
  }
  const progMap = new Map(progs.map(p => [p.set_id, p]));
  const gotMap = new Map();
  for (const g of gots) {
    if (!gotMap.has(g.set_id)) gotMap.set(g.set_id, []);
    gotMap.get(g.set_id).push(g.idx);
  }
  const logMap = new Map();
  for (const l of logs) {
    if (!logMap.has(l.set_id)) logMap.set(l.set_id, []);
    logMap.get(l.set_id).push({ idx: l.card_idx, ts: l.ts });
  }
  const likedSet = new Set(likedRows.map(r => r.set_id));

  const stampsBySet = new Map();
  for (const st of stamps) {
    if (!stampsBySet.has(st.set_id)) stampsBySet.set(st.set_id, []);
    stampsBySet.get(st.set_id).push(st);
  }

  const today = time.todayKey();

  return rows.map(row => {
    const own = Number(row.creator_user_id) === Number(userId);
    const poolCards = cardMap.get(row.id) || [];
    const p = progMap.get(row.id) || null;
    const type = row.type;
    const stampsOfSet = stampsBySet.get(row.id) || [];

    // recs：collect 每个 idx 一条（末条）；resident 同 idx 数组追加
    const recs = {};
    if (type === 'resident') {
      for (const st of stampsOfSet) {
        if (!recs[st.card_idx]) recs[st.card_idx] = [];
        recs[st.card_idx].push(recOf(st));
      }
    } else {
      for (const st of stampsOfSet) recs[st.card_idx] = recOf(st);
    }

    let todayDrawn = p ? toBool(p.today_drawn) : false;
    let trialToday = p ? toBool(p.trial_today) : false;
    let todayIdx = p && p.today_idx != null ? Number(p.today_idx) : null;
    if (p && p.last_draw_date !== today && (todayDrawn || trialToday)) {
      todayDrawn = false; trialToday = false; todayIdx = null;
    }

    const progress = p ? {
      drawn: Number(p.drawn || 0),
      got: gotMap.get(row.id) || [],
      todayDrawn, trialToday, todayIdx,
      unlocked: toBool(p.unlocked),
      trialUsed: Number(p.trial_used || 0),
      drawnLog: type === 'collect' ? (logMap.get(row.id) || []) : [],
      recs,
    } : {
      drawn: 0, got: [], todayDrawn: false, trialToday: false, todayIdx: null,
      unlocked: Number(row.price) === 0 || own,
      trialUsed: 0, drawnLog: [], recs: {},
    };

    return {
      id: row.id,
      title: row.title,
      covT: row.cov_t,
      covS: row.cov_s,
      cover: row.cover,
      coverImage: row.cover_image || '',
      cat: row.cat,
      type: row.type,
      price: Number(row.price || 0),
      trial: Number(row.trial || 0),
      count: Number(row.count || 0),
      pool: poolCards,
      intro: row.intro || '',
      creator: row.creator_name,
      heat: Number(row.heat || 0),
      date: row.date_text || '',
      signatureIdx: Number(row.signature_idx),
      signatureNote: row.signature_note || '',
      disclaimer: row.disclaimer || '',
      own,
      subscribed: !!p,
      totalDrawn: Number(row.total_drawn || 0),
      earn: Number(row.earn || 0),
      buyers: Number(row.buyers || 0),
      likes: Number(row.likes || 0),
      liked: likedSet.has(row.id),
      progress,
    };
  });
}

async function listSets(userId, { cat, sort } = {}) {
  let sql = `${SET_SELECT} WHERE s.status = 'published'`;
  const params = [];
  if (cat && cat !== 'all') { sql += ' AND s.cat = ?'; params.push(cat); }
  sql += sort === 'new'
    ? ' ORDER BY s.released_at DESC, s.id DESC'
    : ' ORDER BY s.heat DESC, s.id ASC';
  const [rows] = await pool.query(sql, params);
  return buildPayloads(pool, userId, rows);
}

/* 单集：附 social/commentCount/fans（getSet 契约） */
async function getSetWithMeta(userId, setId) {
  const [rows] = await pool.query(`${SET_SELECT} WHERE s.id = ?`, [setId]);
  if (!rows.length) return null;
  const [p] = await buildPayloads(pool, userId, rows);
  const [[cnt]] = await pool.query(
    "SELECT COUNT(*) AS n FROM comments WHERE set_id = ? AND status = 'visible'",
    [setId]
  );
  p.social = { liked: p.liked, likes: p.likes };
  p.commentCount = Number(cnt.n || 0);
  p.fans = await fansOf(pool, rows[0].creator_id);
  return p;
}

/* 事务内按 set_id 组装单集（抽卡/盖戳/解锁返回用） */
async function payloadInTx(conn, userId, setId) {
  const [rows] = await conn.query(`${SET_SELECT} WHERE s.id = ?`, [setId]);
  if (!rows.length) return null;
  const [p] = await buildPayloads(conn, userId, rows);
  return p;
}

module.exports = { buildPayloads, listSets, getSetWithMeta, payloadInTx, fansOf, SET_SELECT };
