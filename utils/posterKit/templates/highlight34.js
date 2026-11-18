/* ══════════════════════════════════════════════════════════
   posterKit/templates/highlight34.js
   抽卡明信片海报 · 小红书 3:4 母版
   导出 1242×1656（栅格 414×552 × scale 3）
   ─────────────────────────────────────────────
   版式甲「经典版」（无回信照片）：
     顶条4 → 顶栏40/hairline56 → 稀有度大字 → 内容盒
     → 来自 → 点位行(封面签+setInfo) → 回信条(rec无图) → 页脚498
   版式乙「照片版」（回信照片铺底 cover + 上下白纱）：
     顶栏浮于白纱 → 白色主卡148..360（no/稀有度/词/解签）
     → 回信句+钢戳 → 来自两行 → 页脚498
   buildHighlightData 为唯一数据装配源：
   页面 buildHighlight 已委托至此（WXML 预览与 Canvas 导出同源）。
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');

const W = 414, HGT = 552, M = 24, CW = W - M * 2;      // 内容宽 366


/* ──────────────── 日期工具（与页面同义的最小副本） ──────────────── */
const p2 = (n) => String(n).padStart(2, '0');
const fmtMD = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };
/** "11月8日" → "2026.11.08"（钢戳用） */
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

/**
 * @param {Object} set 卡集（含 user）
 * @param {Object} card 池内卡对象 { w, b, r }
 * @param {Object} opts { idx, no, slogan, now, qrSrc }
 *   idx 缺省时按 pool.indexOf(card) 推导；demo 伪造集传 no 即可
 * @returns 输出为 WXML 预览字段的超集，两边共用
 */
function buildHighlightData(set, card, opts = {}) {
  if (!card || !set) return null;
  const pool = set.pool || [];
  const idx = opts.idx != null ? opts.idx : pool.indexOf(card);
  const rec = idx >= 0 ? getRecLocal(set.user, idx) : null;
  const gotN = (set.user && set.user.got) ? set.user.got.length : 0;
  const collect = set.type === 'collect';
  const count = set.count || pool.length;
  return {
    kind: 'highlight',
    sig: idx >= 0 && idx === set.signatureIdx,
    signatureNote: (set.signatureNote || '').trim(),
    date: fmtMD(opts.now || Date.now()),
    no: opts.no || (idx >= 0 ? `No.${p2(idx + 1)} / ${pool.length}` : ''),
    word: card.w || '',
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

/* ════════════════ 主入口 ════════════════ */

async function drawHighlight34(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const safeLoad = (src) => loadImage(src)
    .catch((e) => { console.warn('[highlight34]', e.message); return null; });

  const qrImg = data.qrSrc && loadImage ? await safeLoad(data.qrSrc) : null;
  const hasPhoto = !!(data.rec && data.rec.img);
  const photoImg = hasPhoto && loadImage ? await safeLoad(data.rec.img) : null;

  if (hasPhoto && photoImg) {
    drawPhotoLayout(ctx, data, photoImg, qrImg);
  } else {
    // 照片加载失败 → 按无图回信降级到经典版（内容不丢，仅换构图）
    const d2 = hasPhoto ? Object.assign({}, data, { rec: Object.assign({}, data.rec, { img: '' }) }) : data;
    drawClassicLayout(ctx, d2, qrImg);
  }
}

/* ════════════════ 版式甲：经典版 ════════════════ */

function drawClassicLayout(ctx, data, qrImg) {
  const hasRec = !!data.rec;
  const boxY = hasRec ? 104 : 112;
  const boxH = hasRec ? 186 : 208;

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, HGT);

  drawTopStrip(ctx, data);
  drawHeader(ctx, data, true);
  if (data.sig) {
    H.drawStamp(ctx, W - M - 58, 16,
      { text: '题眼', w: 58, h: 20, size: 10, rotate: -4, ink: P.gold.deep });
  }
  drawContentBox(ctx, data, boxY, boxH, hasRec ? 2 : 3);

  // 来自
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`来自《${H.ellipsisText(ctx, data.setTitle, CW - 60)}》`, W / 2, boxY + boxH + 26);

  // 点位行（封面签 + setInfo，整组居中）
  drawSetInfoRow(ctx, data, boxY + boxH + 42);

  // 回信条（有 rec 且无图）
  if (hasRec && !data.rec.img) {
    drawRecStrip(ctx, data, boxY + boxH + 42 + 44, boxY + boxH + 42 + 56);
  }

  drawFooter(ctx, data, qrImg, 498);
}

