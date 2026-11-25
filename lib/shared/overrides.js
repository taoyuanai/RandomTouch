/* lib/shared/overrides.js — 页面覆盖层 */
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
  isoWeekKey,
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

const { PAGE_OPTS } = require('./base.js');

/* ═══════════ D3 · 覆盖：导航 / getFeed / 互动 / 周记 ═══════════ */
const overrides = {

  /* hub 子页进入/切换：渲染统一收口 */

  applySetPayload(p) { return core.applySetPayload(p); },


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

  /* D012：锁定行落 set 页，不直弹付费墙 */

  /* 订阅页 getFeed 版 */
  async renderSubs() {
    const seq = (this._subsSeq || 0) + 1;
    this._subsSeq = seq;
    try {
      const feed = await api.getFeed();
      if (seq !== this._subsSeq) return;
      const now = new Date();
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      const labels = ['一', '二', '三', '四', '五', '六', '日'];
      const rowOf = (r, extra) => {
        const cov = r.covT || '·';
        const set = this.S.sets.find(x => x.id === r.setId);
        const subscribers = (set && set.subscribers) || 0;
        const soc = set && this.S.social && this.S.social[set.id];
        const likes = soc ? (soc.likes || 0) : 0;
        const creator = set ? (set.creator || '') : '';
        return Object.assign({
          id: r.setId, title: r.title || '',
          charA: cov.slice(0, 1), charB: cov.slice(1, 2) || '',
          idx: r.todayIdx,
          prog: r.resident ? '已拆 ' + r.drawn + ' 封'
            : (r.status === 'done' ? r.count + ' 张' : r.got + ' / ' + r.count),
          catName: set ? catChipOf(set.cat) : '',
          cover: set ? Object.assign({}, core.coverVMOf(set), { compact: true }) : null,
          creator,
          subscribed: r.subscribed !== false,
          subscribersShort: fmtShort(subscribers),
          likesShort: fmtShort(likes),
          metaText: (creator ? creator + ' · ' : '')
            + fmtShort(subscribers) + ' 订阅 · ' + fmtShort(likes) + ' 心动',
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
      /* V6 · 最近一枚邮戳（盖戳记录 tab） */
      const records = [];
      (this.S.sets || []).forEach(set => {
        const u2 = set.user;
        if (!u2 || !u2.recs) return;
        Object.keys(u2.recs).forEach(k => {
          const idx = Number(k);
          const rec = getRec(u2, idx);
          if (!rec) return;
          const card = (set.pool || [])[idx] || {};
          records.push({
            sid: set.id, idx, setTitle: set.title || '',
            word: card.w || '', note: rec.note || '', img: rec.img || '',
            dateText: rec.dateText || rec.stampDate || rec.date || '',
            dayText: rec.dayText || '',
          });
        });
      });
      records.sort((a, b) => String(b.dateText).localeCompare(String(a.dateText)));
      /* 连续抽卡天数（按 drawnLog 去重） */
      const drawDays = new Set();
      (this.S.sets || []).forEach(set2 => {
        const log = set2.user && set2.user.drawnLog;
        if (Array.isArray(log)) log.forEach(e => { if (e && e.ts) drawDays.add(dateKeyOf(e.ts)); });
      });
      let cursor = todayKey();
      if (!drawDays.has(cursor)) cursor = _keyPlus(cursor, -1);
      let streak = 0;
      while (drawDays.has(cursor)) { streak++; cursor = _keyPlus(cursor, -1); }
      const libTab = (this.data.subs && this.data.subs.tab) || 'subscribed';
      this.setData({
        bootError: false,
        subs: {
          date: (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + wd,
          total: feed.total,
          remindDraw: firstDraw ? { n: today.length, sid: firstDraw.id } : null,
          remindStamp: firstWait ? { n: feed.stats.waiting, sid: firstWait.id, idx: firstWait.idx } : null,
          statCan: feed.stats.canDraw, statCards: feed.stats.cards, statEmpty: feed.stats.emptied,
          statStreak: streak, statStamps: records.length,
          today, subscribed, done, weekly, weekGoal, greeting,
          rows: today.concat(subscribed),
          tab: libTab,
          record: records[0] || null,
          weekPct: weekGoal ? Math.round(weekGoal.done / weekGoal.total * 100) : 0,
        },
      });
    } catch (e) {
      if (seq !== this._subsSeq) return;
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
    const seq = (this._setMetaSeq || 0) + 1;
    this._setMetaSeq = seq;
    api.getSet(sid).then(p => {
      if (seq !== this._setMetaSeq) return;
      if (p.fans != null && p.creator) this.S.fans[p.creator] = p.fans;
      if (p.social) this.S.social[p.id] = { liked: !!p.social.liked, likes: p.social.likes || 0 };
      if (!(this.data.setPage && this.data.setPage.id === sid)) return;
      const soc = p.social || {};
      const likes = soc.likes != null ? soc.likes
        : ((this.data.setPage.social && this.data.setPage.social.likes) || 0);
      this.setData({
        'setPage.fansText': p.fans ? fmt(p.fans) + ' 位关注者' : '做卡人',
        'setPage.fansShort': fmtShort(p.fans || 0),
        'setPage.subscribers': p.subscribers || 0,
        'setPage.subscribersShort': fmtShort(p.subscribers || 0),
        'setPage.social.likes': likes,
        'setPage.social.likesText': fmt(likes),
        'setPage.social.likesShort': fmtShort(likes),
        'setPage.social.liked': soc.liked != null ? !!soc.liked
          : !!((this.data.setPage.social && this.data.setPage.social.liked)),
        'setPage.social.commentCount': p.commentCount,
        'setPage.social.commentText': p.commentCount ? p.commentCount + ' 条留言' : '写第一条留言',
      });
    }).catch(() => {});
    api.getComments(sid).then(items => {
      if (seq !== this._setMetaSeq) return;
      this.S.comments[sid] = items;
      const first = items[0]
        ? Object.assign({}, items[0], { avatar: items[0].avatar || (items[0].name || '签').slice(0, 1) })
        : null;
      if (!(this.data.setPage && this.data.setPage.id === sid)) return;
      this.setData({
        'setPage.social.commentCount': items.length,
        'setPage.social.commentText': items.length ? items.length + ' 条留言' : '写第一条留言',
        'setPage.commentPreview': first,
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

    const firstReveal = !!(res.sig && res.sig.firstReveal);
    /* 常驻集题眼：服务端标记本次为金印时，本次渲染放行金框/金印 */
    this._sigSid = s.id;
    this._sigIdx = (res.sig && res.sig.isSig) ? res.idx : -1;
    this._justDrawn = s.id;

    this.renderDraw();

    /* is-drawn 停留 360ms 后提示翻面 */
    clearTimeout(this._drawTimer);
    this._drawTimer = setTimeout(() => {
      if (this.__page !== 'draw' || !this.data.draw) return;
      if (this.data.draw.stateCls === 'is-drawn') {
        this.setData({ 'draw.hint': '轻触卡片，看看解读', 'draw.helper': '轻触卡片，看看解读' });
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
      }
    }, 360);

    if (res.result === 'completed') {
      setTimeout(() => this.openDoneView(), 400);
      return;
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


module.exports = { overrides };
