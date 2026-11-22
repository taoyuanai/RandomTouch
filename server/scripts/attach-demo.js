#!/usr/bin/env node
/* 把测试账号绑定到种子创作者「打工人小王」，并回填种子卡集的演示进度。
 * 仅用于测试环境，方便跑通烟测清单（订阅页/周记/收益）。
 *
 * 用法：node scripts/attach-demo.js --openid=<openid>
 *       node scripts/attach-demo.js --user-id=<id>
 *       node scripts/attach-demo.js --openid=<openid> --reset
 */
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');
const time = require('../src/services/time');
const seed = require(path.resolve(__dirname, '../../services/mock/seed.js'));

const DAY = 86400000;

function arg(name, d) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : d;
}
function has(name) { return process.argv.includes(`--${name}`); }
function parseRecDate(short, now) {
  const m = String(short || '').match(/(\d+)月(\d+)日/);
  if (!m) return { short: short || '', stamp: short || '' };
  const y = time.todayKey(now).slice(0, 4);
  const p = n => String(n).padStart(2, '0');
  return { short, stamp: `${y}.${p(m[1])}.${p(m[2])}` };
}

(async () => {
  const openid = arg('openid', '');
  const userIdArg = Number(arg('user-id', 0));
  if (!openid && !userIdArg) {
    console.error('用法: node scripts/attach-demo.js --openid=<openid> 或 --user-id=<id> [--reset]');
    process.exit(1);
  }
  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password, database: config.db.database,
    charset: 'utf8mb4', dateStrings: true, decimalNumbers: true, timezone: '+08:00',
  });
  const now = Date.now();
  try {
    let user;
    if (userIdArg) {
      const [rows] = await conn.query('SELECT * FROM users WHERE id = ?', [userIdArg]);
      user = rows[0];
    } else {
      const [rows] = await conn.query('SELECT * FROM users WHERE openid = ?', [openid]);
      user = rows[0];
    }
    if (!user) { console.error('用户不存在，请先在小程序里登录一次'); process.exit(2); }

    const [[creator]] = await conn.query("SELECT * FROM creators WHERE name = '打工人小王'");
    if (!creator) { console.error('种子创作者不存在，请先执行 db/seed.js'); process.exit(3); }
    await conn.query('UPDATE creators SET user_id = ? WHERE id = ?', [user.id, creator.id]);
    console.log(`[demo] 已把 creators#${creator.id} 绑定到 user#${user.id}`);

    if (has('reset')) {
      await conn.query('DELETE FROM draw_logs WHERE user_id = ?', [user.id]);
      await conn.query('DELETE FROM user_set_cards WHERE user_id = ?', [user.id]);
      await conn.query('DELETE FROM user_set_progress WHERE user_id = ?', [user.id]);
      await conn.query('DELETE FROM stamps WHERE user_id = ?', [user.id]);
      console.log('[demo] 已清空该用户进度');
    }

    const [setRows] = await conn.query('SELECT id, type, `count` FROM sets');
    const typeOf = new Map(setRows.map(r => [r.id, r.type]));
    const countOf = new Map(setRows.map(r => [r.id, Number(r.count)]));

    let touched = 0;
    for (const s of (seed.DEMO.sets || [])) {
      const u = s.user;
      if (!u) continue;
      const [[exists]] = await conn.query(
        'SELECT 1 AS x FROM user_set_progress WHERE user_id = ? AND set_id = ?', [user.id, s.id]
      );
      if (exists) continue;

      const got = Array.isArray(u.got) ? u.got : [];
      const total = countOf.get(s.id) || (s.pool || []).length;
      const validGot = got.map(Number).filter(i => i >= 0 && i < total);
      const drawn = typeOf.get(s.id) === 'collect'
        ? validGot.length
        : Number(u.drawn || validGot.length);
      await conn.query(
        `INSERT INTO user_set_progress
          (user_id, set_id, drawn, today_drawn, trial_today, today_idx, unlocked, trial_used, last_draw_date, created_at, updated_at)
         VALUES (?,?,?,0,0,NULL,?,?,NULL,?,?)`,
        [user.id, s.id, drawn, u.unlocked ? 1 : (Number(s.price) === 0 ? 1 : 0), Number(u.trialUsed || 0), now, now]
      );
      for (let i = 0; i < validGot.length; i++) {
        const idx = validGot[i];
        const ts = now - (validGot.length - 1 - i) * DAY;
        await conn.query(
          'INSERT IGNORE INTO user_set_cards (user_id, set_id, idx, first_ts) VALUES (?,?,?,?)',
          [user.id, s.id, idx, ts]
        );
        if (typeOf.get(s.id) === 'collect') {
          await conn.query(
            'INSERT INTO draw_logs (user_id, set_id, card_idx, is_trial, request_id, ts, day_key) VALUES (?,?,?,0,?,?,?)',
            [user.id, s.id, idx, '', ts, time.dateKeyOf(ts)]
          );
        }
      }
      const recs = u.recs || {};
      for (const key of Object.keys(recs)) {
        const idx = Number(key);
        if (!(idx >= 0 && idx < total)) continue;
        const list = Array.isArray(recs[key]) ? recs[key] : [recs[key]];
        for (const r of list) {
          const d = parseRecDate(r.date, now);
          const ts = now - DAY;
          await conn.query(
            `INSERT INTO stamps
              (user_id, set_id, card_idx, img_url, img_file_id, note, day_key, date_text, day_text, stamp_date, sec_text, sec_media, created_ts)
             VALUES (?,?,?,'','',?,?,?,?,?,'pass',?,?)`,
            [user.id, s.id, idx, String(r.note || ''), time.dateKeyOf(ts), d.short,
              time.dayText(ts), d.stamp, r.img ? 'pass' : 'none', ts]
          );
        }
      }
      touched++;
    }
    console.log(`[demo] 回填 ${touched} 个卡集的演示进度`);
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('[demo] 失败:', err && err.message ? err.message : err);
  process.exit(1);
});
