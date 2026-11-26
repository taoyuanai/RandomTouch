/* lib/shared/mixins/poster.js — 海报 / 周记领域方法
 * 从 base.js 拆出；依赖注入保持与 base 相同的 API 形状。
 */
const core = require('../../core.js');
const api = require('../../../services/api.js');
const tracker = require('../../track.js');
const posterKit = require('../../../utils/posterKit/export.js');
const { pad2 } = core;
const QR_BLANK = '/assets/icons/qr-blank.png';

module.exports = {
  ensureDrawnLog(s) {
    const u = s && s.user;
    if (!u || s.type !== 'collect' || !u.got || !u.got.length) return;
    if (!u.drawnLog) {
      // 演示数据兜底：把已有的 got 摊到最近 N 天，保证历史集合也能看周记
      const now = Date.now();
      u.drawnLog = u.got.map((idx, i) => {
        const d = new Date(now - (u.got.length - 1 - i) * 86400000);
        return {
          idx,
          date: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
          ts: d.getTime(),
        };
      });
      return;
    }
    // api 返回的 drawnLog 只有 {idx,ts}，补齐页面周记需要的展示日期
    u.drawnLog.forEach(e => {
      if (!e || e.date || !e.ts) return;
      const d = new Date(e.ts);
      e.date = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    });
  },

  weeklyState(s, qrSrc) {
    if (!s || s.type !== 'collect') return { ready: false };
    this.ensureDrawnLog(s);
    const data = posterKit.buildWeeklyData(s, { qrSrc: qrSrc || '', now: Date.now() });
    if (!data || data.stats.drawn < 7) return { ready: false };
    return {
      ready: true,
      data,
      weekNo: data.weekNo,
      cards: data.cards,
      stamps: data.stamps,
      stampN: data.stats.stamped,
      streak: data.stats.streak,
      drawnN: data.stats.drawn,
      title: data.titleText,
      range: data.dateRangeText,
      kicker: data.kicker,
      variant: data.layout,
      photos: data.photos,
      wordLine: data.wordLine,
      quote: data.quote,
    };
  },

  weeklyKey(s, weekNo) {
    return `${s.id}:${weekNo}`;
  },

  isWeeklyMade(s, weekNo) {
    return !!this.S.weeklyMade[this.weeklyKey(s, weekNo)];
  },


  weeklyForSet(s) {
    const w = this.weeklyState(s);
    if (!w.ready || this.isWeeklyMade(s, w.weekNo)) return null;
    return w;
  },

  async openWeekly(e) {
    const S = this.S;
    const d = e && e.currentTarget && e.currentTarget.dataset;
    const id = d && d.id != null ? Number(d.id) : S.cur;
    let s = S.sets.find(x => x.id === id);
    if (!s) return;
    if (!S.detailLoaded[id]) {
      try { await core.ensureSetDetail(id); s = S.sets.find(x => x.id === id); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
      if (!s) return;
    }
    const qrSrc = await this._posterQR(s.id);
    const w = this.weeklyState(s, qrSrc);
    if (!w.ready) {
      this.toast('再抽几张，抽满 7 张就能生成周记');
      return;
    }
    this.markWeeklyMade(s, w.weekNo);
    S.posterType = 'weekly';
    S.posterExport = w.data;                         // 预览与导出共用同一份数据
    this.setData({
      poster: {
        show: true,
        kind: 'weekly',
        booklet: false,
        ratio: '34',
        sid: s.id,
        title: w.title,
        kicker: w.kicker,
        range: w.range,
        cards: w.cards,
        stamps: w.stamps,
        stampN: w.stampN,
        streak: w.streak,
        drawnN: w.drawnN,
        weekNo: w.weekNo,
        variant: w.variant,
        photos: w.photos,
        qrSrc,
        wordLine: w.wordLine,
        quote: w.quote,
      },
    });
    this.renderSubs();
    if (this.__page === 'set') this.renderSetPage();
  },

  setPosterRatio(e) {
    this.setData({ 'poster.ratio': e.currentTarget.dataset.ratio });
  },

  /* ── V2.6 · Canvas 周记导出（posterKit） ── */
  async openWeeklyPoster(e) {
    const S = this.S;
    const d = e && e.currentTarget && e.currentTarget.dataset;
    const id = d && d.id != null ? Number(d.id) : S.cur;
    let s = S.sets.find(x => x.id === id);
    if (!s) return;
    if (!S.detailLoaded[id]) {
      try { await core.ensureSetDetail(id); s = S.sets.find(x => x.id === id); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
      if (!s) return;
    }
    // qrSrc：服务端 wxacode.getUnlimited({ scene: `p=w&s=${s.id}` }) 的结果，
    // 缓存后传入；传空字符串会渲染 QR 占位框，不报错。
    const qrSrc = await this._posterQR(id);
    const w = this.weeklyState(s, qrSrc);
    if (!w.ready) { this.toast('本周还没有抽卡记录'); return; }

    // 渠道选择：小红书 3:4 / 朋友圈 9:16
    const tap = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['小红书 · 3:4', '朋友圈 · 9:16'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (tap < 0) return;
    await this.exportWeeklyById(id, tap === 1 ? '916' : '34', w.data);
  },

  /** 按指定比例生成并保存周记；预览弹层保存也走这里 */
  async exportWeeklyById(id, ratio, preset) {
    const S = this.S;
    const s = S.sets.find(x => x.id === id);
    if (!s) return;
    const data = preset || posterKit.buildWeeklyData(s, { qrSrc: await this._posterQR(id) });
    if (!data) { this.toast('本周还没有抽卡记录'); return; }
    const noQR = !data.qrSrc;
    wx.showLoading({ title: '生成中', mask: true });
    try {
      const temp = ratio === '916'
        ? await posterKit.exportWeekly916(data)
        : await posterKit.exportWeekly34(data);
      await posterKit.saveToAlbum(temp);
      tracker.t('poster_save', { type: 'weekly' });
      this.markWeeklyMade(s, data.weekNo);
      this.renderSubs();
      if (this.__page === 'set') this.renderSetPage();
      if (this.data.poster.show) this.setData({ 'poster.show': false });
      this.toast(noQR ? '周记已保存（无二维码版）· 配置分享码后会自动带上二维码' : (ratio === '916' ? '朋友圈版已保存 📸' : '周记已保存到相册 📸'));
    } catch (err) {
      console.warn(err);
      this.toast('生成失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },




  async _posterQR(sid) {
    try {
      const r = await api.getPosterQR({ setId: Number(sid) });
      return (r && r.path) || '';
    } catch (e) { return ''; }
  },

  buildHighlight(c, s, opts = {}) {
    if (!c || !s) return null;
    return posterKit.buildHighlightData(s, c, opts);   // 唯一真相源：预览与导出同源
  },

  async openPoster(e) {
    const type = (e && e.currentTarget && e.currentTarget.dataset.type) || 'draw';
    const S = this.S;
    S.posterType = type;
    const d = (e && e.currentTarget && e.currentTarget.dataset) || {};
    let data = null;
    let sid = d.sid != null ? Number(d.sid) : S.cur;
    if ((type === 'card' || type === 'big' || type === 'memorial') && !S.detailLoaded[sid]) {
      try { await core.ensureSetDetail(sid); }
      catch (e) { this.toast('卡面加载失败，再试一次'); return; }
    }
    if (type === 'memorial') {
      data = this.buildMemorialPoster({ sid, qrSrc: await this._posterQR(sid) });
    } else if (type === 'card') {
      const s = S.sets.find(x => x.id === sid);
      if (!s) return;
      let idx;
      if (d.idx != null) {
        idx = Number(d.idx);
      } else {
        const gotArr = (s.user && s.user.got) || [];
        idx = gotArr.length ? gotArr[gotArr.length - 1] : 0;
      }
      const c = s.pool[idx];
      if (!c) return;
      data = this.buildHighlight(c, s, {
        idx,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
        qrSrc: await this._posterQR(sid),
      });
    } else if (type === 'big') {
      // 回看场景：分享当前大卡的这一张
      const idx = Number(d.idx != null ? d.idx : 0);
      const s = S.sets.find(x => x.id === sid);
      if (!s || !s.pool[idx]) return;
      data = this.buildHighlight(s.pool[idx], s, {
        idx,
        no: `No.${pad2(idx + 1)} / ${s.pool.length}`,
        slogan: '扫码抽一张',
        qrSrc: await this._posterQR(sid),
      });
    }
    if (!data) return;
    if (data.rec) {
      const sec = data.rec.sec || {};
      if (sec.text === 'pending') { this.toast('回信安全校验中 · 稍等片刻再分享'); return; }
      if (sec.text === 'risky') { this.toast('这条回信暂不支持生成海报'); return; }
      if (data.rec.img) {
        if (sec.media === 'pending') { this.toast('照片安全校验中 · 稍等片刻再分享'); return; }
        if (sec.media === 'risky') { this.toast('这张照片暂不支持生成海报'); return; }
      }
    }
    S.posterExport = data;                            // ← 供 savePoster 真实导出
    this.setData({ poster: Object.assign({ show: true, booklet: !!data.rec, ratio: '34' }, data) });
  },

  buildMemorialPoster(opts = {}) {
    const S = this.S;
    const s = S.sets.find(x => x.id === (opts.sid != null ? opts.sid : S.cur));
    if (!s) return null;
    return posterKit.buildMemorialData(s, opts);   // 唯一真相源：预览与导出同源
  },

  hidePoster() {
    this.setData({ 'poster.show': false });
  },

  async savePoster() {
    const S = this.S;
    const type = S.posterType;

    // 周记：按当前预览比例走 posterKit 的真实 Canvas 导出；复用预览数据，不重建
    if (this.data.poster.kind === 'weekly') {
      const sid = this.data.poster.sid;
      const preset = S.posterExport && S.posterExport.setId === sid ? S.posterExport : null;
      this.exportWeeklyById(
        sid,
        this.data.poster.ratio === '916' ? '916' : '34',
        preset
      );
      return;
    }

    // booklet（长图纪念册）尚未 Canvas 化，维持演示提示
    if (type === 'booklet') {
      this.toast('纪念册已保存到相册 📸');
      setTimeout(() => this.setData({ 'poster.show': false }), 800);
      return;
    }

    const data = S.posterExport;
    if (!data || (data.kind !== 'highlight' && data.kind !== 'memorial')) {
      this.toast('生成失败，请重试');
      return;
    }
    const noQR = !data.qrSrc;
    if (noQR) data.qrSrc = QR_BLANK;

    const tap = await new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['小红书 · 3:4', '朋友圈 · 9:16'],
        success: (r) => resolve(r.tapIndex),
        fail: () => resolve(-1),
      });
    });
    if (tap < 0) return;

    wx.showLoading({ title: '生成中', mask: true });
    try {
      const temp = data.kind === 'memorial'
        ? (tap === 1 ? await posterKit.exportMemorial916(data) : await posterKit.exportMemorial34(data))
        : (tap === 1 ? await posterKit.exportHighlight916(data) : await posterKit.exportHighlight34(data));
      await posterKit.saveToAlbum(temp);
      tracker.t('poster_save', { type: this.S.posterType });
      this.toast(noQR ? '海报已保存（无二维码版）· 配置分享码后会自动带上二维码' : '海报已保存到相册 📸');
      setTimeout(() => this.setData({ 'poster.show': false }), 800);
    } catch (e) {
      console.warn(e);
      this.toast('保存失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

};
