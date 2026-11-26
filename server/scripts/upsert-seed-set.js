#!/usr/bin/env node
/* 从 mock seed 定向新增/更新一个卡集及其卡面，不清理其他数据。
 * 用法：node scripts/upsert-seed-set.js --id=20 --yes
 */
const { pool } = require('../src/db');
const seed = require('../../services/mock/seed.js');

function arg(name) {
  const hit = process.argv.find(x => x.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
}

(async () => {
  const id = Number(arg('id'));
  if (!Number.isFinite(id) || id <= 0) {
    console.error('[upsert-set] 需要 --id=<setId>');
    process.exit(2);
  }
  if (!process.argv.includes('--yes')) {
    console.error('[upsert-set] 需要显式传 --yes');
    process.exit(2);
  }
  const s = (seed.DEMO.sets || []).find(x => Number(x.id) === id);
  if (!s) throw new Error(`seed 中找不到 id=${id}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let creatorId;
    const [cr] = await conn.query('SELECT id FROM creators WHERE name = ?', [s.creator]);
    if (cr.length) creatorId = cr[0].id;
    else {
      const [ins] = await conn.query(
        'INSERT INTO creators (name, base_fans, created_at) VALUES (?, ?, ?)',
        [s.creator, (seed.FANS && seed.FANS[s.creator]) || 0, Date.now()]
      );
      creatorId = ins.insertId;
    }

    const now = Date.now();
    await conn.query(
      `INSERT INTO sets
        (id, title, cov_t, cov_s, cover, cover_image, cat, type, price, trial, \`count\`,
         signature_idx, signature_note, intro, creator_id, heat, released_at, date_text,
         disclaimer, likes, status, total_drawn, earn, buyers, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         title=VALUES(title), cov_t=VALUES(cov_t), cov_s=VALUES(cov_s), cover=VALUES(cover),
         cover_image=VALUES(cover_image), cat=VALUES(cat), type=VALUES(type),
         price=VALUES(price), trial=VALUES(trial), \`count\`=VALUES(\`count\`),
         signature_idx=VALUES(signature_idx), signature_note=VALUES(signature_note),
         intro=VALUES(intro), creator_id=VALUES(creator_id), heat=VALUES(heat),
         date_text=VALUES(date_text), disclaimer=VALUES(disclaimer), status=VALUES(status),
         total_drawn=VALUES(total_drawn), earn=VALUES(earn), buyers=VALUES(buyers)`,
      [
        s.id, s.title, s.covT || s.title, s.covS || '', s.cover || 'c1',
        s.coverImage || '', s.cat, s.type || 'collect', s.price || 0, s.trial || 0,
        s.pool.length, Number(s.signatureIdx), s.signatureNote || '', s.intro || '',
        creatorId, s.heat || 0, null, s.date || '', s.disclaimer || '',
        0, 'published', s.totalDrawn || 0, 0, 0, now,
      ]
    );

    await conn.query('DELETE FROM set_cards WHERE set_id = ?', [id]);
    for (let i = 0; i < s.pool.length; i++) {
      await conn.query(
        'INSERT INTO set_cards (set_id, idx, w, b) VALUES (?,?,?,?)',
        [id, i, String(s.pool[i].w || ''), String(s.pool[i].b || '')]
      );
    }
    await conn.commit();
    console.log(`[upsert-set] id=${id} ${s.title} cards=${s.pool.length}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
})().catch(e => {
  console.error('[upsert-set] failed', e && e.message ? e.message : e);
  process.exit(1);
});
