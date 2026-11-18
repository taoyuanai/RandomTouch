/* ══════════════════════════════════════════════════════════
   posterKit/templates/memorial34.js
   集齐纪念海报 · 小红书 3:4 母版
   导出 1242×1656（栅格 414×552 × scale 3）
   ─────────────────────────────────────────────
   垂直栅格：
   顶条    0–4     金色渐变（集齐 = 金色时刻，与抽卡海报稀有度顶条区分）
   顶栏    基线40   品牌 / 日期区间；hairline 56.5
   眉题    基线80   全部点亮 · 完整图鉴（brand 11 ls2 居中）
   标题    基线126  集齐啦（衬线 36 bold 居中）
   副题    基线152  《集名》（衬线 15 ink2）
   统计    182–232  三格（中心 69/207/345，hairline 分隔 x138/x276）：
                    数字 32 bold 基线210 / 标签 11 ls2 基线230；
                    第三格 = SSR 数（金渐变），无 SSR 集自动换「邮戳 N」
   时间轴  264–316  横向：轴线 y288（gold.light 1.5px，x76–338）
                    节点 r4（白底 2px 金描边，末节点实心金）
                    日期轴上 10px 基线275 / caption 轴下基线312
                    （末节点 12 bold 金深，其余 11 ink2）
   引言    356–442  有题眼：「word」衬线 22 金渐变 基线378
                      + 解签 13/20 × 2 行（top 398）
                    无题眼：集齐钢戳 72×24 居中 y386
                      + 「盖了 N 枚邮戳…」基线442
   页脚    分隔498 / slogan 10 / QR 46（同 highlight 页脚）
   ══════════════════════════════════════════════════════════ */
const P = require('../colors.js');
const H = require('../helpers.js');

const W = 414, HGT = 552, M = 24, CW = W - M * 2;

/* ──────────────── 日期工具 ──────────────── */
const p2 = (n) => String(n).padStart(2, '0');
const fmtMD  = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const fmtYMD = (ts) => { const d = new Date(ts); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; };

function getRecLocal(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return null;
  const r = u.recs[idx];
  return Array.isArray(r) ? r[r.length - 1] : r;
}

/* ════════════════ 数据装配（唯一真相源） ════════════════ */

/**
 * @param {Object} set 卡集（含 user）
 * @param {Object} opts { now, slogan, qrSrc }
 * 时间轴来源：user.drawnLog（与 got 同序同长）；
 * 老数据无 log 时按「一天一张」回填估算，保证不破版。
 */
