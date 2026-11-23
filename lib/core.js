// 今日做点小事 · 微信小程序版
// 移植自远程仓库 static/day_small_things_v2.html（V2.3c 原型）
const craftStore = require('./craftStore.js');
const posterKit = require('../utils/posterKit/export.js');
const api = require('../services/api.js');

function getViewport() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return { w: info.windowWidth, h: info.windowHeight };
  } catch (e) { return { w: 375, h: 667 }; }
}

const BRAND = '今日做点小事';
const ME = '打工人小王';
const TABS = ['home', 'cards', 'create', 'me'];

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function bwCls(w) {
  const n = (w || '').length;
  return n >= 7 ? 'bw-7' : (n >= 6 ? 'bw-6' : '');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayDot() {
  const n = new Date();
  return `${n.getFullYear()}.${pad2(n.getMonth() + 1)}.${pad2(n.getDate())}`;
}

// "11月8日" → "2026.11.08"
function stampDate(d) {
  const m = d && String(d).match(/(\d+)月(\d+)日/);
  if (!m) return d || '';
  const y = new Date().getFullYear();
  return `${y}.${pad2(m[1])}.${pad2(m[2])}`;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

/* 统计卡上的紧凑数字：36 / 1,204 / 1.2万 */
function fmtShort(n) {
  const v = Number(n || 0);
  if (v >= 10000) {
    const w = v / 10000;
    return (w >= 10 ? Math.round(w) : w.toFixed(1).replace(/\.0$/, '')) + '万';
  }
  return v.toLocaleString('en-US');
}

// 周记标题池：按本周盖章数自动选择，第一人称、克制
function weeklyTitle(stampN, weekNo) {
  if (stampN >= 7) return weekNo % 2 ? '整整一周，每天都有回信' : '第七天，邮戳盖满了';
  if (stampN >= 5) return `这一周，${stampN} 天留下了痕迹`;
  if (stampN >= 3) return `本周的 ${stampN} 个瞬间`;
  if (stampN >= 1) return `这周，至少有 ${stampN} 天不一样`;
  return '先抽为敬，下周补上邮戳';
}

// ISO 周键（周一为一周起点），与 posterKit/templates/weekly34.js 保持同算法
function isoWeekKey(ts) {
  const d = new Date(ts);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
  const f = new Date(t.getFullYear(), 0, 4);
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((t - f) / 604800000);
  return `${t.getFullYear()}-W${week}`;
}

function cardDone(c) {
  return !!(c && (c.w || '').trim() && (c.b || '').trim());
}

function setVM(s) {
  const u = s.user;
  const own = s.creator === ME;
  const paid = s.price > 0 && !own;
  if (u && s.type === 'collect' && u.drawn >= s.count) {
    return {
      key: 'empty', dot: 'red', text: `已抽空 · ${s.count} 张全收集`,
      btnS: '看抽空纪念', btnL: '看抽空纪念', act: 'memorial', off: false,
    };
  }
  if (u && paid && !u.unlocked && (u.trialUsed || 0) >= s.trial) {
    return {
      key: 'locked', dot: 'red', text: `试抽 ${s.trial} 张已用完 · 待解锁`,
      btnS: `解锁 ¥${s.price}`, btnL: `解锁 ¥${s.price}`, act: 'paywall', off: false,
    };
  }
  if (!u) {
    if (own) {
      return {
        key: 'own_new', dot: 'red',
        text: s.heat > 0 ? `你的卡集 · ${s.count} 张` : '刚上架 · 你的卡集',
        btnS: '去抽', btnL: '抽一张试试', act: 'draw', off: false,
      };
    }
    if (paid) {
      return {
        key: 'new_paid', dot: 'red', text: `¥${s.price} · 前 ${s.trial} 张免费试抽`,
        btnS: `试抽 ${s.trial} 张`, btnL: '免费试抽 · 第 1 张', act: 'draw', off: false,
      };
    }
    return {
      key: 'new_free', dot: 'red',
      text: s.heat > 0 ? `免费 · ${fmt(s.heat)} 人抽过` : '刚上架 · 免费抽',
      btnS: '去抽', btnL: '今天的卡 · 去抽', act: 'draw', off: false,
    };
  }
  if (u.todayDrawn) {
    const ridx = todayIdxOf(s);
    if (ridx != null && !getRec(s.user, ridx)) {
      return {
        key: 'record', dot: 'faint',
        text: s.type === 'resident' ? '今日已抽 · 等你回信' : `已抽 ${u.drawn}/${s.count} · 等你回信`,
        btnS: '盖个邮戳', btnL: '盖个邮戳 · 记录今天', act: 'record', off: false, ridx,
      };
    }
    if (s.type === 'resident') {
      return { key: 'done', dot: 'faint', text: '今日已抽 · 明天再来', btnS: '今日已抽', btnL: '今日已抽', act: 'none', off: true };
    }
    if (paid && !u.unlocked) {
      return { key: 'done', dot: 'faint', text: `试抽 ${u.trialUsed}/${s.trial} · 今日已抽`, btnS: '今日已抽', btnL: '今日已抽', act: 'none', off: true };
    }
    return { key: 'done', dot: 'faint', text: `已抽 ${u.drawn}/${s.count} · 今日已抽`, btnS: '今日已抽', btnL: '今日已抽', act: 'none', off: true };
  }
  if (paid && !u.unlocked) {
    return {
      key: 'trial_go', dot: 'red', text: `试抽 ${u.trialUsed || 0}/${s.trial} · 今日可抽`,
      btnS: '去抽今天的', btnL: `继续试抽 · 剩 ${s.trial - (u.trialUsed || 0)} 张`, act: 'draw', off: false,
    };
  }
  if (s.type === 'resident') {
    return { key: 'go', dot: 'red', text: '今日可抽 · 抽到就是答案', btnS: '去抽今天的', btnL: '今天的签 · 去抽', act: 'draw', off: false };
  }
  return { key: 'go', dot: 'red', text: `已抽 ${u.drawn}/${s.count} · 今日可抽`, btnS: '去抽今天的', btnL: '今天的卡 · 去抽', act: 'draw', off: false };
}


function finishDate(s) {
  const u = s.user;
  const r = s.count - u.drawn;
  const d = new Date();
  d.setDate(d.getDate() + (u.todayDrawn ? r : r - 1));
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function getRec(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return null;
  const r = u.recs[idx];
  return Array.isArray(r) ? r[r.length - 1] : r;
}

function recCount(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return 0;
  const r = u.recs[idx];
  return Array.isArray(r) ? r.length : 1;
}

function todayIdxOf(s) {
  const u = s.user;
  if (!u || !u.todayDrawn) return null;
  if (u.todayIdx != null) return u.todayIdx;
  return (s.type === 'collect')
    ? ((u.got && u.got.length) ? u.got[u.got.length - 1] : 0)
    : 0;
}

function hasRecPending(s) {
  const ridx = todayIdxOf(s);
  return ridx != null && !getRec(s.user, ridx);
}

function stampedCount(s) {
  const u = s.user;
  if (!u || !u.recs) return 0;
  if (s.type !== 'collect') return Object.keys(u.recs).length;
  const got = u.got || [];
  return Object.keys(u.recs).filter(k => got.includes(Number(k))).length;
}

/* ═══ 留存体系 · 日期地基（一律按北京时间 UTC+8 计算"天"） ═══ */
const BK_OFFSET_MS = 8 * 3600000;

function _bkDate(ts) {
  return new Date((ts == null ? Date.now() : ts) + BK_OFFSET_MS);
}

/* 时间戳 → 北京日期键 'YYYY-MM-DD'，字符串可直接比较先后 */
function dateKeyOf(ts) {
  const d = _bkDate(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function todayKey() {
  return dateKeyOf(Date.now());
}

/* 本周周一（北京时间）的日期键 */
function weekMondayKey(ts) {
  const d = _bkDate(ts == null ? Date.now() : ts);
  const dow = (d.getUTCDay() + 6) % 7; // 周一=0 … 周日=6
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* 日期键加 n 天（在 UTC 刻度内运算，避免时区误差） */
function _keyPlus(key, n) {
  const t = Date.parse(key + 'T00:00:00Z') + n * 86400000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* 本周抽卡进度：以全局活动流水 S.activity 为准，按"天"去重
   返回 { done, total:7, left, full, today } —— 阶段 2 周目标卡用 */
function weekProgress(S) {
  const tk = todayKey();
  const mk = weekMondayKey();
  const days = new Set();
  (S.activity || []).forEach(a => {
    if (!a || !a.ts) return;
    const k = dateKeyOf(a.ts);
    if (k >= mk && k <= tk) days.add(k);
  });
  const done = days.size;
  return { done, total: 7, left: Math.max(0, 7 - done), full: done >= 7, today: days.has(tk) };
}

/* 距上次抽卡缺席了几天（新用户返回 null）—— 阶段 4 久别召回用 */
function daysAbsent(S) {
  const acts = (S && S.activity) || [];
  if (!acts.length) return null;
  const last = acts.reduce((m, a) => Math.max(m, a.ts || 0), 0);
  if (!last) return null;
  const dayMs = 86400000;
  const a = Date.parse(todayKey() + 'T00:00:00Z');
  const b = Date.parse(dateKeyOf(last) + 'T00:00:00Z');
  return Math.max(0, Math.round((a - b) / dayMs));
}

/* ═══ 订阅消息 · 模板与时段（上线前替换为微信公众平台申请的真实模板 ID） ═══ */
// 过审后填入真实「每日新签提醒」模板 ID；未填时所有入口走兜底 toast。
const TMPL_IDS = [];

const REMIND_TIMES = [
  { key: '08:00', label: '早上 8:00',  sub: '开工前，抽一张定调子' },
  { key: '12:30', label: '中午 12:30', sub: '午休时，喘口气' },
  { key: '21:00', label: '晚上 21:00', sub: '睡前，给今天收个尾' },
  { key: '22:00', label: '晚上 22:00', sub: '夜猫子，留一盏灯' },
];

/* ═══ 首页 v2.2 · 整页滚动 + 我的订阅前置 + 分类体系 ═══
   字体策略：新文案走系统字体（未进宋体子集也不方框）；
   serif 只用于品牌/集名/封面字；mono 只用于纯数字。 */


/* ═══ V1 · 印刷墨色（6 墨 × 10 分类）═══ */
const INKS = {
  sumi:   '#2B2B33',
  ochre:  '#B4551D',
  indigo: '#3D5A80',
  moss:   '#55703F',
  crimson:'#8E3B46',
  umber:  '#6E5340',
};
const CAT_INK = {
  food: 'ochre',   work: 'sumi',    city: 'indigo',
  mood: 'crimson', life: 'moss',    bond: 'umber',
  muse: 'indigo',  walk: 'ochre',   know: 'sumi',
};
function _rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function inkTints(cat) {
  const ink = INKS[CAT_INK[cat] || 'sumi'];
  return {
    ink, line: _rgba(ink, .5), faint: _rgba(ink, .12),
    tintStyle(s) {
      const lvl = ((s.id % 3) + 3) % 3;
      return _rgba(ink, [0.06, 0.10, 0.14][lvl]);
    },
  };
}
function wordClsOf(len, isKey) {
  if (isKey) return 'w-key';
  if (len <= 4) return 'w1';
  if (len <= 6) return 'w2';
  if (len <= 10) return 'w3';
  if (len <= 18) return 'w4';
  return 'w5';
}
/* V4 · 抽卡页卡面字档：≤2 / 3–4 / 5–8 / 9–18 / 长引文两行 */
function kwClsOf(len) {
  if (len <= 2) return 'kw-1';
  if (len <= 4) return 'kw-2';
  if (len <= 8) return 'kw-3';
  if (len <= 18) return 'kw-4';
  return 'kw-5';
}

/* ═══ C1 · 九大类目（序即展示序）═══ */
const CATS = [
  { key: 'food',  name: '美食' },
  { key: 'work',  name: '工作' },
  { key: 'city',  name: '城市' },
  { key: 'mood',  name: '情绪' },
  { key: 'life',  name: '生活' },
  { key: 'bond',  name: '关系' },
  { key: 'muse',  name: '灵感' },
  { key: 'walk',  name: '走走' },
  { key: 'know',  name: '知识' },
];
const NEWBIE_SET_ID = 17; // 生活 · 今日做点小事（当前 seed id17；锚点 14/11 不动）

function catChipOf(key) {
  const c = CATS.find(x => x.key === key);
  return c ? c.name : (key || '未分类');
}



/* ═══ C1 · 当前集持久化 ═══ */
function _savedCur() {
  try {
    const n = Number(wx.getStorageSync('dsm_cur_set'));
    return n > 0 ? n : NEWBIE_SET_ID;
  } catch (e) { return NEWBIE_SET_ID; }
}
function _bindCur(o) {
  let v = o.cur;
  try {
    Object.defineProperty(o, 'cur', {
      configurable: true,
      get() { return v; },
      set(n) {
        v = n;
        try { wx.setStorageSync('dsm_cur_set', n == null ? '' : String(n)); } catch (e) {}
      },
    });
  } catch (e) {}
}

/* ═══ 全局单例 S ═══ */
function initS() {
  return {
    booted: false,
    cat: '全部', sort: 'hot',
    sets: [],
    craft: { drafts: craftStore.load(), reviewing: [] },
    follow: {},
    fans: {},
    social: {},
    comments: {},
    commentDrafts: {},
    cur: _savedCur(),
    posterType: '', pw: null,
    ed: null, edOpen: null, rv: null,
    author: null,
    rc: null, rcTmp: { img: null },
    seq: 1000, toastTimer: null, toastToken: 0,
    weeklyMade: {},
    lastActive: 0,
    remind: { enabled: false, time: '21:00' },
    posterExport: null,
    incomeData: null,
    sigFirst: false,
  };
}

let S = null;
function getS() { if (!S) { S = initS(); _bindCur(S); } return S; }

/* api 响应 → S.sets（D2 版 + likes 缓存） */
function applySetPayload(p) {
  if (!p || !p.id) return null;
  const st = getS();
  let s = st.sets.find(x => x.id === p.id);
  if (!s) { s = { id: p.id }; st.sets.push(s); }
  s.title = p.title; s.covT = p.covT; s.covS = p.covS;
  s.cover = p.cover; s.coverImage = p.coverImage || '';
  s.cat = p.cat; s.type = p.type; s.price = p.price; s.trial = p.trial;
  s.count = p.count; s.pool = p.pool; s.intro = p.intro;
  s.creator = p.creator; s.heat = p.heat; s.date = p.date;
  s.signatureIdx = p.signatureIdx != null ? p.signatureIdx : -1;
  s.signatureNote = p.signatureNote || '';
  s.disclaimer = p.disclaimer || '';
  s.totalDrawn = p.totalDrawn || 0;
  s.earn = p.earn || 0;
  s.buyers = p.buyers || 0;
  /* V4 · 题眼规则：收藏集固定最后一张（收官）；常驻集由数据侧 isKeyEye 标记 */
  if (s.type !== 'resident') {
    const n = s.count || (s.pool || []).length;
    if (n > 0) s.signatureIdx = n - 1;
  }
  if (p.subscribed) {
    const pr = p.progress || {};
    s.user = {
      drawn: pr.drawn || 0,
      got: pr.got || [],
      todayDrawn: !!pr.todayDrawn,
      trialToday: !!pr.trialToday,
      todayIdx: pr.todayIdx != null ? pr.todayIdx : null,
      unlocked: !!pr.unlocked,
      trialUsed: pr.trialUsed || 0,
      drawnLog: pr.drawnLog || [],
      recs: pr.recs || {},
    };
  } else {
    s.user = null;
  }
  if (p.likes != null) st.social[p.id] = { likes: p.likes, liked: !!p.liked };
  return s;
}

let bootPromise = null;
function ensureBoot() {
  const st = getS();
  if (st.booted) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = api.listSets().then(list => {
      list.forEach(applySetPayload);
      st.booted = true;
    }).catch(err => { bootPromise = null; throw err; });
  }
  return bootPromise;
}

function syncOnShow() {
  const st = getS();
  if (!st.booted) return Promise.resolve();
  return api.listSets().then(list => list.forEach(applySetPayload)).catch(() => {});
}

const PAGE_ROUTES = {
  set: '/pages/set/index',
  draw: '/pages/draw/index',
  map: '/pages/map/index',
  edit: '/pages/edit/index',
  income: '/pages/income/index',
  author: '/pages/author/index',
};

/* ═══ V2 · 册子派生 ═══ */
function padNo(n) { return n < 10 ? '0' + n : '' + n; }
function setCoverVM(s) {
  const t = inkTints(s.cat);
  const u = s.user || {};
  const count = s.count || (s.pool || []).length;
  const done = s.type !== 'resident' && count > 0 && (u.got || []).length >= count;
  return {
    noText: 'No.' + padNo(s.id),
    title: (s.title || '').slice(0, 6),
    creator: s.creator || '',
    isResident: s.type === 'resident',
    done,
    price: s.price || 0,
    coverImage: s.coverImage || '',
    ink: t.ink,
    tintStyle: t.tintStyle(s),
  };
}

module.exports = {
  getViewport, BRAND, ME, TABS, clone, bwCls, pad2, todayDot, stampDate, fmt, fmtShort, weeklyTitle, isoWeekKey, cardDone, setVM, finishDate, getRec, recCount, hasRecPending, stampedCount, dateKeyOf, todayKey, weekMondayKey, _keyPlus, weekProgress, daysAbsent, TMPL_IDS, REMIND_TIMES, CATS, NEWBIE_SET_ID, catChipOf, INKS, inkTints, wordClsOf, kwClsOf, padNo, setCoverVM,
  getS, initS, applySetPayload, ensureBoot, syncOnShow,
  craftStore, PAGE_ROUTES,
};
