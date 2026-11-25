// pages/me/index.js
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('me');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight, menuPad: m.menuPad });
    core.ensureBoot()
      .then(() => this.renderMe())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    nav.syncTabBar(this, 'me');
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    Promise.all([core.syncOnShow(), this.refreshIncome()]).then(() => this.renderMe());
  },
  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/me/index' };
  },
});
Page(page);
