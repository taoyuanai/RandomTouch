/* tools/test/poster.test.js — 周记预览/导出共用数据 + 路径不重建 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules, boot, makePage, wait } = require('./harness');

installWx({
  showActionSheet: ({ success }) => success && success({ tapIndex: 0 }),
});

resetModules();

let core;
let S;
let p;
let target;
let exportCount = 0;

before(async () => {
  const b = await boot();
  core = b.core;
  S = b.S;
  p = makePage('cards', S);
  await p.renderSubs();

  // 原 id1 已下架；用调试后门准备一个 7 天记录完整的收藏集，保持周记测试独立
  const mock = require('../../services/mock/index.js');
  mock._debug.completeSet(17);
  target = S.sets.find((s) => s.id === 17) || S.sets.find((s) => s.user && s.type === 'collect');
  assert.ok(target, '应有一个可生成周记的收藏集');
  await core.ensureSetDetail(target.id);

  const pk = require('../../utils/posterKit/export.js');
  pk.exportWeekly34 = async (data) => {
    assert.ok(data && data.cards && data.cards.length === 7, '周记导出数据应为 7 张');
    exportCount++;
    return '/tmp/weekly.png';
  };
  pk.exportWeekly916 = async (data) => {
    assert.ok(data && data.cards && data.cards.length === 7);
    exportCount++;
    return '/tmp/weekly916.png';
  };
  pk.saveToAlbum = async () => {};
});

test('weeklyState 只有一个数据源，预览字段齐全', () => {
  const w = p.weeklyState(target, 'qr.png');
  assert.equal(w.ready, true);
  assert.equal(w.title, w.data.titleText);
  assert.equal(w.cards.length, 7);
  assert.equal(w.stamps.length, 7);
  assert.equal(w.data.cards.length, 7);
  assert.equal(w.data.stamps.length, 7);
  assert.ok(w.data.kicker);
  assert.ok(w.data.wordLine);
  assert.equal(typeof w.data.qrSrc, 'string');
});

test('openWeekly 预览与 S.posterExport 是同一份数据', async () => {
  await p.openWeekly({ currentTarget: { dataset: { id: target.id } } });
  assert.equal(p.data.poster.show, true);
  assert.equal(p.data.poster.kind, 'weekly');
  assert.equal(p.data.poster.title, S.posterExport.titleText);
  assert.equal(S.posterExport.setId, target.id);
  assert.equal(S.posterExport.cards.length, 7);
});

test('savePoster 周记复用预览数据，不重建', async () => {
  const beforeExports = exportCount;
  await p.savePoster();
  await wait(40);
  assert.equal(exportCount, beforeExports + 1);
  assert.equal(p.data.poster.show, false);
});

test('openWeeklyPoster 快捷导出复用同一 builder', async () => {
  const beforeExports = exportCount;
  await p.openWeeklyPoster({ currentTarget: { dataset: { id: target.id } } });
  await wait(40);
  assert.equal(exportCount, beforeExports + 1);
});

test('无二维码导出不抛错', async () => {
  const w = p.weeklyState(target, '');
  assert.equal(w.ready, true);
  await p.exportWeeklyById(target.id, '34', w.data);
  await wait(40);
  assert.ok(exportCount >= 1);
});