function buildMemorialData(set, opts = {}) {
  if (!set) return null;
  const u = set.user || {};
  const pool = set.pool || [];
  const got = (u.got || []).slice();
  const count = set.count || pool.length;
  const now = opts.now || Date.now();

  const log = u.drawnLog || [];
  let tsList = [];
  if (got.length) {
    if (log.length >= got.length) tsList = log.slice(0, got.length).map((e) => e.ts);
    else tsList = got.map((_, i) => now - (got.length - 1 - i) * 86400000);
  }
  const firstTs = tsList.length ? tsList[0] : now;
  const lastTs = tsList.length ? tsList[tsList.length - 1] : now;
  const days = Math.max(1, Math.round((lastTs - firstTs) / 86400000) + 1);

  /* 题眼引言（就是做卡人最想送的那句话） */
  const sigIdx = set.signatureIdx != null ? set.signatureIdx : -1;
  const sigQuote = sigIdx >= 0 && pool[sigIdx] ? {
    word: pool[sigIdx].w || '',
    text: pool[sigIdx].b || '',
    note: (set.signatureNote || '').trim(),
  } : null;
  const sigLit = sigIdx >= 0 && got.includes(sigIdx);

  /* 中点节点：题眼（不在首尾时），否则半程「第 N 张」 */
  let midPos = -1, midCaption = '';
  if (got.length > 2) {
    const p = got.indexOf(sigIdx);
    if (sigIdx >= 0 && p > 0 && p < got.length - 1) {
      midPos = p;
      midCaption = `抽到「${pool[sigIdx].w}」`;
    } else {
      const h = Math.floor(got.length / 2);
      if (h > 0 && h < got.length - 1) { midPos = h; midCaption = `第 ${h + 1} 张`; }
    }
  }

  const stamped = got.filter((i) => getRecLocal(u, i)).length;

  const timeline = [];
  if (tsList.length >= 2) {
    timeline.push({ i: 0, date: fmtMD(tsList[0]), caption: '开始' });
    if (midPos > 0) timeline.push({ i: timeline.length, date: fmtMD(tsList[midPos]), caption: midCaption });
    timeline.push({ i: timeline.length, date: fmtMD(tsList[tsList.length - 1]), caption: '集齐' });
  } else {
    timeline.push(
      { i: 0, date: fmtMD(now), caption: '开始' },
      { i: 1, date: fmtMD(now), caption: '集齐' }
    );
  }

  return {
    kind: 'memorial',
    title: '集齐啦',
    eyebrow: '全部点亮 · 完整图鉴',
    setTitle: set.title || '',
    creator: set.creator || '',
    setCover: (set.covT || set.title || '·').slice(0, 1),
    dateRange: `${fmtYMD(firstTs)} — ${fmtYMD(lastTs)}`,
    stampDate: fmtYMD(lastTs),
    stats: {
      cards: count,
      days,
      stamped,
      thirdLabel: sigIdx >= 0 ? '题眼' : '邮戳',
      third: sigIdx >= 0 ? (sigLit ? 1 : 0) : stamped,
    },
    timeline,
    sigQuote,
    slogan: opts.slogan || '缺席不损失，卡不会过期',
    qrSrc: opts.qrSrc || '',
  };
}

/* ════════════════ 主入口 ════════════════ */

async function drawMemorial34(ctx, data, kit = {}) {
  const loadImage = kit.loadImage;
  const qrImg = data.qrSrc && loadImage
    ? await loadImage(data.qrSrc).catch((e) => { console.warn('[memorial34]', e.message); return null; })
    : null;

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, W, HGT);

  drawTopStrip(ctx);
  drawHeader(ctx, data);
  drawEyebrow(ctx, data);
  drawTitle(ctx, data);
  drawStats(ctx, data);
  drawTimelineH(ctx, data);
  drawQuote(ctx, data);
  drawFooter(ctx, data, qrImg);
}

/* ── 金色顶条 ── */
function drawTopStrip(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, P.gold.light);
  g.addColorStop(1, P.gold.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 4);
}

/* ── 顶栏 ── */
function drawHeader(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink2;
  ctx.font = H.sansFont(13, 600);
  ctx.textAlign = 'left';
  ctx.fillText('✦ 今日做点小事', M, 40);
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(11, 400);
  ctx.textAlign = 'right';
  ctx.fillText(data.dateRange, W - M, 40);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 56.5);
  ctx.lineTo(W - M, 56.5);
  ctx.stroke();
}

/* ── 眉题 ── */
function drawEyebrow(ctx, data) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.brand;
  ctx.font = H.sansFont(11, 500);
  ctx.textAlign = 'center';
  H.setLetterSpacing(ctx, 2);
  ctx.fillText(data.eyebrow, W / 2, 80);
  H.setLetterSpacing(ctx, 0);
}

/* ── 标题 + 副题 ── */
function drawTitle(ctx, data) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.ink;
  ctx.font = H.serifFont(36, 700);
  ctx.fillText(data.title, W / 2, 126);
  ctx.fillStyle = P.ink2;
  ctx.font = H.serifFont(15, 400);
  ctx.fillText(`《${H.ellipsisText(ctx, data.setTitle, CW - 80)}》`, W / 2, 152);
}

