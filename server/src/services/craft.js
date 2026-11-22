/* 我的创作：已发布（sets）+ 审核中（set_reviews）。草稿只留在客户端。 */
const { pool } = require('../db');
const { secRejected } = require('../http/errors');
const { checkText } = require('./sec');
const time = require('./time');
const { buildPayloads, SET_SELECT } = require('./setPayload');

function draftVM(payload, submittedText) {
  const d = payload || {};
  return {
    id: d.id,
    title: d.title || '',
    intro: d.intro || '',
    type: d.type,
    cat: d.cat,
    price: d.price,
    trial: d.trial,
    coverImage: d.coverImage || '',
    signatureIdx: d.signatureIdx != null ? d.signatureIdx : -1,
    signatureNote: d.signatureNote || '',
    submitted: submittedText || d.submitted || '',
    pool: d.pool || [],
  };
}

async function getMyCraft(userId) {
  const [[creator]] = await pool.query('SELECT id FROM creators WHERE user_id = ?', [userId]);
  let published = [];
  if (creator) {
    const [rows] = await pool.query(
      `${SET_SELECT} WHERE s.creator_id = ? AND s.status = 'published' ORDER BY s.id ASC`,
      [creator.id]
    );
    published = await buildPayloads(pool, userId, rows);
  }
  const [reviews] = await pool.query(
    "SELECT payload, submitted_text FROM set_reviews WHERE user_id = ? AND status = 'reviewing' ORDER BY id DESC",
    [userId]
  );
  return {
    published,
    reviewing: reviews.map(r => draftVM(parse(r.payload), r.submitted_text)),
  };
}

async function submitCraft(user, draftInput) {
  const draft = draftInput && typeof draftInput === 'object' ? draftInput : null;
  if (!draft) throw secRejected('草稿内容为空');
  const title = String(draft.title || '').trim().slice(0, 32);
  const intro = String(draft.intro || '').trim().slice(0, 500);
  if (!title) throw secRejected('请填写卡集名称');
  const cards = Array.isArray(draft.pool) ? draft.pool : [];
  const body = [title, intro].concat(cards.map(c => `${(c && c.w) || ''} ${(c && c.b) || ''}`)).join('\n');

  const status = await checkText({ content: body.slice(0, 2500), openid: user.openid });
  if (status === 'risky') throw secRejected();

  const now = Date.now();
  const payload = {
    id: draft.id || now,
    title,
    intro,
    type: draft.type || 'collect',
    cat: draft.cat,
    price: Number(draft.price || 0),
    trial: Number(draft.trial || 0),
    coverImage: draft.coverImage || '',
    signatureIdx: draft.signatureIdx != null ? draft.signatureIdx : -1,
    signatureNote: draft.signatureNote || '',
    pool: cards,
    status: 'reviewing',
  };
  await pool.query(
    'INSERT INTO set_reviews (user_id, payload, status, submitted_ts, submitted_text) VALUES (?,?,?,?,?)',
    [user.id, JSON.stringify(payload), 'reviewing', now, time.todayMD(now)]
  );
  return { status: 'submitted' };
}

function parse(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return {}; }
}

module.exports = { getMyCraft, submitCraft };
