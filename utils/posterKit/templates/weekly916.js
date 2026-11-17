/* ══════════════════════════════════════════════════════════
   posterKit/templates/weekly916.js
   周记海报 · 朋友圈 9:16 母版
   导出 1080×1920（栅格 360×640 × scale 3）
   ─────────────────────────────────────────────
   数据装配与 3:4 版完全复用（buildWeeklyData 见 weekly34.js），
   本文件只负责 9:16 版式绘制。
   ─────────────────────────────────────────────
   朋友圈三条硬规则（贯穿全文件）：
   ① 最小笔画 2px（hairline / 卡框 / 分隔线全部升 2px）
   ② 正文下限 13px（辅助字从 3:4 的 10–11px 升档）
   ③ QR ≥ 60×60 + 8px 白衬圈（压缩后仍隔屏可扫）
   ─────────────────────────────────────────────
   垂直栅格（y 坐标表）：
   顶栏     16–42   品牌 15px 左 / 日期区间 12px 右；hairline 2px @54
   眉题     基线 78  《集名》· 第 N 周（12px brand, ls2）
   标题     92–172  衬线 30px/40，最多 2 行
   卡面版   卡墙 4+4：行 184 / 288（卡 72×96，第 8 槽虚线「明天」）
   照片版   主拍立得 224×168 @（36,184）−2°
            副拍立得 152×114 @（168,248）+2.5°；词行基线 392
   邮戳带   410–424 7 × 38×14，gap 5（296 居中）
   数据行   444     13px（数字 15px bold）
   引用     464–508 衬线 14px/22 × 2 行（全宽——QR 在下方，无需避让）
   分隔线   528     虚线 2px
   底部     552–612 QR 60×60 @（276,552）+ 8px 白衬圈；CTA 572 / slogan 600
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');
const { buildWeeklyData } = require('./weekly34.js');   // 数据装配复用

const W = 360, HGT = 640, M = 24, CW = W - M * 2;      // 内容宽 312
const CARD_W = 72, CARD_H = 96, GAP = 8;               // 4×72 + 3×8 = 312 满宽
const SLOT_LABELS = ['明天', '后天'];                    // 虚线槽位文案（按序取）

/* ════════════════ 主入口 ════════════════ */

async function drawWeekly916(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[weekly916]', e.message); return null; });

  // 0. 预载图片（失败降级，不阻塞整体）
  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const photoImgs = [];
  for (const ph of (data.photos || []).slice(0, 2)) {
    photoImgs.push(loadImage ? await safeLoad(ph.src) : null);
  }
  const photoOk = photoImgs.filter(Boolean).length;

  // 1. 纸面
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, HGT);

  // 2. 公共区
  drawHeader(ctx, data);
  drawEyebrow(ctx, data);
  drawTitle(ctx, data);

  // 3. 中段（照片版要求 2 张图都加载成功，否则落回卡面版）
  if (data.layout === 'photo' && photoOk >= 2) {
    drawPhotoCollage(ctx, data, photoImgs);
    drawWordLine(ctx, data, 392);
  } else {
    drawCardGrid(ctx, data);
  }

  // 4. 下半区（两版共用）
  drawStampBand(ctx, data, 410);
  drawStatsLine(ctx, data, 444);
  drawQuote(ctx, data, 464);
  drawFooter(ctx, data, qrImg);
}

/* ── 顶栏：品牌 + 日期区间 + 2px hairline ── */
function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(15, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 42);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.dateRangeText, W - M, 42);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;                        // 规则①：hairline 升 2px
  ctx.beginPath();
  ctx.moveTo(M, 54);
  ctx.lineTo(W - M, 54);
  ctx.stroke();
}

/* ── 眉题：《集名》· 第 N 周 ── */
function drawEyebrow(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = P.brand;
  ctx.font = H.sansFont(12, 500);
  H.setLetterSpacing(ctx, 2);
  ctx.fillText(`《${data.title}》 · 第 ${data.weekNo} 周`, M, 78);
  H.setLetterSpacing(ctx, 0);
}

/* ── 标题：衬线 30px/40，最多 2 行 ── */
function drawTitle(ctx, data) {
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(30, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, data.titleText, CW, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, M, 92 + i * 40));
  ctx.textBaseline = 'alphabetic';
}

/* ════════════════ 卡面版：4+4 卡墙 ════════════════ */

function drawCardGrid(ctx, data) {
  const cards = data.cards.slice(0, 8);
  for (let i = 0; i < 8; i++) {
    const x = M + (i % 4) * (CARD_W + GAP);
    const y = 184 + Math.floor(i / 4) * (CARD_H + GAP);
    if (i < cards.length) drawCard(ctx, cards[i], x, y);
    else drawEmptySlot(ctx, x, y, SLOT_LABELS[i - cards.length] || '');
  }
}

