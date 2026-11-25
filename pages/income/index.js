// pages/income/index.js — 收益看板（原生导航）
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('income');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight });
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
