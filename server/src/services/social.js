/* 留言 / 点赞 / 作者 / 关注。 */
const { withTx, pool } = require('../db');
const { setNotFound, secRejected } = require('../http/errors');
const { checkText } = require('./sec');
const time = require('./time');
const { buildPayloads, fansOf, SET_SELECT } = require('./setPayload');

function commentVM(c) {
  return {
    id: c.id,
    name: c.name,
    avatar: c.avatar || (c.name || '签').slice(0, 1),
    text: c.text,
    time: time.commentTimeText(Number(c.created_ts)),
    creator: !!Number(c.is_creator),
  };
}

async function getComments(setIdInput) {
  const setId = Number(setIdInput);
  const [[set]] = await pool.query('SELECT id FROM sets WHERE id = ?', [setId]);
  if (!set) throw setNotFound();
  const [rows] = await pool.query(
    "SELECT * FROM comments WHERE set_id = ? AND status = 'visible' ORDER BY created_ts DESC",
    [setId]
  );
  return rows.map(commentVM);
}

async function addComment(user, setIdInput, textInput) {
  const userId = user.id;
  const setId = Number(setIdInput);
  const text = String(textInput || '').trim().slice(0, 200);
  const [[set]] = await pool.query(
    'SELECT s.id, s.creator_id, c.user_id AS creator_user_id FROM sets s JOIN creators c ON c.id = s.creator_id WHERE s.id = ?',
    [setId]
  );
  if (!set) throw setNotFound();
  if (!text) throw secRejected('留言不能为空');

  const secStatus = await checkText({ content: text, openid: user.openid });
  if (secStatus === 'risky') throw secRejected();
  const isCreator = Number(set.creator_user_id) === Number(userId);
  const dbStatus = secStatus === 'pending' ? 'pending' : 'visible';

  const [[u]] = await pool.query('SELECT nickname, avatar FROM users WHERE id = ?', [userId]);
  const name = (u && u.nickname) || '微信用户';
  const avatar = (u && u.avatar && u.avatar.length <= 4) ? u.avatar : name.slice(0, 1);
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const row = {
    id, name, avatar,
    text, is_creator: isCreator ? 1 : 0, created_ts: now, status: dbStatus,
  };
  await pool.query(
    `INSERT INTO comments (id, set_id, user_id, name, avatar, text, is_creator, status, created_ts)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, setId, userId, row.name, row.avatar, text, row.is_creator, dbStatus, now]
  );
  return { comment: commentVM(row), status: secStatus === 'pending' ? 'pending' : 'visible' };
}

async function toggleLike(userId, setIdInput) {
  const setId = Number(setIdInput);
  return withTx(async (conn) => {
    const [[set]] = await conn.query('SELECT id FROM sets WHERE id = ? FOR UPDATE', [setId]);
    if (!set) throw setNotFound();
    const [[liked]] = await conn.query(
      'SELECT 1 AS x FROM set_likes WHERE user_id = ? AND set_id = ?', [userId, setId]
    );
    let on;
    if (liked) {
      await conn.query('DELETE FROM set_likes WHERE user_id = ? AND set_id = ?', [userId, setId]);
      await conn.query('UPDATE sets SET likes = GREATEST(0, likes - 1) WHERE id = ?', [setId]);
      on = false;
    } else {
      await conn.query(
        'INSERT INTO set_likes (user_id, set_id, created_ts) VALUES (?,?,?)',
        [userId, setId, Date.now()]
      );
      await conn.query('UPDATE sets SET likes = likes + 1 WHERE id = ?', [setId]);
      on = true;
    }
    const [[s]] = await conn.query('SELECT likes FROM sets WHERE id = ?', [setId]);
    return { liked: on, likes: Number(s.likes || 0) };
  });
}

async function getAuthor(userId, nameInput) {
  const name = String(nameInput || '');
  const [[creator]] = await pool.query('SELECT * FROM creators WHERE name = ?', [name]);
  if (!creator) {
    return { name, own: false, fans: 0, followed: false, works: [] };
  }
  const [rows] = await pool.query(
    `${SET_SELECT} WHERE s.creator_id = ? AND s.status = 'published' ORDER BY s.id ASC`,
    [creator.id]
  );
  const works = await buildPayloads(pool, userId, rows);
  const [[f]] = await pool.query(
    'SELECT 1 AS x FROM follows WHERE user_id = ? AND creator_id = ?', [userId, creator.id]
  );
  return {
    name: creator.name,
    own: Number(creator.user_id) === Number(userId),
    fans: await fansOf(pool, creator.id),
    followed: !!f,
    works,
  };
}

async function toggleFollow(userId, nameInput) {
  const name = String(nameInput || '');
  if (!name) return { followed: false, fans: 0 };
  let [[creator]] = await pool.query('SELECT * FROM creators WHERE name = ?', [name]);
  if (!creator) {
    await pool.query(
      'INSERT IGNORE INTO creators (name, user_id, base_fans, created_at) VALUES (?, NULL, 0, ?)',
      [name, Date.now()]
    );
    [[creator]] = await pool.query('SELECT * FROM creators WHERE name = ?', [name]);
  }
  const [[f]] = await pool.query(
    'SELECT 1 AS x FROM follows WHERE user_id = ? AND creator_id = ?', [userId, creator.id]
  );
  let followed;
  if (f) {
    await pool.query('DELETE FROM follows WHERE user_id = ? AND creator_id = ?', [userId, creator.id]);
    followed = false;
  } else {
    await pool.query(
      'INSERT IGNORE INTO follows (user_id, creator_id, created_ts) VALUES (?,?,?)',
      [userId, creator.id, Date.now()]
    );
    followed = true;
  }
  return { followed, fans: await fansOf(pool, creator.id) };
}

module.exports = { getComments, addComment, toggleLike, getAuthor, toggleFollow };
