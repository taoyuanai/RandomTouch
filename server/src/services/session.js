/* 微信登录与 access_token。AppSecret 仅在服务器内存/env 中出现。 */
const axios = require('axios');
const config = require('../config');
const { safeGet, safeSet } = require('../redis');
const { authFailed, internal } = require('../http/errors');

const TOKEN_KEY = 'wx:access_token';

async function code2session(code) {
  if (!config.wx.appid || !config.wx.secret) {
    throw internal('未配置微信登录（WX_APPID/WX_SECRET）');
  }
  let data;
  try {
    ({ data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: config.wx.appid,
        secret: config.wx.secret,
        js_code: code,
        grant_type: 'authorization_code',
      },
      timeout: 8000,
    }));
  } catch (e) {
    throw authFailed('微信登录服务暂不可用');
  }
  if (!data || !data.openid) {
    throw authFailed(`微信登录失败${data && data.errcode ? `(${data.errcode})` : ''}`);
  }
  return data; // { openid, session_key, unionid? }
}

async function getAccessToken() {
  const cached = await safeGet(TOKEN_KEY);
  if (cached) return cached;
  if (!config.wx.appid || !config.wx.secret) {
    throw internal('未配置微信 access_token 凭证');
  }
  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: config.wx.appid,
      secret: config.wx.secret,
    },
    timeout: 8000,
  });
  if (!data || !data.access_token) {
    throw internal(`获取 access_token 失败${data && data.errcode ? `(${data.errcode})` : ''}`);
  }
  await safeSet(TOKEN_KEY, data.access_token, Math.max(60, (data.expires_in || 7200) - 200));
  return data.access_token;
}

module.exports = { code2session, getAccessToken };
