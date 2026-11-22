/* 内容安全：直连微信 OpenAPI（不依赖云开发）。
 * SEC_MODE=mock 时一律放行，供测试环境。
 * 返回值：'pass' | 'pending' | 'risky'
 */
const axios = require('axios');
const config = require('../config');
const { getAccessToken } = require('./session');

async function checkText({ content, openid, scene = 2 }) {
  if (config.secMode !== 'real') return 'pass';
  const text = String(content || '').trim();
  if (!text) return 'pass';
  try {
    const token = await getAccessToken();
    const { data } = await axios.post(
      `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`,
      { content: text.slice(0, 2500), version: 2, scene, openid },
      { timeout: 8000 }
    );
    if (!data || data.errcode !== 0) {
      // 接口异常时不误判为违规，交给人工/重试
      return 'pending';
    }
    const suggest = data.result && data.result.suggest;
    if (suggest === 'risky') return 'risky';
    if (suggest === 'review') return 'pending';
    return 'pass';
  } catch (e) {
    return 'pending';
  }
}

/* 图片检测是异步回调式；提交时只能返回 pending（有图）或 none。 */
async function checkMedia({ mediaUrl, openid }) {
  if (!mediaUrl) return 'none';
  if (config.secMode !== 'real') return 'pass';
  try {
    const token = await getAccessToken();
    const { data } = await axios.post(
      `https://api.weixin.qq.com/wxa/media_check_async?access_token=${encodeURIComponent(token)}`,
      { media_url: mediaUrl, media_type: 2, version: 2, scene: 2, openid },
      { timeout: 8000 }
    );
    if (!data || data.errcode !== 0) return 'pending';
    return 'pending';
  } catch (e) {
    return 'pending';
  }
}

module.exports = { checkText, checkMedia };
