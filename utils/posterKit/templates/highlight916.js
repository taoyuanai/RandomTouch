/* ══════════════════════════════════════════════════════════
   posterKit/templates/highlight916.js
   抽卡分享海报 · 9:16（1080×1920）
   V6：海报框 + 中央分享卡（与 3:4 同构，仅缩放）
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');
const { buildHighlightData, drawCard, drawPhotoPoster, drawTopStamp } = require('./highlight34.js');

const W = 360, HGT = 640, M = 24;

/* ── 背景 ── */
function drawBg(ctx, hasPhoto) {
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, HGT);
  const g = ctx.createLinearGradient(0, 0, 0, HGT);
  g.addColorStop(0, hasPhoto ? P.gray50 : P.paperWarm);
  g.addColorStop(0.6, P.paper);
  g.addColorStop(1, P.paper);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HGT);
  if (!hasPhoto) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = P.orange100;
    ctx.beginPath();
    ctx.arc(W - 6, 24, 152, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ── 顶栏 ── */
function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(15, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 52);
  drawTopStamp(ctx, data, W, M, false, 43);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 66);
  ctx.lineTo(W - M, 66);
  ctx.stroke();
}

/* ── 页脚 ── */
function drawFooter(ctx, data, qrImg) {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 512);
  ctx.lineTo(W - M, 512);
  ctx.stroke();
  ctx.restore();

  const tail = data.collect ? ` · 已点亮 ${data.gotN}/${data.count}` : ' · 天天可抽';
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const src = `来自《${data.setTitle}》${tail}`;
  ctx.fillText(H.ellipsisText(ctx, src, W - M * 2), M, 534);

  ctx.fillStyle = P.brandDeep;
  ctx.font = H.sansFont(15, 700);
  ctx.fillText('扫码，抽你的一签', M, 560);

  H.drawQR(ctx, qrImg, 276, 552, 60, { pad: 8 });
}

/* ════════════════ 主入口 ════════════════ */
async function drawHighlight916(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[highlight916]', e.message); return null; });

  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const photoImg = data.rec && data.rec.img && loadImage
    ? await safeLoad(data.rec.img) : null;

  if (photoImg) {
    drawPhotoPoster(ctx, data, photoImg, qrImg, {
      W, H: HGT, M, panelH: 160, mediaH: HGT - 160, overlay: false,
    });
    return;
  }
  drawBg(ctx, false);
  drawHeader(ctx, data);
  drawCard(ctx, data, null, { x: 45, y: 96, w: 270, h: 378, topH: 204 });
  drawFooter(ctx, data, qrImg);
}

module.exports = {
  drawHighlight916,
  buildHighlightData,
  SIZE: { W, H: HGT },
};
