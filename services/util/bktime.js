/* 北京时间（UTC+8）工具 —「天」的唯一权威算法 */
const BK_OFFSET_MS = 8 * 3600000;

function bkDate(ts) {
  return new Date((ts == null ? Date.now() : ts) + BK_OFFSET_MS);
}
function dateKeyOf(ts) {
  const d = bkDate(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function todayKey() { return dateKeyOf(Date.now()); }

function weekMondayKey(ts) {
  const d = bkDate(ts == null ? Date.now() : ts);
  const dow = (d.getUTCDay() + 6) % 7; // 周一=0
  d.setUTCDate(d.getUTCDate() - dow);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function keyPlus(key, n) {
  const t = Date.parse(key + 'T00:00:00Z') + n * 86400000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function todayShort() {
  const d = bkDate();
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
function todayDot() {
  const d = bkDate();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}
function todayMD() {
  const d = bkDate();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function stampDate(d) {
  const m = d && String(d).match(/(\d+)月(\d+)日/);
  if (!m) return d || '';
  const y = bkDate().getUTCFullYear();
  const p = (n) => String(n).padStart(2, '0');
  return `${y}.${p(m[1])}.${p(m[2])}`;
}

module.exports = { bkDate, dateKeyOf, todayKey, weekMondayKey, keyPlus, todayShort, todayMD, todayDot, stampDate };
