// pages/income/index.js — 收益看板（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('income');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    let statusBarHeight = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight });
    this.renderIncome();
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    this.renderIncome();
  },
  backIncome() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/create/index' }) });
  },
});
Page(page);
