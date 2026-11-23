/* services/mock/index.js — 影子后端 v1
 * 幂等 / 北京时间跨天 / 失败注入 / 本地持久化 全部仿真。
 * 页面禁止直接引用本文件（铁律 1）。
 */
const store = require('./store.js');
const { bkDate, dateKeyOf, todayKey, weekMondayKey, keyPlus, todayShort, todayMD, todayDot, stampDate } = require('../util/bktime.js');

/* ── 失败注入 ── */
let failureRate = 0;
function gate() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failureRate) {
        reject({ code: 'INTERNAL', message: '网络开小差了，稍后再试', retryable: true });
      } else resolve();
    }, 150 + Math.random() * 450);
  });
}

/* ── 内部工具 ── */
function findSet(setId) {
  const s = store.state.sets.find(x => x.id === Number(setId));
  if (!s) throw { code: 'SET_NOT_FOUND', message: '卡集不存在', retryable: false };
  store.rollover(s);
  return s;
}
function getRec(u, idx) {
  if (!u || !u.recs || !(idx in u.recs)) return null;
  const r = u.recs[idx];
  return Array.isArray(r) ? r[r.length - 1] : r;
}
function cardDone(c) { return !!(c && (c.w || '').trim() && (c.b || '').trim()); }

function progressOf(s) {
  const u = s.user;
  if (!u) return {
    drawn: 0, got: [], todayDrawn: false, trialToday: false, todayIdx: null,
    unlocked: s.price === 0 || s.creator === store.ME, trialUsed: 0,
    drawnLog: [], recs: {},
  };
  return {
    drawn: u.drawn || 0, got: u.got || [],
    todayDrawn: !!u.todayDrawn, trialToday: !!u.trialToday,
    todayIdx: u.todayIdx != null ? u.todayIdx : null,
    unlocked: !!u.unlocked, trialUsed: u.trialUsed || 0,
    drawnLog: u.drawnLog || [], recs: u.recs || {},
  };
}
function setPayload(s) {
  const soc = store.socialOf(s);
  return {
    id: s.id, title: s.title, covT: s.covT, covS: s.covS,
    cover: s.cover, coverImage: s.coverImage || '',
    cat: s.cat, type: s.type, price: s.price, trial: s.trial,
    count: s.count, pool: s.pool, intro: s.intro,
    creator: s.creator, heat: s.heat, date: s.date,
    signatureIdx: s.signatureIdx, signatureNote: s.signatureNote,
    disclaimer: s.disclaimer || '',
    own: s.creator === store.ME,
    subscribed: !!s.user,
    totalDrawn: s.totalDrawn || 0,
    earn: s.earn || 0,
    buyers: s.buyers || 0,
    likes: soc.likes,
    liked: !!soc.liked,
    fans: store.state.fans[s.creator] || 0,
    progress: progressOf(s),
  };
}

/* ── 契约实现 ── */

async function auth() {
  await gate();
  return { ok: true };
}

async function listSets(q = {}) {
  await gate();
  store.rolloverAll();
  let list = store.state.sets.slice();
  if (q.cat && q.cat !== 'all') list = list.filter(s => s.cat === q.cat);
  list.sort(q.sort === 'new'
    ? (a, b) => (b.date || '').localeCompare(a.date || '')
    : (a, b) => (b.heat || 0) - (a.heat || 0));
  return list.map(setPayload);
}

async function getSet(setId) {
  await gate();
  const s = findSet(setId);
  const soc = store.socialOf(s);
  return Object.assign(setPayload(s), {
    social: { liked: !!soc.liked, likes: soc.likes },
    commentCount: store.commentItems(s).length,
    fans: store.state.fans[s.creator] || 0,
  });
}

