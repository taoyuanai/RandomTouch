#!/usr/bin/env node
/* tools/validate-seed.js
 * 校验 mock seed 与后端 seed 共用的卡集数据。
 * 运行：node tools/validate-seed.js [--strict]
 * 硬失败：count !== pool.length、空池、非法 cat/type、签名索引越界、know 缺 disclaimer。
 * 警告：pool < 8（演示内容待补），不阻断；--strict 时升级为失败。
 */
const path = require('path');
const seed = require(path.resolve(__dirname, '../services/mock/seed.js'));

const CATS = ['food', 'work', 'city', 'mood', 'life', 'bond', 'muse', 'walk', 'know'];
const STRICT = process.argv.includes('--strict');
let fails = 0;
let warns = 0;

function fail(set, msg) {
  fails++;
  console.log(`✗ ${set.id} ${set.title || ''} → ${msg}`);
}
function warn(set, msg) {
  warns++;
  console.log(`! ${set.id} ${set.title || ''} → ${msg}`);
}

const sets = (seed.DEMO && seed.DEMO.sets) || [];
sets.forEach(set => {
  const pool = Array.isArray(set.pool) ? set.pool : [];
  const count = Number(set.count);
  if (!pool.length) fail(set, 'pool 为空');
  if (count !== pool.length) fail(set, `count=${set.count} ≠ pool=${pool.length}`);
  if (!CATS.includes(set.cat)) fail(set, `cat=${set.cat}`);
  if (!['collect', 'resident'].includes(set.type)) fail(set, `type=${set.type}`);
  if (![0, 0.9, 1.9, 2.9, 3.9, 5.9].includes(Number(set.price))) fail(set, `price=${set.price}`);
  if (Number(set.price) > 0 && !(Number(set.trial) >= 1)) fail(set, '付费集 trial < 1');
  if (set.cat === 'know' && !(set.disclaimer && String(set.disclaimer).trim())) {
    fail(set, 'know 缺 disclaimer');
  }
  if (set.signatureIdx != null && Number(set.signatureIdx) !== -1
      && (Number(set.signatureIdx) < 0 || Number(set.signatureIdx) >= pool.length)) {
    fail(set, `signatureIdx=${set.signatureIdx} 越界`);
  }
  pool.forEach((card, i) => {
    if (!card || !String(card.w || '').trim()) fail(set, `pool[${i}].w 为空`);
    if (!card || !String(card.b || '').trim()) fail(set, `pool[${i}].b 为空`);
  });
  if (pool.length < 8) warn(set, `pool=${pool.length} < 8，演示内容待补`);
  const words = new Set();
  pool.forEach((card, i) => {
    const w = String((card && card.w) || '').trim();
    if (w && words.has(w)) warn(set, `pool[${i}] 词面重复：${w}`);
    if (w) words.add(w);
  });
});

console.log(`\nseed sets: ${sets.length} · fail: ${fails} · warn: ${warns}`);
if (fails || (STRICT && warns)) process.exit(1);
