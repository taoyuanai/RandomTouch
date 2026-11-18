/* services/real/index.js — Phase 2 按契约实现
 * 签名必须与 contract.md 完全一致；偏离只在本文件内适配。
 * 完成后：config.js USE_MOCK = false
 */
module.exports = {
  auth: notImpl, listSets: notImpl, getSet: notImpl, draw: notImpl,
  saveStamp: notImpl, unlock: notImpl, getComments: notImpl, addComment: notImpl,
  toggleLike: notImpl, getFeed: notImpl, getMyCraft: notImpl, submitCraft: notImpl,
  getIncome: notImpl, withdraw: notImpl, uploadImage: notImpl,
  reportRemindAuth: notImpl, track: notImpl,
};
function notImpl() {
  return Promise.reject({ code: 'INTERNAL', message: 'Phase 2 未实现', retryable: false });
}