/* draw — 幂等 + 跨天 + 试抽 + 服务端随机 */
async function draw({ setId, requestId } = {}) {
  await gate();
  if (requestId && store.state.drawCache[requestId]) {
    return Object.assign({}, store.state.drawCache[requestId], { result: 'already' });
  }
  const s = findSet(setId);
  const isResident = s.type === 'resident';
  const count = s.count || s.pool.length;
  const isMine = s.creator === store.ME;

  if (!isResident && s.user && (s.user.got || []).length >= count) {
    return { result: 'completed', set: setPayload(s) };
  }

  const u = s.user || (s.user = {
    drawn: 0, trialUsed: 0, unlocked: s.price === 0 || isMine,
    todayDrawn: false, got: [], recs: {},
  });

  if (u.todayDrawn || u.trialToday) {
    return { result: 'already', idx: u.todayIdx, card: s.pool[u.todayIdx], set: setPayload(s) };
  }

  const paid = s.price > 0 && !isMine;
  const trial = paid && !u.unlocked;
  if (trial && (u.trialUsed || 0) >= s.trial) {
    throw { code: 'UNLOCK_REQUIRED', message: `试抽已用完 · 解锁全集 ¥${s.price}`, retryable: false };
  }

  let idx;
  if (_debug._rig && _debug._rig.setId === Number(setId)) {
    idx = _debug._rig.idx;          // 调试后门：指定下一张
    _debug._rig = null;
  } else if (isResident) {
    idx = Math.floor(Math.random() * s.pool.length);
  } else {
    const got = u.got || [];
    const left = s.pool.map((_, i) => i).filter(i => !got.includes(i));
    idx = left[Math.floor(Math.random() * left.length)];
  }

  const sigFirst = idx === s.signatureIdx && !(u.got || []).includes(idx);
  if (trial) { u.trialUsed = (u.trialUsed || 0) + 1; u.trialToday = true; }
  else { u.todayDrawn = true; }
  u.todayIdx = idx;
  u.lastDrawDate = todayKey();
  if (!u.got) u.got = [];
  if (!u.got.includes(idx)) u.got.push(idx);
  u.drawn = (u.drawn || 0) + 1;
  if (!isResident) {
    if (!u.drawnLog) u.drawnLog = [];
    u.drawnLog.push({ idx, ts: Date.now() });
  }
  if (isMine) s.totalDrawn = (s.totalDrawn || 0) + 1;
  const wpBefore = weekProgressLocal();
  store.pushActivity({ ts: Date.now(), sid: s.id, idx, trial: !!trial });
  const wpAfter = weekProgressLocal();

  const done = !isResident && (u.got || []).length >= count;
  const out = {
    result: 'drawn', idx, card: s.pool[idx],
    set: setPayload(s), done,
    sig: { firstReveal: sigFirst, isSig: idx === s.signatureIdx },
    weekGoal: {
      done: wpAfter.done, total: wpAfter.total,
      full: wpAfter.full,
      justFull: wpAfter.full && !wpBefore.full,
    },
  };
  if (requestId) {
    store.state.drawCache[requestId] = out;
    const keys = Object.keys(store.state.drawCache);
    if (keys.length > 50) delete store.state.drawCache[keys[0]]; // 防无限增长
  }
  store.persist();
  return out;
}

async function saveStamp({ setId, idx, note, imgFileID } = {}) {
  await gate();
  const s = findSet(setId);
  const u = s.user || (s.user = {
    drawn: 0, trialUsed: 0, unlocked: true, todayDrawn: true, got: [], recs: {}, todayIdx: idx,
  });
  if (!u.recs) u.recs = {};
  const resident = s.type === 'resident';
  const prev = resident ? null : getRec(u, idx);
  const rec = {
    img: imgFileID || '', imgFileID: imgFileID || '',
    note: (note || '').slice(0, 50),
    date: todayShort(), stampDate: '',
    dateText: todayDot(),
    dayText: '周' + '日一二三四五六'[bkDate().getUTCDay()],
    sec: { text: 'pass', media: imgFileID ? 'pass' : 'none' },
  };
  rec.stampDate = stampDate(rec.date);
  if (resident) {
    const arr = Array.isArray(u.recs[idx]) ? u.recs[idx] : (u.recs[idx] ? [u.recs[idx]] : []);
    arr.push(rec);
    u.recs[idx] = arr;
  } else {
    u.recs[idx] = rec;
  }
  store.persist();
  return { rec, updated: !!prev };
}

async function unlock({ setId } = {}) {
  await Promise.all([gate(), new Promise(r => setTimeout(r, 900))]); // 模拟支付 + 可失败
  const s = findSet(setId);
  if (!s.user) s.user = { drawn: 0, trialUsed: 0, unlocked: true, todayDrawn: false, got: [] };
  s.user.unlocked = true;
  store.persist();
  return { set: setPayload(s) };
}

