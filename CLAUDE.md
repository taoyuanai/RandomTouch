# CLAUDE.md — 协作规则

## 项目背景

「今日做点小事」微信小程序：每日抽卡 + 盖邮戳记录 + 集齐装订。
当前 Phase 1：前端先行，后端冻结。一切数据走 services/api.js → mock。

> 架构提示：D5 起为**多页原生小程序**（4 tab + set/draw/map/edit/income/author/demo），
> S 由 lib/core.js 全局单例共享；页面只保留生命周期与极少量私有方法。

## 铁律（违反任何一条 = 返工，无例外）

1. 页面/组件只允许 `const api = require('../../services/api.js')`。
   禁止：wx.request、wx.cloud.callFunction、直接 require mock/store
   **过渡例外**：D2-D3 已完成 首页/订阅/创作/我的 + 抽卡/解锁/点赞/留言 的 api 迁移；
   其余 view（set 页的 seed 社交/粉丝、edit/income/author/demo）暂直连 `data.js`，
   按 D4-D6 逐 view 迁移，迁移完成的 view 必须只走 api；D6 前删除本例外。
2. 迁移页面时**类名一个不改**（全部样式挂在类名上）
3. 事件绑定名与原实现保持一致（bindtap="openSet" 等）
4. posterKit/ 只调用，不修改内部
5. 「今天是否已抽」等时间判断**禁止在页面用本地时间计算**，一律信 api 返回
6. 一次会话只做一张任务卡，小 diff；输出前自查：事件绑定还在吗、类名变了吗、wx:if 链对吗
7. 每日收工：commit 一个可运行状态 + 跑烟测清单

8. 页面 js 文件只允许：require shared/core、生命周期 hooks、极少量页面私有方法；
   业务方法一律落在 lib/shared.js（改方法 = 改 shared，不是改页面）

9. 新页面四件套 checklist：① json 判断是否 custom 导航 ② wxml 顶部
   <import src="/templates/common.wxml"/> ③ js 第一行 this.S = core.getS()
   ④ onUnload 清理本页定时器/观察器
10. 页面逻辑中禁止用 data.page 判断当前页面（hub 已删除，无例外）——一律用 this.__page

11. S.fans / S.social / S.comments / S.follow 是「显示缓存」：只允许由 api 响应
    写入（applySetPayload / refreshSetMeta / renderAuthor / toggleLike 等），
    禁止再从 seed 初始化或本地推算

## 过渡期规则（D2-D6）

- 存量 seed 直引（CATS/CRAFT/FANS/SOCIAL_SEED/COMMENTS_SEED/PLATFORM_INCOME/TXN_SEED）
  在各页迁移日移除；新代码禁止新增任何 seed/mock 直引
- S.activity 为临时缓存（见 _afterDrawnApi 内 TODO(D3)），renderSubs 迁 getFeed 后删除
- 预览 html 从 D2 起只作视觉基准，不再维护业务逻辑

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
