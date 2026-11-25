/* 腾讯云 COS：服务端写入，客户端只拿短期签名 URL 读。
 * 桶与对象均私有；不再生成 public-read URL。 */
const crypto = require('crypto');
const COS = require('cos-nodejs-sdk-v5');
const config = require('../config');
const { internal } = require('../http/errors');

let client = null;
function getClient() {
  if (!config.cos.secretId || !config.cos.secretKey || !config.cos.bucket || !config.cos.region) {
    throw internal('未配置 COS（COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET/COS_REGION）');
  }
  if (!client) {
    client = new COS({ SecretId: config.cos.secretId, SecretKey: config.cos.secretKey });
  }
  return client;
}

function extOf(mime, originalName) {
  const byMime = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif',
  };
  if (byMime[mime]) return byMime[mime];
  const m = String(originalName || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

function keyFor(kind, userId) {
  const rand = crypto.randomBytes(8).toString('hex');
  return `${config.cos.prefix}/${kind}/${userId}/${rand}`;
}

/** 兼容旧数据：URL / key → 对象 key；外部 URL 返回空。 */
function decodePath(p) {
  try { return decodeURIComponent(p); } catch (e) { return p; }
}

function keyFrom(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) return v.replace(/^\/+/, '').split('?')[0];
  if (config.cos.publicBase && v.startsWith(config.cos.publicBase + '/')) {
    return decodePath(v.slice(config.cos.publicBase.length + 1).split('?')[0]);
  }
  try {
    const u = new URL(v);
    if (/\.cos\./i.test(u.hostname) || (config.cos.bucket && u.hostname.includes(config.cos.bucket))) {
      return decodePath(u.pathname.replace(/^\/+/, ''));
    }
  } catch (e) { /* ignore */ }
  return '';
}

function keyOfImage(imgFileID, imgUrl) {
  return keyFrom(imgFileID) || keyFrom(imgUrl);
}

function isOwnedKey(value, kind, userId) {
  const key = keyFrom(value);
  const prefix = `${config.cos.prefix}/${kind}/${userId}/`;
  return !!key && key.startsWith(prefix) && !key.includes('..');
}

const signedCache = new Map();
function trimCache() {
  if (signedCache.size <= 3000) return;
  const drop = signedCache.size - 2500;
  let i = 0;
  for (const k of signedCache.keys()) {
    if (i++ >= drop) break;
    signedCache.delete(k);
  }
}

/** 生成短期 GET 签名 URL；同一 key 在有效期内复用。 */
async function signedUrl(keyOrUrl, expires) {
  const key = keyFrom(keyOrUrl);
  if (!key) return '';
  const ttl = Math.max(60, Number(expires || config.cos.urlExpire || 86400));
  const cacheKey = `${key}:${ttl}`;
  const now = Date.now();
  const hit = signedCache.get(cacheKey);
  if (hit && hit.expiresAt > now + 60000) return hit.url;
  let cos;
  try { cos = getClient(); } catch (e) { return ''; }
  try {
    const url = await new Promise((resolve, reject) => {
      cos.getObjectUrl({
        Bucket: config.cos.bucket,
        Region: config.cos.region,
        Key: key,
        Sign: true,
        Expires: ttl,
      }, (err, data) => {
        if (err || !data || !data.Url) return reject(err || new Error('sign failed'));
        resolve(data.Url);
      });
    });
    signedCache.set(cacheKey, { url, expiresAt: now + Math.max(60, ttl - 120) * 1000 });
    trimCache();
    return url;
  } catch (e) {
    console.error('[cos] signedUrl failed', { key, message: e && e.message });
    return '';
  }
}

async function putBuffer({ buffer, mime, kind, userId, ext }) {
  const key = `${keyFor(kind, userId)}.${ext || extOf(mime)}`;
  const cos = getClient();
  await new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: config.cos.bucket,
      Region: config.cos.region,
      Key: key,
      Body: buffer,
      ContentType: mime || 'application/octet-stream',
      ACL: 'private',
    }, (err, data) => {
      if (err) {
        console.error('[cos] putObject failed', {
          code: err.code, statusCode: err.statusCode, message: err.message,
        });
        return reject(internal('图片上传失败'));
      }
      resolve(data);
    });
  });
  return { key, url: await signedUrl(key) };
}

module.exports = {
  putBuffer,
  extOf,
  signedUrl,
  keyFrom,
  keyOfImage,
  isOwnedKey,
};
