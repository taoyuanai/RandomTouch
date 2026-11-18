/* lib/track.js — 埋点封装：失败本地排队，flush 补投（契约 track 不变） */
const api = require('../services/api.js');
const KEY = 'dsm_track_queue';
const MAX = 50;

function t(event, props) {
  api.track(event, props || {}).catch(() => {
    try {
      const q = JSON.parse(wx.getStorageSync(KEY) || '[]');
      q.push({ event, props: props || {}, ts: Date.now() });
      wx.setStorageSync(KEY, JSON.stringify(q.slice(-MAX)));
    } catch (e) { /* 无 storage：丢弃 */ }
  });
}

function flush() {
  let q = [];
  try { q = JSON.parse(wx.getStorageSync(KEY) || '[]'); } catch (e) {}
  if (!q.length) return Promise.resolve();
  return Promise.all(q.map(x => api.track(x.event, x.props).catch(() => null)))
    .then(() => { try { wx.setStorageSync(KEY, '[]'); } catch (e) {} });
}

module.exports = { t, flush };
