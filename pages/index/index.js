// 今日做点小事 · 微信小程序版
// 移植自远程仓库 static/day_small_things_v2.html（V2.3c 原型）
const seed = require('../../data.js');

const BRAND = '今日做点小事';
const ME = '打工人小王';
const RARC = { N: '#FF8A5C', R: '#FF6B35', SR: '#E55A2B', SSR: '#D9A227' };
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
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${now.getMonth() + 1}月${now.getDate()}日 · ${days[now.getDay()]}`;
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
    home: { date: '', chips: [], quicks: [], setCount: 0, sets: [], sort: 'hot' },
    setPage: { exists: false, ctaShow: false },
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
    poster: { show: false, kind: 'highlight' },
    bigCard: { show: false, flipped: false },
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
    };

    this.resetMode('rich');
    this.renderHome();
    this.renderCards();
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
    this.renderCards();
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
    if (id === 'create') this.renderCraft();
    if (id === 'income') this.renderIncome();
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

  toastSearch() {
    this.toast('搜索功能开发中');
  },

  /* ──────────────────────────────────────────────────────────
     发现页
     ────────────────────────────────────────────────────────── */
  renderHome() {
    const S = this.S;
    const colorMap = {
      '全部': '', '文学': 'mint', '生活': 'sky', '味觉': 'honey', '城市': 'blossom',
      '心理': 'mint', '自然': 'sky', '治愈': 'mint', '职场': 'sky', '书单': 'honey',
      '情感': 'blossom', '美食': '', '奇趣': 'sky', '旅行': 'mint', '健康': 'honey',
    };
    const chips = S.catList.map(c => ({
      label: c,
      color: colorMap[c] || '',
      on: S.cat === c,
    }));
    const quicks = [
      { cls: 'white', icon: '⊞', label: '分类', sub: '按主题找卡集' },
      { cls: 'highlight', icon: '✦', label: '热门活动', sub: '本周精选' },
      { cls: 'cream', icon: '★', label: '新建卡片', sub: '做一套自己的' },
    ];
    const list = S.sets
      .filter(s => S.cat === '全部' || s.cat === S.cat)
      .slice()
      .sort((a, b) => S.sort === 'hot' ? b.heat - a.heat : b.date.localeCompare(a.date));

    const sets = list.map(s => {
      const v = setVM(s);
      const sticker = s.cat === '文学' ? '📖' : (s.cat === '节令' ? '🎋' : (s.cat === '决策' ? '🎲' : (s.cat === '城市' ? '🏙️' : (s.cat === '兴趣' ? '✨' : '🃏'))));
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
        tagCls: s.heat > 800 ? 'hot' : (s.price === 0 ? 'free' : 'paid'),
        tagText: s.heat > 800 ? '🔥 热门' : (s.price === 0 ? '免费' : `¥${s.price}`),
        sticker,
      };
    });

    this.setData({
      home: {
        date: getTodayStr(),
        chips,
        quicks,
        setCount: list.length,
        sets,
        sort: S.sort,
      },
    });
  },

  setCat(e) {
    this.S.cat = e.currentTarget.dataset.cat;
    this.renderHome();
  },

  setSort(e) {
    const k = e.currentTarget.dataset.sort;
    this.S.sort = k;
    this.renderHome();
  },

  quickAction(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === 0) this.toast('分类筛选功能开发中');
    else if (i === 1) {
      this.S.sort = 'hot';
      this.renderHome();
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
      this.toast('已切换至热门排序');
    } else if (i === 2) {
      this.go('create');
      this.toast('进入创作中心');
    }
  },

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
      this.setData({ setPage: { exists: false, ctaShow: false } });
      return;
    }
    const v = setVM(s);
    const u = s.user;
    const mine = s.creator === ME;
    const pct = u ? (u.drawn / s.count * 100).toFixed(1) : '0';
    let statusCls = 'active';
    let statusText = '● 今日可抽';
    if (v.key === 'empty') { statusCls = 'done'; statusText = '✓ 已抽空'; }
    else if (v.key === 'locked') { statusCls = 'locked'; statusText = '🔒 待解锁'; }
    else if (v.key === 'done') { statusCls = 'done'; statusText = '⏳ 今日已抽'; }

    const gotN = (u && u.got) ? u.got.length : (u ? u.drawn : 0);
    const stN = stampedCount(s);
    const showStampRow = s.type === 'collect' && !!u && gotN > 0;
    const stampPct = gotN ? Math.min(100, (stN / gotN * 100)).toFixed(0) : 0;

    const showProgress = s.type === 'collect' && !!u;
    const showTrial = s.price > 0 && s.trial > 0 && !!u && !u.unlocked;
    const trialDots = showTrial ? Array.from({ length: s.trial }, (_, i) => ({ used: i < (u.trialUsed || 0) })) : [];

    const rules = buildRules(s).map((r, i) => ({ n: i + 1, text: r }));
    const rarityRows = RAR_KEYS.map(k => {
      const p = (s.rar[k] / s.count * 100).toFixed(0);
      return { key: k, count: s.rar[k], pct: p };
    });

    let ctaShow = true;
    let ctaText = '';
    let ctaNote = '';
    let ctaSolid = true;
    let ctaDisabled = false;
    if (v.key === 'empty') {
      ctaText = '看抽空纪念';
      ctaNote = '全图点亮 · 生成纪念海报';
    } else if (v.key === 'done') {
      ctaShow = false;
    } else {
      ctaText = v.btnL;
      ctaDisabled = v.off;
      ctaSolid = !v.off;
      ctaNote = v.key === 'locked' ? '解锁后永久可用，每天可抽'
        : (v.key === 'trial_go' ? '试抽免费，不计入每日限额'
          : (v.key === 'record' ? '拍张照或写句话 · 只给自己看'
            : '每天 0 点重置，缺席不损失'));
    }

    this.setData({
      setPage: {
        exists: true,
        id: s.id,
        title: s.title,
        covT: s.covT,
        covS: s.covS,
        cover: s.cover,
        price: s.price,
        trial: s.trial,
        count: s.count,
        cat: s.cat,
        typeText: s.type === 'collect' ? '收藏集' : '常驻集',
        heatText: fmt(s.heat),
        statusCls,
        statusText,
        intro: s.intro,
        creator: s.creator,
        avatar: (s.creator || '·')[0],
        fansText: S.fans[s.creator] ? `${fmt(S.fans[s.creator])} 位关注者` : '做卡人',
        mine,
        followed: !!S.follow[s.creator],
        showProgress,
        drawn: u ? u.drawn : 0,
        pct,
        finishText: (u && u.drawn > 0) ? finishDate(s) : '',
        showStampRow,
        stampN: stN,
        gotN,
        stampPct,
        showTrial,
        trialUsed: u ? (u.trialUsed || 0) : 0,
        trialDots: trialDots.map((d, i) => ({ used: d.used, i })),
        trialLabel: showTrial ? ((u.trialUsed || 0) >= s.trial ? '试抽已用完，解锁后可继续抽' : '试抽免费，不占每日额度') : '',
        rules,
        rarityRows,
        ctaShow,
        ctaText,
        ctaNote,
        ctaSolid,
        ctaDisabled,
      },
    });
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
    if (!s || setVM(s).act !== 'draw') return;
    const u = s.user;
    let idx = 0;
    if (s.type === 'collect') {
      const got = (u && u.got) ? u.got : [];
      const remaining = s.pool.map((_, i) => i).filter(i => !got.includes(i));
      if (!remaining.length) { this.openDone(s.id); return; }
      idx = remaining[Math.floor(Math.random() * remaining.length)];
    } else {
      idx = Math.floor(Math.random() * s.pool.length);
    }
    const next = (s.type === 'collect') ? ((u ? u.drawn : 0) + 1) : 0;
    const trial = !!(s.price > 0 && s.creator !== ME && !(u && u.unlocked) && (((u && u.trialUsed) || 0) < s.trial));
    S.draw = { sid: s.id, card: s.pool[idx], idx, next, trial };
    S.mailOpening = false;
    S.posterCtx = { sid: s.id, idx };
    this.setupDrawPage(s);
    this.go('draw');
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
        lit: s.cat === '文学',
        collect,
        envFrom: `@${s.creator} 寄`,
        hint: '轻触火漆 · 开启今天',
        stageClass: '',
        sealBroken: false,
        flipped: false,
        actionsShow: false,
        tail: collect ? '拆开信封，看看今天是哪一张。' : '抽到什么，就是什么。\n今天的纠结，到此为止。',
        back: this.buildCardBack(s, D.idx, 'draw'),
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
      if (!u.got.includes(D.idx)) u.got.push(D.idx);
    }
    if (s.creator === ME) s.totalDrawn = (s.totalDrawn || 0) + 1;

    const rest = Math.max(0, s.pool.length - (u.got ? u.got.length : 0));
    const tail = s.type === 'collect'
      ? (D.trial ? '试抽结束 · 解锁后每天继续'
        : (rest <= 0 ? '这是最后一张 · 全图点亮，去生成纪念海报吧' : `还剩 ${rest} 张 · 明天继续`))
      : '抽到什么，就是什么。\n今天的纠结，到此为止。';
    this.setData({ 'draw.tail': tail });

    this.renderHome();
    this.renderCards();
    this.renderMe();
    this.renderSetPage();
  },

  flipCard() {
    if (!this.S.draw) return;
    this.setData({ 'draw.flipped': !this.data.draw.flipped });
  },

  drawActionCollect() {
    this.toast('已收入卡包');
  },

  drawAgain() {
    const S = this.S;
    if (!S.draw) return;
    const sid = S.draw.sid;
    this.openSetById(sid, 'home');
    setTimeout(() => {
      if (this.data.page === 'set') this.mainAct();
    }, 300);
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
      this.renderCards();
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

  showBigCard(sid, idx) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    const c = s.pool[idx];
    if (!c) return;
    S.posterCtx = { sid, idx };
    this.setData({
      bigCard: {
        show: true,
        flipped: false,
        rar: c.r,
        rarColor: RARC[c.r] || RARC.N,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        word: c.w,
        wordCls: bwCls(c.w),
        settitle: `《${s.title}》`,
        lit: s.cat === '文学',
        back: this.buildCardBack(s, idx, 'big'),
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
    this.renderDone();
    this.go('done');
  },

  renderDone() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const ssrCount = s.pool.filter(c => c.r === 'SSR').length;
    const u = s.user || {};
    const got = u.got || [];
    const stN = stampedCount(s);
    const full = got.length > 0 && stN >= got.length;
    const miss = Math.max(0, got.length - stN);
    this.setData({
      done: {
        exists: true,
        id: s.id,
        title: s.title,
        count: s.count,
        creator: s.creator,
        avatar: (s.creator || '·')[0],
        ssrCount,
        stN,
        gotCount: got.length,
        full,
        miss,
      },
    });
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
      id: ++S.seq, title: '', intro: '', type: 'collect', cat: '兴趣', price: 0, trial: 0, status: 'draft',
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
        cats: S.catList.slice(1),
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
        meta: `${d.type === 'collect' ? '收藏集' : '常驻集'} · ${d.cat} · ${complete.length} 张 · ${d.price > 0 ? `¥${d.price}（前 ${d.trial} 张免费试抽）` : '免费'}`,
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

    this.setData({
      me: {
        date: getTodayStr(),
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
    this.toast('已盖上今天的邮戳');

    if (rc.from === 'draw') {
      const back = this.buildCardBack(s, rc.idx, 'draw');
      back.stampAnim = true;
      this.setData({ 'draw.back': back });
      setTimeout(() => {
        if (this.data.draw) this.setData({ 'draw.back.stampAnim': false });
      }, 620);
    } else {
      this.renderHome();
      this.renderCards();
      this.renderSetPage();
      this.showBigCard(s.id, rc.idx);
      setTimeout(() => {
        if (!this.data.bigCard.show) return;
        this.setData({ 'bigCard.flipped': true, 'bigCard.back.stampAnim': true });
        setTimeout(() => {
          if (this.data.bigCard) this.setData({ 'bigCard.back.stampAnim': false });
        }, 620);
      }, 450);
    }
    S.rc = null;
  },

  /* ──────────────────────────────────────────────────────────
     海报 / 纪念册
     ────────────────────────────────────────────────────────── */
  getRecBlock() {
    const S = this.S;
    if (!S.posterCtx) return null;
    const s = S.sets.find(x => x.id === S.posterCtx.sid);
    if (!s || !s.pool[S.posterCtx.idx]) return null;
    const rec = getRec(s.user, S.posterCtx.idx);
    if (!rec) return null;
    return {
      img: rec.img || '',
      note: rec.note || '',
      date: rec.date || '',
      stampDate: stampDate(rec.date),
    };
  },

  buildHighlight(c, s, opts) {
    if (!c || !s) return null;
    const now = new Date();
    const rec = this.getRecBlock();
    return {
      kind: 'highlight',
      rar: c.r,
      isSSR: c.r === 'SSR',
      rarName: RARNAME[c.r] || c.r,
      date: `${now.getMonth() + 1}月${now.getDate()}日`,
      no: opts.no || `No.${pad2(s.pool.indexOf(c) + 1)} / ${s.pool.length}`,
      word: c.w,
      text: c.b || '',
      setTitle: s.title,
      setCover: (s.covT || s.title || '').slice(0, 1),
      creator: s.creator,
      count: s.count,
      collect: s.type === 'collect',
      gotN: (s.user && s.user.got) ? s.user.got.length : 0,
      slogan: opts.slogan || '万物皆可抽一签',
      setInfo: `@${s.creator} · ${s.count} 张卡${s.type === 'collect' ? ` · 已点亮 ${(s.user && s.user.got) ? s.user.got.length : 0}/${s.count}` : ''}`,
      rec,
    };
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
        no: `No.${pad2(S.draw.idx + 1)} / ${s.pool.length}`,
        slogan: '万物皆可抽一签',
      });
    } else if (type === 'memorial') {
      data = this.buildMemorialPoster();
    } else if (type === 'card') {
      const s = S.sets.find(x => x.id === S.cur);
      if (!s) return;
      const c = s.pool[Math.max(0, ((s.user && s.user.got && s.user.got.length) || 1) - 1)];
      data = this.buildHighlight(c, s, {
        no: `No.${pad2(s.pool.indexOf(c) + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
      });
    }
    if (!data) return;
    this.setData({ poster: Object.assign({ show: true, booklet: !!data.rec }, data) });
  },

  buildMemorialPoster() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return null;
    const u = s.user || {};
    const got = u.got || [];
    const ssrCount = s.pool.filter(c => c.r === 'SSR').length;
    const gotSSR = got.filter(i => s.pool[i] && s.pool[i].r === 'SSR').length;
    const ssrCard = s.pool.find(c => c.r === 'SSR');
    const now = new Date();
    const dateStr = todayDot();
    const timeline = [];
    if (got.length > 0) {
      const first = s.pool[got[0]];
      timeline.push({ label: '第 1 张', title: first ? first.w : '', date: '一切的开始' });
      if (got.length > 2) {
        const mid = s.pool[got[Math.floor(got.length / 2)]];
        timeline.push({ label: `第 ${Math.floor(got.length / 2) + 1} 张`, title: mid ? mid.w : '', date: '过半 · 习惯已成' });
      }
      if (got.length > 1) {
        const last = s.pool[got[got.length - 1]];
        timeline.push({ label: '最后一张', title: last ? last.w : '', date: '圆满' });
      }
    }
    return {
      kind: 'memorial',
      date: dateStr,
      title: s.title,
      count: s.count,
      gotCount: got.length,
      gotSSR,
      ssrCount,
      ssrW: gotSSR,
      timeline,
      quote: ssrCard ? ssrCard.b : '集齐本身，就是最好的签。',
      slogan: '万物皆可抽一签',
    };
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
    this.setData({ poster: Object.assign({ show: true, booklet: false }, data) });
  },

  hidePoster() {
    this.setData({ 'poster.show': false });
  },

  savePoster() {
    this.toast(this.S.posterType === 'booklet' ? '纪念册已保存到相册 📸' : '海报已保存到相册 📸');
    setTimeout(() => this.setData({ 'poster.show': false }), 800);
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
    u.todayDrawn = false;
    u.todayIdx = null;
    u.recs = {
      0: { img: '', note: '下班路上真的抬头看了，积云像棉花糖。', date: '11月8日' },
      3: { img: '', note: '雨云压得很低，带了伞，没用上。', date: '11月11日' },
      6: { img: '', note: '查了珠母云的图，想亲眼看一次。', date: '11月12日' },
    };
    this.toast('已快进：「云的图鉴」8 张全收集 · 3 枚邮戳');
    this.renderHome();
    this.renderCards();
    this.renderMe();
    this.openDone(s.id);
  },

  demoBackHome() {
    this.go('home');
  },
});
