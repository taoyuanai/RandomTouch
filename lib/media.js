/* lib/media.js — 上传前图片压缩与大小校验
 * 与 server/src/config.js 的 uploadMaxBytes 默认值保持一致。
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function compressForUpload(src, quality) {
  if (!src) return Promise.resolve('');
  if (typeof wx.compressImage !== 'function') return Promise.resolve(src);
  return new Promise((resolve) => {
    wx.compressImage({
      src,
      quality: quality || 80,
      success: (r) => resolve((r && r.tempFilePath) || src),
      fail: () => resolve(src),
    });
  });
}

function fileSizeOf(filePath) {
  if (!filePath) return Promise.resolve(0);
  if (typeof wx.getFileInfo === 'function') {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath,
        success: (r) => resolve(Number((r && r.size) || 0)),
        fail: () => resolve(0),
      });
    });
  }
  if (wx.getFileSystemManager) {
    try {
      const fs = wx.getFileSystemManager();
      if (fs && typeof fs.getFileInfo === 'function') {
        return new Promise((resolve) => {
          fs.getFileInfo({
            filePath,
            success: (r) => resolve(Number((r && r.size) || 0)),
            fail: () => resolve(0),
          });
        });
      }
    } catch (e) { /* noop */ }
  }
  return Promise.resolve(0);
}

async function prepareUpload(src, quality) {
  const out = await compressForUpload(src, quality);
  const size = await fileSizeOf(out);
  if (size > MAX_UPLOAD_BYTES) {
    throw {
      code: 'FILE_TOO_LARGE',
      message: '图片超过 5MB，请换一张更小的图',
      retryable: false,
      size,
    };
  }
  return out;
}

module.exports = { MAX_UPLOAD_BYTES, compressForUpload, fileSizeOf, prepareUpload };
