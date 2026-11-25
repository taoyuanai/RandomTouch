/* lib/shared/d4.js — 页面覆盖层 */
const core = require('../core.js');
const api = require('../../services/api.js');
const tracker = require('../track.js');
const posterKit = require('../../utils/posterKit/export.js');
const { USE_MOCK, API_BASE } = require('../../services/config.js');
const QR_BLANK = '/assets/icons/qr-blank.png'; // 无二维码时给 Canvas 一个透明占位，避免画出假 QR

/* boot 失败时给真机一个可执行的提示（真机禁止 HTTP/IP 请求） */
const BOOT_HINT = USE_MOCK || /^https:\/\//i.test(API_BASE || '')
  ? ''
  : '测试后端不是 HTTPS：真机需配置 HTTPS 域名并加入小程序 request 合法域名；开发者工具/真机调试可开启「不校验合法域名」';
const {
  getViewport,
  BRAND,
  TABS,
  clone,
  pad2,
  todayDot,
  stampDate,
  fmt,
  fmtShort,
  isoWeekKey,
  cardDone,
  setVM,
  finishDate,
  getRec,
  recCount,
  hasRecPending,
  stampedCount,
  dateKeyOf,
  todayKey,
  weekMondayKey,
  _keyPlus,
  TMPL_IDS,
  REMIND_TIMES,
  CATS,
  catChipOf,
} = core;

const { PAGE_OPTS } = require('./base.js');
const { overrides } = require('./overrides.js');

