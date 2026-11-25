/* 运行配置：
 * RELEASE=false  → 开发/演示：Mock 数据，允许 HTTP 本地后端。
 * RELEASE=true   → 提审/生产：必须 HTTPS API + 真实订阅模板；DEBUG 永远为 false。
 *
 * 发布前步骤见 docs/release-checklist.md，并执行：
 *   node tools/release-check.js
 */
const RELEASE = false;

const DEV_API_BASE = 'http://106.54.4.127/api/v1';
// 替换为已备案、已配置 HTTPS、已加入小程序合法域名的正式 API 域名。
const RELEASE_API_BASE = 'https://api.example.com/api/v1';

const USE_MOCK = !RELEASE;
const DEBUG = false; // 永远关闭 __apiDebug 后门；本地临时调试请手动临时改，不要提交
// P0-6B 真实微信支付接入并验证回调后改为 true；当前 unlock 仍是模拟支付。
const PAYMENT_READY = false;

function releaseErrors() {
  const errs = [];
  if (!RELEASE) errs.push('RELEASE=false');
  if (USE_MOCK) errs.push('USE_MOCK=true');
  if (DEBUG) errs.push('DEBUG=true');
  if (!PAYMENT_READY) errs.push('PAYMENT_READY=false（真实支付未接入）');
  if (!/^https:\/\//i.test(RELEASE_API_BASE || '')) errs.push('RELEASE_API_BASE 不是 HTTPS');
  if (/example\.com|localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}/i.test(RELEASE_API_BASE || '')) {
    errs.push('RELEASE_API_BASE 仍是占位/本地/IP 地址');
  }
  return errs;
}

module.exports = {
  RELEASE,
  USE_MOCK,
  DEBUG,
  PAYMENT_READY,
  CLOUD_ENV: '', // 可选：小程序码云函数环境；自建后端 QR 可不填
  API_BASE: RELEASE ? RELEASE_API_BASE : DEV_API_BASE,
  DEV_API_BASE,
  RELEASE_API_BASE,
  TOKEN_KEY: 'dsm_token',
  releaseErrors,
};
