const express = require('express');
const { pool } = require('../db');
const { asyncHandler, ok } = require('../http/respond');

const router = express.Router();

/* POST /remind { enabled, time } */
router.post('/remind', asyncHandler(async (req, res) => {
  const enabled = req.body && req.body.enabled ? 1 : 0;
  const timeText = String((req.body && req.body.time) || '21:00').slice(0, 5);
  await pool.query(
    `INSERT INTO remind_auth (user_id, enabled, time_text, updated_ts) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), time_text = VALUES(time_text), updated_ts = VALUES(updated_ts)`,
    [req.user.id, enabled, timeText, Date.now()]
  );
  return ok(res, { ok: true });
}));

/* POST /track { event, props } — 允许静默失败 */
router.post('/track', asyncHandler(async (req, res) => {
  try {
    const event = String((req.body && req.body.event) || '').slice(0, 64);
    if (event) {
      await pool.query(
        'INSERT INTO events (user_id, event, props, ts) VALUES (?,?,?,?)',
        [req.user.id, event, JSON.stringify((req.body && req.body.props) || {}), Date.now()]
      );
    }
  } catch (e) { /* 埋点失败不影响主流程 */ }
  return ok(res, { ok: true });
}));

module.exports = router;
