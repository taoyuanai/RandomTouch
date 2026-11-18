// pages/me/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('me');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    core.ensureBoot()
      .then(() => this.renderMe())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    core.syncOnShow().then(() => this.renderMe());
  },
  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/me/index' };
  },
});
Page(page);
