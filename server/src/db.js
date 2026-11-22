/* MySQL 连接池。MySQL 是唯一事实源；Redis 只做缓存与幂等快路径。 */
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true,
  dateStrings: true,       // DATE 返回 'YYYY-MM-DD'，避免时区二次换算
  timezone: '+08:00',      // 固定北京时间
  supportBigNumbers: true,
  bigNumberStrings: false,
});

async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  const conn = await pool.getConnection();
  try { await conn.ping(); } finally { conn.release(); }
}

module.exports = { pool, withTx, ping };
