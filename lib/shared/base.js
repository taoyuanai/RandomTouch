/* lib/shared/base.js — 过渡期单一来源：Page(createPage('home')) */
const core = require('../core.js');
const api = require('../../services/api.js');
const tracker = require('../track.js');
const posterKit = require('../../utils/posterKit/export.js');
const { USE_MOCK, API_BASE } = require('../../services/config.js');
const QR_BLANK = '/assets/icons/qr-blank.png'; // 无二维码时给 Canvas 一个透明占位，避免画出假 QR

/* boot 失败时给真机一个可执行的提示（真机禁止 HTTP/IP 请求） */
const BOOT_HINT = USE_MOCK || /^https:\/\//i.test(API_BASE || '')
  ? ''
  : '测试后端不是 HTTPS：真机需配置 HTTPS 域名并加入小程序 request 合法域名；开发者工具/真机调试可开启「不校验合法域名」';
const {
  getViewport,
  BRAND,
  TABS,
  clone,
  pad2,
  todayDot,
  stampDate,
  fmt,
  fmtShort,
  cardDone,
  setVM,
  finishDate,
  getRec,
  recCount,
  hasRecPending,
  stampedCount,
  dateKeyOf,
  todayKey,
  weekMondayKey,
  _keyPlus,
  TMPL_IDS,
  REMIND_TIMES,
  CATS,
  catChipOf,
} = core;

/* 页面组合顺序：PAGE_OPTS（基础 VM/编辑）→ overrides → d4Overrides → d5Overrides → page extra。
 * 只有被包装器显式 `PAGE_OPTS.xxx.call(this)` 调用的基础方法保留；
 * 完全被后层覆盖的基础方法已删除，修改时先确认有效层。 */