/* ── 三格统计 ── */
function drawStats(ctx, data) {
  const cols = [W / 6, W / 2, (W * 5) / 6];
  const items = [
    { n: data.stats.cards, l: '张' },
    { n: data.stats.days, l: '天' },
    { n: data.stats.third, l: data.stats.thirdLabel,
      gold: data.stats.thirdLabel === '题眼' && data.stats.third > 0 },
  ];
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  [138, 276].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 182);
    ctx.lineTo(x, 230);
    ctx.stroke();
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  items.forEach((it, i) => {
    const cx = cols[i];
    ctx.font = H.sansFont(32, 700);
    if (it.gold) {
      const g = ctx.createLinearGradient(0, 184, 0, 212);
      g.addColorStop(0, P.gold.light);
      g.addColorStop(0.55, P.gold.mid);
      g.addColorStop(1, P.gold.deep);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = P.ink;
    }
    ctx.fillText(String(it.n), cx, 210);
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(11, 400);
    H.setLetterSpacing(ctx, 2);
    ctx.fillText(it.l, cx, 230);
    H.setLetterSpacing(ctx, 0);
  });
}

/* ── 横向时间轴（2–3 节点自适应） ── */
function drawTimelineH(ctx, data) {
  const tl = data.timeline;
  if (!tl || tl.length < 2) return;
  const y = 288, x0 = 76, x1 = W - 76;
  ctx.strokeStyle = P.gold.light;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const n = tl.length;
  tl.forEach((nd, i) => {
    const x = x0 + (i / (n - 1)) * (x1 - x0);
    const isLast = i === n - 1;
    ctx.beginPath();                          // 节点：白底金描边，末节点实心
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = isLast ? P.gold.mid : '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isLast ? P.gold.deep : P.gold.mid;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = P.ink3;                   // 日期（轴上）
    ctx.font = H.sansFont(10, 400);
    ctx.fillText(nd.date, x, y - 13);
    if (isLast) {                             // caption（轴下，末节点强调）
      ctx.fillStyle = P.gold.deep;
      ctx.font = H.sansFont(12, 700);
    } else {
      ctx.fillStyle = P.ink2;
      ctx.font = H.sansFont(11, 400);
    }
    ctx.fillText(H.ellipsisText(ctx, nd.caption, 96), x, y + 24);
  });
}

/* ── 引言区：SSR 词+解签 / 集齐钢戳 ── */
function drawQuote(ctx, data) {
  ctx.textAlign = 'center';
  if (data.sigQuote) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = H.serifFont(22, 700);
    const g = ctx.createLinearGradient(0, 356, 0, 384);
    g.addColorStop(0, P.gold.light);
    g.addColorStop(0.55, P.gold.mid);
    g.addColorStop(1, P.gold.deep);
    ctx.fillStyle = g;
    ctx.fillText(`「${H.ellipsisText(ctx, data.sigQuote.word, CW - 120)}」`, W / 2, 378);
    ctx.fillStyle = P.ink2;
    ctx.font = H.serifFont(13, 400);
    ctx.textBaseline = 'top';
    const lines = H.clampLines(ctx, data.sigQuote.text, CW - 80, 2);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 398 + i * 20));
    ctx.textBaseline = 'alphabetic';
  } else {
    /* 无题眼的集：盖下集齐钢戳作为情绪落点 */
    H.drawStamp(ctx, W / 2 - 36, 386,
      { text: data.stampDate, w: 72, h: 24, size: 10.5, rotate: -4 });
    ctx.fillStyle = P.ink3;
    ctx.font = H.sansFont(12, 400);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`盖了 ${data.stats.stamped} 枚邮戳 · 每一枚都是这一程的回信`, W / 2, 442);
  }
}

/* ── 页脚（与 highlight 同构） ── */
function drawFooter(ctx, data, qrImg) {
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, 498);
  ctx.lineTo(W - M, 498);
  ctx.stroke();
  ctx.fillStyle = P.ink3;
  ctx.font = H.sansFont(10, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  H.setLetterSpacing(ctx, 1);
  ctx.fillText(data.slogan, M, 520);
  H.setLetterSpacing(ctx, 0);
  H.drawQR(ctx, qrImg, W - M - 46, 500, 46);
  ctx.textBaseline = 'alphabetic';
}

module.exports = {
  buildMemorialData,
  drawMemorial34,
  SIZE: { W, H: HGT },
};
