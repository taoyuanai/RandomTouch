const express = require('express');
const { asyncHandler, ok } = require('../http/respond');
const { getMyCraft, submitCraft } = require('../services/craft');

const router = express.Router();
router.get('/', asyncHandler(async (req, res) => ok(res, await getMyCraft(req.user.id))));
router.post('/', asyncHandler(async (req, res) => {
  return ok(res, await submitCraft(req.user, req.body && req.body.draft));
}));
module.exports = router;
