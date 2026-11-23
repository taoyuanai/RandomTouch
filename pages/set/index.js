// pages/set/index.js — 卡集详情（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('set');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS();
    const q = (options && (options.query || options)) || {};
    if (q.sid) {
      this.S.shareSid = q.nav ? null : Number(q.sid);
      this.S.cur = Number(q.sid);
      this._setRecTab = 'related';
    }
    if (this.S.cur == null) { wx.switchTab({ url: '/pages/home/index' }); return; }
    let statusBarHeight = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight, navTop: 0 });
    core.ensureBoot()
      .then(() => { this.renderSetPage(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted || this.S.cur == null) return;
    core.syncOnShow().then(() => this.renderSetPage());
  },
  onUnload() { this.teardownSetObservers(); },
  backSetPage() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },
  onShareAppMessage() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (s) return { title: `《${s.title}》 · 今天来抽一签`, path: `/pages/set/index?sid=${s.id}&from=share` };
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/home/index' };
  },
  onShareTimeline() {
    const s = this.S.sets.find(x => x.id === this.S.cur);
    if (s) return { title: `《${s.title}》 · 今天来抽一签`, query: `sid=${s.id}&from=timeline` };
    return { title: '万物皆可抽一签 · 今日做点小事' };
  },
});
Page(page);
