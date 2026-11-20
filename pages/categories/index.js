// pages/categories/index.js — 九大分类索引（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('categories');
Object.assign(page, {
  onLoad() {
    this.S = core.getS(); // 每页第一行，必写
    core.ensureBoot()
      .then(() => { this.renderCategories(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },
  onShow() {
    if (!this.S || !this.S.booted) return;
    this.renderCategories();
  },
});
Page(page);
