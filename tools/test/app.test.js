/* tools/test/app.test.js — App 级错误兜底 / 404 回首页 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules } = require('./harness');

let appOpts = null;
let switched = '';

global.App = (opts) => { appOpts = opts; };

installWx({
  switchTab: ({ url }) => { switched = url; },
});
resetModules();
require('../../app.js');

test('注册 onError / onUnhandledRejection / onPageNotFound', () => {
  assert.equal(typeof appOpts.onError, 'function');
  assert.equal(typeof appOpts.onUnhandledRejection, 'function');
  assert.equal(typeof appOpts.onPageNotFound, 'function');
});

test('未知页面回首页 tab', () => {
  appOpts.onPageNotFound({ path: 'pages/nope/index' });
  assert.equal(switched, '/pages/home/index');
});