async function subscribeSet({ setId } = {}) {
  await gate();
  const s = findSet(setId);
  if (!s.user) {
    s.user = {
      drawn: 0, got: [], todayDrawn: false, trialToday: false, todayIdx: null,
      unlocked: false, trialUsed: 0, drawnLog: [], recs: {},
    };
  }
  store.persist();
  return { set: setPayload(s) };
}

async function getPosterQR({ setId } = {}) {
  try {
    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') return { path: '' };
    const r = await wx.cloud.callFunction({ name: 'qrcode', data: { sid: Number(setId) || 0 } });
    const fileID = r && r.result && r.result.fileID;
    if (!fileID) return { path: '' };
    const d = await wx.cloud.downloadFile({ fileID });
    return { path: (d && d.tempFilePath) || '' };
  } catch (e) { return { path: '' }; }
}

async function getComments(setId) {
  await gate();
  return store.commentItems(findSet(setId));
}

async function addComment({ setId, text } = {}) {
  await gate();
  const s = findSet(setId);
  const c = {
    id: 'c' + Date.now(), name: store.ME, avatar: store.ME.slice(0, 1),
    text: (text || '').trim().slice(0, 200), time: '刚刚',
    creator: s.creator === store.ME, status: 'visible',
  };
  if (!store.state.comments[s.id]) store.state.comments[s.id] = [];
  store.state.comments[s.id].unshift(c);
  store.persist();
  return { comment: c, status: 'visible' };
}

async function toggleLike({ setId } = {}) {
  await gate();
  const s = findSet(setId);
  const soc = store.socialOf(s);
  soc.liked = !soc.liked;
  soc.likes = Math.max(0, (soc.likes || 0) + (soc.liked ? 1 : -1));
  store.persist();
  return { liked: soc.liked, likes: soc.likes };
}

async function markWeekly({ setId, weekNo } = {}) {
  await gate();
  store.state.weeklyMade[`${Number(setId)}:${Number(weekNo)}`] = true;
  store.persist();
  return { ok: true };
}

async function getAuthor({ name } = {}) {
  await gate();
  const works = store.state.sets.filter(s => s.creator === name);
  return {
    name: name || '',
    own: name === store.ME,
    fans: store.state.fans[name] || 0,
    followed: !!store.state.follow[name],
    works: works.map(setPayload),
  };
}

async function toggleFollow({ name } = {}) {
  await gate();
  store.state.follow[name] = !store.state.follow[name];
  store.state.fans[name] = Math.max(0, (store.state.fans[name] || 0) + (store.state.follow[name] ? 1 : -1));
  store.persist();
  return { followed: store.state.follow[name], fans: store.state.fans[name] };
}

/* getFeed — 订阅页聚合（生产为服务端逻辑） */
function ensureDrawnLog(s) {
  const u = s && s.user;
  if (!u || s.type !== 'collect' || !u.got || !u.got.length || u.drawnLog) return;
  const now = Date.now();
  u.drawnLog = u.got.map((idx, i) => ({ idx, ts: now - (u.got.length - 1 - i) * 86400000 }));
}
function weekProgressLocal() {
  const tk = todayKey(), mk = weekMondayKey();
  const days = new Set();
  store.state.activity.forEach(a => {
    if (!a || !a.ts) return;
    const k = dateKeyOf(a.ts);
    if (k >= mk && k <= tk) days.add(k);
  });
  const done = days.size;
  return { done, total: 7, left: Math.max(0, 7 - done), full: done >= 7 };
}
function daysAbsentLocal() {
  const acts = store.state.activity;
  if (!acts.length) return null;
  const last = acts.reduce((m, a) => Math.max(m, a.ts || 0), 0);
  if (!last) return null;
  const a = Date.parse(todayKey() + 'T00:00:00Z');
  const b = Date.parse(dateKeyOf(last) + 'T00:00:00Z');
  return Math.max(0, Math.round((a - b) / 86400000));
}
function weeklyAvailability(s) {
  if (!s || s.type !== 'collect' || !s.user) return null;
  ensureDrawnLog(s);
  const logs = s.user.drawnLog || [];
  if (logs.length < 7) return null;
  const weekNo = Math.ceil(logs.length / 7);
  return store.state.weeklyMade[`${s.id}:${weekNo}`] ? null : { weekNo };
}

