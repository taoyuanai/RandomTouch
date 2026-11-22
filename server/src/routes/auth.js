const express = require('express');
const { pool } = require('../db');
const { asyncHandler, ok } = require('../http/respond');
const { authFailed } = require('../http/errors');
const { signToken } = require('../http/auth');
const { code2session } = require('../services/session');

const router = express.Router();

/* POST /auth/login { code } → { token, openid }（real 适配层转成 {ok:true}） */
router.post('/login', asyncHandler(async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim();
  if (!code) throw authFailed('缺少登录 code');

  const sess = await code2session(code);
  const now = Date.now();
  await pool.query(
    `INSERT INTO users (openid, nickname, avatar, created_at, last_login_at)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE last_login_at = VALUES(last_login_at),
       nickname = IF(VALUES(nickname) <> '', VALUES(nickname), nickname),
       avatar   = IF(VALUES(avatar) <> '', VALUES(avatar), avatar)`,
    [sess.openid, String(req.body.nickname || '').slice(0, 64),
      String(req.body.avatar || '').slice(0, 512), now, now]
  );
  const [[user]] = await pool.query('SELECT * FROM users WHERE openid = ?', [sess.openid]);
  return ok(res, { token: signToken(user), openid: sess.openid });
}));

module.exports = router;
