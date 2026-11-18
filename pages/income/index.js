// pages/income/index.js — 收益看板（原生导航）
const { createPage } = require('../../lib/shared.js');
const core = require('../../lib/core.js');
const page = createPage('income');
Object.assign(page, {
  onLoad() { this.S = core.getS(); this.renderIncome(); },
  onShow() { this.S.lastActive = Date.now(); this.renderIncome(); },
});
Page(page);
