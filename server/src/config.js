/* 环境配置：只从 process.env 读取，缺失时给安全默认值。
 * 生产（APP_ENV=prod）缺关键密钥应启动失败，避免带病上线。
 */
require('dotenv').config();

const env = process.env;
const APP_ENV = env.APP_ENV || 'test';
const isProd = APP_ENV === 'prod';

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

const config = {
  appEnv: APP_ENV,
  isProd,
  port: num(env.PORT, 3000),
  host: env.HOST || '127.0.0.1',
  logLevel: env.LOG_LEVEL || 'info',

  jwtSecret: env.JWT_SECRET || '',
  jwtExpire: env.JWT_EXPIRE || '30d',

  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: num(env.DB_PORT, 3306),
    user: env.DB_USER || 'rt_test',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'randomtouch_test',
    connectionLimit: num(env.DB_POOL, 10),
  },

  redis: {
    url: env.REDIS_URL || 'redis://127.0.0.1:6379',
    db: num(env.REDIS_DB, 1),
    keyPrefix: env.REDIS_PREFIX || 'rt:test:',
  },

  wx: {
    appid: env.WX_APPID || '',
    secret: env.WX_SECRET || '',
  },

  cos: {
    secretId: env.COS_SECRET_ID || '',
    secretKey: env.COS_SECRET_KEY || '',
    bucket: env.COS_BUCKET || '',
    region: env.COS_REGION || '',
    publicBase: (env.COS_PUBLIC_BASE || '').replace(/\/+$/, ''),
    prefix: (env.COS_PREFIX || 'test').replace(/^\/+|\/+$/g, ''),
  },

  secMode: env.SEC_MODE === 'real' ? 'real' : 'mock',
  uploadMaxBytes: num(env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
  withdrawThreshold: num(env.WITHDRAW_THRESHOLD, 100),
};

function assertProd() {
  if (!isProd) return;
  const missing = [];
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (!config.wx.appid || !config.wx.secret) missing.push('WX_APPID/WX_SECRET');
  if (!config.cos.secretId || !config.cos.secretKey || !config.cos.bucket) missing.push('COS_*');
  if (missing.length) {
    throw new Error(`[config] 生产环境缺少必填项: ${missing.join(', ')}`);
  }
}
assertProd();

module.exports = config;
