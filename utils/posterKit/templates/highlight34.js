/* ══════════════════════════════════════════════════════════
   posterKit/templates/highlight34.js
   抽卡分享海报 · 3:4（1242×1656）
   V6：海报框 + 中央分享卡
   · 有照片：卡上半为照片，下半为解签 / 回信
   · 无照片：卡上半为词（居中），下半为解签
   buildHighlightData 仍是预览与导出唯一数据源。
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');

const W = 414, HGT = 552, M = 24, CW = W - M * 2;

/* ──────────────── 日期工具 ──────────────── */
const p2 = (n) => String(n).padStart(2, '0');
const fmtMD = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };
function stampDate(d) {
  const m = d && String(d).match(/(\d+)月(\d+)日/);
  if (!m) return d || '';
  return `${new Date().getFullYear()}.${p2(m[1])}.${p2(m[2])}`;
}
function getRecLocal(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return null;
  const r = u.recs[idx];
  return Array.isArray(r) ? r[r.length - 1] : r;
}

/* ════════════════ 数据装配（唯一真相源） ════════════════ */
function buildHighlightData(set, card, opts = {}) {
  if (!card || !set) return null;
  const pool = set.pool || [];
  const idx = opts.idx != null ? opts.idx : pool.indexOf(card);
  const rec = idx >= 0 ? getRecLocal(set.user, idx) : null;
  const gotN = (set.user && set.user.got) ? set.user.got.length : 0;
  const collect = set.type === 'collect';
  const count = set.count || pool.length;
  const date = fmtMD(opts.now || Date.now());
  const recStamp = rec ? (stampDate(rec.date) || date) : '';
  return {
    kind: 'highlight',
    sig: idx >= 0 && idx === set.signatureIdx,
    signatureNote: (set.signatureNote || '').trim(),
    date,
    stampText: rec ? recStamp : stampDate(date),
    no: opts.no || (idx >= 0 ? `No.${p2(idx + 1)} / ${pool.length}` : ''),
    word: card.w || '',
    wordCls: (() => {
      const n = (card.w || '').length;
      return n <= 4 ? 'kw-1' : (n === 5 ? 'kw-2' : (n === 6 ? 'kw-3' : (n <= 10 ? 'kw-4' : 'kw-5')));
    })(),
    text: card.b || '',
    setTitle: set.title || '',
    setCover: (set.covT || set.title || '·').slice(0, 1),
    creator: set.creator || '',
    count,
    collect,
    gotN,
    setInfo: `@${set.creator || ''} · ${count} 张卡${collect ? ` · 已点亮 ${gotN}/${count}` : ''}`,
    slogan: opts.slogan || '万物皆可抽一签',
    rec: rec ? {
      img: rec.img || '', imgFileID: rec.imgFileID || '', note: rec.note || '',
      date: rec.date || '', stampDate: stampDate(rec.date), sec: rec.sec || null,
    } : null,
    qrSrc: opts.qrSrc || '',
  };
}

/* ════════════════ 背景 / 顶栏 ════════════════ */
function drawBg(ctx, hasPhoto) {
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, HGT);
  const g = ctx.createLinearGradient(0, 0, 0, HGT);
  g.addColorStop(0, hasPhoto ? P.gray50 : P.paperWarm);
  g.addColorStop(0.62, P.paper);
  g.addColorStop(1, P.paper);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HGT);
  if (!hasPhoto) {
    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.fillStyle = P.orange100;
    ctx.beginPath();
    ctx.arc(W - 8, 18, 176, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(13, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 40);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.date, W - M, 40);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 56.5);
  ctx.lineTo(W - M, 56.5);
  ctx.stroke();
}

