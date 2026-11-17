/* ══════════════════════════════════════════════════════════
   posterKit/templates/highlight916.js
   抽卡明信片海报 · 朋友圈 9:16 母版
   导出 1080×1920（栅格 360×640 × scale 3）
   ─────────────────────────────────────────────
   构图：卡面复刻为 hero（区别于 3:4 的大字构图——
   朋友圈点开全屏，实体卡更有"晒物"感）
   ─────────────────────────────────────────────
   朋友圈三条硬规则：
   ① 最小笔画 2px  ② 正文下限 12px  ③ QR ≥60 + 8px 白衬圈
   ─────────────────────────────────────────────
   垂直栅格：
   顶栏    基线52（照片版无 hairline，纸面版 2px @66）
   卡面    216×324 @（72,100）旋转-1.5°；钢戳压右上角
           内含：徽章/No. → 词（38/32/28/两行26）→ 解签2行 → @作者
   引用    452..508 回信句 15px/24 × 3 行（居中）
   分隔    虚线 2px @524；出处 12px @548
   底部    QR 60×60 @（276,556）+8 白衬圈；CTA 15px/700 @580；slogan @606
   背景    有照片：cover 铺底 + 顶/底白纱；无照片：暖纸纵向渐变
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');
const { buildHighlightData } = require('./highlight34.js');   // 数据装配复用

const W = 360, HGT = 640, M = 24;
const CARD_W = 216, CARD_H = 324, CARD_X = 72, CARD_Y = 100;

/* ════════════════ 主入口 ════════════════ */

async function drawHighlight916(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[highlight916]', e.message); return null; });

  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const hasPhoto = !!(data.rec && data.rec.img);
  const photoImg = hasPhoto && loadImage ? await safeLoad(data.rec.img) : null;

  if (photoImg) drawPhotoBg(ctx, photoImg);
  else drawPaperBg(ctx);

  drawHeader916(ctx, data, !photoImg);
  drawCardFace(ctx, data);
  drawQuote916(ctx, data);
  drawSource916(ctx, data);
  drawBottom916(ctx, data, qrImg);
}

/* ── 背景 ── */
function drawPhotoBg(ctx, img) {
  H.coverDraw(ctx, img, 0, 0, W, HGT);
  let g = ctx.createLinearGradient(0, 0, 0, 76);   // 顶纱：承托顶栏
  g.addColorStop(0, 'rgba(255,255,255,0.58)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 76);
  g = ctx.createLinearGradient(0, 320, 0, HGT);    // 底纱：承托引用/底部
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.90)');
  g.addColorStop(1, 'rgba(255,255,255,0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 320, W, HGT - 320);
}

function drawPaperBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, HGT);
  g.addColorStop(0, P.paperWarm);
  g.addColorStop(1, P.paper);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HGT);
}

/* ── 顶栏 ── */
function drawHeader916(ctx, data, withLine) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(15, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 52);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.date, W - M, 52);
  if (withLine) {
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 2;                              // 规则①
    ctx.beginPath();
    ctx.moveTo(M, 66);
    ctx.lineTo(W - M, 66);
    ctx.stroke();
  }
}

/* ════════════════ 卡面 hero ════════════════ */

function drawCardFace(ctx, data) {
  ctx.save();
  ctx.translate(CARD_X + CARD_W / 2, CARD_Y + CARD_H / 2);
  ctx.rotate(-1.5 * Math.PI / 180);
  ctx.translate(-CARD_W / 2, -CARD_H / 2);          // 局部坐标 (0,0)=卡左上

  ctx.shadowColor = 'rgba(176,128,74,0.16)';        // 纸的实体感投影
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#FFFFFF';
  H.roundRect(ctx, 0, 0, CARD_W, CARD_H, 14);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = P.orange100;                    // 规则①：卡框 2px
  ctx.lineWidth = 2;
  H.roundRect(ctx, 1, 1, CARD_W - 2, CARD_H - 2, 13);
  ctx.stroke();

  ctx.save();                                       // 稀有度顶条 6px（渐变，裁圆角）
  H.roundRect(ctx, 0, 0, CARD_W, CARD_H, 14);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, CARD_W, 0);
  bg.addColorStop(0, data.isSSR ? P.gold.light : (P.rarLight[data.rar] || P.rarLight.N));
  bg.addColorStop(1, data.isSSR ? P.gold.deep : (P.rar[data.rar] || P.rar.N));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, 6);
  ctx.restore();

  drawBadge(ctx, data);                             // 徽章（左）+ No.（右）
  drawBigWord(ctx, data);
  drawExplain(ctx, data);

  ctx.fillStyle = P.ink3;                           // 卡底：@作者
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`@${data.creator}`, CARD_W / 2, CARD_H - 22);

  ctx.restore();

  // 钢戳压卡右上角（卡外绘制，不受旋转坐标系影响）
  const stampText = data.rec
    ? data.rec.stampDate
    : data.date.replace(/月/g, '.').replace(/日/g, '');
  H.drawStamp(ctx, CARD_X + CARD_W - 62, CARD_Y - 8,
    { text: stampText, w: 62, h: 20, size: 8.5, rotate: -4 });
}

