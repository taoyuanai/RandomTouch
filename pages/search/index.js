// pages/search/index.js — 搜索（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('search');
Object.assign(page, {
  onLoad() {
    this.S = core.getS(); // 每页第一行，必写
    this._searchQ = '';
    let statusBarHeight = 20, menuPad = 100;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
      const winW = info.windowWidth || 375;
      if (wx.getMenuButtonBoundingClientRect) {
        const rect = wx.getMenuButtonBoundingClientRect();
        if (rect && rect.left) menuPad = Math.max(76, winW - rect.left + 8);
      }
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight, menuPad });
    core.ensureBoot()
      .then(() => { this.renderSearch(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    if (!this.S || !this.S.booted) return;
    this.renderSearch();
  },
  onUnload() { this.stopSearchTimer(); },
});
Page(page);
