/* tools/export-icons.js
 * 校验 tabBar 图标；缺失时从单文件预览的 window.__ASSETS__ 兜底导出。
 * 运行：node tools/export-icons.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ICON_DIR = path.join(ROOT, 'assets/icons');
const REQUIRED = [
  'tab-home.png', 'tab-home-on.png',
  'tab-cards.png', 'tab-cards-on.png',
  'tab-create.png', 'tab-create-on.png',
  'tab-me.png', 'tab-me-on.png',
];

function check() {
  const bad = [];
  REQUIRED.forEach(f => {
    const p = path.join(ICON_DIR, f);
    if (!fs.existsSync(p)) { bad.push(f + '（缺失）'); return; }
    const size = fs.statSync(p).size;
    if (size > 40 * 1024) bad.push(f + '（' + size + 'B > 40KB）');
  });
  return bad;
}

const bad = check();
if (!bad.length) {
  console.log('✓ tabBar 图标齐全且均 < 40KB：' + REQUIRED.join(', '));
  process.exit(0);
}

const preview = path.join(ROOT, 'preview/今日做点小事-预览.html');
if (!fs.existsSync(preview)) {
  console.error('✗ 图标有问题且找不到预览 html 兜底：', bad.join('; '));
  process.exit(1);
}
const html = fs.readFileSync(preview, 'utf8');
const m = html.match(/window\.__ASSETS__\s*=\s*(\{[\s\S]*?\});/);
if (!m) {
  console.error('✗ 预览 html 中没有 window.__ASSETS__：', bad.join('; '));
  process.exit(1);
}
const assets = JSON.parse(m[1]);
let wrote = 0;
Object.entries(assets).forEach(([p, uri]) => {
  const rel = p.replace(/^\//, '');
  if (!/^assets\/icons\/.*\.(png|jpe?g|svg)$/i.test(rel)) return;
  if (fs.existsSync(path.join(ROOT, rel))) return;
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), Buffer.from(String(uri).split(',')[1] || '', 'base64'));
  wrote++;
  console.log('✓ 导出', rel);
});
console.log(wrote ? '✓ 兜底导出完成，共 ' + wrote + ' 个图标' : '✗ 未找到可导出的图标');
