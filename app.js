// app.js
const posterKit = require('./utils/posterKit/export.js');
const { CLOUD_ENV } = require('./services/config.js');

let core = null;
let api = null;
let tracker = null;
try { tracker = require('./lib/track.js'); } catch (e) { /* track 失败不拖垮启动 */ }
try {
  core = require('./lib/core.js');
  api = require('./services/api.js');
} catch (e) {
  // 防御：数据层异常不应拖垮整个小程序
  console.error('[core] load failed', e);
}

// 部署衬线字体子集后填入 CDN 地址（需加入 downloadFile 合法域名）。
const POSTER_FONT_URL = '';
if (POSTER_FONT_URL) {
  posterKit.setPosterFontSource(POSTER_FONT_URL);
  posterKit.ensureFonts();
}

App({
  globalData: { openid: '' },

  onError(err) {
    console.error('[app] error', err);
    if (tracker) {
      try {
        tracker.t('app_error', {
          message: String((err && (err.message || err.stack)) || err || '').slice(0, 180),
        });
      } catch (e) { /* noop */ }
    }
  },

  onUnhandledRejection(res) {
    const reason = res && res.reason;
    console.error('[app] unhandled rejection', reason);
    if (tracker) {
      try {
        tracker.t('app_unhandled_rejection', {
          message: String((reason && (reason.message || reason)) || '').slice(0, 180),
        });
      } catch (e) { /* noop */ }
    }
  },

  onPageNotFound(res) {
    console.warn('[app] page not found', res && res.path);
    try { wx.switchTab({ url: '/pages/home/index' }); } catch (e) { /* noop */ }
  },

  onLaunch() {
    this.__api = api;
    if (wx.cloud && CLOUD_ENV) {
      try { wx.cloud.init({ env: CLOUD_ENV, traceUser: true }); } catch (e) { console.warn('[cloud] init failed', e); }
    }
    this.__apiDebug = api && api.__debug;
    try {
      if (core) core.initS();
      if (api && typeof api.auth === 'function') api.auth().catch(() => {});
      if (core) core.ensureBoot().catch(() => {}); // 预热；各页 await 同一 promise
      try { require('./lib/track.js').flush(); } catch (e) {}
    } catch (e) {
      console.error('[core] init failed', e);
    }

  },
});
