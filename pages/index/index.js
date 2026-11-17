// 今日做点小事 · 微信小程序版
// 移植自远程仓库 static/day_small_things_v2.html（V2.3c 原型）
const seed = require('../../data.js');
const posterKit = require('../../utils/posterKit/export.js');

function getViewport() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return { w: info.windowWidth, h: info.windowHeight };
  } catch (e) { return { w: 375, h: 667 }; }
}

const BRAND = '今日做点小事';
const ME = '打工人小王';
const RARC = { N: '#FF8A5C', R: '#FF6B35', SR: '#E55A2B', SSR: '#D9A227' };
const SP_RAR = { N: '#43A585', R: '#4E9ED9', SR: '#E2A236', SSR: '#D9A227' };
const RARNAME = { N: '薄荷 · 常见', R: '晴空 · 稀有', SR: '蜜琥珀 · 珍贵', SSR: '鎏金 · 传说' };
const TABS = ['home', 'cards', 'create', 'me'];
const RAR_KEYS = ['N', 'R', 'SR', 'SSR'];

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

function getTodayStr() {
  const now = new Date();
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} · ${days[now.getDay()]}`;
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
  return !!(c && (c.w || '').trim() && (c.b || '').trim() && c.r);
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

function buildRules(s) {
  const r = ['每天可抽 1 张，0 点重置（北京时间）'];
  r.push(s.type === 'collect'
    ? '收藏集：抽过的不再出现，抽完即空，留一张纪念'
    : '常驻集：天天可抽，抽到就是答案');
  if (s.price > 0) {
    r.push(`前 ${s.trial} 张免费试抽，试抽不占每日额度`);
    r.push('解锁是一次性的，之后每天照抽');
  }
  r.push('缺席不损失，卡不会过期');
  return r;
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

/* ═══ 首页 v2.2 · 整页滚动 + 我的订阅前置 + 分类体系 ═══
   字体策略：新文案走系统字体（未进宋体子集也不方框）；
   serif 只用于品牌/集名/封面字；mono 只用于纯数字。 */

const HM_SHOW_CATS = true;    // cat 打标完成前可置 false，chips 只剩「全部」

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

Page({
  data: {
    brand: BRAND,
    page: 'home',
    showTabbar: true,
    tabActive: 'home',
    statusBarHeight: 20,
    navTop: 64,
    tabs: [
      { id: 'home', label: '发现', icon: '/assets/icons/tab-home.png', iconOn: '/assets/icons/tab-home-on.png' },
      { id: 'cards', label: '订阅', icon: '/assets/icons/tab-cards.png', iconOn: '/assets/icons/tab-cards-on.png' },
      { id: 'create', label: '创作', icon: '/assets/icons/tab-create.png', iconOn: '/assets/icons/tab-create-on.png' },
      { id: 'me', label: '我的', icon: '/assets/icons/tab-me.png', iconOn: '/assets/icons/tab-me-on.png' },
    ],
    toastMsg: '',
    toastShow: false,
    toastHide: false,
    home: { dateNum: '', dateWk: '', cats: [], cat: 'all',
            column: null, rows: [], emptyText: '', chipsStuck: false, sort: 'hot' },
    setPage: { exists: false, ctaShow: false, ctaFloating: false },
    draw: null,
    mapV: { cells: [], drawn: 0, count: 0, pct: 0 },
    done: { exists: false },
    cards: { isNew: false, groups: [] },
    craft: { empty: false, groups: [] },
    edit: { mode: 'edit', cards: [] },
    income: { exists: false },
    author: { exists: false, works: [] },
    me: { date: '', cardN: 0, stampN: 0, emptied: 0, todayLine: '' },
    demo: { mode: 'rich' },
    pay: { show: false, paying: false },
    check: { show: false, list: [] },
    pub: { show: false },
    record: { show: false, note: '', img: '', hasImg: false, count: 0 },
    commentsSheet: { show: false, sid: null, title: '', items: [], count: 0, canComment: false, draft: '', draftLen: 0 },
    poster: { show: false, kind: 'highlight', ratio: '34' },
    floatCta: { show: false },
    donePage: { show: false, ctaShow: false },
    subs: { waiting: [], ongoing: [], done: [], total: 0, weekly: null },
    mine: { empty: true, days: 0, lit: 0, stamps: 0, done: [], ongoingCount: 0, notes: [] },
    bigCard: { show: false, flipped: false, back: { sid: '', idx: 0, rec: null } },
  },

  onLoad() {
    let statusBarHeight = 20;
    let navTop = 64;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
      navTop = statusBarHeight + 44;
      if (wx.getMenuButtonBoundingClientRect) {
        const rect = wx.getMenuButtonBoundingClientRect();
        if (rect && rect.bottom) navTop = Math.max(statusBarHeight, rect.bottom + 6);
      }
    } catch (e) { /* noop */ }

    this.setData({ statusBarHeight, navTop });

    this.S = {
      mode: 'rich',
      cat: '全部',
      sort: 'hot',
      catList: seed.CATS.slice(),
      sets: clone(seed.DEMO.sets),
      authored: clone(seed.DEMO.sets),
      craft: clone(seed.CRAFT),
      craftBackup: null,
      craftEmptyView: false,
      follow: {},
      fans: seed.FANS,
      income: { withdrawn: 0, pending: 0, threshold: 100 },
      platformIncome: seed.PLATFORM_INCOME,
      txnSeed: seed.TXN_SEED,
      social: clone(seed.SOCIAL_SEED || {}),
      comments: clone(seed.COMMENTS_SEED || {}),
      commentDrafts: {},
      cur: null,
      cameFrom: 'home',
      draw: null,
      mailOpening: false,
      posterCtx: null,
      posterType: '',
      pw: null,
      ed: null,
      edOpen: null,
      rv: null,
      author: null,
      authorFrom: 'home',
      rc: null,
      rcTmp: { img: null },
      seq: 1000,
      toastTimer: null,
      toastToken: 0,
      envelopeTimers: [],
      unlockTimer: null,
      weeklyMade: {},      // key = `${setId}:${weekNo}`
      posterExport: null,  // 当前海报的导出数据（与 WXML 预览同源）
    };

    this.resetMode('rich');
    this.renderHome();
    this.renderSubs();
    this.renderMe();
    this.renderCraft();
    this.setData({ demo: { mode: 'rich' } });
    this.go('home', true);
  },

  onReady() {
    // onLoad 时胶囊按钮信息偶尔尚未就绪，onReady 再校准一次
    try {
      if (wx.getMenuButtonBoundingClientRect) {
        const rect = wx.getMenuButtonBoundingClientRect();
        if (rect && rect.bottom) {
          const navTop = Math.max(this.data.statusBarHeight, rect.bottom + 6);
          if (navTop !== this.data.navTop) this.setData({ navTop });
        }
      }
    } catch (e) { /* noop */ }
  },

  onUnload() {
    const S = this.S;
    this.teardownSetObservers();
    this.teardownHomeObserver();
    clearTimeout(this._drawTimer);
    clearTimeout(this._doneTimer);
    if (!S) return;
    clearTimeout(S.toastTimer);
    clearTimeout(S.unlockTimer);
    (S.envelopeTimers || []).forEach(t => clearTimeout(t));
  },

  onShareAppMessage() {
    return {
      title: '万物皆可抽一签 · 今日做点小事',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return { title: '万物皆可抽一签 · 今日做点小事' };
  },

  /* ──────────────────────────────────────────────────────────
     模式 / 数据工具
     ────────────────────────────────────────────────────────── */
  resetMode(m) {
    const S = this.S;
    S.mode = m;
    S.income.withdrawn = 0;
    S.income.pending = 0;
    S.weeklyMade = {};
    S.sets = clone(S.authored);
    if (m === 'new') {
      S.sets = S.sets.filter(s => s.creator !== ME);
      S.sets.forEach(s => { s.user = null; });
      if (S.craftBackup) {
        S.craftBackup.drafts = S.craftBackup.drafts.concat(S.craft.drafts);
        S.craftBackup.reviewing = S.craftBackup.reviewing.concat(S.craft.reviewing);
      } else {
        S.craftBackup = { drafts: S.craft.drafts.slice(), reviewing: S.craft.reviewing.slice() };
      }
      S.craft.drafts = [];
      S.craft.reviewing = [];
      S.follow = {};
    } else if (S.craftBackup) {
      S.craft.drafts = S.craftBackup.drafts.concat(S.craft.drafts);
      S.craft.reviewing = S.craftBackup.reviewing.concat(S.craft.reviewing);
      S.craftBackup = null;
    }
    this.setData({ demo: { mode: m } });
  },

  setMode(e) {
    const m = e.currentTarget.dataset.mode;
    const S = this.S;
    S.craftEmptyView = false;
    this.resetMode(m);
    this.renderHome();
    this.renderSubs();
    this.renderMe();
    this.renderCraft();
    if (S.cur != null && this.data.page === 'set') this.renderSetPage();
    if (this.data.page === 'author') this.renderAuthor();
    this.toast(m === 'new' ? '已切换到「新用户 · 空态」' : '已切换到「演示用户 · 有进度」');
  },

  ownEarn() {
    const S = this.S;
    if (S.mode === 'new') return 0;
    return S.sets.filter(s => s.creator === ME).reduce((a, s) => a + (s.earn || 0), 0) + S.platformIncome;
  },

  availEarn() {
    const S = this.S;
    return Math.max(0, this.ownEarn() - S.income.withdrawn - S.income.pending);
  },

  /* ──────────────────────────────────────────────────────────
     导航 / 轻提示
     ────────────────────────────────────────────────────────── */
  go(id, initial) {
    if (this.data.page === 'set' && id !== 'set') this.teardownSetObservers();
    if (this.data.page === 'home' && id !== 'home') this.teardownHomeObserver();
    if (this.data.page === 'draw' && id !== 'draw') clearTimeout(this._drawTimer);
    if (id === 'home') this.renderHome();
    if (id === 'create') this.renderCraft();
    if (id === 'income') this.renderIncome();
    if (id === 'cards') this.renderSubs();
    if (id === 'me') this.renderMe();
    this.setData({
      page: id,
      showTabbar: TABS.includes(id),
      tabActive: TABS.includes(id) ? id : '',
    }, () => {
      if (!initial) wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    });
  },

  goTab(e) {
    const id = e.currentTarget.dataset.page;
    this.go(id);
  },

  goSet() {
    this.renderSetPage();
    this.go('set');
  },

  goBackSet() {
    this.renderSetPage();
    this.go(this.S.cameFrom || 'home');
  },

  backToSet() {
    this.renderSetPage();
    this.go('set');
  },

  backToCreate() {
    this.renderCraft();
    this.go('create');
  },

  backToHome() {
    this.go('home');
  },

  goHome() {
    this.go('home');
  },

  goIncome() {
    this.go('income');
  },

  craftRowTap(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'review') this.openReview(e);
    else if (d.kind === 'draft') this.openEdit(d.id);
    else this.openSetById(Number(d.id), 'create');
  },

  toast(msg) {
    const S = this.S;
    clearTimeout(S.toastTimer);
    const token = ++S.toastToken;
    this.setData({ toastMsg: msg, toastShow: true, toastHide: false });
    S.toastTimer = setTimeout(() => {
      if (token !== S.toastToken) return;
      this.setData({ toastShow: false, toastHide: true });
      setTimeout(() => {
        if (token !== S.toastToken) return;
        this.setData({ toastMsg: '', toastHide: false });
      }, 260);
    }, 2800);
  },

  /* ──────────────────────────────────────────────────────────
     首页 v3 · 三宫格 + 维度宫格 + TA们喜欢卡片流
     ────────────────────────────────────────────────────────── */
  _hmDate() {
    const d = new Date();
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    const p2 = (n) => String(n).padStart(2, '0');
    return {
      num: d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()),
      wk: '星期' + wd,
      label: (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + wd,
    };
  },

  _hmHasRec(u, idx) {
    if (!u || !u.recs || idx == null || !(idx in u.recs)) return false;
    const r = u.recs[idx];
    return Array.isArray(r) ? r.length > 0 : !!r;
  },

  _hmSticker(cat) {
    return { reading: '📖', nature: '🎋', city: '🏙️', food: '🍜',
      work: '💼', emotion: '🌙', sport: '⚽', relation: '👥',
      create: '✨' }[cat] || '🃏';
  },

  renderHome() {
    const S = this.S;
    const sets = S.sets || [];
    const cat = HM_SHOW_CATS ? (this._hmCat || 'all') : 'all';
    const dimKey = this._hmDim || '';
    const dim = HM_DIMS.find(d => d.key === dimKey && d.key !== 'love') || null;

    /* ① 维度 / 分类过滤（维度优先，互斥） */
    let pool;
    if (dim) {
      if (dim.key === 'edit')        pool = sets.filter(s => HM_EDIT_IDS.includes(s.id));
      else if (dim.key === 'hot')    pool = sets.slice().sort((a, b) => (b.heat || 0) - (a.heat || 0));
      else if (dim.key === 'season') pool = sets.filter(s => s.cat === 'nature');
      else if (dim.key === 'new')    pool = sets.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      else if (dim.key === 'free')   pool = sets.filter(s => !(s.price > 0 && s.creator !== ME));
      else pool = sets;
    } else if (cat !== 'all') {
      pool = sets.filter(s => s.cat === cat);
    } else {
      pool = sets.slice().sort((a, b) => S.sort === 'hot'
        ? (b.heat || 0) - (a.heat || 0)
        : (b.date || '').localeCompare(a.date || ''));
    }

    const rows = pool.map(s => {
      const v = setVM(s);
      const paid = s.price > 0 && s.creator !== ME;
      return {
        id: s.id,
        title: s.title,
        covT4: s.covT.slice(0, 4),
        covS8: s.covS.slice(0, 8),
        cover: s.cover,
        price: s.price,
        trial: s.trial,
        meta: `@${s.creator} · ${s.count} 张 · ${s.type === 'collect' ? '收藏集' : '常驻集'}`,
        vmText: v.text,
        faint: v.dot === 'faint',
        tagCls: paid ? 'paid' : (s.heat > 800 ? 'hot' : 'free'),
        tagText: s.heat > 800 && !paid ? '🔥 热门' : (paid ? `¥${s.price}` : '免费'),
        sticker: this._hmSticker(s.cat),
      };
    });

    /* ② 分类面板数据 + 当前分类名 */
    const cats = [{ key: 'all', chip: '全部' }]
      .concat(HM_SHOW_CATS ? [HM_CAT_DAILY].concat(HM_CATS) : []);
    const catMeta = cats.find(c => c.key === cat);
    const catLabel = catMeta ? catMeta.chip : '全部';
    const catEmpty = (catMeta && catMeta.empty) || '';

    /* ③ TA们喜欢：全局回信精选（横滑卡片流） */
    const loveCards = [];
    sets.forEach(s => {
      const u = s.user;
      if (!u || !u.recs) return;
      Object.keys(u.recs).forEach(k => {
        const idx = Number(k);
        const r0 = u.recs[k];
        const rec = Array.isArray(r0) ? r0[r0.length - 1] : r0;
        if (!rec || !(rec.note || '').trim()) return;
        loveCards.push({
          sid: s.id, idx,
          who: ME,
          date: rec.date || '',
          note: rec.note.trim(),
          word: (s.pool[idx] || {}).w || '·',
          title: s.title || '',
        });
      });
    });
    loveCards.sort((a, b) => b.note.length - a.note.length);
    loveCards.splice(8);

    const dt = this._hmDate();
    const chipColors = {
      reading: 'mint', life: 'sky', emotion: 'blossom', work: 'honey',
      sport: 'mint', food: '', city: 'blossom', relation: 'sky',
      nature: 'mint', create: 'honey',
    };
    const chips = [{ key: 'all', chip: '全部', color: '', on: cat === 'all' }]
      .concat(HM_SHOW_CATS ? HM_CATS.map(c => ({
        key: c.key, chip: c.chip, color: chipColors[c.key] || '', on: cat === c.key,
      })) : []);
    this.setData({
      home: {
        date: dt.label,
        dateNum: dt.num, dateWk: dt.wk,
        quickCatSub: cat === 'all' ? '按主题找卡集' : '分类 · ' + catLabel,
        dims: HM_DIMS, dim,
        cat, catLabel, cats, chips,
        catSheet: !!(this.data.home && this.data.home.catSheet),
        loveCards,
        rows, emptyText: (!dim && cat !== 'all' && !rows.length) ? catEmpty : '',
        sort: S.sort,
      },
    });
  },

  toastSearch() {
    this.toast('搜索功能开发中');
  },

  setCat(e) {
    this._hmCat = e.currentTarget.dataset.key || 'all';
    this._hmDim = '';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  /* 三宫格：分类 → 滚动到 chips */
  tapQuickCat() {
    wx.pageScrollTo({ selector: '.chips', duration: 200 });
  },

  pickCat(e) {
    this._hmCat = e.currentTarget.dataset.key || 'all';
    this._hmDim = '';
    this.setData({ 'home.catSheet': false });
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  closeCatSheet() {
    this.setData({ 'home.catSheet': false });
  },

  noop() {},

  /* 三宫格：热门活动 → 最热榜单 */
  tapQuickHot() {
    this.S.sort = 'hot';
    this._hmDim = '';
    this._hmCat = 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    this.toast('已切换至最热榜单');
  },

  /* 三宫格：新建卡片 → 创作中心 */
  tapQuickNew() {
    this.go('create');
  },

  /* 维度宫格 */
  pickDim(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'love') {
      wx.pageScrollTo({ selector: '#hm-love', duration: 240 });
      return;
    }
    this._hmDim = (this._hmDim === key) ? '' : key;
    this._hmCat = 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  clearDim() {
    this._hmDim = '';
    this.renderHome();
  },

  clearCat() {
    this._hmCat = 'all';
    this.renderHome();
  },

  /* TA们喜欢卡片 → 大卡 */
  tapLoveCard(e) {
    this.showBigCard(Number(e.currentTarget.dataset.sid), Number(e.currentTarget.dataset.idx));
  },

  setSort(e) {
    this.S.sort = e.currentTarget.dataset.sort;
    this.renderHome();
  },

  /* chips 已收进分类入口，吸顶观察器不再需要；保留空实现兼容旧调用 */
  initHomeObserver() {},
  teardownHomeObserver() {},

  openDemo() {
    this.renderCraft();
    this.go('demo');
  },

  /* ──────────────────────────────────────────────────────────
     卡集详情
     ────────────────────────────────────────────────────────── */
  openSet(e) {
    const d = e.currentTarget.dataset;
    this.S.cameFrom = d.from || 'home';
    this.S.cur = Number(d.id);
    this.renderSetPage();
    this.go('set');
  },

  openSetById(id, from) {
    this.S.cameFrom = from || 'home';
    this.S.cur = Number(id);
    this.renderSetPage();
    this.go('set');
  },

  renderSetPage() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) {
      this.setData({ setPage: { exists: false } });
      return;
    }
    const u = s.user || {};
    const pool = s.pool || [];
    const count = s.count || pool.length;
    const got = u.got || [];
    const isResident = s.type === 'resident';
    const done = !isResident && count > 0 && got.length >= count;
    const hasRec = (i) => {
      if (i == null) return null;
      const r = u.recs && u.recs[i];
      return Array.isArray(r) ? r[r.length - 1] : r;
    };
    const todayIdx = u.todayDrawn
      ? (u.todayIdx != null ? u.todayIdx : (got.length ? got[got.length - 1] : 0))
      : null;
    const todayRec = hasRec(todayIdx);

    /* ① 序章元信息 */
    const metaBits = [];
    if (s.creator) metaBits.push('@' + s.creator);
    metaBits.push(count + ' 张');
    if (s.cat) metaBits.push(catChipOf(s.cat));

    /* ② 进度点阵 */
    const dots = pool.map((_, i) => ({ i, on: got.includes(i) }));
    let progressNote;
    if (done) progressNote = `全部点亮 · ${count} 张`;
    else if (isResident) progressNote = `已拆 ${u.drawn || 0} 封 · 点亮 ${got.length}/${count}`;
    else if (!got.length) progressNote = `还没开始 · 共 ${count} 张`;
    else progressNote = `第 ${got.length} 天 · 还剩 ${count - got.length} 张`;

    /* ③ 全图（空位=虚线签位 / 点亮=白签） */
    const cells = pool.map((c, i) => {
      const n = (c.w || '').length;
      return {
        idx: i,
        got: got.includes(i),
        word: c.w || '',
        wordCls: n >= 7 ? 'l7' : (n >= 5 ? 'l5' : 'l4'),
        rarColor: SP_RAR[c.r || 'N'] || SP_RAR.N,
        no: `No.${pad2(i + 1)}`,
        isToday: u.todayDrawn && todayIdx === i,
      };
    });

    /* ④ 精选回信（笔记最长的 2 条；点击可跳大卡） */
    const picks = [];
    pool.forEach((c, i) => {
      const rec = hasRec(i);
      if (rec && (rec.note || '').trim()) {
        picks.push({ idx: i, word: c.w || '·', note: rec.note.trim(), date: rec.date || '' });
      }
    });
    picks.sort((a, b) => b.note.length - a.note.length);
    picks.splice(2);

    /* ⑤ CTA 状态机 */
    const trialLeft = !isResident && s.price > 0 && s.trial > 0 && !u.unlocked && !u.trialUsed;
    let cta;
    if (done) {
      cta = { tap: 'booklet', kind: 'ink', text: '✦ 翻开纪念册', note: `${count} 张 · 全部点亮` };
    } else if (isResident) {
      if (u.todayDrawn && todayRec) {
        cta = { tap: 'view', kind: 'tint', text: '看看今天的卡', note: '今天的邮戳已盖好' };
      } else if (u.todayDrawn) {
        cta = { tap: 'stamp', kind: 'brand', text: '补盖今天的邮戳', note: '今天的卡还没写回信' };
      } else {
        cta = {
          tap: 'draw', kind: 'brand',
          text: got.length ? '今天再抽一封' : '拆第一封',
          note: '常驻签 · 每天可抽',
        };
      }
    } else if (u.todayDrawn && !todayRec) {
      cta = { tap: 'stamp', kind: 'brand', text: '补盖今天的邮戳', note: '今天的卡还没写回信' };
    } else if (u.todayDrawn) {
      cta = { tap: 'view', kind: 'tint', text: '看看今天的卡', note: '今天的邮戳已盖好' };
    } else if (!got.length) {
      cta = {
        tap: 'draw', kind: 'brand', text: '拆第一封',
        note: trialLeft ? '首封免费试抽 · 之后每天一封' : `第 1 天 · 还剩 ${count} 张`,
      };
    } else if (s.price > 0 && !u.unlocked) {
      cta = { tap: 'draw', kind: 'brand', text: `解锁全集 · ¥${s.price}`, note: '一次解锁 · 之后每天一封' };
    } else {
      cta = {
        tap: 'draw', kind: 'brand', text: '拆今天这一封',
        note: `第 ${got.length + 1} 天 · 还剩 ${count - got.length} 张`,
      };
    }

    /* ── v2 · 收集进度 / 邮戳 / 试抽 ── */
    const gotN = got.length;
    let prog = null, stampRow = null, trialRow = null;
    if (!isResident && u) {
      prog = {
        drawn: u.drawn || 0,
        count,
        pct: Math.round((u.drawn || 0) / (count || 1) * 100),
      };
      if ((u.drawn || 0) > 0) {
        prog.est = { drawn: u.drawn || 0, rest: count - (u.drawn || 0), date: finishDate(s) };
      }
      if (gotN > 0) {
        const stN = stampedCount(s);
        stampRow = { stN, gotN, pct: Math.round(stN / gotN * 100) };
      }
    }
    if (isResident && u) {
      prog = { drawn: u.drawn || 0, count: 0, pct: 0 };
    }
    if (s.price > 0 && s.trial > 0 && u && !u.unlocked) {
      const used = Math.min(u.trialUsed || 0, s.trial);
      trialRow = { used, trial: s.trial, pct: Math.round(used / s.trial * 100) };
    }

    /* ── 公开互动：心动 + 留言 ── */
    const soc = this._socialOf(s);
    const commentN = this._commentsOf(s).length;

    this.setData({
      setPage: {
        exists: true,
        id: s.id,
        todayIdx,
        done,
        coverChar: (s.covT || s.title || '·').slice(0, 1),
        title: s.title || '',
        creator: s.creator || '',
        metaLine: metaBits.join(' · '),
        intro: (s.intro || '').trim(),
        gridCls: count <= 12 ? 'c4' : 'c3',
        dots,
        progressNote,
        cells,
        picks,
        cta,
        /* ── v2 · 原型 set-hero / 进度 / 稀有度 ── */
        cover: s.cover || '',
        covT: s.covT || s.title || '',
        covS: s.covS || '',
        count: count,
        price: s.price || 0,
        trial: s.trial || 0,
        kind: isResident ? '常驻集' : '收藏集',
        catChip: catChipOf(s.cat),
        heatText: s.heat > 0 ? fmt(s.heat) + ' 人抽过' : '',
        locked: !!(u && s.price > 0 && s.creator !== ME && !u.unlocked),
        creatorAvatar: (s.creator || '·').slice(0, 1),
        fansText: S.fans && S.fans[s.creator]
          ? fmt(S.fans[s.creator]) + ' 位关注者' : '做卡人',
        following: !!S.follow[s.creator],
        own: s.creator === ME,
        prog,
        stampRow,
        trialRow,
        social: {
          liked: !!soc.liked,
          likes: soc.likes || 0,
          likesText: fmt(soc.likes || 0),
          commentCount: commentN,
          commentText: commentN ? commentN + ' 条留言' : '写第一条留言',
        },
        canComment: this._canComment(s),
        likePop: false,
        rules: buildRules(s),
        rarity: ['N', 'R', 'SR', 'SSR'].map(k => {
          const n = (s.rar && s.rar[k]) || 0;
          return { k, n, pct: Math.round(n / (count || 1) * 100) };
        }),
      },
      'floatCta.show': false,
    });
    wx.nextTick(() => {
      if (this.data.page !== 'set') return;
      if (this._spObsId !== s.id) { this._spObsId = s.id; this.initSetObservers(); }
      this.updateFloatCta();
    });
  },

  /* ──────────────────────────────────────────────────────────
     卡集公开互动：心动 + 留言
     ────────────────────────────────────────────────────────── */
  _socialOf(s) {
    if (!s) return { likes: 0, liked: false };
    let soc = this.S.social[s.id];
    if (!soc) {
      soc = { likes: Math.max(6, Math.round((s.heat || 0) / 28)), liked: false };
      this.S.social[s.id] = soc;
    }
    return soc;
  },

  _commentsOf(s) {
    if (!s) return [];
    let list = this.S.comments[s.id];
    if (!list) {
      list = [];
      this.S.comments[s.id] = list;
    }
    return list;
  },

  _commentItems(s) {
    return this._commentsOf(s).map(c => Object.assign({}, c, {
      avatar: c.avatar || (c.name || '签').slice(0, 1),
    }));
  },

  /* 订阅且有抽卡记录（含试抽）才可留言 */
  _canComment(s) {
    if (!s) return false;
    if (s.creator === ME) return true;
    const u = s.user;
    if (!u) return false;
    return (u.drawn || 0) > 0 || (u.got || []).length > 0 ||
      (u.trialUsed || 0) > 0 || !!u.todayDrawn;
  },

  toggleSetLike() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    const soc = this._socialOf(s);
    soc.liked = !soc.liked;
    soc.likes = Math.max(0, (soc.likes || 0) + (soc.liked ? 1 : -1));
    this.setData({
      'setPage.social.liked': soc.liked,
      'setPage.social.likes': soc.likes,
      'setPage.social.likesText': fmt(soc.likes),
      'setPage.likePop': true,
    });
    setTimeout(() => this.setData({ 'setPage.likePop': false }), 320);
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  openComments() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    const items = this._commentItems(s);
    const draft = this.S.commentDrafts[s.id] || '';
    this.setData({
      'home.catSheet': false,
      commentsSheet: {
        show: true,
        sid: s.id,
        title: s.title || '',
        items,
        count: items.length,
        canComment: this._canComment(s),
        draft,
        draftLen: draft.length,
      },
    });
  },

  closeComments() {
    this.setData({ 'commentsSheet.show': false });
    if (wx.hideKeyboard) wx.hideKeyboard();
  },

  onCommentInput(e) {
    const draft = (e.detail.value || '').slice(0, 200);
    const sid = this.data.commentsSheet.sid;
    if (sid != null) this.S.commentDrafts[sid] = draft;
    this.setData({ 'commentsSheet.draft': draft, 'commentsSheet.draftLen': draft.length });
  },

  submitComment() {
    const sheet = this.data.commentsSheet;
    const text = (sheet.draft || '').trim();
    if (!text) {
      this.toast('写一句话再发送');
      return;
    }
    const s = this.S.sets.find(x => x.id === sheet.sid);
    if (!s) return;
    const list = this._commentsOf(s);
    list.unshift({
      id: 'c' + Date.now(),
      name: ME,
      avatar: ME.slice(0, 1),
      text,
      time: '刚刚',
      creator: s.creator === ME,
    });
    this.S.commentDrafts[s.id] = '';
    const items = this._commentItems(s);
    this.setData({
      commentsSheet: Object.assign({}, sheet, {
        items, count: items.length, draft: '', draftLen: 0,
      }),
      'setPage.social.commentCount': items.length,
      'setPage.social.commentText': items.length + ' 条留言',
    });
    if (wx.hideKeyboard) wx.hideKeyboard();
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    this.toast('已留下这句话');
  },

  goDrawFromComments() {
    this.closeComments();
    setTimeout(() => this.tapSetCta(), 120);
  },

  /* 全图 / 精选回信 点击 → 大卡 */
  tapSetCell(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const sp = this.data.setPage;
    if (!sp || !sp.cells[idx]) return;
    if (!sp.cells[idx].got) { this.toast('还没抽到这一张'); return; }
    this.showBigCard(sp.id, idx);
  },

  /* 详情页关注 */
  toggleFollowSet() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s || !s.creator || s.creator === ME) return;
    S.follow[s.creator] = !S.follow[s.creator];
    this.toast(S.follow[s.creator] ? '已关注 @' + s.creator + '。' : '已取消关注。');
    this.renderSetPage();
  },

  /* CTA 分发 */
  tapSetCta() {
    const sp = this.data.setPage;
    if (!sp) return;
    const s = this.S.sets.find(x => x.id === sp.id);
    if (!s) return;
    switch (sp.cta.tap) {
      case 'draw':
        this.mainAct();                 // 试抽 / 正式 / 付费墙分流沿用原状态机
        break;
      case 'stamp':
        this.goSetRecord(s);
        break;
      case 'view':
        this.showBigCard(s.id, sp.todayIdx != null ? sp.todayIdx : 0);
        break;
      case 'booklet':
        this.openPoster({ currentTarget: { dataset: { type: 'memorial', sid: s.id } } });
        break;
    }
  },

  /* 打开盖章面板 */
  goSetRecord(s) {
    const sp = this.data.setPage;
    const idx = (sp && sp.todayIdx != null)
      ? sp.todayIdx
      : (s.user && s.user.todayIdx);
    if (idx == null) return;
    this.openRecordAt(s.id, idx, 'set');
  },

  /* ── 浮动 CTA：滚过首屏浮现、尾部 CTA 可见时退场 ── */
  initSetObservers() {
    if (this._spObs) { this._spObs.disconnect(); this._spObs = null; }
    this._spScrolled = false;
    this._spTailVisible = false;
    const obs = wx.createIntersectionObserver(this, { observeAll: false });
    obs.relativeToViewport();
    obs.observe('#sp-intro-end', (res) => {
      this._spScrolled = res.boundingClientRect.top < 0;
      this.updateFloatCta();
    });
    obs.observe('#sp-tail', (res) => {
      this._spTailVisible = res.intersectionRatio > 0;
      this.updateFloatCta();
    });
    this._spObs = obs;
  },

  teardownSetObservers() {
    if (this._spObs) {
      this._spObs.disconnect();
      this._spObs = null;
      this._spObsId = null;
    }
    if (this.data.floatCta && this.data.floatCta.show) {
      this.setData({ 'floatCta.show': false });
    }
  },

  updateFloatCta() {
    const sp = this.data.setPage;
    if (!sp || !this._spObs) return;
    const show = sp.cta.kind === 'brand' && this._spScrolled && !this._spTailVisible;
    if (show !== !!(this.data.floatCta && this.data.floatCta.show)) {
      this.setData({ 'floatCta.show': show });
    }
  },

  toggleFollow(e) {
    const creator = e.currentTarget.dataset.creator;
    const S = this.S;
    S.follow[creator] = !S.follow[creator];
    this.toast(S.follow[creator] ? `已关注 @${creator}。` : '已取消关注。');
    this.renderSetPage();
    if (this.data.page === 'author') this.renderAuthor();
  },

  mainAct() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const v = setVM(s);
    if (v.act === 'draw') this.startDraw(s.id);
    else if (v.act === 'paywall') this.openPay(s);
    else if (v.act === 'memorial') this.openDone(s.id);
    else if (v.act === 'record') this.openRecordAt(s.id, v.ridx, 'set');
  },

  openAuthorPage(e) {
    const d = e.currentTarget.dataset;
    this.S.author = d.name;
    this.S.authorFrom = d.from || 'home';
    this.renderAuthor();
    this.go('author');
  },

  goBackAuthor() {
    const from = this.S.authorFrom || 'home';
    if (from === 'set') this.renderSetPage();
    this.go(from);
  },

  /* ──────────────────────────────────────────────────────────
     抽卡 / 信封
     ────────────────────────────────────────────────────────── */
  startDraw(sid) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    if (setVM(s).act !== 'draw') return;
    S.cur = s.id;
    this.renderDraw();
    this.go('draw');
  },

  /* ══════════════ 抽卡页 · 三组法则 ══════════════ */
  _dwFront(s, idx) {
    const RAR = { N: '#43A585', R: '#4E9ED9', SR: '#E2A236', SSR: '#D9A227' };
    const c = (s.pool || [])[idx] || {};
    const n = (c.w || '').length;
    return {
      word: c.w || '·',
      rarColor: RAR[c.r || 'N'] || RAR.N,
      wordCls: n >= 7 ? 'l7' : (n >= 5 ? 'l5' : 'l4'),
      serial: 'No.' + pad2(idx + 1),
    };
  },

  _dwBack(s, idx) {
    const b = this.buildCardBack(s, idx, 'draw');
    return {
      no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
      explain: b.explain,
      creator: b.creator,
      title: b.title,
      note: b.rec ? b.rec.note : '',
      img: b.rec ? b.rec.img : '',
      date: b.rec ? b.rec.date : '',
      count: b.rec ? b.rec.count : 0,
      stampAnim: !!b.stampAnim,
    };
  },

  renderDraw() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const u = s.user || {};
    const pool = s.pool || [];
    const count = s.count || pool.length;
    const got = u.got || [];
    const isResident = s.type === 'resident';
    const done = !isResident && count > 0 && got.length >= count;
    const stage = (u.todayDrawn || u.trialToday) ? 'after' : 'draw';
    const hasRec = stage === 'after' && u.todayIdx != null
      && !!(u.recs && u.recs[u.todayIdx] != null);

    let cta, cta2 = null;
    if (done) {
      cta = { tap: 'booklet', kind: 'gold', text: '✦ 翻开纪念册' };
      cta2 = { tap: 'home', kind: 'ghost', text: '回到这一集' };
    } else if (stage === 'draw') {
      if (!got.length && !u.trialUsed && !isResident && s.price > 0) {
        cta = { tap: 'draw', kind: 'brand', text: '拆第一封' };
      } else if (isResident) {
        cta = { tap: 'draw', kind: 'brand', text: got.length ? '今天再抽一封' : '拆第一封' };
      } else {
        cta = { tap: 'draw', kind: 'brand', text: '拆今天这一封' };
      }
    } else if (hasRec) {
      cta = { tap: 'share', kind: 'brand', text: '分享这张明信片' };
      cta2 = { tap: 'view', kind: 'ghost', text: '看看今天的卡' };
    } else {
      cta = { tap: 'stamp', kind: 'brand', text: '补盖今天的邮戳' };
    }

    const prev = this.data.draw || {};
    const backIdx = stage === 'after' && u.todayIdx != null ? u.todayIdx : -1;
    let back = prev.back || null;
    let front = prev.front || null;
    let flipped = !!prev.flipped;
    if (backIdx >= 0 && (!back || prev.backIdx !== backIdx || prev.sid !== s.id)) {
      back = this._dwBack(s, backIdx);
      front = this._dwFront(s, backIdx);
      flipped = false;
    }

    this.setData({
      draw: {
        sid: s.id,
        stage,
        done,
        hint: stage === 'draw' ? '轻触信封 · 拆今天这一封' : '轻触卡面 · 翻到另一面',
        envelope: {
          coverChar: (s.covT || s.title || '·').slice(0, 1),
          meta: count + ' 张' + (s.creator ? ' · @' + s.creator : ''),
        },
        cta, cta2, back, front, flipped, backIdx,
      },
    });
  },

  tapEnvelope() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const d = this.data.draw || {};
    if (d.stage === 'opening') return;
    const u = s.user || {};
    if (u.todayDrawn || u.trialToday) { this.tapCard(); return; }
    const count = s.count || s.pool.length;
    if (s.type !== 'resident' && (u.got || []).length >= count) {
      this.openDoneView();
      return;
    }
    this.setData({ 'draw.stage': 'opening', 'draw.hint': '' });
    clearTimeout(this._drawTimer);
    this._drawTimer = setTimeout(() => this._resolveDrawnCard(s), 920);
  },

  _resolveDrawnCard(s) {
    const S = this.S;
    const u = s.user || (s.user = {
      drawn: 0, trialUsed: 0, unlocked: s.price === 0 || s.creator === ME,
      todayDrawn: false, got: [], recs: {},
    });
    if (!u.recs) u.recs = {};
    const isResident = s.type === 'resident';
    const paid = s.price > 0 && s.creator !== ME;
    const trial = paid && !u.unlocked && (u.trialUsed || 0) < s.trial;
    let idx = 0;
    if (isResident) {
      idx = Math.floor(Math.random() * s.pool.length);
    } else {
      const got = u.got || [];
      const left = s.pool.map((_, i) => i).filter(i => !got.includes(i));
      if (!left.length) { this.openDoneView(); return; }
      idx = left[Math.floor(Math.random() * left.length)];
    }
    if (trial) {
      u.trialUsed = (u.trialUsed || 0) + 1;
      u.trialToday = true;
    } else {
      u.todayDrawn = true;
    }
    u.todayIdx = idx;
    if (!u.got) u.got = [];
    if (!u.got.includes(idx)) u.got.push(idx);
    u.drawn = (u.drawn || 0) + 1;
    if (!isResident) {
      if (!u.drawnLog) u.drawnLog = [];
      u.drawnLog.push({ idx, date: todayMD(), ts: Date.now() });
    }
    if (s.creator === ME) s.totalDrawn = (s.totalDrawn || 0) + 1;

    this.renderDraw();
    this.renderHome();
    this.renderSubs();
    this.renderMe();

    const count = s.count || s.pool.length;
    if (!isResident && (u.got || []).length >= count) {
      setTimeout(() => this.openDoneView(), 600);
    }
  },

  tapCard() {
    const d = this.data.draw;
    if (!d || d.stage !== 'after') return;
    this.setData({ 'draw.flipped': !d.flipped });
  },

  tapDrawCta(e) {
    const d = this.data.draw;
    if (!d) return;
    const c = e.currentTarget.dataset.act === 'cta2' ? d.cta2 : d.cta;
    if (!c) return;
    const S = this.S;
    const u = (S.sets.find(x => x.id === S.cur) || {}).user || {};
    switch (c.tap) {
      case 'draw': this.tapEnvelope(); break;
      case 'stamp': this.openRecordDraw(); break;
      case 'view': this.showBigCard(S.cur, u.todayIdx || 0); break;
      case 'share':
        this.openPoster({ currentTarget: { dataset: { type: 'card', sid: S.cur, idx: u.todayIdx } } });
        break;
      case 'booklet':
        this.openPoster({ currentTarget: { dataset: { type: 'memorial', sid: S.cur } } });
        break;
      case 'home': this.goSetView(S.cur); break;
    }
  },

  openRecordDraw() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    const u = s.user || {};
    if (u.todayIdx == null) return;
    this.openRecordAt(s.id, u.todayIdx, 'draw');
  },

  goSetView(id) {
    if (id != null) this.S.cur = id;
    this.renderSetPage();
    this.go('set');
  },

  setupDrawPage(s) {
    const S = this.S;
    const D = S.draw;
    const collect = s.type === 'collect';
    const card = D.card;
    const trialText = D.trial ? `${s.title} · 今日免费试抽` : `${s.title} · 每日一签`;
    this.setData({
      draw: {
        head: collect ? '今天的卡' : '今天的签',
        topL: collect ? `第 ${D.next} 张` : '今天的签',
        topR: trialText,
        settle: s.title,
        no: `No.${pad2(D.idx + 1)} / ${s.pool.length}`,
        rar: card.r,
        rarColor: RARC[card.r] || RARC.N,
        word: card.w,
        wordCls: bwCls(card.w),
        lit: s.cat === 'reading',
        collect,
        envFrom: `@${s.creator} 寄`,
        hint: '轻触火漆 · 开启今天',
        stageClass: '',
        sealBroken: false,
        flipped: false,
        actionsShow: false,
        tail: collect ? '拆开信封，看看今天是哪一张。' : '抽到什么，就是什么。\n今天的纠结，到此为止。',
        back: this.buildCardBack(s, D.idx, 'draw'),
        // V2.5 · 动作区占位（信封开启后由 computeDrawActions 定稿）
        primaryText: '盖个邮戳 · 记录今天',
        primaryKind: 'stamp',
        showShareBtn: true,
        weeklyReady: false,
      },
    });
  },

  openEnvelope() {
    const S = this.S;
    if (!S.draw || S.mailOpening) return;
    S.mailOpening = true;
    const D = S.draw;
    const s = S.sets.find(x => x.id === D.sid);
    if (!s) return;

    this.setData({
      'draw.sealBroken': true,
      'draw.hint': '轻触火漆 · 开启今天',
    });
    const timers = S.envelopeTimers = [];
    timers.push(setTimeout(() => {
      if (this.data.page !== 'draw') return;
      this.setData({ 'draw.stageClass': 'flap-open' });
    }, 180));
    timers.push(setTimeout(() => {
      if (this.data.page !== 'draw') return;
      this.setData({ 'draw.stageClass': 'flap-open revealed' });
    }, 500));
    timers.push(setTimeout(() => {
      if (this.data.page !== 'draw') return;
      this.setData({
        'draw.stageClass': 'flap-open revealed done',
        'draw.hint': '轻触卡面 · 翻过来看看',
        'draw.actionsShow': true,
      });
      this.computeDrawActions();        // ← 改动：动作区在此定稿（状态已同步落库）
      S.mailOpening = false;
    }, 920));

    // 业务状态：与原型一致，开启信封即记账
    if (!s.user) {
      s.user = { drawn: 0, trialUsed: 0, unlocked: s.price === 0 || s.creator === ME, todayDrawn: false, got: [] };
    }
    const u = s.user;
    if (D.trial) {
      u.trialUsed = (u.trialUsed || 0) + 1;
      u.trialToday = true;
    } else {
      u.todayDrawn = true;
      u.todayIdx = D.idx;
    }
    if (s.type === 'collect') {
      u.drawn++;
      if (!u.got) u.got = [];
      if (!u.got.includes(D.idx)) {
        u.got.push(D.idx);
        // V2.5 · 周记数据：collect 每次抽卡追加一条，服务周记/streak
        (u.drawnLog = u.drawnLog || []).push({ idx: D.idx, date: todayMD(), ts: Date.now() });
      }
    }
    if (s.creator === ME) s.totalDrawn = (s.totalDrawn || 0) + 1;

    // V2.5 · tail 与主行动统一由 computeDrawActions 计算（920ms 定稿时调用）
    this.renderHome();
    this.renderSubs();
    this.renderMe();
    this.renderSetPage();
  },

  flipCard() {
    if (!this.S.draw) return;
    this.setData({ 'draw.flipped': !this.data.draw.flipped });
  },

  /* ── V2.5 动作区状态机：信封开启后 / 盖章后调用 ──
     stamp    盖个邮戳（默认主行动）
     share    已盖章，升级为分享明信片
     trial    试抽还有余额（当前 trial=1 不会出现，为多试抽预留）
     unlock   试抽用尽，转化时机
     memorial 本张抽空了全图                                   */
  computeDrawActions() {
    const S = this.S;
    const D = S.draw;
    if (!D) return;
    const s = S.sets.find(x => x.id === D.sid);
    if (!s) return;
    const u = s.user || {};

    let primaryKind = 'stamp';
    let primaryText = '';
    let tail = '';

    if (s.type === 'collect' && (u.got || []).length >= s.pool.length) {
      primaryKind = 'memorial';
      primaryText = '集齐啦 · 看纪念册';
      tail = '这是最后一张 · 全图点亮，去纪念册看看吧';
    } else if (D.trial) {
      if ((u.trialUsed || 0) < s.trial) {
        primaryKind = 'trial';
        primaryText = `再试一张 · 还剩 ${s.trial - (u.trialUsed || 0)} 张`;
        tail = '试抽免费，不占每日额度';
      } else {
        primaryKind = 'unlock';
        primaryText = `解锁全集 · ¥${s.price}`;
        tail = '试抽结束 · 解锁后每天继续';
      }
    } else if (getRec(u, D.idx)) {
      primaryKind = 'share';
      primaryText = '分享这张明信片';
      tail = '✓ 今天的邮戳已盖好，这张卡现在是明信片了';
    } else if (s.type === 'collect') {
      primaryKind = 'stamp';
      primaryText = '盖个邮戳 · 记录今天';
      const rest = Math.max(0, s.pool.length - (u.got || []).length);
      tail = `已收进卡包 · 还剩 ${rest} 张，明天继续`;
    } else {
      primaryKind = 'stamp';
      primaryText = '盖个邮戳 · 记录今天';
      tail = '抽到什么，就是什么。\n今天的纠结，到此为止。';
    }

    this.setData({
      'draw.primaryKind': primaryKind,
      'draw.primaryText': primaryText,
      'draw.showShareBtn': primaryKind !== 'share',
      'draw.tail': tail,
      'draw.weeklyReady': !!this.weeklyForSet(s),
    });
  },

  drawPrimaryAction() {
    const S = this.S;
    const D = S.draw;
    if (!D) return;
    const s = S.sets.find(x => x.id === D.sid);
    if (!s) return;
    const kind = this.data.draw.primaryKind;
    if (kind === 'stamp') {
      this.openRecordAt(s.id, D.idx, 'draw');
    } else if (kind === 'share') {
      this.openPoster();                 // 无参调用，openPoster 内部默认 type='draw'
    } else if (kind === 'trial') {
      this.startDraw(s.id);              // 直接重抽，信封完整重播，不再绕详情页
    } else if (kind === 'unlock') {
      this.openPay(s);                   // 解锁成功后既有逻辑会送一张并重进抽卡
    } else if (kind === 'memorial') {
      this.openDone(s.id);
    }
  },

  /* ──────────────────────────────────────────────────────────
     卡背（回信 / 明信片）
     ────────────────────────────────────────────────────────── */
  buildCardBack(s, idx, from) {
    const rec = getRec(s.user, idx);
    const card = s.pool[idx] || { w: '', b: '', r: 'N' };
    return {
      sid: s.id,
      idx,
      from,
      explain: card.b,
      creator: s.creator,
      title: s.title,
      stampAnim: false,
      rec: rec ? {
        img: rec.img || '',
        note: rec.note || '',
        date: rec.date || '',
        stampDate: stampDate(rec.date),
        count: recCount(s.user, idx),
        resident: s.type === 'resident',
      } : null,
    };
  },

  /* ──────────────────────────────────────────────────────────
     付费墙
     ────────────────────────────────────────────────────────── */
  openPay(s) {
    this.S.pw = s.id;
    this.setData({
      pay: {
        show: true,
        paying: false,
        title: `《${s.title}》`,
        line: `全集 ${s.count} 张 · 一次解锁，永久有效`,
        body: s.type === 'collect'
          ? `@${s.creator} 的作品。解锁后每天一签，直到集齐，中途不再收费。`
          : `@${s.creator} 的作品。解锁后每天一签，抽到就是答案。`,
        price: s.price,
        payText: `解锁 · ¥${s.price}`,
      },
    });
  },

  closePay() {
    const S = this.S;
    clearTimeout(S.unlockTimer);
    S.pw = null;
    this.setData({ 'pay.show': false, 'pay.paying': false });
  },

  doUnlock() {
    const S = this.S;
    if (!S.pw || this.data.pay.paying) return;
    const targetId = S.pw;
    this.setData({ 'pay.paying': true, 'pay.payText': '支付中…' });
    S.unlockTimer = setTimeout(() => {
      if (!S.pw || S.pw !== targetId) return;
      const s = S.sets.find(x => x.id === targetId);
      if (!s) { this.setData({ 'pay.show': false }); return; }
      S.pw = null;
      if (!s.user) {
        s.user = { drawn: 0, trialUsed: 0, unlocked: true, todayDrawn: false, got: [] };
      }
      s.user.unlocked = true;
      this.setData({ 'pay.show': false, 'pay.paying': false });
      this.renderHome();
      this.renderSubs();
      this.renderMe();
      this.renderSetPage();
      if (!s.user.todayDrawn && setVM(s).act === 'draw') {
        this.toast('解锁成功，这张签送你。');
        setTimeout(() => this.startDraw(s.id), 260);
      } else {
        this.toast('已解锁。今天的卡，明天 0 点到。');
      }
    }, 900);
  },

  /* ──────────────────────────────────────────────────────────
     全图
     ────────────────────────────────────────────────────────── */
  openMap(e) {
    const S = this.S;
    const id = e && e.currentTarget && e.currentTarget.dataset.id != null
      ? Number(e.currentTarget.dataset.id) : S.cur;
    S.cur = id;
    this.renderMap();
    this.go('map');
  },

  renderMap() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const u = s.user;
    const got = (u && u.got) ? u.got : [];
    const cells = s.pool.map((c, i) => {
      if (got.includes(i)) {
        const rec = getRec(u, i);
        return { dark: false, word: c.w, rar: c.r, idx: i, sid: s.id, badge: rec ? 'rec' : 'cam' };
      }
      return { dark: true, word: '?', rar: '', idx: i, sid: s.id, badge: '' };
    });
    this.setData({
      mapV: {
        cells,
        drawn: u ? u.drawn : 0,
        count: s.count,
        pct: u ? (u.drawn / s.count * 100).toFixed(1) : 0,
      },
    });
  },

  openBigCard(e) {
    const d = e.currentTarget.dataset;
    const sid = Number(d.sid);
    const idx = Number(d.idx);
    this.showBigCard(sid, idx);
  },

  mapCellTap(e) {
    const d = e.currentTarget.dataset;
    const idx = Number(d && d.idx);
    const cell = (this.data.mapV.cells || [])[idx];
    if (!cell || cell.dark) return;
    this.showBigCard(Number(cell.sid), idx);
  },

  setMapTap(e) {
    const d = e.currentTarget.dataset;
    if (d && String(d.dark) === 'true') return;
    this.showBigCard(Number(d.sid), Number(d.idx));
  },

  showBigCard(sid, idx, opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    const c = s.pool[idx];
    if (!c) return;
    S.posterCtx = { sid, idx };
    const back = this.buildCardBack(s, idx, 'big');
    if (opts.stampAnim) back.stampAnim = true;
    this.setData({
      bigCard: {
        show: true,
        flipped: !!opts.flipped,
        rar: c.r,
        rarColor: RARC[c.r] || RARC.N,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        word: c.w,
        wordCls: bwCls(c.w),
        settitle: `《${s.title}》`,
        lit: s.cat === 'reading',
        back,
      },
    });
  },

  toggleBigCardFlip() {
    this.setData({ 'bigCard.flipped': !this.data.bigCard.flipped });
  },

  closeBigCard() {
    this.setData({ 'bigCard.show': false, 'bigCard.flipped': false });
  },

  /* ──────────────────────────────────────────────────────────
     抽空纪念
     ────────────────────────────────────────────────────────── */
  openDone(id) {
    this.S.cur = id;
    this.openDoneView();
  },

  /* ── 抽空页 · 金色时刻（全屏接管） ── */
  renderDone() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const u = s.user || {};
    const got = u.got || [];
    const count = s.count || (s.pool || []).length;

    /* 点阵行列：先按可用高度定行数，再出列数（4/6/8 档） */
    const vp = getViewport();
    const CELL = 22;
    const availH = Math.max(180, vp.h - 330);
    let rows = Math.max(1, Math.floor(availH / CELL));
    if (rows > 6) rows = 6;
    let cols = Math.ceil(count / rows);
    if (cols > 8) { cols = 8; rows = Math.ceil(count / 8); }
    if (cols < 4) cols = 4;
    const cells = [];
    for (let i = 0; i < rows * cols; i++) cells.push({ i, on: i < count });

    const stamps = got.filter(i => {
      const r = u.recs && u.recs[i];
      return Array.isArray(r) ? r.length > 0 : !!r;
    }).length;
    const log = u.drawnLog || [];
    let days = Math.max(1, got.length);
    if (log.length >= 2) {
      days = Math.max(1, Math.round((log[log.length - 1].ts - log[0].ts) / 86400000) + 1);
    }

    clearTimeout(this._doneTimer);
    this.setData({
      donePage: {
        show: false, ctaShow: false,
        eyebrow: '全部点亮 · 完整图鉴',
        title: s.title || '',
        count, days, stamps, cols, cells,
        note: count + ' 张 · ' + days + ' 天 · ' + stamps + ' 枚邮戳',
      },
    });
    setTimeout(() => this.setData({ 'donePage.show': true }), 30);
    this._doneTimer = setTimeout(() => {
      this.setData({ 'donePage.ctaShow': true });
    }, 1200);
  },

  openDoneView() {
    this.renderDone();
  },

  closeDone() {
    clearTimeout(this._doneTimer);
    this._doneTimer = null;
    this.setData({ 'donePage.show': false, 'donePage.ctaShow': false });
  },

  tapDoneAction(e) {
    const act = e.currentTarget.dataset.act;
    if (act === 'booklet') {
      this.openPoster({ currentTarget: { dataset: { type: 'memorial', sid: this.S.cur } } });
    } else if (act === 'back') {
      this.closeDone();
      this.goSetView(this.S.cur);
    }
  },

  /* ══════════════ 订阅页 · 纸面直排 ══════════════ */
  _subHasRec(u, idx) {
    if (!u || !u.recs || idx == null || !(idx in u.recs)) return false;
    const r = u.recs[idx];
    return Array.isArray(r) ? r.length > 0 : !!r;
  },

  /* ──────────────────────────────────────────────────────────
     订阅页 v2：行动提醒卡 + 统计 + 三组卡片
     ────────────────────────────────────────────────────────── */
  renderSubs() {
    const now = new Date();
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    const subs = (this.S.sets || []).filter(s => s.user);
    const today = [], subscribed = [], doneRows = [];
    let waitingN = 0, cardsN = 0, emptied = 0;

    subs.forEach(s => {
      const u = s.user || {};
      const res = s.type === 'resident';
      const count = s.count || (s.pool || []).length;
      const got = (u.got || []).length;
      const v = setVM(s);
      cardsN += (u.drawn || 0);
      const doneSet = !res && count > 0 && got >= count;
      if (doneSet) emptied++;
      const todayIdx = u.todayIdx != null ? u.todayIdx
        : (u.todayDrawn && (u.got || []).length ? u.got[u.got.length - 1] : null);
      const waiting = u.todayDrawn && !this._hmHasRec(u, todayIdx);
      if (waiting) waitingN++;
      const cov = (s.covT || s.title || '·');
      const row = {
        id: s.id,
        title: s.title || '',
        charA: cov.slice(0, 1),
        charB: cov.slice(1, 2) || '',
        idx: todayIdx,
        prog: res ? '已拆 ' + (u.drawn || 0) + ' 封' : (doneSet ? count + ' 张' : got + ' / ' + count),
        waiting,
      };
      if (doneSet) {
        doneRows.push(Object.assign(row, { status: '已集齐', statusCls: 'gold', tap: 'booklet', todo: false }));
      } else if (u.todayDrawn) {
        if (waiting) {
          subscribed.push(Object.assign(row, { status: '等你回信', statusCls: 'wait', tap: 'stamp', todo: true }));
        } else {
          subscribed.push(Object.assign(row, { status: '已盖戳', statusCls: 'quiet', tap: 'big', todo: false }));
        }
      } else {
        const locked = v.act === 'paywall';
        today.push(Object.assign(row, {
          status: locked ? '待解锁 · ¥' + s.price : (res ? '今日可抽' : '今天的信到了'),
          statusCls: 'go', tap: 'draw', todo: true,
        }));
      }
    });
    /* 组内排序：可抽在前 / 等回信在前 */
    today.sort((a, b) => (b.todo ? 1 : 0) - (a.todo ? 1 : 0));
    subscribed.sort((a, b) => (b.waiting ? 1 : 0) - (a.waiting ? 1 : 0));
    const firstDraw = today.length ? today[0] : null;
    const firstWait = subscribed.find(r => r.waiting) || null;

    let weekly = null;
    subs.forEach(s => {
      if (weekly) return;
      const w = this.weeklyForSet(s);
      if (w) weekly = { sid: s.id, title: s.title, weekNo: w.weekNo };
    });

    this.setData({ subs: {
      date: (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + wd,
      total: subs.length,
      remindDraw: firstDraw ? { n: today.length, sid: firstDraw.id } : null,
      remindStamp: firstWait ? { n: waitingN, sid: firstWait.id, idx: firstWait.idx } : null,
      statCan: today.length,
      statCards: cardsN,
      statEmpty: emptied,
      today, subscribed, done: doneRows,
      weekly,
    }});
  },

  /* 提醒卡直达动作 */
  tapRemindDraw() {
    const r = this.data.subs.remindDraw;
    if (r) this.goSubsDraw(r.sid, 'cards');
  },

  tapRemindStamp() {
    const r = this.data.subs.remindStamp;
    if (!r) return;
    this.S.cur = r.sid;
    this.openRecordAt(r.sid, r.idx, 'cards');
  },

  tapSubsRow(e) {
    const d = e.currentTarget.dataset;
    const sid = Number(d.sid);
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    const from = d.from || 'cards';
    const u = s.user || {};
    if (d.tap === 'stamp') {
      const idx = d.idx != null ? Number(d.idx)
        : (u.todayIdx != null ? u.todayIdx
          : (u.todayDrawn && u.got && u.got.length ? u.got[u.got.length - 1] : null));
      if (idx == null) return;
      this.S.cur = sid;
      this.S.cameFrom = from;
      this.openRecordAt(sid, idx, from);
    } else if (d.tap === 'draw') {
      this.goSubsDraw(sid, from);
    } else {
      this.goSubsView(sid, from);
    }
  },

  goSubsDraw(sid, from) {
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    this.S.cur = sid;
    this.S.cameFrom = from || 'cards';
    if (setVM(s).act === 'draw') this.startDraw(sid);
    else this.mainAct();
  },

  goSubsView(sid, from) {
    this.S.cameFrom = from || 'cards';
    this.goSetView(sid);
  },

  tapSubsBrowse() {
    this.go('home');
  },

  /* ══════════════ 我的 · 收藏册 ══════════════ */
  renderMine() {
    const sets = this.S.sets || [];
    let lit = 0, stamps = 0, subCount = 0;
    const doneCovers = [], notes = [];
    const recDates = {};
    sets.forEach(s => {
      const u = s.user;
      if (!u) return;
      subCount++;
      const pool = s.pool || [];
      const count = s.count || pool.length;
      const got = u.got || [];
      lit += got.length;
      const isDone = s.type !== 'resident' && count > 0 && got.length >= count;
      if (isDone) {
        const log = u.drawnLog || [];
        const days = log.length >= 2
          ? Math.max(1, Math.round((log[log.length - 1].ts - log[0].ts) / 86400000) + 1)
          : Math.max(1, got.length);
        doneCovers.push({
          id: s.id, title: s.title || '',
          coverChar: (s.covT || s.title || '·').slice(0, 1),
          meta: `${count} 张 · ${days} 天`,
        });
      }
      const recs = u.recs || {};
      Object.keys(recs).forEach(k => {
        const r = recs[k];
        const arr = Array.isArray(r) ? r : (r ? [r] : []);
        arr.forEach((rec, ri) => {
          if (!rec) return;
          if (rec.note || rec.img) {
            stamps++;
            if (rec.date) recDates[rec.date] = 1;
          }
          if (rec.note && rec.note.trim() && pool[k]) {
            notes.push({
              key: s.id + ':' + k + ':' + ri,
              sid: s.id, idx: Number(k),
              setTitle: s.title || '',
              word: (pool[k] || {}).w || '·',
              note: rec.note.trim(),
              date: rec.date || '',
              len: rec.note.trim().length,
            });
          }
        });
      });
    });

    let days = Object.keys(recDates).length;
    if (!days) {
      const dl = {};
      sets.forEach(s => {
        ((s.user && s.user.drawnLog) || []).forEach(e => {
          if (e && e.ts) dl[new Date(e.ts).toDateString()] = 1;
        });
      });
      days = Object.keys(dl).length;
    }
    if (!days && (lit || stamps)) days = 1;

    notes.sort((a, b) => b.len - a.len);
    notes.splice(2);

    this.setData({
      mine: {
        empty: !subCount,
        days, lit, stamps,
        done: doneCovers,
        ongoingCount: subCount - doneCovers.length,
        notes,
      },
    });
  },

  tapMineCover(e) {
    const sid = Number(e.currentTarget.dataset.sid);
    this.openPoster({ currentTarget: { dataset: { type: 'memorial', sid } } });
  },

  tapMineNote(e) {
    const d = e.currentTarget.dataset;
    this.showBigCard(Number(d.sid), Number(d.idx));
  },

  tapMineBrowse() {
    this.go('home');
  },

  browseBooklet(e) {
    const variant = e.currentTarget.dataset.variant;
    this.openBooklet(variant);
  },

  /* ──────────────────────────────────────────────────────────
     订阅页
     ────────────────────────────────────────────────────────── */
  renderCards() {
    const S = this.S;
    if (S.mode === 'new') {
      this.setData({ cards: { isNew: true, date: getTodayStr(), groups: [] } });
      return;
    }
    const mine = S.sets.filter(s => s.user);
    const collectMine = mine.filter(s => s.type === 'collect');
    const drawn = collectMine.reduce((a, s) => a + (s.user.drawn || 0), 0);
    const todayCan = S.sets.filter(s => setVM(s).act === 'draw').length;
    const emptied = collectMine.filter(s => s.user.drawn >= s.count).length;
    const pending = mine.filter(s => !s.user.todayDrawn && setVM(s).act === 'draw').length;

    const recPend = [];
    S.sets.forEach(s => {
      if (s.user && hasRecPending(s)) recPend.push({ sid: s.id, ridx: todayIdxOf(s) });
    });

    const readyCards = mine.filter(s => {
      const v = setVM(s);
      return !s.user.todayDrawn && v.act === 'draw';
    });
    const doneCards = mine.filter(s => s.type === 'collect' && s.user.drawn >= s.count);
    const waitCards = mine.filter(s => {
      const v = setVM(s);
      return s.user.todayDrawn || (s.type === 'collect' && s.user.drawn < s.count && v.act !== 'draw');
    }).filter(s => !doneCards.includes(s));

    const groups = [];
    if (readyCards.length > 0) {
      groups.push({
        name: '今日可抽', count: readyCards.length, showDot: true,
        cards: readyCards.map(s => this.buildSubCard(s, true, false)),
      });
    }
    if (waitCards.length > 0) {
      groups.push({
        name: '已订阅', count: waitCards.length, showDot: false,
        cards: waitCards.map(s => this.buildSubCard(s, false, false)),
      });
    }
    if (doneCards.length > 0) {
      groups.push({
        name: '已抽空', count: doneCards.length, showDot: false,
        cards: doneCards.map(s => this.buildSubCard(s, false, true)),
      });
    }

    let weeklyEntry = null;
    S.sets.forEach(s => {
      if (weeklyEntry || !s.user) return;
      const w = this.weeklyForSet(s);
      if (w) weeklyEntry = { sid: s.id, title: s.title, weekNo: w.weekNo };
    });

    this.setData({
      cards: {
        isNew: false,
        date: getTodayStr(),
        todayCan,
        drawn,
        emptied,
        pending,
        recPend,
        recFirst: recPend[0] || null,
        weeklyEntry,
        groups,
      },
    });
  },

  buildSubCard(s, isReady, isDone) {
    const v = setVM(s);
    const st = stampedCount(s);
    const progress = s.type === 'collect' && s.user
      ? `${s.user.drawn}/${s.count} 张${st > 0 ? ` · 已盖 ${st}` : ''}`
      : '常驻集 · 天天可抽';
    let statusText;
    if (isDone) statusText = '已抽空 · 查看纪念';
    else if (isReady) statusText = '今日可抽';
    else if (s.user.todayDrawn) {
      statusText = hasRecPending(s) ? '今日已抽 · 等你回信' : '今日已抽 · 0点再来';
    } else statusText = v.text;
    return {
      id: s.id,
      title: s.title,
      cover: s.cover,
      covT2: s.covT.slice(0, 2),
      statusText,
      statusDot: isDone ? 'done' : (isReady ? 'ready' : 'wait'),
      progress,
      isReady,
      isDone,
    };
  },

  openPendingDraw() {
    this.go('home');
  },

  openPendingRecord() {
    const c = this.data.cards.recFirst;
    if (c) this.openRecordAt(c.sid, c.ridx, 'cards');
  },

  /* ──────────────────────────────────────────────────────────
     创作中心
     ────────────────────────────────────────────────────────── */
  renderCraft() {
    const S = this.S;
    const pub = S.sets.filter(s => s.creator === ME);
    if (S.craftEmptyView || (!pub.length && !S.craft.reviewing.length && !S.craft.drafts.length)) {
      this.setData({ craft: { empty: true, groups: [] } });
      return;
    }
    const earn = this.ownEarn();
    const rvRows = S.craft.reviewing.map(d => {
      const complete = d.pool.filter(cardDone).length;
      return {
        id: d.id,
        title: (d.title || '').trim() || '未命名',
        meta: `${complete} 张完整 · 提交于 ${d.submitted || ''}`,
        badge: 'review',
        badgeText: '审核中',
      };
    });
    const drRows = S.craft.drafts.map(d => {
      const complete = d.pool.filter(cardDone).length;
      const total = Math.max(d.pool.length, 8);
      const pct = Math.round(complete / total * 100);
      return {
        id: d.id,
        title: (d.title || '').trim() || '未命名草稿',
        meta: `${complete}/${total} 张完整 · 完成度 ${pct}%`,
        badge: 'draft',
        badgeText: '草稿',
      };
    });
    const pubRows = pub.map(s => ({
      id: s.id,
      title: s.title,
      meta: `被抽 ${fmt(s.totalDrawn || 0)} 次${s.earn ? ` · 收益 ¥${s.earn.toFixed(2)}` : ''}`,
      badge: 'pub',
      badgeText: '已上架',
    }));
    const groups = [];
    if (rvRows.length) groups.push({ name: '审核中', status: 'review', count: rvRows.length, rows: rvRows, kind: 'review' });
    if (drRows.length) groups.push({ name: '草稿', status: 'draft', count: drRows.length, rows: drRows, kind: 'draft' });
    if (pubRows.length) groups.push({ name: '已上架', status: 'pub', count: pubRows.length, rows: pubRows, kind: 'pub' });
    this.setData({
      craft: {
        empty: false,
        pubN: pub.length,
        reviewN: S.craft.reviewing.length,
        draftN: S.craft.drafts.length,
        earn,
        incomeText: `¥${earn.toFixed(2)}`,
        groups,
      },
    });
  },

  newCraft() {
    const S = this.S;
    S.craftEmptyView = false;
    const d = {
      id: ++S.seq, title: '', intro: '', type: 'collect', cat: 'create', price: 0, trial: 0, status: 'draft',
      pool: ['N', 'N', 'N', 'R', 'R', 'N', 'SR', 'SSR'].map(r => ({ w: '', r, b: '' })),
    };
    S.craft.drafts.push(d);
    this.openEdit(d.id);
  },

  openEdit(id) {
    const S = this.S;
    const d = S.craft.drafts.find(x => x.id === Number(id));
    if (!d) { this.go('create'); return; }
    S.ed = d;
    S.rv = null;
    S.edOpen = d.pool.length ? 0 : null;
    this.renderEdit();
    this.go('edit');
  },

  renderEdit() {
    const S = this.S;
    const d = S.ed;
    if (!d) return;
    const complete = d.pool.filter(cardDone).length;
    const rarStat = this.rarStatText(d.pool);
    const cards = d.pool.map((c, i) => ({
      index: i,
      badge: c.r || '？',
      rar: c.r || '',
      w: c.w || '',
      b: c.b || '',
      label: (c.w || '').trim() || '未命名',
      blank: !(c.w || '').trim(),
      cnt: ((c.w || '').trim() ? 1 : 0) + ((c.b || '').trim() ? 1 : 0),
      open: S.edOpen === i,
    }));
    this.setData({
      edit: {
        mode: 'edit',
        headTitle: '编辑卡集',
        title: d.title || '',
        intro: d.intro || '',
        type: d.type,
        cat: d.cat,
        price: d.price,
        cats: HM_CATS.map(c => ({ key: c.key, chip: c.chip })),
        prices: [0, 6, 12, 19],
        rarKeys: RAR_KEYS.slice(),
        complete,
        countText: `卡 · ${complete} 张完整`,
        rarStat,
        cards,
        footerTitle: (d.title || '').trim() || '未命名',
      },
    });
  },

  rarStatText(pool) {
    const rs = RAR_KEYS.map(k => {
      const n = pool.filter(c => cardDone(c) && c.r === k).length;
      return n ? `${k} ${n}` : '';
    }).filter(Boolean).join(' · ');
    return rs || '还没有完整的卡';
  },

  onEditTitle(e) {
    if (!this.S.ed) return;
    this.S.ed.title = e.detail.value;
    this.setData({
      'edit.title': e.detail.value,
      'edit.footerTitle': (e.detail.value || '').trim() || '未命名',
    });
  },

  onEditIntro(e) {
    if (!this.S.ed) return;
    this.S.ed.intro = e.detail.value;
  },

  onEditCardInput(e) {
    const S = this.S;
    if (!S.ed) return;
    const i = Number(e.currentTarget.dataset.index);
    const key = e.currentTarget.dataset.key;
    const c = S.ed.pool[i];
    if (!c) return;
    c[key] = e.detail.value;
    const complete = S.ed.pool.filter(cardDone).length;
    const patch = {
      [`edit.cards[${i}].label`]: (c.w || '').trim() || '未命名',
      [`edit.cards[${i}].blank`]: !(c.w || '').trim(),
      [`edit.cards[${i}].cnt`]: ((c.w || '').trim() ? 1 : 0) + ((c.b || '').trim() ? 1 : 0),
      'edit.complete': complete,
      'edit.countText': `卡 · ${complete} 张完整`,
      'edit.rarStat': this.rarStatText(S.ed.pool),
    };
    this.setData(patch);
  },

  edType(e) {
    const S = this.S;
    S.ed.type = e.currentTarget.dataset.type;
    this.renderEdit();
  },

  edCat(e) {
    const S = this.S;
    S.ed.cat = e.currentTarget.dataset.cat;
    this.renderEdit();
  },

  edPrice(e) {
    const S = this.S;
    const p = Number(e.currentTarget.dataset.price);
    S.ed.price = p;
    S.ed.trial = p > 0 ? 1 : 0;
    this.renderEdit();
  },

  edToggle(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    S.edOpen = (S.edOpen === i ? null : i);
    this.renderEdit();
  },

  edCardRar(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    const r = e.currentTarget.dataset.rar;
    S.ed.pool[i].r = r;
    this.renderEdit();
  },

  edAddCard() {
    const S = this.S;
    S.ed.pool.push({ w: '', r: '', b: '' });
    S.edOpen = S.ed.pool.length - 1;
    this.renderEdit();
  },

  edDelCard(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    S.ed.pool.splice(i, 1);
    S.edOpen = null;
    this.renderEdit();
  },

  validateCraft(d) {
    const errs = [];
    if (!(d.title || '').trim() || d.title.trim().length < 2) errs.push('标题：至少 2 个字');
    if (!(d.intro || '').trim() || d.intro.trim().length < 10) errs.push('简介：至少 10 个字，给抽卡人一个预期');
    const complete = d.pool.filter(cardDone);
    if (complete.length < 8) errs.push(`完整的卡：至少 8 张，现在 ${complete.length} 张（词、稀有度、解释都齐才算完整）`);
    const long = d.pool.filter(c => (c.w || '').trim().length > 8);
    if (long.length) errs.push(`有 ${long.length} 张卡的词超过 8 个字`);
    if (d.price > 0 && d.trial !== 1) errs.push('定价卡集：需要 1 张免费试抽');
    return errs;
  },

  tryPublish() {
    const S = this.S;
    if (!S.ed) return;
    const errs = this.validateCraft(S.ed);
    if (errs.length) {
      this.setData({ check: { show: true, list: errs } });
      return;
    }
    const complete = S.ed.pool.filter(cardDone);
    this.setData({
      pub: {
        show: true,
        title: `《${S.ed.title.trim()}》`,
        meta: `${complete.length} 张 · ${S.ed.type === 'collect' ? '收藏集' : '常驻集'} · ${S.ed.price > 0 ? `¥${S.ed.price}（前 ${S.ed.trial} 张免费试抽）` : '免费'}`,
      },
    });
  },

  closeCheck() {
    this.setData({ 'check.show': false });
  },

  closePub() {
    this.setData({ 'pub.show': false });
  },

  doPublish() {
    const S = this.S;
    this.setData({ 'pub.show': false });
    if (!S.ed) return;
    const i = S.craft.drafts.indexOf(S.ed);
    if (i > -1) S.craft.drafts.splice(i, 1);
    S.ed.status = 'reviewing';
    S.ed.submitted = todayMD();
    S.craft.reviewing.push(S.ed);
    S.ed = null;
    this.toast('已提交审核。');
    this.renderCraft();
    this.go('create');
  },

  openReview(e) {
    const S = this.S;
    const id = Number(e.currentTarget.dataset.id);
    const d = S.craft.reviewing.find(x => x.id === id);
    if (!d) { this.go('create'); return; }
    S.rv = d;
    S.ed = null;
    this.renderReview();
    this.go('edit');
  },

  renderReview() {
    const S = this.S;
    const d = S.rv;
    if (!d) return;
    const complete = d.pool.filter(cardDone);
    const rarStat = RAR_KEYS.map(k => `${k} ${complete.filter(c => c.r === k).length}`).join(' · ');
    this.setData({
      edit: {
        mode: 'review',
        headTitle: '审核中',
        title: d.title,
        intro: d.intro,
        submitted: d.submitted || '',
        meta: `${d.type === 'collect' ? '收藏集' : '常驻集'} · ${catChipOf(d.cat)} · ${complete.length} 张 · ${d.price > 0 ? `¥${d.price}（前 ${d.trial} 张免费试抽）` : '免费'}`,
        rarStat,
        cards: complete.map(c => ({ badge: c.r, w: c.w, b: c.b })),
        count: complete.length,
      },
    });
  },

  passReview() {
    const S = this.S;
    if (!S.rv) return;
    const i = S.craft.reviewing.indexOf(S.rv);
    if (i < 0) return;
    S.craft.reviewing.splice(i, 1);
    const s = this.buildPublic(S.rv);
    S.authored.push(clone(s));
    S.sets.push(s);
    S.rv = null;
    this.toast('审核通过，已上架。去「发现」看看它。');
    this.renderHome();
    this.renderCraft();
    this.go('create');
  },

  buildPublic(d) {
    const S = this.S;
    const pool = d.pool.filter(cardDone).map(c => ({ w: c.w.trim(), r: c.r, b: c.b.trim() }));
    const rar = { N: 0, R: 0, SR: 0, SSR: 0 };
    pool.forEach(c => { if (rar[c.r] != null) rar[c.r]++; });
    const id = ++S.seq;
    return {
      id,
      title: d.title.trim(),
      covT: d.title.trim().slice(0, 8),
      covS: d.intro.trim().replace(/[，。、；！？…—\s]/g, '').slice(0, 7) || '认真做的',
      cover: 'c' + (id % 6 + 1),
      cat: d.cat, type: d.type, price: d.price, trial: d.price > 0 ? 1 : 0,
      count: pool.length, creator: ME, heat: 0, date: todayMD(),
      intro: d.intro.trim(), rar, pool, user: null,
      totalDrawn: 0, buyers: 0, earn: 0,
    };
  },

  toggleCraftEmpty() {
    const S = this.S;
    S.craftEmptyView = !S.craftEmptyView;
    this.renderCraft();
    this.setData({ demo: { mode: S.mode, craftEmpty: S.craftEmptyView } });
  },

  /* ──────────────────────────────────────────────────────────
     收益看板
     ────────────────────────────────────────────────────────── */
  renderIncome() {
    const S = this.S;
    const total = this.ownEarn();
    const avail = this.availEarn();
    const paidSets = S.sets.filter(s => s.creator === ME && s.price > 0 && (s.earn || 0) > 0);
    const buyersTotal = paidSets.reduce((a, s) => a + (s.buyers || 0), 0);
    const paidTotal = paidSets.reduce((a, s) => a + (s.earn || 0), 0);
    const platformTotal = Math.max(0, total - paidTotal);
    const threshold = S.income.threshold;
    const canWithdraw = avail >= threshold;
    const withdrawPct = Math.min(100, (avail / threshold) * 100);

    const bySet = paidSets.map(s => ({
      title: s.title,
      meta: `${s.buyers || 0} 人解锁 · ¥${s.price} · 份额 80%`,
      val: `¥${(s.earn || 0).toFixed(2)}`,
    }));
    const txns = S.txnSeed.map(t => ({
      d: t.d, meta: t.meta, amt: `+¥${t.amt.toFixed(2)}`,
      title: `平台激励 · ${t.t}`,
    }));

    this.setData({
      income: {
        exists: true,
        totalText: `¥${total.toFixed(2)}`,
        availText: `¥${avail.toFixed(2)}`,
        pendingText: `¥${S.income.pending.toFixed(2)}`,
        withdrawnText: `¥${S.income.withdrawn.toFixed(2)}`,
        platformText: `¥${platformTotal.toFixed(2)}`,
        paidTotalText: `¥${paidTotal.toFixed(2)}`,
        buyersTotal,
        threshold,
        canWithdraw,
        withdrawPct,
        withdrawLabel: canWithdraw ? `已达标 · 可提现 ¥${avail.toFixed(2)}` : `还差 ¥${(threshold - avail).toFixed(2)} 即可提现`,
        withdrawBtn: canWithdraw ? `提现到微信零钱 · ¥${avail.toFixed(2)}` : `满 ¥${threshold} 可提现`,
        hasPending: S.income.pending > 0,
        showComposition: paidSets.length > 0 || platformTotal > 0,
        paidSetN: paidSets.length,
        bySet,
        txns,
        showDetail: total > 0,
      },
    });
  },

  doWithdraw() {
    const S = this.S;
    const avail = this.availEarn();
    if (avail < S.income.threshold) return;
    S.income.pending += avail;
    this.toast(`提现 ¥${avail.toFixed(2)} 已申请，1–3 个工作日到账。`);
    this.renderIncome();
    this.renderMe();
  },

  doArrive() {
    const S = this.S;
    S.income.withdrawn += S.income.pending;
    S.income.pending = 0;
    this.toast('已到账。');
    this.renderIncome();
    this.renderMe();
  },

  /* ──────────────────────────────────────────────────────────
     创作者主页
     ────────────────────────────────────────────────────────── */
  renderAuthor() {
    const S = this.S;
    const name = S.author;
    if (!name) return;
    const works = S.sets.filter(s => s.creator === name);
    const drawn = works.reduce((a, s) => a + (name === ME ? (s.totalDrawn || 0) : s.heat), 0);
    const fans = S.fans[name] || 0;
    const own = name === ME;
    this.setData({
      author: {
        exists: true,
        name,
        avatar: (name || '·')[0],
        own,
        worksN: works.length,
        drawnText: fmt(drawn),
        fansText: fmt(fans),
        followed: !!S.follow[name],
        works: works.map(s => ({
          id: s.id,
          title: s.title,
          cover: s.cover,
          covT2: s.covT.slice(0, 2),
          meta1: `${s.count} 张 · ${s.type === 'collect' ? '收藏集' : '常驻集'}`,
          meta2: s.price > 0 ? ('¥' + s.price) : '免费',
        })),
      },
    });
  },

  toggleFollowPage() {
    const S = this.S;
    const name = S.author;
    if (!name) return;
    S.follow[name] = !S.follow[name];
    this.toast(S.follow[name] ? `已关注 @${name}。` : '已取消关注。');
    this.renderAuthor();
  },

  /* ──────────────────────────────────────────────────────────
     我的
     ────────────────────────────────────────────────────────── */
  renderMe() {
    const S = this.S;
    const pub = S.sets.filter(s => s.creator === ME);
    const craftN = pub.length + S.craft.drafts.length + S.craft.reviewing.length;
    const avail = this.availEarn();
    const collectMine = S.sets.filter(s => s.type === 'collect' && s.user);
    const cardN = collectMine.reduce((a, s) => a + (s.user.drawn || 0), 0);
    const stampN = S.sets.reduce((a, s) => a + stampedCount(s), 0);
    const emptied = collectMine.filter(s => s.user.drawn >= s.count).length;

    let todayLine;
    if (S.mode === 'new') {
      todayLine = '今天的第一签，还在等你';
    } else {
      const drew = S.sets.filter(s => s.user && s.user.todayDrawn).length;
      const can = S.sets.filter(s => setVM(s).act === 'draw').length;
      const rp = S.sets.filter(s => s.user && hasRecPending(s)).length;
      const bits = [`今天抽了 ${drew} 张`];
      if (can > 0) bits.push(`还有 ${can} 个可抽`);
      if (rp > 0) bits.push(`${rp} 张等回信`);
      todayLine = bits.join(' · ');
    }

    const now = new Date();
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
    this.setData({
      me: {
        date: `${now.getMonth() + 1}月${now.getDate()}日 · ${wd}`,
        name: ME,
        avatar: '我',
        cardN,
        stampN,
        emptied,
        todayLine,
        craftN,
        availText: `可提现 ¥${avail.toFixed(2)}`,
      },
    });
  },

  meToAuthor() {
    this.S.author = ME;
    this.S.authorFrom = 'me';
    this.renderAuthor();
    this.go('author');
  },

  meWallet() {
    this.toast('钱包与提现，正在路上。');
  },

  meSettings() {
    this.toast('设置，正在路上。');
  },

  /* ──────────────────────────────────────────────────────────
     回信 / 邮戳
     ────────────────────────────────────────────────────────── */
  openRecordAt(sid, idx, from) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    S.rc = { sid, idx, from: from || 'big' };
    const resident = s.type === 'resident';
    const prev = getRec(s.user, idx);
    const editing = prev && !resident;
    S.rcTmp = { img: editing ? prev.img : null };
    const note = editing ? (prev.note || '') : '';
    this.setData({
      record: {
        show: true,
        title: `「${s.pool[idx].w}」`,
        sub: resident ? '这一次，做到了。留个证据，只给自己看。' : '做完这件小事，给它留个证据。只给自己看。',
        saveText: editing ? '更新这枚邮戳' : '盖上邮戳',
        note,
        count: note.length,
        img: editing && prev.img ? prev.img : '',
        hasImg: !!(editing && prev.img),
      },
    });
  },

  openRecord(e) {
    const d = e.currentTarget.dataset;
    this.openRecordAt(Number(d.sid), Number(d.idx), d.from || 'big');
  },

  choosePhoto() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const file = (res.tempFiles && res.tempFiles[0]) || null;
        if (!file) return;
        that.S.rcTmp.img = file.tempFilePath;
        that.setData({
          'record.img': file.tempFilePath,
          'record.hasImg': true,
        });
      },
    });
  },

  clearPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    this.S.rcTmp.img = null;
    this.setData({ 'record.img': '', 'record.hasImg': false });
  },

  onRecordNote(e) {
    this.setData({ 'record.note': e.detail.value, 'record.count': e.detail.value.length });
  },

  closeRecord() {
    this.S.rc = null;
    this.setData({ 'record.show': false });
  },

  saveStamp() {
    const S = this.S;
    const rc = S.rc;
    if (!rc) return;
    const s = S.sets.find(x => x.id === rc.sid);
    if (!s) return;
    const note = (this.data.record.note || '').trim().slice(0, 50);
    const img = S.rcTmp.img || '';
    if (!img && !note) {
      this.toast('写一句话，或选一张图，再盖邮戳。');
      return;
    }
    if (!s.user) {
      s.user = { drawn: 0, trialUsed: 0, unlocked: true, todayDrawn: true, got: [], recs: {}, todayIdx: rc.idx };
    }
    const u = s.user;
    if (!u.recs) u.recs = {};
    const rec = { img, note, date: getTodayShort() };
    if (s.type === 'resident') {
      const arr = Array.isArray(u.recs[rc.idx]) ? u.recs[rc.idx] : (u.recs[rc.idx] ? [u.recs[rc.idx]] : []);
      arr.push(rec);
      u.recs[rc.idx] = arr;
    } else {
      u.recs[rc.idx] = rec;
    }
    this.setData({ 'record.show': false });
    const weekly = this.weeklyState(s);
    const weeklyFresh = weekly.ready && weekly.stampN === 7 && !this.isWeeklyMade(s, weekly.weekNo);
    if (weeklyFresh) this.toast('本周集齐 7 张 · 可以生成周记了');
    else if (rc.from === 'draw') this.toast('已盖上今天的邮戳');
    else this.toast('已盖上邮戳，可以分享这张明信片了');

    if (rc.from === 'draw') {
      /* 抽卡页：无论盖章前在正面还是背面，盖章后停在背面，
         落戳动画直接可见 */
      const back = this._dwBack(s, rc.idx);
      back.stampAnim = true;
      this.setData({
        'draw.back': back,
        'draw.backIdx': rc.idx,
        'draw.front': this._dwFront(s, rc.idx),
        'draw.flipped': true,
        'draw.hint': '轻触卡面 · 翻到另一面',
      });
      this.renderHome();
      this.renderSubs();
      this.renderMe();
      setTimeout(() => {
        if (this.data.draw) {
          this.setData({ 'draw.back.stampAnim': false });
          this.renderDraw();     // 重算 CTA：补盖 → 分享这张明信片
        }
      }, 620);
    } else {
      /* 回看场景（big / set / cards 来源）：不重置、不闪正面 */
      this.renderHome();
      this.renderSubs();
      this.renderSetPage();
      if (this.data.bigCard.show) {
        // 正在查看大卡：原地刷新背面，翻面状态不丢
        const back = this.buildCardBack(s, rc.idx, 'big');
        back.stampAnim = true;
        this.setData({ 'bigCard.back': back, 'bigCard.flipped': true });
      } else {
        // 从详情页 / 订阅页补盖：打开大卡即背面 + 落戳动画
        this.showBigCard(s.id, rc.idx, { flipped: true, stampAnim: true });
      }
      // 若抽卡页还在背后（例如从「看看今天的卡」大卡里补盖），同步刷新抽卡卡背
      if (this.data.page === 'draw') {
        const dwBack = this._dwBack(s, rc.idx);
        dwBack.stampAnim = true;
        this.setData({
          'draw.back': dwBack,
          'draw.backIdx': rc.idx,
          'draw.front': this._dwFront(s, rc.idx),
          'draw.flipped': true,
        });
        setTimeout(() => {
          if (this.data.draw) {
            this.setData({ 'draw.back.stampAnim': false });
            this.renderDraw();
          }
        }, 620);
      }
      setTimeout(() => {
        if (this.data.bigCard) this.setData({ 'bigCard.back.stampAnim': false });
      }, 620);
    }
    S.rc = null;
  },

  /* ──────────────────────────────────────────────────────────
     海报 / 纪念册
     ────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────
     周记（weekly）
     ────────────────────────────────────────────────────────── */
  ensureDrawnLog(s) {
    const u = s && s.user;
    if (!u || s.type !== 'collect' || !u.got || !u.got.length) return;
    if (!u.drawnLog) {
      // 演示数据兜底：把已有的 got 摊到最近 N 天，保证历史集合也能看周记
      const now = Date.now();
      u.drawnLog = u.got.map((idx, i) => {
        const d = new Date(now - (u.got.length - 1 - i) * 86400000);
        return {
          idx,
          date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
          ts: d.getTime(),
        };
      });
    }
  },

  weeklyState(s) {
    if (!s || s.type !== 'collect') return { ready: false };
    this.ensureDrawnLog(s);
    const u = s.user;
    const logs = (u && u.drawnLog) || [];
    if (!u || logs.length < 7) return { ready: false };

    const win = logs.slice(-7);
    const weekNo = Math.ceil(logs.length / 7);
    const recs = win.map(l => getRec(u, l.idx));
    const stampN = recs.filter(Boolean).length;

    const photos = [];
    recs.forEach((r, i) => {
      if (r && r.img) {
        photos.push({
          img: r.img,
          note: r.note || '',
          date: r.date || win[i].date,
          idx: win[i].idx,
        });
      }
    });
    // 主拍立得优先取笔记最长的回信，其余按原顺序
    photos.sort((a, b) => (b.note || '').length - (a.note || '').length);

    const noteRecs = recs.filter(r => r && r.note);
    let quote = '';
    if (photos.length && photos[0].note) quote = photos[0].note;
    if (!quote && noteRecs.length) {
      quote = noteRecs.reduce((a, b) => ((b.note || '').length > (a.note || '').length ? b : a)).note;
    }

    const words = win.map(l => (s.pool[l.idx] || {}).w).filter(Boolean);
    const first = win[0].date.split('-');
    const last = win[6].date.split('-');
    const year = new Date().getFullYear();

    const cards = win.map(l => {
      const c = s.pool[l.idx] || { w: '', r: 'N' };
      return { idx: l.idx, word: c.w, rar: c.r, wordCls: bwCls(c.w) };
    });
    const stamps = win.map(l => ({
      k: `${l.ts}-${l.idx}`,
      on: !!getRec(u, l.idx),
      date: l.date,
    }));

    // 连续周数：从本周往回数，每周至少 1 枚邮戳（与 Canvas 模板一致）
    const stampWeeks = {};
    (u.drawnLog || []).forEach(e => {
      if (getRec(u, e.idx)) stampWeeks[isoWeekKey(e.ts)] = true;
    });
    let streak = 0;
    let cursor = new Date();
    while (stampWeeks[isoWeekKey(cursor.getTime())]) {
      streak++;
      cursor = new Date(cursor.getTime() - 7 * 86400000);
    }

    return {
      ready: true,
      weekNo,
      window: win,
      cards,
      stamps,
      stampN,
      streak,
      drawnN: win.length,
      title: weeklyTitle(stampN, weekNo),
      range: `${year}.${first[0]}.${first[1]} — ${last[0]}.${last[1]}`,
      kicker: `《${s.title}》 · 第 ${weekNo} 周`,
      variant: photos.length >= 2 ? 'photo' : 'card',
      photos: photos.slice(0, 2),
      wordLine: words.slice(0, 7).join('、') + (words.length > 7 ? '…' : ''),
      quote,
    };
  },

  weeklyKey(s, weekNo) {
    return `${s.id}:${weekNo}`;
  },

  isWeeklyMade(s, weekNo) {
    return !!this.S.weeklyMade[this.weeklyKey(s, weekNo)];
  },

  markWeeklyMade(s, weekNo) {
    this.S.weeklyMade[this.weeklyKey(s, weekNo)] = true;
  },

  weeklyForSet(s) {
    const w = this.weeklyState(s);
    if (!w.ready || this.isWeeklyMade(s, w.weekNo)) return null;
    return w;
  },

  openWeekly(e) {
    const S = this.S;
    const d = e && e.currentTarget && e.currentTarget.dataset;
    const id = d && d.id != null ? Number(d.id) : S.cur;
    const s = S.sets.find(x => x.id === id);
    if (!s) return;
    const w = this.weeklyState(s);
    if (!w.ready) {
      this.toast('再抽几张，抽满 7 张就能生成周记');
      return;
    }
    this.markWeeklyMade(s, w.weekNo);
    S.posterType = 'weekly';
    this.setData({
      poster: {
        show: true,
        kind: 'weekly',
        booklet: false,
        ratio: '34',
        sid: s.id,
        title: w.title,
        kicker: w.kicker,
        range: w.range,
        cards: w.cards,
        stamps: w.stamps,
        stampN: w.stampN,
        streak: w.streak,
        drawnN: w.drawnN,
        weekNo: w.weekNo,
        variant: w.variant,
        photos: w.photos,
        wordLine: w.wordLine,
        quote: w.quote,
      },
    });
    this.renderSubs();
    if (this.data.page === 'set') this.renderSetPage();
    if (this.data.page === 'draw') this.computeDrawActions();
  },

  setPosterRatio(e) {
    this.setData({ 'poster.ratio': e.currentTarget.dataset.ratio });
  },

  /* ── V2.6 · Canvas 周记导出（posterKit） ── */
  async openWeeklyPoster(e) {
    const S = this.S;
    const d = e && e.currentTarget && e.currentTarget.dataset;
    const id = d && d.id != null ? Number(d.id) : S.cur;
    const s = S.sets.find(x => x.id === id);
    if (!s) return;
    // qrSrc：服务端 wxacode.getUnlimited({ scene: `p=w&s=${s.id}` }) 的结果，
    // 缓存后传入；传空字符串会渲染 QR 占位框，不报错。
    const data = posterKit.buildWeeklyData(s, { qrSrc: '' });
    if (!data) { this.toast('本周还没有抽卡记录'); return; }

    // 渠道选择：小红书 3:4 / 朋友圈 9:16
    const tap = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['小红书 · 3:4', '朋友圈 · 9:16'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (tap < 0) return;
    await this.exportWeeklyById(id, tap === 1 ? '916' : '34');
  },

  /** 按指定比例生成并保存周记；预览弹层保存也走这里 */
  async exportWeeklyById(id, ratio) {
    const S = this.S;
    const s = S.sets.find(x => x.id === id);
    if (!s) return;
    const data = posterKit.buildWeeklyData(s, { qrSrc: '' });
    if (!data) { this.toast('本周还没有抽卡记录'); return; }
    // 从周记预览保存时，复用预览里的标题，避免随机文案和预览不一致
    const pv = this.data.poster || {};
    if (pv.show && pv.kind === 'weekly' && pv.sid === s.id && pv.title) {
      data.titleText = pv.title;
    }
    wx.showLoading({ title: '生成中', mask: true });
    try {
      const temp = ratio === '916'
        ? await posterKit.exportWeekly916(data)
        : await posterKit.exportWeekly34(data);
      await posterKit.saveToAlbum(temp);
      this.markWeeklyMade(s, data.weekNo);
      this.renderSubs();
      if (this.data.page === 'set') this.renderSetPage();
      if (this.data.page === 'draw') this.computeDrawActions();
      if (this.data.poster.show) this.setData({ 'poster.show': false });
      this.toast(ratio === '916' ? '朋友圈版已保存 📸' : '周记已保存到相册 📸');
    } catch (err) {
      console.warn(err);
      this.toast('生成失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  async demoWeekly() {
    const s = this.S.sets.find(x => x.id === 14);
    if (!s) { this.toast('演示数据里没有找到「云的图鉴」'); return; }
    posterKit.synthesizeLog(s, 7);
    this.S.cur = 14;
    await this.openWeeklyPoster();
  },

  async demoWeekly916() {
    const s = this.S.sets.find(x => x.id === 14);
    if (!s) { this.toast('演示数据里没有找到「云的图鉴」'); return; }
    posterKit.synthesizeLog(s, 7);
    this.S.cur = 14;
    await this.exportWeeklyById(14, '916');
  },

  async demoMemorial() {
    const s = this.S.sets.find(x => x.id === 14);
    if (!s) return;
    s.user = s.user || {};
    s.user.got = s.pool.map((_, i) => i);
    posterKit.synthesizeLog(s, s.pool.length);
    const data = posterKit.buildMemorialData(s, { qrSrc: '' });
    if (!data) return;
    wx.showLoading({ title: '生成中', mask: true });
    try {
      await posterKit.exportAndSaveMemorial34(data);
      this.toast('纪念海报已保存 📸');
    } catch (e) {
      console.warn(e);
      this.toast('生成失败');
    } finally {
      wx.hideLoading();
    }
  },

  buildHighlight(c, s, opts = {}) {
    if (!c || !s) return null;
    return posterKit.buildHighlightData(s, c, opts);   // 唯一真相源：预览与导出同源
  },

  openPoster(e) {
    const type = (e && e.currentTarget && e.currentTarget.dataset.type) || 'draw';
    const S = this.S;
    S.posterType = type;
    let data = null;
    if (type === 'draw') {
      if (!S.draw) { this.toast('请先抽一张卡'); return; }
      const s = S.sets.find(x => x.id === S.draw.sid);
      data = this.buildHighlight(S.draw.card, s, {
        idx: S.draw.idx,                              // ← 显式传 idx
        no: `No.${pad2(S.draw.idx + 1)} / ${s.pool.length}`,
        slogan: '万物皆可抽一签',
      });
    } else if (type === 'memorial') {
      const d = (e && e.currentTarget && e.currentTarget.dataset) || {};
      data = this.buildMemorialPoster({ sid: d.sid != null ? Number(d.sid) : undefined });
    } else if (type === 'card') {
      const d = (e && e.currentTarget && e.currentTarget.dataset) || {};
      const sid = Number(d.sid != null ? d.sid : S.cur);
      const s = S.sets.find(x => x.id === sid);
      if (!s) return;
      let idx;
      if (d.idx != null) {
        idx = Number(d.idx);
      } else {
        const gotArr = (s.user && s.user.got) || [];
        idx = gotArr.length ? gotArr[gotArr.length - 1] : 0;
      }
      const c = s.pool[idx];
      if (!c) return;
      data = this.buildHighlight(c, s, {
        idx,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
      });
    } else if (type === 'big') {
      // 回看场景：分享当前大卡的这一张
      const d = (e && e.currentTarget && e.currentTarget.dataset) || {};
      const sid = Number(d.sid != null ? d.sid : S.cur);
      const idx = Number(d.idx != null ? d.idx : 0);
      const s = S.sets.find(x => x.id === sid);
      if (!s || !s.pool[idx]) return;
      data = this.buildHighlight(s.pool[idx], s, {
        idx,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
      });
    }
    if (!data) return;
    S.posterExport = data;                            // ← 供 savePoster 真实导出
    this.setData({ poster: Object.assign({ show: true, booklet: !!data.rec, ratio: '34' }, data) });
  },

  buildMemorialPoster(opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === (opts.sid != null ? opts.sid : S.cur));
    if (!s) return null;
    return posterKit.buildMemorialData(s, opts);   // 唯一真相源：预览与导出同源
  },

  openBooklet(variant) {
    const S = this.S;
    S.posterType = 'booklet';
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const full = variant === 'full';
    const u = s.user || {};
    const got = u.got || [];
    const stN = stampedCount(s);
    const ssrGot = got.filter(i => s.pool[i] && s.pool[i].r === 'SSR').length;
    const miss = Math.max(0, got.length - stN);
    let firstD = '';
    let lastD = '';
    got.forEach(i => {
      const r = getRec(u, i);
      if (r && r.date) { if (!firstD) firstD = r.date; lastD = r.date; }
    });
    const sections = got.map((idx, n) => {
      const c = s.pool[idx] || { w: '', b: '', r: 'N' };
      const rec = getRec(u, idx);
      return {
        idx,
        n,
        tilt: n % 2 ? 'tilt-r' : 'tilt-l',
        rar: c.r,
        word: c.w,
        explain: c.b,
        rec: rec ? {
          img: rec.img || '',
          note: rec.note || '',
          date: rec.date || '',
          stampDate: stampDate(rec.date),
        } : null,
      };
    });
    this.setData({
      poster: {
        show: true,
        booklet: true,
        kind: 'booklet',
        ratio: '34',
        full,
        title: s.title,
        creator: s.creator,
        count: s.count,
        stN,
        gotCount: got.length,
        ssrGot,
        miss,
        firstD,
        lastD,
        date: todayDot(),
        sections,
      },
    });
  },

  openPosterDemo(e) {
    const S = this.S;
    S.posterType = 'demo';
    S.posterCtx = null;
    const rarity = e.currentTarget.dataset.rarity || 'SSR';
    const demo = {
      N: { w: '浇水', b: '给窗台的绿萝浇水，看水慢慢渗进土壤。' },
      R: { w: '黄昏', b: '拍下黄昏的云，天空被染成温柔的橘色。' },
      SR: { w: '咖啡', b: '今天喝到了一杯好咖啡，香气在房间里慢慢散开。' },
      SSR: { w: '晚霞', b: '遇见一场鎏金晚霞，像是天空送给今天的礼物。' },
    }[rarity] || { w: '浇水', b: '给窗台的绿萝浇水，看水慢慢渗进土壤。' };
    const c = { w: demo.w, b: demo.b, r: rarity };
    const s = { title: '生活中的微小确幸', covT: '生活中的微小确幸', creator: '小鱼', count: 12, pool: [], user: null };
    const data = this.buildHighlight(c, s, { no: 'No. 003 / 012', slogan: '「做点小事，慢慢收集。」' });
    S.posterExport = data;
    this.setData({ poster: Object.assign({ show: true, booklet: false, ratio: '34' }, data) });
  },

  hidePoster() {
    this.setData({ 'poster.show': false });
  },

  async savePoster() {
    const S = this.S;
    const type = S.posterType;

    // 周记：按当前预览比例走 posterKit 的真实 Canvas 导出
    if (this.data.poster.kind === 'weekly') {
      this.exportWeeklyById(
        this.data.poster.sid,
        this.data.poster.ratio === '916' ? '916' : '34'
      );
      return;
    }

    // booklet（长图纪念册）尚未 Canvas 化，维持演示提示
    if (type === 'booklet') {
      this.toast('纪念册已保存到相册 📸');
      setTimeout(() => this.setData({ 'poster.show': false }), 800);
      return;
    }

    const data = S.posterExport;
    if (!data || (data.kind !== 'highlight' && data.kind !== 'memorial')) {
      this.toast('生成失败，请重试');
      return;
    }

    const tap = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['小红书 · 3:4', '朋友圈 · 9:16'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (tap < 0) return;

    wx.showLoading({ title: '生成中', mask: true });
    try {
      const temp = data.kind === 'memorial'
        ? (tap === 1 ? await posterKit.exportMemorial916(data) : await posterKit.exportMemorial34(data))
        : (tap === 1 ? await posterKit.exportHighlight916(data) : await posterKit.exportHighlight34(data));
      await posterKit.saveToAlbum(temp);
      this.toast('海报已保存到相册 📸');
      setTimeout(() => this.setData({ 'poster.show': false }), 800);
    } catch (e) {
      console.warn(e);
      this.toast('保存失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  /* ──────────────────────────────────────────────────────────
     演示工具
     ────────────────────────────────────────────────────────── */
  demoEmptySet() {
    const S = this.S;
    const s = S.sets.find(x => x.id === 14);
    if (!s) { this.toast('演示数据里没有找到「云的图鉴」'); return; }
    if (!s.user) s.user = { drawn: 0, got: [] };
    const u = s.user;
    u.drawn = s.count;
    u.got = s.pool.map((_, i) => i);
    const now = Date.now();
    u.drawnLog = s.pool.map((_, i) => {
      const d = new Date(now - (s.pool.length - 1 - i) * 86400000);
      return {
        idx: i,
        date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        ts: d.getTime(),
      };
    });
    u.todayDrawn = false;
    u.todayIdx = null;
    u.recs = {
      0: { img: '', note: '下班路上真的抬头看了，积云像棉花糖。', date: '11月8日' },
      3: { img: '', note: '雨云压得很低，带了伞，没用上。', date: '11月11日' },
      6: { img: '', note: '查了珠母云的图，想亲眼看一次。', date: '11月12日' },
    };
    this.toast('已快进：「云的图鉴」8 张全收集 · 3 枚邮戳');
    this.renderHome();
    this.renderSubs();
    this.renderMe();
    this.openDone(s.id);
  },

  demoBackHome() {
    this.go('home');
  },
});
