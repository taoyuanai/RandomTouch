/* ══════════════════════════════════════════════════════════
   posterKit/templates/weekly34.js
   周记海报 · 小红书 3:4 母版
   导出 1242×1656（栅格 414×552 × scale 3）
   版式甲「卡面版」：本周带图回信 < 2 张
   版式乙「照片版」：本周带图回信 ≥ 2 张
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');

const W = 414, HGT = 552, M = 24, CW = W - M * 2;   // 内容宽 366
const CARD_W = 84, CARD_H = 112, GAP = 10, R = 8;

/* ──────────────── 日期工具 ──────────────── */
const p2 = (n) => String(n).padStart(2, '0');
const fmtMD  = (ts) => { const d = new Date(ts); return `${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; };
const fmtYMD = (ts) => { const d = new Date(ts); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; };

/** ISO 周键（周一为一周起点），用于连续周数计算 */
function isoWeekKey(ts) {
  const d = new Date(ts);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);      // 本周四
  const f = new Date(t.getFullYear(), 0, 4);
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);      // 当年首个周四
  const week = 1 + Math.round((t - f) / 604800000);
  return `${t.getFullYear()}-W${week}`;
}

/* ──────────────── 域模型工具（与页面 getRec 同义的最小副本） ──────────────── */
function getRecLocal(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return null;
  const r = u.recs[idx];
  return Array.isArray(r) ? r[r.length - 1] : r;
}

/* ──────────────── 标题文案池（规格 1.6） ──────────────── */
function pickWeeklyTitle(stamped) {
  if (stamped >= 7) return Math.random() < 0.5 ? '整整一周，每天都有回信' : '第七天，邮戳盖满了';
  if (stamped >= 5) return `这一周，${stamped} 天留下了痕迹`;
  if (stamped >= 3) return `本周的 ${stamped} 个瞬间`;
  if (stamped >= 1) return `这周，至少有 ${stamped} 天不一样`;
  return '先抽为敬，下周补上邮戳';
}

/* ════════════════ 数据装配 ════════════════ */

/**
 * 从域模型装配周记数据。
 * 依赖 user.drawnLog（见接入说明：openEnvelope 内新增一行）。
 * @param {Object} set  卡集（含 user）
 * @param {Object} opts { now, qrSrc }
 * @returns {Object|null} 无记录时返回 null
 */
function buildWeeklyData(set, opts = {}) {
  const u = set.user || {};
  const log = (u.drawnLog || []).slice(-7);
  if (!log.length) return null;

  const entries = log.map((e) => {
    const card = (set.pool || [])[e.idx] || {};
    const rec = getRecLocal(u, e.idx);
    return {
      idx: e.idx, ts: e.ts,
      dateShort: fmtMD(e.ts),
      word: card.w || '·',
      sig: e.idx === set.signatureIdx,
      stamped: !!rec,
      rec,
    };
  });

  const stampedN = entries.filter((e) => e.stamped).length;

  // 引用：优先有笔记的，取最长
  const withNote = entries.filter((e) => e.rec && (e.rec.note || '').trim());
  const quoteRec = withNote.sort((a, b) => b.rec.note.length - a.rec.note.length)[0] || null;

  // 照片：带图回信取 2 张（笔记最长优先，同长取新）
  const withImg = entries.filter((e) => e.rec && e.rec.img);
  withImg.sort((a, b) => {
    const la = (a.rec.note || '').length, lb = (b.rec.note || '').length;
    return lb - la || b.ts - a.ts;
  });
  const photos = withImg.slice(0, 2).map((e) => ({
    src: e.rec.img, date: fmtMD(e.ts), note: e.rec.note || '',
  }));

  // 连续周数：从本周往回数，每周至少 1 枚邮戳
  const weekMap = {};
  (u.drawnLog || []).forEach((e) => {
    if (getRecLocal(u, e.idx)) weekMap[isoWeekKey(e.ts)] = true;
  });
  let streak = 0;
  let cursor = new Date(opts.now || Date.now());
  while (weekMap[isoWeekKey(cursor.getTime())]) {
    streak++;
    cursor = new Date(cursor.getTime() - 7 * 86400000);
  }

  return {
    setId: set.id,
    title: set.title,
    weekNo: Math.max(1, Math.ceil((u.drawnLog || []).length / 7)),
    dateRangeText: `${fmtYMD(entries[0].ts)} — ${fmtMD(entries[entries.length - 1].ts)}`,
    layout: photos.length >= 2 ? 'photo' : 'card',
    cards: entries.map((e) => ({ word: e.word, sig: e.sig })),
    stamps: entries.map((e) => ({ text: e.dateShort, stamped: e.stamped })),
    stats: { drawn: entries.length, stamped: stampedN, streak },
    quote: quoteRec ? quoteRec.rec.note.trim() : '',
    photos,
    slogan: '缺席不损失，卡不会过期',
    titleText: pickWeeklyTitle(stampedN),
    qrSrc: opts.qrSrc || '',
  };
}

/** 演示用：无 drawnLog 时按 got 顺序伪造最近 n 天记录（配合原型控制台） */
function synthesizeLog(set, n = 7) {
  const u = set.user || (set.user = {});
  const got = u.got || [];
  const take = got.slice(-n);
  const now = Date.now();
  u.drawnLog = take.map((idx, i) => {
    const d = new Date(now - (take.length - 1 - i) * 86400000);
    return {
      idx,
      ts: d.getTime(),
      // 页面侧周记预览仍使用 MM-DD，这里一并补上
      date: `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
    };
  });
  return u.drawnLog;
}

