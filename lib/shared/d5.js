/* lib/shared/d5.js — 页面覆盖层 */
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
    const seq = (this._authorSeq || 0) + 1;
    this._authorSeq = seq;
    try {
      const d = await api.getAuthor({ name });
      if (seq !== this._authorSeq || this.S.author !== name) return;
      d.works.forEach(p => this.applySetPayload(p));
      this.S.follow[name] = d.followed;
      this.S.fans[name] = d.fans;
      this.setData({
        bootError: false,
        author: {
          exists: true,
          name: d.name,
          avatar: (d.name || '·')[0],
          avatarImg: d.own ? (this.S.meAvatar || (this.S.me && this.S.me.avatar) || '') : '',
          own: d.own,
          worksN: d.works.length,
          drawnText: fmt(d.works.reduce((a, p) => a + (d.own ? (p.totalDrawn || 0) : (p.heat || 0)), 0)),
          fansText: fmt(d.fans),
          followed: d.followed,
          works: d.works.map(p => ({
            id: p.id, title: p.title,
            cover: Object.assign({}, core.coverVMOf(p), { compact: true }),
            covT2: (p.covT || '').slice(0, 2),
            meta1: `${p.count} 张 · ${p.type === 'collect' ? '收藏集' : '常驻集'}`,
            meta2: p.price > 0 ? ('¥' + p.price) : '免费',
          })),
        },
      });
    } catch (e) {
      if (seq !== this._authorSeq) return;
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
    if (!s || !s.creator || core.isOwnSet(s)) return;
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
    const seq = (this._craftSeq || 0) + 1;
    this._craftSeq = seq;
    return api.getMyCraft().then(r => {
      if (seq !== this._craftSeq) return;
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


module.exports = { d5Overrides };