function drawBadge(ctx, data) {
  ctx.font = H.sansFont(10, 700);
  const tw = ctx.measureText(data.rar).width;
  const bw = tw + 16, bh = 18, bx = 16, by = 24;
  const c = P.rarText[data.rar] || P.rarText.N;
  ctx.save();                                       // 稀有度徽章：描边 + 8% 底
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = c;
  H.roundRect(ctx, bx, by, bw, bh, 9);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  H.roundRect(ctx, bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5, 9);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.rar, bx + bw / 2, by + bh / 2 + 0.5);

  ctx.fillStyle = P.ink3;                           // No.
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.no, CARD_W - 16, by + bh / 2 + 0.5);
  ctx.textBaseline = 'alphabetic';
}

function drawBigWord(ctx, data) {
  const word = data.word || '';
  const n = word.length;
  const cx = CARD_W / 2;
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (n >= 7) {                                     // 长词两行（与站内 bw 策略同构）
    const split = Math.ceil(n / 2);
    ctx.font = H.serifFont(26, 700);
    ctx.fillText(H.ellipsisText(ctx, word.slice(0, split), CARD_W - 36), cx, 138);
    ctx.fillText(H.ellipsisText(ctx, word.slice(split), CARD_W - 36), cx, 170);
  } else {
    ctx.font = H.serifFont(n <= 4 ? 38 : (n === 5 ? 32 : 28), 700);
    ctx.fillText(H.ellipsisText(ctx, word, CARD_W - 32), cx, 154);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawExplain(ctx, data) {
  ctx.fillStyle = P.ink2;                           // 解签（规格补漏项）
  ctx.font = H.serifFont(12, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, data.text, CARD_W - 40, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, CARD_W / 2, 198 + i * 20));
  ctx.textBaseline = 'alphabetic';
}

/* ════════════════ 下半区 ════════════════ */

function drawQuote916(ctx, data) {
  if (!(data.rec && data.rec.note)) return;
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(15, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, `「${data.rec.note}」`, W - M * 2, 3);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 452 + i * 24));
  ctx.textBaseline = 'alphabetic';
}

function drawSource916(ctx, data) {
  ctx.save();                                       // 虚线 2px（规则①）
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, 524);
  ctx.lineTo(W - M, 524);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const tail = data.collect ? `已点亮 ${data.gotN}/${data.count}` : '天天可抽';
  ctx.fillText(`来自《${H.ellipsisText(ctx, data.setTitle, 200)}》 · @${data.creator} · ${tail}`, W / 2, 548);
}

function drawBottom916(ctx, data, qrImg) {
  H.drawQR(ctx, qrImg, 276, 556, 60, { pad: 8 });   // 规则③
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.brandDeep;                      // CTA
  ctx.font = H.sansFont(15, 700);
  ctx.fillText('扫码，抽你的一签', M, 580);
  ctx.fillStyle = P.ink3;                           // slogan
  ctx.font = H.sansFont(12, 400);
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan, M, 606);
  H.setLetterSpacing(ctx, 0);
  ctx.textBaseline = 'alphabetic';
}

module.exports = {
  drawHighlight916,
  buildHighlightData,                               // 透传，调用方从任一模块引入均可
  SIZE: { W, H: HGT },
};
