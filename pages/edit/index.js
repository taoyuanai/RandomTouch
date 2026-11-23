// pages/edit/index.js — 编辑 / 审核（原生导航，本地草稿可离线）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('edit');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    let statusBarHeight = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = info.statusBarHeight || 20;
    } catch (e) { /* noop */ }
    this.setData({ statusBarHeight });
    if (!this.S.ed && !this.S.rv) { wx.switchTab({ url: '/pages/create/index' }); return; }
    this._applyNavTitle();
    if (this.S.rv) this.renderReview(); else this.renderEdit();
  },
  onShow() {
    if (!this.S) return;
    this.S.lastActive = Date.now();
    this._applyNavTitle();
  },
  onUnload() { this._flushDrafts(); },
  _applyNavTitle() {
    const title = this.S.rv ? '审核中' : '编辑卡集';
    this.setData({ navTitle: title });
    wx.setNavigationBarTitle({ title });
  },
  backEdit() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/create/index' }) });
  },
});
Page(page);
