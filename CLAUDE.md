# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

当前项目基于 **「今日做点小事」V2.3b 完整产品**，并增量合并 V2.3c 的设计与动画内容：暖橙多彩视觉 + 搜索/快捷入口 + 创作中心 / 编辑器 / 上架闭环 / 收益看板 / 我的 / 创作者主页 / 分享海报。V2.3c 的金色 SSR、动画高亮海报、卡面水印和组件总览已并入；**没有整页替换为 V2.3c 的静态原型**。

- 页面入口 `/` 直接返回 `static/day_small_things_v2.html`，不经过 Jinja 渲染。
- **布局**：每个页面滚动时顶部区域固定（`.page-head` + `position: sticky`），只有下方内容滚动；`.screen` 是独立滚动容器。订阅页固定区含页头「订阅」、今日待抽提示与三项统计（内容由 `renderCardsTab()` 分别写入 `#cardsHead` / `#cardsList`）；创作中心由 `#craftBody` 渲染，无页头；编辑器 / 收益看板 / 创作者页各带页头。
- 页面结构、文案与交互沿用当前 HTML；视觉以文件头注释和当前 CSS 为准（见下）。较早的原始文件保存在 `resources/deepseek_html_20261110_daba72.html`。
- 卡背 LOGO 位默认显示制卡者头像标记「签」，旁边只保留「做卡人 @xxx」；卡背不写定制位 / 联名等内容。
- 页面结构：发现 / 订阅 / 创作 / 我的 四个 Tab，另有卡集详情、抽卡拆信封、卡集全图、抽空纪念、付费墙、大卡弹层、卡集编辑器、收益看板、创作者主页、分享海报，以及 dev-only 组件总览。
- 导航与文案：底部导航为「发现 / 订阅 / 创作 / 我的」；「广场」字样统一为「发现」；发现页顶部品牌字「今日做点小事」已移除。V2.3b 的「我的」页为完整版，含身份头「我 / @打工人小王」。
- 页面底部原型控制台：`新用户 · 空态` / `演示用户 · 有进度` / `组件总览` / `创作者 · 零作品`。
- V2.3c 增量：金色 SSR、四色稀有度圆点、动画高亮海报、卡面水印随稀有度同步。
- 数据全部在页面内 `DEMO` / `CRAFT` / `AUTHORED` / `WORK` / `FOLLOW` / `FANS` / `INCOME` 等对象中，纯前端演示，刷新后恢复初始状态，不调用后端。

### 视觉系统（设计系统 v1.0）

- 主色暖橙 `#FF6B35`，配薄荷绿、天空蓝等多色强调；白底多彩、轻盈鲜活。
- 设计 Token 集中在文件顶部 `:root`；卡片、按钮、海报、统计等由 token 驱动。
- V2.3c 金色 SSR：`--gold-50…--gold-700`，SSR 徽章/稀有度条/圆点/卡面水印/海报统一为金色。
- 稀有度圆点：N mint、R sky、SR honey、SSR gold。
- 海报：V2.3c 动画高亮版式（`poster-highlight`、`poster-setinfo`、SSR shine），仍使用当前动态卡集/卡片数据。
- 主操作（上架、提现、保存海报等）使用 `.cta.solid` 实心按钮；次级操作为 ghost / secondary。
- 字体：界面统一 `--sans`；衬线白名单为文学卡集整卡（`.lit`）、仪式标签、抽空纪念标题与结语等。
- 卡面大词由 `bwCls()` 自适应；卡面带稀有度水印/色条，保留信封开启与卡片翻转动效。
- 顶部固定、下方滚动的布局保留。

### 附件修复（必要）

用户提供的 HTML 中有五处会导致页面不可用、点击抖动或页面闪烁的问题，已做最小修复：

1. 分享海报弹层原被插在 `<nav class="tabbar"` 起始标签中间，导致导航栏无法解析；已恢复 `<nav class="tabbar" id="tabbar">`，并把海报弹层移到导航之后。
2. 海报弹层调用未定义的 `showModal` / `hideModal`；已补充这两个辅助函数。
3. 海报渲染读取了不存在的卡片字段 `c.t`，卡池字段为 `c.w`；已将海报标题读取改为 `c.w`。
4. 页面切换的 `pageEnter`（6px 下移）和列表入场的 `staggerIn`（10px 下移）会导致点击时整页/列表震颤；已改为纯淡入，不再位移。
5. 页面切换时 `page-transition-enter` 与 `.page` 的 `fadein` 冲突，移除 class 后整页二次淡入；`observeFadeIn` 又在 100ms 后把已显示面板强制隐藏再淡入。已删除重复过渡，改为按当前页作用域、同步执行的“仅隐藏首屏外元素”逻辑；`staggerList` 幂等，统计动画提前到首帧前。

### V2.3c 增量合并

- 只追加 V2.3c 的增量 CSS 覆盖（金色 token/SSR、稀有度圆点、水印、分布条、海报 SSR），不替换整份样式。
- 海报使用共享 `posterHighlightHTML()`：动态卡片/卡集数据、`poster-setinfo`、SSR shine；保留 `openPoster/memorial/card` 与现有 `#posterModal`。
- `setupDrawPage()` 同步 `#d-watermark` 的文案/class；`RARC.SSR` / `LINING.SSR` 改为金色。
- 新增 dev-only `page-demo` 与 devbar「组件总览」，不加入 `TABS`，不影响主流程。
- V2.3c 规则同步（2026-11-13）：付费集单次免费试抽（不占每日额度）、上架至少 8 张完整、定价 0/6/12/19、满 ¥100 可提现、免费卡集平台激励 + 付费卡集 80% 分成、收藏集从剩余池随机取牌、解锁后立即送一张当日签。
- 「新用户·空态」隐藏创作者已上架卡集、草稿与审核中作品；切回「演示用户·有进度」恢复。
- 按最新 body 页面优化：抽卡页 `.envelope` 不再包含「抽」火漆 `.env-seal`；订阅页 header 使用默认 `.brand-row` 间距。
- 吸收最新脚本内容：更新两个同名卡集的词库/文案，新增 6 个卡集、6 位创作者和「生活 / 味觉 / 心理 / 自然」分类；原有卡集仍保留。封面标签使用截断文案以适配长标题。
- 未迁移：V2.3c 的静态路由/抽卡状态、硬编码海报数据、整份脚本/样式、把海报弹层放到 `.phone` 外的布局。V2.3b 备份在 `resources/day_small_things_v2_v2.3b.html`，V2.3c 原型参考在 `resources/day_small_things_v2_v2.3c.html`。

