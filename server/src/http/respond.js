/* 统一成功/失败出口。失败仍 HTTP 200 + {code,message,retryable}，与客户端契约一致。 */
const { toContractError } = require('./errors');

function ok(res, data) {
  res.json(data === undefined ? { ok: true } : data);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/* 全局错误处理中间件 */
function errorMiddleware(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const e = toContractError(err);
    if (e.code === 'INTERNAL') {
      (logger || console).error({ err, path: req.path }, 'internal error');
    }
    res.status(200).json(e.toJSON());
  };
}

module.exports = { ok, asyncHandler, errorMiddleware };
