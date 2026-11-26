/* tools/test/three-state.test.js — mock 下的 loading / empty / error / retry */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules, makePage } = require('./harness');

function fresh() {
  installWx();
  resetModules();
  const mock = require('../../services/mock/index.js');
  const core = require('../../lib/core.js');
  const shared = require('../../lib/shared.js');
  return { mock, core, shared };
}

test('boot 失败 → bootError；故障恢复后可重试', async () => {
  const { mock, core } = fresh();
  mock._debug.setFailureRate(1);
  await assert.rejects(() => core.ensureBoot(), (e) => e && e.retryable === true);
  assert.equal(core.getS().booted, false);

  mock._debug.setFailureRate(0);
  await core.ensureBoot();
  assert.equal(core.getS().booted, true);
});

test('订阅 / 收益 / 作者：失败写 bootError，恢复后清除', async () => {
  const { mock, core } = fresh();
  await core.ensureBoot();
  const S = core.getS();
  S.author = S.me.name;

  const cards = makePage('cards', S);
  mock._debug.setFailureRate(1);
  await cards.renderSubs();
  assert.equal(cards.data.bootError, true);
  mock._debug.setFailureRate(0);
  await cards.renderSubs();
  assert.equal(cards.data.bootError, false);
  assert.ok(cards.data.subs && Array.isArray(cards.data.subs.today));

  const income = makePage('income', S);
  mock._debug.setFailureRate(1);
  await income.renderIncome();
  assert.equal(income.data.bootError, true);
  mock._debug.setFailureRate(0);
  await income.renderIncome();
  assert.equal(income.data.bootError, false);
  assert.ok(income.data.income);

  const author = makePage('author', S);
  mock._debug.setFailureRate(1);
  await author.renderAuthor();
  assert.equal(author.data.bootError, true);
  mock._debug.setFailureRate(0);
  await author.renderAuthor();
  assert.equal(author.data.bootError, false);
  assert.ok(author.data.author && author.data.author.exists);
});

test('详情加载失败不标记已加载，恢复后可重试', async () => {
  const { mock, core } = fresh();
  await core.ensureBoot();
  const S = core.getS();
  const id = S.sets[0].id;
  mock._debug.setFailureRate(1);
  await assert.rejects(() => core.ensureSetDetail(id), (e) => e && e.retryable === true);
  assert.notEqual(S.detailLoaded[id], true);

  mock._debug.setFailureRate(0);
  await core.ensureSetDetail(id);
  assert.equal(S.detailLoaded[id], true);
  assert.ok(S.sets.find((s) => s.id === id).pool.length > 0);
});

test('空数据：home / categories / search 不抛错', async () => {
  const { core } = fresh();
  await core.ensureBoot();
  const S = core.getS();
  S.sets = [];

  const home = makePage('home', S);
  assert.doesNotThrow(() => home.renderHome());
  assert.equal((home.data.home.rows || []).length, 0);

  const categories = makePage('categories', S);
  assert.doesNotThrow(() => categories.renderCategories());
  assert.ok((categories.data.categories.items || []).every((x) => x.count === 0));

  const search = makePage('search', S);
  search._searchQ = '不存在的词';
  assert.doesNotThrow(() => search.renderSearch());
  assert.equal((search.data.search.rows || []).length, 0);
});
