/* 小程序码：wxacode.getUnlimited → COS。失败一律返回空路径（契约允许）。 */
const axios = require('axios');
const config = require('../config');
const { getAccessToken } = require('./session');
const { putBuffer } = require('./cos');
const { safeGet, safeSet } = require('../redis');

async function getPosterQR(userId, setId) {
  const cacheKey = `qr:${setId}`;
  const cached = await safeGet(cacheKey);
  if (cached) return cached;
  if (config.secMode === 'mock' && (!config.wx.appid || !config.wx.secret)) return '';
  try {
    const token = await getAccessToken();
    const resp = await axios.post(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
      {
        scene: `s=${Number(setId) || 0}`,
        page: 'pages/home/index',
        width: 280,
        check_path: false,
        env_version: config.appEnv === 'prod' ? 'release' : 'trial',
      },
      { responseType: 'arraybuffer', timeout: 10000, validateStatus: () => true }
    );
    const ct = String(resp.headers['content-type'] || '');
    if (!ct.includes('image')) return '';
    const { url } = await putBuffer({
      buffer: Buffer.from(resp.data),
      mime: 'image/png',
      kind: 'qr',
      userId,
      ext: 'png',
    });
    await safeSet(cacheKey, url, 7 * 86400);
    return url;
  } catch (e) {
    return '';
  }
}

module.exports = { getPosterQR };
