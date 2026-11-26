#!/usr/bin/env node
/* tools/audit-size.js — 小程序包体 / 资源 / setData 静态审计
 * 运行：node tools/audit-size.js > docs/performance-audit.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
const ignore = ((cfg.packOptions && cfg.packOptions.ignore) || []);
const SKIP = new Set(['.git', 'node_modules', 'dist', 'miniprogram_npm']);

function ignored(rel) {
  return ignore.some((x) => {
    const v = String(x.value || '');
    if (!v) return false;
    return x.type === 'folder' ? (rel === v || rel.startsWith(v + '/')) : rel === v;
  });
}

function walk(dir, rel, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const r = rel ? rel + '/' + ent.name : ent.name;
    if (ignored(r)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, r, out);
    else out.push({ rel: r, full, size: fs.statSync(full).size });
  }
}

const files = [];
walk(ROOT, '', files);
const total = files.reduce((a, f) => a + f.size, 0);
const byExt = {};
const byDir = {};
for (const f of files) {
  const ext = path.extname(f.rel) || '(none)';
  byExt[ext] = (byExt[ext] || 0) + f.size;
  const top = f.rel.split('/')[0];
  byDir[top] = (byDir[top] || 0) + f.size;
}
const setData = {};
for (const f of files) {
  if (!f.rel.endsWith('.js')) continue;
  const s = fs.readFileSync(f.full, 'utf8');
  const n = (s.match(/\bsetData\s*\(/g) || []).length;
  if (n) setData[f.rel] = n;
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const pct = (n) => ((n / total) * 100).toFixed(1) + '%';
const top = files.slice().sort((a, b) => b.size - a.size).slice(0, 20);
const assets = files.filter((f) => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f.rel))
  .sort((a, b) => b.size - a.size).slice(0, 15);
const bigJs = files.filter((f) => f.rel.endsWith('.js')).sort((a, b) => b.size - a.size).slice(0, 12);
const bigCss = files.filter((f) => f.rel.endsWith('.wxss')).sort((a, b) => b.size - a.size).slice(0, 12);

console.log('# 性能 / 包体静态审计');
console.log('');
console.log(`生成时间：${new Date().toISOString()}`);
console.log('');
console.log('## 包体概况');
console.log('');
console.log(`- 计入包体文件：**${files.length}** 个 / **${kb(total)}**`);
console.log('- 已通过 `project.config.json → packOptions.ignore` 排除 tools/docs/.github/server 等非运行文件。');
console.log('');
console.log('| 目录 | 大小 | 占比 |');
console.log('|---|---:|---:|');
Object.keys(byDir).sort((a, b) => byDir[b] - byDir[a]).slice(0, 15)
  .forEach((d) => console.log(`| ${d} | ${kb(byDir[d])} | ${pct(byDir[d])} |`));
console.log('');
console.log('## 文件类型');
console.log('');
console.log('| 类型 | 大小 | 占比 |');
console.log('|---|---:|---:|');
Object.keys(byExt).sort((a, b) => byExt[b] - byExt[a]).slice(0, 15)
  .forEach((e) => console.log(`| ${e} | ${kb(byExt[e])} | ${pct(byExt[e])} |`));
console.log('');
console.log('## 最大文件');
console.log('');
console.log('| 文件 | 大小 |');
console.log('|---|---:|');
top.forEach((f) => console.log(`| ${f.rel} | ${kb(f.size)} |`));
console.log('');
console.log('## 图片资源');
console.log('');
console.log('| 文件 | 大小 |');
console.log('|---|---:|');
assets.forEach((f) => console.log(`| ${f.rel} | ${kb(f.size)} |`));
console.log('');
console.log('## 最大 JS / WXSS');
console.log('');
console.log('| JS | 大小 |');
console.log('|---|---:|');
bigJs.forEach((f) => console.log(`| ${f.rel} | ${kb(f.size)} |`));
console.log('');
console.log('| WXSS | 大小 |');
console.log('|---|---:|');
bigCss.forEach((f) => console.log(`| ${f.rel} | ${kb(f.size)} |`));
console.log('');
console.log('## setData 调用密度');
console.log('');
console.log('| 文件 | 次数 |');
console.log('|---|---:|');
Object.keys(setData).sort((a, b) => setData[b] - setData[a]).slice(0, 15)
  .forEach((f) => console.log(`| ${f} | ${setData[f]} |`));
console.log('');
console.log('## 结论');
console.log('');
console.log('- 包体主体是 `assets/`、页面与 lib；`tools/docs/.github/server` 已不进入小程序包。');
console.log('- 列表摘要 + 详情 hydrate 已减少列表数据量；feed/author/craft 已摘要化。');
console.log('- 样式已分层/下沉，legacy CSS 仍有约 1010 行，需真机回归后继续归档。');
console.log('- `setData` 次数仅作静态参考；真正的性能需开发者工具 Performance 面板验证。');
