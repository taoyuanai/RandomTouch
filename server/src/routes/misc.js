const express = require('express');
const { pool } = require('../db');
const { asyncHandler, ok } = require('../http/respond');
const { signedUrl, keyOfImage, isOwnedKey } = require('../services/cos');

const router = express.Router();

/* GET /me — 当前登录用户资料 */
router.get('/me', asyncHandler(async (req, res) => {
  const [[u]] = await pool.query(
    'SELECT id, nickname, avatar FROM users WHERE id = ?',
    [req.user.id]
  );
  const [[c]] = await pool.query(
    'SELECT name FROM creators WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );
  const avatarRaw = (u && u.avatar) || '';
  const avatarKey = keyOfImage(avatarRaw);
  const avatar = avatarKey
    ? (isOwnedKey(avatarKey, 'avatars', req.user.id) ? await signedUrl(avatarKey) : '')
    : avatarRaw;
  return ok(res, {
    id: req.user.id,
    name: (u && u.nickname) || '微信用户',
    avatar,
    creatorName: (c && c.name) || '',
  });
}));

/* POST /remind { enabled, time } */
router.post('/remind', asyncHandler(async (req, res) => {
  const enabled = req.body && req.body.enabled ? 1 : 0;
  const timeText = String((req.body && req.body.time) || '21:00').slice(0, 5);
  await pool.query(
    `INSERT INTO remind_auth (user_id, enabled, time_text, updated_ts) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), time_text = VALUES(time_text), updated_ts = VALUES(updated_ts)`,
    [req.user.id, enabled, timeText, Date.now()]
  );
  return ok(res, { ok: true });
}));

/* POST /track { event, props } — 允许静默失败 */
router.post('/track', asyncHandler(async (req, res) => {
  try {
    const event = String((req.body && req.body.event) || '').slice(0, 64);
    if (event) {
      await pool.query(
        'INSERT INTO events (user_id, event, props, ts) VALUES (?,?,?,?)',
        [req.user.id, event, JSON.stringify((req.body && req.body.props) || {}), Date.now()]
      );
    }
  } catch (e) { /* 埋点失败不影响主流程 */ }
  return ok(res, { ok: true });
}));

module.exports = router;
