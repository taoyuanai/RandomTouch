module.exports = {
  USE_MOCK: true, // Phase 2 切 false 前必须完成 real/index.js
  DEBUG: true, // 提审前必须 false：压制 __apiDebug 后门
  CLOUD_ENV: '', // 填入云开发环境 ID 后启用小程序码（自建后端上线后可留空）
  // 自建后端地址，必须 HTTPS 且已在小程序后台配置 request/uploadFile/downloadFile 域名。
  // 本地联调可填 http://127.0.0.1:3000/api/v1 并在开发者工具勾选「不校验合法域名」。
  API_BASE: '',
  TOKEN_KEY: 'dsm_token',
};
