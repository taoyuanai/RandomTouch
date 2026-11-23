// pages/map/index.js — 全图（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('map');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    let statusBarHeight = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight });
    const q = (options && (options.query || options)) || {};
    if (q.sid) this.S.cur = Number(q.sid);
    if (this.S.cur == null) { wx.switchTab({ url: '/pages/home/index' }); return; }
    core.ensureBoot().then(() => this.renderMap())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted || this.S.cur == null) return;
    core.syncOnShow().then(() => this.renderMap());
  },
  backMap() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },
});
Page(page);
