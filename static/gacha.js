/* ══════════════════════════════════════════════
   拾笺 · 抽卡小程序 前端逻辑
   数据全部来自 /api/gacha/*，页面只做渲染与动效
   ══════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);

const App = {
  S: null,            // 服务端完整快照
  busy: false,
  filter: 'all',
  lastDraw: null,     // { count, data }
};

/* ── 请求 ── */
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* 非 JSON 响应 */ }
  return { ok: res.ok, data };
}

async function fetchState() {
  const res = await fetch('/api/gacha/state', { cache: 'no-store' });
  if (!res.ok) throw new Error('state failed');
  return res.json();
}

/* ── 工具 ── */
function cardMap() {
  return new Map(App.S.cards.map((c) => [c.id, c]));
}
function seriesOf(card) {
  return App.S.series.find((s) => s.key === card.series);
}
function cardLabel(card) {
  const s = seriesOf(card);
  const i = s ? s.ids.indexOf(card.id) : -1;
  const no = i >= 0 ? String(i + 1).padStart(2, '0') : '--';
  return `${s ? s.name : ''} · ${no}`;
}

/* ── 路由 ── */
function go(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + id));
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.page === id));
  $('screen').scrollTop = 0;
  closePoster();
}

/* ── 渲染：抽卡页 ── */
function renderHome() {
  const S = App.S;
  const st = S.state;

  $('poolHost').textContent = S.pool.host;
  $('poolName').textContent = S.pool.name;
  $('poolPeriod').textContent = S.pool.period;
  $('poolSubtitle').textContent = S.pool.subtitle;

  const map = cardMap();
  $('featured').innerHTML = S.pool.featured.map((id) => {
    const c = map.get(id);
    return c ? `<span class="featured-chip"><i class="badge ${c.rarity}">${c.rarity}</i>${c.word}</span>` : '';
  }).join('');

  $('rates').innerHTML = ['SSR', 'SR', 'R', 'N'].map((r) =>
    `<span class="rate ${r}">${r} <b>${Math.round(S.rates[r] * 100)}%</b></span>`).join('');

  const p = st.pity.ssr;
  const left = Math.max(0, S.pity_total - p);
  $('pityText').textContent = `已累计 ${p} / ${S.pity_total} 抽`;
  $('pityFill').style.width = Math.min(100, (p / S.pity_total) * 100) + '%';
  $('pityNote').textContent = left > 0
    ? `距必得 SSR 还有 ${left} 抽。十连必得 SR 及以上。`
    : '下一抽必得 SSR。十连必得 SR 及以上。';

  $('tickets').textContent = st.tickets;
  $('ink').textContent = st.ink;
  $('ownedCount').textContent = st.owned;
  $('totalCount').textContent = st.total;

  const freeBtn = $('freeBtn');
  freeBtn.disabled = !st.free_available;
  freeBtn.textContent = st.free_available ? '今日免费一抽' : '今日免费已拆';
  $('draw1Btn').disabled = st.tickets < S.rules.single_cost;
  $('draw10Btn').disabled = st.tickets < S.rules.ten_cost;

  renderRecent();
}

function renderRecent() {
  const entries = App.S.history.slice(0, 2);
  const list = $('recentDraws');
  if (!entries.length) {
    list.innerHTML = '<p class="recent-empty">还没有抽过。第一枚词，在等你。</p>';
    return;
  }
  list.innerHTML = entries.map((h) => `
    <div class="recent-block">
      <p class="recent-time">${h.free ? '今日免费 · ' : ''}${h.at}</p>
      <div class="recent-row">
        ${h.results.map((r) => `<span class="recent-chip ${r.rarity}"><i class="badge ${r.rarity}">${r.rarity}</i><b class="serif">${r.word}</b></span>`).join('')}
      </div>
    </div>`).join('');
}

