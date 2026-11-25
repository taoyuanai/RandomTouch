// pages/author/index.js — 创作者主页（原生导航）
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('author');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight });
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
