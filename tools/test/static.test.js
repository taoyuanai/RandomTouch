/* tools/test/static.test.js — 无依赖静态检查：JS/WXML/WXSS/页面边界 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseWXML } = require('../lib/wxml');

const ROOT = path.resolve(__dirname, '../..');
const SKIP_DIRS = new Set([
  'node_modules', 'miniprogram_npm', 'dist', 'downloads', 'preview',
  'vendor', '.git', 'coverage', 'logs',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(ROOT);
const jsFiles = allFiles.filter((f) => f.endsWith('.js'));
const wxmlFiles = allFiles.filter((f) => f.endsWith('.wxml'));
const wxssFiles = allFiles.filter((f) => f.endsWith('.wxss'));

test('全部 JS 语法可解析', () => {
  for (const f of jsFiles) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      const out = (e.stderr && e.stderr.toString()) || e.message;
      assert.fail(`JS 语法失败：${path.relative(ROOT, f)}\n${out}`);
    }
  }
});

test('全部 WXML 可解析', () => {
  assert.ok(wxmlFiles.length > 0);
  for (const f of wxmlFiles) {
    try {
      parseWXML(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      assert.fail(`WXML 解析失败：${path.relative(ROOT, f)}\n${e.message}`);
    }
  }
});

test('全部 WXSS 括号平衡', () => {
  assert.ok(wxssFiles.length > 0);
  for (const f of wxssFiles) {
    const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal((s.match(/{/g) || []).length, (s.match(/}/g) || []).length,
      `WXSS 括号不平衡：${path.relative(ROOT, f)}`);
  }
});

test('WXSS 注释成对闭合，无孤立 */', () => {
  for (const f of wxssFiles) {
    const s = fs.readFileSync(f, 'utf8');
    let i = 0;
    let inComment = false;
    let line = 1;
    while (i < s.length) {
      if (!inComment && s.startsWith('/*', i)) { inComment = true; i += 2; continue; }
      if (inComment && s.startsWith('*/', i)) { inComment = false; i += 2; continue; }
      if (!inComment && s.startsWith('*/', i)) {
        assert.fail(`${path.relative(ROOT, f)}:${line} 出现孤立 */`);
      }
      if (s[i] === '\n') line++;
      i++;
    }
    assert.equal(inComment, false, `${path.relative(ROOT, f)} 注释未闭合`);
  }
});

test('页面 JS 不直连 mock / wx.request / 云函数', () => {
  const pages = allFiles.filter((f) => f.includes(`${path.sep}pages${path.sep}`) && f.endsWith('.js'));
  assert.ok(pages.length > 0);
  const forbidden = [
    'services/mock', 'mock/seed', 'mock/store',
    'wx.request', 'wx.cloud.callFunction',
  ];
  for (const f of pages) {
    const s = fs.readFileSync(f, 'utf8');
    for (const token of forbidden) {
      assert.equal(s.includes(token), false,
        `${path.relative(ROOT, f)} 出现禁止依赖：${token}`);
    }
  }
});

test('set-row 自定义组件已接线', () => {
  const pages = ['home', 'search', 'author', 'create', 'cards'];
  for (const name of pages) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'pages', name, 'index.json'), 'utf8'));
    assert.equal(json.usingComponents && json.usingComponents['set-row'], '/components/set-row/set-row');
    const wxml = fs.readFileSync(path.join(ROOT, 'pages', name, 'index.wxml'), 'utf8');
    assert.ok(wxml.includes('<set-row'));
    assert.ok(wxml.includes('bind:rowtap='));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'components/set-row/set-row.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'components/set-row/set-row.wxml')));
});

test('v6-topbar 自定义组件已接线', () => {
  const pages = ['author', 'categories', 'income', 'edit', 'map', 'set'];
  for (const name of pages) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'pages', name, 'index.json'), 'utf8'));
    assert.equal(json.usingComponents && json.usingComponents['v6-topbar'], '/components/v6-topbar/v6-topbar');
    const wxml = fs.readFileSync(path.join(ROOT, 'pages', name, 'index.wxml'), 'utf8');
    assert.ok(wxml.includes('<v6-topbar'));
    assert.ok(wxml.includes('bind:back='));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'components/v6-topbar/v6-topbar.js')));
});

test('盖戳页：照片与文字合并进卡内，无外部重复表单', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'templates/m-flow.wxml'), 'utf8');
  assert.equal(wxml.includes('v6-stamp-sub'), false);
  assert.equal(wxml.includes('v6-photo-tools'), false);
  assert.equal(wxml.includes('v6-note-field'), false);
  assert.ok(wxml.includes('v6-stamp-note-input'));
  assert.ok(wxml.includes('v6-stamp-photo-btn'));
});

test('抽卡页保留轻量 reveal 动效节点', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/draw/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(ROOT, 'pages/draw/index.wxss'), 'utf8');
  assert.ok(wxml.includes('draw.revealFx'));
  assert.ok(wxml.includes('dk-fx-{{draw.revealFx}}'));
  assert.ok(wxss.includes('.dk-fx-spark'));
  assert.ok(wxss.includes('.dk-fx-rainbow'));
});

test('抽卡首屏保持极简：无独立抽卡按钮、无卡背文字', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/draw/index.wxml'), 'utf8');
  assert.equal(wxml.includes('dk-act-idle'), false);
  assert.equal(wxml.includes('dk-act-flip'), false);
  assert.equal(wxml.includes('v6-cardback-title'), false);
  assert.equal(wxml.includes('v6-cardback-copy'), false);
  assert.equal(wxml.includes('v6-draw-helper'), false);
  assert.ok(wxml.includes('bindtap="tapCard"'));
});

test('app.json 页面与 tabBar 配置可解析', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  assert.ok(Array.isArray(app.pages) && app.pages.length >= 4);
  assert.ok(app.tabBar && app.tabBar.custom === true);
  assert.ok(app.pages.includes('pages/home/index'));
});