function drawCard(ctx, card, x, y) {
  ctx.fillStyle = P.paperWarm;
  H.roundRect(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.fill();
  ctx.strokeStyle = P.orange100;
  ctx.lineWidth = 2;                        // 规则①：卡框升 2px
  H.roundRect(ctx, x + 1, y + 1, CARD_W - 2, CARD_H - 2, 7);
  ctx.stroke();
  ctx.save();                               // 稀有度顶条裁剪在卡形内
  H.roundRect(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.clip();
  ctx.fillStyle = P.rar[card.rarity] || P.rar.N;
  ctx.fillRect(x, y, CARD_W, 4);
  ctx.restore();
  drawCardWord(ctx, card.word, x + CARD_W / 2, y + CARD_H / 2 + 2);
}

function drawCardWord(ctx, word, cx, cy) {
  const n = (word || '').length;
  const maxW = CARD_W - 8;                  // 64
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (n >= 6) {                             // 长词拆两行
    const split = Math.ceil(n / 2);
    const l1 = word.slice(0, split), l2 = word.slice(split);
    ctx.font = H.serifFont(12, 600);
    ctx.fillText(H.ellipsisText(ctx, l1, maxW), cx, cy - 7);
    if (l2) ctx.fillText(H.ellipsisText(ctx, l2, maxW), cx, cy + 7);
  } else if (n === 5) {                     // 5 字单行降一号（5×12=60 ≤ 64）
    ctx.font = H.serifFont(12, 600);
    ctx.fillText(H.ellipsisText(ctx, word, maxW), cx, cy);
  } else {
    ctx.font = H.serifFont(14, 600);
    ctx.fillText(H.ellipsisText(ctx, word, maxW), cx, cy);
  }
}

/* ── 虚线槽位：「明天 / 后天」——旅程未完的版面语言 ── */
function drawEmptySlot(ctx, x, y, label) {
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = P.gray300;
  H.roundRect(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.stroke();
  ctx.restore();
  if (label) {
    ctx.fillStyle = P.ink3;
    ctx.font = H.serifFont(13, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
  }
}

/* ════════════════ 照片版：双拍立得 + 词行 ════════════════ */

function drawPhotoCollage(ctx, data, imgs) {
  const [m, s] = imgs;
  if (m) H.drawPolaroid(ctx, m, 36, 184, 224, 168, { rotate: -2, caption: data.photos[0].date });
  if (s) H.drawPolaroid(ctx, s, 168, 248, 152, 114, { rotate: 2.5 });
}

function drawWordLine(ctx, data, baselineY) {
  const words = data.cards.map((c) => c.word).slice(0, 7);
  const text = '本周的词：' + words.join('、');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.serifFont(14, 400);
  ctx.fillText(H.ellipsisText(ctx, text, CW), M, baselineY);
}

/* ════════════════ 下半区（两版共用） ════════════════ */

/* ── 邮戳带：7 枚迷你钢戳（盖=实线 / 未盖=虚线） ── */
function drawStampBand(ctx, data, y) {
  const slots = data.stamps.slice(0, 7);
  const SW = 38, SH = 14, SG = 5;           // 7×38 + 6×5 = 296
  const total = slots.length * SW + (slots.length - 1) * SG;
  let x = M + (CW - total) / 2;
  slots.forEach((s) => {
    H.drawStamp(ctx, x, y, { text: s.text, w: SW, h: SH, size: 9, empty: !s.stamped, rotate: -4 });
    x += SW + SG;
  });
}

/* ── 数据行：混排（数字 15 bold / 文字 13） ── */
function drawStatsLine(ctx, data, y) {
  const { drawn, stamped, streak } = data.stats;
  const runs = [
    { text: '本周 ', size: 13, color: P.ink2 },
    { text: String(drawn), size: 15, weight: 700, color: P.ink },
    { text: ' 签 · 盖邮戳 ', size: 13, color: P.ink2 },
    { text: String(stamped), size: 15, weight: 700, color: P.ink },
  ];
  if (streak >= 2) {
    runs.push({ text: ' · 连续第 ', size: 13, color: P.ink2 });
    runs.push({ text: String(streak), size: 15, weight: 700, color: P.brand });
    runs.push({ text: ' 周', size: 13, color: P.ink2 });
  }
  H.drawRuns(ctx, W / 2, y, runs, { align: 'center', baseline: 'middle' });
}

/* ── 引用：全宽 2 行（QR 在 552 以下，无需避让） ── */
function drawQuote(ctx, data, topY) {
  if (!data.quote) return;
  ctx.fillStyle = P.gray700;
  ctx.font = H.serifFont(14, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, `「${data.quote}」`, CW, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, M, topY + i * 22));
  ctx.textBaseline = 'alphabetic';
}

/* ── 页脚：虚线分隔 + QR（右）+ CTA/slogan（左） ── */
function drawFooter(ctx, data, qrImg) {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;                        // 规则①
  ctx.beginPath();
  ctx.moveTo(M, 528);
  ctx.lineTo(W - M, 528);
  ctx.stroke();
  ctx.restore();

  // 右：QR 60×60 + 8px 白衬圈（朋友圈回流主入口，规则③）
  H.drawQR(ctx, qrImg, 276, 552, 60, { pad: 8 });

  // 左：CTA + slogan，与 QR（552–612）垂直方向对齐
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.brandDeep;              // orange-600
  ctx.font = H.sansFont(15, 700);
  ctx.fillText('扫码，抽你的一签', M, 572);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan || '缺席不损失，卡不会过期', M, 600);
  H.setLetterSpacing(ctx, 0);
  ctx.textBaseline = 'alphabetic';
}

module.exports = {
  drawWeekly916,
  buildWeeklyData,                          // 透传，调用方从任一模块引入均可
  SIZE: { W, H: HGT },
};
