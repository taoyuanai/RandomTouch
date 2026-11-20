# 今日做点小事 · 接口契约 v1（已冻结 @D1）

> 状态：前端单方面定稿。后端进场时只允许「确认」或记入文末偏离日志，
> 不允许重设计。偏离通过 real/index.js 适配消化，页面代码零改动。

## 0. 容差条款（后端必须遵守）

1. 客户端**忽略一切未知字段**（后端加字段不破前端）
2. 统一失败结构：`{ code: string, message: string, retryable: boolean }`
3. 错误码总表（v1 全量，不多不少）：
   | code | 含义 | retryable |
   |---|---|---|
   | INTERNAL | 服务器开小差 | true |
   | AUTH_FAILED | 登录态失效 | true |
   | SET_NOT_FOUND | 卡集不存在 | false |
   | UNLOCK_REQUIRED | 试抽用尽，需解锁 | false |
   | SEC_REJECTED | 内容安全拒绝 | false |
   | SEC_PENDING | 内容安全审核中 | false |
4. 所有方法 async；「天」一律指**服务器北京时间（UTC+8）0 点**，客户端时间不可信
5. 时间戳一律 ms epoch；展示日期由客户端从 ts 派生（服务端不下发格式化字符串）
6. 图片一律先 `uploadImage` 拿 fileID，再随参数提交
7. v1 不分页（50 集内），预留 page/pageSize

## 1. 方法明细

### auth()
静默登录。返回 `{ ok: true }`。失败 AUTH_FAILED。

### listSets({ cat?, sort? })
cat 为分类 key 或 'all'；sort: 'hot' | 'new'。
返回 `SetPayload[]`（见 §2）。

### getSet(setId)
返回 `SetPayload & { social:{liked,likes}, commentCount, fans }`。
失败 SET_NOT_FOUND。

### draw({ setId, requestId }) ★核心
requestId 由客户端生成（uuid），**同 requestId 重放返回同一结果且 result='already'**。
返回：
```
{
  result: 'drawn' | 'already' | 'completed',
  idx, card: { w, b },
  set: SetPayload,          // 含最新进度
  done: boolean,            // 本次是否抽空（collect）
  sig: { firstReveal: boolean, isSig: boolean }  // 题眼首曝，驱动金色动画
}
```
失败：UNLOCK_REQUIRED（试抽用尽）。服务端职责：跨天判定、试抽额度、
剩余卡池随机、原子写入、activity 流水记录。

### saveStamp({ setId, idx, note, imgFileID })
返回 `{ rec: { img, imgFileID, note, date, stampDate, sec }, updated }`。
sec = `{ text: 'pass'|'pending'|'risky', media: 'pass'|'pending'|'risky'|'none' }`。
常驻集同 idx 多条记录按数组追加，取末条为当前。

### unlock({ setId })
模拟支付完成。返回 `{ set: SetPayload }`（unlocked=true）。

### subscribeSet({ setId })
订阅卡集：创建用户进度（drawn=0, got=[]）但不抽卡；幂等。返回 `{ set: SetPayload }`。

### getPosterQR({ setId })
生成卡集分享小程序码。返回 `{ path }`，path 为空表示当前环境未配置二维码服务。

### getComments(setId) / addComment({ setId, text })
getComments 返回可见留言数组 `{id,name,avatar,text,time,creator}[]`。
addComment 返回 `{ comment, status: 'visible'|'pending' }`。
失败 SEC_REJECTED / SEC_PENDING。

### toggleLike({ setId })
返回 `{ liked, likes }`。

### getFeed() — 订阅页聚合
服务端基于 activity 流水计算。返回：
```
{
  total, stats: { canDraw, cards, emptied, waiting },
  today:       Row[],  // status: 'can_draw' | 'locked'
  subscribed:  Row[],  // status: 'waiting_reply' | 'stamped'
  done:        Row[],  // status: 'done'
  weekGoal: { done, total:7, left, full, dots: [{dateKey, drawn, isToday, isPast}] } | null,
  greeting: { days, suggestSetId, canDrawN } | null,
  weekly: { setId, weekNo } | null
}
Row = { setId, title, covT, todayIdx, got, count, drawn, resident, price, status }
```

