#!/usr/bin/env node
'use strict';

/**
 * 把微信小程序（WXML / WXSS / JS / 图标）打包成一个可离线打开的单文件 HTML。
 *
 * 用法：
 *   node tools/build-html-preview.js
 *
 * 输出：
 *   preview/今日做点小事-预览.html
 *
 * 说明：
 * - WXML 在构建期解析成 AST，浏览器端用一个很小的运行时解释执行
 *   （wx:if / wx:elif / wx:else / wx:for / template / 事件绑定）。
 * - WXSS 只做必要的标签名映射（view→div、text→span、image→img、page→body），
 *   其余样式原样保留。
 * - 每次 setData 后用 morphdom 做最小 DOM 更新，因此 CSS 过渡/翻转动画可以正常工作。
 * - 图标全部转成 base64 内嵌；拍照选择图片时用浏览器 FileReader 转 dataURL 代替。
 */

const fs = require('fs');
const path = require('path');
const { parseWXML, collectTemplates, annotateLoops } = require('./lib/wxml');

const ROOT = path.resolve(__dirname, '..');
const pagesDir = path.join(ROOT, 'pages/home');
const outDir = path.join(ROOT, 'preview');
const outFile = path.join(outDir, '今日做点小事-预览.html');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/* ---------- 1. WXML ---------- */
const wxmlSrc = read(path.join(pagesDir, 'index.wxml'));
const ast = parseWXML(wxmlSrc);
const templates = collectTemplates(ast);
annotateLoops(ast);

/* ---------- 2. WXSS ---------- */
function convertWxss(css) {
  let out = css;

  // 标签名映射（只匹配选择器里的独立标签名）
  const tagMap = [
    ['image', 'img'],
    ['view', 'div'],
    ['text', 'span'],
    ['page', 'body'],
  ];
  for (const [from, to] of tagMap) {
    const re = new RegExp('(^|[}\\s,>+~;])' + from + '(?=[\\s,{.:#\\[>+~])', 'g');
    out = out.replace(re, '$1' + to);
  }

  return out;
}

const wxss = convertWxss(read(path.join(ROOT, 'app.wxss')) + '\n' + read(path.join(pagesDir, 'index.wxss')));
const previewCss = read(path.join(__dirname, 'lib/preview.css'));

/* ---------- 3. 图标内嵌 ---------- */
const assets = {};
const iconDir = path.join(ROOT, 'assets/icons');
for (const file of fs.readdirSync(iconDir)) {
  if (!/\.(png|jpe?g|gif|svg)$/i.test(file)) continue;
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : 'image/' + ext;
  const b64 = fs.readFileSync(path.join(iconDir, file)).toString('base64');
  assets['/assets/icons/' + file] = `data:${mime};base64,${b64}`;
}

/* ---------- 4. JS ---------- */
const seedSrc = read(path.join(ROOT, 'data.js'));
const seedBundle =
  '(function(){var module = { exports: {} };\n' +
  seedSrc +
  '\nwindow.__SEED = module.exports;\n})();';

