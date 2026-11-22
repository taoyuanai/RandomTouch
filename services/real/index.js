/* services/real/index.js — 按契约 v1 对接自建后端（Node/MySQL/Redis/COS）。
 * 唯一允许改动的前端接入层；页面与 lib/ 零改动。
 * 完成后：services/config.js USE_MOCK = false。
 */
const cfg = require('../config.js');

let token = '';
try { token = wx.getStorageSync(cfg.TOKEN_KEY) || ''; } catch (e) { /* ignore */ }

let sessionPromise = null;

function base() {
  const b = String(cfg.API_BASE || '').replace(/\/+$/, '');
  if (!b) {
    const err = { code: 'INTERNAL', message: '未配置 API_BASE', retryable: false };
    throw err;
  }
  return b;
}

function setToken(t) {
  token = t || '';
  try {
    if (token) wx.setStorageSync(cfg.TOKEN_KEY, token);
    else wx.removeStorageSync(cfg.TOKEN_KEY);
  } catch (e) { /* ignore */ }
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(r) {
        if (r && r.code) resolve(r.code);
        else reject({ code: 'AUTH_FAILED', message: '微信登录失败', retryable: true });
      },
      fail() { reject({ code: 'AUTH_FAILED', message: '微信登录失败', retryable: true }); },
    });
  });
}

function rawRequest(path, data, opts) {
  const o = opts || {};
  const method = o.method || 'POST';
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    if (o.auth !== false && token) header.Authorization = 'Bearer ' + token;
    wx.request({
      url: base() + path,
      method,
      data,
      header,
      timeout: 15000,
      success(res) {
        const b = res.data;
        if (res.statusCode >= 200 && res.statusCode < 300 && !(b && b.code)) {
          return resolve(b);
        }
        if (b && b.code) {
          return reject({ code: b.code, message: b.message || '', retryable: !!b.retryable });
        }
        if (res.statusCode === 401) {
          return reject({ code: 'AUTH_FAILED', message: '登录态失效', retryable: true });
        }
        reject({ code: 'INTERNAL', message: '服务暂不可用', retryable: true });
      },
      fail() {
        reject({ code: 'INTERNAL', message: '网络开小差了，稍后再试', retryable: true });
      },
    });
  });
}

function doLogin() {
  return wxLogin()
    .then(code => rawRequest('/auth/login', { code }, { auth: false }))
    .then(r => {
      if (!r || !r.token) throw { code: 'AUTH_FAILED', message: '登录失败', retryable: true };
      setToken(r.token);
      return true;
    });
}

/* 单例登录 Promise：app.js 里 auth() 与 ensureBoot() 并发时只登录一次 */
function ensureSession() {
  if (token) return Promise.resolve();
  if (!sessionPromise) {
    sessionPromise = doLogin().catch(err => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

function request(path, data, opts) {
  const o = opts || {};
  return ensureSession()
    .then(() => rawRequest(path, data, o))
    .catch(err => {
      if (err && err.code === 'AUTH_FAILED' && !o._retried) {
        setToken('');
        sessionPromise = null;
        return ensureSession().then(() => rawRequest(path, data, Object.assign({}, o, { _retried: true })));
      }
      throw err;
    });
}

function get(path, query) {
  return request(path, query || {}, { method: 'GET' });
}

/* ── 契约方法 ── */

function auth() {
  return ensureSession().then(() => ({ ok: true }));
}

function listSets(q) {
  const query = {};
  if (q && q.cat) query.cat = q.cat;
  if (q && q.sort) query.sort = q.sort;
  return get('/sets', query);
}

function getSet(setId) {
  return get('/sets/' + Number(setId));
}

function draw(opts) {
  const o = opts || {};
  return request('/sets/' + Number(o.setId) + '/draw', { requestId: o.requestId });
}

function saveStamp(opts) {
  const o = opts || {};
  return request('/sets/' + Number(o.setId) + '/stamp', {
    idx: o.idx, note: o.note || '', imgFileID: o.imgFileID || '',
  });
}

function unlock(opts) {
  return request('/sets/' + Number((opts || {}).setId) + '/unlock', {});
}

function subscribeSet(opts) {
  return request('/sets/' + Number((opts || {}).setId) + '/subscribe', {});
}

function getPosterQR(opts) {
  return get('/sets/' + Number((opts || {}).setId) + '/qr');
}

function getComments(setId) {
  return get('/sets/' + Number(setId) + '/comments');
}

function addComment(opts) {
  const o = opts || {};
  return request('/sets/' + Number(o.setId) + '/comments', { text: o.text });
}

function toggleLike(opts) {
  return request('/sets/' + Number((opts || {}).setId) + '/like', {});
}

function markWeekly(opts) {
  const o = opts || {};
  return request('/sets/' + Number(o.setId) + '/weekly', { weekNo: o.weekNo });
}

function getAuthor(opts) {
  const name = encodeURIComponent(String((opts || {}).name || ''));
  return get('/authors/' + name);
}

function toggleFollow(opts) {
  const name = encodeURIComponent(String((opts || {}).name || ''));
  return request('/authors/' + name + '/follow', {});
}

function getFeed() {
  return get('/feed');
}

function getMyCraft() {
  return get('/craft');
}

async function submitCraft(opts) {
  const draft = Object.assign({}, (opts || {}).draft);
  // 封面是本地临时路径：先上传换 COS 地址（失败则保留原值，由服务端落库）
  if (draft.coverImage && !/^https?:\/\//i.test(draft.coverImage)) {
    try {
      const up = await uploadImageWithKind(draft.coverImage, 'covers');
      draft.coverImage = up.url || up.fileID;
    } catch (e) { /* 不阻断提交 */ }
  }
  return request('/craft', { draft });
}

function getIncome() {
  return get('/income');
}

function withdraw() {
  return request('/income/withdraw', {});
}

function uploadImageWithKind(filePath, kind) {
  return ensureSession().then(() => new Promise((resolve, reject) => {
    const header = {};
    if (token) header.Authorization = 'Bearer ' + token;
    wx.uploadFile({
      url: base() + '/upload',
      filePath,
      name: 'file',
      formData: { kind: kind || 'stamps' },
      header,
      timeout: 30000,
      success(res) {
        let b = null;
        try { b = JSON.parse(res.data); } catch (e) { b = null; }
        if (res.statusCode >= 200 && res.statusCode < 300 && b && b.fileID) return resolve(b);
        if (b && b.code) return reject({ code: b.code, message: b.message || '', retryable: !!b.retryable });
        reject({ code: 'INTERNAL', message: '图片上传失败', retryable: true });
      },
      fail() { reject({ code: 'INTERNAL', message: '图片上传失败', retryable: true }); },
    });
  }));
}

function uploadImage(filePath) {
  return uploadImageWithKind(filePath, 'stamps');
}

function reportRemindAuth(opts) {
  const o = opts || {};
  return request('/remind', { enabled: !!o.enabled, time: o.time || '21:00' });
}

function track(event, props) {
  // 埋点允许静默失败
  request('/track', { event, props: props || {} }).catch(() => {});
}

module.exports = {
  auth, listSets, getSet, draw, saveStamp, unlock,
  getComments, addComment, toggleLike, markWeekly, getAuthor, toggleFollow, getFeed,
  subscribeSet, getPosterQR,
  getMyCraft, submitCraft, getIncome, withdraw,
  uploadImage, reportRemindAuth, track,
};