async function getFeed() {
  await gate();
  store.rolloverAll();
  const ME = store.ME;
  const subs = store.state.sets.filter(s => s.user);
  const today = [], subscribed = [], doneRows = [];
  let waitingN = 0, cardsN = 0, emptied = 0;

  subs.forEach(s => {
    const u = s.user;
    const res = s.type === 'resident';
    const count = s.count || s.pool.length;
    const got = (u.got || []).length;
    cardsN += u.drawn || 0;
    const doneSet = !res && count > 0 && got >= count;
    if (doneSet) emptied++;
    const todayIdx = u.todayIdx != null ? u.todayIdx
      : (u.todayDrawn && (u.got || []).length ? u.got[u.got.length - 1] : null);
    const stamped = !!(todayIdx != null && getRec(u, todayIdx));
    const row = { setId: s.id, title: s.title, covT: s.covT, todayIdx, got, count, drawn: u.drawn || 0, resident: res, price: s.price };
    if (doneSet) doneRows.push(Object.assign(row, { status: 'done' }));
    else if (u.todayDrawn || u.trialToday) {
      if (!stamped) { waitingN++; subscribed.push(Object.assign(row, { status: 'waiting_reply' })); }
      else subscribed.push(Object.assign(row, { status: 'stamped' }));
    } else {
      const locked = s.price > 0 && s.creator !== ME && !u.unlocked && (u.trialUsed || 0) >= s.trial;
      today.push(Object.assign(row, { status: locked ? 'locked' : 'can_draw' }));
    }
  });

  const wp = weekProgressLocal();
  const mk = weekMondayKey(), tk = todayKey();
  const daySet = new Set();
  store.state.activity.forEach(a => {
    if (!a || !a.ts) return;
    const k = dateKeyOf(a.ts);
    if (k >= mk && k <= tk) daySet.add(k);
  });
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const k = keyPlus(mk, i);
    dots.push({ dateKey: k, drawn: daySet.has(k), isToday: k === tk, isPast: k < tk });
  }

  let greeting = null;
  const absent = daysAbsentLocal();
  if (absent != null && absent >= 3) {
    greeting = { days: absent, suggestSetId: today.length ? today[0].setId : null, canDrawN: today.length };
  }

  let weekly = null;
  for (const s of subs) {
    const w = weeklyAvailability(s);
    if (w) { weekly = { setId: s.id, weekNo: w.weekNo }; break; }
  }

  return {
    total: subs.length,
    today, subscribed, done: doneRows,
    stats: { canDraw: today.length, cards: cardsN, emptied, waiting: waitingN },
    weekGoal: store.state.activity.length
      ? { done: wp.done, total: 7, left: wp.left, full: wp.full, dots } : null,
    greeting, weekly,
  };
}

async function getMyCraft() {
  await gate();
  return {
    published: store.state.sets.filter(s => s.creator === store.ME).map(setPayload),
    reviewing: store.state.reviewing.map(d => ({
      id: d.id,
      title: d.title || '',
      intro: d.intro || '',
      type: d.type, cat: d.cat, price: d.price, trial: d.trial,
      coverImage: d.coverImage || '',
      signatureIdx: d.signatureIdx != null ? d.signatureIdx : -1,
      signatureNote: d.signatureNote || '',
      submitted: d.submitted || '',
      pool: d.pool || [],
    })),
  };
}

async function submitCraft({ draft } = {}) {
  await gate();
  if (_debug._rejectSubmit) {
    _debug._rejectSubmit = false;
    throw { code: 'SEC_REJECTED', message: '内容暂时无法公开展示', retryable: false };
  }
  const d = JSON.parse(JSON.stringify(draft));
  d.status = 'reviewing';
  d.submitted = todayMD();
  store.state.reviewing.push(d);
  store.persist();
  return { status: 'submitted' };
}

async function getIncome() {
  await gate();
  const st = store.state;
  const mine = st.sets.filter(s => s.creator === store.ME);
  const total = mine.reduce((a, s) => a + (s.earn || 0), 0) + st.platformIncome;
  const avail = Math.max(0, total - st.income.withdrawn - st.income.pending);
  return {
    total, avail, pending: st.income.pending, withdrawn: st.income.withdrawn,
    threshold: st.income.threshold,
    bySet: mine.filter(s => s.price > 0 && (s.earn || 0) > 0)
      .map(s => ({ id: s.id, title: s.title, buyers: s.buyers || 0, price: s.price, earn: s.earn || 0 })),
    platform: st.platformIncome, txns: st.txnSeed,
  };
}

