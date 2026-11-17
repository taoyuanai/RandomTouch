/* ══════════════════════════════════════════════════════════
   posterKit/templates/memorial916.js
   集齐纪念海报 · 朋友圈 9:16 母版
   导出 1080×1920（栅格 360×640 × scale 3）
   ─────────────────────────────────────────────
   朋友圈硬规则沿用：笔画≥2px / 正文≥12px / QR 60+8 白衬圈
   时间轴改纵向（竖版 = 叙事从上到下，每节点日期+caption 并排）
   ─────────────────────────────────────────────
   垂直栅格：
   顶条    0–4     金色渐变
   顶栏    基线52   品牌 15 / 日期区间 12；hairline 2px @66
   眉题    基线92   全部点亮 · 完整图鉴（12 brand ls2 居中）
   标题    基线132  集齐啦（衬线 34 bold）+ 副题 基线160（16 serif）
   统计    194–242  三格（中心 76/180/284，2px 分隔 x128/x232）
                    数字 32 bold 基线218 / 标签 12 基线240
   时间轴  282–432  纵向：轨 x96（gold.light 3px，y282–414）
                    节点 r5 描边 3px（末节点实心）
                    日期 11px 基线 y-4 / caption 13px 基线 y+18
                    （末节点 14 bold 金深）；文字左起 x116
   引言    444–520  有 SSR：「word」衬线 24 金渐变 基线468
                      + 解签 13/21 × 2 行（top 486）
                    无 SSR：集齐钢戳 72×24 居中 y458 + 一行 基线508
   底部    虚线 2px @536 / QR 60 @（276,548）+8 白衬圈
                    CTA 15 bold @570 / slogan 12 @598
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');
const { buildMemorialData } = require('./memorial34.js');   // 数据装配复用

const W = 360, HGT = 640, M = 24;

/* ════════════════ 主入口 ════════════════ */

async function drawMemorial916(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const qrImg = data.qrSrc && loadImage
    ? await loadImage(data.qrSrc).catch((e) => { console.warn('[memorial916]', e.message); return null; })
    : null;

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, HGT);

  drawTopStrip(ctx);
  drawHeader(ctx, data);
  drawEyebrow(ctx, data);
  drawTitle(ctx, data);
  drawStats(ctx, data);
  drawTimelineV(ctx, data);
  drawQuote(ctx, data);
  drawBottom(ctx, data, qrImg);
}

function drawTopStrip(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, P.gold.light);
  g.addColorStop(1, P.gold.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 4);
}

function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(15, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 52);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.dateRange, W - M, 52);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;                          // 规则①：hairline 2px
  ctx.beginPath();
  ctx.moveTo(M, 66);
  ctx.lineTo(W - M, 66);
  ctx.stroke();
}

function drawEyebrow(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.brand;
  ctx.font = H.sansFont(12, 500);
  ctx.textAlign = 'center';
  H.setLetterSpacing(ctx, 2);
  ctx.fillText(data.eyebrow, W / 2, 92);
  H.setLetterSpacing(ctx, 0);
}

function drawTitle(ctx, data) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(34, 700);
  ctx.fillText(data.title, W / 2, 132);
  ctx.fillStyle = P.ink2;
  ctx.font = H.serifFont(16, 400);
  ctx.fillText(`《${H.ellipsisText(ctx, data.setTitle, W - M * 2 - 60)}》`, W / 2, 160);
}

function drawStats(ctx, data) {
  const cols = [76, 180, 284];
  const items = [
    { n: data.stats.cards, l: '张' },
    { n: data.stats.days, l: '天' },
    { n: data.stats.third, l: data.stats.thirdLabel,
      gold: data.stats.thirdLabel === 'SSR' && data.stats.third > 0 },
  ];
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;                          // 规则①
  [128, 232].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 194);
    ctx.lineTo(x, 242);
    ctx.stroke();
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  items.forEach((it, i) => {
    const cx = cols[i];
    ctx.font = H.sansFont(32, 700);
    if (it.gold) {
      const g = ctx.createLinearGradient(0, 192, 0, 220);
      g.addColorStop(0, P.gold.light);
      g.addColorStop(0.55, P.gold.mid);
      g.addColorStop(1, P.gold.deep);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = P.ink;
    }
    ctx.fillText(String(it.n), cx, 218);
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(12, 400);
    H.setLetterSpacing(ctx, 2);
    ctx.fillText(it.l, cx, 240);
    H.setLetterSpacing(ctx, 0);
  });
}

/* ── 纵向时间轴（2–3 节点自适应） ── */
function drawTimelineV(ctx, data) {
  const tl = data.timeline;
  if (!tl || tl.length < 2) return;
  const x = 96, y0 = 282, y1 = 414;
  ctx.strokeStyle = P.gold.light;
  ctx.lineWidth = 3;                          // 规格：轴线 3px，压缩后立得住
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  const n = tl.length;
  tl.forEach((nd, i) => {
    const y = y0 + (i / (n - 1)) * (y1 - y0);
    const isLast = i === n - 1;
    ctx.beginPath();                          // 节点 r5 + 描边 3px（规格）
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = isLast ? P.gold.mid : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isLast ? P.gold.deep : P.gold.mid;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(11, 400);
    ctx.fillText(nd.date, x + 20, y - 4);
    if (isLast) {
      ctx.fillStyle = P.gold.deep;
      ctx.font = H.sansFont(14, 700);
    } else {
      ctx.fillStyle = P.ink;
      ctx.font = H.sansFont(13, 400);
    }
    ctx.fillText(H.ellipsisText(ctx, nd.caption, 220), x + 20, y + 18);
  });
}

function drawQuote(ctx, data) {
  ctx.textAlign = 'center';
  if (data.ssrQuote) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = H.serifFont(24, 700);
    const g = ctx.createLinearGradient(0, 444, 0, 474);
    g.addColorStop(0, P.gold.light);
    g.addColorStop(0.55, P.gold.mid);
    g.addColorStop(1, P.gold.deep);
    ctx.fillStyle = g;
    ctx.fillText(`「${H.ellipsisText(ctx, data.ssrQuote.word, 240)}」`, W / 2, 468);
    ctx.fillStyle = P.ink2;
    ctx.font = H.serifFont(13, 400);
    ctx.textBaseline = 'top';
    const lines = H.clampLines(ctx, data.ssrQuote.text, W - M * 2 - 32, 2);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 486 + i * 21));
    ctx.textBaseline = 'alphabetic';
  } else {
    H.drawStamp(ctx, W / 2 - 36, 458,
      { text: data.stampDate, w: 72, h: 24, size: 10.5, rotate: -4 });
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(12, 400);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`盖了 ${data.stats.stamped} 枚邮戳 · 每一枚都是这一程的回信`, W / 2, 508);
  }
}

function drawBottom(ctx, data, qrImg) {
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;                          // 规则①
  ctx.beginPath();
  ctx.moveTo(M, 536);
  ctx.lineTo(W - M, 536);
  ctx.stroke();
  ctx.restore();

  H.drawQR(ctx, qrImg, 276, 548, 60, { pad: 8 });   // 规则③

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = P.brandDeep;
  ctx.font = H.sansFont(15, 700);
  ctx.fillText('扫码，抽你的一签', M, 570);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan, M, 598);
  H.setLetterSpacing(ctx, 0);
  ctx.textBaseline = 'alphabetic';
}

module.exports = {
  drawMemorial916,
  buildMemorialData,                          // 透传
  SIZE: { W, H: HGT },
};
