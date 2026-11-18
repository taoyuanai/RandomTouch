// pages/create/index.js
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('create');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    core.ensureBoot()
      .then(() => this.refreshCraft())
      .then(() => this.renderCraft())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
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
