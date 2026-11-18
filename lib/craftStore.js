/* lib/craftStore.js — 草稿本地持久化（契约 D005） */
const KEY = 'dsm_drafts_v1';

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 无 storage 环境：走内存 */ }
  return [];
}

function save(drafts) {
  try { wx.setStorageSync(KEY, JSON.stringify(drafts)); } catch (e) {}
}

module.exports = { load, save };
