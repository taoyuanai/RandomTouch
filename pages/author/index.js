// pages/author/index.js — 创作者主页（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('author');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    let statusBarHeight = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight });
    if (!this.S.author) { wx.switchTab({ url: '/pages/home/index' }); return; }
    this.renderAuthor();
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (this.S.author) this.renderAuthor();
  },
  backAuthor() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },
});
Page(page);
