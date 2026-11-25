// pages/home/index.js
const { createPage, nav } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('home');
Object.assign(page, {
  onLoad(options) {
    this.S = core.getS(); // 每页第一行，必写
    /* V6 · 自定义导航：状态栏高度 */
    const m = nav.metrics();
    this.setData({ statusBarHeight: m.statusBarHeight });
    core.ensureBoot()
      .then(() => {
      this.renderHome();
      this.handleLaunchOptions(options);
      this.setData({ booting: false });
    })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow(options) {
    nav.syncTabBar(this, 'home');
    if (!this.S) return;
    this.S.lastActive = Date.now();
    if (!this.S.booted) return;
    const picked = this.consumePendingCat();
    core.syncOnShow().then(() => {
      this.renderHome();
      this.handleLaunchOptions(options);
      if (picked) wx.pageScrollTo({ selector: '#squareList', duration: 220 });
    });
  },
  onShareAppMessage() {
    return { title: '万物皆可抽一签 · 今日做点小事', path: '/pages/home/index' };
  },
  onShareTimeline() {
    return { title: '万物皆可抽一签 · 今日做点小事' };
  },
});
Page(page);
