// pages/draw/index.js — 抽卡（沉浸式 custom 导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('draw');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const q = (options && (options.query || options)) || {};
    if (q.sid) this.S.cur = Number(q.sid);
    if (this.S.cur == null) { wx.switchTab({ url: '/pages/home/index' }); return; }
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
    core.ensureBoot()
      .then(() => this.renderDraw())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted || this.S.cur == null) return;
    if (this.data.draw) this.renderDraw();
  },
  onUnload() {
    clearTimeout(this._drawTimer);
    clearTimeout(this._doneTimer);
    this._releaseEnv();
  },
});
Page(page);
