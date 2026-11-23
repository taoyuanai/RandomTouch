// pages/cards/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('cards');
Object.assign(page, {
  onLoad(options) {
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
    const q = (options && (options.query || options)) || {};
    if (q.from === 'remind') {
      setTimeout(() => this.toast('欢迎回来 · 今天的卡到了'), 400);
    }
    core.ensureBoot()
      .then(() => { this.renderSubs(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar();
    if (tb) tb.setData({ selected: 1 });
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    core.syncOnShow().then(() => this.renderSubs());
  },
  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/cards/index' };
  },
});
Page(page);