async function withdraw() {
  await gate();
  const st = store.state;
  const mine = st.sets.filter(s => s.creator === store.ME);
  const total = mine.reduce((a, s) => a + (s.earn || 0), 0) + st.platformIncome;
  const avail = Math.max(0, total - st.income.withdrawn - st.income.pending);
  if (avail < st.income.threshold) {
    throw { code: 'INTERNAL', message: '未达提现门槛', retryable: true };
  }
  st.income.pending += avail;
  store.persist();
  return getIncome();
}

async function uploadImage(filePath) {
  await gate();
  return { fileID: filePath }; // mock：原路径即 fileID
}

async function reportRemindAuth({ enabled, time } = {}) {
  store.state.remind = { enabled: !!enabled, time: time || '21:00' };
  store.persist();
  return { ok: true };
}

async function track(event, props = {}) {
  store.state.events.push({ event, props, ts: Date.now() });
  store.persist();
}

/* ── 调试后门（仅开发者工具控制台；上线构建剥离） ── */
const _debug = {
  setFailureRate(r) { failureRate = Math.min(1, Math.max(0, r)); return failureRate; },
  reset() { store.reset(); return 'ok'; },
  travel(days) {
    const ms = days * 86400000;
    const tk = todayKey();
    store.state.sets.forEach(s => {
      const u = s.user;
      if (!u) return;
      // 跨天模拟：清今日态，并把 lastDrawDate 回拨，rollover 才会认为这是新的一天
      u.todayDrawn = false;
      u.trialToday = false;
      u.todayIdx = null;
      u.lastDrawDate = keyPlus(u.lastDrawDate || tk, -days);
      if (u.drawnLog) u.drawnLog.forEach(e => { e.ts -= ms; });
    });
    store.state.activity.forEach(a => { a.ts -= ms; });
    store.persist();
    return `时间已回拨 ${days} 天`;
  },
  markWeeklyMade(setId, weekNo) {
    store.state.weeklyMade[`${setId}:${weekNo}`] = true;
    store.persist();
  },
  rejectNextSubmit() { _debug._rejectSubmit = true; return '下一次 submitCraft 返回 SEC_REJECTED'; },
  arrive() { // 演示：pending → withdrawn（真实环境由支付回调驱动）
    store.state.income.withdrawn += store.state.income.pending;
    store.state.income.pending = 0;
    store.persist();
    return 'ok';
  },
  rig(setId, idx) {
    _debug._rig = { setId: Number(setId), idx: Number(idx) };
    return `下一次抽卡固定为 idx=${idx}`;
  },
  completeSet(setId, leave = 0) {
    const s = store.state.sets.find(x => x.id === Number(setId));
    if (!s) return 'not found';
    if (!s.user) s.user = { drawn: 0, got: [], recs: {} };
    const n = Math.max(0, s.pool.length - Number(leave || 0));
    s.user.got = s.pool.map((_, i) => i).slice(0, n);
    s.user.drawn = n;
    const now = Date.now();
    s.user.drawnLog = s.user.got.map((idx, i) => ({ idx, ts: now - (s.user.got.length - 1 - i) * 86400000 }));
    s.user.recs = n >= 7 ? {
      0: { img: '', note: '下班路上真的抬头看了，积云像棉花糖。', date: '11月8日' },
      3: { img: '', note: '雨云压得很低，带了伞，没用上。', date: '11月11日' },
      6: { img: '', note: '查了珠母云的图，想亲眼看一次。', date: '11月12日' },
    } : {};
    store.persist();
    return `ok (${n}/${s.pool.length})`;
  },
};

module.exports = {
  auth, listSets, getSet, draw, saveStamp, unlock,
  getComments, addComment, toggleLike, markWeekly, getAuthor, toggleFollow, getFeed,
  subscribeSet, getPosterQR,
  getMyCraft, submitCraft, getIncome, withdraw,
  uploadImage, reportRemindAuth, track,
  _debug,
};
