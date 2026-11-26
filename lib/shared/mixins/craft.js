/* lib/shared/mixins/craft.js — 创作 / 编辑 / 审核领域方法
 * 从 base.js 拆出；依赖注入保持与 base 相同的 API 形状。
 */
const core = require('../../core.js');
const { CATS, catChipOf, fmt, fmtShort, cardDone } = core;

module.exports = {
  renderCraft() {
    const S = this.S;
    const me = core.creatorName(S);
    const pub = S.sets.filter(s => core.isOwnSet(s));
    if (!pub.length && !S.craft.reviewing.length && !S.craft.drafts.length) {
      this.setData({ craft: { empty: true, groups: [] } });
      return;
    }
    const earn = this.S.incomeData ? this.S.incomeData.total : 0;
    const fansN = (S.fans && S.fans[me]) || 0;
    const likeN = pub.reduce((a, s) => {
      const soc = S.social && S.social[s.id];
      return a + (soc ? (soc.likes || 0) : 0);
    }, 0);
    const rvRows = S.craft.reviewing.map(d => {
      const complete = d.pool.filter(cardDone).length;
      return {
        id: d.id,
        title: (d.title || '').trim() || '未命名',
        meta: `${complete} 张完整 · 提交于 ${d.submitted || ''}`,
        badge: 'review',
        badgeText: '审核中',
        cover: Object.assign({}, core.coverVMOf({
          id: d.id, cat: d.cat, title: d.title || '未命名',
          count: d.pool.length, pool: d.pool, coverImage: d.coverImage, creator: me,
        }), { compact: true }),
      };
    });
    const drRows = S.craft.drafts.map(d => {
      const complete = d.pool.filter(cardDone).length;
      const total = Math.max(d.pool.length, 8);
      const pct = Math.round(complete / total * 100);
      return {
        id: d.id,
        title: (d.title || '').trim() || '未命名草稿',
        meta: `${complete}/${total} 张完整 · 完成度 ${pct}%`,
        badge: 'draft',
        badgeText: '草稿',
        cover: Object.assign({}, core.coverVMOf({
          id: d.id, cat: d.cat, title: d.title || '未命名',
          count: d.pool.length, pool: d.pool, coverImage: d.coverImage, creator: me,
        }), { compact: true }),
      };
    });
    const pubRows = pub.map(s => ({
      id: s.id,
      title: s.title,
      meta: `被抽 ${fmt(s.totalDrawn || 0)} 次${s.earn ? ` · 收益 ¥${s.earn.toFixed(2)}` : ''}`,
      badge: 'pub',
      badgeText: '已上架',
      cover: Object.assign({}, core.coverVMOf(s), { compact: true }),
    }));
    const groups = [];
    if (rvRows.length) groups.push({ name: '审核中', status: 'review', count: rvRows.length, rows: rvRows, kind: 'review' });
    if (drRows.length) groups.push({ name: '草稿', status: 'draft', count: drRows.length, rows: drRows, kind: 'draft' });
    if (pubRows.length) groups.push({ name: '已上架', status: 'pub', count: pubRows.length, rows: pubRows, kind: 'pub' });
    this.setData({
      craft: {
        empty: false,
        pubN: pub.length,
        fansN,
        fansText: fmtShort(fansN),
        likeN,
        likeText: fmtShort(likeN),
        reviewN: S.craft.reviewing.length,
        draftN: S.craft.drafts.length,
        earn,
        incomeText: `¥${earn.toFixed(2)}`,
        groups,
      },
    });
  },

  newCraft() {
    const S = this.S;
    const d = {
      id: ++S.seq, title: '', intro: '', type: 'collect', cat: 'muse', price: 0, trial: 0, status: 'draft',
      coverImage: '',
      signatureIdx: -1, signatureNote: '', signaturePublic: false,
      pool: Array.from({ length: 8 }, () => ({ w: '', b: '' })),
    };
    S.craft.drafts.push(d);
    this.openEdit(d.id);
  },


  renderEdit() {
    const S = this.S;
    const d = S.ed;
    if (!d) return;
    d.price = core.normalizePrice(d.price);
    const complete = d.pool.filter(cardDone).length;
    const cards = d.pool.map((c, i) => ({
      index: i,
      badge: '',
      w: c.w || '',
      b: c.b || '',
      label: (c.w || '').trim() || '未命名',
      blank: !(c.w || '').trim(),
      cnt: ((c.w || '').trim() ? 1 : 0) + ((c.b || '').trim() ? 1 : 0),
      open: S.edOpen === i,
      isSig: i === (d.signatureIdx != null ? d.signatureIdx : -1),
    }));
    this.setData({
      edit: {
        mode: 'edit',
        headTitle: '编辑卡集',
        coverImage: d.coverImage || '',
        title: d.title || '',
        intro: d.intro || '',
        type: d.type,
        cat: d.cat,
        price: d.price,
        cats: CATS.map(c => ({ key: c.key, chip: c.name })),
        prices: core.PRICE_TIERS.slice(),
        complete,
        countText: `卡 · ${complete} 张完整`,
        cards,
        signatureOn: (d.signatureIdx != null ? d.signatureIdx : -1) >= 0,
        signatureNote: d.signatureNote || '',
        footerTitle: (d.title || '').trim() || '未命名',
      },
    });
  },

  onEditTitle(e) {
    if (!this.S.ed) return;
    this.S.ed.title = e.detail.value;
    this.setData({
      'edit.title': e.detail.value,
      'edit.footerTitle': (e.detail.value || '').trim() || '未命名',
    });
  },

  onEditIntro(e) {
    if (!this.S.ed) return;
    this.S.ed.intro = e.detail.value;
  },

  /* 卡集封面：固定 3:4 裁剪后写入草稿 */
  chooseCover() {
    if (!this.S.ed) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles && res.tempFiles[0]) || null;
        if (!file) return;
        this.cropCover(file.tempFilePath);
      },
    });
  },

  cropCover(src) {
    if (!src) return;
    if (typeof wx.cropImage !== 'function') {
      this.applyCover(src);
      this.toast('当前版本不支持裁剪，已使用原图');
      return;
    }
    wx.cropImage({
      src,
      cropScale: '3:4',
      success: (res) => {
        if (res && res.tempFilePath) this.applyCover(res.tempFilePath);
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        if (/cancel/i.test(msg)) return;
        this.applyCover(src);
        this.toast('裁剪失败，已使用原图');
      },
    });
  },

  applyCover(path) {
    if (!this.S.ed) return;
    this.S.ed.coverImage = path;
    this.setData({ 'edit.coverImage': path });
    this.toast('封面已更新');
  },

  clearCover() {
    if (!this.S.ed) return;
    this.S.ed.coverImage = '';
    this.setData({ 'edit.coverImage': '' });
  },

  onEditCardInput(e) {
    const S = this.S;
    if (!S.ed) return;
    const i = Number(e.currentTarget.dataset.index);
    const key = e.currentTarget.dataset.key;
    const c = S.ed.pool[i];
    if (!c) return;
    c[key] = e.detail.value;
    const complete = S.ed.pool.filter(cardDone).length;
    const patch = {
      [`edit.cards[${i}].label`]: (c.w || '').trim() || '未命名',
      [`edit.cards[${i}].blank`]: !(c.w || '').trim(),
      [`edit.cards[${i}].cnt`]: ((c.w || '').trim() ? 1 : 0) + ((c.b || '').trim() ? 1 : 0),
      'edit.complete': complete,
      'edit.countText': `卡 · ${complete} 张完整`,
    };
    this.setData(patch);
  },

  edType(e) {
    const S = this.S;
    S.ed.type = e.currentTarget.dataset.type;
    this.renderEdit();
  },

  edCat(e) {
    const S = this.S;
    S.ed.cat = e.currentTarget.dataset.cat;
    this.renderEdit();
  },

  edPrice(e) {
    const S = this.S;
    const p = Number(e.currentTarget.dataset.price);
    S.ed.price = p;
    S.ed.trial = p > 0 ? 1 : 0;
    this.renderEdit();
  },

  edToggle(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    S.edOpen = (S.edOpen === i ? null : i);
    this.renderEdit();
  },

  edToggleSignature(e) {
    const S = this.S;
    if (!S.ed) return;
    const i = Number(e.currentTarget.dataset.index);
    const on = (e.detail && e.detail.value != null)
      ? !!e.detail.value
      : e.currentTarget.dataset.on === 'true';
    const prev = S.ed.signatureIdx;
    if (!on) {
      if (prev === i) {
        S.ed.signatureIdx = -1;
        S.ed.signatureNote = '';
        this.renderEdit();
      }
      return;
    }
    if (prev >= 0 && prev !== i) {
      const prevWord = (S.ed.pool[prev] && S.ed.pool[prev].w) || '上一张';
      this.toast(`题眼已从「${prevWord}」移到这张`);
    }
    S.ed.signatureIdx = i;
    S.ed.signatureNudgeSkipped = false;
    this.renderEdit();
  },

  onSignatureNote(e) {
    const S = this.S;
    if (!S.ed) return;
    const v = (e.detail.value || '').slice(0, 30);
    S.ed.signatureNote = v;
    this.setData({ 'edit.signatureNote': v });
  },

  edAddCard() {
    const S = this.S;
    S.ed.pool.push({ w: '', b: '' });
    S.edOpen = S.ed.pool.length - 1;
    this.renderEdit();
  },

  edDelCard(e) {
    const S = this.S;
    const i = Number(e.currentTarget.dataset.index);
    const wasSig = S.ed.signatureIdx === i;
    S.ed.pool.splice(i, 1);
    if (wasSig) {
      S.ed.signatureIdx = -1;
      S.ed.signatureNote = '';
      S.ed.signatureNudgeSkipped = false;
      this.toast('这张卡是题眼，删除后题眼将取消');
    } else if (S.ed.signatureIdx > i) {
      S.ed.signatureIdx -= 1;
    }
    S.edOpen = null;
    this.renderEdit();
  },

  validateCraft(d) {
    const errs = [];
    if (!(d.title || '').trim() || d.title.trim().length < 2) errs.push('标题：至少 2 个字');
    if (!(d.intro || '').trim() || d.intro.trim().length < 10) errs.push('简介：至少 10 个字，给抽卡人一个预期');
    if (!d.coverImage) errs.push('封面：请上传一张 3:4 的卡集封面');
    const complete = d.pool.filter(cardDone);
    if (complete.length < 8) errs.push(`完整的卡：至少 8 张，现在 ${complete.length} 张（词、解释都齐才算完整）`);
    const long = d.pool.filter(c => (c.w || '').trim().length > 24);
    if (long.length) errs.push(`卡面最多 24 个字，现在有 ${long.length} 张超长`);
    if (d.price > 0 && d.trial !== 1) errs.push('定价卡集：需要 1 张免费试抽');
    return errs;
  },


  skipSignatureNudge() {
    const S = this.S;
    if (!S.ed) return;
    S.ed.signatureNudgeSkipped = true;
    this.setData({ 'nudge.show': false });
    this.tryPublish();
  },

  goSignatureNudge() {
    const S = this.S;
    if (!S.ed) return;
    this.setData({ 'nudge.show': false });
    S.edOpen = 0;
    this.renderEdit();
    this.toast('在卡片里打开「设为本集题眼」');
    wx.pageScrollTo({ selector: '.ed-card', duration: 220 });
  },

  closeCheck() {
    this.setData({ 'check.show': false });
  },

  closePub() {
    this.setData({ 'pub.show': false });
  },



  renderReview() {
    const S = this.S;
    const d = S.rv;
    if (!d) return;
    d.price = core.normalizePrice(d.price);
    const complete = d.pool.filter(cardDone);
    this.setData({
      edit: {
        mode: 'review',
        headTitle: '审核中',
        title: d.title,
        intro: d.intro,
        submitted: d.submitted || '',
        meta: `${d.type === 'collect' ? '收藏集' : '常驻集'} · ${catChipOf(d.cat)} · ${complete.length} 张 · ${d.price > 0 ? `¥${d.price}（前 ${d.trial} 张免费试抽）` : '免费'}`,
        signatureOn: d.signatureIdx >= 0,
        cards: d.pool.map((c, i) => ({ c, i })).filter(x => cardDone(x.c))
          .map(x => ({ badge: '', w: x.c.w, b: x.c.b, isSig: x.i === d.signatureIdx })),
        count: complete.length,
      },
    });
  },




  /* ──────────────────────────────────────────────────────────
     收益看板
     ────────────────────────────────────────────────────────── */



  /* ──────────────────────────────────────────────────────────
     创作者主页
     ────────────────────────────────────────────────────────── */


  /* ──────────────────────────────────────────────────────────
     我的
     ────────────────────────────────────────────────────────── */

};
