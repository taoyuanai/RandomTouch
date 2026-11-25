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

test('app.json 页面与 tabBar 配置可解析', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  assert.ok(Array.isArray(app.pages) && app.pages.length >= 4);
  assert.ok(app.tabBar && app.tabBar.custom === true);
  assert.ok(app.pages.includes('pages/home/index'));
});
