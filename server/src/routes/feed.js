const express = require('express');
const { asyncHandler, ok } = require('../http/respond');
const { getFeed } = require('../services/feed');

const router = express.Router();
router.get('/', asyncHandler(async (req, res) => ok(res, await getFeed(req.user.id))));
module.exports = router;
