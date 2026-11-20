/* cloudfunctions/qrcode — 生成卡集小程序码，供海报 QR 回流 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  try {
    const sid = Math.max(0, Number(event.sid) || 0);
    const scene = `s=${sid}`.slice(0, 32);
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: 'pages/home/index',
      width: 280,
      checkPath: false,
    });
    const up = await cloud.uploadFile({
      cloudPath: `qrcode/set-${sid}-${Date.now()}.png`,
      fileContent: res.buffer,
    });
    return { fileID: up.fileID };
  } catch (e) {
    console.warn('[qrcode] failed', e && e.message);
    return { fileID: '', error: (e && e.message) || 'qrcode failed' };
  }
};
