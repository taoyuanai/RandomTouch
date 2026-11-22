const express = require('express');
const { asyncHandler, ok } = require('../http/respond');
const { getIncome, withdraw } = require('../services/income');

const router = express.Router();
router.get('/', asyncHandler(async (req, res) => ok(res, await getIncome(req.user.id))));
router.post('/withdraw', asyncHandler(async (req, res) => ok(res, await withdraw(req.user.id))));
module.exports = router;