/* ════════════════ 中央分享卡 ════════════════ */
function drawCard(ctx, data, img, box) {
  const x = box.x, y = box.y, w = box.w, h = box.h;
  const topH = box.topH || Math.round(h * 0.54);
  const r = 18, pad = 16;

  /* 卡体阴影 */
  ctx.save();
  ctx.shadowColor = 'rgba(32,33,36,0.14)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = P.paper;
  H.roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  /* 上半视觉区 */
  ctx.save();
  H.roundRectTop(ctx, x, y, w, topH + 1, r);
  ctx.clip();
  if (img) {
    H.coverDraw(ctx, img, x, y, w, topH);
    const shade = ctx.createLinearGradient(0, y + topH * 0.55, 0, y + topH);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, topH);
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + topH);
    g.addColorStop(0, P.gray50);
    g.addColorStop(1, P.paper);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, topH);
    drawWord(ctx, data.word, x + w / 2, y + topH / 2, w - 32);
  }
  ctx.restore();

  /* 分隔线 */
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + topH + 0.5);
  ctx.lineTo(x + w, y + topH + 0.5);
  ctx.stroke();

  /* 题眼 */
  if (data.sig) {
    ctx.font = H.sansFont(9, 600);
    const tw = ctx.measureText('题眼').width;
    const pw = tw + 14, ph = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    H.roundRect(ctx, x + 12, y + 12, pw, ph, 9);
    ctx.fill();
    ctx.strokeStyle = P.gold.deep;
    ctx.lineWidth = 1;
    H.roundRect(ctx, x + 12.5, y + 12.5, pw - 1, ph - 1, 8.5);
    ctx.stroke();
    ctx.fillStyle = P.gold.deep;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('题眼', x + 12 + pw / 2, y + 12 + ph / 2 + 0.5);
  }

  /* 下半解签 */
  const bodyY = y + topH + pad;
  const bodyW = w - pad * 2;
  const bodyText = data.text || (data.rec && data.rec.note) || '';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(14, 400);
  const lines = H.clampLines(ctx, bodyText, bodyW, 3);
  lines.forEach((ln, i) => ctx.fillText(ln, x + pad, bodyY + i * 22));

  let noteY = bodyY + lines.length * 22 + 8;
  if (data.rec && data.rec.note && bodyText !== data.rec.note) {
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(12, 400);
    const nl = H.clampLines(ctx, `「${data.rec.note}」`, bodyW, 2);
    nl.forEach((ln, i) => ctx.fillText(ln, x + pad, noteY + i * 18));
    noteY += nl.length * 18;
  }

  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`@${data.creator}`, x + pad, y + h - 14);
  if (data.no) {
    ctx.textAlign = 'right';
    ctx.fillText(data.no, x + w - pad, y + h - 14);
  }

  /* 卡片描边 */
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  H.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();

  /* 日期钢戳：压在卡右上角 */
  const st = data.stampText || ((data.rec && data.rec.stampDate) ? data.rec.stampDate : stampDate(data.date));
  if (st) {
    H.drawStamp(ctx, x + w - 64, y - 8,
      { text: st, w: 64, h: 20, size: 8.5, rotate: -4 });
  }
}

function drawWord(ctx, word, cx, cy, maxW) {
  const n = (word || '').length;
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (n >= 7) {
    const split = Math.ceil(n / 2);
    ctx.font = H.sansFont(26, 700);
    ctx.fillText(H.ellipsisText(ctx, word.slice(0, split), maxW), cx, cy - 18);
    ctx.fillText(H.ellipsisText(ctx, word.slice(split), maxW), cx, cy + 18);
  } else {
    ctx.font = H.sansFont(n <= 4 ? 40 : (n === 5 ? 34 : 30), 700);
    ctx.fillText(H.ellipsisText(ctx, word, maxW), cx, cy + 1);
  }
  ctx.textBaseline = 'alphabetic';
}

/* ════════════════ 页脚 ════════════════ */
function drawFooter(ctx, data, qrImg) {
  const dy = 492;
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, dy);
  ctx.lineTo(W - M, dy);
  ctx.stroke();

  const tail = data.collect ? ` · 已点亮 ${data.gotN}/${data.count}` : '';
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const src = `来自《${data.setTitle}》${tail}`;
  ctx.fillText(H.ellipsisText(ctx, src, W - M * 2 - 56), M, 510);

  ctx.fillStyle = P.brandDeep;
  ctx.font = H.sansFont(14, 700);
  ctx.fillText('扫码，抽你的一签', M, 534);

  H.drawQR(ctx, qrImg, W - M - 42, 502, 42, { pad: 6 });
}

/* ════════════════ 主入口 ════════════════ */
async function drawHighlight34(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[highlight34]', e.message); return null; });

  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const photoImg = data.rec && data.rec.img && loadImage
    ? await safeLoad(data.rec.img) : null;

  drawBg(ctx, !!photoImg);
  drawHeader(ctx, data);
  drawCard(ctx, data, photoImg, { x: 67, y: 84, w: 280, h: 392, topH: 210 });
  drawFooter(ctx, data, qrImg);
}

module.exports = {
  buildHighlightData,
  drawHighlight34,
  drawCard,
  SIZE: { W, H: HGT },
};
