/* JWT 鉴权。auth()/登录接口之外的每个请求都必须带 Authorization: Bearer <jwt>。 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { authFailed } = require('./errors');

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), openid: user.openid },
    config.jwtSecret,
    { expiresIn: config.jwtExpire }
  );
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return next(authFailed('缺少登录凭证'));
  try {
    const payload = jwt.verify(m[1], config.jwtSecret);
    const id = Number(payload.sub);
    if (!id) return next(authFailed());
    req.user = { id, openid: payload.openid };
    next();
  } catch (e) {
    next(authFailed('登录已过期，请重新进入'));
  }
}

module.exports = { signToken, requireAuth };
