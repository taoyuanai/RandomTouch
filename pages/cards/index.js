// pages/cards/index.js
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('cards');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight, menuPad: m.menuPad });
    const q = (options && (options.query || options)) || {};
    if (q.from === 'remind') {
      setTimeout(() => this.toast('欢迎回来 · 今天的卡到了'), 400);
    }
    core.ensureBoot()
      .then(() => { this.renderSubs(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    nav.syncTabBar(this, 'cards');
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
