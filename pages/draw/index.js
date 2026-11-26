// pages/draw/index.js — 抽卡（沉浸式 custom 导航）
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('draw');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const q = (options && (options.query || options)) || {};
    if (q.sid) this.S.cur = Number(q.sid);
    if (this.S.cur == null) { wx.switchTab({ url: '/pages/home/index' }); return; }
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight, navTop: m.navTop, dkH: nav.cardStageH(m) });
    core.ensureBoot()
      .then(() => core.ensureSetDetail(this.S.cur))
      .then(() => this.renderDraw())
      .catch(() => this.setData({ bootError: true }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted || this.S.cur == null) return;
    if (this.data.draw) {
      core.ensureSetDetail(this.S.cur).then(() => this.renderDraw()).catch(() => {});
    }
  },
  onUnload() {
    clearTimeout(this._drawTimer);
    clearTimeout(this._doneTimer);
    clearTimeout(this._fxTimer);
    this._releaseEnv();
  },
});
Page(page);