/* ════════════════ 模板绘制 ════════════════ */

async function drawWeekly34(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;

  // 0. 预载图片（失败降级，不阻塞整体）
  const safeLoad = (src) => loadImage(src).catch((e) => { console.warn('[weekly34]', e.message); return null; });
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
    drawWordLine(ctx, data, 390);
    drawStampBand(ctx, data, 402);
    drawStatsLine(ctx, data, 436);
    drawQuote(ctx, data, 458);
  } else {
    drawCardWall(ctx, data);
    drawStampBand(ctx, data, 424);
    drawStatsLine(ctx, data, 458);
    drawQuote(ctx, data, 482);
  }

  // 4. 页脚
  drawFooter(ctx, data, qrImg);
}

/* ── 顶栏：品牌 + 日期区间 + hairline ── */
function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(13, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 40);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.dateRangeText, W - M, 40);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 58.5);
  ctx.lineTo(W - M, 58.5);
  ctx.stroke();
}

/* ── 眉题：《集名》 · 第 N 周 ── */
function drawEyebrow(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = P.brand;
  ctx.font = H.sansFont(11, 500);
  H.setLetterSpacing(ctx, 2);
  ctx.fillText(`《${data.title}》 · 第 ${data.weekNo} 周`, M, 82);
  H.setLetterSpacing(ctx, 0);
}

/* ── 标题：衬线 28px/36，最多 2 行 ── */
function drawTitle(ctx, data) {
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(28, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, data.titleText, CW, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, M, 94 + i * 36));
  ctx.textBaseline = 'alphabetic';
}

/* ── 卡面版：4+3 卡墙 ── */
function drawCard(ctx, card, x, y) {
  ctx.fillStyle = P.paperWarm;
  H.roundRect(ctx, x, y, CARD_W, CARD_H, R);
  ctx.fill();
  ctx.strokeStyle = P.orange100;
  ctx.lineWidth = 1;
  H.roundRect(ctx, x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1, R);
  ctx.stroke();
  if (card.sig) {
    ctx.save();                                // 题眼金色顶条
    H.roundRect(ctx, x, y, CARD_W, CARD_H, R);
    ctx.clip();
    ctx.fillStyle = P.gold.deep;
    ctx.fillRect(x, y, CARD_W, 4);
    ctx.restore();
  }
  drawCardWord(ctx, card.word, x + CARD_W / 2, y + CARD_H / 2 + 4);
}

