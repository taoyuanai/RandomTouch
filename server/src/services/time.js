/* 北京时间（UTC+8）——「天」的唯一权威算法，与前端 services/util/bktime.js 对齐。
 * 绝不使用进程本地时区的 toLocaleDateString。
 */
const BK_OFFSET_MS = 8 * 3600000;

function bkDate(ts) {
  return new Date((ts == null ? Date.now() : ts) + BK_OFFSET_MS);
}
function dateKeyOf(ts) {
  const d = bkDate(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function todayKey(ts) { return dateKeyOf(ts == null ? Date.now() : ts); }

function weekMondayKey(ts) {
  const d = bkDate(ts == null ? Date.now() : ts);
  const dow = (d.getUTCDay() + 6) % 7; // 周一 = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function keyPlus(key, n) {
  const t = Date.parse(key + 'T00:00:00Z') + n * 86400000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function todayShort(ts) {
  const d = bkDate(ts);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
function todayDot(ts) {
  const d = bkDate(ts);
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}
function todayMD(ts) {
  const d = bkDate(ts);
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function dayText(ts) {
  return '周' + '日一二三四五六'[bkDate(ts).getUTCDay()];
}
function stampDate(shortDate, ts) {
  const m = shortDate && String(shortDate).match(/(\d+)月(\d+)日/);
  if (!m) return shortDate || '';
  return `${bkDate(ts).getUTCFullYear()}.${pad(m[1])}.${pad(m[2])}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

/* 评论展示串：今天 HH:mm / 昨天 HH:mm / MM-DD HH:mm（客户端直接显示） */
function commentTimeText(ts, nowTs) {
  const now = nowTs == null ? Date.now() : nowTs;
  const today = todayKey(now);
  const k = dateKeyOf(ts);
  const d = bkDate(ts);
  const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  if (k === today) return `今天 ${hm}`;
  const yesterday = keyPlus(today, -1);
  if (k === yesterday) return `昨天 ${hm}`;
  if (k.slice(0, 4) === today.slice(0, 4)) return `${k.slice(5)} ${hm}`;
  return `${k} ${hm}`;
}

/* 'MM-DD' → 'YYYY-MM-DD'（种子数据没有年份，用当前北京年兜底） */
function mdToDateKey(md, ts) {
  if (!md) return null;
  const m = String(md).match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return `${bkDate(ts).getUTCFullYear()}-${pad(m[1])}-${pad(m[2])}`;
}

module.exports = {
  dateKeyOf, todayKey, weekMondayKey, keyPlus,
  todayShort, todayDot, todayMD, dayText, stampDate,
  commentTimeText, mdToDateKey,
};
