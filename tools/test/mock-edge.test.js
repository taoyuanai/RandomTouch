/* tools/test/mock-edge.test.js — mock 故障注入 / 幂等 / 跨天 / 边界 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { installWx } = require('./harness');

installWx();
const mock = require('../../services/mock/index.js');
const api = require('../../services/api.js');

async function pickFreeSet() {
  const list = await api.listSets();
  return list.find((s) => s.price === 0 && s.type === 'collect'
    && !(s.progress && s.progress.todayDrawn)
    && !(s.progress && s.progress.trialToday))
    || list.find((s) => s.price === 0 && s.type === 'collect');
}

beforeEach(() => {
  mock._debug.setFailureRate(0);
  mock._debug.reset();
});

test('故障注入：失败可复现，恢复后成功', async () => {
  mock._debug.setFailureRate(1);
  try {
    await assert.rejects(
      () => api.listSets(),
      (e) => e && e.code === 'INTERNAL' && e.retryable === true
    );
  } finally {
    mock._debug.setFailureRate(0);
  }
  const list = await api.listSets();
  assert.ok(Array.isArray(list) && list.length > 0);
});

test('未知卡集 / 未知分类边界', async () => {
  await assert.rejects(() => api.getSet(999999), (e) => e.code === 'SET_NOT_FOUND');
  const list = await api.listSets({ cat: '__nope__' });
  assert.deepEqual(list, []);
});

test('draw 幂等：同一 requestId 返回同一张', async () => {
  const s = await pickFreeSet();
  assert.ok(s, 'seed 中应有免费收藏集');
  const requestId = 'edge-same-' + Date.now();
  const first = await api.draw({ setId: s.id, requestId });
  const second = await api.draw({ setId: s.id, requestId });
  assert.equal(first.result, 'drawn');
  assert.equal(second.result, 'already');
  assert.equal(second.idx, first.idx);
});

test('同一天新 requestId 不重复抽', async () => {
  const s = await pickFreeSet();
  const first = await api.draw({ setId: s.id, requestId: 'edge-day-1-' + Date.now() });
  const second = await api.draw({ setId: s.id, requestId: 'edge-day-2-' + Date.now() });
  assert.equal(first.result, 'drawn');
  assert.equal(second.result, 'already');
  assert.equal(second.idx, first.idx);
});

test('travel 回拨一天后今日状态重置，可再抽', async () => {
  const s = await pickFreeSet();
  const first = await api.draw({ setId: s.id, requestId: 'edge-travel-1-' + Date.now() });
  assert.equal(first.result, 'drawn');
  mock._debug.travel(1);
  const detail = await api.getSet(s.id);
  assert.equal(detail.progress.todayDrawn, false);
  const second = await api.draw({ setId: s.id, requestId: 'edge-travel-2-' + Date.now() });
  assert.equal(second.result, 'drawn');
});

test('取消订阅保留进度，重新订阅可恢复', async () => {
  const s = await pickFreeSet();
  await api.draw({ setId: s.id, requestId: 'edge-sub-1-' + Date.now() });
  const before = await api.getSet(s.id);
  const gotN = before.progress.got.length;

  const off = await api.unsubscribeSet({ setId: s.id });
  assert.equal(off.set.subscribed, false);
  assert.equal(off.set.progress.got.length, gotN);

  const on = await api.subscribeSet({ setId: s.id });
  assert.equal(on.set.subscribed, true);
  assert.equal(on.set.progress.got.length, gotN);
});

test('空池不抛异常：draw 返回 completed', async () => {
  const list = await api.listSets();
  const s = list.find((x) => x.type === 'collect');
  const store = require('../../services/mock/store.js');
  const raw = store.state.sets.find((x) => x.id === s.id);
  raw.pool = [];
  raw.count = 0;
  raw.user = null;
  const r = await api.draw({ setId: s.id, requestId: 'edge-empty-' + Date.now() });
  assert.equal(r.result, 'completed');
});
