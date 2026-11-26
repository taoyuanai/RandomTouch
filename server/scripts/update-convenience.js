#!/usr/bin/env node
/* 更新 id15「便利店哲学」：生活 / 收藏集 / 14 张。
 * 用法：node scripts/update-convenience.js --yes
 *
 * 以 services/mock/seed.js 为数据源，只更新这一集，不动其他卡集。
 */
const { pool } = require('../src/db');
const seed = require('../../services/mock/seed.js');

const SET_ID = 15;

(async () => {
  if (!process.argv.includes('--yes')) {
    console.error('[update-convenience] 需要显式传 --yes');
    process.exit(2);
  }
  const s = (seed.DEMO.sets || []).find(x => Number(x.id) === SET_ID);
  if (!s) throw new Error(`seed 中找不到 id=${SET_ID}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [u] = await conn.query(
      `UPDATE sets SET title=?, cov_t=?, cov_s=?, cat=?, type=?, price=?, trial=?,
         \`count\`=?, signature_idx=?, signature_note=?, intro=?, heat=?, date_text=?
       WHERE id=?`,
      [
        s.title, s.covT || s.title, s.covS || '', s.cat, s.type || 'collect',
        s.price || 0, s.trial || 0, s.pool.length, Number(s.signatureIdx),
        s.signatureNote || '', s.intro || '', s.heat || 0, s.date || '', SET_ID,
      ]
    );
    if (!u.affectedRows) throw new Error(`sets 中找不到 id=${SET_ID}`);

    await conn.query('DELETE FROM set_cards WHERE set_id=?', [SET_ID]);
    for (let i = 0; i < s.pool.length; i++) {
      await conn.query(
        'INSERT INTO set_cards (set_id, idx, w, b) VALUES (?,?,?,?)',
        [SET_ID, i, String(s.pool[i].w || ''), String(s.pool[i].b || '')]
      );
    }
    await conn.commit();
    console.log(`[update-convenience] ok: ${s.pool.length} cards`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
})().catch(e => {
  console.error('[update-convenience] failed', e && e.message ? e.message : e);
  process.exit(1);
});
