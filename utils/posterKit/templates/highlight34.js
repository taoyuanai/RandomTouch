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
  drawTopStamp(ctx, data, W, M, false);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 56.5);
  ctx.lineTo(W - M, 56.5);
  ctx.stroke();
}

/* 唯一日期：黑色墨印戳，放在顶栏右侧与品牌同高 */
function drawTopStamp(ctx, data, w, m, paperBack, top) {
  const text = data.stampText || stampDate(data.date);
  if (!text) return;
  const x = w - m - 58;
  const y = top != null ? top : 25;
  if (paperBack) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = P.paper;
    H.roundRect(ctx, x - 4, y - 3, 66, 24, 3);
    ctx.fill();
    ctx.restore();
  }
  H.drawStamp(ctx, x, y, { text, w: 58, h: 18, size: 8, rotate: -4 });
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

/* ════════════════ 照片优先版式 ════════════════
 * 3:4：照片全幅（3:4），底部信息层覆盖在照片上
 * 9:16：照片占上方 3:4，信息层在下
 * 保留第一张记录页的视觉层级：照片是主角，文字只做注释。
 */
function drawPhotoPoster(ctx, data, img, qrImg, opts = {}) {
  const w = opts.W || W;
  const h = opts.H || HGT;
  const panelH = opts.panelH || 158;
  const mediaH = opts.mediaH || h;
  const overlay = opts.overlay !== false;
  const m = opts.M || M;
  const panelY = h - panelH;

  if (img) {
    H.coverDraw(ctx, img, 0, 0, w, mediaH);
  } else {
    ctx.fillStyle = P.gray100;
    ctx.fillRect(0, 0, w, mediaH);
  }

  /* 顶部压暗，保证品牌/日期在浅色照片上可读 */
  const top = ctx.createLinearGradient(0, 0, 0, 112);
  top.addColorStop(0, 'rgba(0,0,0,0.38)');
  top.addColorStop(0.58, 'rgba(0,0,0,0.16)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, 112);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = H.sansFont(12, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦ 今日做点小事', m, 38);
  ctx.restore();
  drawTopStamp(ctx, data, w, m, true);

  if (data.sig) {
    ctx.font = H.sansFont(9, 600);
    const tw = ctx.measureText('题眼').width;
    const pw = tw + 14, ph = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    H.roundRect(ctx, m, 54, pw, ph, 9);
    ctx.fill();
    ctx.strokeStyle = P.gold.deep;
    ctx.lineWidth = 1;
    H.roundRect(ctx, m + 0.5, 54.5, pw - 1, ph - 1, 8.5);
    ctx.stroke();
    ctx.fillStyle = P.gold.deep;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('题眼', m + pw / 2, 54 + ph / 2 + 0.5);
  }

  /* 信息层：3:4 覆盖照片底部；9:16 在照片下方 */
  ctx.save();
  if (overlay) {
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = -4;
  }
  ctx.fillStyle = P.paper;
  H.roundRectTop(ctx, 0, panelY, w, panelH, 18);
  ctx.fill();
  ctx.restore();

  const pad = m;
  const note = (data.rec && data.rec.note) || data.text || '';
  const noteMaxW = w - pad * 2 - 64;
  ctx.fillStyle = P.ink;
  ctx.font = H.sansFont(15, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, note, noteMaxW, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, pad, panelY + 24 + i * 22));

  const tail = data.collect ? ` · 已点亮 ${data.gotN}/${data.count}` : '';
  const src = `@${data.creator || ''} · 来自《${data.setTitle || ''}》${tail}`;
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(H.ellipsisText(ctx, src, w - pad * 2 - 46), pad, panelY + 92);

  /* 信息层右下：二维码；日期只保留顶部墨印戳 */
  H.drawQR(ctx, qrImg, w - pad - 42, panelY + panelH - 54, 42, { pad: 6 });

  ctx.fillStyle = P.brandDeep;
  ctx.font = H.sansFont(13, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('扫码，抽你的一签', pad, panelY + panelH - 24);
}

/* ════════════════ 主入口 ════════════════ */
async function drawHighlight34(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[highlight34]', e.message); return null; });

  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const photoImg = data.rec && data.rec.img && loadImage
    ? await safeLoad(data.rec.img) : null;

  if (photoImg) {
    drawPhotoPoster(ctx, data, photoImg, qrImg, {
      W, H: HGT, M, panelH: 158, mediaH: HGT, overlay: true,
    });
    return;
  }
  drawBg(ctx, false);
  drawHeader(ctx, data);
  drawCard(ctx, data, null, { x: 67, y: 84, w: 280, h: 392, topH: 210 });
  drawFooter(ctx, data, qrImg);
}

module.exports = {
  buildHighlightData,
  drawHighlight34,
  drawCard,
  drawPhotoPoster,
  drawTopStamp,
  SIZE: { W, H: HGT },
};
