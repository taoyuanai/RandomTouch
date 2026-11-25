#!/usr/bin/env node
/* 发布前配置闸门：node tools/release-check.js
 * 任一失败即退出 1；域名白名单/COS 私有化仍需在小程序后台与 COS 控制台确认。
 */
const path = require('path');
const config = require(path.resolve(__dirname, '../services/config.js'));
const core = require(path.resolve(__dirname, '../lib/core.js'));

let errors = [];
const e = (msg) => errors.push(msg);

if (typeof config.releaseErrors === 'function') {
  config.releaseErrors().forEach(e);
}
if (!/^https:\/\//i.test(config.API_BASE || '')) e('API_BASE 必须是 HTTPS');
if (/example\.com|localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}/i.test(config.API_BASE || '')) {
  e('API_BASE 仍是占位/本地/IP 地址');
}
if (!Array.isArray(core.TMPL_IDS) || !core.TMPL_IDS.length) {
  e('lib/core.js: TMPL_IDS 为空（每日提醒模板未配置）');
}
errors = Array.from(new Set(errors));

if (errors.length) {
  console.error('✗ release-check failed');
  errors.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log('✓ release-check passed');
['API_BASE', 'RELEASE', 'USE_MOCK', 'DEBUG'].forEach(k => console.log(`  ${k}=${config[k]}`));
console.log(`  TMPL_IDS=${JSON.stringify(core.TMPL_IDS)}`);
