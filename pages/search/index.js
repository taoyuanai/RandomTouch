// pages/search/index.js — 搜索（原生导航）
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('search');
Object.assign(page, {
  onLoad() {
    this.S = core.getS(); // 每页第一行，必写
    this._searchQ = '';
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight, menuPad: m.menuPad });
    core.ensureBoot()
      .then(() => { this.renderSearch(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    if (!this.S || !this.S.booted) return;
    this.renderSearch();
  },
  onUnload() { this.stopSearchTimer(); },
});
Page(page);
