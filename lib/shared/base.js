/* lib/shared/base.js — 过渡期单一来源：Page(createPage('home')) */
const core = require('../core.js');
const api = require('../../services/api.js');
const tracker = require('../track.js');
const { USE_MOCK, API_BASE } = require('../../services/config.js');

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
    clearTimeout(this._fxTimer);
    const revealFx = justDrawn ? (s.cat === 'mood' ? 'rainbow' : 'spark') : '';
    const prevFlipped = prev.sid === s.id && !!prev.flipped;

    /* 卡堆固定 3 层：抽卡前后保持同一视觉尺寸，避免卡面忽大忽小 */
    const ALL_EDGES = ['e4', 'e3', 'e2'];
    const edges = ALL_EDGES;

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
    let intro = '';
    if (stage === 'draw') {
      intro = sealed ? '拆开封条，解锁全集' : (done ? '这一集已经集齐' : '深呼吸，点开今天这张卡');
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
        intro,
        revealFx,
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
    if (revealFx) {
      this._fxTimer = setTimeout(() => {
        if (this.data.draw && this.data.draw.revealFx === revealFx) {
          this.setData({ 'draw.revealFx': '' });
        }
      }, 2500);
    }
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
    if (d.sealed) {                             /* 封条期：点卡直接去解锁 */
      const s = this.S.sets.find(x => x.id === this.S.cur);
      if (s) this.openPay(s);
      return;
    }
    if (d.stage !== 'after') { this.tapEnvelope(); return; }
    /* 已抽到：点卡在「关键词面 / 解读面」之间来回翻 */
    const nextFlipped = !d.flipped;
    this.setData({
      'draw.flipped': nextFlipped,
      'draw.stateCls': nextFlipped ? 'is-flipped' : 'is-drawn',
      'draw.hint': '',
      'draw.helper': nextFlipped ? '如果有一句打动了你，就把它留下来' : '',
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
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

  /* ──────────────────────────────────────────────────────────
     演示工具
     ────────────────────────────────────────────────────────── */


  /* D5：收益基类最小 no-op；实际逻辑在 d4/d5 override */
};

/* 领域方法：独立模块，避免 base 继续膨胀 */
Object.assign(PAGE_OPTS, require('./mixins/poster.js'));
Object.assign(PAGE_OPTS, require('./mixins/browse.js'));
Object.assign(PAGE_OPTS, require('./mixins/craft.js'));
Object.assign(PAGE_OPTS, require('./mixins/collection.js'));

module.exports = { PAGE_OPTS };
