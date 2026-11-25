// pages/map/index.js — 全图（原生导航）
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('map');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight });
    const q = (options && (options.query || options)) || {};
    if (q.sid) this.S.cur = Number(q.sid);
    if (this.S.cur == null) { wx.switchTab({ url: '/pages/home/index' }); return; }
    core.ensureBoot()
      .then(() => core.ensureSetDetail(this.S.cur))
      .then(() => this.renderMap())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted || this.S.cur == null) return;
    core.syncOnShow()
      .then(() => core.ensureSetDetail(this.S.cur))
      .then(() => this.renderMap())
      .catch(() => {});
  },
  backMap() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },
});
Page(page);
