// app.js
const posterKit = require('./utils/posterKit/export.js');
const Security = require('./utils/security.js');

let core = null;
let api = null;
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

  onLaunch() {
    this.__api = api;
    this.__apiDebug = api && api.__debug;
    try {
      if (core) core.initS();
      if (api && typeof api.auth === 'function') api.auth().catch(() => {});
      if (core) core.ensureBoot().catch(() => {}); // 预热；各页 await 同一 promise
    } catch (e) {
      console.error('[core] init failed', e);
    }

    if (!Security.cloudReady()) return;
    try {
      wx.cloud.init({ env: Security.CLOUD_ENV, traceUser: true });
      wx.login({
        success: ({ code }) => {
          wx.cloud.callFunction({ name: 'auth', data: { code } })
            .then((r) => {
              this.globalData.openid = (r && r.result && r.result.openid) || '';
            })
            .catch(() => { this.globalData.openid = ''; });
        },
      });
    } catch (e) { /* 云环境未就绪时保持 demo 可用 */ }
  },
});
