// pages/index/index.js — hub：set/draw/map/edit/income/author/demo
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('hub');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    let statusBarHeight = 20, navTop = 64;
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

    const q = (options && (options.query || options)) || {};
    if (q.from === 'remind' && !this._remindRouted) {
      this._remindRouted = true;
      wx.switchTab({ url: '/pages/cards/index' });
      return;
    }
    // 兼容旧分享链接：/pages/index/index?sid=N → 直达独立 set 页
    if (q.sid) {
      wx.redirectTo({ url: '/pages/set/index?sid=' + Number(q.sid) });
      return;
    }
    const entry = q.page;
    if (!entry) { wx.switchTab({ url: '/pages/home/index' }); return; }
    core.ensureBoot().then(() => this.__enter(entry))
      .catch(() => { this.toast('内容加载失败，检查一下网络'); this.__enter(entry); });
  },

  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    core.syncOnShow().then(() => this.__enter(this.data.page, { scroll: false }));
  },

  onUnload() {
    this.teardownSetObservers();
    clearTimeout(this._drawTimer);
    clearTimeout(this._doneTimer);
    if (this.S) clearTimeout(this.S.toastTimer);
  },

  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/index/index' };
  },

  onShareTimeline() {
    return { title: '万物皆可抽一签 · 今日做点小事' };
  },
});
Page(page);
