// pages/cards/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('cards');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
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