let pageSrc = read(path.join(pagesDir, 'index.js'));
pageSrc = pageSrc.replace("const { createPage } = require('../../lib/shared.js');", 'const { createPage } = window.__SHARED__;');
pageSrc = pageSrc.replace("const core = require('../../lib/core.js');", 'const core = window.__CORE__;');
pageSrc = pageSrc.replace(
  "const posterKit = require('../../utils/posterKit/export.js');",
  'const posterKit = window.__POSTER_KIT__;'
);
pageSrc = pageSrc.replace(
  "const Security = require('../../utils/security.js');",
  'const Security = window.__SECURITY__;'
);
pageSrc = pageSrc.replace(
  "const api = require('../../services/api.js');",
  'const api = window.__SERVICES_API__;'
);
if (/require\s*\(/.test(pageSrc)) {
  throw new Error('index.js 仍包含 require()，无法在浏览器中直接运行');
}

const securityBundle =
  '(function(){var module = { exports: {} };\n' +
  read(path.join(ROOT, 'utils/security.js')) +
  '\nwindow.__SECURITY__ = module.exports;\n})();';

// 把 posterKit 的四个 CommonJS 模块打成一个浏览器可用的包
function bundlePosterKit() {
  const base = path.join(ROOT, 'utils/posterKit');
  const defs = {
    colors: read(path.join(base, 'colors.js')),
    helpers: read(path.join(base, 'helpers.js')),
    weekly34: read(path.join(base, 'templates/weekly34.js')),
    weekly916: read(path.join(base, 'templates/weekly916.js')),
    highlight34: read(path.join(base, 'templates/highlight34.js')),
    highlight916: read(path.join(base, 'templates/highlight916.js')),
    memorial34: read(path.join(base, 'templates/memorial34.js')),
    memorial916: read(path.join(base, 'templates/memorial916.js')),
    export: read(path.join(base, 'export.js')),
  };
  const body = Object.entries(defs).map(([name, src]) =>
    `__define(${JSON.stringify(name)}, function(module, exports, require){\n${src}\n});`
  ).join('\n\n');

  return `(function(){
  var __mods = {}, __cache = {};
  function __define(name, fn){ __mods[name] = fn; }
  function __norm(id){ return String(id).replace(/^.*\\//, '').replace(/\\.js$/, ''); }
  function __require(id){
    var key = __norm(id);
    if (__cache[key]) return __cache[key].exports;
    if (!__mods[key]) throw new Error('posterKit module not found: ' + id);
    var m = { exports: {} };
    __cache[key] = m;
    __mods[key](m, m.exports, __require);
    return m.exports;
  }
${body}
  window.__POSTER_KIT__ = __require('export');
})();`;
}

const posterKitBundle = bundlePosterKit();
/* 把 services 层打成浏览器可用的包（D2 起页面唯一数据出口） */
function bundleServices() {
  const files = {
    'services/config.js': read(path.join(ROOT, 'services/config.js')),
    'services/api.js': read(path.join(ROOT, 'services/api.js')),
    'services/util/bktime.js': read(path.join(ROOT, 'services/util/bktime.js')),
    'services/mock/seed.js': read(path.join(ROOT, 'services/mock/seed.js')),
    'services/mock/store.js': read(path.join(ROOT, 'services/mock/store.js')),
    'services/mock/index.js': read(path.join(ROOT, 'services/mock/index.js')),
    'services/real/index.js': read(path.join(ROOT, 'services/real/index.js')),
  };
  files['lib/craftStore.js'] = read(path.join(ROOT, 'lib/craftStore.js'));
  let coreSrc = read(path.join(ROOT, 'lib/core.js'));
  coreSrc = coreSrc.replace("const posterKit = require('../utils/posterKit/export.js');", 'const posterKit = window.__POSTER_KIT__;');
  coreSrc = coreSrc.replace("const Security = require('../utils/security.js');", 'const Security = window.__SECURITY__;');
  let sharedSrc = read(path.join(ROOT, 'lib/shared.js'));
  sharedSrc = sharedSrc.replace("const posterKit = require('../utils/posterKit/export.js');", 'const posterKit = window.__POSTER_KIT__;');
  sharedSrc = sharedSrc.replace("const Security = require('../utils/security.js');", 'const Security = window.__SECURITY__;');
  files['lib/core.js'] = coreSrc;
  files['lib/shared.js'] = sharedSrc;
  const body = Object.entries(files).map(([name, src]) =>
    `__define(${JSON.stringify(name)}, function(module, exports, require){\n${src}\n});`
  ).join('\n\n');
  return `(function(){
  var __mods = {}, __cache = {};
  function __define(name, fn){ __mods[name] = fn; }
  function __dir(id){ var p = id.split('/'); p.pop(); return p.join('/'); }
  function __norm(base, id){
    if (id.charAt(0) !== '.') return id;
    var parts = (base + '/' + id).split('/'), out = [];
    parts.forEach(function(p){ if (!p || p === '.') return; if (p === '..') out.pop(); else out.push(p); });
    return out.join('/');
  }
  function __requireFrom(base, id){
    var key = __norm(base, id);
    if (__cache[key]) return __cache[key].exports;
    if (!__mods[key]) throw new Error('services module not found: ' + id + ' from ' + base);
    var m = { exports: {} };
    __cache[key] = m;
    __mods[key](m, m.exports, function(x){ return __requireFrom(__dir(key), x); });
    return m.exports;
  }
${body}
  window.__SERVICES_API__ = __requireFrom('', 'services/api.js');
  window.__CORE__ = __requireFrom('', 'lib/core.js');
  window.__SHARED__ = __requireFrom('', 'lib/shared.js');
})();`;
}

const servicesBundle = bundleServices();


const morphdomSrc = read(path.join(__dirname, 'vendor/morphdom.min.js'));
const morphdomLicense = read(path.join(__dirname, 'vendor/morphdom.LICENSE'));
const runtimeSrc = read(path.join(__dirname, 'lib/runtime.js'));

/* ---------- 5. 组装 ---------- */
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>今日做点小事 · 预览</title>
<style>
${wxss}

${previewCss}
</style>
</head>
<body>
<div id="app"></div>

<script>
/* ${morphdomLicense.replace(/\n/g, '\n   ')} */
${morphdomSrc}
</script>

<script>
window.__ASSETS__ = ${JSON.stringify(assets)};
window.__TEMPLATES__ = ${JSON.stringify(templates)};
window.__AST__ = ${JSON.stringify(ast)};
</script>

<script>
${seedBundle}
</script>

<script>
${securityBundle}
</script>

<script>
${runtimeSrc}
</script>

<script>
${posterKitBundle}
</script>

<script>
/* services 的 mock 需要 wx storage；预览用 localStorage 模拟 */
(function(){
  var w = window.wx || {};
  w.getStorageSync = function(k){ try { return localStorage.getItem('dsm_preview_' + k) || ''; } catch(e){ return ''; } };
  w.setStorageSync = function(k, v){ try { localStorage.setItem('dsm_preview_' + k, v); } catch(e){} };
  window.wx = w;
})();
</script>

<script>
${servicesBundle}
</script>

<script>
${pageSrc}
</script>

<script>
window.__boot();
</script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');

const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log('已生成：' + path.relative(ROOT, outFile) + '  (' + kb + ' KB)');
