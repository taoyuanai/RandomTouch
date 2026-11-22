/* 图片上传中间件：内存存储，单张 5MB 上限。 */
const multer = require('multer');
const config = require('../config');
const { AppError } = require('./errors');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter(req, file, cb) {
    if (!/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype || '')) {
      return cb(new AppError('INTERNAL', '只支持 jpg/png/webp 图片', false));
    }
    cb(null, true);
  },
});

module.exports = { uploadSingle: upload.single('file') };
