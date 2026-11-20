/* services/mock/store.js — 影子后端状态仓库（含本地持久化） */
const seed = require('./seed.js');
const { todayKey } = require('../util/bktime.js');

const STORE_KEY = 'dsm_mock_v1';
const SEED_VERSION = '2026-11-20-id18';
const ME = '打工人小王';

function freshState() {
  return {
    seedVersion: SEED_VERSION,
    sets: JSON.parse(JSON.stringify(seed.DEMO.sets)),
    reviewing: JSON.parse(JSON.stringify((seed.CRAFT && seed.CRAFT.reviewing) || [])),
    draftsLocal: JSON.parse(JSON.stringify((seed.CRAFT && seed.CRAFT.drafts) || [])),
    follow: {},
    fans: seed.FANS || {},
    income: { withdrawn: 0, pending: 0, threshold: 100 },
    platformIncome: seed.PLATFORM_INCOME || 0,
    txnSeed: seed.TXN_SEED || [],
    social: JSON.parse(JSON.stringify(seed.SOCIAL_SEED || {})),
    comments: JSON.parse(JSON.stringify(seed.COMMENTS_SEED || {})),
    activity: [],
    weeklyMade: {},
    remind: { enabled: false, time: '21:00', asked: 0 },
    events: [],
    drawCache: {},      // requestId → draw 结果（幂等，随 storage 持久化）
    seq: 1000,
  };
}

function load() {
  try {
    const raw = wx.getStorageSync(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.seedVersion === SEED_VERSION) return { state: saved, fresh: false };
      // 内容种子升级：旧 store 不再兼容，自动重建（C1/id18）
    }
  } catch (e) { /* 预览环境无 storage：走内存 */ }
  return { state: freshState(), fresh: true };
}

/* 首次初始化：为演示数据合成活动流水（周目标/召回的数据地基；
 * 生产环境由真实流水累积，无此函数） */
function seedActivity(st) {
  const now = Date.now();
  const DAY = 86400000;
  st.sets.forEach(s => {
    const u = s.user;
    if (!u || !(u.drawn > 0)) return;
    if (u.drawnLog && u.drawnLog.length) {
      u.drawnLog.forEach(e => { if (e && e.ts) st.activity.push({ ts: e.ts, sid: s.id, idx: e.idx }); });
      return;
    }
    const n = Math.min(u.drawn, 3);
    const endOffset = u.todayDrawn ? 0 : 1;
    for (let i = 0; i < n; i++) {
      st.activity.push({ ts: now - (n - 1 - i + endOffset) * DAY, sid: s.id, idx: (u.got || [])[i] || 0 });
    }
  });
}

const _boot = load();
const state = _boot.state;
if (!state.drawCache) state.drawCache = {};
if (!state.activity) state.activity = [];
if (_boot.fresh) { seedActivity(state); persist(); }

function persist() {
  try { wx.setStorageSync(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* 跨天重置：0 点后清「今日已抽/今日试抽」 */
function rollover(s) {
  const u = s && s.user;
  if (!u || !(u.todayDrawn || u.trialToday)) return;
  if (!u.lastDrawDate) { u.lastDrawDate = todayKey(); return; }
  if (u.lastDrawDate !== todayKey()) {
    u.todayDrawn = false;
    u.trialToday = false;
    u.todayIdx = null;
  }
}
function rolloverAll() { state.sets.forEach(rollover); }

function pushActivity(a) { state.activity.push(a); }

function socialOf(s) {
  if (!s) return { likes: 0, liked: false };
  let soc = state.social[s.id];
  if (!soc) {
    soc = { likes: s.creator === ME ? 0 : Math.max(6, Math.round((s.heat || 0) / 28)), liked: false };
    state.social[s.id] = soc;
  }
  return soc;
}

function commentItems(s) {
  const list = state.comments[s.id] || [];
  return list
    .filter(c => !c.status || c.status === 'visible')
    .map(c => Object.assign({}, c, { avatar: c.avatar || (c.name || '签').slice(0, 1) }));
}

function reset() {
  const fresh = freshState();
  Object.keys(fresh).forEach(k => { state[k] = fresh[k]; });
  seedActivity(state);
  persist();
}

module.exports = { state, ME, persist, rollover, rolloverAll, pushActivity, socialOf, commentItems, reset };