### getMyCraft() / submitCraft({ draft })
getMyCraft 返回 `{ published: SetPayload[], reviewing: [{id,title,complete}] }`。
**草稿仅存客户端本地，submit 才上服务端。**
submitCraft 返回 `{ status: 'submitted' }`。失败 SEC_REJECTED。

### getIncome() / withdraw()
收益为服务端权威。getIncome 返回
`{ total, avail, pending, withdrawn, threshold, bySet[], platform, txns[] }`。
withdraw 将 avail 计入 pending，返回新 getIncome 快照。

### uploadImage(filePath)
返回 `{ fileID }`。云存储上传 + 触发图片安全检测。

### reportRemindAuth({ enabled, time })
订阅消息授权结果上报。返回 `{ ok }`。

### track(event, props)
埋点。事件枚举：set_view / draw_done / stamp_done / poster_save / weekly_make / unlock_view。
允许静默失败。

### markWeekly({ setId, weekNo })
标记某集某周周记已生成（getFeed 据此不再提示）。返回 `{ ok }`。

### getAuthor({ name })
创作者主页。返回 `{ name, own, fans, followed, works: SetPayload[] }`。
own = 是否本人。未知创作者返回空 works（不报错）。

### toggleFollow({ name })
关注/取关创作者。返回 `{ followed, fans }`。

## 2. SetPayload（全接口通用）
```
{ id, title, covT, covS, cover, coverImage, cat, type, price, trial,
  count, pool: [{w,b}], intro, creator, heat, date,
  signatureIdx, signatureNote, own,
  progress: { drawn, got[], todayDrawn, trialToday, todayIdx,
              unlocked, trialUsed, drawnLog[{idx,ts}], recs{} } }
```

DraftPayload = { id, title, intro, type, cat, price, trial, coverImage,
                 signatureIdx, signatureNote, submitted, pool: [{w,b}] }

## 修订记录
| 日期 | 变更 | 说明 |
|---|---|---|
| D3 | SetPayload 新增可选 `likes?: number, liked?: boolean` | 列表/抽卡响应直出心动数，免去逐集 getSet；容差条款① |
| D3 | 新增 markWeekly 接口 | 周记"已生成"须服务端记录；页面保留本地缓存做即时反馈 |
| D4 | 无接口变更。备注：pending→withdrawn 由支付回调驱动，客户端不提供接口 | doArrive 仅存在于 mock 调试后门 |
| D5 | getMyCraft.reviewing 升级为完整 DraftPayload（原仅 {id,title,complete}） | 审核中详情页需完整字段渲染 |
| D5 | 新增 getAuthor / toggleFollow | fans 与关注状态服务端权威 |
| D5 | SetPayload 的 totalDrawn/earn/buyers（D2 曾可选）转正 | 收益看板与作者页数据源 |
| D6 | 无接口变更（saveStamp 为页面侧实现修复） | |
| V1 | saveStamp 返回的 rec 增加可选 dateText/dayText（显示字段，additive） | 邮戳日期随记录持久化，卡背不再显示"今天" |
| C1 | set 增加可选 disclaimer: string（≤20 字，知识类必填） | 详情页免责展示 |
| D2 | draw 响应新增可选 `weekGoal?: {done, total, full, justFull}`；SetPayload 新增可选 `totalDrawn? / earn? / buyers?`（own 集统计） | 本周目标只有服务端能跨集聚合判定；justFull=本周刚达成，驱动一次性 toast。符合容差条款①，后端可返回 null/省略 |
| D2 | SetPayload 新增可选 `subscribed?: boolean` | 区分「未订阅集」：progress 默认对象不应被当成订阅，否则首页/订阅页会把全部卡集算作订阅。符合容差条款① |
| D2 | draw 失败重试复用同一 requestId | 覆盖「服务端已处理但响应丢失」：重放返回同一张卡，不丢不重 |

## 3. 偏离日志（后端进场后填写）
| 日期 | 方法 | 偏离内容 | 适配方案（real/index.js） |
|---|---|---|---|
