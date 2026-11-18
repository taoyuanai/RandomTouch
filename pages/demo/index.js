// pages/demo/index.js — 组件总览（D6 删除）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('demo');
Object.assign(page, {
  onLoad() {
    this.S = core.getS();
    this.setData({ demo: { mode: this.S.mode } });
    core.ensureBoot().catch(() => {});
  },
});
Page(page);
