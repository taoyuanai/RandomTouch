/* lib/shared/index.js — 页面组合入口：基础 VM + 分阶段 overrides */
const core = require('../core.js');
const { PAGE_OPTS } = require('./base.js');
const { overrides } = require('./overrides.js');
const { d4Overrides } = require('./d4.js');
const { d5Overrides } = require('./d5.js');
const { clone } = core;
const nav = require('../nav.js');

const HOOKS = ['onLoad', 'onShow', 'onReady', 'onUnload', 'onShareAppMessage', 'onShareTimeline'];

function createPage(name, extra = {}) {
  const base = {};
  Object.keys(PAGE_OPTS).forEach(k => {
    if (HOOKS.includes(k)) return;
    base[k] = PAGE_OPTS[k];
  });
  Object.assign(base, overrides, d4Overrides, d5Overrides, extra);
  base.__page = name;
  base.data = clone(PAGE_OPTS.data);
  return base;
}

module.exports = { createPage, nav };
