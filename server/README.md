# 今日做点小事 · 自建后端

Node 20 + Express + MySQL + Redis + 腾讯云 COS。实现 `contract.md` v1 的 22 个方法；
小程序只通过 `services/real/index.js` 接入，页面与 `lib/` 零改动。

## 架构

```
小程序 ──HTTPS──> Nginx ──> Node API (127.0.0.1:3000) ──> MySQL / Redis
小程序 ──HTTPS 直读──> COS（图片）
```

- **MySQL 是唯一事实源**；Redis 只做幂等快路径、缓存、限流。
- 「天」= 北京时间（UTC+8），统一由 `src/services/time.js` 计算。
- 抽卡无保底、无权重：collect 在未收集卡里均匀随机，resident 全池均匀随机。

## 目录

```
src/
  index.js              启动 / 路由挂载 / 错误处理
  config.js             环境变量
  db.js  redis.js
  http/                 auth / errors / respond / upload
  routes/               auth sets social feed craft income media misc
  services/             draw stamp feed social craft income setPayload qr cos sec session time
db/
  schema.sql            全部表（可重复执行）
  seed.js               从 services/mock/seed.js 导入内容
scripts/
  run-schema.js  attach-demo.js  mint-token.js  smoke.js
```

## 本地/服务器运行

```bash
cd server
cp .env.example .env        # 本地开发；服务器由 bootstrap 生成 shared/.env
npm install
node scripts/run-schema.js
node db/seed.js
npm start
```

测试环境推荐直接跑 `sudo bash deploy/test/bootstrap.sh`（幂等）。

## 环境变量

见 `.env.example`。关键项：

| 变量 | 说明 |
|---|---|
| `DB_*` | MySQL 连接 |
| `REDIS_URL/REDIS_DB/REDIS_PREFIX` | Redis（测试 db 1 + `rt:test:` 前缀） |
| `JWT_SECRET` | 必填，登录态签名 |
| `WX_APPID/WX_SECRET` | 微信登录；Secret 只放服务器 |
| `COS_*` | 图片存储；`COS_PUBLIC_BASE` 需加入小程序 downloadFile 合法域名 |
| `SEC_MODE` | `mock`（测试放行）/ `real`（调微信内容安全） |

## 冒烟

```bash
# 服务器上（先加载 bootstrap 生成的环境变量）
. /data/project/randomtouch/test/shared/env.sh
node scripts/mint-token.js <openid>          # 输出 JWT
node scripts/smoke.js --base=http://127.0.0.1:3000 --token=<jwt>
```

覆盖：healthz → listSets → subscribe → draw 幂等 → 当日二次抽 → saveStamp →
feed → income → craft → author → like → markWeekly。

## 测试演示数据

```bash
node scripts/attach-demo.js --openid=<openid>
```
把账号绑定到种子创作者「打工人小王」并回填种子卡集进度（订阅页/周记/收益可跑）。

## 已知缺口（v1，测试环境可接受）

1. **图片异步审核回调**：`mediaCheckAsync` 的结果需要公网 HTTPS 回调或轮询；v1 只落 `pending`，
   不会自动转 `pass/risky`。正式环境上线前需补回调端点（可参考 `cloudfunctions/sec-callback`）。
2. **解锁 / 提现**：v1 按契约模拟成功；正式收款/打款必须接支付回调。
3. **投稿审核后台**：`set_reviews` 只有入库，没有运营审核通过后转 `sets` 的流程。
4. **内容安全**：测试环境 `SEC_MODE=mock` 直接放行；正式环境切 `real` 并验证模板。
5. **图片上传**：v1 经服务端中转写 COS；如需彻底剥离服务器带宽，可换 STS 直传。

## 运维

```bash
systemctl status randomtouch-test-api
journalctl -u randomtouch-test-api -n 100 --no-pager
tail -f /data/project/randomtouch/test/logs/api.log
curl http://127.0.0.1:3000/healthz
```

回滚前端：`services/config.js` 里 `USE_MOCK = true`。
