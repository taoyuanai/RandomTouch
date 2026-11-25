/* tools/test/nav.test.js — 导航度量与 tabBar 同步 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installWx } = require('./harness');

installWx({
  getWindowInfo: () => ({
    windowWidth: 390, windowHeight: 844,
    screenWidth: 390, screenHeight: 844, statusBarHeight: 20,
  }),
  getMenuButtonBoundingClientRect: () => ({ left: 300, bottom: 64 }),
});

const nav = require('../../lib/nav.js');

test('metrics 统一状态栏 / navTop / 胶囊让位', () => {
  const m = nav.metrics();
  assert.equal(m.winW, 390);
  assert.equal(m.winH, 844);
  assert.equal(m.statusBarHeight, 20);
  assert.equal(m.navTop, 70);
  assert.equal(m.menuPad, 98);
});

test('cardStageH 与旧公式一致', () => {
  const m = nav.metrics();
  const n = nav.cardStageH(m);
  const byH = m.winH - m.navTop - 56 - 128 - 24;
  const byW = Math.floor(m.winW * 7 / 5);
  assert.equal(n, Math.max(240, Math.min(546, byH, byW)));
});

test('syncTabBar 选择正确 tab，缺 getTabBar 不抛错', () => {
  let patch = null;
  const page = { getTabBar: () => ({ setData: (p) => { patch = p; } }) };
  nav.syncTabBar(page, 'me');
  assert.deepEqual(patch, { selected: 3 });
  nav.syncTabBar(page, 'unknown');
  nav.syncTabBar({}, 'home');
  assert.doesNotThrow(() => nav.syncTabBar({ getTabBar: () => null }, 'home'));
});