/* ═══════════ D4 · set/draw 独立 + 守卫 + 收益 api ═══════════ */
const d4Overrides = {


  retryBoot() {
    this.setData({ booting: true, bootError: false });
    core.ensureBoot()
      .then(() => {
        if (['set', 'draw', 'map'].includes(this.__page) && this.S.cur != null) {
          return core.ensureSetDetail(this.S.cur);
        }
        return null;
      })
      .then(() => { this.__renderSelf(); this.setData({ booting: false }); })
      .catch(() => this.setData({ bootError: true, booting: false }));
  },

  goSetView(id) {
    if (id != null) this.S.cur = id;
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const beneath = stack.length > 1 ? stack[stack.length - 2] : null;
    if (beneath && beneath.route === 'pages/set/index') { wx.navigateBack(); return; }
    wx.redirectTo({ url: '/pages/set/index' + (this.S.cur != null ? '?sid=' + this.S.cur + '&nav=1' : '') });
  },


  backToSet() {
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const beneath = stack.length > 1 ? stack[stack.length - 2] : null;
    if (beneath && beneath.route === 'pages/set/index') wx.navigateBack();
    else wx.redirectTo({ url: '/pages/set/index' + (this.S.cur != null ? '?sid=' + this.S.cur + '&nav=1' : '') });
  },


  backToCreate() { wx.switchTab({ url: '/pages/create/index' }); },
  backToHome()   { wx.switchTab({ url: '/pages/home/index' }); },

  /* 订阅页/首页跳详情：走独立 set 页，不替换当前 tab */
  goSubsDraw(sid, from) {
    const s = this.S.sets.find(x => x.id === sid);
    if (!s) return;
    this.S.cur = sid;
    if (setVM(s).act === 'draw') this.startDraw(sid);
    else this.go('set');
  },
  goSubsView(sid, from) {
    if (sid != null) this.S.cur = sid;
    this.go('set');
  },

  /* ── render 守卫 ── */
  renderHome() {
    if (this.__page !== 'home') return;
    PAGE_OPTS.renderHome.call(this);
  },
  renderSubs() {
    if (this.__page !== 'cards') return;
    return overrides.renderSubs.call(this);
  },
  renderCraft() {
    if (this.__page !== 'create') return;
    PAGE_OPTS.renderCraft.call(this);
  },
  renderMe() {
    if (this.__page !== 'me') return;
    PAGE_OPTS.renderMe.call(this);
  },
  renderSetPage() {
    if (this.__page !== 'set') return;
    overrides.renderSetPage.call(this);
  },
  renderDraw() {
    if (this.__page !== 'draw') return;
    PAGE_OPTS.renderDraw.call(this);
  },

  /* ── doUnlock：draw 页原地续抽 ── */
  doUnlock() {
    const S = this.S;
    if (!S.pw || this.data.pay.paying) return;
    const targetId = S.pw;
    this.setData({ 'pay.paying': true, 'pay.payText': '支付中…' });
    api.unlock({ setId: targetId })
      .then(res => {
        S.pw = null;
        this.applySetPayload(res.set);
        this.setData({ 'pay.show': false, 'pay.paying': false });
        const s = S.sets.find(x => x.id === targetId);

        /* draw 页封条态：先播封条坠落，再回到 is-idle 等用户点抽 */
        if (this.__page === 'draw' && this.data.draw && this.data.draw.sealed) {
          this.setData({ 'draw.unsealing': true });
          setTimeout(() => {
            if (this.__page !== 'draw') return;
            this.renderDraw();
            if (s && s.user && !s.user.todayDrawn && !s.user.trialToday) {
              this.toast('解锁成功 · 今天的签可以抽了');
            } else {
              this.toast('已解锁。今天的卡，明天 0 点到。');
            }
          }, 300);
          return;
        }

        this.__renderSelf();
        if (s && s.user && !s.user.todayDrawn && !s.user.trialToday) {
          this.toast('解锁成功，这张签送你。');
          if (this.__page === 'draw') {
            this.renderDraw();
            setTimeout(() => this.tapEnvelope(), 260);
          } else {
            setTimeout(() => this.startDraw(s.id), 260);
          }
        } else {
          this.toast('已解锁。今天的卡，明天 0 点到。');
        }
      })
      .catch(() => {
        this.setData({ 'pay.paying': false, 'pay.payText': `解锁 · ¥${this.data.pay.price}` });
        this.toast('支付未完成，请重试');
      });
  },

  /* ── 收益 api 化 ── */
  async renderIncome() {
    if (this.__page !== 'income') return;
    const seq = (this._incomeSeq || 0) + 1;
    this._incomeSeq = seq;
    try {
      const d = await api.getIncome();
      if (seq !== this._incomeSeq) return;
      this.S.incomeData = d;
      const paidSets = d.bySet || [];
      this.setData({
        bootError: false,
        income: {
          exists: true,
          totalText: `¥${d.total.toFixed(2)}`,
          availText: `¥${d.avail.toFixed(2)}`,
          pendingText: `¥${d.pending.toFixed(2)}`,
          withdrawnText: `¥${d.withdrawn.toFixed(2)}`,
          platformText: `¥${(d.platform || 0).toFixed(2)}`,
          paidTotalText: `¥${paidSets.reduce((a, x) => a + (x.earn || 0), 0).toFixed(2)}`,
          buyersTotal: paidSets.reduce((a, x) => a + (x.buyers || 0), 0),
          threshold: d.threshold,
          canWithdraw: d.avail >= d.threshold,
          withdrawPct: Math.min(100, d.avail / d.threshold * 100),
          withdrawLabel: d.avail >= d.threshold ? `已达标 · 可提现 ¥${d.avail.toFixed(2)}` : `还差 ¥${(d.threshold - d.avail).toFixed(2)} 即可提现`,
          withdrawBtn: d.avail >= d.threshold ? `提现到微信零钱 · ¥${d.avail.toFixed(2)}` : `满 ¥${d.threshold} 可提现`,
          hasPending: d.pending > 0,
          showComposition: paidSets.length > 0 || (d.platform || 0) > 0,
          paidSetN: paidSets.length,
          bySet: paidSets.map(x => ({
            title: x.title,
            meta: `${x.buyers || 0} 人解锁 · ¥${x.price} · 份额 80%`,
            val: `¥${(x.earn || 0).toFixed(2)}`,
          })),
          txns: (d.txns || []).map(t => ({
            d: t.d, meta: t.meta, amt: `+¥${t.amt.toFixed(2)}`,
            title: `平台激励 · ${t.t}`,
          })),
          showDetail: d.total > 0,
        },
      });
    } catch (e) {
      if (seq !== this._incomeSeq) return;
      if (!(this.data.income && this.data.income.exists)) this.setData({ bootError: true });
    }
  },

  async doWithdraw() {
    const d = this.S.incomeData;
    if (!d || d.avail < d.threshold) return;
    this.toast(`提现 ¥${d.avail.toFixed(2)} 已申请，1–3 个工作日到账。`);
    try {
      this.S.incomeData = await api.withdraw();
      this.renderIncome();
    } catch (e) {
      this.toast((e && e.message) || '提现没成功，再试一次');
    }
  },


  refreshIncome() {
    const seq = (this._refreshIncomeSeq || 0) + 1;
    this._refreshIncomeSeq = seq;
    return api.getIncome().then(d => {
      if (seq !== this._refreshIncomeSeq) return;
      this.S.incomeData = d;
    }).catch(() => {});
  },
};


module.exports = { d4Overrides };
