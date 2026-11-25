# 发布配置 checklist

## 1. 客户端配置

编辑 `services/config.js`：

- [ ] `RELEASE = true`
- [ ] `RELEASE_API_BASE` 改为已备案、已配置 HTTPS 的正式 API 域名（例如 `https://api.example.com/api/v1`）
- [ ] `DEV_API_BASE` 只用于开发，不参与 release
- [ ] `DEBUG` 保持 `false`
- [ ] P0-6B 真实微信支付完成，`PAYMENT_READY = true`
- [ ] `lib/core.js` 的 `TMPL_IDS` 填入微信公众平台「每日新签提醒」模板 ID

执行：

```bash
node tools/release-check.js
```

必须输出 `✓ release-check passed`，否则不要提审。

## 2. 微信小程序后台

- [ ] request 合法域名：正式 API 域名
- [ ] uploadFile 合法域名：正式 API 域名
- [ ] downloadFile 合法域名：正式 API 域名 + COS 域名（签名 URL 仍走 COS 域名）
- [ ] 隐私协议、用户信息、相册/相机权限说明
- [ ] 订阅消息模板已申请并填入 `TMPL_IDS`

## 3. 服务端

- [ ] `APP_ENV=prod`，`.env` 配齐 DB / Redis / JWT / 微信 AppID+Secret / COS
- [ ] HTTPS 证书与 Nginx 443 配置
- [ ] `npm run db:schema`（包含 P0-1B `subscribed` 迁移）
- [ ] `npm run db:prices`（旧演示价 6/12/19 → 1.9/3.9/5.9）
- [ ] `npm run cos:private -- --yes`（Bucket 与历史对象设为 private）
- [ ] COS 域名与 API 域名可被小程序合法域名访问
- [ ] `curl https://正式域名/healthz` 返回 db/redis ok
- [ ] `node scripts/smoke.js --base=https://正式域名 --token=...`

## 4. 数据与内容

- [ ] `node tools/validate-seed.js`：0 fail
- [ ] 补齐 pool < 8 的演示集，或确认不再使用这些演示内容
- [ ] 新集 `count === pool.length`
- [ ] know 集带 disclaimer
- [ ] 删除/隐藏 demo review、demo 草稿、demo 收益数据

## 5. 最终回归

- [ ] 真机非开发者工具，关闭 Mock
- [ ] 首页 → 详情 → 抽卡 → 盖戳 → 分享
- [ ] 收藏册三 tab
- [ ] 搜索/分类/全图/作者/收益/创作
- [ ] 订阅/取消订阅/重新订阅，进度保留
- [ ] 上传封面/盖戳照片，签名 URL 正常
- [ ] 海报保存相册
- [ ] 控制台无 `__apiDebug`、无 HTTP/IP 请求提示
