/* services/api.js — 页面唯一数据出口。页面只许 require 这里。 */
const { USE_MOCK, DEBUG } = require('./config.js');

const impl = USE_MOCK
  ? require('./mock/index.js')
  : require('./real/index.js');

/* requestId 生成器（draw 幂等键） */
function reqId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  reqId,
  auth: impl.auth,
  listSets: impl.listSets,
  getSet: impl.getSet,
  draw: impl.draw,
  saveStamp: impl.saveStamp,
  unlock: impl.unlock,
  getComments: impl.getComments,
  addComment: impl.addComment,
  toggleLike: impl.toggleLike,
  markWeekly: impl.markWeekly,
  getAuthor: impl.getAuthor,
  toggleFollow: impl.toggleFollow,
  getFeed: impl.getFeed,
  getMyCraft: impl.getMyCraft,
  submitCraft: impl.submitCraft,
  getIncome: impl.getIncome,
  withdraw: impl.withdraw,
  uploadImage: impl.uploadImage,
  reportRemindAuth: impl.reportRemindAuth,
  track: impl.track,
  __debug: (DEBUG && impl._debug) || null, // 仅 mock + DEBUG；提审前关
};
