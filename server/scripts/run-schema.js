#!/usr/bin/env node
/* 执行 db/schema.sql（可重复执行）。 */
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password,
    database: config.db.database, charset: 'utf8mb4',
    multipleStatements: true, timezone: '+08:00',
  });
  try {
    await conn.query(sql);
    /* P0-1B 迁移：老库补 subscribed 列；已有 progress 行默认视为订阅。 */
    const [cols] = await conn.query("SHOW COLUMNS FROM user_set_progress LIKE 'subscribed'");
    if (!cols.length) {
      await conn.query(
        'ALTER TABLE user_set_progress ADD COLUMN subscribed TINYINT(1) NOT NULL DEFAULT 1 AFTER trial_used'
      );
      console.log('[schema] migrated user_set_progress.subscribed');
    }
    console.log('[schema] 完成');
  } finally {
    await conn.end();
  }
})().catch(err => {
  console.error('[schema] 失败:', err && err.message ? err.message : err);
  process.exit(1);
});
