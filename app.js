// app.js
const posterKit = require('./utils/posterKit/export.js');
const Security = require('./utils/security.js');
const api = require('./services/api.js');

// 部署衬线字体子集后填入 CDN 地址（需加入 downloadFile 合法域名）。
// 留空则整体回退系统衬线（iOS 宋体 / 安卓默认），不阻塞海报生成。
const POSTER_FONT_URL = '';
if (POSTER_FONT_URL) {
  posterKit.setPosterFontSource(POSTER_FONT_URL);
  // 站内与海报共用同一份宋体子集，加载后截屏即海报
  posterKit.ensureFonts();
}

App({
  __api: api,                 // 控制台验收用：getApp().__api.listSets()
  __apiDebug: api.__debug,    // mock 调试后门；real 模式下为 null
  globalData: { openid: '' },

  onLaunch() {
    api.auth().catch(() => {});
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
