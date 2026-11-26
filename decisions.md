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
| D065 | V2 | 编号系统 COLLECTION No.{id 补零}；全局唯一、不可变 | 50 集从商品列表变发行物序列；id 即发行序 |
| D066 | V2 | 封面 tint 按 set.id % 3 三档微差 | 同分类并排不成"复制粘贴" |
| D067 | V2 | 价格贴纸仅详情 hero；免费集无；iOS 过滤下不露馅 | 拍板③落点 |
| D068 | V2 | 看全图 = 版票（齿孔缝隙 + 空票不透词 + 小邮戳态） | 集邮册隐喻落地；「等你回信」联动 |
| D069 | V2 | map 已集票放大格（105×148）复用 cardFront 模板 --cw:105 | 一套卡面语言贯穿全端 |
| D070 | V3 | 卡背双态：photoMode 由 rec.img 自动派生（态B照片/态A信纸），历史记录零迁移 | 版式跟内容走，不迁就版式 |
| D071 | V3 | 态B：照片52%卡高+白衬边+邮戳盖图（白底92%）；态A：来信/回信+❦分界，票位仅未盖戳时出现 | 用户拍板①②③ |
| D072 | V3 | note 不加「」括号，逐字呈现 | 用户内容保持原貌；两态的位置与浓淡已足够区隔官方/用户声部 |
| D073 | V3 | ❦ 字形双端验证；异常则换 ✦（一字改动） | 装饰符跨端风险 |
| D074 | C1 | 九大类目定版（序即 chips 序：美食/工作/城市/情绪/生活/关系/灵感/走走/知识）；chips 动态隐藏空类目 | 用户 62 集规划表；空分类不进体验层 |
| D075 | C1 | 墨色映射 9→6，三组同墨为有意系统：赭（美食/走走）、松烟（工作/知识）、靛（城市/灵感） | 同墨组气质同族；分类内再靠 V2 tint 三档微差 |
| D076 | C1 | 新手位=NEWBIE_SET_ID（生活·今日做点小事）；当前 seed 采用 id17 | 保留 id1「醒来」与锚点 14/11；新集 id17 |
| D077 | C1 | set.disclaimer 可选字段；仅详情页 intro 下一行小字渲染 | 知识类（律师案例/心理防御）T1 配套；卡背不放 |
| D078 | C1 | daily 分类整体退役（D040 开关、HM_CAT_DAILY、常量） | 九类图景下无位置；代码零残留 |
| D079 | C1 | docs/content-map.md 建立：62 集×（类目/波次/备注）全量表 | 运营灌入唯一对照物；今日做点小事当前 id17 |
| D080 | C1 | 现网集全量打标迁移至九类；旧 cat key 清零；dsm_cur_set 持久化当前集 | sid 体系不动，锚点 14/11 不漂移；杀进程不回弹新手位 |
| D081 | 第二批 | 卡面词上限从 8 字放宽到 24 字，与 w4/w5 长句渲染一致；编辑器 maxlength 同步 24 | 内容库已有 18–24 字卡面，旧 8 字校验会自相矛盾 |
| D082 | 第二批 | 卡集订阅 = subscribeSet 创建零进度 user；不自动抽、不解锁；暂不做取消订阅 | 订阅页需有主动入口，抽卡仍是自动订阅 |
| D083 | 第二批 | QR 回流 = cloudfunctions/qrcode 生成小程序码；CLOUD_ENV 未配置时界面用「搜一搜」兜底，posterKit 不改 | QR 必须服务端生成，不能在前端伪造 |
| D084 | P2 后端 | 自建后端：单台腾讯云轻量服务器跑 Node API + MySQL + Redis；图片走 COS，读取不经服务器 | 成本大头是图片流量；结构数据量小 |
| D085 | P2 后端 | 登录：wx.login code → 服务端 jscode2session → JWT；AppSecret 只存服务器 .env | 契约 auth() 不变，适配在 real/index.js |
| D086 | P2 后端 | 不做保底/权重：collect 在未收集卡里均匀随机，resident 全池均匀随机 | 与现行产品一致，不新增玩法 |
| D087 | P2 后端 | SetPayload.count 统一为 set_cards 行数（pool.length）；种子 count>pool 的历史数据待运营修 | 完成判定只能基于实际卡池，否则永远抽不空 |
| D088 | P2 后端 | uploadImage v1 = 小程序 multipart 上传到 API → 服务端写 COS → 返回 object key；rec.img 为 COS URL | 先跑通全链路；后续可换 STS 直传，只改 real/index.js 与 /upload |
| D089 | P2 后端 | 评论 time 由服务端生成展示串（今天/昨天/MM-DD HH:mm），同时保留 created_ts | 客户端直接显示 time；契约 ts 另存，记入偏离日志 |
| D090 | P2 后端 | 测试环境：系统账号 rt-test、目录 /data/project/RandomTouch/test、库 randomtouch_test、Redis db1 前缀 rt:test: | 生产复用同一脚本换参数 |
| D091 | P2 后端 | Redis 只做幂等快路径/缓存/锁；正确性以 MySQL 事务 + draw_requests 唯一键为准 | Redis 故障不影响抽卡正确性 |
| D092 | P2 后端 | 幂等以 (user_id, request_id) 为主键落库；同 requestId 重放返回同一结果且 result='already' | 覆盖「服务端已处理但响应丢失」 |
| D093 | P2 后端 | unlock / withdraw v1 仍为模拟支付（契约定义）；正式收款必须改为支付回调驱动 | 避免把「模拟成功」误当真实收款上线 |
| D094 | P2 后端 | 平台分成只归属运营账号（app_config.platform_creator_id = 演示创作者），不发给每个创作者 | 收益口径正确；测试环境仍保持演示数据 |
| D095 | P2 后端 | 评论新增 status 映射：内容安全 pass→visible，pending→pending，risky→拒绝 | 安全状态与留言可见性解耦 |
| D096 | P2 后端 | 图片异步审核回调 v1 未实现：sec.media 先落 pending；正式环境需补公网回调或轮询 | 私有邮戳 fail-open，不阻塞主流程；上线前补齐 |
| D097 | P2 后端 | `tools/validate-content.js` 仍校验卡面 `w<=8`，与 D081 的 24 字不一致；本次不改 | 待内容工具统一时修正；后端不做该校验 |
| D098 | P2 后端 | 测试机为 CentOS 7（glibc 2.17）：Node 20 改用 glibc-217 构建装到 `/opt/node20`；包管理用 yum + EPEL；systemd 219 用 shell 重定向写日志；schema/seed 改由 Node mysql2 执行 | 官方 Node 20 需 glibc≥2.28；EL7 自带旧 mysql 客户端可能不支持 MySQL 8 认证插件 |
| D099 | V4 | 抽卡页卡本位：信封退役；统一卡背 + 满幅 5:7 印刷正面；`--dk-h` 进页锁高 | 用户拍板；卡是主角，信封叙事退场 |
| D100 | V4 | 题眼：收藏集固定最后一张（收官）；常驻集由数据侧 `isKeyEye` 标记（契约暂未含，先兼容可选字段） | 用户四点确认①；数据字段待后续补 |
| D101 | V4 | 回访态：今日已抽重进页面，正面朝上 -1deg 平放，不重播抽出/金印动画 | 用户四点确认② |
| D102 | V4 | 盖戳照片裁剪 4:3→3:4（批次②执行）；历史 4:3 图在满幅卡背以 cover 自动裁切 | 用户确认③；cover 不破版 |
| D103 | V4 | 例外记录：卡面字档改用 `--dk-h` 缩放（规则 19 的 `--cw/--ch` 例外）；分类墨经内联 `--ink` 注入 | 新卡架构由用户给定；保持 D062 一墨到底 |
| D104 | V4 | `is-drawn` 隐藏动作区，轻触卡面翻面；翻面后轻触卡面开大卡，补回被移除的「看看今天的卡」入口 | 避免「抽今日一签」重复触发；保留看大卡路径 |
| D105 | V4 | 抽卡最小节奏 360ms；满幅卡去左右内边距，提示/动作/回响/推荐各自补 24px | 信封 920/400ms 随退役删除；防文案贴边 |
| D106 | V4 | 付费墙金封条使用哑金渐变（规则 18 的例外：视作金属封印） | 用户给定卡本位封条方案；金只出现在卡面题眼/集齐/封条三处 |
| D107 | V4② | 盖戳页沿用共享 modal 满幅化（不新建页面）；cards 页打开时 hideTabBar、关闭时 showTabBar | 小 diff；原生导航栏无法被页面元素覆盖，set/cards/map 以页面视口为满幅边界 |
| D108 | V4② | 盖戳状态类改为 `is-empty/is-photo/is-stamped`；`.st-photo` 只给图片、`.st-empty` 只给无图 fallback | 原方案状态类与子元素类同名会互相污染 |
| D109 | V4② | `.st-page` 以 `inset:0` 填满 modal；铭牌/钢印/关闭仍按 `--navtop` 下移 | 避免 draw 自定义导航下 `100vh-navtop` 产生空带/双重偏移 |
| D110 | V4② | 保留纯文字盖戳：st-empty 提供「拍一张今天 / 只写一句」；新增关闭 ×（铭牌右移让位）、点图换图、× 移除照片；纸条上移至 140px 避让双按钮 | 不丢旧产品能力；st-stamped 只读 |
| D111 | V4② | 保存后停留 st-stamped，stampIn 380ms 落印；「收进册子」关闭返回，分享接既有 openPoster | 用户拍板三态；分享视觉统一留待下批 |
| D112 | V4② | 常驻集不做 st-stamped（可多次盖戳）；仅收藏集已有记录时进页直显已盖 | 与 resident 多记录语义一致 |
| D113 | V4② | 解锁封条后严格回 is-idle，不自动续抽；visited 未盖 CTA 文案改「去盖邮戳」，翻面后仍为「印上今天」 | 对齐九态回归表 |
| D114 | V4② | 稀有度清理：chip tone `blossom`→`rose`；chip 渐变内联实色；`--rar-*` 映射改字面量；posterKit 内 `rar*`/drawRarityBar 因铁律 4 冻结 | 保证 home chips 不破；Canvas 清理待单独授权 |
| D115 | V4② | 信封 CSS 剪切至末尾 ARCHIVE 注释段（本批仅归档，彩蛋实现待后续）；先剥离块内注释；`.cf.k` 金框链归档，小卡题眼仅保留金印 `.cf.sig-stamp` | 避免注释提前闭合；bigCard/map 小卡金框改由金印承担 |
| D116 | V4② | 盖戳照片裁剪 4:3→3:4（JS 1 处 + WXSS 4 处）；历史 4:3 图由 aspectFill/cover 自动填充 | 用户确认③ |
| D117 | V4② | 盖戳日期统一取 YYYY.MM.DD（mock 的 dateText / real 的 stampDate 哪个是长格式取哪个）；`.card-face.front::after` 顶条改 `--ink-line` | 避免出现 "11-23" 短日期与橙色顶条（规则 18） |
| D118 | V5 | 对比度 token：`--ink-3:#77777D`、`--orange-700:#CC4A24`；`ink-4` 仅限 disabled/占位/装饰线 | 一处别名层修复 80% 文本对比度 |
| D119 | V5 | 按压统一：删除全部 `:active` 与散落 `-press` 旧规则，改为“下沉 1px + opacity .86”单套 `-press` | 小程序真机 `:active` 基本不生效；印刷物是压下去不是缩下去 |
| D120 | V5 | token 终版：暖灰 paper-deep / 暖黑阴影；z-index 收敛为 `--z-*` 阶梯（dp 100 > poster 90 > modal 80 > tabbar 50，toast 140） | 冷灰/中性黑与暖纸并置发灰；13 个散值收敛 |
| D121 | V5 | 字号归位：stat/hero/dp/m916/h916/weekly 数字与标题改用 `--num-*` / `--text-*`；h916 bw-6/7 同步 | 22–49px 显示字号走同一梯度 |
| D122 | V5 | 金底按钮改深金渐变 + 米白字；`.dk-bk-sub/date` 改 ink-2 且 opacity 1 | 金底白字 2.3:1 → 最深端 6.8:1；卡背日期可读 |
| D123 | V5 | 兼容兜底：aspect-ratio / clip-path 的 `@supports` fallback；mask/backdrop 依赖既有纯色底 | 低端安卓不破版 |
| D124 | V5 | 文件拆分（tokens/base/comp/pages/motion/archive）暂缓，回归稳定后单独排期 | 本批只做覆盖层，避免大 diff |
| D125 | 运维 | 真机加载失败：`API_BASE` 为 `http://IP`，微信真机禁止 HTTP/IP 请求；临时 `USE_MOCK=true` 保证 UI 可回归，boot 失败页补 HTTPS 提示 | 远端服务健康（/healthz、/sets 已验证）；恢复远端需 HTTPS 域名 + request 合法域名白名单 |
| D126 | V6 | 视觉方向定为 Demo 的冷灰橙白换皮：覆盖 V2.7/V5 暖纸语义；旧纸品/哑金让位，回归通过后归档旧视觉层 | 用户六点确认① |
| D127 | V6 | 底部导航改自定义 `custom-tab-bar`（Demo 线框图标 + 毛玻璃）；原生 tabBar 仅保留 list 兜底 | 用户确认②；原生 tabBar 无法还原毛玻璃与线框图标 |
| D128 | V6 | 封面采用 Demo 几何 `cover-art`（sun/arch/blocks/orbit/wave 五变体）；9 分类映射，`coverImage` 优先 | 用户确认③ |
| D129 | V6 | V4 纸品/钢印语言让位白底橙卡；抽卡/盖戳的状态机与交互保留 | 用户确认④ |
| D130 | V6 | 新建 lucide 风格 SVG→PNG 图标资产（`assets/icons/v6/`），墨色/品牌/灰色三档 | 用户确认⑤ |
| D131 | V6 | 范围扩至 categories/map/author/海报；posterKit Canvas 改动需单独授权（铁律 4） | 用户确认⑥ |
| D132 | V6 | 兼容转换：oklch→hex、dvh→vh、backdrop 纯色兜底；装饰小字除外，信息字不低于 12px | 小程序 WebView 与可读性约束 |
| D133 | V6 | V6-2b/3：home/search/categories 改自定义导航；首页头部按 Demo 用「卡集」wordmark + 搜索；九分类保留，首 chip 改「推荐」；首页移除热门/最新切换，保留分类索引入口 | 用户要求完全还原 Demo；九分类不能退化为五类，排序入口暂由数据默认 hot |
| D134 | V6 | V6-4：cards/set/map/author 改自定义导航；收藏册采用 Demo 三 tab（订阅中/已收集/盖戳记录）；详情页换几何封面 hero；全图改 4 列卡格；作者页换封面作品行 | 用户确认全量换皮；保留九分类、题眼/进度/互动等业务能力 |
| D135 | V6 | V6-5：抽卡页改 5:7 小卡（橙背 / 白词面 / 解读面），保留 idle/drawn/flipped/visited/sealed 状态机；盖戳页改 Demo 卡片版式（照片 banner + 纸条 + 日期章），裁剪仍 3:4 | 用户确认 V4 纸品/钢印让位；状态机与盖戳能力不变 |
| D136 | V6 | V6-6：create/me/income/edit 改自定义导航；创作中心与我的页复用收藏册组件；新增每日提醒 sheet；pay/comments/rules/stats 弹层统一 V6；poster/share sheet 留待海报批 | 用户确认全量换皮；12 页全部改 custom 导航，4 tab 由 custom-tab-bar 承载 |
| D137 | V6 | posterKit Canvas 仍冻结（铁律 4）；分享弹层外层可 V6，但海报画布金色/墨色未同步，待单独授权 | 避免本轮触碰 Canvas 内部 |
| D138 | V6 | V6-7：分享海报 sheet 外层 V6（卡片/比例/按钮），Canvas 输出保持原样；V2.7/V4/V5 旧视觉层暂留作回滚安全网，真机回归后再物理归档 | 海报是可打印物，Canvas 换色需单独授权；先保证外壳一致 |
| D139 | V6 | V6-8：大卡弹层改 5:7 白卡（词面 / 解读面 + 已盖戳纸条），收藏册统计卡改 V6 迷你卡；删除 card.wxml 旧 V1 POST CARD 模板 | 用户指出大卡仍回退旧纸品卡；旧模板已无引用 |
| D140 | V6 | 全图格子：已抽索引合并 got/todayIdx/drawnLog，按 count 生成格子；新增「最近抽到」条与已抽格橙色底 | 修复「1/30 已抽到但全图全空」 |
| D141 | V6 | 用户授权修改 posterKit：colors.js 切 V6 冷灰橙白，衬线统一回退系统无衬线；题眼/集齐哑金映射品牌橙；海报预览 sig 顶条同步橙色；Canvas 布局/导出流不变 | 铁律 4 的显式例外；只换色与字体，不改版面与导出参数 |
| D142 | V6 | 「我的」头像支持相册/拍照选择，压缩后本地保存（wx.saveFile + dsm_me_avatar）；本人作者页同步展示；当前无用户资料接口，暂不上传后端 | 用户要求可上传头像；本地保存先保证可见与跨启动，接资料接口后再换远程 URL |
| D143 | V6 | 单卡分享海报改为「海报框 + 中央分享卡」：无照片时卡上半为词（居中）、下半解签；有照片时卡上半为照片、下半解签/回信；日期钢戳压卡右上；预览与 Canvas 同构 | 用户要求图一版式，并按有无照片分流；3:4 与 9:16 共用 drawCard |
| D144 | V6 | 分享海报预览重写为 v6-poster；比例切换对 highlight 始终可见；stampText/wordCls 加入 buildHighlightData，预览/导出共用 | 旧 poster-h916/poster-highlight 分支不再用于单卡分享 |
| D145 | V6 | 分享卡 No. 从视觉区右上移到卡底 meta 行（左 @作者 / 右 No.），避免与日期钢戳重叠；预览与 Canvas 同步 | 用户指出 No.08/08 与盖章冲突 |
| D146 | V6 | 大卡翻面：已上传照片时改为「照片上半 + 解签/回信/作者下半」，照片不再只做小缩略图；无照片仍保留词 + 解签面 | 用户指出大卡背面看不到照片，要求照片占上、文字占下 |
| D147 | V6 | 分享海报去重：保留卡底 @作者，页脚来源不再重复 @；保留大 CTA「扫码，抽你的一签」，删除小字 slogan「扫码抽一张」 | 用户指出 @ 与扫码文案各重复一次 |
| D148 | V6 | 卡集三处统一 meta：`fans` 进入 list payload（mock + server buildPayloads），applySetPayload 写入 S.fans；首页/搜索/详情/收藏册统一显示「作者 · N 订阅 · M 心动」；详情 refreshSetMeta 同步 fansShort/likesShort | 用户要求搜索、首页、收藏册与详情在真实数据上同源一致 |
| D149 | V6 | 盖戳记录卡的照片模块改为 3:4（aspect-ratio，含 @supports 回退），上传裁剪的 3:4 原图不再被压成横向 banner；隐藏照片仍用占位块 | 用户要求上传 3:4 照片保持原比例 |
| D150 | P0-4 | mock seed 的 count 统一改为 pool.length；store 加载时纠正历史持久化快照；draw 增加池空 completed 保护；新增 tools/validate-seed.js 与 validate-content 的 count==pool 校验 | 直接修复“5/40 抽第 6 张崩溃”；7 个演示集 pool<8 仍作为内容待补警告 |
| D151 | P0-1A | 订阅/关注拆分：`fans` 只表示作者关注者；新增 per-set `subscribers`（当前=有 user_set_progress 的订阅人数），首页/搜索/收藏册/详情统一显示「作者 · N 订阅 · M 心动」；作者页/创作页继续显示关注者 | 用户确认“订阅数”=卡集订阅人数，不是作者关注数 |
| D152 | P0-1B | 取消订阅：产品确认支持；需把订阅状态与抽卡进度拆开，取消后保留已抽卡/邮戳；在 P0-1B 实现前，「已订阅」仍是跳转，不是真正取消 | 当前 `user_set_progress` 同时承担订阅与进度，不能直接删行 |
| D153 | P0-6 | 付费卡集上线；价格档改为 0.9 / 1.9 / 2.9 / 3.9，最高不超过 5.9；支付仍需真实微信支付，不在 P0-1A 内改价 | 避免只改价格选项而未接支付，形成假付费 |
| D154 | P0-1B | 取消订阅与进度拆分：`user_set_progress` 增加 `subscribed` 标记（默认 1，旧库由 run-schema 迁移）；取消只置 0，保留 progress/cards/stamps；抽卡/解锁/订阅自动置 1；feed 仅在订阅中/今日展示 active，已集齐的取消集保留在「已收集」并标注；详情可重新订阅 | 用户确认支持取消订阅且保留收集；服务端仍以 progress 行为进度事实源 |
| D155 | P0-3 | 当前用户资料：新增 `GET /me`，客户端 `S.me` + `applyMe`；卡集 own 一律读 `s.own`；作者页 own 读 `d.own`；评论/我的/创作/作者/抽卡/订阅/关注/推荐改用当前用户；mock 以“打工人小王”兜底；头像优先本地、其次资料 URL | 去掉真实多用户下对 `ME` 常量的业务判断；头像/昵称编辑与后端同步仍属 P1 |
| D156 | P0-3 | `/me` 同时返回 `creatorName`（creators.user_id 对应的作者名）；`S.me` 区分昵称与作者名；作者页/创作页/粉丝 key 使用 creatorName，评论/我的页使用 nickname | 真实多用户下昵称与作者名可能不同，不能再用单一 ME 字符串 |
| D157 | P0-2 | COS 私有化：新上传对象 ACL=private；DB 只存 key；setPayload/stamp/craft/qr//me 统一返回短期签名 URL（COS_URL_EXPIRE，内存缓存）；stamp/craft 校验 key 归属；客户端封面上传只回传 key；新增 `npm run cos:private` 清理历史 public-read 对象 | 用户图片不能再公开直读；小程序需把 COS 域名加入 downloadFile 合法域名 |
| D158 | P0-5 | 发布配置收敛：`RELEASE` 闸门 + `releaseErrors` + `tools/release-check.js`；DEBUG 固定 false；RELEASE_API_BASE 保留占位；发布 checklist 覆盖微信域名、TMPL_IDS、HTTPS、COS 私有、schema 迁移；当前仍 RELEASE=false / Mock | 真实 HTTPS 域名与模板 ID 未提供，先落闸门，避免误提审 |
| D159 | P0-6A | 定价档落地：0 / 0.9 / 1.9 / 2.9 / 3.9 / 5.9；旧演示价 6/12/19 分别迁移为 1.9/3.9/5.9；客户端编辑器/服务端 craft/validate-content/validate-seed 同步；新增 db:prices 迁移脚本 | 用户确认付费集上线及价格档；真实支付仍属 P0-6B |
| D160 | P0-6 | 发布闸门新增 `PAYMENT_READY=false`；当前 unlock 仍是模拟支付，PAYMENT_READY=true 前 release-check 不允许通过 | 防止误把模拟解锁当真实支付上线 |
| D161 | P1-1 | shared 拆分：`lib/shared/base.js` 保存 PAGE_OPTS，`overrides.js` / `d4.js` / `d5.js` 分阶段覆盖，`index.js` 只做 createPage 合成，`lib/shared.js` 变为兼容 re-export；删除 33 个完全被覆盖的基础/overrides 方法、旧 tabs 数据、weekProgress/daysAbsent/S.activity 死链路 | 降低覆盖层阅读成本；页面 require 路径保持不变 |
| D162 | P1-2 | app.wxss 拆为 styles/base / legacy / v6 / archive 四层入口；删除 304 个已无 WXML/JS 引用的死规则（cf/cw、hb、srch、ie/wr、sp、me、cat、sb2、tabbar、旧 highlight 海报等），保留 `sp-social-press` 与 `sb2-go/sb2-chev` 等活类；页面 require/类名不变 | 样式覆盖顺序不变；页面级样式拆分仍未做 |
| D163 | P1-2b | 页面级样式下沉第一刀：全图 / 作者 / 收益页的 V6 专属样式移入各自 `pages/*/index.wxss`；共享原语、create 复用的 `v6-income-entry` 仍留全局 | 页面 wxss 开始承载页面样式；其余页面后续按同一方式迁移 |
| D164 | P1-2b | 页面专属 V6 样式全部下沉到 `pages/*/index.wxss`（home/search/categories/cards/create/me/edit/set/draw，加此前 map/author/income）；`styles/v6.wxss` 只保留共享原语与跨页规则，从约 713 行降到约 361 行；移除未用 v6-accent/sort/list-actions，并把精确 `.dw` 规则移入 draw | 页面仍可继承全局令牌/原语；legacy V2.7/V4/V5 仍全局 |
| D165 | P1-3a | 数据刷新并发收敛：`syncOnShow` 增加 15s TTL 与单飞 Promise；subs/income/author/craft/setMeta/refreshIncome 增加请求序号，只接受最新响应；不改变接口契约 | 降低切页/快速操作时旧响应覆盖新状态；summary/detail 拆分仍待 P1-3b |
| D166 | P1-3b | 列表摘要 + 详情按需：`listSets` 不再下发 `pool`，改下发 `poolText` 供搜索；客户端 `applySetPayload` 对摘要保留已加载详情，新增 `ensureSetDetail(sid)` 单飞去重；set/draw/map 页面及大卡/盖戳/统计/周记/海报/详情动作在缺详情时先 hydrate；feed/author/craft 仍走完整 payload | 列表响应显著变小；服务端摘要仍查询卡池生成搜索文本，feed/author/craft 全量载荷留待 P1-3c |
| D167 | P1-3c | feed / 作者 / 创作已上架也改为摘要：`buildPayloads` 增加 `{ summary, poolText }`，feed/author/craft 用 `{ summary:true, poolText:false }` 直接跳过卡池查询；客户端的列表/feed/作者/创作只依赖摘要字段，点进卡集仍由 `ensureSetDetail` hydrate；审核中草稿保持完整 pool | 列表/feed/作者/创作不再拉卡池；审核草稿仍全量；详情/抽卡/盖戳保持完整 |
| D168 | P1-4 | 海报数据/导出去重：周记唯一数据源收敛到 `posterKit.buildWeeklyData`，`weeklyState` 只做预览适配；`openWeekly` / `openWeeklyPoster` / `exportWeeklyById` / `savePoster` 复用同一份 data，不再各自重算；标题改为按 weekNo 稳定选择；修复 exportWeeklyById 的 noQR 未定义；删除 core 重复 weeklyTitle 与未用 imports。按任务授权修改 posterKit 内部（D141 延续） | 预览、3:4、9:16 标题/卡片/邮戳一致；highlight/memorial 原本已复用 S.posterExport |
| D169 | P1-5 | 测试/CI：新增根 package.json（node:test，无 npm 依赖）、tools/test harness + API 契约 / 页面渲染 / 海报 / 静态检查四组测试、.github/workflows/ci.yml；`npm test` 覆盖摘要/detail hydrate/12 页/weekly 预览导出/JS-WXML-WXSS；`npm run validate` 跑 seed 校验 | release-check 仍为手动提审闸门，不进 CI；seed 的 7 条 pool<8 警告保留 |
| D170 | P1-6a | 导航与 tabBar 去重：新增 `lib/nav.js` 统一 `metrics / cardStageH / syncTabBar`，经 `lib/shared.js` 暴露；12 页删除各自的状态栏、胶囊、tabBar selected 计算，页面仍只 require shared/core | 行为保持；组件级 set-row/cover 抽取留待 P1-6b |
| D171 | P1-6b | 卡集行结构去重：新增 `templates/set-row.wxml` 四个变体（public / cards / craft / author），home/search/author/create/cards 改为 template 调用；事件绑定名、dataset、全局/页面样式均保持不变 | WXML 结构单一来源；暂未升级为自定义组件，避免样式隔离与 slot 改造风险 |
| D172 | P2-1 | 图片上传收敛：新增 `lib/media.js`（compressImage 80、getFileInfo、5MB 上限，与服务端 uploadMaxBytes 对齐）；real 上传前统一 `prepareUpload`；封面/邮戳 chooseMedia 增加 sizeType compressed；压缩失败/API 缺失回退原图 | 降低上传失败与流量；mock 仍原路径 |
| D173 | P2-2 | 全局兜底：App 增加 onError / onUnhandledRejection（tracker 记录，失败静默）与 onPageNotFound（回首页 tab）；测试覆盖 hook 注册与 404 路由 | 不改变页面生命周期；tracker 失败不影响启动 |
| D174 | P2-3 | API 重试：real 层 GET 遇 retryable 错误重试一次（400ms）；写请求（draw/stamp/unlock/submit 等）不自动重试，避免重复副作用；测试覆盖 GET 重试、非 retryable、写请求不重试 | 只提升幂等读取的弱网成功率；写请求仍由页面/幂等键保证 |
| D175 | P1-2c | legacy CSS 归档第一刀：删除 146 条无 WXML/JS 引用的旧规则（hm-* 旧首页、dk-frame/dk-fr/dk-bk、dw-remind、bk-ph/polaroid、cm-*、creator/card-face/cinfo/cavatar、cover-sm 等），保留 hm-press；styles 总量进一步下降 | 仅删确认无引用的类；legacy 仍有约 1020 行，需真机视觉回归后再继续 |
| D176 | P2-4 | Mock 故障/边界测试补强：覆盖 setFailureRate 可复现失败与恢复、未知卡集/分类、draw 同 requestId 幂等、同日新 requestId 不重复、travel 跨天重置、取消订阅保留进度并可恢复、空池 draw=completed；beforeEach 重置 store | 测试直接使用 mock `_debug`，不依赖开发者工具 DEBUG；未改业务代码 |
| D177 | P2-5 | Mock 全页面三态自动化：新增 three-state 测试（boot 失败/重试、订阅/收益/作者 bootError 恢复、detail hydrate 失败重试、home/categories/search 空数据）；新增 docs/device-qa.md 真机三态与视觉清单。微信开发者工具 CLI 因服务端口关闭无法自动启动真机/模拟器回归 | 自动化部分已执行；真机视觉仍需人工扫码完成 |
| D178 | P1-6c | 卡集行升级为自定义组件 `components/set-row`：properties item/mode/groupName，内部 `rowtap` 事件，页面通过 host `bind:rowtap` + 原 dataset 处理；`styleIsolation: apply-shared` + `addGlobalClass` 复用全局 V6 样式；替代 P1-6b 的 WXML template | 组件化真正落地；需真机确认组件样式隔离与事件冒泡 |
| D179 | P1-1b | base.js 领域拆分：海报/周记方法移入 `lib/shared/mixins/poster.js`，发现/搜索/分类移入 `lib/shared/mixins/browse.js`，base 通过 Object.assign 组合；base 从 2866 行降至 2335 行 | 测试覆盖通过；详情/抽卡/编辑等域仍留在 base，可继续按域拆 |
| D180 | P1-1b / P1-6c / P2-5 | 本轮结构收敛：base.js 继续拆出 `mixins/craft.js`、`mixins/collection.js`（base 2866→1639 行）；新增 `components/v6-topbar` 覆盖 6 个原生导航页；set-row 改为 `rowtap` 自定义事件；mock 边界测试增至 60 个；性能审计脚本 `tools/audit-size.js` 生成 docs/performance-audit.md，pack 排除 tools/docs/.github/server 等；legacy CSS 再清 17 条 |
| D181 | fix | 修复小程序空白/编译失败：`styles/legacy.wxss` 遗留孤立 `*/`（CSS 清理时注释起始被并入规则），删除后 WXSS 可编译；静态测试新增 WXSS 注释闭合检查，防同类回归 | 日志定位：`styles/legacy.wxss(301:1): unexpected token *` |
| D182 | UI | 抽卡页已翻开后不再弹大卡：移除 `tapCard` 的 `showBigCard` 兜底，大卡层只保留给全图 / 收藏册 / 统计等小卡场景；抽卡页停留在「抽卡 → 翻开解读 → 盖戳/分享」 | 防止大卡套大卡；新增单测覆盖再次点击不弹层 |
| D183 | UI | 照片分享海报改为照片优先版式：3:4 照片全幅（3:4）+ 底部覆盖信息层；9:16 照片占上方 3:4 + 下方信息层；保留品牌/日期/题眼/钢戳/来源/QR；同步改 posterKit Canvas 与 m-flow 预览，不再把照片塞进 54% 横向区域 | 文字卡仍用原卡片版式；用户确认照片海报需更像盖戳记录页的全幅照片布局 |
| D184 | UI | 海报日期收敛：删除顶栏白色「11月25日」，只保留黑色墨印戳日期；墨印戳移到顶栏右侧与「✦ 今日做点小事」同高（3:4 / 9:16 分别对齐）；照片版墨印戳加白色纸底保证照片上可读；卡面内不再重复钢戳 | 一张海报只出现一个日期；保留邮戳产品身份 |
| D185 | UI | 抽卡页点卡双向翻面：已抽到后 tapCard 在关键词面 / 解读面之间切换，stateCls 在 is-drawn / is-flipped 间切换；不再只单向翻开，也不弹大卡 | 卡片改为可逆翻面；底部盖戳/分享动作仍只在解读面出现 |
| D186 | UI | 抽卡页已抽到状态：分享 / 印上今天改为同一行（ghost 34% + 主按钮剩余宽度），压缩纵向动作区；卡堆固定 3 层，抽卡前后保持同一卡面视觉尺寸；仍保留双向翻面 | 卡面尺寸不随剩余张数变化；动作区更紧凑 |
| D187 | UI | 抽卡页已抽到即显示「分享 / 印上今天」：动作行在 is-drawn / is-flipped / is-visited 三态都可见；两按钮统一 48px 高、同一行、垂直对齐；卡堆固定 3 层保持抽卡前后卡面尺寸一致 | 不再需要先翻面才出现主动作 |
| D188 | UI | 抽卡页动作行对齐修复：legacy `.dw-btn + .dw-btn{margin-top:10px}` 在横向 flex 行中仍生效，覆盖为 `margin-top:0`；两按钮统一 48px 高并同一行 | 解决分享/印上今天一上一下；按钮在 is-drawn 起即显示 |
| D189 | UI | 盖戳页收敛：删掉「一句话或一张照片，都可以。」；照片/文字、注释输入、添加/更换/删除照片、0/50 计数全部合并进同一张卡；移除卡外重复的 photo-tools / 今天想留下什么 / 独立 textarea；卡面加宽、占位区加高；确认盖戳保留在卡下 | 减少重复文案和纵向表单；照片与文字共用卡内编辑区 |
| D190 | fix | 全图空白格修复：格子数不再只取 count，改为覆盖 `max(count, pool.length, maxGot+1)`；已抽索引必定有格子。另在 renderMap 摘要态先 ensureSetDetail，避免 pool=[] 时把已抽卡渲染成空词。 | 兼容历史 count<pool / 已抽 idx 越界；不会再用空 pool 渲染全图 |
| D191 | content | 下架 3 个卡集：id1「醒来觉得甚是爱你」、id4「律师朋友讲的三十个案例」、id12「睡前一首诗」；mock seed 更新为 16 集 / 161 卡，SEED_VERSION 升为 `2026-11-26-del1-4-12`；新增 `server/scripts/remove-sets.js`（需 `--yes`）清理生产库关联表；卡集汇总/核心文案/文案总览/content-map 同步更新 | 旧本地 mock 因版本号变化会重建；服务端旧库需手动跑 db:remove-sets |
| D192 | content | 更新 id15「便利店哲学」：cat 改为 life、type 保持 collect、count/pool 14 张；按给定顺序替换全部卡面和解签；covS/intro/signatureIdx 同步；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15`；新增 `server/scripts/update-convenience.js` 供旧库定向更新 | 当前 mock 16 集 / 167 卡；本地自动重建，旧服务端库需手动跑 update-convenience |
| D193 | content | 新增 id20「心情天气预报」：mood / collect / 28 张 / ¥0 / 随机；简介与 28 条卡面解签按运营文案写入；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20`；新增通用 `db:upsert-set -- --id=20 --yes` 供旧库定向写入 | 当前 mock 17 集 / 195 卡；本地自动重建，旧服务端库需手动 upsert-set |
| D194 | content | 新增 id21「动一动，意思意思」：walk / resident / ¥0 / 随机；简介写入；运营文案实际 21 条，按 21 张入库（用户原写 20，待确认是否删一条）；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20-21` | 当前 mock 18 集 / 216 卡；旧服务端库可 `db:upsert-set -- --id=21 --yes` |
| D195 | content | 新增 id22「今日随手拍命题」：muse / resident / 30 张 / ¥0 / 随机；第 4 条原解签为空，暂用「同样的东西排在一起，才看得出谁有一点不一样。」；#9 修正双句号，#22/#30 补句号；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20-21-22` | 当前 mock 19 集 / 246 卡；#4 文案待运营确认 |
| D196 | content | 更新 id9「办公室摸鱼图鉴」：work / collect / 30 张，按运营顺序替换全部卡面与解签；保持免费、创作者与热度；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20-21-22-upd9` | 当前 mock 19 集 / 269 卡；旧服务端库可 `db:upsert-set -- --id=9 --yes` |
| D197 | content | 更新 id19「故事开头盲盒」：新增第21张「你随口哼了句歌，街上的音响应了一句。/ 接着哼，看它跟到哪。」；count 20→21，covS/intro 同步为二十一签；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20-21-22-upd9-add19` | 当前 mock 19 集 / 270 卡；旧服务端库可 `db:upsert-set -- --id=19 --yes` |
| D199 | content | 更新 id14「云的图鉴」：walk / collect / 14 张；按运营顺序替换完整云种卡面；covS/intro 改为十四；SEED_VERSION 升为 `2026-11-26-del1-4-12-upd15-add20-21-22-upd9-add19-upd14` | 当前 mock 19 集 / 276 卡；旧服务端库可 `db:upsert-set -- --id=14 --yes` |
| D200 | UI | 抽卡 reveal 微动效 MVP：仅在 justDrawn 第一次抽到时触发 1.5s；默认 spark 星光，mood 分类显示 rainbow；右上角、pointer-events:none、不遮字；1.6s 后清理，页面 onUnload 清理定时器；加 prefers-reduced-motion 保护 | 先验证节奏与视觉，暂未扩展太阳/云/食物/猫球等更多变体 |
| D201 | UI | 抽卡 reveal 时长 1.5s→2.4s（清理 2.5s）；翻面后的解读面：TODAY'S CARD 顶部居中，中文关键词垂直居中，来源固定在底部，避免标题贴顶 | 小星光不遮字、节奏更完整；仅调整解读面 |
| D202 | UI | 抽卡解读面正文（解签）同步水平居中，与关键词形成同一中轴；来源仍固定底部 | 解决黑色正文左对齐产生的视觉偏轴 |
| D204 | content | 更新 id5「今天吃什么」：food / resident / 14 张；按运营顺序替换 11 条总纲卡 + 热馄饨/煲仔饭/咖喱三条金句位；来源列仅作运营标注，不进入卡面字段；covS/intro 同步十四；SEED_VERSION 升为 `...-upd5` | 当前 mock 19 集 / 285 卡；旧服务端库可 `db:upsert-set -- --id=5 --yes` |
| D205 | UI | 首页发现页收敛：删除日期行「11月26日 · 星期四」；今日一卡色块 min-height 188→150，padding/标题/按钮/几何圆环等比缩小，保持圆形不变形；标题 34→28px、字重 600，用「一点点」橙色强调 + 44px 短下划线；chips/列表头间距收紧，让卡集更早进入首屏 | 保持 V6 冷灰橙白；首屏垂直利用率提升 |
| D206 | UI | 首页今日一卡移除「✦ 今日一卡」图标与文字，只保留标题与抽卡按钮；同步删除 label 样式，减少色块内冗余信息 | 卡片更安静，标题成为第一视觉 |
| D207 | UI | 三个 tab 页头收敛：删除 MY COLLECTION / CREATOR CENTER / MY SPACE 英文 kicker；收藏册与创作中心中文标题 28→24px；我的页删除「我的」标题，仅保留右侧提醒铃铛；移除未用的 .v6-kicker | 页头更轻，正文更早进入视野 |
| D208 | UI | 我的页顶部压缩：删除标题后仍保留 64px 空头，现改为 44px 导航高度 + 右上铃铛；头像资料区 padding-top 22→10px，整体内容上移 | 不改变 status bar / 胶囊安全区；仅压缩无内容头部 |
| D209 | UI | 收藏册页头移除书本装饰图标，创作中心页头移除右上角「+」按钮（下方已有主「新建卡集」入口）；同步删除 .v6-lib-ico 死样式 | 页头只保留标题，减少重复入口 |
| D210 | UI | 首页今日一卡继续压缩：min-height 150→132px，padding 16→14/16，标题 20→19，按钮 34→32，圆环 136→124，间距 16/22 收紧；保持圆形比例不失真 | 为卡集列表再让出首屏空间 |
