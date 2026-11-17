/* ══════════════════════════════════════════════════════════
   posterKit/export.js
   渲染导出流：offscreen canvas → 临时文件 → 相册
   基础库要求 ≥ 2.16.1（createOffscreenCanvas type:2d +
   canvasToTempFilePath 传 canvas 实例）
   ══════════════════════════════════════════════════════════ */
const H = require('./helpers.js');
const { drawWeekly34, buildWeeklyData, synthesizeLog } = require('./templates/weekly34.js');
const { drawWeekly916 } = require('./templates/weekly916.js');
const { drawHighlight34, buildHighlightData } = require('./templates/highlight34.js');
const { drawHighlight916 } = require('./templates/highlight916.js');
const { drawMemorial34, buildMemorialData } = require('./templates/memorial34.js');
const { drawMemorial916 } = require('./templates/memorial916.js');

/**
 * 通用渲染：在设计栅格 (width×height) 上绘制，按 scale 倍导出。
 * draw(ctx, loadImage) 为各模板的绘制函数——后续 highlight / memorial
 * 模板复用同一管线，只需换 draw。
 */
async function renderToTempFile({ width, height, scale = 3, draw, fileType = 'png', quality = 1 }) {
  await H.ensureFonts();
  const canvas = wx.createOffscreenCanvas({
    type: '2d',
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  });
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const loadImage = H.makeImageLoader(canvas);
  await draw(ctx, loadImage);
  const pxW = Math.round(width * scale);
  const pxH = Math.round(height * scale);
  return await new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: pxW,
      height: pxH,
      fileType,
      quality,
      destWidth: pxW,
      destHeight: pxH,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error('[posterKit] canvasToTempFilePath: ' + (err && err.errMsg))),
    });
  });
}

/** 周记 3:4 导出（照片版自动 jpg 0.92 / 卡面版 png） */
async function exportWeekly34(data) {
  const isPhoto = data.layout === 'photo' && (data.photos || []).length >= 2;
  return renderToTempFile({
    width: 414,
    height: 552,
    fileType: isPhoto ? 'jpg' : 'png',
    quality: isPhoto ? 0.92 : 1,
    draw: (ctx, loadImage) => drawWeekly34(ctx, data, { loadImage }),
  });
}

/** 周记 9:16 导出（朋友圈 1080×1920） */
async function exportWeekly916(data) {
  const isPhoto = data.layout === 'photo' && (data.photos || []).length >= 2;
  return renderToTempFile({
    width: 360,
    height: 640,
    fileType: isPhoto ? 'jpg' : 'png',
    quality: isPhoto ? 0.92 : 1,
    draw: (ctx, loadImage) => drawWeekly916(ctx, data, { loadImage }),
  });
}

/** 抽卡明信片 3:4 导出（小红书 1242×1656） */
async function exportHighlight34(data) {
  const isPhoto = !!(data.rec && data.rec.img);
  return renderToTempFile({
    width: 414,
    height: 552,
    fileType: isPhoto ? 'jpg' : 'png',
    quality: isPhoto ? 0.92 : 1,
    draw: (ctx, loadImage) => drawHighlight34(ctx, data, { loadImage }),
  });
}

/** 抽卡明信片 9:16 导出（朋友圈 1080×1920） */
async function exportHighlight916(data) {
  const isPhoto = !!(data.rec && data.rec.img);
  return renderToTempFile({
    width: 360,
    height: 640,
    fileType: isPhoto ? 'jpg' : 'png',
    quality: isPhoto ? 0.92 : 1,
    draw: (ctx, loadImage) => drawHighlight916(ctx, data, { loadImage }),
  });
}

/** 集齐纪念 3:4 导出（小红书 1242×1656，平色版 png） */
async function exportMemorial34(data) {
  return renderToTempFile({
    width: 414, height: 552, fileType: 'png', quality: 1,
    draw: (ctx, loadImage) => drawMemorial34(ctx, data, { loadImage }),
  });
}

/** 集齐纪念 9:16 导出（朋友圈 1080×1920） */
async function exportMemorial916(data) {
  return renderToTempFile({
    width: 360, height: 640, fileType: 'png', quality: 1,
    draw: (ctx, loadImage) => drawMemorial916(ctx, data, { loadImage }),
  });
}

/** 保存到相册（含权限拒绝 → 引导设置 的完整流） */
function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    const trySave = () => wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject,
    });
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        if (!/auth|denied|authorize/i.test(msg)) return reject(err);
        wx.showModal({
          title: '需要相册权限',
          content: '保存周记海报需要相册权限，请在设置中开启',
          confirmText: '去设置',
          success: (r) => {
            if (!r.confirm) return reject(err);
            wx.openSetting({
              success: (s) => {
                if (s.authSetting['scope.writePhotosAlbum']) trySave();
                else reject(err);
              },
              fail: reject,
            });
          },
        });
      },
    });
  });
}

/** 一步：生成 + 保存 */
async function exportAndSaveWeekly34(data) {
  const temp = await exportWeekly34(data);
  await saveToAlbum(temp);
  return temp;
}

/** 一步：生成 + 保存（9:16） */
async function exportAndSaveWeekly916(data) {
  const temp = await exportWeekly916(data);
  await saveToAlbum(temp);
  return temp;
}

async function exportAndSaveMemorial34(data) {
  const t = await exportMemorial34(data);
  await saveToAlbum(t);
  return t;
}

async function exportAndSaveMemorial916(data) {
  const t = await exportMemorial916(data);
  await saveToAlbum(t);
  return t;
}

module.exports = {
  renderToTempFile,
  exportWeekly34,
  exportWeekly916,
  exportHighlight34,
  exportHighlight916,
  exportMemorial34,
  exportMemorial916,
  saveToAlbum,
  exportAndSaveWeekly34,
  exportAndSaveWeekly916,
  exportAndSaveMemorial34,
  exportAndSaveMemorial916,
  buildWeeklyData,
  buildHighlightData,
  buildMemorialData,
  synthesizeLog,
  setPosterFontSource: H.setPosterFontSource,
  ensureFonts: H.ensureFonts,
};
