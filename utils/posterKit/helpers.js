/* ══════════════════════════════════════════════════════════
   posterKit/helpers.js
   海报 Canvas 2D 绘制工具集（微信小程序 · 基础库 ≥ 2.16.1）
   ─────────────────────────────────────────────
   约定：
   · 所有绘制在「设计栅格」坐标系进行（调用方先 ctx.scale(3)）
   · ellipsisText / clampLines 调用前必须先设置 ctx.font
   ══════════════════════════════════════════════════════════ */
const P = require('./colors.js');

/* ──────────────── 字体 ──────────────── */
const SERIF = `'PosterSerif','Songti SC','Noto Serif SC',serif`;
const SANS  = `'PingFang SC','HarmonyOS Sans SC','Noto Sans SC',sans-serif`;
const MONO  = `'Courier New',Courier,monospace`;

const serifFont = (size, weight = 400) => `${weight} ${size}px ${SERIF}`;
const sansFont  = (size, weight = 400) => `${weight} ${size}px ${SANS}`;
const monoFont  = (size, weight = 700) => `${weight} ${size}px ${MONO}`;

let FONT_URL = '';
let fontReady = null;

/** 配置衬线字体子集（woff2，https）。未配置则整体回退系统衬线 */
function setPosterFontSource(url) { FONT_URL = url; fontReady = null; }

/** 字体就绪 Promise（失败静默回退，不阻塞海报生成） */
function ensureFonts() {
  if (!fontReady) {
    fontReady = new Promise((resolve) => {
      if (!FONT_URL) { console.warn('[posterKit] 未配置衬线字体，回退系统字体'); return resolve(); }
      wx.loadFontFace({
        family: 'PosterSerif',
        source: `url("${FONT_URL}")`,
        global: true,
        success: resolve,
        fail: (e) => { console.warn('[posterKit] 字体加载失败，回退', e); resolve(); },
      });
    });
  }
  return fontReady;
}

/** letterSpacing 逐字间距（不支持的环境静默跳过） */
function setLetterSpacing(ctx, px) {
  try { if ('letterSpacing' in ctx) ctx.letterSpacing = (px || 0) + 'px'; } catch (e) { /* noop */ }
}

/* ──────────────── 文本 ──────────────── */