/* ── 渲染：我的词笺 ── */
function renderCards() {
  const S = App.S;
  $('cardsProgress').textContent = `${S.stats.owned} / ${S.stats.total}`;
  $('statOwned').textContent = S.stats.owned;
  $('statDraws').textContent = S.stats.draw_count;
  $('statSsr').textContent = S.stats.ssr_owned;

  const owned = S.cards.filter((c) => c.owned);
  const visible = App.filter === 'all' ? owned : owned.filter((c) => c.rarity === App.filter);
  $('cardGrid').innerHTML = visible.map((c) => `
    <button class="word-card ${c.rarity}" onclick="openPoster('${c.id}')">
      <div class="wc-top"><i class="badge ${c.rarity}">${c.rarity}</i><span class="wc-count">${c.count > 1 ? '×' + c.count : ''}</span></div>
      <span class="wc-word serif">${c.word}</span>
      <span class="wc-source">${c.source}</span>
    </button>`).join('');

  const empty = $('cardsEmpty');
  if (visible.length) {
    empty.style.display = 'none';
  } else {
    empty.style.display = 'block';
    empty.textContent = owned.length ? '这个稀有度还没有词笺。' : '还没有词笺。去抽一枚，第一句话就开始成形了。';
  }
}

/* ── 渲染：四时图鉴 ── */
function renderCodex() {
  const S = App.S;
  const map = cardMap();
  $('codexProgress').textContent = `${S.stats.owned} / ${S.stats.total}`;

  $('codexList').innerHTML = S.series.map((series) => {
    const cards = series.ids.map((id) => map.get(id)).filter(Boolean);
    const got = cards.filter((c) => c.owned).length;
    const slots = cards.map((c) => c.owned
      ? `<button class="slot-card ${c.rarity}" onclick="openPoster('${c.id}')">
           <i class="badge ${c.rarity}">${c.rarity}</i>
           <b class="serif">${c.word}</b>
           <span>${c.source}</span>
         </button>`
      : '<div class="slot-card locked"><span>？</span></div>').join('');

    return `<section class="codex-group">
      <div class="codex-head"><b class="serif">${series.name}</b><span>${got} / ${cards.length}</span></div>
      <p class="codex-sub">${series.subtitle}</p>
      <div class="codex-slots">${slots}</div>
      <div class="progress small"><i style="width:${cards.length ? (got / cards.length) * 100 : 0}%"></i></div>
    </section>`;
  }).join('');
}

/* ── 渲染：我的 ── */
function renderMe() {
  const S = App.S;
  const st = S.state;
  $('meTickets').textContent = st.tickets;
  $('meInk').textContent = st.ink;
  $('meOwned').textContent = st.owned;
  $('meMeta').textContent = `${S.pool.name} · ${S.pool.period}`;

  const gift = $('giftBtn');
  gift.disabled = !st.gift_available;
  gift.textContent = st.gift_available ? `领今日 ${S.rules.daily_tickets} 笺` : '今日已领';

  const exchange = $('exchangeBtn');
  exchange.disabled = st.ink < S.rules.exchange_ink;
  exchange.textContent = st.ink >= S.rules.exchange_ink
    ? `${S.rules.exchange_ink} 墨换 ${S.rules.exchange_tickets} 笺`
    : `墨不足 ${S.rules.exchange_ink}（${st.ink}）`;

  renderHistory();
}

function renderHistory() {
  const entries = App.S.history.slice(0, 8);
  const list = $('historyList');
  if (!entries.length) {
    list.innerHTML = '<p class="recent-empty">还没有记录。去抽第一枚词。</p>';
    return;
  }
  list.innerHTML = entries.map((h) => `
    <div class="history-row">
      <span>${h.at.slice(5, 16)}</span>
      <div class="words">${h.results.map((r) => `<b class="serif ${r.rarity}">${r.word}</b>`).join('')}</div>
      <span>${h.free ? '免费' : h.count + ' 抽'}</span>
    </div>`).join('');
}

function renderAll() {
  if (!App.S) return;
  renderHome();
  renderCards();
  renderCodex();
  renderMe();
}

function applyPayload(payload) {
  App.S = payload;
  renderAll();
}

/* ══════════════════════════════════════════════
   抽卡
   ══════════════════════════════════════════════ */
