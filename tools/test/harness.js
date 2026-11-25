/* tools/test/harness.js — 测试用 wx / 页面沙箱
 * 不依赖 npm；每个 test 文件独立进程，mock store 从空 storage 启动。
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function installWx(overrides) {
  const storage = {};
  global.wx = Object.assign({
    getStorageSync: (k) => (k in storage ? storage[k] : ''),
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: (k) => { delete storage[k]; },
    getWindowInfo: () => ({
      windowWidth: 390, windowHeight: 844,
      screenWidth: 390, screenHeight: 844, statusBarHeight: 20,
    }),
    getSystemInfoSync: () => ({
      windowWidth: 390, windowHeight: 844,
      screenWidth: 390, screenHeight: 844, statusBarHeight: 20,
    }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 64 }),
    showModal: ({ success }) => success && success({ confirm: true }),
    showActionSheet: ({ success }) => success && success({ tapIndex: 0 }),
    showLoading: () => {},
    hideLoading: () => {},
    showToast: () => {},
    nextTick: (fn) => fn(),
    createIntersectionObserver: () => {
      const obs = {
        relativeToViewport: () => obs,
        observe: () => {},
        disconnect: () => {},
      };
      return obs;
    },
    hideTabBar: () => {},
    showTabBar: () => {},
    pageScrollTo: () => {},
    navigateTo: () => {},
    switchTab: () => {},
    navigateBack: () => {},
    setClipboardData: () => {},
  }, overrides || {});
  return global.wx;
}

function resetModules() {
  Object.keys(require.cache).forEach((k) => {
    if (k.startsWith(ROOT) && !k.includes('node_modules')) delete require.cache[k];
  });
}

async function boot() {
  const core = require('../../lib/core.js');
  await core.ensureBoot();
  return { core, S: core.getS() };
}

function makePage(name, S) {
  const { createPage } = require('../../lib/shared.js');
  const p = createPage(name);
  p.S = S;
  p.setData = function setData(patch) {
    Object.keys(patch).forEach((key) => {
      const parts = key.split('.');
      let obj = this.data;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = patch[key];
    });
  };
  return p;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = fn();
    if (v) return v;
    await wait(20);
  }
  return null;
}

module.exports = { ROOT, installWx, resetModules, boot, makePage, wait, waitFor };