### 创作侧（V2.3b）

- 数据：`CRAFT.drafts` 存草稿、`CRAFT.reviewing` 存审核中；`AUTHORED` 为已上架作品源；`WORK.sets` 为当前演示数据。
- 创作中心由 `renderCraft()` 渲染到 `#craftBody`；零内容时回落到 `renderCraft()` 内的原空态文案。
- 编辑器：`openEdit()` / `renderEdit()`，字段存在 `ED`；`edField` / `edCardField` 等即时写回；`validateCraft()` 做五条校验。
- 上架：`tryPublish()` → `#checkModal` 或 `#pubModal` → `doPublish()` 进入 `CRAFT.reviewing`；`passReview()` 生成公开卡集并写入 `AUTHORED` / `WORK`。
- 收益：`renderIncome()` / `doWithdraw()`；创作者页：`openAuthor()` / `renderAuthor()`；关注状态在 `FOLLOW` 表。

上一版「拾笺」服务端抽卡实现（`geo/gacha_*`、`templates/gacha.html`、`static/gacha.*`）仍保留在仓库中，但当前页面未使用，仅作遗留参考。

技术栈：Flask 3.0 + python-dotenv + Waitress（生产）/ Flask 开发服务器（本地）。UI 文案与代码注释均为中文。

## 常用命令

```bash
# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 开发服务器（端口取 FLASK_PORT，本机默认 5001——macOS 上 5000 常被 AirPlay 占用）
python app.py

# 生产服务器（wsgi.py 是唯一生产入口，from app import app 链不可改动）
python wsgi.py                              # Waitress
gunicorn wsgi:app -w 4 -b 0.0.0.0:5000 --access-logfile logs/gunicorn_access.log --error-logfile logs/gunicorn_error.log
```

健康检查：`GET /health`（同 `/api/health`）。

## 架构

### 页面入口

- `app.py`：Flask 入口，负责配置、目录初始化、日志、请求日志、`/`、`/index.html`、`/health`、错误处理，并注册 `geo/` 中的 Blueprint。
- `/` 与 `/index.html` 使用 `send_from_directory(app.static_folder, 'day_small_things_v2.html')` 原样输出，**不经过 Jinja 渲染**，确保 HTML 不被改写。
- `static/day_small_things_v2.html`：当前实际呈现的 V2.3c 合并版产品页面（V2.3b 完整功能 + V2.3c 增量设计/动画/海报）。V2.3b 备份在 `resources/day_small_things_v2_v2.3b.html`，V2.3c 原型参考在 `resources/day_small_things_v2_v2.3c.html`；后续如需再改，先向用户确认。
- 顶部固定的实现：每个 `<section class="page">` 内新增 `.page-head`（`position: sticky; top: 0; z-index: 20; background: var(--paper)`），页面水平 padding 保留、顶部 padding 移入 `.page-head`；`.phone` / `.screen` 改为受限高度，使 `.screen` 成为内部滚动容器。
- `wsgi.py`：生产入口，只负责 `from app import app` 并用 Waitress/Gunicorn 提供服务。

### 遗留模块（当前未使用）

- `geo/gacha_data.py`：上一版「拾笺」的词笺目录、概率与保底常量。
- `geo/gacha_engine.py`：上一版玩家状态持久化与抽卡判定，状态落盘 `history/players/`。
- `geo/routes_gacha.py`：上一版 `/api/gacha/*` 接口。
- `templates/gacha.html`、`static/gacha.css`、`static/gacha.js`：上一版页面与交互。

### 配置与日志

- `.env`：本地实际配置，**已被 `.gitignore` 忽略，禁止提交**；`.env.example` 为变量清单模板。
- 运行配置：`FLASK_HOST` / `FLASK_PORT` / `FLASK_DEBUG` / `SECRET_KEY` / `SESSION_HOURS`。
- 日志：`app.py` 内置 `DailyGzipFileHandler`，按天分文件（`logs/app-YYYYMMDD.log`、`error-`、`access-`、`audit-`），7 天前自动压缩。
- 数据库与第三方平台密钥均为空占位，按需填写；密钥只放 `.env`，不写进代码。

## 约定

- `static/day_small_things_v2.html` 当前为 V2.3c 合并版：暖橙多彩视觉 + 金色 SSR + 动画高亮海报 + 组件总览，保留全部 V2.3b 产品功能。不要擅自重构、加功能或再次替换视觉；后续如需再改，先向用户确认。
- 页面为纯前端原型，交互与数据都在该 HTML 内；不要把页面数据接到后端，除非用户明确要求。
- 验证改动时使用浏览器打开 `/`，确认页面标题为「今日做点小事 · 原型 V2.3c」、四个 Tab、创作中心、组件总览与原型控制台正常。
- 新增 Python 依赖时同步更新 `requirements.txt`（当前为精简版：Flask / python-dotenv / waitress / requests）。
- 对外接口统一 `/api/` 前缀；API 404/500 返回 JSON。
