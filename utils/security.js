/* ══════════════════════════════════════════════════════════
   security.js · 内容安全客户端封装
   身份：app.js 静默登录（wx.cloud.callFunction('auth')）
   检测：cloudfunctions/sec
   预览环境 / 未配置云环境时：mock 为 pass，保证 demo 可用
   ══════════════════════════════════════════════════════════ */

// 上线前填入微信云开发环境 ID；为空时走本地 mock。
const CLOUD_ENV = '';

function cloudReady() {
  return typeof wx !== 'undefined' && !!wx.cloud && !!CLOUD_ENV;
}

function mockResult(action) {
  if (action === 'image.submit') return { media: 'pass', traceId: 'mock' };
  if (action === 'comment.create') return { status: 'visible', suggest: 'pass' };
  if (action === 'stamp.create') return { ok: true, sec: { text: 'pass', media: 'none' } };
  if (action === 'set.submit') return { status: 'submitted', machineFlag: false, suggest: 'pass' };
  return { suggest: 'pass' };
}

async function call(action, data) {
  if (!cloudReady()) return mockResult(action);
  const res = await wx.cloud.callFunction({
    name: 'sec',
    data: Object.assign({ action }, data || {}),
  });
  return (res && res.result) || mockResult(action);
}

async function uploadImage(filePath) {
  if (!filePath || !cloudReady() || !wx.cloud.uploadFile) return '';
  const ext = (filePath.match(/\.(\w+)(?:\?|$)/) || [])[1] || 'jpg';
  const cloudPath = `stamps/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await wx.cloud.uploadFile({ cloudPath, filePath });
  return (res && res.fileID) || '';
}

module.exports = {
  CLOUD_ENV,
  cloudReady,
  call,
  uploadImage,
  checkText: (text, scene) => call('text.check', { text, scene: scene || 2 }),
  checkImage: (fileID, scene) => call('image.submit', { fileID, scene: scene || 4 }),
  commentCreate: (text) => call('comment.create', { text }),
  stampCreate: (note, imgFileID) => call('stamp.create', { note, imgFileID }),
  setSubmit: (set) => call('set.submit', { set }),
};
