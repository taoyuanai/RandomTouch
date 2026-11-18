/* lib/shared.js — 过渡期单一来源：Page(createPage('home')) */
const core = require('./core.js');
const api = require('../services/api.js');
const tracker = require('./track.js');
const posterKit = require('../utils/posterKit/export.js');
const {
  getViewport,
  BRAND,
  ME,
  TABS,
  clone,
  bwCls,
  pad2,
  getTodayShort,
  todayMD,
  todayDot,
  stampDate,
  fmt,
  fmtShort,
  weeklyTitle,
  isoWeekKey,
  cardDone,
  setVM,
  finishDate,
  getRec,
  recCount,
  todayIdxOf,
  hasRecPending,
  stampedCount,
  BK_OFFSET_MS,
  _bkDate,
  dateKeyOf,
  todayKey,
  weekMondayKey,
  _keyPlus,
  weekProgress,
  daysAbsent,
  TMPL_IDS,
  REMIND_TIMES,
  HM_SHOW_CATS,
  HM_SHOW_DAILY,
  HM_CATS,
  HM_CAT_DAILY,
  HM_DIMS,
  HM_EDIT_IDS,
  HM_CAT_NEWS,
  catChipOf,
} = core;

const PAGE_OPTS = {
  data: {
    brand: BRAND,
    bootError: false,
    booting: true,
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
    home: { cats: [], cat: 'all',
            column: null, rows: [], emptyText: '', chipsStuck: false, sort: 'hot' },
    setPage: { exists: false, ctaShow: false, ctaFloating: false },
    draw: null,
    mapV: { cells: [], drawn: 0, count: 0, pct: 0 },
    craft: { empty: false, groups: [] },
    edit: { mode: 'edit', cards: [] },
    income: { exists: false },
    author: { exists: false, works: [] },
    me: { cardN: 0, stampN: 0, emptied: 0, todayLine: '' },
    pay: { show: false, paying: false },
    check: { show: false, list: [] },
    pub: { show: false },
    nudge: { show: false },
    record: { show: false, note: '', img: '', hasImg: false, count: 0, saveText: '盖上邮戳', saving: false },
    commentsSheet: { show: false, sid: null, title: '', items: [], count: 0, canComment: false, draft: '', draftLen: 0, sending: false },
    rulesSheet: { show: false },
    remind: { show: false, enabled: false, time: '21:00', times: [] },
    poster: { show: false, kind: 'highlight', ratio: '34' },
    floatCta: { show: false },
    donePage: { show: false, ctaShow: false },
    onboard: { show: false },
    subs: { waiting: [], ongoing: [], done: [], total: 0, weekly: null, weekGoal: null, greeting: null },
    bigCard: { show: false, flipped: false, back: { sid: '', idx: 0, rec: null } },
  },


  /* 分享 / 二维码进入：统一解析并直达卡集 */

  handleLaunchOptions(options) {
    /* 预览环境：支持从 URL query 读取启动参数（?from=remind / ?sid=12） */
    if (!options && typeof location !== 'undefined' && location.search) {
      const query = {};
      location.search.slice(1).split('&').forEach(kv => {
        const p = kv.split('=');
        if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      options = { query };
    }
    const q = (options && (options.query || options)) || {};
    /* 订阅消息回流：直达订阅页「今日待抽」。只路由一次，不劫持后续导航 */
    if (q.from === 'remind' && !this._remindRouted) {
      this._remindRouted = true;
      this.go('cards');
      setTimeout(() => this.toast('欢迎回来 · 今天的卡到了'), 400);
      return;
    }
    const sid = this._shareSidOf(options);
    if (!sid) return;
    const key = String(sid);
    if (this._lastShareKey === key) return;
    this._lastShareKey = key;
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) {
      this.toast('这个卡集暂时不在了，看看别的');
      this.go('home');
      return;
    }
    this.S.shareSid = sid;
    if (this.__page === 'set' && this.data.setPage && this.data.setPage.id === sid) {
      this.renderSetPage();
      return;
    }
    this.openSetById(sid, 'home');
  },

  _shareSidOf(options) {
    if (!options) return 0;
    const q = options.query || options;
    let raw = q.sid || q.setId || q.set;
    if (!raw && q.scene) {
      const m = String(q.scene).match(/(?:^|[&?])s=(\d+)/);
      if (m) raw = m[1];
    }
    if (!raw) return 0;
    const sid = parseInt(decodeURIComponent(String(raw)), 10);
    return Number.isFinite(sid) && sid > 0 ? sid : 0;
  },





  /* ──────────────────────────────────────────────────────────
     模式 / 数据工具
     ────────────────────────────────────────────────────────── */
  /* 重建全局活动流水：优先用真实 drawnLog；演示模式下为"有进度"的卡集合成了最近几天的记录 */





  /* ═══ D2 · api 同步层 ═══ */

  /* SetPayload → 页面内部集对象，upsert 进 S.sets。
   * 全页面共享的「响应 → 缓存」转换器，D3+ 各页迁移复用。 */
  applySetPayload(p) {
    if (!p || !p.id) return null;
    const S = this.S;
    let s = S.sets.find(x => x.id === p.id);
    if (!s) { s = { id: p.id }; S.sets.push(s); }
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
    return s;
  },

  /* 冷启动装载：S.sets 从此只来自 api（seed 只活在 mock 里） */
  _bootFromApi() {
    return api.listSets().then(list => {
      list.forEach(p => this.applySetPayload(p));
      this.S.booted = true;
      this.renderHome();
      this.renderSubs();
      this.renderMe();
      this.renderCraft();
    });
  },

  retryBoot() {
    this.setData({ bootError: false });
    this._bootFromApi()
      .then(() => this.handleLaunchOptions())
      .catch(() => this.setData({ bootError: true }));
  },

  /* ──────────────────────────────────────────────────────────
     导航 / 轻提示
     ────────────────────────────────────────────────────────── */



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

  goIncome() {
    this.go('income');
  },

  craftRowTap(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'review') this.openReview(e);
    else if (d.kind === 'draft') this.openEdit(d.id);
    else this.openSetById(Number(d.id), 'create');
  },

  noop() {},

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
      const soc = this._socialOf(s);
      return {
        id: s.id,
        title: s.title,
        covT4: s.covT.slice(0, 4),
        covS8: s.covS.slice(0, 8),
        cover: s.cover,
        coverImage: s.coverImage || '',
        price: s.price,
        trial: s.trial,
        meta: `@${s.creator} · ${s.count} 张 · ${s.type === 'collect' ? '收藏集' : '常驻集'}`,
        vmText: v.text,
        faint: v.dot === 'faint',
        tagCls: paid ? 'paid' : (s.heat > 800 ? 'hot' : 'free'),
        tagText: s.heat > 800 && !paid ? '🔥 热门' : (paid ? `¥${s.price}` : '免费'),
        liked: !!soc.liked,
        likeText: fmt(soc.likes || 0),
        sticker: this._hmSticker(s.cat),
      };
    });

    /* ② 分类面板数据 + 当前分类名 */
    const cats = [{ key: 'all', chip: '全部' }]
      .concat(HM_SHOW_CATS ? (HM_SHOW_DAILY ? [HM_CAT_DAILY] : []).concat(HM_CATS) : []);
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

  clearCat() {
    this._hmCat = 'all';
    this.renderHome();
  },

  setSort(e) {
    this.S.sort = e.currentTarget.dataset.sort;
    this.renderHome();
  },

  teardownHomeObserver() {},


  /* ──────────────────────────────────────────────────────────
     卡集详情
     ────────────────────────────────────────────────────────── */
  openSet(e) {
    const d = e.currentTarget.dataset;
    this.S.shareSid = null;
    this.S.cur = Number(d.id);
    this._setRecTab = 'related';
    this.renderSetPage();
    this.go('set');
  },

  openSetById(id, from) {
    this.S.cur = Number(id);
    this._setRecTab = 'related';
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

    /* ③ 全图（空位=虚线签位 / 点亮=白签） */
    const cells = pool.map((c, i) => {
      const n = (c.w || '').length;
      return {
        idx: i,
        got: got.includes(i),
        word: c.w || '',
        wordCls: n >= 7 ? 'l7' : (n >= 5 ? 'l5' : 'l4'),
        sig: i === s.signatureIdx,
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

    const ruleSummary = s.price > 0
      ? `付费集 · 前 ${s.trial || 1} 张免费试抽 · 解锁后每天可抽`
      : (isResident ? '常驻集 · 每天 1 张 · 天天可抽' : '收藏集 · 每天 1 张 · 抽完即空');

    /* ── 公开互动：心动 + 留言 ── */
    const soc = this._socialOf(s);
    const commentN = this._commentItems(s).length;

    this.setData({
      setPage: {
        exists: true,
        id: s.id,
        todayIdx,
        done,
        title: s.title || '',
        creator: s.creator || '',
        intro: (s.intro || '').trim(),
        cells,
        picks,
        cta,
        /* ── v2 · 原型 set-hero / 进度 / 稀有度 ── */
        cover: s.cover || '',
        coverImage: s.coverImage || '',
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
        fromShare: this.S.shareSid === s.id,
        likePop: false,
        recs: this._setRecs(s),
        ruleSummary,
        signature: {
          idx: s.signatureIdx,
          note: s.signatureNote || '',
          on: s.signatureIdx >= 0,
        },
      },
      'floatCta.show': false,
    });
    wx.nextTick(() => {
      if (this.__page !== 'set') return;
      if (this._spObsId !== s.id) { this._spObsId = s.id; this.initSetObservers(); }
      this.updateFloatCta();
    });
  },

  /* ──────────────────────────────────────────────────────────
     卡集公开互动：心动 + 留言
     ────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────
     推荐卡集：相关 / 热门
     ────────────────────────────────────────────────────────── */
  _recDone(s) {
    if (!s || s.type !== 'collect') return false;
    const u = s.user;
    const count = s.count || (s.pool || []).length;
    return !!u && (u.got || []).length >= count;
  },

  _recPriceTier(p) {
    const v = Number(p || 0);
    if (v <= 0) return 0;
    if (v <= 6) return 1;
    if (v <= 12) return 2;
    return 3;
  },

  _recCandidates(currentId, opts) {
    opts = opts || {};
    let list = (this.S.sets || []).filter(s =>
      s.id !== currentId &&
      s.creator !== ME &&
      !this._recDone(s)
    );
    if (opts.drawable) {
      list = list.filter(s => setVM(s).act === 'draw');
    }
    return list;
  },

  _recRelated(currentId, opts) {
    const cur = this.S.sets.find(x => x.id === currentId);
    if (!cur) return [];
    return this._recCandidates(currentId, opts).map(s => {
      let score = 0;
      if (s.cat === cur.cat) score += 3;
      if (s.type === cur.type) score += 2;
      if (s.creator === cur.creator) score += 1;
      if (this._recPriceTier(s.price) === this._recPriceTier(cur.price)) score += 1;
      if (!s.user) score += 1;
      return { s, score };
    }).sort((a, b) =>
      b.score - a.score || (b.s.heat || 0) - (a.s.heat || 0)
    ).map(x => x.s);
  },

  _recHot(currentId, opts, exclude) {
    return this._recCandidates(currentId, opts)
      .filter(s => !exclude || !exclude.includes(s.id))
      .sort((a, b) => (b.heat || 0) - (a.heat || 0));
  },

  _recPick(list, offset, limit) {
    if (!list || !list.length) return [];
    const out = [];
    const n = Math.min(limit, list.length);
    for (let i = 0; i < n; i++) out.push(list[(offset + i) % list.length]);
    return out;
  },

  _recsFor(currentId, mode, limit, offset, opts) {
    const related = this._recRelated(currentId, opts);
    const hot = this._recHot(currentId, opts);
    const primary = mode === 'hot' ? hot : related;
    const fallback = mode === 'hot' ? related : hot;
    let chosen = this._recPick(primary, offset || 0, limit);
    if (chosen.length < limit) {
      const used = chosen.map(s => s.id);
      const extra = fallback.filter(s => !used.includes(s.id));
      chosen = chosen.concat(this._recPick(extra, 0, limit - chosen.length));
    }
    return chosen.map(s => this._recItem(s));
  },

  _recItem(s) {
    const count = s.count || (s.pool || []).length;
    const price = Number(s.price || 0);
    return {
      id: s.id,
      title: s.title || '',
      coverImage: s.coverImage || '',
      cover: s.cover || 'c1',
      coverChar: (s.covT || s.title || '签').slice(0, 1),
      covT: (s.covT || s.title || '·').slice(0, 6),
      covS: (s.covS || '').slice(0, 8),
      badge: price > 0 ? (s.trial > 0 ? `试${s.trial}张` : `¥${price}`) : '免费',
      meta: `${count} 张 · ${price > 0 ? '¥' + price : '免费'}`,
      hot: (s.heat || 0) > 800,
    };
  },

  _recOff(key) {
    this._recOffsets = this._recOffsets || {};
    return this._recOffsets[key] || 0;
  },

  _bumpRecOff(key, step) {
    this._recOffsets = this._recOffsets || {};
    this._recOffsets[key] = (this._recOffsets[key] || 0) + step;
  },

  _setRecs(s) {
    const tab = this._setRecTab || 'related';
    return {
      tab,
      items: this._recsFor(s.id, tab, 3, this._recOff('set:' + s.id)),
    };
  },

  _applySetRecs() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    this.setData({ 'setPage.recs': this._setRecs(s) });
  },

  switchSetRecs(e) {
    const tab = e.currentTarget.dataset.tab || 'related';
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    this._setRecTab = tab;
    this._recOffsets = this._recOffsets || {};
    this._recOffsets['set:' + s.id] = 0;
    this._applySetRecs();
  },

  refreshSetRecs() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    this._bumpRecOff('set:' + s.id, 3);
    this._applySetRecs();
  },

  refreshDrawRecs() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    this._bumpRecOff('draw:' + s.id, 3);
    this.setData({
      'draw.recs': {
        items: this._recsFor(s.id, 'related', 3, this._recOff('draw:' + s.id), { drawable: true }),
      },
    });
  },

  openRecSet(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    if (this.data.donePage && this.data.donePage.show) this.closeDone();
    this.openSetById(id, 'home');
  },

  tapDoneMore() {
    this.closeDone();
    this.go('home');
  },

  _socialOf(s) {
    if (!s) return { likes: 0, liked: false };
    let soc = this.S.social[s.id];
    if (!soc) {
      const base = s.creator === ME ? 0 : Math.max(6, Math.round((s.heat || 0) / 28));
      soc = { likes: base, liked: false };
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
    return this._commentsOf(s)
      .filter(c => !c.status || c.status === 'visible')
      .map(c => Object.assign({}, c, {
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
    const patch = {};
    if (this.data.setPage && this.data.setPage.exists) {
      patch['setPage.social.liked'] = soc.liked;
      patch['setPage.social.likes'] = soc.likes;
      patch['setPage.social.likesText'] = fmt(soc.likes);
      patch['setPage.likePop'] = true;
    }
    if (this.data.draw) {
      patch['draw.social.liked'] = soc.liked;
      patch['draw.social.likes'] = soc.likes;
      patch['draw.social.likesText'] = fmt(soc.likes);
      patch['draw.likePop'] = true;
    }
    this.setData(patch);
    setTimeout(() => {
      const off = {};
      if (this.data.setPage && this.data.setPage.exists) off['setPage.likePop'] = false;
      if (this.data.draw) off['draw.likePop'] = false;
      this.setData(off);
    }, 320);
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  openRules() {
    this.setData({ 'rulesSheet.show': true });
  },

  closeRules() {
    this.setData({ 'rulesSheet.show': false });
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

  async submitComment() {
    const sheet = this.data.commentsSheet;
    if (sheet.sending) return;
    const text = (sheet.draft || '').trim();
    if (!text) {
      this.toast('写一句话再发送');
      return;
    }
    const s = this.S.sets.find(x => x.id === sheet.sid);
    if (!s) return;
    this.setData({ 'commentsSheet.sending': true });

    let status = 'visible';
    let saved = null;
    try {
      const r = await api.addComment({ setId: s.id, text });
      status = (r && r.status) || 'visible';
      saved = (r && r.comment) || null;
    } catch (e) {
      status = 'pending';                 // 公开内容 fail-closed
    }
    if (status === 'rejected') {
      this.setData({ 'commentsSheet.sending': false });
      this.toast('这句话发不出去 · 换个说法试试');
      return;
    }

    const list = this._commentsOf(s);
    const c = saved || {
      id: 'c' + Date.now(),
      name: ME,
      avatar: ME.slice(0, 1),
      text,
      time: '刚刚',
      creator: s.creator === ME,
      status,
    };
    c.sec = c.sec || { text: status === 'visible' ? 'pass' : 'review' };
    list.unshift(c);
    this.S.commentDrafts[s.id] = '';
    const items = this._commentItems(s);
    const patch = {
      commentsSheet: Object.assign({}, sheet, {
        items, count: items.length, draft: '', draftLen: 0, sending: false,
      }),
    };
    if (this.data.setPage && this.data.setPage.exists) {
      patch['setPage.social.commentCount'] = items.length;
      patch['setPage.social.commentText'] = items.length + ' 条留言';
    }
    if (this.data.draw) {
      patch['draw.social.commentCount'] = items.length;
    }
    this.setData(patch);
    if (wx.hideKeyboard) wx.hideKeyboard();
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    this.toast(status === 'visible' ? '已留下这句话' : '收到了 · 通过后会显示出来');
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
    this.renderAuthor();
    this.go('author');
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
    this._recOffsets = this._recOffsets || {};
    this._recOffsets['draw:' + s.id] = 0;
    this.renderDraw();
    this.go('draw');
  },

  /* ══════════════ 抽卡页 · 三组法则 ══════════════ */
  _drawSocialOf(s) {
    const soc = this._socialOf(s);
    const n = this._commentsOf(s).length;
    return {
      liked: !!soc.liked,
      likes: soc.likes || 0,
      likesText: fmt(soc.likes || 0),
      commentCount: n,
    };
  },

  _dwFront(s, idx) {
    const c = (s.pool || [])[idx] || {};
    const n = (c.w || '').length;
    return {
      word: c.w || '·',
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
    const todayIdx = u.todayIdx != null
      ? u.todayIdx
      : (u.todayDrawn && got.length ? got[got.length - 1] : null);
    const hasRec = stage === 'after' && todayIdx != null
      && !!(u.recs && u.recs[todayIdx] != null);

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
    const backIdx = stage === 'after' && todayIdx != null ? todayIdx : -1;
    const sig = backIdx >= 0 && backIdx === s.signatureIdx;
    const sigFirst = !!(sig && S.sigFirst);
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
        sig, sigFirst,
        sigBar: sig && !sigFirst,
        sigStamp: sig && !sigFirst,
        social: this._drawSocialOf(s),
        remindChecked: this._remindAuthedToday(),
        recs: {
          items: this._recsFor(s.id, 'related', 3, this._recOff('draw:' + s.id), { drawable: true }),
        },
        likePop: false,
      },
    });
  },

  /* ═══ D8 · 订阅勾选 ═══ */
  _remindAuthedToday() {
    try {
      const ts = Number(wx.getStorageSync('dsm_remind_ts') || 0);
      return !!ts && dateKeyOf(ts) === todayKey();
    } catch (e) { return false; }
  },

  tapRemindCheck() {
    if (this.data.draw && this.data.draw.remindChecked) {
      this.toast('已设置 · 明天见');
      return;
    }
    if (!TMPL_IDS || !TMPL_IDS.length) {
      this.toast('订阅模板还没配好，明天再试试');
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: TMPL_IDS,
      success: (res) => {
        if (res[TMPL_IDS[0]] === 'accept') {
          this.S.remind.enabled = true;
          try { wx.setStorageSync('dsm_remind_ts', String(Date.now())); } catch (e) {}
          api.reportRemindAuth({ enabled: true, time: this.S.remind.time || '21:00' }).catch(() => {});
          this.setData({ 'draw.remindChecked': true });
          if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
          this.toast('明天见 · 记得回来');
        } else {
          this.toast('没关系的，想开随时开');
        }
      },
      fail: () => this.toast('可在「我的 · 提醒设置」里开启'),
    });
  },

  tapEnvelope() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const d = this.data.draw || {};
    if (d.stage === 'opening') {
      if (this._envSkip) { this._envSkip(); this.setData({ 'draw.hint': '' }); }
      return;
    }
    const u = s.user || {};
    if (u.todayDrawn || u.trialToday) { this.tapCard(); return; }
    const count = s.count || s.pool.length;
    if (s.type !== 'resident' && (u.got || []).length >= count) { this.openDoneView(); return; }

    if (!this._pendingDraw || this._pendingDraw.setId !== s.id) {
      this._pendingDraw = { setId: s.id, requestId: api.reqId() };
    }

    const first = !wx.getStorageSync('dsm_env_seen');
    if (first) wx.setStorageSync('dsm_env_seen', '1');
    const ENV_MS = first ? 920 : 400;
    this.setData({
      'draw.stage': 'opening',
      'draw.fast': !first,
      'draw.hint': first ? '' : '轻触跳过',
      'draw.error': null,
    });

    const animDelay = new Promise(resolve => {
      this._envSkip = resolve;
      this._envTimer = setTimeout(resolve, ENV_MS);
    });

    Promise.all([api.draw(this._pendingDraw), animDelay])
      .then(([res]) => { this._releaseEnv(); this._afterDrawnApi(res); })
      .catch(err => animDelay.then(() => { this._releaseEnv(); this._drawFailed(err); }));
  },

  _releaseEnv() {
    clearTimeout(this._envTimer);
    this._envTimer = null;
    this._envSkip = null;
  },

  closeOnboard() {
    const patch = { 'onboard.show': false };
    if (this.data.draw && !this.data.draw.flipped) {
      patch['draw.hint'] = '轻触卡面 · 翻到另一面';
    }
    this.setData(patch);
  },

  /* 抽卡成功分支：同步缓存 → 重渲染 → 动画链 */
  _afterDrawnApi(res) {
    this._pendingDraw = null;
    const s = this.applySetPayload(res.set);
    if (!s) return;
    const S = this.S;

    /* TODO(D3): renderSubs 迁 api.getFeed 后，本行删除 */
    if (!S.activity) S.activity = [];
    S.activity.push({ ts: Date.now(), sid: s.id, idx: res.idx });

    const firstReveal = !!(res.sig && res.sig.firstReveal);
    if (firstReveal) {
      S.sigFirst = true; // renderDraw 据此压住金色条，等定时器放出
      setTimeout(() => { S.sigFirst = false; }, 1100);
    }

    this.renderDraw();
    this.renderHome();
    this.renderSubs();
    this.renderMe();

    if (res.result === 'completed') {
      setTimeout(() => this.openDoneView(), 400);
      return;
    }

    if (firstReveal) {
      setTimeout(() => { if (this.__page === 'draw') this.setData({ 'draw.sigBar': true }); }, 500);
      setTimeout(() => {
        if (this.__page !== 'draw') return;
        this.setData({ 'draw.sigStamp': true });
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      }, 650);
      setTimeout(() => {
        if (this.__page === 'draw') this.setData({ 'draw.hint': '本集题眼 · 做卡人最想送你的一张' });
      }, 900);
    }

    if (res.weekGoal && res.weekGoal.justFull) {
      setTimeout(() => this.toast('本周 7 天集齐 · 可以装订本周周记了'), 1800);
    }

    /* 首抽订阅引导：本地标记（UI 引导，非权威数据） */
    /* 抽空 → 金色时刻（题眼压轴多留 2 秒） */
    if (res.done) {
      const delay = (res.sig && res.sig.isSig) ? 2600 : 600;
      setTimeout(() => this.openDoneView(), delay);
    }
  },

  /* 抽卡失败分支：错误分类 + 可重试内联态 */
  _drawFailed(err) {
    const e = err || {};
    this.renderDraw(); // 本地缓存仍「今日未抽」→ 信封复位

    if (e.code === 'UNLOCK_REQUIRED') {
      const s = this.S.sets.find(x => x.id === this.S.cur);
      if (s) this.openPay(s);
      return;
    }
    if (e.code === 'SET_NOT_FOUND') {
      this.toast('这个卡集不在了');
      this.go('home');
      return;
    }
    if (!e.retryable) {
      this.toast(e.message || '出了点问题');
      return;
    }
    this.setData({
      'draw.error': { message: e.message || '网络开小差了' },
      'draw.hint': '',
    });
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

  /* ── V2.5 动作区状态机：信封开启后 / 盖章后调用 ──
     stamp    盖个邮戳（默认主行动）
     share    已盖章，升级为分享明信片
     trial    试抽还有余额（当前 trial=1 不会出现，为多试抽预留）
     unlock   试抽用尽，转化时机
     memorial 本张抽空了全图                                   */

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
      sig: idx === s.signatureIdx,
      signature: idx === s.signatureIdx ? {
        note: (s.signatureNote || '').trim(),
        fallback: '做卡人最想送出的一张',
      } : null,
      stampAnim: false,
      rec: rec ? {
        img: rec.img || '',
        imgFileID: rec.imgFileID || '',
        note: rec.note || '',
        date: rec.date || '',
        stampDate: stampDate(rec.date),
        count: recCount(s.user, idx),
        resident: s.type === 'resident',
        sec: rec.sec || null,
      } : null,
    };
  },

  /* ──────────────────────────────────────────────────────────
     付费墙
     ────────────────────────────────────────────────────────── */
  openPay(s) {
    this.S.pw = s.id;
    tracker.t('unlock_view', { sid: s.id, price: s.price });
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
    this.S.pw = null;
    this.setData({ 'pay.show': false, 'pay.paying': false });
  },

  doUnlock() {
    const S = this.S;
    if (!S.pw || this.data.pay.paying) return;
    const targetId = S.pw;
    this.setData({ 'pay.paying': true, 'pay.payText': '支付中…' });
    api.unlock({ setId: targetId })
      .then(res => {
        S.pw = null;
        this.applySetPayload(res.set);
        this.setData({ 'pay.show': false, 'pay.paying': false });
        this.renderHome();
        this.renderSubs();
        this.renderMe();
        this.renderSetPage();
        const s = S.sets.find(x => x.id === targetId);
        if (s && s.user && !s.user.todayDrawn && !s.user.trialToday) {
          this.toast('解锁成功，这张签送你。');
          setTimeout(() => this.startDraw(s.id), 260);
        } else {
          this.toast('已解锁。今天的卡，明天 0 点到。');
        }
      })
      .catch(() => {
        this.setData({ 'pay.paying': false, 'pay.payText': `解锁 · ¥${this.data.pay.price}` });
        this.toast('支付未完成，请重试');
      });
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
        return { dark: false, word: c.w, sig: i === s.signatureIdx, idx: i, sid: s.id, badge: rec ? 'rec' : 'cam' };
      }
      return { dark: true, word: '?', sig: i === s.signatureIdx, idx: i, sid: s.id, badge: '' };
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

  mapCellTap(e) {
    const d = e.currentTarget.dataset;
    const idx = Number(d && d.idx);
    const cell = (this.data.mapV.cells || [])[idx];
    if (!cell) return;
    if (cell.dark) {
      if (cell.sig) this.toast('题眼还在路上 · 抽到那天你会知道');
      return;
    }
    this.showBigCard(Number(cell.sid), idx);
  },

  showBigCard(sid, idx, opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    const c = s.pool[idx];
    if (!c) return;
    const back = this.buildCardBack(s, idx, 'big');
    if (opts.stampAnim) back.stampAnim = true;
    this.setData({
      bigCard: {
        show: true,
        flipped: !!opts.flipped,
        sig: idx === s.signatureIdx,
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
    if (!['cards', 'set', 'draw', 'map'].includes(this.__page)) return;
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
        recs: this._recsFor(s.id, 'hot', 3, 0),
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

    /* ═══ 本周目标卡：固定 7 天装订周记（每周一重置，缺勤不罚） ═══ */
    let weekGoal = null;
    const acts = this.S.activity || [];
    if (acts.length) {
      const wp = weekProgress(this.S);
      const mk = weekMondayKey();
      const tk = todayKey();
      const daySet = new Set();
      acts.forEach(a => {
        if (!a || !a.ts) return;
        const k = dateKeyOf(a.ts);
        if (k >= mk && k <= tk) daySet.add(k);
      });
      const wlabels = ['一', '二', '三', '四', '五', '六', '日'];
      const dots = [];
      for (let i = 0; i < 7; i++) {
        const k = _keyPlus(mk, i);
        let cls = 'future';
        if (k < tk) cls = daySet.has(k) ? 'on' : 'miss';
        else if (k === tk) cls = daySet.has(k) ? 'on today' : 'today';
        dots.push({ cls, label: wlabels[i] });
      }
      let title, sub;
      if (wp.full) {
        title = '本周 7 天集齐';
        sub = '点这里，把这一周装订成周记 ✦';
      } else if (wp.done === 0) {
        title = '这周，还没开张';
        sub = '抽一张，为这周开个头';
      } else {
        title = `本周已抽 ${wp.done} 天`;
        sub = `再抽 ${wp.left} 天，装订本周周记`;
      }
      weekGoal = { done: wp.done, total: 7, left: wp.left, full: wp.full, title, sub, dots };
    }

    /* ═══ 久别问候卡：≥3 天没抽，回来看看（只讲等待，不讲损失） ═══ */
    let greeting = null;
    const absent = daysAbsent(this.S);
    if (absent != null && absent >= 3) {
      greeting = {
        days: absent,
        sid: firstDraw ? firstDraw.id : null,
        sub: `你不在的 ${absent} 天，卡都好好收着，一张也没少`,
        cta: firstDraw
          ? (today.length > 1 ? `今天有 ${today.length} 个卡集可抽` : '今天有 1 个卡集可抽')
          : '今天没有新卡，随便看看',
      };
    }

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
      weekGoal,
      greeting,
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

  /* 本周目标卡：未满 → 直达今日第一件待办；集满 → 装订本周周记 */
  tapWeekGoal() {
    const wg = this.data.subs.weekGoal;
    if (!wg) return;
    if (wg.full) {
      let target = null;
      for (const s of this.S.sets) {
        if (!s.user) continue;
        const w = this.weeklyState(s);
        if (w && w.ready) { target = s; break; }
      }
      if (target) {
        this.openWeekly({ currentTarget: { dataset: { id: target.id } } });
      } else {
        this.toast('周记按卡集装订：同一卡集抽满 7 张即可生成');
      }
      return;
    }
    const rd = this.data.subs.remindDraw;
    if (rd) { this.goSubsDraw(rd.sid, 'cards'); return; }
    const rs = this.data.subs.remindStamp;
    if (rs) { this.S.cur = rs.sid; this.openRecordAt(rs.sid, rs.idx, 'cards'); return; }
    this.toast('今天都完成啦 · 明天 0 点（北京时间）新卡到');
  },

  /* 久别问候卡：直达今日第一件可抽 */
  tapGreeting() {
    const g = this.data.subs.greeting;
    if (!g) return;
    if (g.sid) { this.goSubsDraw(g.sid, 'cards'); return; }
    this.toast('今天没有新卡 · 去「发现」看看有没有新卡集');
  },

  tapSubsRow(e) {
    const d = e.currentTarget.dataset;
    const sid = Number(d.sid);
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    const from = d.from || 'cards';
    const u = s.user || {};
    if (d.tap === 'booklet') {
      this.S.cur = sid;
      this.openDoneView();
      return;
    }
    if (d.tap === 'stamp') {
      const idx = d.idx != null ? Number(d.idx)
        : (u.todayIdx != null ? u.todayIdx
          : (u.todayDrawn && u.got && u.got.length ? u.got[u.got.length - 1] : null));
      if (idx == null) return;
      this.S.cur = sid;
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
    if (setVM(s).act === 'draw') this.startDraw(sid);
    else this.mainAct();
  },

  goSubsView(sid, from) {
    this.goSetView(sid);
  },

  tapSubsBrowse() {
    this.go('home');
  },


  /* ──────────────────────────────────────────────────────────
     订阅页
  /* ──────────────────────────────────────────────────────────
     创作中心
     ────────────────────────────────────────────────────────── */
  renderCraft() {
    const S = this.S;
    const pub = S.sets.filter(s => s.creator === ME);
    if (!pub.length && !S.craft.reviewing.length && !S.craft.drafts.length) {
      this.setData({ craft: { empty: true, groups: [] } });
      return;
    }
    const earn = this.S.incomeData ? this.S.incomeData.total : 0;
    const fansN = (S.fans && S.fans[ME]) || 0;
    const likeN = pub.reduce((a, s) => {
      const soc = S.social && S.social[s.id];
      return a + (soc ? (soc.likes || 0) : 0);
    }, 0);
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
        fansN,
        fansText: fmtShort(fansN),
        likeN,
        likeText: fmtShort(likeN),
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
    const d = {
      id: ++S.seq, title: '', intro: '', type: 'collect', cat: 'create', price: 0, trial: 0, status: 'draft',
      coverImage: '',
      signatureIdx: -1, signatureNote: '', signaturePublic: false,
      pool: Array.from({ length: 8 }, () => ({ w: '', b: '' })),
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
    const cards = d.pool.map((c, i) => ({
      index: i,
      badge: '',
      w: c.w || '',
      b: c.b || '',
      label: (c.w || '').trim() || '未命名',
      blank: !(c.w || '').trim(),
      cnt: ((c.w || '').trim() ? 1 : 0) + ((c.b || '').trim() ? 1 : 0),
      open: S.edOpen === i,
      isSig: i === (d.signatureIdx != null ? d.signatureIdx : -1),
    }));
    this.setData({
      edit: {
        mode: 'edit',
        headTitle: '编辑卡集',
        coverImage: d.coverImage || '',
        title: d.title || '',
        intro: d.intro || '',
        type: d.type,
        cat: d.cat,
        price: d.price,
        cats: HM_CATS.map(c => ({ key: c.key, chip: c.chip })),
        prices: [0, 6, 12, 19],
        complete,
        countText: `卡 · ${complete} 张完整`,
        cards,
        signatureOn: (d.signatureIdx != null ? d.signatureIdx : -1) >= 0,
        signatureNote: d.signatureNote || '',
        footerTitle: (d.title || '').trim() || '未命名',
      },
    });
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

  /* 卡集封面：固定 3:4 裁剪后写入草稿 */
  chooseCover() {
    if (!this.S.ed) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles && res.tempFiles[0]) || null;
        if (!file) return;
        this.cropCover(file.tempFilePath);
      },
    });
  },

  cropCover(src) {
    if (!src) return;
    if (typeof wx.cropImage !== 'function') {
      this.applyCover(src);
      this.toast('当前版本不支持裁剪，已使用原图');
      return;
    }
    wx.cropImage({
      src,
      cropScale: '3:4',
      success: (res) => {
        if (res && res.tempFilePath) this.applyCover(res.tempFilePath);
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        if (/cancel/i.test(msg)) return;
        this.applyCover(src);
        this.toast('裁剪失败，已使用原图');
      },
    });
  },

  applyCover(path) {
    if (!this.S.ed) return;
    this.S.ed.coverImage = path;
    this.setData({ 'edit.coverImage': path });
    this.toast('封面已更新');
  },

  clearCover() {
    if (!this.S.ed) return;
    this.S.ed.coverImage = '';
    this.setData({ 'edit.coverImage': '' });
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

  edToggleSignature(e) {
    const S = this.S;
    if (!S.ed) return;
    const i = Number(e.currentTarget.dataset.index);
    const on = (e.detail && e.detail.value != null)
      ? !!e.detail.value
      : e.currentTarget.dataset.on === 'true';
    const prev = S.ed.signatureIdx;
    if (!on) {
      if (prev === i) {
        S.ed.signatureIdx = -1;
        S.ed.signatureNote = '';
        this.renderEdit();
      }
      return;
    }
    if (prev >= 0 && prev !== i) {
      const prevWord = (S.ed.pool[prev] && S.ed.pool[prev].w) || '上一张';
      this.toast(`题眼已从「${prevWord}」移到这张`);
    }
    S.ed.signatureIdx = i;
    S.ed.signatureNudgeSkipped = false;
    this.renderEdit();
  },

  onSignatureNote(e) {
    const S = this.S;
    if (!S.ed) return;
    const v = (e.detail.value || '').slice(0, 30);
    S.ed.signatureNote = v;
    this.setData({ 'edit.signatureNote': v });
  },

  edAddCard() {
    const S = this.S;
    S.ed.pool.push({ w: '', b: '' });
    S.edOpen = S.ed.pool.length - 1;
    this.renderEdit();
  },

  edDelCard(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    const wasSig = S.ed.signatureIdx === i;
    S.ed.pool.splice(i, 1);
    if (wasSig) {
      S.ed.signatureIdx = -1;
      S.ed.signatureNote = '';
      S.ed.signatureNudgeSkipped = false;
      this.toast('这张卡是题眼，删除后题眼将取消');
    } else if (S.ed.signatureIdx > i) {
      S.ed.signatureIdx -= 1;
    }
    S.edOpen = null;
    this.renderEdit();
  },

  validateCraft(d) {
    const errs = [];
    if (!(d.title || '').trim() || d.title.trim().length < 2) errs.push('标题：至少 2 个字');
    if (!(d.intro || '').trim() || d.intro.trim().length < 10) errs.push('简介：至少 10 个字，给抽卡人一个预期');
    if (!d.coverImage) errs.push('封面：请上传一张 3:4 的卡集封面');
    const complete = d.pool.filter(cardDone);
    if (complete.length < 8) errs.push(`完整的卡：至少 8 张，现在 ${complete.length} 张（词、解释都齐才算完整）`);
    const long = d.pool.filter(c => (c.w || '').trim().length > 8);
    if (long.length) errs.push(`有 ${long.length} 张卡的词超过 8 个字`);
    if (d.price > 0 && d.trial !== 1) errs.push('定价卡集：需要 1 张免费试抽');
    return errs;
  },


  skipSignatureNudge() {
    const S = this.S;
    if (!S.ed) return;
    S.ed.signatureNudgeSkipped = true;
    this.setData({ 'nudge.show': false });
    this.tryPublish();
  },

  goSignatureNudge() {
    const S = this.S;
    if (!S.ed) return;
    this.setData({ 'nudge.show': false });
    S.edOpen = 0;
    this.renderEdit();
    this.toast('在卡片里打开「设为本集题眼」');
    wx.pageScrollTo({ selector: '.ed-card', duration: 220 });
  },

  closeCheck() {
    this.setData({ 'check.show': false });
  },

  closePub() {
    this.setData({ 'pub.show': false });
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
    this.setData({
      edit: {
        mode: 'review',
        headTitle: '审核中',
        title: d.title,
        intro: d.intro,
        submitted: d.submitted || '',
        meta: `${d.type === 'collect' ? '收藏集' : '常驻集'} · ${catChipOf(d.cat)} · ${complete.length} 张 · ${d.price > 0 ? `¥${d.price}（前 ${d.trial} 张免费试抽）` : '免费'}`,
        signatureOn: d.signatureIdx >= 0,
        cards: d.pool.map((c, i) => ({ c, i })).filter(x => cardDone(x.c))
          .map(x => ({ badge: '', w: x.c.w, b: x.c.b, isSig: x.i === d.signatureIdx })),
        count: complete.length,
      },
    });
  },




  /* ──────────────────────────────────────────────────────────
     收益看板
     ────────────────────────────────────────────────────────── */



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
    const avail = this.S.incomeData ? this.S.incomeData.avail : null;
    const collectMine = S.sets.filter(s => s.type === 'collect' && s.user);
    const cardN = collectMine.reduce((a, s) => a + (s.user.drawn || 0), 0);
    const stampN = S.sets.reduce((a, s) => a + stampedCount(s), 0);
    const emptied = collectMine.filter(s => s.user.drawn >= s.count).length;

    const drew = S.sets.filter(s => s.user && s.user.todayDrawn).length;
    const can = S.sets.filter(s => setVM(s).act === 'draw').length;
    const rp = S.sets.filter(s => s.user && hasRecPending(s)).length;
    const bits = [`今天抽了 ${drew} 张`];
    if (can > 0) bits.push(`还有 ${can} 个可抽`);
    if (rp > 0) bits.push(`${rp} 张等回信`);
    const todayLine = bits.join(' · ');

    this.setData({
      me: {
        name: ME,
        avatar: '我',
        cardN,
        stampN,
        emptied,
        todayLine,
        craftN,
        availText: this.S.incomeData ? `可提现 ¥${avail.toFixed(2)}` : '收益同步中',
        remindText: (S.remind && S.remind.enabled) ? `明天 ${S.remind.time} 提醒你` : '未开启',
      },
    });
  },

  meToAuthor() {
    this.S.author = ME;
    this.renderAuthor();
    this.go('author');
  },

  meWallet() {
    this.toast('钱包与提现，正在路上。');
  },

  meSettings() {
    this.openRemind();
  },

  /* ═══ D8 · 设置页：提醒我明天的卡 ═══ */
  openRemind() {
    const S = this.S;
    const time = S.remind.time || '21:00';
    this.setData({
      remind: {
        show: true,
        time,
        enabled: !!S.remind.enabled,
        times: REMIND_TIMES.map(t => ({ key: t.key, label: t.label, sub: t.sub, on: t.key === time })),
      },
    });
  },

  closeRemind() { this.setData({ 'remind.show': false }); },

  pickRemindTime(e) {
    const k = e.currentTarget.dataset.key;
    if (!k) return;
    const times = (this.data.remind.times || []).map(t => Object.assign({}, t, { on: t.key === k }));
    this.setData({ 'remind.time': k, 'remind.times': times });
  },

  enableRemind() {
    const S = this.S;
    const time = this.data.remind.time || '21:00';
    if (!TMPL_IDS || !TMPL_IDS.length) { this.toast('订阅模板还没配好，明天再试试'); return; }
    wx.requestSubscribeMessage({
      tmplIds: TMPL_IDS,
      success: (res) => {
        if (res[TMPL_IDS[0]] === 'accept') {
          S.remind.enabled = true;
          S.remind.time = time;
          try { wx.setStorageSync('dsm_remind_ts', String(Date.now())); } catch (e) {}
          api.reportRemindAuth({ enabled: true, time }).catch(() => {});
          this.setData({ 'remind.show': false, 'remind.enabled': true });
          this.toast(`明天的 ${time}，提醒你`);
          this.renderMe();
        } else {
          this.toast('没关系的，想开随时开');
        }
      },
      fail: () => this.toast('没开成，稍后再试'),
    });
  },

  disableRemind() {
    const S = this.S;
    S.remind.enabled = false;
    try { wx.removeStorageSync('dsm_remind_ts'); } catch (e) {}
    api.reportRemindAuth({ enabled: false, time: S.remind.time }).catch(() => {});
    this.setData({ 'remind.enabled': false });
    this.toast('已关闭 · 想开随时开');
    this.renderMe();
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
        saving: false,
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
        that.cropRecordPhoto(file.tempFilePath);
      },
    });
  },

  /* 选图后进入原生裁剪：固定 4:3，可拖动/缩放确认 */
  cropRecordPhoto(src) {
    if (!src) return;
    if (typeof wx.cropImage !== 'function') {
      this.applyRecordPhoto(src);
      this.toast('当前版本不支持裁剪，已使用原图');
      return;
    }
    wx.cropImage({
      src,
      cropScale: '4:3',
      success: (res) => {
        if (res && res.tempFilePath) {
          this.applyRecordPhoto(res.tempFilePath);
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        if (/cancel/i.test(msg)) return;
        this.applyRecordPhoto(src);
        this.toast('裁剪失败，已使用原图');
      },
    });
  },

  applyRecordPhoto(path) {
    this.S.rcTmp.img = path;
    this.setData({
      'record.img': path,
      'record.hasImg': true,
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

  async saveStamp() {
    const S = this.S;
    const rc = S.rc;
    if (!rc || S.rcSaving) return;
    const s = S.sets.find(x => x.id === rc.sid);
    if (!s) return;
    const note = (this.data.record.note || '').trim().slice(0, 50);
    const img = S.rcTmp.img || '';
    if (!img && !note) { this.toast('写一句话，或选一张图，再盖邮戳。'); return; }

    S.rcSaving = true;
    this.setData({ 'record.saving': true });
    try {
      let imgFileID = '';
      if (img) imgFileID = (await api.uploadImage(img)).fileID;
      const r = await api.saveStamp({ setId: rc.sid, idx: rc.idx, note, imgFileID });

      /* 本地即时更新（显示缓存；onShow listSets 会与 store 对齐） */
      if (!s.user) {
        s.user = { drawn: 0, trialUsed: 0, unlocked: true, todayDrawn: true, got: [], recs: {}, todayIdx: rc.idx };
      }
      const u = s.user;
      if (!u.recs) u.recs = {};
      if (s.type === 'resident') {
        const arr = Array.isArray(u.recs[rc.idx]) ? u.recs[rc.idx] : (u.recs[rc.idx] ? [u.recs[rc.idx]] : []);
        arr.push(r.rec);
        u.recs[rc.idx] = arr;
      } else {
        u.recs[rc.idx] = r.rec;
      }

      tracker.t('stamp_done', { sid: rc.sid, img: !!img });
      this.setData({ 'record.show': false, 'record.saving': false });
      const weekly = this.weeklyState(s);
      const weeklyFresh = weekly.ready && weekly.stampN === 7 && !this.isWeeklyMade(s, weekly.weekNo);
      if (weeklyFresh) this.toast('本周集齐 7 张 · 可以生成周记了');
      else if (rc.from === 'draw') this.toast('已盖上今天的邮戳');
      else this.toast('已盖上邮戳，可以分享这张明信片了');

      if (rc.from === 'draw' && this.__page === 'draw') {
        const back = this._dwBack(s, rc.idx);
        back.stampAnim = true;
        this.setData({
          'draw.back': back, 'draw.backIdx': rc.idx,
          'draw.front': this._dwFront(s, rc.idx),
          'draw.flipped': true,
          'draw.hint': '轻触卡面 · 翻到另一面',
        });
        setTimeout(() => {
          if (this.data.draw) {
            this.setData({ 'draw.back.stampAnim': false });
            this.renderDraw();
          }
        }, 620);
      } else {
        if (this.data.bigCard.show) {
          const back = this.buildCardBack(s, rc.idx, 'big');
          back.stampAnim = true;
          this.setData({ 'bigCard.back': back, 'bigCard.flipped': true });
        } else {
          this.showBigCard(s.id, rc.idx, { flipped: true, stampAnim: true });
        }
        setTimeout(() => { if (this.data.bigCard) this.setData({ 'bigCard.back.stampAnim': false }); }, 620);
        if (this.__page === 'cards') this.renderSubs();   // 当前页状态即时刷新
        if (this.__page === 'set') this.renderSetPage();  // stampRow 即时刷新
        if (this.__page === 'map') this.renderMap();      // 格子徽标即时刷新
        if (this.__page === 'draw') {                     // 抽卡页还在背后：同步卡背
          const dwBack = this._dwBack(s, rc.idx);
          dwBack.stampAnim = true;
          this.setData({
            'draw.back': dwBack, 'draw.backIdx': rc.idx,
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
      }
      S.rc = null;
      S.rcSaving = false;
    } catch (e) {
      S.rcSaving = false;
      this.setData({ 'record.saving': false });
      this.toast((e && e.message) || '没盖上，再试一次');
    }
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
      return;
    }
    // api 返回的 drawnLog 只有 {idx,ts}，补齐页面周记需要的展示日期
    u.drawnLog.forEach(e => {
      if (!e || e.date || !e.ts) return;
      const d = new Date(e.ts);
      e.date = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    });
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
      return { idx: l.idx, word: c.w, sig: l.idx === s.signatureIdx, wordCls: bwCls(c.w) };
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
    if (this.__page === 'set') this.renderSetPage();
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
      tracker.t('poster_save', { type: 'weekly' });
      this.markWeeklyMade(s, data.weekNo);
      this.renderSubs();
      if (this.__page === 'set') this.renderSetPage();
      if (this.data.poster.show) this.setData({ 'poster.show': false });
      this.toast(ratio === '916' ? '朋友圈版已保存 📸' : '周记已保存到相册 📸');
    } catch (err) {
      console.warn(err);
      this.toast('生成失败，请重试');
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
    if (type === 'memorial') {
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
    if (data.rec) {
      const sec = data.rec.sec || {};
      if (sec.text === 'pending') { this.toast('回信安全校验中 · 稍等片刻再分享'); return; }
      if (sec.text === 'risky') { this.toast('这条回信暂不支持生成海报'); return; }
      if (data.rec.img) {
        if (sec.media === 'pending') { this.toast('照片安全校验中 · 稍等片刻再分享'); return; }
        if (sec.media === 'risky') { this.toast('这张照片暂不支持生成海报'); return; }
      }
    }
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
    const u0 = s.user || {};
    const blocked = (u0.got || []).some(i => {
      const r0 = getRec(u0, i);
      return !!(r0 && r0.img && r0.sec && (r0.sec.media === 'pending' || r0.sec.media === 'risky'));
    });
    if (blocked) { this.toast('有照片还在安全校验中 · 稍后再翻开纪念册'); return; }
    const full = variant === 'full';
    const u = s.user || {};
    const got = u.got || [];
    const stN = stampedCount(s);
    const sigLit = s.signatureIdx >= 0 && got.includes(s.signatureIdx);
    const miss = Math.max(0, got.length - stN);
    let firstD = '';
    let lastD = '';
    got.forEach(i => {
      const r = getRec(u, i);
      if (r && r.date) { if (!firstD) firstD = r.date; lastD = r.date; }
    });
    const sections = got.map((idx, n) => {
      const c = s.pool[idx] || { w: '', b: '' };
      const rec = getRec(u, idx);
      return {
        idx,
        n,
        tilt: n % 2 ? 'tilt-r' : 'tilt-l',
        sig: idx === s.signatureIdx,
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
        sigLit,
        miss,
        firstD,
        lastD,
        date: todayDot(),
        sections,
      },
    });
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
      tracker.t('poster_save', { type: this.S.posterType });
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


  /* D5：收益基类最小 no-op；实际逻辑在 d4/d5 override */
  renderIncome() {},
  doWithdraw() {},
};

/* ═══════════ D3 · 覆盖：导航 / getFeed / 互动 / 周记 ═══════════ */
const overrides = {

  /* hub 子页进入/切换：渲染统一收口 */

  applySetPayload(p) { return core.applySetPayload(p); },

  retryBoot() {
    this.setData({ bootError: false });
    core.ensureBoot().then(() => {
      this.renderHome(); this.renderSubs(); this.renderMe(); this.renderCraft();
    }).catch(() => this.setData({ bootError: true }));
  },

  openSetById(id, from) {
    this.S.shareSid = null;
    this.S.cur = Number(id);
    this._setRecTab = 'related';
    this.go('set');
    tracker.t('set_view', { sid: Number(id) });
  },

  openSet(e) {
    const d = e.currentTarget.dataset;
    this.openSetById(Number(d.id), d.from || 'home');
  },

  startDraw(sid) {
    const s = this.S.sets.find(x => x.id === sid);
    if (!s || setVM(s).act !== 'draw') return;
    this.S.cur = sid;
    this._recOffsets = this._recOffsets || {};
    this._recOffsets['draw:' + sid] = 0;
    this.go('draw');
  },

  openMap(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset.id != null
      ? Number(e.currentTarget.dataset.id) : this.S.cur;
    this.S.cur = id;
    this.go('map');
  },

  openEdit(id) {
    const d = this.S.craft.drafts.find(x => x.id === Number(id));
    if (!d) { this.go('create'); return; }
    this.S.ed = d; this.S.rv = null;
    this.S.edOpen = d.pool.length ? 0 : null;
    this.go('edit');
  },

  openReview(e) {
    const id = Number(e.currentTarget.dataset.id);
    const d = this.S.craft.reviewing.find(x => x.id === id);
    if (!d) { this.go('create'); return; }
    this.S.rv = d; this.S.ed = null;
    this.go('edit');
  },

  goIncome() { this.go('income'); },
  openAuthorPage(e) {
    const d = e.currentTarget.dataset;
    this.S.author = d.name;
    this.go('author');
  },
  goSetView(id) { if (id != null) this.S.cur = id; this.go('set'); },
  backToCreate() { this.go('create'); },
  backToHome() { this.go('home'); },

  /* D012：锁定行落 set 页，不直弹付费墙 */
  goSubsDraw(sid, from) {
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    this.S.cur = sid;
    if (setVM(s).act === 'draw') this.startDraw(sid);
    else this.goSetView(sid);
  },
  goSubsView(sid, from) {
    this.goSetView(sid);
  },

  /* 订阅页 getFeed 版 */
  async renderSubs() {
    try {
      const feed = await api.getFeed();
      const now = new Date();
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      const labels = ['一', '二', '三', '四', '五', '六', '日'];
      const rowOf = (r, extra) => {
        const cov = r.covT || '·';
        return Object.assign({
          id: r.setId, title: r.title || '',
          charA: cov.slice(0, 1), charB: cov.slice(1, 2) || '',
          idx: r.todayIdx,
          prog: r.resident ? '已拆 ' + r.drawn + ' 封'
            : (r.status === 'done' ? r.count + ' 张' : r.got + ' / ' + r.count),
        }, extra);
      };
      const today = feed.today.map(r => rowOf(r, {
        status: r.status === 'locked' ? '待解锁 · ¥' + r.price : (r.resident ? '今日可抽' : '今天的信到了'),
        statusCls: 'go', tap: 'draw', todo: true,
      }));
      const subscribed = feed.subscribed.map(r => rowOf(r,
        r.status === 'waiting_reply'
          ? { status: '等你回信', statusCls: 'wait', tap: 'stamp', todo: true }
          : { status: '已盖戳', statusCls: 'quiet', tap: 'big', todo: false }
      )).sort((a, b) => (b.todo ? 1 : 0) - (a.todo ? 1 : 0));
      const done = feed.done.map(r => rowOf(r, { status: '已集齐', statusCls: 'gold', tap: 'booklet', todo: false }));

      let weekGoal = null;
      if (feed.weekGoal) {
        const wp = feed.weekGoal;
        const dots = wp.dots.map((d, i) => ({
          cls: d.isPast ? (d.drawn ? 'on' : 'miss')
            : (d.isToday ? (d.drawn ? 'on today' : 'today') : 'future'),
          label: labels[i],
        }));
        let title, sub;
        if (wp.full) { title = '本周 7 天集齐'; sub = '点这里，把这一周装订成周记 ✦'; }
        else if (wp.done === 0) { title = '这周，还没开张'; sub = '抽一张，为这周开个头'; }
        else { title = `本周已抽 ${wp.done} 天`; sub = `再抽 ${wp.left} 天，装订本周周记`; }
        weekGoal = { done: wp.done, total: 7, left: wp.left, full: wp.full, title, sub, dots };
      }

      let greeting = null;
      if (feed.greeting) {
        const g = feed.greeting;
        greeting = {
          days: g.days, sid: g.suggestSetId,
          sub: `你不在的 ${g.days} 天，卡都好好收着，一张也没少`,
          cta: g.canDrawN > 1 ? `今天有 ${g.canDrawN} 个卡集可抽`
            : (g.canDrawN === 1 ? '今天有 1 个卡集可抽' : '今天没有新卡，随便看看'),
        };
      }

      let weekly = null;
      if (feed.weekly) {
        const s = this.S.sets.find(x => x.id === feed.weekly.setId);
        weekly = { sid: feed.weekly.setId, title: (s && s.title) || '', weekNo: feed.weekly.weekNo };
      }

      const firstDraw = today[0] || null;
      const firstWait = subscribed.find(r => r.todo) || null;
      this.setData({
        bootError: false,
        subs: {
          date: (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + wd,
          total: feed.total,
          remindDraw: firstDraw ? { n: today.length, sid: firstDraw.id } : null,
          remindStamp: firstWait ? { n: feed.stats.waiting, sid: firstWait.id, idx: firstWait.idx } : null,
          statCan: feed.stats.canDraw, statCards: feed.stats.cards, statEmpty: feed.stats.emptied,
          today, subscribed, done, weekly, weekGoal, greeting,
        },
      });
    } catch (e) {
      const cur = this.data.subs || {};
      if (!(cur.today && cur.today.length)) this.setData({ bootError: true });
    }
  },

  toggleSetLike() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    api.toggleLike({ setId: s.id }).then(r => {
      this.S.social[s.id] = { liked: r.liked, likes: r.likes };
      const patch = {};
      if (this.data.setPage && this.data.setPage.exists) {
        patch['setPage.social.liked'] = r.liked;
        patch['setPage.social.likes'] = r.likes;
        patch['setPage.social.likesText'] = fmt(r.likes);
        patch['setPage.likePop'] = true;
      }
      if (this.data.draw && this.data.draw.stage === 'after') {
        patch['draw.social.liked'] = r.liked;
        patch['draw.social.likes'] = r.likes;
        patch['draw.social.likesText'] = fmt(r.likes);
        patch['draw.likePop'] = true;
      }
      this.setData(patch);
      setTimeout(() => {
        const off = {};
        if (this.data.setPage && this.data.setPage.exists) off['setPage.likePop'] = false;
        if (this.data.draw) off['draw.likePop'] = false;
        this.setData(off);
      }, 320);
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    }).catch(() => this.toast('没点上，再试一次'));
  },

  openComments() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s) return;
    const cached = (this.S.comments[s.id] || []).slice();
    const draft = this.S.commentDrafts[s.id] || '';
    this.setData({
      'home.catSheet': false,
      commentsSheet: {
        show: true, sid: s.id, title: s.title || '',
        items: cached, count: cached.length,
        canComment: this._canComment(s),
        draft, draftLen: draft.length, sending: false,
      },
    });
    api.getComments(s.id).then(items => {
      if (this.data.commentsSheet.sid !== s.id) return;
      this.S.comments[s.id] = items;
      this.setData({ 'commentsSheet.items': items, 'commentsSheet.count': items.length });
    }).catch(() => {});
  },

  async submitComment() {
    const sheet = this.data.commentsSheet;
    if (sheet.sending) return;
    const text = (sheet.draft || '').trim();
    if (!text) { this.toast('写一句话再发送'); return; }
    const s = this.S.sets.find(x => x.id === sheet.sid);
    if (!s) return;
    this.setData({ 'commentsSheet.sending': true });
    try {
      const r = await api.addComment({ setId: s.id, text });
      if (!this.S.comments[s.id]) this.S.comments[s.id] = [];
      this.S.comments[s.id].unshift(r.comment);
      this.S.commentDrafts[s.id] = '';
      const items = this.S.comments[s.id];
      const patch = {
        commentsSheet: Object.assign({}, sheet, {
          items, count: items.length, draft: '', draftLen: 0, sending: false,
        }),
      };
      if (this.data.setPage && this.data.setPage.exists) {
        patch['setPage.social.commentCount'] = items.length;
        patch['setPage.social.commentText'] = items.length + ' 条留言';
      }
      this.setData(patch);
      if (wx.hideKeyboard) wx.hideKeyboard();
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      this.toast(r.status === 'visible' ? '已留下这句话' : '收到了 · 通过后会显示出来');
    } catch (e) {
      this.setData({ 'commentsSheet.sending': false });
      if (e && e.code === 'SEC_REJECTED') this.toast('这句话发不出去 · 换个说法试试');
      else this.toast('没发出去，再试一次');
    }
  },

  /* set 页元信息异步补齐 */
  refreshSetMeta(sid) {
    api.getSet(sid).then(p => {
      if (p.fans) this.S.fans[p.creator] = p.fans;
      if (p.social) this.S.social[p.id] = { liked: !!p.social.liked, likes: p.social.likes || 0 };
      if (!(this.data.setPage && this.data.setPage.id === sid)) return;
      this.setData({
        'setPage.fansText': p.fans ? fmt(p.fans) + ' 位关注者' : '做卡人',
        'setPage.social.commentCount': p.commentCount,
        'setPage.social.commentText': p.commentCount ? p.commentCount + ' 条留言' : '写第一条留言',
      });
    }).catch(() => {});
    api.getComments(sid).then(items => {
      this.S.comments[sid] = items;
      if (!(this.data.setPage && this.data.setPage.id === sid)) return;
      this.setData({
        'setPage.social.commentCount': items.length,
        'setPage.social.commentText': items.length ? items.length + ' 条留言' : '写第一条留言',
      });
    }).catch(() => {});
  },

  /* renderSetPage 之后补 fans/留言 */
  renderSetPage() {
    PAGE_OPTS.renderSetPage.call(this);
    if (this.S && this.S.cur != null) this.refreshSetMeta(this.S.cur);
  },

  /* 周记：本地即时 + 服务端记录 */
  markWeeklyMade(s, weekNo) {
    this.S.weeklyMade[this.weeklyKey(s, weekNo)] = true;
    api.markWeekly({ setId: s.id, weekNo }).catch(() => {});
    tracker.t('weekly_make', { sid: s.id, weekNo });
  },

  /* 抽卡成功：不再维护 S.activity，不再跨页 render */
  _afterDrawnApi(res) {
    this._pendingDraw = null;
    const s = this.applySetPayload(res.set);
    if (!s) return;
    const S = this.S;

    const firstReveal = !!(res.sig && res.sig.firstReveal);
    if (firstReveal) {
      S.sigFirst = true;
      setTimeout(() => { S.sigFirst = false; }, 1100);
    }

    this.renderDraw();

    if (res.result === 'completed') {
      setTimeout(() => this.openDoneView(), 400);
      return;
    }

    if (firstReveal) {
      setTimeout(() => { if (this.__page === 'draw') this.setData({ 'draw.sigBar': true }); }, 500);
      setTimeout(() => {
        if (this.__page !== 'draw') return;
        this.setData({ 'draw.sigStamp': true });
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      }, 650);
      setTimeout(() => {
        if (this.__page === 'draw') this.setData({ 'draw.hint': '本集题眼 · 做卡人最想送你的一张' });
      }, 900);
    }

    if (res.weekGoal && res.weekGoal.justFull) {
      setTimeout(() => this.toast('本周 7 天集齐 · 可以装订本周周记了'), 1800);
    }

    if (res.result === 'drawn') tracker.t('draw_done', { sid: s.id });

    /* D8 · 首抽引导屏（一次性；题眼首抽等金色链播完再弹） */
    if (res.result === 'drawn' && !res.done && !wx.getStorageSync('dsm_onboarded')) {
      wx.setStorageSync('dsm_onboarded', '1');
      const obDelay = firstReveal ? 2100 : 1400;
      setTimeout(() => {
        if (this.__page === 'draw' && this.data.draw && this.data.draw.stage === 'after'
            && !this.data.onboard.show) {
          this.setData({ 'onboard.show': true });
        }
      }, obDelay);
    }

    if (res.done) {
      const delay = (res.sig && res.sig.isSig) ? 2600 : 600;
      setTimeout(() => this.openDoneView(), delay);
    }
  },
};

/* ═══════════ D4 · set/draw 独立 + 守卫 + 收益 api ═══════════ */
const d4Overrides = {


  retryBoot() {
    this.setData({ booting: true, bootError: false });
    core.ensureBoot().then(() => { this.__renderSelf(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },

  goSetView(id) {
    if (id != null) this.S.cur = id;
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const beneath = stack.length > 1 ? stack[stack.length - 2] : null;
    if (beneath && beneath.route === 'pages/set/index') { wx.navigateBack(); return; }
    wx.redirectTo({ url: '/pages/set/index' + (this.S.cur != null ? '?sid=' + this.S.cur + '&nav=1' : '') });
  },


  backToSet() {
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const beneath = stack.length > 1 ? stack[stack.length - 2] : null;
    if (beneath && beneath.route === 'pages/set/index') wx.navigateBack();
    else wx.redirectTo({ url: '/pages/set/index' + (this.S.cur != null ? '?sid=' + this.S.cur + '&nav=1' : '') });
  },


  backFromIncome() {
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (stack.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/create/index' });
  },

  backToCreate() { wx.switchTab({ url: '/pages/create/index' }); },
  backToHome()   { wx.switchTab({ url: '/pages/home/index' }); },

  /* 订阅页/首页跳详情：走独立 set 页，不替换当前 tab */
  goSubsDraw(sid, from) {
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    this.S.cur = sid;
    if (setVM(s).act === 'draw') this.startDraw(sid);
    else this.go('set');
  },
  goSubsView(sid, from) {
    if (sid != null) this.S.cur = sid;
    this.go('set');
  },

  /* ── render 守卫 ── */
  renderHome() {
    if (this.__page !== 'home') return;
    PAGE_OPTS.renderHome.call(this);
  },
  renderSubs() {
    if (this.__page !== 'cards') return;
    return overrides.renderSubs.call(this);
  },
  renderCraft() {
    if (this.__page !== 'create') return;
    PAGE_OPTS.renderCraft.call(this);
  },
  renderMe() {
    if (this.__page !== 'me') return;
    PAGE_OPTS.renderMe.call(this);
  },
  renderSetPage() {
    if (this.__page !== 'set') return;
    overrides.renderSetPage.call(this);
  },
  renderDraw() {
    if (this.__page !== 'draw') return;
    PAGE_OPTS.renderDraw.call(this);
  },

  /* ── doUnlock：draw 页原地续抽 ── */
  doUnlock() {
    const S = this.S;
    if (!S.pw || this.data.pay.paying) return;
    const targetId = S.pw;
    this.setData({ 'pay.paying': true, 'pay.payText': '支付中…' });
    api.unlock({ setId: targetId })
      .then(res => {
        S.pw = null;
        this.applySetPayload(res.set);
        this.setData({ 'pay.show': false, 'pay.paying': false });
        this.__renderSelf();
        const s = S.sets.find(x => x.id === targetId);
        if (s && s.user && !s.user.todayDrawn && !s.user.trialToday) {
          this.toast('解锁成功，这张签送你。');
          if (this.__page === 'draw') {
            this.renderDraw();
            setTimeout(() => this.tapEnvelope(), 260);
          } else {
            setTimeout(() => this.startDraw(s.id), 260);
          }
        } else {
          this.toast('已解锁。今天的卡，明天 0 点到。');
        }
      })
      .catch(() => {
        this.setData({ 'pay.paying': false, 'pay.payText': `解锁 · ¥${this.data.pay.price}` });
        this.toast('支付未完成，请重试');
      });
  },

  /* ── 收益 api 化 ── */
  async renderIncome() {
    if (this.__page !== 'income') return;
    try {
      const d = await api.getIncome();
      this.S.incomeData = d;
      const paidSets = d.bySet || [];
      this.setData({
        bootError: false,
        income: {
          exists: true,
          totalText: `¥${d.total.toFixed(2)}`,
          availText: `¥${d.avail.toFixed(2)}`,
          pendingText: `¥${d.pending.toFixed(2)}`,
          withdrawnText: `¥${d.withdrawn.toFixed(2)}`,
          platformText: `¥${(d.platform || 0).toFixed(2)}`,
          paidTotalText: `¥${paidSets.reduce((a, x) => a + (x.earn || 0), 0).toFixed(2)}`,
          buyersTotal: paidSets.reduce((a, x) => a + (x.buyers || 0), 0),
          threshold: d.threshold,
          canWithdraw: d.avail >= d.threshold,
          withdrawPct: Math.min(100, d.avail / d.threshold * 100),
          withdrawLabel: d.avail >= d.threshold ? `已达标 · 可提现 ¥${d.avail.toFixed(2)}` : `还差 ¥${(d.threshold - d.avail).toFixed(2)} 即可提现`,
          withdrawBtn: d.avail >= d.threshold ? `提现到微信零钱 · ¥${d.avail.toFixed(2)}` : `满 ¥${d.threshold} 可提现`,
          hasPending: d.pending > 0,
          showComposition: paidSets.length > 0 || (d.platform || 0) > 0,
          paidSetN: paidSets.length,
          bySet: paidSets.map(x => ({
            title: x.title,
            meta: `${x.buyers || 0} 人解锁 · ¥${x.price} · 份额 80%`,
            val: `¥${(x.earn || 0).toFixed(2)}`,
          })),
          txns: (d.txns || []).map(t => ({
            d: t.d, meta: t.meta, amt: `+¥${t.amt.toFixed(2)}`,
            title: `平台激励 · ${t.t}`,
          })),
          showDetail: d.total > 0,
        },
      });
    } catch (e) {
      if (!(this.data.income && this.data.income.exists)) this.setData({ bootError: true });
    }
  },

  async doWithdraw() {
    const d = this.S.incomeData;
    if (!d || d.avail < d.threshold) return;
    this.toast(`提现 ¥${d.avail.toFixed(2)} 已申请，1–3 个工作日到账。`);
    try {
      this.S.incomeData = await api.withdraw();
      this.renderIncome();
    } catch (e) {
      this.toast((e && e.message) || '提现没成功，再试一次');
    }
  },


  refreshIncome() {
    return api.getIncome().then(d => { this.S.incomeData = d; }).catch(() => {});
  },
};

/* ═══════════ D5 · 全页面独立 + craft/author api ═══════════ */
const d5Overrides = {
  go(id) {
    if (TABS.includes(id)) {
      if (this.__page === id) return;
      wx.switchTab({ url: '/pages/' + id + '/index' });
      return;
    }
    const url = core.PAGE_ROUTES[id];
    if (url) { wx.navigateTo({ url }); return; }
    wx.switchTab({ url: '/pages/home/index' });
  },

  __renderSelf() {
    const p = this.__page;
    const S = this.S;
    if (p === 'home') this.renderHome();
    else if (p === 'cards') this.renderSubs();
    else if (p === 'create') this.renderCraft();
    else if (p === 'me') this.renderMe();
    else if (p === 'set' && S.cur != null) this.renderSetPage();
    else if (p === 'draw' && S.cur != null) this.renderDraw();
    else if (p === 'map' && S.cur != null) this.renderMap();
    else if (p === 'edit') { if (S.rv) this.renderReview(); else if (S.ed) this.renderEdit(); }
    else if (p === 'income') this.renderIncome();
    else if (p === 'author' && S.author) this.renderAuthor();
  },

  renderMap() {
    if (this.__page !== 'map') return;
    PAGE_OPTS.renderMap.call(this);
  },
  renderEdit() {
    if (this.__page !== 'edit') return;
    PAGE_OPTS.renderEdit.call(this);
  },
  renderReview() {
    if (this.__page !== 'edit') return;
    PAGE_OPTS.renderReview.call(this);
  },

  async renderAuthor() {
    if (this.__page !== 'author') return;
    const name = this.S.author;
    if (!name) return;
    try {
      const d = await api.getAuthor({ name });
      d.works.forEach(p => this.applySetPayload(p));
      this.S.follow[name] = d.followed;
      this.S.fans[name] = d.fans;
      this.setData({
        bootError: false,
        author: {
          exists: true,
          name: d.name,
          avatar: (d.name || '·')[0],
          own: d.own,
          worksN: d.works.length,
          drawnText: fmt(d.works.reduce((a, p) => a + (d.own ? (p.totalDrawn || 0) : (p.heat || 0)), 0)),
          fansText: fmt(d.fans),
          followed: d.followed,
          works: d.works.map(p => ({
            id: p.id, title: p.title, cover: p.cover,
            covT2: (p.covT || '').slice(0, 2),
            meta1: `${p.count} 张 · ${p.type === 'collect' ? '收藏集' : '常驻集'}`,
            meta2: p.price > 0 ? ('¥' + p.price) : '免费',
          })),
        },
      });
    } catch (e) {
      if (!(this.data.author && this.data.author.exists)) this.setData({ bootError: true });
    }
  },

  toggleFollowPage() {
    const name = this.S.author;
    if (!name) return;
    api.toggleFollow({ name }).then(r => {
      this.S.follow[name] = r.followed;
      this.S.fans[name] = r.fans;
      this.setData({ 'author.followed': r.followed, 'author.fansText': fmt(r.fans) });
      this.toast(r.followed ? `已关注 @${name}。` : '已取消关注。');
    }).catch(() => this.toast('没点上，再试一次'));
  },

  toggleFollowSet() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s || !s.creator || s.creator === ME) return;
    api.toggleFollow({ name: s.creator }).then(r => {
      this.S.follow[s.creator] = r.followed;
      this.S.fans[s.creator] = r.fans;
      this.toast(r.followed ? '已关注 @' + s.creator + '。' : '已取消关注。');
      this.renderSetPage();
    }).catch(() => this.toast('没点上，再试一次'));
  },

  /* ── 草稿本地持久化 ── */
  _saveDrafts() {
    clearTimeout(this._draftSaveTimer);
    this._draftSaveTimer = setTimeout(() => {
      if (this.S && this.S.craft) core.craftStore.save(this.S.craft.drafts);
    }, 600);
  },
  _flushDrafts() {
    clearTimeout(this._draftSaveTimer);
    if (this.S && this.S.craft) core.craftStore.save(this.S.craft.drafts);
  },

  refreshCraft() {
    return api.getMyCraft().then(r => {
      this.S.craft.reviewing = r.reviewing;
      r.published.forEach(p => this.applySetPayload(p));
    }).catch(() => {});
  },

  newCraft() {
    PAGE_OPTS.newCraft.apply(this, arguments);
    this._saveDrafts();
  },

  onEditTitle() { PAGE_OPTS.onEditTitle.apply(this, arguments); this._saveDrafts(); },
  onEditIntro() { PAGE_OPTS.onEditIntro.apply(this, arguments); this._saveDrafts(); },
  onEditCardInput() { PAGE_OPTS.onEditCardInput.apply(this, arguments); this._saveDrafts(); },
  edType() { PAGE_OPTS.edType.apply(this, arguments); this._saveDrafts(); },
  edCat() { PAGE_OPTS.edCat.apply(this, arguments); this._saveDrafts(); },
  edPrice() { PAGE_OPTS.edPrice.apply(this, arguments); this._saveDrafts(); },
  edToggleSignature() { PAGE_OPTS.edToggleSignature.apply(this, arguments); this._saveDrafts(); },
  onSignatureNote() { PAGE_OPTS.onSignatureNote.apply(this, arguments); this._saveDrafts(); },
  edAddCard() { PAGE_OPTS.edAddCard.apply(this, arguments); this._saveDrafts(); },
  edDelCard() { PAGE_OPTS.edDelCard.apply(this, arguments); this._saveDrafts(); },
  applyCover() { PAGE_OPTS.applyCover.apply(this, arguments); this._saveDrafts(); },
  clearCover() { PAGE_OPTS.clearCover.apply(this, arguments); this._saveDrafts(); },

  async tryPublish() {
    const S = this.S;
    if (!S.ed || S.ed.publishing) return;
    const errs = this.validateCraft(S.ed);
    if (errs.length) { this.setData({ check: { show: true, list: errs } }); return; }
    if (S.ed.signatureIdx < 0 && !S.ed.signatureNudgeSkipped) {
      this.setData({ nudge: { show: true } });
      return;
    }
    const complete = S.ed.pool.filter(cardDone).length;
    this.setData({
      pub: {
        show: true, publishing: false,
        title: `《${S.ed.title.trim()}》`,
        meta: `${complete} 张 · ${S.ed.type === 'collect' ? '收藏集' : '常驻集'} · ${S.ed.price > 0 ? `¥${S.ed.price}（前 ${S.ed.trial} 张免费试抽）` : '免费'}`,
      },
    });
  },

  async doPublish() {
    const S = this.S;
    if (!S.ed || this.data.pub.publishing) return;
    this.setData({ 'pub.publishing': true });
    try {
      await api.submitCraft({ draft: S.ed });
      const i = S.craft.drafts.indexOf(S.ed);
      if (i > -1) S.craft.drafts.splice(i, 1);
      this._flushDrafts();
      S.ed = null;
      this.setData({ 'pub.show': false, 'pub.publishing': false });
      this.toast('已提交审核。');
      this.go('create');
    } catch (e) {
      this.setData({ 'pub.publishing': false, 'pub.show': true });
      if (e && e.code === 'SEC_REJECTED') this.toast('内容暂时无法公开展示 · 请检查文案或封面');
      else this.toast((e && e.message) || '提交没成功，请重试');
    }
  },
};

const HOOKS = ['onLoad', 'onShow', 'onReady', 'onUnload', 'onShareAppMessage', 'onShareTimeline'];
const PRIVATE = ['_bootFromApi'];

function createPage(name, extra = {}) {
  const base = {};
  Object.keys(PAGE_OPTS).forEach(k => {
    if (HOOKS.includes(k) || PRIVATE.includes(k)) return;
    base[k] = PAGE_OPTS[k];
  });
  Object.assign(base, overrides, d4Overrides, d5Overrides, extra);
  base.__page = name;
  base.data = clone(PAGE_OPTS.data);
  return base;
}

module.exports = { createPage };
