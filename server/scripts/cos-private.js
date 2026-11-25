#!/usr/bin/env node
/* 将 COS 桶及前缀下已有对象改为私有。
 * 用法：node scripts/cos-private.js --yes
 * 新上传对象已由 putBuffer 设置 ACL=private；本脚本用于清理历史 public-read 对象。
 */
const COS = require('cos-nodejs-sdk-v5');
const config = require('../src/config');

if (!process.argv.includes('--yes')) {
  console.error('[cos-private] 会修改线上 COS ACL。确认后加 --yes 再执行。');
  process.exit(2);
}
if (!config.cos.secretId || !config.cos.secretKey || !config.cos.bucket || !config.cos.region) {
  console.error('[cos-private] 缺少 COS 配置');
  process.exit(2);
}

const cos = new COS({ SecretId: config.cos.secretId, SecretKey: config.cos.secretKey });
const Bucket = config.cos.bucket;
const Region = config.cos.region;
const Prefix = `${config.cos.prefix}/`;

function call(method, params) {
  return new Promise((resolve, reject) => {
    cos[method](params, (err, data) => err ? reject(err) : resolve(data));
  });
}

(async () => {
  await call('putBucketAcl', { Bucket, Region, ACL: 'private' });
  console.log('[cos-private] bucket ACL = private');

  let marker = '';
  let count = 0;
  do {
    const data = await call('getBucket', {
      Bucket, Region, Prefix, Marker: marker, MaxKeys: 1000,
    });
    const list = data.Contents || [];
    for (const obj of list) {
      await call('putObjectAcl', { Bucket, Region, Key: obj.Key, ACL: 'private' });
      count++;
    }
    console.log(`[cos-private] ${count} objects updated`);
    marker = String(data.IsTruncated) === 'true' ? data.NextMarker : '';
  } while (marker);

  console.log(`[cos-private] done · ${count} objects under ${Prefix}`);
})().catch(err => {
  console.error('[cos-private] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
