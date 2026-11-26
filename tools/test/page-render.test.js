/* tools/test/page-render.test.js — 摘要启动 + 全部页面渲染烟测 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules, boot, makePage } = require('./harness');

installWx();
resetModules();

let core;
let S;

before(async () => {
  const b = await boot();
  core = b.core;
  S = b.S;
  S.cur = S.sets[0].id;
});

test('boot 后列表只有摘要，详情按需 hydrate', async () => {
  assert.ok(S.booted);
  assert.ok(S.sets.length > 0);
  assert.equal(Array.isArray(S.sets[0].pool), true);
  assert.equal(S.sets[0].pool.length, 0);
  assert.ok(S.sets[0].poolText);
  assert.equal(!!S.detailLoaded[S.cur], false);

  const s = await core.ensureSetDetail(S.cur);
  assert.ok(Array.isArray(s.pool) && s.pool.length > 0);
  assert.equal(S.detailLoaded[S.cur], true);
});

test('home', () => {
  const p = makePage('home', S);
  p.renderHome();
  assert.ok(p.data.home);
});

test('cards / feed', async () => {
  const p = makePage('cards', S);
  await p.renderSubs();
  assert.ok(p.data.subs);
  assert.ok(Array.isArray(p.data.subs.today));
  assert.ok(Array.isArray(p.data.subs.subscribed));
  assert.ok(Array.isArray(p.data.subs.done));
});

test('set', async () => {
  await core.ensureSetDetail(S.cur);
  const p = makePage('set', S);
  p.renderSetPage();
  assert.ok(p.data.setPage && p.data.setPage.exists !== false);
  assert.ok(Array.isArray(p.data.setPage.cells));
});

test('draw', async () => {
  await core.ensureSetDetail(S.cur);
  const p = makePage('draw', S);
  p.renderDraw();
  assert.ok(p.data.draw);
  if (p.data.draw.stage === 'draw' && !p.data.draw.sealed) {
    assert.equal(p.data.draw.intro, '深呼吸，点开今天这张卡');
  }
});

test('map', async () => {
  await core.ensureSetDetail(S.cur);
  const p = makePage('map', S);
  p.renderMap();
  assert.ok(p.data.mapV && Array.isArray(p.data.mapV.cells));
  assert.ok(p.data.mapV.cells.length > 0);
});

test('全图摘要态先 hydrate，不会渲染空白格', async () => {
  const p = makePage('map', S);
  const s = S.sets.find(x => x.id === S.cur);
  const savedPool = s.pool;
  const savedLoaded = S.detailLoaded[s.id];
  s.pool = [];
  delete S.detailLoaded[s.id];
  p.renderMap();
  const { waitFor } = require('./harness');
  const ok = await waitFor(() => p.data.mapV && p.data.mapV.cells && p.data.mapV.cells.length);
  assert.ok(ok, '应等待详情后渲染格子');
  assert.ok(p.data.mapV.cells.some((c) => c.full));
  s.pool = savedPool;
  if (savedLoaded) S.detailLoaded[s.id] = true;
});

test('create / craft', async () => {
  const p = makePage('create', S);
  await p.refreshCraft();
  p.renderCraft();
  assert.ok(p.data.craft);
});

test('me', () => {
  const p = makePage('me', S);
  p.renderMe();
  assert.ok(p.data.me);
});

test('income', async () => {
  const p = makePage('income', S);
  await p.renderIncome();
  assert.ok(p.data.income);
});

test('categories', () => {
  const p = makePage('categories', S);
  p.renderCategories();
  assert.ok(p.data.categories && Array.isArray(p.data.categories.items));
  assert.equal(p.data.categories.items.length, 9);
});

test('search 使用 poolText', () => {
  const p = makePage('search', S);
  const word = (S.sets[0].poolText || '').split(' ').find(Boolean) || '';
  p._searchQ = word;
  p.renderSearch();
  assert.ok(p.data.search);
  assert.ok(Array.isArray(p.data.search.rows));
  assert.ok(p.data.search.rows.length > 0);
});

test('抽卡页点卡可来回翻面，且不弹大卡', () => {
  const p = makePage('draw', S);
  p.setData({ draw: { stage: 'after', flipped: false, sealed: false, stateCls: 'is-drawn' } });
  p.tapCard();
  assert.equal(p.data.draw.flipped, true);
  assert.equal(p.data.draw.stateCls, 'is-flipped');
  p.tapCard();
  assert.equal(p.data.draw.flipped, false);
  assert.equal(p.data.draw.stateCls, 'is-drawn');
  assert.equal(p.data.bigCard.show, false);
});

test('author', async () => {
  S.author = S.me.name;
  const p = makePage('author', S);
  await p.renderAuthor();
  assert.ok(p.data.author && p.data.author.exists);
  assert.ok(Array.isArray(p.data.author.works));
});

test('edit', () => {
  S.rv = null;
  S.ed = {
    id: 9, title: '测试', intro: '测试测试测试测试',
    type: 'collect', cat: 'life', price: 0, trial: 0,
    coverImage: '', signatureIdx: -1, signatureNote: '',
    pool: new Array(8).fill({ w: 'a', b: 'b' }),
  };
  const p = makePage('edit', S);
  p.renderEdit();
  assert.ok(p.data.edit);
});

test('done 页可由摘要字段渲染', async () => {
  const p = makePage('cards', S);
  await p.renderSubs();
  p.openDone(S.cur);
  assert.ok(p.data.donePage && p.data.donePage.title);
});

test('stats 卡片动作会 hydrate 详情', async () => {
  const p = makePage('cards', S);
  await p.renderSubs();
  await p.tapStat({ currentTarget: { dataset: { kind: 'cards' } } });
  assert.ok(p.data.statsSheet);
  assert.ok(Array.isArray(p.data.statsSheet.cards));
});

test('大卡 / 盖戳动作会 hydrate 详情', async () => {
  const withGot = S.sets.find((s) => s.user && (s.user.got || []).length);
  assert.ok(withGot, 'seed 中应有已抽过的集');
  withGot.pool = [];
  delete S.detailLoaded[withGot.id];
  const p = makePage('cards', S);
  p.showBigCard(withGot.id, withGot.user.got[0]);
  const { waitFor } = require('./harness');
  const ok = await waitFor(() => p.data.bigCard && p.data.bigCard.show);
  assert.ok(ok, '大卡应在 hydrate 后打开');
  assert.ok(withGot.pool.length > 0);
  p.openRecordAt(withGot.id, withGot.user.got[0], 'cards');
  const rec = await waitFor(() => p.data.record && p.data.record.show);
  assert.ok(rec, '盖戳页应在 hydrate 后打开');
  assert.ok(p.data.record.word);
});
