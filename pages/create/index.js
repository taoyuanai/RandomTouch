// pages/create/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('create');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
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
      .then(() => this.refreshCraft())
      .then(() => this.renderCraft())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar();
    if (tb) tb.setData({ selected: 2 });
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    Promise.all([core.syncOnShow(), this.refreshCraft(), this.refreshIncome()]).then(() => this.renderCraft());
  },
  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/create/index' };
  },
});
Page(page);
