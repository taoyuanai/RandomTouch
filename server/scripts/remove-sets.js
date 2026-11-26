#!/usr/bin/env node
/* 下架并物理删除指定卡集及其关联数据。
 * 用法：node scripts/remove-sets.js --yes
 *
 * 当前删除：
 *   1   醒来觉得甚是爱你
 *   4   律师朋友讲的三十个案例
 *   12  睡前一首诗
 */
const { pool } = require('../src/db');

const IDS = [1, 4, 12];
const CHILD_TABLES = [
  'set_cards',
  'user_set_progress',
  'user_set_cards',
  'draw_logs',
  'draw_requests',
  'stamps',
  'comments',
  'set_likes',
  'weekly_marks',
];

(async () => {
  if (!process.argv.includes('--yes')) {
    console.error('[remove-sets] 需要显式传 --yes，防止误删');
    process.exit(2);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const table of CHILD_TABLES) {
      await conn.query(`DELETE FROM ${table} WHERE set_id IN (?)`, [IDS]);
    }
    const [r] = await conn.query('DELETE FROM sets WHERE id IN (?)', [IDS]);
    await conn.commit();
    console.log(`[remove-sets] sets deleted=${r.affectedRows}; ids=${IDS.join(',')}`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
})().catch(e => {
  console.error('[remove-sets] failed', e && e.message ? e.message : e);
  process.exit(1);
});
