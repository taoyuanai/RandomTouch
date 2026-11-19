/* tools/validate-content.js — 运行：node tools/validate-content.js 路径/*.json */
const fs = require('fs');

// 与 core.js CATS 的九 key 对齐
const CATS = ['food', 'work', 'city', 'mood', 'life', 'bond', 'muse', 'walk', 'know'];
let bad = 0;

process.argv.slice(2).forEach(f => {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const errs = [];
  if (!j.title || j.title.length > 12) errs.push('title');
  if (!j.covT || j.covT.length > 6) errs.push('covT');
  if (!CATS.includes(j.cat)) errs.push('cat=' + j.cat);
  if (!['collect', 'resident'].includes(j.type)) errs.push('type');
  if (!(j.price >= 0)) errs.push('price');
  if (j.price > 0 && !(j.trial >= 1)) errs.push('trial');
  if (!Array.isArray(j.pool) || j.pool.length < 8 || j.pool.length > 40) errs.push('pool=' + (j.pool || []).length);
  (j.pool || []).forEach((c, i) => {
    if (!c.w || c.w.length > 8) errs.push(`pool[${i}].w`);
    if (!c.b || !c.b.trim()) errs.push(`pool[${i}].b`);
  });
  if (j.signatureIdx != null && (j.signatureIdx < 0 || j.signatureIdx >= (j.pool || []).length)) errs.push('signatureIdx');
  if (j.cat === 'know' && !(j.disclaimer && j.disclaimer.trim())) errs.push('know 需 disclaimer');
  if (j.disclaimer && j.disclaimer.length > 20) errs.push('disclaimer 超长');
  if (errs.length) { bad++; console.log('✗', f, '→', errs.join(', ')); }
  else console.log('✓', f);
});

process.exit(bad ? 1 : 0);
