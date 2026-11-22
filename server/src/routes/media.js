const express = require('express');
const { asyncHandler, ok } = require('../http/respond');
const { AppError } = require('../http/errors');
const { uploadSingle } = require('../http/upload');
const { putBuffer, extOf } = require('../services/cos');

const router = express.Router();

/* POST /upload (multipart, field=file) → { fileID, url }
 * fileID = COS object key；图片展示走 url / saveStamp 返回的 rec.img。
 */
router.post('/', uploadSingle, asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) throw new AppError('INTERNAL', '未收到图片', false);
  const mime = req.file.mimetype || 'image/jpeg';
  const kind = String((req.body && req.body.kind) || 'stamps');
  const out = await putBuffer({
    buffer: req.file.buffer,
    mime,
    kind: kind === 'covers' ? 'covers' : 'stamps',
    userId: req.user.id,
    ext: extOf(mime, req.file.originalname),
  });
  return ok(res, { fileID: out.key, url: out.url });
}));

module.exports = router;
