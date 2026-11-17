// app.js
const posterKit = require('./utils/posterKit/export.js');

// 部署衬线字体子集后填入 CDN 地址（需加入 downloadFile 合法域名）。
// 留空则整体回退系统衬线（iOS 宋体 / 安卓默认），不阻塞海报生成。
const POSTER_FONT_URL = '';
if (POSTER_FONT_URL) {
  posterKit.setPosterFontSource(POSTER_FONT_URL);
  // 站内与海报共用同一份宋体子集，加载后截屏即海报
  posterKit.ensureFonts();
}

App({
  globalData: {},
});
