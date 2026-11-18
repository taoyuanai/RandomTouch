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

## 2. SetPayload（全接口通用）
```
{ id, title, covT, covS, cover, coverImage, cat, type, price, trial,
  count, pool: [{w,b}], intro, creator, heat, date,
  signatureIdx, signatureNote, own,
  progress: { drawn, got[], todayDrawn, trialToday, todayIdx,
              unlocked, trialUsed, drawnLog[{idx,ts}], recs{} } }
```

## 3. 偏离日志（后端进场后填写）
| 日期 | 方法 | 偏离内容 | 适配方案（real/index.js） |
|---|---|---|---|