const PAGE_OPTS = {
  data: {
    brand: BRAND,
    bootError: false,
    booting: true,
    bootHint: BOOT_HINT,
    statusBarHeight: 20,
    navTop: 64,
    toastMsg: '',
    toastShow: false,
    toastHide: false,
    home: { rows: [], chips: [], sort: 'hot' },
    search: { q: '', rows: [], resultText: '', focus: true,
              suggestions: ['云', '白居易', '咖啡', '早点睡', '关系'] },
    categories: { items: [], total: 0 },
    statsSheet: { show: false, kind: 'cards', title: '', sub: '', cards: [], sets: [] },
    setPage: { exists: false, ctaShow: false, ctaFloating: false },
    draw: null,
    mapV: { cells: [], drawn: 0, count: 0, pct: 0, drawnWords: [] },
    craft: { empty: false, groups: [] },
    edit: { mode: 'edit', cards: [] },
    income: { exists: false },
    author: { exists: false, works: [] },
    me: { cardN: 0, stampN: 0, emptied: 0, todayLine: '' },
    pay: { show: false, paying: false },
    check: { show: false, list: [] },
    pub: { show: false },
    nudge: { show: false },
    record: {
      show: false, mode: 'is-empty', note: '', img: '', hasImg: false, count: 0,
      saveText: '盖上邮戳', saving: false, stamped: false, readOnly: false,
      animate: false, stampDate: '', stampShort: '', no: '', setTitle: '', word: '',
      sid: null, idx: null,
    },
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
      let scene = String(q.scene);
      try { scene = decodeURIComponent(scene); } catch (e) {}
      const m = scene.match(/(?:^|[&?])s=(\d+)/);
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

  /* 冷启动装载：S.sets 从此只来自 api（seed 只活在 mock 里） */


  /* ──────────────────────────────────────────────────────────
     导航 / 轻提示
     ────────────────────────────────────────────────────────── */







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

  _bookRow(s) {
    const cvm = core.setCoverVM(s);
    const subscribers = s.subscribers || 0;
    const soc = this.S && this.S.social && this.S.social[s.id];
    const likes = soc ? (soc.likes || 0) : 0;
    return {
      id: s.id,
      title: s.title,
      noText: cvm.noText,
      creator: cvm.creator,
      isResident: cvm.isResident,
      done: cvm.done,
      tintStyle: cvm.tintStyle,
      ink: cvm.ink,
      coverImage: s.coverImage || '',
      /* V6 · 首页卡集行 */
      catName: core.catChipOf(s.cat),
      priceText: s.price > 0 ? '¥' + s.price : '免费',
      subText: (s.covS || s.intro || '').slice(0, 24),
      metaText: (s.creator ? s.creator + ' · ' : '')
        + fmtShort(subscribers) + ' 订阅 · ' + fmtShort(likes) + ' 心动',
      subtitle: fmtShort(subscribers) + ' 订阅 · ' + fmtShort(likes) + ' 心动',
      subscribersShort: fmtShort(subscribers),
      cover: Object.assign({}, core.coverVMOf(s), { compact: true }),
    };
  },

  renderHome() {
    const S = this.S;
    const sets = S.sets || [];
    const cat = this._hmCat || 'all';
    let pool;
    if (cat !== 'all') pool = sets.filter(s => s.cat === cat);
    else pool = sets.slice().sort((a, b) => S.sort === 'hot'
      ? (b.heat || 0) - (a.heat || 0)
      : (b.date || '').localeCompare(a.date || ''));

    const rows = pool.map(s => this._bookRow(s));
    const cnt = {};
    sets.forEach(s => { cnt[s.cat] = (cnt[s.cat] || 0) + 1; });
    const chipColors = {
      food: '', work: 'honey', city: 'rose', mood: 'rose',
      life: 'mint', bond: 'honey', muse: 'honey', walk: 'mint', know: 'honey',
    };
    const chips = [{ key: 'all', chip: '推荐', color: '', on: cat === 'all' }]
      .concat(CATS.filter(c => cnt[c.key] > 0).map(c => ({
        key: c.key, chip: c.name, color: chipColors[c.key] || '', on: cat === c.key,
      })));
    const now = new Date();
    const wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
    const dailySet = sets.find(x => setVM(x).act === 'draw') || sets[0] || null;
    const daily = dailySet
      ? { id: dailySet.id, title: dailySet.title, canDraw: setVM(dailySet).act === 'draw' }
      : null;
    const catItem = CATS.find(c => c.key === cat);
    const title = cat === 'all' ? '为你推荐' : ((catItem ? catItem.name : '') + '卡集');
    this.setData({
      home: {
        chips, rows, sort: S.sort, daily, title,
        dateText: `${now.getMonth() + 1}月${now.getDate()}日 · ${wd}`,
      },
    });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/index' });
  },

  tapDaily(e) {
    const id = Number(e.currentTarget.dataset.id);
    const s = this.S.sets.find(x => x.id === id);
    if (!s) return;
    if (setVM(s).act === 'draw') this.startDraw(id);
    else this.openSetById(id, 'home');
  },

  stopSearchTimer() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = null;
  },

  onSearchInput(e) {
    const v = String((e.detail && e.detail.value) || '').slice(0, 30);
    this._searchQ = v;
    this.setData({ 'search.q': v });
    this.stopSearchTimer();
    this._searchTimer = setTimeout(() => this.renderSearch(), 120);
  },

  onSearchConfirm() {
    this.stopSearchTimer();
    this.renderSearch();
  },

  tapSearchWord(e) {
    const q = (e.currentTarget.dataset.q || '').slice(0, 30);
    this._searchQ = q;
    this.setData({ 'search.q': q, 'search.focus': false });
    this.renderSearch();
  },

  clearSearch() {
    this.stopSearchTimer();
    this._searchQ = '';
    this.setData({ 'search.q': '', 'search.focus': true });
    this.renderSearch();
  },

  closeSearch() {
    this.stopSearchTimer();
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  _searchScore(s, terms) {
    const title = (s.title || '').toLowerCase();
    const cov = ((s.covT || '') + ' ' + (s.covS || '')).toLowerCase();
    const creator = (s.creator || '').toLowerCase();
    const category = catChipOf(s.cat).toLowerCase();
    const intro = (s.intro || '').toLowerCase();
    const cards = (s.poolText || (s.pool || []).map(c => ((c && c.w) || '') + ' ' + ((c && c.b) || '')).join(' ')).toLowerCase();
    let score = 0;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const inTitle = title.includes(term);
      const inCov = cov.includes(term);
      const inCreator = creator.includes(term);
      const inCategory = category.includes(term);
      const inIntro = intro.includes(term);
      const inCards = cards.includes(term);
      if (!(inTitle || inCov || inCreator || inCategory || inIntro || inCards)) return -1;
      if (inTitle) {
        score += 40;
        if (title === term) score += 120;
        else if (title.startsWith(term)) score += 60;
      }
      if (inCov) score += 15;
      if (inCreator) score += 35;
      if (inCategory) score += 30;
      if (inIntro) score += 15;
      if (inCards) score += 10;
    }
    return score;
  },

  renderSearch() {
    const base = this.data.search || {};
    const q = String(this._searchQ || '').trim();
    if (!q) {
      this.setData({ search: Object.assign({}, base, { q: '', rows: [], resultText: '' }) });
      return;
    }
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (this.S.sets || [])
      .map(s => ({ s, score: this._searchScore(s, terms) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score
        || (b.s.heat || 0) - (a.s.heat || 0)
        || (b.s.date || '').localeCompare(a.s.date || ''))
      .map(x => this._bookRow(x.s));
    this.setData({
      search: Object.assign({}, base, {
        q,
        rows,
        resultText: rows.length ? `“${q}” · ${rows.length} 个卡集` : '',
      }),
    });
  },


  setCat(e) {
    this._hmCat = e.currentTarget.dataset.key || 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  /* 三宫格：分类 → 九类索引页 */
  tapQuickCat() {
    this.goCategories();
  },

  goCategories() {
    wx.navigateTo({ url: '/pages/categories/index' });
  },

  renderCategories() {
    const sets = this.S.sets || [];
    const items = CATS.map(c => {
      const pool = sets.filter(s => s.cat === c.key)
        .sort((a, b) => (b.heat || 0) - (a.heat || 0)
          || (b.date || '').localeCompare(a.date || ''));
      const rep = pool[0] || null;
      const cvm = rep ? core.setCoverVM(rep) : null;
      const t = core.inkTints(c.key);
      const count = pool.length;
      return {
        key: c.key,
        name: c.name,
        count,
        countText: count ? count + ' 个卡集' : '待上新',
        empty: !count,
        coverImage: rep ? (rep.coverImage || '') : '',
        coverNo: cvm ? cvm.noText : '',
        coverText: rep ? ((rep.covT || rep.title || '').slice(0, 4)) : '待上新',
        tintStyle: cvm ? cvm.tintStyle : '',
        ink: cvm ? cvm.ink : t.ink,
        cover: rep
          ? Object.assign({}, core.coverVMOf(rep), { compact: true })
          : {
            variant: core.COVER_VARIANT[c.key] || 'arch',
            countText: '00', title: '待上新', creator: '',
            coverImage: '', hasImg: false, compact: true,
          },
      };
    });
    this.setData({ categories: { items, total: sets.length } });
  },

  tapCategory(e) {
    const key = e.currentTarget.dataset.key;
    const item = (this.data.categories.items || []).find(x => x.key === key);
    if (!item || item.empty) {
      this.toast('这个分类还没有卡集');
      return;
    }
    this.S.pendingCat = key;
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  consumePendingCat() {
    const key = this.S && this.S.pendingCat;
    if (!key) return false;
    this.S.pendingCat = null;
    this._hmCat = key;
    return true;
  },

  /* 三宫格：热门活动 → 最热榜单 */
  tapQuickHot() {
    this.S.sort = 'hot';
    this._hmCat = 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    this.toast('已切换至热门榜单');
  },

  setSort(e) {
    this.S.sort = e.currentTarget.dataset.sort;
    this.renderHome();
  },


  /* ──────────────────────────────────────────────────────────
     卡集详情
     ────────────────────────────────────────────────────────── */


  renderSetPage() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) {
      this.setData({ setPage: { exists: false } });
      return;
    }
    const u = s.user || {};
    const own = core.isOwnSet(s);
    const hasProgress = !!s.user;
    const subscribed = own ? true : !!s.subscribed;
    const cancelled = !own && !subscribed && hasProgress;
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
    if (!subscribed && hasProgress && !done) {
      cta = {
        tap: 'subscribe', kind: 'brand', text: '重新订阅',
        note: '已收集的卡和邮戳都保留 · 订阅后继续每日一张',
      };
    } else if (done) {
      cta = { tap: 'booklet', kind: 'ink', text: '✦ 查看集齐海报', note: `${count} 张 · 全部点亮` };
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
        tap: 'draw', kind: 'brand', text: '开始今日抽卡',
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

    /* ── V2 · 册子 hero 派生 ── */
    const cvm = core.setCoverVM(s);

    /* ── 公开互动：心动 + 留言 ── */
    const soc = this._socialOf(s);
    const commentItems = this._commentItems(s);
    const commentN = commentItems.length;

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
        coverArt: core.coverVMOf(s),
        heroNo: cvm.noText,
        heroTitle: cvm.title,
        heroTint: cvm.tintStyle,
        heroInk: cvm.ink,
        priceSticker: s.price > 0 ? ('¥' + s.price) : '',
        obiText: s.intro || '',
        disclaimer: s.disclaimer || '',
        isResident: isResident,
        covT: s.covT || s.title || '',
        covS: s.covS || '',
        count: count,
        price: s.price || 0,
        trial: s.trial || 0,
        kind: isResident ? '常驻集' : '收藏集',
        catChip: catChipOf(s.cat),
        heatText: s.heat > 0 ? fmt(s.heat) + ' 人抽过' : '',
        locked: !!(u && s.price > 0 && !core.isOwnSet(s) && !u.unlocked),
        creatorAvatar: (s.creator || '·').slice(0, 1),
        fansText: S.fans && S.fans[s.creator]
          ? fmt(S.fans[s.creator]) + ' 位关注者' : '做卡人',
        fansShort: fmtShort((S.fans && S.fans[s.creator]) || 0),
        subscribers: s.subscribers || 0,
        subscribersShort: fmtShort(s.subscribers || 0),
        following: !!S.follow[s.creator],
        own,
        hasProgress,
        subscribed,
        cancelled,
        canSubscribe: !own && !subscribed && !done,
        subBusy: false,
        prog,
        stampRow,
        trialRow,
        social: {
          liked: !!soc.liked,
          likes: soc.likes || 0,
          likesText: fmt(soc.likes || 0),
          likesShort: fmtShort(soc.likes || 0),
          commentCount: commentN,
          commentText: commentN ? commentN + ' 条留言' : '写第一条留言',
        },
        commentPreview: commentItems[0] || null,
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
      !core.isOwnSet(s) &&
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
      const base = core.isOwnSet(s) ? 0 : Math.max(6, Math.round((s.heat || 0) / 28));
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
    if (core.isOwnSet(s)) return true;
    const u = s.user;
    if (!u) return false;
    return (u.drawn || 0) > 0 || (u.got || []).length > 0 ||
      (u.trialUsed || 0) > 0 || !!u.todayDrawn;
  },


  openRules() {
    this.setData({ 'rulesSheet.show': true });
  },

  closeRules() {
    this.setData({ 'rulesSheet.show': false });
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

  async subscribeSet() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (!s || core.isOwnSet(s) || s.subscribed || (this.data.setPage && this.data.setPage.subBusy)) return;
    const hadProgress = !!s.user;
    this.setData({ 'setPage.subBusy': true });
    try {
      const r = await api.subscribeSet({ setId: s.id });
      if (r && r.set) this.applySetPayload(r.set);
      this.toast(hadProgress ? '已恢复订阅 · 继续每天一张' : '已订阅 · 每天一张');
      this.renderSetPage();
    } catch (e) {
      this.setData({ 'setPage.subBusy': false });
      this.toast((e && e.message) || '订阅没成功，再试一次');
    }
  },

  unsubscribeSet() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    const sp = this.data.setPage;
    if (!s || core.isOwnSet(s) || !s.subscribed || (sp && sp.subBusy)) return;
    const doUnsubscribe = () => {
      this.setData({ 'setPage.subBusy': true });
      api.unsubscribeSet({ setId: s.id }).then(r => {
        if (r && r.set) this.applySetPayload(r.set);
        this.toast('已取消订阅 · 已收集内容保留');
        this.renderSetPage();
      }).catch(e => {
        this.setData({ 'setPage.subBusy': false });
        this.toast((e && e.message) || '取消失败，再试一次');
      });
    };
    if (wx.showModal) {
      wx.showModal({
        title: '取消订阅',
        content: '取消后不再每天收到新卡；已抽到的卡、邮戳和收集进度都会保留。',
        confirmText: '取消订阅',
        confirmColor: '#D04A12',
        success: (r) => { if (r.confirm) doUnsubscribe(); },
      });
    } else {
      doUnsubscribe();
    }
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
      case 'subscribe':
        this.subscribeSet();
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



  /* ──────────────────────────────────────────────────────────
     抽卡 / 信封
     ────────────────────────────────────────────────────────── */

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

  /* ═══ V1 · 卡面 VM（印刷面/书写面同源构建）═══ */
  _cardVM(s, idx, from) {
    const t = core.inkTints(s.cat);
    const card = (s.pool || [])[idx] || {};
    const word = card.w || '';
    const isKey = idx === s.signatureIdx;
    const wCls = core.wordClsOf(word.length, isKey);
    const rec = getRec(s.user, idx);
    const stamped = !!rec;
    const twoRows = !isKey && (wCls === 'w3' || wCls === 'w4' || wCls === 'w5');
    const mid = twoRows ? Math.ceil(word.length / 2) : 0;
    return {
      sid: s.id, idx, from: from || 'big',
      no: pad2(idx + 1),
      series: (s.title || '').slice(0, 6),
      ink: t.ink, inkLine: t.line, inkFaint: t.faint,
      word, isKey, wCls, kwCls: core.kwClsOf(word.length),
      row1: twoRows ? word.slice(0, mid) : '',
      row2: twoRows ? word.slice(mid) : '',
      wordChars: isKey ? word.split('') : [],
      backText: card.b || '',
      stamped, stampAnim: false,
      sigBar: false, sigStamp: false,
      note: stamped ? (rec.note || '') : '',
      photo: stamped && rec.img ? rec.img : '',
      photoMode: !!(stamped && rec.img),
      pmkDate: stamped ? (rec.dateText || rec.stampDate || todayDot()) : '',
      pmkDay: stamped ? (rec.dayText || '') : '',
      explain: card.b || '',
      creator: s.creator,
      title: s.title,
      signature: isKey ? {
        note: (s.signatureNote || '').trim(),
        fallback: '做卡人最想送出的一张',
      } : null,
      count: recCount(s.user, idx),
      rec: rec ? {
        img: rec.img || '',
        imgFileID: rec.imgFileID || '',
        note: rec.note || '',
        date: rec.date || '',
        dateText: rec.dateText || '',
        dayText: rec.dayText || '',
        stampDate: stampDate(rec.date),
        count: recCount(s.user, idx),
        resident: s.type === 'resident',
        sec: rec.sec || null,
      } : null,
    };
  },

  _dwFront(s, idx) { return this._cardVM(s, idx, 'draw'); },
  _dwBack(s, idx)  { return this._cardVM(s, idx, 'draw'); },
  buildCardBack(s, idx, mode) {
    const v = this._cardVM(s, idx, mode || 'big');
    if (mode === 'big') v.big = true;
    return v;
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
    const sealed = !done && stage === 'draw' && this._drawSealed(s);

    const prev = this.data.draw || {};
    const backIdx = stage === 'after' && todayIdx != null ? todayIdx : -1;
    const justDrawn = this._justDrawn === s.id;
    this._justDrawn = null;
    const prevFlipped = prev.sid === s.id && !!prev.flipped;

    /* 卡堆：收藏集按剩余天数 1–3 层；常驻集固定 3 层 */
    const remain = isResident ? 3 : Math.max(1, Math.min(3, count - got.length));
    const ALL_EDGES = ['e4', 'e3', 'e2'];
    const edges = ALL_EDGES.slice(ALL_EDGES.length - remain);

    /* 题眼：收藏集固定最后一张（收官）；常驻集由数据侧 isKeyEye 标记 */
    const card = backIdx >= 0 ? (pool[backIdx] || {}) : {};
    const residentKey = isResident
      && !!(card.isKeyEye || card.keyEye
        || (this._sigSid === s.id && this._sigIdx === backIdx));
    const isKey = backIdx >= 0 && (isResident ? residentKey : backIdx === count - 1);

    const ink = core.inkTints(s.cat);
    const word = card.w || '';
    const front = {
      ink: ink.ink, inkLine: ink.line, inkFaint: ink.faint,
      noText: backIdx >= 0 ? '№.' + pad2(backIdx + 1) : '',
      noLabel: backIdx >= 0 ? 'NO. ' + pad2(backIdx + 1) : '',
      series: (s.title || '').slice(0, 6),
      word,
      kwCls: core.kwClsOf(word.length),
      isKey,
      explain: card.b || '',
      source: s.creator ? '@' + s.creator : '今日做点小事',
      date: todayDot(),
    };
    const back = {
      name: s.title || '',
      sub: isResident ? '常驻' : '全 ' + count + ' 张',
      date: todayDot(),
    };

    let stateCls = 'is-idle';
    let flipped = false;
    if (stage === 'after' && backIdx >= 0) {
      if (justDrawn) { stateCls = 'is-drawn'; flipped = false; }
      else if (prevFlipped) { stateCls = 'is-flipped'; flipped = true; }
      else { stateCls = 'is-visited'; flipped = true; }
    }

    let cta, cta2 = null, ctaDone = null, ctaDone2 = null;
    let hint = '';
    let helper = '';
    if (stage === 'draw') {
      helper = sealed ? '拆开封条，解锁全集' : (done ? '这一集已经集齐' : '无需想好问题，带着此刻的自己就好');
      if (done) {
        cta = { tap: 'booklet', kind: 'gold', text: '✦ 查看集齐海报' };
        cta2 = { tap: 'home', kind: 'ghost', text: '回到这一集' };
        hint = '这一集已经集齐';
      } else if (sealed) {
        cta = { tap: 'pay', kind: 'gold', text: '拆封条 · 解锁 ¥' + s.price };
      } else {
        const trialTotal = s.trial || 0;
        const trialUsed = u.trialUsed || 0;
        const paid = s.price > 0 && !core.isOwnSet(s);
        if (paid && !u.unlocked && trialTotal > 0) {
          cta = {
            tap: 'draw', kind: 'brand',
            text: trialUsed
              ? '继续试抽 · 剩 ' + (trialTotal - trialUsed) + ' 张'
              : '免费试抽 ' + trialTotal + ' 张',
          };
        } else {
          cta = { tap: 'draw', kind: 'brand', text: '抽今日一签' };
        }
        hint = '每天 1 张 · 缺席不损失';
      }
    } else {
      if (hasRec) {
        ctaDone = { tap: 'none', kind: 'ghost', text: '已盖戳 · 明天再来', disabled: true };
      } else {
        ctaDone = {
          tap: 'stamp', kind: 'brand',
          text: stateCls === 'is-visited' ? '去盖邮戳' : '印上今天',
        };
      }
      ctaDone2 = { tap: 'share', kind: 'ghost', text: '分享' };
      helper = justDrawn ? '' : '如果有一句打动了你，就把它留下来';
    }
    const ctaFlip = { tap: 'flip', kind: 'brand', text: '翻开解读' };
    const backMode = stateCls === 'is-idle' ? 'idle' : 'word';

    this.setData({
      draw: {
        sid: s.id,
        stage,
        done,
        sealed,
        sealText: sealed ? '未拆封 · 解锁全集 ¥' + s.price : '',
        title: s.title || '',
        stateCls,
        flipped,
        hint,
        helper,
        ctaFlip,
        backMode,
        edges,
        front,
        back,
        cta, cta2, ctaDone, ctaDone2,
        backIdx,
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

  /* V4 · 封条态：付费集试抽用尽/无试抽，且今日未抽 */
  _drawSealed(s) {
    if (!s) return false;
    const u = s.user || {};
    const paid = s.price > 0 && !core.isOwnSet(s);
    return !!paid && !u.unlocked && (u.trialUsed || 0) >= (s.trial || 0);
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
    if (s.type !== 'resident' && (u.got || []).length >= count) { this.openDoneView(); return; }
    if (this._drawSealed(s)) { this.openPay(s); return; }

    if (!this._pendingDraw || this._pendingDraw.setId !== s.id) {
      this._pendingDraw = { setId: s.id, requestId: api.reqId() };
    }

    /* 信封退役：保留 360ms 最小抽卡节奏 */
    this.setData({
      'draw.stage': 'opening',
      'draw.hint': '',
      'draw.error': null,
    });

    const animDelay = new Promise(resolve => {
      this._envTimer = setTimeout(resolve, 360);
    });

    Promise.all([api.draw(this._pendingDraw), animDelay])
      .then(([res]) => { this._releaseEnv(); this._afterDrawnApi(res); })
      .catch(err => animDelay.then(() => { this._releaseEnv(); this._drawFailed(err); }));
  },

  _releaseEnv() {
    clearTimeout(this._envTimer);
    this._envTimer = null;
  },

  closeOnboard() {
    const patch = { 'onboard.show': false };
    if (this.data.draw && !this.data.draw.flipped) {
      patch['draw.hint'] = '轻触卡面 · 翻到另一面';
    }
    this.setData(patch);
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
    if (!d) return;
    if (d.sealed) return;                       /* 封条期不进翻面 */
    if (d.stage !== 'after') { this.tapEnvelope(); return; }
    if (!d.flipped) {
      this.setData({
        'draw.flipped': true,
        'draw.stateCls': 'is-flipped',
        'draw.hint': '',
        'draw.helper': '如果有一句打动了你，就把它留下来',
      });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      return;
    }
    /* 已翻面：轻触卡面作为「看大卡」兜底（原 cta2 已下线） */
    const s = this.S.sets.find(x => x.id === this.S.cur);
    const u = (s && s.user) || {};
    if (u.todayIdx != null) this.showBigCard(s.id, u.todayIdx);
  },

  tapDrawCta(e) {
    const d = this.data.draw;
    if (!d) return;
    const act = e.currentTarget.dataset.act;
    const c = act === 'cta2' ? d.cta2
      : act === 'ctaDone2' ? d.ctaDone2
      : act === 'ctaDone' ? d.ctaDone
      : d.cta;
    if (!c || c.disabled) return;
    const S = this.S;
    const u = (S.sets.find(x => x.id === S.cur) || {}).user || {};
    switch (c.tap) {
      case 'draw': this.tapEnvelope(); break;
      case 'flip': this.tapCard(); break;
      case 'pay': {
        const s = S.sets.find(x => x.id === S.cur);
        if (s) this.openPay(s);
        break;
      }
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

  shareDraw() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    const u = (s && s.user) || {};
    if (!s || u.todayIdx == null) { this.toast('先抽一张今天的卡吧'); return; }
    this.openPoster({ currentTarget: { dataset: { type: 'card', sid: s.id, idx: u.todayIdx } } });
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


  /* ──────────────────────────────────────────────────────────
     全图
     ────────────────────────────────────────────────────────── */

  renderMap() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const u = s.user || {};
    const gotRaw = Array.isArray(u.got) ? u.got.map(Number) : [];
    const gotSet = new Set(gotRaw.filter(n => Number.isFinite(n)));
    if (u.todayIdx != null) gotSet.add(Number(u.todayIdx));
    (u.drawnLog || []).forEach(e => {
      if (e && e.idx != null) gotSet.add(Number(e.idx));
    });
    const n = s.count || (s.pool || []).length;
    const per = 4;
    const stamps = Array.from({ length: n }, (_, idx) => {
      const cvm = this._cardVM(s, idx, 'map');
      const full = gotSet.has(idx);
      const rec = getRec(u, idx);
      return {
        idx, no: pad2(idx + 1),
        ink: cvm.ink, inkLine: cvm.inkLine, inkFaint: cvm.inkFaint,
        state: full ? 'full' : 'blank',
        full,
        card: full ? cvm : null,
        pmkState: full ? (rec ? 'done' : (u.todayIdx === idx ? 'today' : '')) : '',
        dark: !full, sig: idx === s.signatureIdx, sid: s.id,
      };
    });
    const rows = [];
    for (let r = 0; r < Math.ceil(stamps.length / per); r++) {
      rows.push({ cells: stamps.slice(r * per, r * per + per) });
    }
    const gotList = Array.from(gotSet);
    const drawnWords = gotList.map(idx => ({
      idx,
      w: (((s.pool || [])[idx] || {}).w || ''),
    })).filter(it => it.w);
    const latestWord = drawnWords.length ? drawnWords[drawnWords.length - 1].w : '';
    const drawnN = Math.max(u.drawn || 0, gotSet.size);
    this.setData({
      mapV: {
        rows, cells: stamps,
        drawn: drawnN,
        count: n,
        pct: n ? Math.min(100, drawnN / n * 100).toFixed(1) : 0,
        drawnWords,
        latestWord,
      },
    });
  },

  mapCellTap(e) {
    const d = e.currentTarget.dataset;
    const idx = Number(d && d.idx);
    const cell = (this.data.mapV.cells || [])[idx];
    if (!cell) return;
    if (cell.state === 'blank') {
      if (cell.sig) this.toast('题眼还在路上 · 抽到那天你会知道');
      return;
    }
    this.showBigCard(Number(cell.sid), idx);
  },

  showBigCard(sid, idx, opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    if (!S.detailLoaded[sid]) {
      core.ensureSetDetail(sid)
        .then(() => this.showBigCard(sid, idx, opts))
        .catch(() => this.toast('卡面加载失败，再试一次'));
      return;
    }
    const c = s.pool[idx];
    if (!c) return;
    const front = this._cardVM(s, idx, 'big');
    const back = this._cardVM(s, idx, 'big');
    const isKey = idx === s.signatureIdx;
    front.sigBar = isKey;
    front.sigStamp = isKey;
    if (opts.stampAnim) back.stampAnim = true;
    this.setData({
      bigCard: {
        show: true,
        flipped: !!opts.flipped,
        sig: isKey,
        lit: s.cat === 'bond',
        front, back,
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

  /* 订阅统计：今日可抽 / 累计抽卡 / 已抽空 */
  async tapStat(e) {
    const kind = e.currentTarget.dataset.kind;
    const subs = this.data.subs || {};
    if (kind === 'today') {
      if (!subs.today || !subs.today.length) { this.toast('今天没有可抽的卡集'); return; }
      wx.pageScrollTo({ selector: '#subsToday', duration: 240 });
      return;
    }
    if (kind === 'cards') {
      const need = (this.S.sets || []).filter(s => s.user && (s.user.got || []).length);
      await Promise.all(need.map(s => core.ensureSetDetail(s.id).catch(() => null)));
      const cards = [];
      (this.S.sets || []).forEach(s => {
        const u = s.user || {};
        (u.got || []).forEach(idx => {
          if (!(s.pool || [])[idx]) return;
          cards.push({
            key: s.id + '-' + idx,
            sid: s.id, idx, title: s.title || '',
            card: this._cardVM(s, idx, 'stats'),
          });
        });
      });
      if (!cards.length) { this.toast('还没有抽到卡'); return; }
      this.setData({
        statsSheet: {
          show: true, kind: 'cards', title: '我抽过的卡',
          sub: `已收集 ${cards.length} 张 · 累计 ${subs.statCards || 0} 次`,
          cards, sets: [],
        },
      });
      return;
    }
    if (kind === 'empty') {
      const sets = (subs.done || []).slice();
      if (!sets.length) { this.toast('还没有抽空的卡集'); return; }
      this.setData({
        statsSheet: {
          show: true, kind: 'empty', title: '已抽空的卡集',
          sub: `${sets.length} 个卡集 · 全部点亮`,
          cards: [], sets,
        },
      });
    }
  },

  closeStats() {
    this.setData({ 'statsSheet.show': false });
  },

  openStatSet(e) {
    const sid = Number(e.currentTarget.dataset.sid);
    this.setData({ 'statsSheet.show': false });
    this.openSetById(sid, 'cards');
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
      const weekly = this.data.subs && this.data.subs.weekly;
      const target = weekly && weekly.sid
        ? this.S.sets.find(x => x.id === weekly.sid)
        : null;
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

  switchLibTab(e) {
    const tab = e.currentTarget.dataset.tab || 'subscribed';
    this.setData({ 'subs.tab': tab });
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
    const me = core.creatorName(S);
    const pub = S.sets.filter(s => core.isOwnSet(s));
    if (!pub.length && !S.craft.reviewing.length && !S.craft.drafts.length) {
      this.setData({ craft: { empty: true, groups: [] } });
      return;
    }
    const earn = this.S.incomeData ? this.S.incomeData.total : 0;
    const fansN = (S.fans && S.fans[me]) || 0;
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
        cover: Object.assign({}, core.coverVMOf({
          id: d.id, cat: d.cat, title: d.title || '未命名',
          count: d.pool.length, pool: d.pool, coverImage: d.coverImage, creator: me,
        }), { compact: true }),
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
        cover: Object.assign({}, core.coverVMOf({
          id: d.id, cat: d.cat, title: d.title || '未命名',
          count: d.pool.length, pool: d.pool, coverImage: d.coverImage, creator: me,
        }), { compact: true }),
      };
    });
    const pubRows = pub.map(s => ({
      id: s.id,
      title: s.title,
      meta: `被抽 ${fmt(s.totalDrawn || 0)} 次${s.earn ? ` · 收益 ¥${s.earn.toFixed(2)}` : ''}`,
      badge: 'pub',
      badgeText: '已上架',
      cover: Object.assign({}, core.coverVMOf(s), { compact: true }),
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
      id: ++S.seq, title: '', intro: '', type: 'collect', cat: 'muse', price: 0, trial: 0, status: 'draft',
      coverImage: '',
      signatureIdx: -1, signatureNote: '', signaturePublic: false,
      pool: Array.from({ length: 8 }, () => ({ w: '', b: '' })),
    };
    S.craft.drafts.push(d);
    this.openEdit(d.id);
  },


  renderEdit() {
    const S = this.S;
    const d = S.ed;
    if (!d) return;
    d.price = core.normalizePrice(d.price);
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
        cats: CATS.map(c => ({ key: c.key, chip: c.name })),
        prices: core.PRICE_TIERS.slice(),
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
      sizeType: ['compressed'],
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
    const long = d.pool.filter(c => (c.w || '').trim().length > 24);
    if (long.length) errs.push(`卡面最多 24 个字，现在有 ${long.length} 张超长`);
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



  renderReview() {
    const S = this.S;
    const d = S.rv;
    if (!d) return;
    d.price = core.normalizePrice(d.price);
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


  /* ──────────────────────────────────────────────────────────
     我的
     ────────────────────────────────────────────────────────── */
  renderMe() {
    const S = this.S;
    const me = core.meName(S);
    const pub = S.sets.filter(s => core.isOwnSet(s));
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
        name: me,
        avatar: '我',
        cardN,
        stampN,
        emptied,
        todayLine,
        craftN,
        avatarImg: S.meAvatar || (S.me && S.me.avatar) || '',
        availText: this.S.incomeData ? `可提现 ¥${avail.toFixed(2)}` : '收益同步中',
        remindText: (S.remind && S.remind.enabled) ? `明天 ${S.remind.time} 提醒你` : '未开启',
      },
    });
  },

  meToAuthor() {
    this.S.author = core.creatorName(this.S);
    this.renderAuthor();
    this.go('author');
  },

  chooseMyAvatar() {
    const S = this.S;
    if (this._avatarBusy) return;
    this._avatarBusy = true;

    const apply = (tempPath) => {
      const save = (path) => {
        S.meAvatar = path;
        try { wx.setStorageSync(core.ME_AVATAR_KEY, path); } catch (e) {}
        this._avatarBusy = false;
        this.toast('头像已更新');
        this.renderMe();
        if (this.__page === 'author' && S.author === core.creatorName(S)) this.renderAuthor();
      };
      if (wx.saveFile) {
        wx.saveFile({
          tempFilePath: tempPath,
          success: (r) => save(r.savedFilePath || tempPath),
          fail: () => save(tempPath),
        });
      } else {
        save(tempPath);
      }
    };

    const fail = () => { this._avatarBusy = false; };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0];
          if (f && f.tempFilePath) apply(f.tempFilePath);
          else fail();
        },
        fail,
      });
      return;
    }
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const p = res.tempFilePaths && res.tempFilePaths[0];
        if (p) apply(p);
        else fail();
      },
      fail,
    });
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

  toggleRemindPage() {
    if (this.data.remind && this.data.remind.enabled) this.disableRemind();
    else this.enableRemind();
  },

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
    if (!S.detailLoaded[sid]) {
      core.ensureSetDetail(sid)
        .then(() => this.openRecordAt(sid, idx, from))
        .catch(() => this.toast('卡面加载失败，再试一次'));
      return;
    }
    S.rc = { sid, idx, from: from || 'big' };
    const resident = s.type === 'resident';
    const card = (s.pool || [])[idx] || {};
    const prev = getRec(s.user, idx);
    /* V4：收藏集已有记录 → 直接 st-stamped（不重播落印）；常驻集可多次盖戳 */
    const editing = !!(prev && !resident);
    S.rcTmp = { img: editing ? prev.img : null };
    const note = editing ? (prev.note || '') : '';
    /* mock 用 dateText、real 用 stampDate 存 YYYY.MM.DD；取长格式，避免 "11-23" */
    const longDate = editing
      ? [prev.stampDate, prev.dateText].find(x => /^\d{4}\.\d{2}\.\d{2}$/.test(x || ''))
      : '';
    const stampDate = longDate || todayDot();
    const stampShort = stampDate.slice(5).replace('.', '·');
    const hasImg = !!(editing && prev.img);

    /* st 页在 tab 页要盖住原生 tabBar */
    if (this.__page === 'cards' && wx.hideTabBar) {
      try { wx.hideTabBar({ animation: false }); } catch (e) {}
    }

    this.setData({
      record: {
        show: true,
        mode: editing ? 'is-stamped' : 'is-empty',
        no: '№.' + pad2(idx + 1),
        setTitle: s.title || '',
        word: card.w || '',
        stampDate,
        stampShort,
        stamped: editing,
        readOnly: editing,
        animate: false,
        saving: false,
        note,
        count: note.length,
        img: editing && prev.img ? prev.img : '',
        hasImg,
        sid,
        idx,
        title: `「${card.w}」`,
        sub: resident ? '这一次，做到了。留个证据，只给自己看。' : '做完这件小事，给它留个证据。只给自己看。',
        saveText: editing ? '更新这枚邮戳' : '盖上邮戳',
      },
    });
  },

  openRecord(e) {
    const d = e.currentTarget.dataset;
    this.openRecordAt(Number(d.sid), Number(d.idx), d.from || 'big');
  },

  choosePhoto() {
    if (this.data.record && this.data.record.readOnly) return;
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const file = (res.tempFiles && res.tempFiles[0]) || null;
        if (!file) return;
        that.cropRecordPhoto(file.tempFilePath);
      },
    });
  },

  /* 选图后进入原生裁剪：固定 3:4 竖版，可拖动/缩放确认 */
  cropRecordPhoto(src) {
    if (!src) return;
    if (typeof wx.cropImage !== 'function') {
      this.applyRecordPhoto(src);
      this.toast('当前版本不支持裁剪，已使用原图');
      return;
    }
    wx.cropImage({
      src,
      cropScale: '3:4',
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
      'record.mode': 'is-photo',
    });
  },

  clearPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (this.data.record && this.data.record.readOnly) return;
    this.S.rcTmp.img = null;
    this.setData({ 'record.img': '', 'record.hasImg': false, 'record.mode': 'is-empty' });
  },

  /* 无照片也允许只写一句话（保留旧产品能力） */
  noteOnly() {
    if (this.data.record && this.data.record.readOnly) return;
    this.setData({ 'record.mode': 'is-photo' });
  },

  onRecordNote(e) {
    if (this.data.record && this.data.record.readOnly) return;
    this.setData({ 'record.note': e.detail.value, 'record.count': e.detail.value.length });
  },

  shareRecord() {
    const r = this.data.record || {};
    if (r.sid == null || r.idx == null) return;
    this.openPoster({ currentTarget: { dataset: { type: 'card', sid: r.sid, idx: r.idx } } });
  },

  closeRecord() {
    this.S.rc = null;
    if (this.__page === 'cards' && wx.showTabBar) {
      try { wx.showTabBar({ animation: false }); } catch (e) {}
    }
    this.setData({ 'record.show': false, 'record.saving': false });
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
      this.setData({ 'record.saving': false });
      const weekly = this.weeklyState(s);
      const weeklyFresh = weekly.ready && weekly.stampN === 7 && !this.isWeeklyMade(s, weekly.weekNo);
      if (weeklyFresh) this.toast('本周集齐 7 张 · 可以生成周记了');
      else if (rc.from === 'draw') this.toast('已盖上今天的邮戳');
      else this.toast('已盖上邮戳，可以分享这张明信片了');

      /* V4：停在 st-stamped，stampIn 380ms 落印；「收进册子」再关闭 */
      const recDate = [r.rec && r.rec.stampDate, r.rec && r.rec.dateText]
        .find(x => /^\d{4}\.\d{2}\.\d{2}$/.test(x || '')) || todayDot();
      const recShort = recDate.slice(5).replace('.', '·');
      this.setData({
        'record.mode': 'is-stamped',
        'record.stamped': true,
        'record.readOnly': true,
        'record.animate': true,
        'record.stampDate': recDate,
        'record.stampShort': recShort,
        'record.note': note,
        'record.count': note.length,
        'record.hasImg': !!img,
        'record.img': img || '',
      });

      /* 底层页即时刷新；不打开大卡，st 页保持最上层 */
      if (this.__page === 'cards') this.renderSubs();   // 当前页状态即时刷新
      if (this.__page === 'set') this.renderSetPage();  // stampRow 即时刷新
      if (this.__page === 'map') this.renderMap();      // 格子徽标即时刷新
      if (this.__page === 'draw') this.renderDraw();    // 抽卡页还在背后：刷新 CTA 态
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

  weeklyState(s, qrSrc) {
    if (!s || s.type !== 'collect') return { ready: false };
    this.ensureDrawnLog(s);
    const data = posterKit.buildWeeklyData(s, { qrSrc: qrSrc || '', now: Date.now() });
    if (!data || data.stats.drawn < 7) return { ready: false };
    return {
      ready: true,
      data,
      weekNo: data.weekNo,
      cards: data.cards,
      stamps: data.stamps,
      stampN: data.stats.stamped,
      streak: data.stats.streak,
      drawnN: data.stats.drawn,
      title: data.titleText,
      range: data.dateRangeText,
      kicker: data.kicker,
      variant: data.layout,
      photos: data.photos,
      wordLine: data.wordLine,
      quote: data.quote,
    };
  },

  weeklyKey(s, weekNo) {
    return `${s.id}:${weekNo}`;
  },

  isWeeklyMade(s, weekNo) {
    return !!this.S.weeklyMade[this.weeklyKey(s, weekNo)];
  },


  weeklyForSet(s) {
    const w = this.weeklyState(s);
    if (!w.ready || this.isWeeklyMade(s, w.weekNo)) return null;
    return w;
  },

  async openWeekly(e) {
    const S = this.S;
    const d = e && e.currentTarget && e.currentTarget.dataset;
    const id = d && d.id != null ? Number(d.id) : S.cur;
    let s = S.sets.find(x => x.id === id);
    if (!s) return;
    if (!S.detailLoaded[id]) {
      try { await core.ensureSetDetail(id); s = S.sets.find(x => x.id === id); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
      if (!s) return;
    }
    const qrSrc = await this._posterQR(s.id);
    const w = this.weeklyState(s, qrSrc);
    if (!w.ready) {
      this.toast('再抽几张，抽满 7 张就能生成周记');
      return;
    }
    this.markWeeklyMade(s, w.weekNo);
    S.posterType = 'weekly';
    S.posterExport = w.data;                         // 预览与导出共用同一份数据
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
        qrSrc,
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
    let s = S.sets.find(x => x.id === id);
    if (!s) return;
    if (!S.detailLoaded[id]) {
      try { await core.ensureSetDetail(id); s = S.sets.find(x => x.id === id); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
      if (!s) return;
    }
    // qrSrc：服务端 wxacode.getUnlimited({ scene: `p=w&s=${s.id}` }) 的结果，
    // 缓存后传入；传空字符串会渲染 QR 占位框，不报错。
    const qrSrc = await this._posterQR(id);
    const w = this.weeklyState(s, qrSrc);
    if (!w.ready) { this.toast('本周还没有抽卡记录'); return; }

    // 渠道选择：小红书 3:4 / 朋友圈 9:16
    const tap = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['小红书 · 3:4', '朋友圈 · 9:16'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (tap < 0) return;
    await this.exportWeeklyById(id, tap === 1 ? '916' : '34', w.data);
  },

  /** 按指定比例生成并保存周记；预览弹层保存也走这里 */
  async exportWeeklyById(id, ratio, preset) {
    const S = this.S;
    const s = S.sets.find(x => x.id === id);
    if (!s) return;
    const data = preset || posterKit.buildWeeklyData(s, { qrSrc: await this._posterQR(id) });
    if (!data) { this.toast('本周还没有抽卡记录'); return; }
    const noQR = !data.qrSrc;
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
      this.toast(noQR ? '周记已保存（无二维码版）· 配置分享码后会自动带上二维码' : (ratio === '916' ? '朋友圈版已保存 📸' : '周记已保存到相册 📸'));
    } catch (err) {
      console.warn(err);
      this.toast('生成失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },




  async _posterQR(sid) {
    try {
      const r = await api.getPosterQR({ setId: Number(sid) });
      return (r && r.path) || '';
    } catch (e) { return ''; }
  },

  buildHighlight(c, s, opts = {}) {
    if (!c || !s) return null;
    return posterKit.buildHighlightData(s, c, opts);   // 唯一真相源：预览与导出同源
  },

  async openPoster(e) {
    const type = (e && e.currentTarget && e.currentTarget.dataset.type) || 'draw';
    const S = this.S;
    S.posterType = type;
    const d = (e && e.currentTarget && e.currentTarget.dataset) || {};
    let data = null;
    let sid = d.sid != null ? Number(d.sid) : S.cur;
    if ((type === 'card' || type === 'big' || type === 'memorial') && !S.detailLoaded[sid]) {
      try { await core.ensureSetDetail(sid); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
    }
    if (type === 'memorial') {
      data = this.buildMemorialPoster({ sid, qrSrc: await this._posterQR(sid) });
    } else if (type === 'card') {
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
        qrSrc: await this._posterQR(sid),
      });
    } else if (type === 'big') {
      // 回看场景：分享当前大卡的这一张
      const idx = Number(d.idx != null ? d.idx : 0);
      const s = S.sets.find(x => x.id === sid);
      if (!s || !s.pool[idx]) return;
      data = this.buildHighlight(s.pool[idx], s, {
        idx,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
        qrSrc: await this._posterQR(sid),
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

  hidePoster() {
    this.setData({ 'poster.show': false });
  },

  async savePoster() {
    const S = this.S;
    const type = S.posterType;

    // 周记：按当前预览比例走 posterKit 的真实 Canvas 导出；复用预览数据，不重建
    if (this.data.poster.kind === 'weekly') {
      const sid = this.data.poster.sid;
      const preset = S.posterExport && S.posterExport.setId === sid ? S.posterExport : null;
      this.exportWeeklyById(
        sid,
        this.data.poster.ratio === '916' ? '916' : '34',
        preset
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
    const noQR = !data.qrSrc;
    if (noQR) data.qrSrc = QR_BLANK;

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
      this.toast(noQR ? '海报已保存（无二维码版）· 配置分享码后会自动带上二维码' : '海报已保存到相册 📸');
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
};


module.exports = { PAGE_OPTS };
