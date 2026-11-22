/* API 入口：Express + 统一错误出口。Nginx 反代到 127.0.0.1:PORT。 */
const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const config = require('./config');
const { ping } = require('./db');
const { redis } = require('./redis');
const { requireAuth } = require('./http/auth');
const { errorMiddleware } = require('./http/respond');

const authRouter = require('./routes/auth');
const setsRouter = require('./routes/sets');
const feedRouter = require('./routes/feed');
const craftRouter = require('./routes/craft');
const incomeRouter = require('./routes/income');
const mediaRouter = require('./routes/media');
const miscRouter = require('./routes/misc');
const { setRouter: socialSetRouter, authorRouter } = require('./routes/social');

const logger = pino({ level: config.logLevel });
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger, autoLogging: config.appEnv !== 'test' }));

app.get('/healthz', async (req, res) => {
  try {
    await ping();
    const pong = await redis.ping();
    res.json({ ok: true, env: config.appEnv, db: 'ok', redis: pong });
  } catch (e) {
    res.status(503).json({ ok: false, env: config.appEnv, error: 'dependency down' });
  }
});

const api = express.Router();
api.use('/auth', authRouter);
api.use(requireAuth); // 以下全部需要登录态
api.use('/sets', setsRouter);
api.use('/sets', socialSetRouter);
api.use('/authors', authorRouter);
api.use('/feed', feedRouter);
api.use('/craft', craftRouter);
api.use('/income', incomeRouter);
api.use('/upload', mediaRouter);
api.use('/', miscRouter);
app.use('/api/v1', api);

app.use(errorMiddleware(logger));

const server = app.listen(config.port, config.host || '127.0.0.1', () => {
  logger.info(`[api] listening on ${config.host || '127.0.0.1'}:${config.port} env=${config.appEnv} sec=${config.secMode}`);
});

function shutdown(sig) {
  logger.info(`[api] ${sig} received, shutting down`);
  server.close(() => {
    Promise.resolve().then(() => redis.quit()).catch(() => {}).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
