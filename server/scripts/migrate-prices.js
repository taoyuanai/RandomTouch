#!/usr/bin/env node
/* 旧演示价 6 / 12 / 19 → 新档 1.9 / 3.9 / 5.9。
 * 用法：node scripts/migrate-prices.js
 */
const { pool } = require('../src/db');

(async () => {
  const map = [[6, 1.9], [12, 3.9], [19, 5.9]];
  for (const [from, to] of map) {
    const [r1] = await pool.query('UPDATE sets SET price = ? WHERE price = ?', [to, from]);
    const [r2] = await pool.query(
      "UPDATE set_reviews SET payload = JSON_SET(payload, '$.price', ?) WHERE JSON_EXTRACT(payload, '$.price') = ?",
      [to, from]
    );
    console.log(`[prices] ${from} → ${to}: sets=${r1.affectedRows} reviews=${r2.affectedRows}`);
  }
  await pool.end();
})().catch(e => { console.error('[prices] failed', e); process.exit(1); });
