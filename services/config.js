module.exports = {
  // 真机/未配置 HTTPS 域名期间先走 mock，保证 UI 可打开；
  // 远端测试后端就绪（HTTPS + 小程序 request 合法域名）后切回 false。
  USE_MOCK: true,
  DEBUG: true, // 提审前必须 false：压制 __apiDebug 后门
  CLOUD_ENV: '', // 填入云开发环境 ID 后启用小程序码（自建后端上线后可留空）
  // 自建后端地址，必须 HTTPS 且已在小程序后台配置 request/uploadFile/downloadFile 域名。
  // 真机不能请求 HTTP / IP；本地联调可填 http://127.0.0.1:3000/api/v1 并在开发者工具勾选「不校验合法域名」。
  API_BASE: 'http://106.54.4.127/api/v1',
  TOKEN_KEY: 'dsm_token',
};
