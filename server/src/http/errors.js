/* 契约错误码：v1 全量、不多不少（contract.md §0.3）。
 * 客户端按 { code, message, retryable } 识别，HTTP 状态统一 200。
 */
const RETRYABLE = {
  INTERNAL: true,
  AUTH_FAILED: true,
  SET_NOT_FOUND: false,
  UNLOCK_REQUIRED: false,
  SEC_REJECTED: false,
  SEC_PENDING: false,
};

class AppError extends Error {
  constructor(code, message, retryable) {
    super(message || code);
    this.name = 'AppError';
    this.code = RETRYABLE[code] != null ? code : 'INTERNAL';
    this.retryable = retryable != null ? !!retryable : RETRYABLE[this.code];
  }
  toJSON() {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

function setNotFound() { return new AppError('SET_NOT_FOUND', '卡集不存在'); }
function authFailed(msg) { return new AppError('AUTH_FAILED', msg || '登录态失效'); }
function unlockRequired(price) {
  return new AppError('UNLOCK_REQUIRED', `试抽已用完 · 解锁全集 ¥${price}`);
}
function secRejected(msg) { return new AppError('SEC_REJECTED', msg || '内容暂时无法公开展示'); }
function secPending(msg) { return new AppError('SEC_PENDING', msg || '内容审核中'); }
function internal(msg) { return new AppError('INTERNAL', msg || '服务器开小差了'); }

/* 把任意异常规整成契约错误；非 AppError 一律掩码成 INTERNAL，避免泄露内部信息 */
function toContractError(err) {
  if (err instanceof AppError) return err;
  if (err && err.code && RETRYABLE[err.code] != null) {
    return new AppError(err.code, err.message, err.retryable);
  }
  return new AppError('INTERNAL', '服务器开小差了', true);
}

module.exports = {
  AppError, RETRYABLE, toContractError,
  setNotFound, authFailed, unlockRequired, secRejected, secPending, internal,
};