async function doDraw(count) {
  if (App.busy) return;
  App.busy = true;
  try {
    const { ok, data } = await api('/api/gacha/draw', { count });
    if (!ok) {
      toast(data.message || '抽卡失败，请再试一次');
      return;
    }
    applyPayload(data.payload);
    App.lastDraw = { count, data };
    showDraw(count);
  } catch (_) {
    toast('网络开小差了，再试一次');
  } finally {
    App.busy = false;
  }
}

function showDraw(count) {
  $('drawTitle').textContent = count === 10 ? '十 连 拾 笺' : '今 日 拾 笺';
  $('drawSummary').textContent = '';
  $('drawStage').innerHTML = `
    <div class="pack-wrap" id="packWrap">
      <div class="pack" id="pack" onclick="revealDraw()">
        <div class="pack-back"></div>
        <div class="pack-sheet"></div>
        <div class="pack-front"></div>
        <div class="pack-flap"></div>
        <div class="pack-seal serif">抽</div>
      </div>
      <p class="env-hint">轻触拆开${count === 10 ? '这十枚' : '这一枚'}</p>
    </div>`;

  const again = $('drawAgain');
  const cost = count === 10 ? App.S.rules.ten_cost : App.S.rules.single_cost;
  again.textContent = `再抽一次 · ${cost} 笺`;
  again.disabled = App.S.state.tickets < cost;
  $('drawAccept').disabled = false;
  $('drawModal').classList.add('show');
}

let revealTimer = null;
function revealDraw() {
  const pack = $('pack');
  if (!pack || pack.classList.contains('opening')) return;
  pack.classList.add('opening');
  const seal = pack.querySelector('.pack-seal');
  if (seal) seal.textContent = '拆';
  clearTimeout(revealTimer);
  revealTimer = setTimeout(renderDrawResults, 620);
}

