# 决策日志（当天记，不补记）

| # | 日期 | 决策 | 理由 |
|---|---|---|---|
| D001 | D1 | 后端冻结，前端单方定契约 | 排期约束；靠容差条款+适配器防返工 |
| D002 | D1 | 单开发+Claude 任务卡制 | 每卡小 diff，人负责走查/真机/决策 |
| D003 | D1 | 抽卡动画在 api 返回后播；请求延迟藏进拆信封 920ms | 弱网不白屏 |
| D004 | D1 | 「今日已抽」用 result:'already' 表达，不用错误码 | 是合法状态不是异常 |
| D005 | D1 | 草稿本地存，submit 才上服务端 | 降低写频率，匹配现有交互 |
| D006 | D1 | mock 带 storage 持久化+失败注入+时间旅行 | 演示可用性 + 三态可测 |
| D007 | D1 | D1 内容安全仅占位（saveStamp.sec=pass / addComment=visible） | 影子后端先保契约形状，D2 接 utils/security.js 与 SEC_PENDING/SEC_REJECTED |
| D008 | D1 | draw 幂等缓存进 store 持久化；travel 同时重置今日态与 lastDrawDate | 重启后同 requestId 仍幂等；验收 ③ 跨天必须可复现 |
| D009 | D2 | draw 响应增加 weekGoal（含 justFull） | 跨卡集聚合只有服务端能判定；容差条款允许新增可选字段 |
| D010 | D2 | 抽卡失败重试复用同一 requestId | 覆盖「服务端已处理但响应丢失」：重放返回同一张卡，不丢不重 |
| D011 | D2 | 首抽订阅引导改本地标记 dsm_has_drawn | UI 引导非权威数据，不值得加接口字段 |
| D012 | D2 | SetPayload 增加 subscribed 标记 | 未订阅集的 progress 默认对象不能误判为订阅，否则列表/订阅页计数全错 |
| D013 | D3 | S 迁全局单例，页面 this.S = 引用赋值 | 多页实例共享状态；200+ 处 this.S 调用零改动 |
| D014 | D3 | 子页暂留 hub（pages/index），D4/D5 独立 | 单日风险控制；分享路径 pages/index/index?sid 天然兼容 |
| D015 | D3 | 订阅页锁定行 tap → set 页而非直接付费墙 | cards 页无 pay modal；set 页上下文更完整 |
| D016 | D3 | likes/liked 进 SetPayload（可选） | 列表直出；_socialOf 降级为显示缓存兜底 |
| D017 | D4 | set/draw 独立成页；分享路径改 /pages/set/index?sid=N 直达 | 深链免 hub 闪跳；物理返回替代 cameFrom 逻辑 |
| D018 | D4 | set 页用原生导航栏；subhead 删除；分享按钮并入 sp-social 行 | 遵循"子页原生导航"原则；转发入口不丢失 |
| D019 | D4 | renderXxx 按 __page 守卫 + __renderSelf 分发 | 清 D3 空转债；跨页 setData 不再污染 |
| D020 | D4 | income 数据层 api 化；S.incomeData 为快照缓存 | fans 债务移 D5；收益以服务端为准 |
| D021 | D4 | 模板抽取 /templates/common.wxml，四页 import | 结束模板逐页拷贝 |
| D022 | D4 | doUnlock 在 draw 页原地续抽 | 修复"解锁后压第二个 draw 页"栈 bug |
| D023 | D4 | data.page 判定迁移至 __page（全量审计） | 页面实例化后 data.page 失去全局含义，仅 hub 保留 |
| D024 | D4 | 提现到账按钮接 __apiDebug.arrive() | 演示能力不进契约；D6 随 demo 删除 |
| D025 | D5 | 草稿持久化本地 storage（dsm_drafts_v1），600ms 防抖 + onUnload flush | 契约 D005 落地：草稿仅存客户端 |
| D026 | D5 | demo 页独立保留至 D6（D5-D6 调试仍需原型控制台） | 避免调试能力真空 |
| D027 | D5 | remind 深链落点改为 cards 页 onLoad | hub 删除后的归宿 |
| D028 | D5 | 收益 fallback 改「收益同步中」占位，删除本地 ownEarn 计算 | 单一权威源 |
| D029 | D5 | 弹层拷贝扩散（poster×5/bigCard×4/record×4/dp×3）→ D6 用 include 收敛 | include 文本包含，绑定解析于宿主页，天然可复用 |
| D030 | D5 | edit 页无 api 依赖不 ensureBoot；demo 仅启动 ensureBoot 兜底 | 离线可编辑草稿，demo 仍能取原型数据 |
| D031 | D6 | saveStamp 补迁 api（D2-D5 漏网） | 去掉 Security.stampCreate 首路径，api.uploadImage + api.saveStamp 单一写回；盖戳持久化、getFeed 消“等你回信”、sec 不再恒 pending 误拦海报 |
| D032 | D6 | 弹层三组 include（m-base/m-flow/m-set）；rules/remind/craft 三件留页内 | 按复用度切分；m-flow 含 template 调用，宿主页必须 import common |
| D033 | D6 | DEBUG 开关压制 __apiDebug；提审 checklist 双开关 | 演示后门不进生产 |
| D034 | D6 | renderDone 守卫扩至 cards；tapSubsRow 补 booklet 直达 | m-flow 携带 dp 后，cards「已集齐」行路径补全 |
| D035 | D6 | 草稿首启种子移除，新用户见真实空态 | 生产首跑体验 |
| D036 | D6 | CSS 清扫 = 确认清单 + 动态类白名单，存疑保留；.sub-tail 在用，例外保留 | hover-class/JS 拼接类易误删，宁可漏删不可错删 |
| D037 | D7 | 字号 token xs/sm/base 各 +1px；硬编码小字地板：文本 11 / 徽章 10 / 装饰印戳 8 | 原体系按桌面预览标定，真机实测偏小 |
| D038 | D7 | --ink-3 与基础块 --text-tertiary → #8E8E93；5 处意义承载文案升 secondary | 对齐 AA 精神；--text-disabled 有意保留弱化 |
| D039 | D7 | posterKit 唯一豁免：colors.js ink3 '#A69C8F'→'#7E7469' | 设计 token 对齐（暖灰加深保色相）；尺寸类仍冻结至 D9 |
| D040 | D7 | 收集模块重构：est 去重复数字；邮戳/试抽改双列紧凑行；删 stamp-progress/trial-progress | 三条全宽 track 是视觉噪音源 |
| D041 | D7 | 详情页 intro 去盒子化，creator 独立成卡 | 呼应 V2.7 注释里“阅读页去盒子化”的方向 |
| D042 | D7 | 信封动画：本机首抽 920ms 完整，此后 fast 档 400ms + 轻触跳过；标记 dsm_env_seen | 仪式感保留一次，日常不罚老用户 |
| D043 | D7 | HM_SHOW_DAILY=false | daily 内容未就位，空分类是负体验；运营就位后置 true |
| D044 | D7 | renderSetPage 死数据清扫；sp v2.8 残留样式删除 | cells 保留——tapSetCell 依赖它索引；.sub-tail 例外保留；.rec-meta/.dp-next .rec-title/.stamp/.sp-pick-stamp/.weekly-916 .wc-word/.rules-n 等表外小字尺寸待查，未扩 diff |
| D045 | D8 | 首抽引导屏一次性（dsm_onboarded）；题眼首抽延迟到金色链播完再弹 | 仪式感不叠加 |
| D046 | D8 | 订阅改勾选式：draw 完成区常驻「明天提醒我」+ 设置页「提醒我明天的卡」；勾选/开启即在 tap 上下文调 requestSubscribeMessage | 一次性订阅的诚实 UI；替代 2 次硬弹 |
| D047 | D8 | dsm_remind_ts 记授权当日，跨天勾选复位；draw 勾选不可撤回（toast），设置页「关闭提醒」可停发（清 ts） | 授权即消耗；发送侧由 enabled 门槛控制（Phase 2 服务端） |
| D048 | D8 | _maybeAskRemind / dsm_has_drawn / remind.asked 退场 | 引导职责移交勾选式 UI |
| D049 | D8 | track 封装（预支 D9，可顺延）：失败本地排队 ≤50，onLaunch flush | 埋点丢失率最小化，契约不变 |
| D050 | D9-R | 画布白：仅页面级背景 #FFFFFF（page/screen/滚动区/下拉露底）；--paper 白化；--paper-card/--surface* 全部保留原值 | 用户修正：白色指大背景，非模块去色 |
| D051 | D9-R | 撤销“色彩退到字与线”；chips 实心选中、橙底按钮、pastel 动态类、边框暖调均保留 | 模块色彩是产品性格，不随画布白退场 |
| D052 | D9-R | 撤销海报白化；posterKit colors 底色保持原值 | 海报为导出物，不在“滑动背景”指令范围；纸感是明信片身份 |
| D053 | D9-R | 仅新增 --paper 画布别名并让 --paper-page 引用；双 token 块全量合并不做，D9 原 D053 暂挂 | 收敛本次 diff 到画布级 |
| D054 | D9-R | 回滚记录：D9 初版第三步未动工，无模块层回滚；净改动仅 app.json + 画布 token 命名 | 修订可追溯 |
| D055 | D9-R | D9 原第二步/第四步/第五步（单字体 / iOS visibleSet / TMPL 条件项）暂挂 | 待 D9 原卡；本次只做 D9-R 画布 patch |
| D056 | V1 | 视觉重构日豁免铁律2（类名可改），事件绑定名一律不变 | 结构重画与逻辑冻结的边界 |
| D057 | V1 | 题眼卡：竖排词 + 墨外框/金内框 + 金印 | 收藏等级语言 |
| D058 | V1 | 纯牛皮素信封；火漆为纸面上唯一暖色（它是按钮） | 用户拍板②；色彩纪律1的例外条款 |
| D059 | V1 | 价格贴纸移至详情页 hero；封面无价 | 用户拍板③ |
| D060 | V1 | 纸纹=CSS 织纹 --weave；噪点 PNG 方案否决（不可压缩） | 包体纪律 |
| D061 | V1 | 全纸品 ISO √2 比例；卡模板以 --cw/--ch 缩放服务多尺寸 | 单一模板，bigCard 复用 |
| D062 | V1 | 单色印刷：卡面一切颜色经 --ink/--ink-line/--ink-faint（分类墨派生） | 活版印刷的"一墨到底" |
| D063 | V1 | 墨色系统：6 墨 × CAT_INK 映射 10 分类 | 印刷油墨感，非 UI 色板 |
| D064 | V1 | posterKit 内迷你卡样式与新卡面不一致 → 债务登记 Phase 2 | 海报冻结区不轻动 |
