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

function getTodayShort() {
  const n = new Date();
  return `${n.getMonth() + 1}月${n.getDate()}日`;
}

function todayMD() {
  const n = new Date();
  return `${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
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

const HM_SHOW_CATS = true;    // cat 打标完成前可置 false，chips 只剩「全部」
const HM_SHOW_DAILY = false;  // TODO(运营): daily 内容就位后置 true

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
  reading: 'indigo', life: 'umber', emotion: 'crimson', work: 'sumi',
  sport: 'moss', food: 'ochre', city: 'sumi', relation: 'crimson',
  nature: 'moss', create: 'umber',
};
function _rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function inkTints(cat) {
  const ink = INKS[CAT_INK[cat] || 'sumi'];
  return { ink, line: _rgba(ink, .5), faint: _rgba(ink, .12) };
}
function wordClsOf(len, isKey) {
  if (isKey) return 'w-key';
  if (len <= 4) return 'w1';
  if (len <= 6) return 'w2';
  return 'w3';
}

const HM_CATS = [
  { key: 'reading',  chip: '阅读', title: '我看我存在',           sub: '读一点，记下来，假装自己活过。',                          empty: '书架空着，脑子也是。去放点什么进来。' },
  { key: 'life',     chip: '生活', title: '人间值得',             sub: '不是因为人间有多好，是因为来都来了。',                    empty: '今天的人间，暂时不值得。但明天可能值。' },
  { key: 'emotion',  chip: '情绪', title: '情绪不只流过我的身体', sub: '它住下了，还交了房租。',                                  empty: '此刻情绪稳定，稳定地不想说话。' },
  { key: 'work',     chip: '工作', title: '咸鱼的咸度也是不同的', sub: '有人是海盐，有人是咸鱼干，有人只是泡水里的黄瓜。',        empty: '今天没有班味，因为根本没上班。' },
  { key: 'sport',    chip: '运动', title: '实力不详，遇强则强',   sub: '平时瘫着，遇到好看的跑道/球场/日落，突然会跑。',          empty: '身体还在待机，精神已经热身三回了。' },
  { key: 'food',     chip: '美食', title: '胃是情绪器官',         sub: '难过的时候，胃比脑子先知道。',                            empty: '肚子不饿，但心饿了。吃点什么？' },
  { key: 'city',     chip: '城市', title: '我的城市不告诉我',     sub: '它每天给我上课，但从不发课表。',                          empty: '这座城市还有很多角落，我没去过，也没准备好去。' },
  { key: 'relation', chip: '关系', title: '人类样本观察室',       sub: '观察别人，顺便理解自己。毕竟我也是样本。',                empty: '暂时没有人类可以观察。观察一下镜子里的？' },
  { key: 'nature',   chip: '自然', title: '树木不赶时间',         sub: '它长它的，我急我的。但我们都在今天。',                    empty: '今天没有出门。但窗户外面的树，已经绿了一整天。' },
  { key: 'create',   chip: '创造', title: '手比脑子诚实',         sub: '想不清楚的时候，做点什么东西出来。不一定好，但一定真实。', empty: '手闲了，脑子就开始乱想了。做点什么？' },
];

const HM_CAT_DAILY = { key: 'daily', chip: '每日一签', title: '每日一签',
  sub: '不用集齐什么。今天抽过，今天就算数。',
  empty: '今天还没抽。来一封？' };

/* 首页 v3 · 维度宫格（微信读书式入口） */
const HM_DIMS = [
  { key: 'edit',   name: '编辑推荐', sub: '本周编辑精选',       icon: 'edit' },
  { key: 'hot',    name: '最热榜单', sub: '按热度排名',         icon: 'hot' },
  { key: 'season', name: '时令卡集', sub: '节气 · 节日 · 季节', icon: 'season' },
  { key: 'new',    name: '最新上线', sub: '最近上架',           icon: 'new' },
  { key: 'love',   name: 'TA们喜欢', sub: '回信精选',           icon: 'love' },
  { key: 'free',   name: '免费专区', sub: '0 元开始',           icon: 'free' },
];
/* 编辑精选：演示数据手选（正式版由运营后台配置） */
const HM_EDIT_IDS = [1, 14, 11, 8];

/* 「新上架」运营位：先留位不上线（v1 不进 chips），上线时 concat 进 cats 即可 */
const HM_CAT_NEWS = { key: 'news', chip: '新上架', title: '新上架',
  sub: '最近来到这里的新集子。',
  empty: '还没有新上架的卡集。' };

function catChipOf(key) {
  const c = HM_CATS.find(x => x.key === key);
  if (c) return c.chip;
  if (key === HM_CAT_DAILY.key) return HM_CAT_DAILY.chip;
  if (key === HM_CAT_NEWS.key) return HM_CAT_NEWS.chip;
  return key || '未分类';
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
    cur: null,
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
function getS() { if (!S) S = initS(); return S; }

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
  s.totalDrawn = p.totalDrawn || 0;
  s.earn = p.earn || 0;
  s.buyers = p.buyers || 0;
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

module.exports = {
  getViewport, BRAND, ME, TABS, clone, bwCls, pad2, getTodayShort, todayMD, todayDot, stampDate, fmt, fmtShort, weeklyTitle, isoWeekKey, cardDone, setVM, finishDate, getRec, recCount, todayIdxOf, hasRecPending, stampedCount, BK_OFFSET_MS, _bkDate, dateKeyOf, todayKey, weekMondayKey, _keyPlus, weekProgress, daysAbsent, TMPL_IDS, REMIND_TIMES, HM_SHOW_CATS, HM_SHOW_DAILY, HM_CATS, HM_CAT_DAILY, HM_DIMS, HM_EDIT_IDS, HM_CAT_NEWS, catChipOf, INKS, inkTints, wordClsOf,
  getS, initS, applySetPayload, ensureBoot, syncOnShow,
  craftStore, PAGE_ROUTES,
};
