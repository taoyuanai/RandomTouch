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
