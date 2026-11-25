/* tools/test/media.test.js — 上传前压缩与 5MB 上限 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules } = require('./harness');

test('压缩成功返回压缩路径；大小可读', async () => {
  installWx({
    compressImage: ({ src, success }) => success({ tempFilePath: src + '.compressed.jpg' }),
    getFileInfo: ({ success }) => success({ size: 1024 }),
  });
  resetModules();
  const media = require('../../lib/media.js');
  assert.equal(await media.compressForUpload('a.jpg'), 'a.jpg.compressed.jpg');
  assert.equal(await media.fileSizeOf('a.jpg.compressed.jpg'), 1024);
  assert.equal(await media.prepareUpload('a.jpg'), 'a.jpg.compressed.jpg');
});

test('压缩失败回退原图；无 API 也回退', async () => {
  installWx({
    compressImage: ({ fail }) => fail && fail({ errMsg: 'fail' }),
    getFileInfo: ({ success }) => success({ size: 10 }),
  });
  resetModules();
  const media = require('../../lib/media.js');
  assert.equal(await media.prepareUpload('b.jpg'), 'b.jpg');

  installWx({ compressImage: undefined, getFileInfo: undefined });
  resetModules();
  const media2 = require('../../lib/media.js');
  assert.equal(await media2.prepareUpload('c.jpg'), 'c.jpg');
});

test('压缩后仍超过 5MB 拒绝上传', async () => {
  installWx({
    compressImage: ({ src, success }) => success({ tempFilePath: src }),
    getFileInfo: ({ success }) => success({ size: 6 * 1024 * 1024 }),
  });
  resetModules();
  const media = require('../../lib/media.js');
  await assert.rejects(
    () => media.prepareUpload('big.jpg'),
    (e) => e && e.code === 'FILE_TOO_LARGE' && e.retryable === false
  );
});
