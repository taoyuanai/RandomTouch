/* tools/test/api-contract.test.js — mock API 摘要/详情契约 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { installWx } = require('./harness');

installWx();
const api = require('../../services/api.js');

test('listSets 是摘要：无 pool，有 poolText', async () => {
  const list = await api.listSets();
  assert.ok(Array.isArray(list) && list.length > 0);
  for (const s of list) {
    assert.equal(Array.isArray(s.pool), false, `set ${s.id} 不应下发 pool`);
    assert.equal(typeof s.poolText, 'string');
    assert.ok(s.count > 0);
    assert.ok(s.progress && Array.isArray(s.progress.got));
  }
});

test('getSet 是完整详情：有 pool', async () => {
  const [first] = await api.listSets();
  const detail = await api.getSet(first.id);
  assert.ok(Array.isArray(detail.pool) && detail.pool.length > 0);
  assert.equal(detail.pool.length, detail.count);
  assert.ok(detail.social);
});

test('getFeed 行不携带 pool', async () => {
  const feed = await api.getFeed();
  assert.ok(feed && Array.isArray(feed.today));
  const rows = [].concat(feed.today || [], feed.subscribed || [], feed.done || []);
  for (const r of rows) {
    assert.equal(Object.prototype.hasOwnProperty.call(r, 'pool'), false);
    assert.ok(r.setId && typeof r.count === 'number');
  }
});

test('getAuthor works 是摘要；点进详情再 hydrate', async () => {
  const a = await api.getAuthor({ name: '打工人小王' });
  assert.equal(a.own, true);
  assert.ok(a.works.length > 0);
  for (const w of a.works) {
    assert.equal(Array.isArray(w.pool), false);
    assert.equal(w.poolText, undefined);
  }
  const detail = await api.getSet(a.works[0].id);
  assert.ok(Array.isArray(detail.pool) && detail.pool.length > 0);
});

test('getMyCraft 已上架摘要；审核草稿保留完整 pool', async () => {
  const c = await api.getMyCraft();
  assert.ok(Array.isArray(c.published));
  for (const w of c.published) {
    assert.equal(Array.isArray(w.pool), false);
    assert.equal(w.poolText, undefined);
  }
  for (const d of c.reviewing) {
    assert.ok(Array.isArray(d.pool));
  }
});
