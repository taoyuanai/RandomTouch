/* Redis：幂等快路径 / 缓存 / 限流。丢失不影响正确性（MySQL 兜底）。 */
const Redis = require('ioredis');
const config = require('./config');

const redis = new Redis(config.redis.url, {
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => {
  // 不让 Redis 故障拖垮 API：只记录，业务继续走 MySQL
  if (process.env.NODE_ENV !== 'test') {
    console.error('[redis]', err && err.message ? err.message : err);
  }
});

async function safeGet(key) {
  try { return await redis.get(key); } catch (e) { return null; }
}
async function safeSet(key, val, seconds) {
  try {
    if (seconds) await redis.set(key, val, 'EX', seconds);
    else await redis.set(key, val);
  } catch (e) { /* ignore */ }
}
async function safeDel(...keys) {
  try { if (keys.length) await redis.del(...keys); } catch (e) { /* ignore */ }
}
async function lock(key, ttlMs = 10000) {
  try {
    const r = await redis.set(key, '1', 'PX', ttlMs, 'NX');
    return r === 'OK';
  } catch (e) {
    return true; // Redis 不可用时不阻塞（MySQL 行锁仍是正确性保障）
  }
}
async function unlock(key) { await safeDel(key); }

module.exports = { redis, safeGet, safeSet, safeDel, lock, unlock };
