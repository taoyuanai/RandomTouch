# 测试与 CI

## 本地命令

```bash
npm test          # 全部测试（API 契约 / 页面渲染 / 海报 / 静态检查）
npm run validate  # seed + 内容校验
npm run check     # test + validate
```

单项：

```bash
npm run test:api
npm run test:pages
npm run test:poster
npm run test:static
```

不需要 `npm install`；测试使用 Node 内置 `node:test` 与项目内 mock，不连 MySQL / Redis / COS。

## 测试内容

| 文件 | 覆盖 |
|---|---|
| `tools/test/api-contract.test.js` | listSets 摘要无 pool、getSet 完整、feed 行无 pool、作者/创作摘要、审核草稿保留 pool |
| `tools/test/page-render.test.js` | boot 摘要、详情 hydrate、12 页面渲染、done / stats / 大卡 / 盖戳 |
| `tools/test/poster.test.js` | 周记唯一数据源、预览与导出复用、无二维码导出 |
| `tools/test/nav.test.js` | 导航度量（状态栏 / navTop / 胶囊让位 / 卡面高度）、tabBar selected 同步 |
| `tools/test/media.test.js` | 上传前压缩、压缩失败回退、5MB 上限 |
| `tools/test/app.test.js` | App 级 onError / onUnhandledRejection / 404 回首页 |
| `tools/test/api-retry.test.js` | GET retryable 重试一次；非 retryable / 写请求不重试 |
| `tools/test/mock-edge.test.js` | 故障注入、draw 幂等、同日不重复、travel 跨天、取消/恢复订阅、空池 |
| `tools/test/static.test.js` | 全部 JS 语法、WXML 解析、WXSS 括号、页面不直连 mock/wx.request/云函数、app.json |

## CI

`.github/workflows/ci.yml` 在 push / pull_request 上运行：

```bash
npm test
npm run validate
```

`tools/release-check.js` 不进 CI：它在 `RELEASE=false` / 未接 HTTPS / 未接支付时**故意失败**，只作为提审闸门手动执行：

```bash
node tools/release-check.js
```
