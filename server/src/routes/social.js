const express = require('express');
const { pool } = require('../db');
const { safeDel } = require('../redis');
const { asyncHandler, ok } = require('../http/respond');
const {
  getComments, addComment, toggleLike, getAuthor, toggleFollow,
} = require('../services/social');

/* 挂在 /sets 下：/:id/comments|like|weekly */
const setRouter = express.Router();

setRouter.get('/:id/comments', asyncHandler(async (req, res) => {
  return ok(res, await getComments(req.params.id));
}));

setRouter.post('/:id/comments', asyncHandler(async (req, res) => {
  const r = await addComment(req.user, req.params.id, (req.body && req.body.text) || '');
  return ok(res, r);
}));

setRouter.post('/:id/like', asyncHandler(async (req, res) => {
  return ok(res, await toggleLike(req.user.id, req.params.id));
}));

setRouter.post('/:id/weekly', asyncHandler(async (req, res) => {
  const setId = Number(req.params.id);
  const weekNo = Number(req.body && req.body.weekNo);
  await pool.query(
    'INSERT IGNORE INTO weekly_marks (user_id, set_id, week_no, created_ts) VALUES (?,?,?,?)',
    [req.user.id, setId, weekNo || 0, Date.now()]
  );
  await safeDel(`feed:${req.user.id}`);
  return ok(res, { ok: true });
}));

/* 挂在 /authors 下 */
const authorRouter = express.Router();

authorRouter.get('/:name', asyncHandler(async (req, res) => {
  // Express 已解码路径参数，这里不再 decodeURIComponent（避免二次解码）
  return ok(res, await getAuthor(req.user.id, req.params.name));
}));

authorRouter.post('/:name/follow', asyncHandler(async (req, res) => {
  return ok(res, await toggleFollow(req.user.id, req.params.name));
}));

module.exports = { setRouter, authorRouter };