/* ── 稀有度顶条 4px（与站内 poster-card 顶条同构） ── */
function drawTopStrip(ctx, data) {
  if (!data.sig) return;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, P.gold.light);
  g.addColorStop(1, P.gold.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 4);
}

/* ── 顶栏：品牌 + 日期（hairline 可选） ── */
function drawHeader(ctx, data, withLine) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(13, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 40);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.date, W - M, 40);
  if (withLine) {
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M, 56.5);
    ctx.lineTo(W - M, 56.5);
    ctx.stroke();
  }
}

/* ── 内容盒：no / 词 / 解签 ── */
function drawContentBox(ctx, data, y, h, textLines) {
  ctx.fillStyle = P.gray100;
  H.roundRect(ctx, M, y, CW, h, 14);
  ctx.fill();
  const cx = W / 2;
  ctx.textAlign = 'center';

  ctx.fillStyle = P.ink3;                       // no
  ctx.font = H.sansFont(11, 400);
  H.setLetterSpacing(ctx, 1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.no, cx, y + 24);
  H.setLetterSpacing(ctx, 0);

  const wl = (data.word || '').length;          // 词（衬线）
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(wl >= 7 ? 21 : 24, 700);
  ctx.fillText(H.ellipsisText(ctx, data.word, CW - 40), cx, y + 64);

  ctx.fillStyle = P.ink2;                       // 解签
  ctx.font = H.serifFont(14, 400);
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, data.text, CW - 48, textLines);
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y + 88 + i * 22));
  ctx.textBaseline = 'alphabetic';
}

/* ── 点位行：封面小签 + setInfo，整组居中 ── */
function drawSetInfoRow(ctx, data, topY) {
  const chipW = 26, chipH = 34, gap = 10;
  ctx.font = H.sansFont(11, 400);
  const textW = ctx.measureText(data.setInfo).width;
  const total = chipW + gap + textW;
  let x = (W - total) / 2;

  ctx.fillStyle = P.gray100;                    // 封面签
  H.roundRect(ctx, x, topY, chipW, chipH, 4);
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  H.roundRect(ctx, x + 0.5, topY + 0.5, chipW - 1, chipH - 1, 4);
  ctx.stroke();
  ctx.fillStyle = P.ink2;
  ctx.font = H.serifFont(12, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.setCover, x + chipW / 2, topY + chipH / 2 + 1);

  ctx.fillStyle = P.ink3;                       // setInfo
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'left';
  ctx.fillText(data.setInfo, x + chipW + gap, topY + chipH / 2);
  ctx.textBaseline = 'alphabetic';
}

/* ── 回信条：标签 + 虚线暖底条 + 笔记 + 钢戳压角 ── */
function drawRecStrip(ctx, data, labelBaseline, boxY) {
  ctx.fillStyle = P.ink3;                       // · 回 信 ·
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'center';
  H.setLetterSpacing(ctx, 4);
  ctx.fillText('· 回 信 ·', W / 2, labelBaseline);
  H.setLetterSpacing(ctx, 0);

  const boxH = 76;                              // 暖底渐变 + 虚线框
  const g = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, P.paperWarm);
  ctx.fillStyle = g;
  H.roundRect(ctx, M, boxY, CW, boxH, 10);
  ctx.fill();
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = P.orange100;
  ctx.lineWidth = 1.5;
  H.roundRect(ctx, M + 0.75, boxY + 0.75, CW - 1.5, boxH - 1.5, 10);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = P.ink;                        // 笔记（衬线，2 行）
  ctx.font = H.serifFont(15, 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const note = data.rec.note || '这一天，做过了';
  const lines = H.clampLines(ctx, `「${note}」`, CW - 120, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, boxY + 18 + i * 24));
  ctx.textBaseline = 'alphabetic';

  H.drawStamp(ctx, M + CW - 62, boxY - 10,      // 钢戳压条右上角
    { text: data.rec.stampDate, w: 62, h: 20, size: 8.5, rotate: -4 });
}

