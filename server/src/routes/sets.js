const express = require('express');
const { asyncHandler, ok } = require('../http/respond');
const { setNotFound } = require('../http/errors');
const { listSets, getSetWithMeta } = require('../services/setPayload');
const { draw } = require('../services/draw');
const { saveStamp } = require('../services/stamp');
const { unlock, subscribeSet, unsubscribeSet } = require('../services/sets');
const { getPosterQR } = require('../services/qr');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const list = await listSets(req.user.id, {
    cat: req.query.cat ? String(req.query.cat) : undefined,
    sort: req.query.sort ? String(req.query.sort) : undefined,
  });
  return ok(res, list);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const p = await getSetWithMeta(req.user.id, Number(req.params.id));
  if (!p) throw setNotFound();
  return ok(res, p);
}));

/* 抽卡：幂等核心 */
router.post('/:id/draw', asyncHandler(async (req, res) => {
  const r = await draw(req.user.id, req.params.id, req.body && req.body.requestId);
  return ok(res, r);
}));

router.post('/:id/stamp', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const r = await saveStamp(req.user, req.params.id, {
    idx: body.idx, note: body.note, imgFileID: body.imgFileID,
  });
  return ok(res, r);
}));

router.post('/:id/unlock', asyncHandler(async (req, res) => {
  return ok(res, await unlock(req.user.id, req.params.id));
}));

router.post('/:id/subscribe', asyncHandler(async (req, res) => {
  return ok(res, await subscribeSet(req.user.id, req.params.id));
}));

router.post('/:id/unsubscribe', asyncHandler(async (req, res) => {
  return ok(res, await unsubscribeSet(req.user.id, req.params.id));
}));

router.get('/:id/qr', asyncHandler(async (req, res) => {
  const path = await getPosterQR(req.user.id, Number(req.params.id));
  return ok(res, { path });
}));

module.exports = router;
