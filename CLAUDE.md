# CLAUDE.md — 协作规则

## 项目背景

「今日做点小事」微信小程序：每日抽卡 + 盖邮戳记录 + 集齐装订。
当前 Phase 1：前端先行，后端冻结。一切数据走 services/api.js → mock。

> 架构提示：本项目是**单 Page SPA**（`pages/index` + view 切换），
> 「逐页接入」在 D2 指逐 view / 逐方法接入，不是逐文件。

## 铁律（违反任何一条 = 返工，无例外）

1. 页面/组件只允许 `const api = require('../../services/api.js')`。
   禁止：wx.request、wx.cloud.callFunction、直接 require mock/store
   **D1 例外**：现有页面暂直连 `data.js`；D2 起逐 view 迁移到 services/api.js，
   迁移完成后删除本例外。
2. 迁移页面时**类名一个不改**（全部样式挂在类名上）
3. 事件绑定名与原实现保持一致（bindtap="openSet" 等）
4. posterKit/ 只调用，不修改内部
5. 「今天是否已抽」等时间判断**禁止在页面用本地时间计算**，一律信 api 返回
6. 一次会话只做一张任务卡，小 diff；输出前自查：事件绑定还在吗、类名变了吗、wx:if 链对吗
7. 每日收工：commit 一个可运行状态 + 跑烟测清单

## 烟测清单（每天收工必跑）

1. 首页 → 卡集详情
2. 抽卡 → 盖邮戳
3. 看全图 → 点亮格 → 大卡
4. 生成海报（周记/明信片）
5. 创作 → 新建草稿 → 提交
6. 订阅页待办 → 直达动作

## 任务卡格式（每次会话开头贴这里）

- 目标：
- 涉及文件：
- 验收标准：
- 禁改区：

## Mock 调试（仅开发者工具控制台）

- `getApp().__apiDebug.setFailureRate(0.5)`  注入失败（测三态）
- `getApp().__apiDebug.travel(1)`            时间旅行 N 天（测跨天/周记）
- `getApp().__apiDebug.reset()`               重置种子数据

> D1 验收也可直接用 `getApp().__api`（app.js 已暴露），避免控制台 require 路径问题。
