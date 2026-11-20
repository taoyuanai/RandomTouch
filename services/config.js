module.exports = {
  USE_MOCK: true, // Phase 2 切 false 前必须完成 real/index.js
  DEBUG: true,
  CLOUD_ENV: '', // 填入云开发环境 ID 后启用小程序码 // 提审前必须 false：压制 __apiDebug 后门
};