function drawCardWord(ctx, word, cx, cy) {
  const n = (word || '').length;
  ctx.fillStyle = P.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (n >= 6) {                                 // 长词拆两行，避免挤成一条
    const split = Math.ceil(n / 2);
    const l1 = word.slice(0, split), l2 = word.slice(split);
    ctx.font = H.serifFont(12, 600);
    ctx.fillText(H.ellipsisText(ctx, l1, CARD_W - 10), cx, cy - 8);
    if (l2) ctx.fillText(H.ellipsisText(ctx, l2, CARD_W - 10), cx, cy + 8);
  } else {
    ctx.font = H.serifFont(15, 600);
    ctx.fillText(H.ellipsisText(ctx, word, CARD_W - 10), cx, cy);
  }
}

function drawCardWall(ctx, data) {
  const cards = data.cards.slice(0, 7);
  const y1 = 174, y2 = y1 + CARD_H + GAP;
  cards.slice(0, 4).forEach((c, i) => drawCard(ctx, c, M + i * (CARD_W + GAP), y1));
  const row2 = cards.slice(4, 7);               // 第二行居中
  const x0 = M + (CW - (row2.length * CARD_W + (row2.length - 1) * GAP)) / 2;
  row2.forEach((c, i) => drawCard(ctx, c, x0 + i * (CARD_W + GAP), y2));
}

/* ── 照片版：双拍立得拼贴 + 词行 ── */
function drawPhotoCollage(ctx, data, imgs) {
  const [m, s] = imgs;
  if (m) H.drawPolaroid(ctx, m, 57, 174, 200, 150, { rotate: -2, caption: data.photos[0].date });
  if (s) H.drawPolaroid(ctx, s, 210, 250, 140, 105, { rotate: 2.5 });
}

function drawWordLine(ctx, data, baselineY) {
  const words = data.cards.map((c) => c.word).slice(0, 7);
  const text = '本周的词：' + words.join('、');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.serifFont(13, 400);
  ctx.fillText(H.ellipsisText(ctx, text, CW), M, baselineY);
}

/* ── 邮戳带：7 枚迷你钢戳（盖=实线 / 未盖=虚线） ── */
function drawStampBand(ctx, data, y) {
  const slots = data.stamps.slice(0, 7);
  const SW = 44, SH = 16, SG = 8;
  const total = slots.length * SW + (slots.length - 1) * SG;
  let x = M + (CW - total) / 2;
  slots.forEach((s) => {
    H.drawStamp(ctx, x, y, { text: s.text, w: SW, h: SH, size: 9, empty: !s.stamped, rotate: -4 });
    x += SW + SG;
  });
}

/* ── 数据行：混排（数字 14 bold / 文字 12） ── */
function drawStatsLine(ctx, data, y) {
  const { drawn, stamped, streak } = data.stats;
  const runs = [
    { text: '抽了 ', size: 12, color: P.ink2 },
    { text: String(drawn), size: 14, weight: 700, color: P.ink },
    { text: ' 张 · 盖邮戳 ', size: 12, color: P.ink2 },
    { text: String(stamped), size: 14, weight: 700, color: P.ink },
  ];
  if (streak >= 2) {
    runs.push({ text: ' · 连续第 ', size: 12, color: P.ink2 });
    runs.push({ text: String(streak), size: 14, weight: 700, color: P.brand });
    runs.push({ text: ' 周', size: 12, color: P.ink2 });
  }
  H.drawRuns(ctx, W / 2, y, runs, { align: 'center', baseline: 'middle' });
}

/* ── 引用：本周最好的一条回信笔记（右侧给 QR 让位 64px） ── */
function drawQuote(ctx, data, topY) {
  if (!data.quote) return;
  ctx.fillStyle = P.gray700;
  ctx.font = H.serifFont(13, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = H.clampLines(ctx, `「${data.quote}」`, CW - 64, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, M, topY + i * 20));
  ctx.textBaseline = 'alphabetic';
}

/* ── 页脚：虚线分隔 + slogan + QR ── */
function drawFooter(ctx, data, qrImg) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 530);
  ctx.lineTo(W - M, 530);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan || '缺席不损失，卡不会过期', M, 542);
  H.setLetterSpacing(ctx, 0);
  // qrImg 为空时 drawQR 内部会画占位框，保证版面不塌
  H.drawQR(ctx, qrImg, W - M - 48, 494, 48);
}

module.exports = {
  buildWeeklyData,
  synthesizeLog,
  pickWeeklyTitle,
  drawWeekly34,
  SIZE: { W, H: HGT },
};
