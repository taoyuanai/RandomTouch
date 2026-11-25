/* lib/nav.js — 自定义导航 / tabBar 的统一度量与同步
 * 页面只保留生命周期；这里只依赖 wx，不碰业务状态。
 */
const TAB_INDEX = { home: 0, cards: 1, create: 2, me: 3 };

function metrics() {
  let info = {};
  try {
    info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) { /* noop */ }
  const winW = info.windowWidth || info.screenWidth || 375;
  const winH = info.windowHeight || info.screenHeight || 667;
  const statusBarHeight = info.statusBarHeight || 20;
  let navTop = statusBarHeight + 44;
  let menuPad = 100;
  try {
    if (wx.getMenuButtonBoundingClientRect) {
      const rect = wx.getMenuButtonBoundingClientRect();
      if (rect) {
        if (rect.left) menuPad = Math.max(76, winW - rect.left + 8);
        if (rect.bottom) navTop = Math.max(statusBarHeight, rect.bottom + 6);
      }
    }
  } catch (e) { /* noop */ }
  return { winW, winH, statusBarHeight, navTop, menuPad };
}

/* V4 · 满幅卡进页锁高：min(546, 高−navtop−56−128−24, 屏宽×7/5) */
function cardStageH(m) {
  const nav = m || metrics();
  const byH = nav.winH - nav.navTop - 56 - 128 - 24;
  const byW = Math.floor(nav.winW * 7 / 5);
  return Math.max(240, Math.min(546, byH, byW));
}

function syncTabBar(page, name) {
  const idx = TAB_INDEX[name];
  if (idx == null || !page || typeof page.getTabBar !== 'function') return;
  try {
    const tb = page.getTabBar();
    if (tb) tb.setData({ selected: idx });
  } catch (e) { /* noop */ }
}

module.exports = { TAB_INDEX, metrics, cardStageH, syncTabBar };
