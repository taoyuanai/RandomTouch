#!/usr/bin/env node
/* 本机/服务器冒烟：登录态用 scripts/mint-token.js 生成。
 * 用法：node scripts/smoke.js --base=http://127.0.0.1:3000 --token=<jwt>
 */
const baseArg = process.argv.find(a => a.startsWith('--base='));
const tokenArg = process.argv.find(a => a.startsWith('--token='));
const BASE = (baseArg ? baseArg.slice(7) : 'http://127.0.0.1:3000').replace(/\/+$/, '');
const TOKEN = tokenArg ? tokenArg.slice(8) : '';

let failures = 0;
function pass(name) { console.log(`✓ ${name}`); }
function fail(name, detail) {
  failures++;
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function assert(name, cond, detail) {
  if (cond) pass(name); else fail(name, detail);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + '/api/v1' + path, {
    method,
    headers: Object.assign(
      { 'content-type': 'application/json' },
      TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}
    ),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (data && data.code) {
    const err = new Error(`${data.code}: ${data.message}`);
    err.code = data.code;
    throw err;
  }
  return data;
}

(async () => {
  if (!TOKEN) { console.error('缺少 --token（先运行 node scripts/mint-token.js <openid>）'); process.exit(2); }

  const health = await (await fetch(BASE + '/healthz')).json();
  assert('healthz', health.ok === true, JSON.stringify(health));

  const sets = await api('/sets');
  assert('listSets 返回数组', Array.isArray(sets) && sets.length > 0, `len=${sets && sets.length}`);

  const target = sets.find(s => s.type === 'collect' && s.price === 0 && s.progress.got.length < s.count)
    || sets.find(s => s.type === 'collect' && s.progress.got.length < s.count);
  assert('找到可抽的 collect 卡集', !!target, '没有剩余卡');
  if (!target) process.exit(1);

  const sub = await api(`/sets/${target.id}/subscribe`, { method: 'POST', body: {} });
  assert('subscribeSet', sub && sub.set && sub.set.id === target.id);

  const rid = 'smoke' + Date.now().toString(36);
  let first;
  try {
    first = await api(`/sets/${target.id}/draw`, { method: 'POST', body: { requestId: rid } });
    assert('draw 出卡', ['drawn', 'already', 'completed'].includes(first.result), first.result);
  } catch (e) {
    if (e.code === 'UNLOCK_REQUIRED') {
      await api(`/sets/${target.id}/unlock`, { method: 'POST', body: {} });
      first = await api(`/sets/${target.id}/draw`, { method: 'POST', body: { requestId: rid } });
      assert('unlock 后 draw 出卡', first.result === 'drawn', first.result);
    } else throw e;
  }

  const replay = await api(`/sets/${target.id}/draw`, { method: 'POST', body: { requestId: rid } });
  assert('同 requestId 幂等', replay.result === 'already' && replay.idx === first.idx,
    `result=${replay.result} idx=${replay.idx}/${first.idx}`);

  const another = await api(`/sets/${target.id}/draw`, { method: 'POST', body: { requestId: rid + 'x' } });
  assert('当日第二次抽卡返回 already', another.result === 'already', another.result);

  if (first.idx != null) {
    const stamp = await api(`/sets/${target.id}/stamp`, {
      method: 'POST',
      body: { idx: first.idx, note: '冒烟测试邮戳', imgFileID: '' },
    });
    assert('saveStamp', stamp && stamp.rec && stamp.rec.note === '冒烟测试邮戳');
  }

  const feed = await api('/feed');
  assert('getFeed', feed && feed.stats && typeof feed.stats.canDraw === 'number');

  const income = await api('/income');
  assert('getIncome', income && typeof income.threshold === 'number');

  const craft = await api('/craft');
  assert('getMyCraft', craft && Array.isArray(craft.published) && Array.isArray(craft.reviewing));

  const author = await api('/authors/' + encodeURIComponent(target.creator));
  assert('getAuthor', author && author.name === target.creator && Array.isArray(author.works));

  const like = await api(`/sets/${target.id}/like`, { method: 'POST', body: {} });
  assert('toggleLike', like && typeof like.likes === 'number');

  const weekly = await api(`/sets/${target.id}/weekly`, { method: 'POST', body: { weekNo: 1 } });
  assert('markWeekly', weekly && weekly.ok === true);

  console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error('冒烟失败:', err && err.message ? err.message : err);
  process.exit(1);
});
