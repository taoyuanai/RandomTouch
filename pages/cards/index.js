// pages/cards/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('cards');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const q = (options && (options.query || options)) || {};
    if (q.from === 'remind') {
      setTimeout(() => this.toast('欢迎回来 · 今天的卡到了'), 400);
    }
    core.ensureBoot()
      .then(() => this.renderSubs())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
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
