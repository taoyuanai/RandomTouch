# 海报二维码（QR 回流）配置

## 1. 填云环境

在 `services/config.js` 填入云开发环境 ID：

```js
CLOUD_ENV: '你的云开发环境ID',
```

为空时：

- 海报预览显示「搜一搜」
- Canvas 导出使用透明 QR 占位，不再画假 QR
- 扫码回流不会发生

## 2. 部署云函数

`cloudfunctionRoot` 已指向 `cloudfunctions/`。在微信开发者工具：

1. 右键 `cloudfunctions/qrcode`
2. 上传并部署（云端安装依赖）
3. 确认云函数可调用

函数使用：

```js
cloud.openapi.wxacode.getUnlimited({
  scene: `s=${sid}`,
  page: 'pages/home/index',
  width: 280,
  checkPath: false,
})
```

生成的码会打开首页，再由 `handleLaunchOptions` 解析 `scene=s=<sid>` 并进入对应卡集。

## 3. 验证

真机扫码后检查：

- 是否进入首页
- 是否自动跳转到对应卡集
- iOS / Android 是否都能扫
- 海报里的码与预览一致

## 4. 无二维码兜底

- `api.getPosterQR` 无云环境时返回 `{ path: '' }`
- WXML 显示「搜一搜」
- Canvas 使用 `assets/icons/qr-blank.png` 透明图，避免出现 `QR` 占位框
- 保存成功会提示「无二维码版」
