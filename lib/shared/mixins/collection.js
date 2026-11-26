/* lib/shared/mixins/collection.js — 全图 / 抽空 / 统计 / 订阅页动作
 * 从 base.js 拆出；依赖注入保持与 base 相同的 API 形状。
 */
const core = require('../../core.js');
const { getViewport, getRec, pad2 } = core;

module.exports = {
  renderMap() {
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    /* 列表是摘要时 pool 为空：先加载详情，避免把已抽到的格子渲染成空白。 */
    if (!S.detailLoaded[s.id] && !(s.pool || []).length) {
      core.ensureSetDetail(s.id)
        .then(() => {
          if (this.__page === 'map' && this.S && this.S.cur === s.id) this.renderMap();
        })
        .catch(() => {});
      return;
    }
    const u = s.user || {};
    const gotRaw = Array.isArray(u.got) ? u.got.map(Number) : [];
    const gotSet = new Set(gotRaw.filter(n => Number.isFinite(n)));
    if (u.todayIdx != null) gotSet.add(Number(u.todayIdx));
    (u.drawnLog || []).forEach(e => {
      if (e && e.idx != null) gotSet.add(Number(e.idx));
    });
    /* count 只用于文案；格子必须覆盖完整 pool 和所有已抽 idx，
     * 避免历史数据 count < pool 时，已抽到的卡落在格子外面。 */
    const maxGot = gotSet.size ? Math.max.apply(null, Array.from(gotSet)) : -1;
    const n = Math.max(Number(s.count) || 0, (s.pool || []).length, maxGot + 1);
    const per = 4;
    const stamps = Array.from({ length: n }, (_, idx) => {
      const cvm = this._cardVM(s, idx, 'map');
      const full = gotSet.has(idx);
      const rec = getRec(u, idx);
      return {
        idx, no: pad2(idx + 1),
        ink: cvm.ink, inkLine: cvm.inkLine, inkFaint: cvm.inkFaint,
        state: full ? 'full' : 'blank',
        full,
        card: full ? cvm : null,
        pmkState: full ? (rec ? 'done' : (u.todayIdx === idx ? 'today' : '')) : '',
        dark: !full, sig: idx === s.signatureIdx, sid: s.id,
      };
    });
    const rows = [];
    for (let r = 0; r < Math.ceil(stamps.length / per); r++) {
      rows.push({ cells: stamps.slice(r * per, r * per + per) });
    }
    const gotList = Array.from(gotSet);
    const drawnWords = gotList.map(idx => ({
      idx,
      w: (((s.pool || [])[idx] || {}).w || ''),
    })).filter(it => it.w);
    const latestWord = drawnWords.length ? drawnWords[drawnWords.length - 1].w : '';
    const drawnN = Math.max(u.drawn || 0, gotSet.size);
    this.setData({
      mapV: {
        rows, cells: stamps,
        drawn: drawnN,
        count: n,
        pct: n ? Math.min(100, drawnN / n * 100).toFixed(1) : 0,
        drawnWords,
        latestWord,
      },
    });
  },

  mapCellTap(e) {
    const d = e.currentTarget.dataset;
    const idx = Number(d && d.idx);
    const cell = (this.data.mapV.cells || [])[idx];
    if (!cell) return;
    if (cell.state === 'blank') {
      if (cell.sig) this.toast('题眼还在路上 · 抽到那天你会知道');
      return;
    }
    this.showBigCard(Number(cell.sid), idx);
  },

  showBigCard(sid, idx, opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === sid);
    if (!s) return;
    if (!S.detailLoaded[sid]) {
      core.ensureSetDetail(sid)
        .then(() => this.showBigCard(sid, idx, opts))
        .catch(() => this.toast('卡面加载失败，再试一次'));
      return;
    }
    const c = s.pool[idx];
    if (!c) return;
    const front = this._cardVM(s, idx, 'big');
    const back = this._cardVM(s, idx, 'big');
    const isKey = idx === s.signatureIdx;
    front.sigBar = isKey;
    front.sigStamp = isKey;
    if (opts.stampAnim) back.stampAnim = true;
    this.setData({
      bigCard: {
        show: true,
        flipped: !!opts.flipped,
        sig: isKey,
        lit: s.cat === 'bond',
        front, back,
      },
    });
  },

  toggleBigCardFlip() {
    this.setData({ 'bigCard.flipped': !this.data.bigCard.flipped });
  },

  closeBigCard() {
    this.setData({ 'bigCard.show': false, 'bigCard.flipped': false });
  },

  /* ──────────────────────────────────────────────────────────
     抽空纪念
     ────────────────────────────────────────────────────────── */
  openDone(id) {
    this.S.cur = id;
    this.openDoneView();
  },

  /* ── 抽空页 · 金色时刻（全屏接管） ── */
  renderDone() {
    if (!['cards', 'set', 'draw', 'map'].includes(this.__page)) return;
    const S = this.S;
    const s = S.sets.find(x => x.id === S.cur);
    if (!s) return;
    const u = s.user || {};
    const got = u.got || [];
    const count = s.count || (s.pool || []).length;

    /* 点阵行列：先按可用高度定行数，再出列数（4/6/8 档） */
    const vp = getViewport();
    const CELL = 22;
    const availH = Math.max(180, vp.h - 330);
    let rows = Math.max(1, Math.floor(availH / CELL));
    if (rows > 6) rows = 6;
    let cols = Math.ceil(count / rows);
    if (cols > 8) { cols = 8; rows = Math.ceil(count / 8); }
    if (cols < 4) cols = 4;
    const cells = [];
    for (let i = 0; i < rows * cols; i++) cells.push({ i, on: i < count });

    const stamps = got.filter(i => {
      const r = u.recs && u.recs[i];
      return Array.isArray(r) ? r.length > 0 : !!r;
    }).length;
    const log = u.drawnLog || [];
    let days = Math.max(1, got.length);
    if (log.length >= 2) {
      days = Math.max(1, Math.round((log[log.length - 1].ts - log[0].ts) / 86400000) + 1);
    }

    clearTimeout(this._doneTimer);
    this.setData({
      donePage: {
        show: false, ctaShow: false,
        eyebrow: '全部点亮 · 完整图鉴',
        title: s.title || '',
        count, days, stamps, cols, cells,
        note: count + ' 张 · ' + days + ' 天 · ' + stamps + ' 枚邮戳',
        recs: this._recsFor(s.id, 'hot', 3, 0),
      },
    });
    setTimeout(() => this.setData({ 'donePage.show': true }), 30);
    this._doneTimer = setTimeout(() => {
      this.setData({ 'donePage.ctaShow': true });
    }, 1200);
  },

  openDoneView() {
    this.renderDone();
  },

  closeDone() {
    clearTimeout(this._doneTimer);
    this._doneTimer = null;
    this.setData({ 'donePage.show': false, 'donePage.ctaShow': false });
  },

  tapDoneAction(e) {
    const act = e.currentTarget.dataset.act;
    if (act === 'booklet') {
      this.openPoster({ currentTarget: { dataset: { type: 'memorial', sid: this.S.cur } } });
    } else if (act === 'back') {
      this.closeDone();
      this.goSetView(this.S.cur);
    }
  },

  /* ──────────────────────────────────────────────────────────
     订阅页 v2：行动提醒卡 + 统计 + 三组卡片
     ────────────────────────────────────────────────────────── */

  /* 订阅统计：今日可抽 / 累计抽卡 / 已抽空 */
  async tapStat(e) {
    const kind = e.currentTarget.dataset.kind;
    const subs = this.data.subs || {};
    if (kind === 'today') {
      if (!subs.today || !subs.today.length) { this.toast('今天没有可抽的卡集'); return; }
      wx.pageScrollTo({ selector: '#subsToday', duration: 240 });
      return;
    }
    if (kind === 'cards') {
      const need = (this.S.sets || []).filter(s => s.user && (s.user.got || []).length);
      await Promise.all(need.map(s => core.ensureSetDetail(s.id).catch(() => null)));
      const cards = [];
      (this.S.sets || []).forEach(s => {
        const u = s.user || {};
        (u.got || []).forEach(idx => {
          if (!(s.pool || [])[idx]) return;
          cards.push({
            key: s.id + '-' + idx,
            sid: s.id, idx, title: s.title || '',
            card: this._cardVM(s, idx, 'stats'),
          });
        });
      });
      if (!cards.length) { this.toast('还没有抽到卡'); return; }
      this.setData({
        statsSheet: {
          show: true, kind: 'cards', title: '我抽过的卡',
          sub: `已收集 ${cards.length} 张 · 累计 ${subs.statCards || 0} 次`,
          cards, sets: [],
        },
      });
      return;
    }
    if (kind === 'empty') {
      const sets = (subs.done || []).slice();
      if (!sets.length) { this.toast('还没有抽空的卡集'); return; }
      this.setData({
        statsSheet: {
          show: true, kind: 'empty', title: '已抽空的卡集',
          sub: `${sets.length} 个卡集 · 全部点亮`,
          cards: [], sets,
        },
      });
    }
  },

  closeStats() {
    this.setData({ 'statsSheet.show': false });
  },

  openStatSet(e) {
    const sid = Number(e.currentTarget.dataset.sid);
    this.setData({ 'statsSheet.show': false });
    this.openSetById(sid, 'cards');
  },

  /* 提醒卡直达动作 */
  tapRemindDraw() {
    const r = this.data.subs.remindDraw;
    if (r) this.goSubsDraw(r.sid, 'cards');
  },

  tapRemindStamp() {
    const r = this.data.subs.remindStamp;
    if (!r) return;
    this.S.cur = r.sid;
    this.openRecordAt(r.sid, r.idx, 'cards');
  },

  /* 本周目标卡：未满 → 直达今日第一件待办；集满 → 装订本周周记 */
  tapWeekGoal() {
    const wg = this.data.subs.weekGoal;
    if (!wg) return;
    if (wg.full) {
      const weekly = this.data.subs && this.data.subs.weekly;
      const target = weekly && weekly.sid
        ? this.S.sets.find(x => x.id === weekly.sid)
        : null;
      if (target) {
        this.openWeekly({ currentTarget: { dataset: { id: target.id } } });
      } else {
        this.toast('周记按卡集装订：同一卡集抽满 7 张即可生成');
      }
      return;
    }
    const rd = this.data.subs.remindDraw;
    if (rd) { this.goSubsDraw(rd.sid, 'cards'); return; }
    const rs = this.data.subs.remindStamp;
    if (rs) { this.S.cur = rs.sid; this.openRecordAt(rs.sid, rs.idx, 'cards'); return; }
    this.toast('今天都完成啦 · 明天 0 点（北京时间）新卡到');
  },

  /* 久别问候卡：直达今日第一件可抽 */
  tapGreeting() {
    const g = this.data.subs.greeting;
    if (!g) return;
    if (g.sid) { this.goSubsDraw(g.sid, 'cards'); return; }
    this.toast('今天没有新卡 · 去「发现」看看有没有新卡集');
  },

  switchLibTab(e) {
    const tab = e.currentTarget.dataset.tab || 'subscribed';
    this.setData({ 'subs.tab': tab });
  },

  tapSubsRow(e) {
    const d = e.currentTarget.dataset;
    const sid = Number(d.sid);
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    const from = d.from || 'cards';
    const u = s.user || {};
    if (d.tap === 'booklet') {
      this.S.cur = sid;
      this.openDoneView();
      return;
    }
    if (d.tap === 'stamp') {
      const idx = d.idx != null ? Number(d.idx)
        : (u.todayIdx != null ? u.todayIdx
          : (u.todayDrawn && u.got && u.got.length ? u.got[u.got.length - 1] : null));
      if (idx == null) return;
      this.S.cur = sid;
      this.openRecordAt(sid, idx, from);
    } else if (d.tap === 'draw') {
      this.goSubsDraw(sid, from);
    } else {
      this.goSubsView(sid, from);
    }
  },



  tapSubsBrowse() {
    this.go('home');
  },


  /* ──────────────────────────────────────────────────────────
     订阅页
  /* ──────────────────────────────────────────────────────────
     创作中心
     ────────────────────────────────────────────────────────── */

};