function renderDrawResults() {
  const ld = App.lastDraw;
  if (!ld) return;
  const { count, data } = ld;
  const results = data.results;
  const S = App.S;
  let html = '';
  let ssrWord = '';

  if (count === 1) {
    const r = results[0];
    const c = r.card;
    if (c.rarity === 'SSR') ssrWord = c.word;
    html = `
      <div class="letter-card ${c.rarity === 'SSR' ? 'ssr' : ''}" onclick="this.classList.toggle('flipped')">
        <div class="card-inner">
          <div class="card-face front">
            <div class="cf-top">
              <i class="badge ${c.rarity}">${c.rarity}</i>
              <span class="no">${cardLabel(c)}${r.is_new ? ' · NEW' : ''}</span>
            </div>
            <div class="bigword serif">${c.word}</div>
            <p class="cf-quote serif">“${c.quote}”</p>
            <div class="cf-source">${c.source}</div>
            <div class="cf-bottom"><span>${S.pool.name} · ${S.pool.period}</span><span>轻触翻面 ›</span></div>
          </div>
          <div class="card-face back">
            <div class="back-label">笺 注</div>
            <p class="metaphor serif">${c.note}</p>
            <p class="back-quote serif">“${c.quote}”</p>
            <div class="cobrand">
              <div class="logo-box">笺</div>
              <div><b>${S.pool.host}</b><span>${r.is_new ? '已收入词笺' : '重复 · 墨 +' + r.ink}</span></div>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    html = `<div class="pull-grid">${results.map((r, i) => {
      const c = r.card;
      if (c.rarity === 'SSR') ssrWord = c.word;
      return `
        <div class="pull-card ${c.rarity} ${r.is_new ? 'new' : ''}"
             style="animation-delay:${i * 55}ms" onclick="this.classList.toggle('flipped')">
          <div class="pull-inner">
            <div class="pull-face pull-front">
              <i class="badge ${c.rarity}">${c.rarity}</i>
              <b class="serif">${c.word}</b>
              <span>${r.is_new ? cardLabel(c) : '重复 · 墨 +' + r.ink}</span>
            </div>
            <div class="pull-face pull-back">
              <p class="serif">${c.note}</p>
              <span>${c.source}</span>
            </div>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  $('drawStage').innerHTML = html;

  const newCount = results.filter((r) => r.is_new).length;
  const inkTotal = results.reduce((n, r) => n + r.ink, 0);
  const costText = data.used_free ? '今日免费' : `消耗 ${data.cost} 笺`;
  $('drawSummary').textContent = `获得 ${newCount} 枚新词${inkTotal ? ' · 墨 +' + inkTotal : ''} · ${costText}`;

  if (ssrWord) toast(`绝笺 SSR · ${ssrWord}`);

  const again = $('drawAgain');
  const cost = count === 10 ? S.rules.ten_cost : S.rules.single_cost;
  again.textContent = `再抽一次 · ${cost} 笺`;
  again.disabled = S.state.tickets < cost;
}

function closeDraw() {
  $('drawModal').classList.remove('show');
  $('drawStage').innerHTML = '';
  $('drawSummary').textContent = '';
  App.lastDraw = null;
}

/* ══════════════════════════════════════════════
   海报
   ══════════════════════════════════════════════ */
function openPoster(cardId) {
  const c = cardMap().get(cardId);
  if (!c || !App.S) return;
  $('pWord').textContent = c.word;
  $('pSource').textContent = `${c.source} · ${cardLabel(c)}`;
  $('pQuote').textContent = `“${c.quote}”`;
  $('pMetaphor').textContent = c.note;
  $('pMeta').textContent = `${c.rarity} · ${App.S.pool.name} ${App.S.pool.period}`;
  $('posterModal').classList.add('show');
}

function closePoster() {
  $('posterModal').classList.remove('show');
}

/* ══════════════════════════════════════════════
   轻提示
   ══════════════════════════════════════════════ */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ══════════════════════════════════════════════
   事件绑定与启动
   ══════════════════════════════════════════════ */
function bindEvents() {
  $('freeBtn').addEventListener('click', () => doDraw(1));
  $('draw1Btn').addEventListener('click', () => doDraw(1));
  $('draw10Btn').addEventListener('click', () => doDraw(10));

  $('drawClose').addEventListener('click', closeDraw);
  $('drawAccept').addEventListener('click', closeDraw);
  $('drawAgain').addEventListener('click', () => {
    if (!App.lastDraw) return;
    doDraw(App.lastDraw.count);
  });

  $('posterClose').addEventListener('click', () => {
    closePoster();
    toast('已生成卡片。长按保存，把它寄出去。');
  });

  document.querySelectorAll('#filters button').forEach((btn) => {
    btn.addEventListener('click', () => {
      App.filter = btn.dataset.filter;
      document.querySelectorAll('#filters button').forEach((b) => b.classList.toggle('on', b === btn));
      renderCards();
    });
  });

  $('giftBtn').addEventListener('click', async () => {
    if ($('giftBtn').disabled) return;
    const { ok, data } = await api('/api/gacha/daily-gift', {});
    if (!ok) { toast(data.message || '领取失败'); return; }
    applyPayload(data.payload);
    toast(`收到 ${data.gained} 笺。`);
  });

  $('exchangeBtn').addEventListener('click', async () => {
    if ($('exchangeBtn').disabled) return;
    const { ok, data } = await api('/api/gacha/exchange', {});
    if (!ok) { toast(data.message || '兑换失败'); return; }
    applyPayload(data.payload);
    toast(`墨已研开，换得 ${data.gained} 笺。`);
  });

  $('resetLink').addEventListener('click', async () => {
    if (!confirm('重置本期抽卡数据？词笺、墨与保底都会清空。')) return;
    const { ok, data } = await api('/api/gacha/reset', {});
    if (!ok) { toast(data.message || '重置失败'); return; }
    applyPayload(data);
    go('home');
    toast('本期已重置。');
  });
}

async function init() {
  bindEvents();
  try {
    applyPayload(await fetchState());
  } catch (_) {
    toast('加载失败，请刷新页面');
  }
}

init();