/* ── 页脚 ── */
function drawFooter(ctx, data, qrImg, dividerY) {
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, dividerY);
  ctx.lineTo(W - M, dividerY);
  ctx.stroke();
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan, M, dividerY + 26);
  H.setLetterSpacing(ctx, 0);
  H.drawQR(ctx, qrImg, W - M - 46, dividerY + 2, 46);
  ctx.textBaseline = 'alphabetic';
}

/* ════════════════ 版式乙：照片版 ════════════════ */

function drawPhotoLayout(ctx, data, img, qrImg) {
  H.coverDraw(ctx, img, 0, 0, W, HGT);          // 照片铺底

  let g = ctx.createLinearGradient(0, 0, 0, 72); // 顶部白纱（承托顶栏）
  g.addColorStop(0, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 72);

  g = ctx.createLinearGradient(0, 410, 0, HGT);  // 底部白纱（承托出处/页脚）
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.92)');
  g.addColorStop(1, 'rgba(255,255,255,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 410, W, HGT - 410);

  drawHeader(ctx, data, false);
  drawHeroCard(ctx, data);
  drawPhotoNoteRow(ctx, data);
  drawPhotoSource(ctx, data);
  drawFooter(ctx, data, qrImg, 498);
}

/* ── 白色主卡：no / 稀有度 / 词 / 解签 ── */
function drawHeroCard(ctx, data) {
  const x = 32, y = 148, w = 350, h = 212;
  ctx.save();
  ctx.shadowColor = 'rgba(176,128,74,0.12)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  H.roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  H.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
  ctx.stroke();

  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = P.ink3;                       // no
  ctx.font = H.sansFont(11, 400);
  H.setLetterSpacing(ctx, 1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.no, cx, y + 26);
  H.setLetterSpacing(ctx, 0);

  if (data.sig) {
    H.drawStamp(ctx, x + w - 72, y + 12,
      { text: '题眼', w: 58, h: 20, size: 10, rotate: -4, ink: P.gold.deep });
  }

  const wl = (data.word || '').length;          // 词
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(wl >= 7 ? 22 : 26, 700);
  ctx.fillText(H.ellipsisText(ctx, data.word, w - 60), cx, y + 72);

  ctx.fillStyle = P.ink2;                       // 解签
  ctx.font = H.serifFont(13, 400);
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, data.text, w - 72, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y + 100 + i * 20));
  ctx.textBaseline = 'alphabetic';
}

/* ── 回信句 + 钢戳（浮于渐变上，右侧固定钢戳位） ── */
function drawPhotoNoteRow(ctx, data) {
  if (data.rec && data.rec.note) {
    ctx.fillStyle = P.ink;
    ctx.font = H.serifFont(15, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // 右侧给钢戳留位，避免长句压到印戳
    ctx.fillText(H.ellipsisText(ctx, `「${data.rec.note}」`, CW - 140), W / 2, 396);
  }
  if (data.rec) {
    H.drawStamp(ctx, W - M - 62, 382,
      { text: data.rec.stampDate, w: 62, h: 20, size: 8.5, rotate: -4 });
  }
}

/* ── 出处两行（合并 setInfo 信息） ── */
function drawPhotoSource(ctx, data) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(12, 400);
  ctx.fillText(`来自《${H.ellipsisText(ctx, data.setTitle, CW - 80)}》 · @${data.creator}`, W / 2, 446);
  if (data.collect) {
    ctx.font = H.sansFont(11, 400);
    ctx.fillText(`已点亮 ${data.gotN}/${data.count}`, W / 2, 466);
  }
}

module.exports = {
  buildHighlightData,
  drawHighlight34,
  SIZE: { W, H: HGT },
};
