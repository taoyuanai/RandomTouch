#!/usr/bin/env node
/* 在服务器上为指定 openid 生成 JWT（仅用于本地/服务器冒烟测试）。
 * 不会创建调试登录接口，避免线上多一条攻击面。
 *
 * 用法：node scripts/mint-token.js <openid> [nickname]
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');
const { signToken } = require('../src/http/auth');

(async () => {
  const openid = String(process.argv[2] || '').trim();
  const nickname = String(process.argv[3] || '测试账号').slice(0, 64);
  if (!openid) { console.error('用法: node scripts/mint-token.js <openid> [nickname]'); process.exit(1); }
  if (!config.jwtSecret) { console.error('缺少 JWT_SECRET'); process.exit(1); }

  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password, database: config.db.database,
    charset: 'utf8mb4', timezone: '+08:00',
  });
  try {
    const now = Date.now();
    await conn.query(
      `INSERT INTO users (openid, nickname, avatar, created_at, last_login_at)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE last_login_at = VALUES(last_login_at)`,
      [openid, nickname, '', now, now]
    );
    const [[user]] = await conn.query('SELECT * FROM users WHERE openid = ?', [openid]);
    const token = signToken(user);
    console.log(JSON.stringify({ userId: user.id, openid, token }));
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('[mint-token] 失败:', err && err.message ? err.message : err);
  process.exit(1);
});
