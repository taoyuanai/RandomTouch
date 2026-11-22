/* 腾讯云 COS：服务端写入，客户端经 COS 域名直读。 */
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
      // 桶保持私有，对象级公有读：小程序 <image> 可直接用 COS URL
      ACL: 'public-read',
    }, (err, data) => {
      if (err) {
        // 只写日志，不回传给客户端内部细节
        console.error('[cos] putObject failed', {
          code: err.code, statusCode: err.statusCode, message: err.message,
        });
        return reject(internal('图片上传失败'));
      }
      resolve(data);
    });
  });
  return { key, url: urlOf(key) };
}

function urlOf(key) {
  if (!key) return '';
  if (/^https?:\/\//i.test(key)) return key;
  if (!config.cos.publicBase) return key;
  return `${config.cos.publicBase}/${String(key).replace(/^\/+/, '')}`;
}

module.exports = { putBuffer, urlOf, extOf };