/** 单行截断（带 …）。调用前先设 ctx.font */
function ellipsisText(ctx, text, maxWidth) {
  let t = String(text == null ? '' : text);
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

/** 中文逐字换行（支持 \n），不限制行数 */
function wrapText(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (cur && ctx.measureText(cur + ch).width > maxWidth) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** 换行 + 限行数，超出部分末行截断加 … */
function clampLines(ctx, text, maxWidth, maxLines) {
  const all = wrapText(ctx, text, maxWidth);
  if (all.length <= maxLines) return all;
  const lines = all.slice(0, maxLines);
  lines[maxLines - 1] = ellipsisText(ctx, lines[maxLines - 1], maxWidth);
  return lines;
}

/* ──────────────── 混排 runs（一行内多种字号/字重/颜色） ──────────────── */
/* runs: [{ text, size=12, weight=400, color, family:'sans'|'serif'|'mono' }] */

function _fontOf(r) {
  const fam = r.family === 'serif' ? SERIF : r.family === 'mono' ? MONO : SANS;
  return `${r.weight || 400} ${r.size || 12}px ${fam}`;
}

function measureRuns(ctx, runs) {
  let w = 0;
  for (const r of runs) { ctx.font = _fontOf(r); w += ctx.measureText(r.text).width; }
  return w;
}

function drawRuns(ctx, x, y, runs, opts = {}) {
  const { align = 'left', baseline = 'middle' } = opts;
  if (align === 'center') x -= measureRuns(ctx, runs) / 2;
  else if (align === 'right') x -= measureRuns(ctx, runs);
  const pa = ctx.textAlign, pb = ctx.textBaseline;
  ctx.textAlign = 'left'; ctx.textBaseline = baseline;
  for (const r of runs) {
    ctx.font = _fontOf(r);
    ctx.fillStyle = r.color || P.ink;
    ctx.fillText(r.text, x, y);
    x += ctx.measureText(r.text).width;
  }
  ctx.textAlign = pa; ctx.textBaseline = pb;
}

/* ──────────────── 形状 ──────────────── */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/* ──────────────── 图片 ──────────────── */

/** object-fit: cover 裁剪绘制（9 参 drawImage，居中裁剪） */
function coverDraw(ctx, img, x, y, w, h) {
  if (!img) return;
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * 图片加载器（含缓存）。
 * https 源先经 wx.getImageInfo 落本地（云存储域名需加入 downloadFile 白名单），
 * 返回 canvas Image。失败抛错，由调用方决定降级。
 */
function makeImageLoader(canvas) {
  const cache = new Map();
  const toLocal = (src) => new Promise((resolve, reject) => {
    if (!/^https?:/i.test(src)) return resolve(src);
    wx.getImageInfo({
      src,
      success: (r) => resolve(r.path),
      fail: (e) => reject(new Error('[posterKit] getImageInfo 失败: ' + src)),
    });
  });
  return function loadImage(src) {
    if (cache.has(src)) return cache.get(src);
    const p = (async () => {
      const local = await toLocal(src);
      return await new Promise((resolve, reject) => {
        const img = canvas.createImage();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('[posterKit] 图片加载失败: ' + src));
        img.src = local;
      });
    })();
    p.catch(() => cache.delete(src));   // 失败后允许重试
    cache.set(src, p);
    return p;
  };
}

/* ──────────────── 品牌组件 ──────────────── */

/**
 * 钢制日期印戳（品牌符号）
 * opts: { text, w=64, h=24, rotate=-4, size=10.5, empty=false }
 * empty = 未盖章槽位：灰虚线框
 */
function drawStamp(ctx, x, y, opts = {}) {
  const {
    text = '', w = 64, h = 24, rotate = -4,
    size = 10.5, empty = false, ink = P.stampInk,
  } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate * Math.PI / 180);

  if (empty) {
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = P.gray300;
    ctx.strokeRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;                       // 外框
  ctx.strokeRect(0, 0, w, h);
  ctx.lineWidth = 1;                       // 内框（3px 间隙 + 1px 线）
  ctx.strokeRect(3, 3, w - 6, h - 6);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 自适应收缩：日期超宽时降号，避免溢出内框（如 2026.11.17）
  let fs = size;
  ctx.font = monoFont(fs, 700);
  while (fs > 6 && ctx.measureText(text).width > w - 10) {
    fs -= 0.5;
    ctx.font = monoFont(fs, 700);
  }
  setLetterSpacing(ctx, 0.5);
  const tx = w / 2, ty = h / 2 + 0.5;
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.35;                  // 手盖重影
  ctx.fillText(text, tx + 0.7, ty + 0.5);
  ctx.globalAlpha = 0.9;                   // 主压印
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

/** 稀有度顶条（rarity: N/R/SR/SSR） */
function drawRarityBar(ctx, x, y, w, h, rarity) {
  ctx.fillStyle = P.rar[rarity] || P.rar.N;
  roundRectTop(ctx, x, y, w, h, Math.min(h, 4));
  ctx.fill();
}

/**
 * 拍立得相框
 * opts: { rotate=0, caption='', border=8, bottom=20 }
 * 总尺寸 w×h，照片区 = (w-2b) × (h-b-bottom)
 */
function drawPolaroid(ctx, img, x, y, w, h, opts = {}) {
  const { rotate = 0, caption = '', border = 8, bottom = 20 } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate * Math.PI / 180);
  ctx.shadowColor = 'rgba(176,128,74,0.14)';  // 纸的暖投影
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(176,128,74,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  coverDraw(ctx, img, border, border, w - border * 2, h - border - bottom);
  if (caption) {                           // 下白条手写日期
    ctx.fillStyle = P.ink2;
    ctx.font = serifFont(12, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, w / 2, h - bottom / 2);
  }
  ctx.restore();
}

/** 二维码（白色衬圈 + 圆角底）。无图时渲染占位框，保证版面不塌 */
function drawQR(ctx, img, x, y, size, opts = {}) {
  const pad = opts.pad != null ? opts.pad : 6;
  if (!img) {
    ctx.fillStyle = P.gray50;
    roundRect(ctx, x, y, size, size, 6);
    ctx.fill();
    ctx.fillStyle = P.ink3;
    ctx.font = sansFont(9, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR', x + size / 2, y + size / 2);
    return;
  }
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x - pad, y - pad, size + pad * 2, size + pad * 2, 8);
  ctx.fill();
  ctx.drawImage(img, x, y, size, size);
}

/** 视口尺寸（px） */
function getViewport() {
  try {
    const si = wx.getSystemInfoSync();
    return { w: si.windowWidth, h: si.windowHeight };
  } catch (e) { return { w: 375, h: 667 }; }
}

module.exports = {
  P,
  serifFont, sansFont, monoFont,
  setPosterFontSource, ensureFonts, setLetterSpacing,
  ellipsisText, wrapText, clampLines,
  measureRuns, drawRuns,
  roundRect, roundRectTop, coverDraw,
  drawStamp, drawRarityBar, drawPolaroid, drawQR,
  makeImageLoader,
  getViewport,
};
