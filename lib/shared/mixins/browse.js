/* lib/shared/mixins/browse.js — 发现 / 搜索 / 分类领域方法
 * 从 base.js 拆出；依赖注入保持与 base 相同的 API 形状。
 */
const core = require('../../core.js');
const { CATS, setVM, catChipOf } = core;

module.exports = {
  renderHome() {
    const S = this.S;
    const sets = S.sets || [];
    const cat = this._hmCat || 'all';
    let pool;
    if (cat !== 'all') pool = sets.filter(s => s.cat === cat);
    else pool = sets.slice().sort((a, b) => S.sort === 'hot'
      ? (b.heat || 0) - (a.heat || 0)
      : (b.date || '').localeCompare(a.date || ''));

    const rows = pool.map(s => this._bookRow(s));
    const cnt = {};
    sets.forEach(s => { cnt[s.cat] = (cnt[s.cat] || 0) + 1; });
    const chipColors = {
      food: '', work: 'honey', city: 'rose', mood: 'rose',
      life: 'mint', bond: 'honey', muse: 'honey', walk: 'mint', know: 'honey',
    };
    const chips = [{ key: 'all', chip: '推荐', color: '', on: cat === 'all' }]
      .concat(CATS.filter(c => cnt[c.key] > 0).map(c => ({
        key: c.key, chip: c.name, color: chipColors[c.key] || '', on: cat === c.key,
      })));
    const dailySet = sets.find(x => setVM(x).act === 'draw') || sets[0] || null;
    const daily = dailySet
      ? { id: dailySet.id, title: dailySet.title, canDraw: setVM(dailySet).act === 'draw' }
      : null;
    const catItem = CATS.find(c => c.key === cat);
    const title = cat === 'all' ? '为你推荐' : ((catItem ? catItem.name : '') + '卡集');
    this.setData({
      home: {
        chips, rows, sort: S.sort, daily, title,
      },
    });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/index' });
  },

  tapDaily(e) {
    const id = Number(e.currentTarget.dataset.id);
    const s = this.S.sets.find(x => x.id === id);
    if (!s) return;
    if (setVM(s).act === 'draw') this.startDraw(id);
    else this.openSetById(id, 'home');
  },

  stopSearchTimer() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = null;
  },

  onSearchInput(e) {
    const v = String((e.detail && e.detail.value) || '').slice(0, 30);
    this._searchQ = v;
    this.setData({ 'search.q': v });
    this.stopSearchTimer();
    this._searchTimer = setTimeout(() => this.renderSearch(), 120);
  },

  onSearchConfirm() {
    this.stopSearchTimer();
    this.renderSearch();
  },

  tapSearchWord(e) {
    const q = (e.currentTarget.dataset.q || '').slice(0, 30);
    this._searchQ = q;
    this.setData({ 'search.q': q, 'search.focus': false });
    this.renderSearch();
  },

  clearSearch() {
    this.stopSearchTimer();
    this._searchQ = '';
    this.setData({ 'search.q': '', 'search.focus': true });
    this.renderSearch();
  },

  closeSearch() {
    this.stopSearchTimer();
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  _searchScore(s, terms) {
    const title = (s.title || '').toLowerCase();
    const cov = ((s.covT || '') + ' ' + (s.covS || '')).toLowerCase();
    const creator = (s.creator || '').toLowerCase();
    const category = catChipOf(s.cat).toLowerCase();
    const intro = (s.intro || '').toLowerCase();
    const cards = (s.poolText || (s.pool || []).map(c => ((c && c.w) || '') + ' ' + ((c && c.b) || '')).join(' ')).toLowerCase();
    let score = 0;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const inTitle = title.includes(term);
      const inCov = cov.includes(term);
      const inCreator = creator.includes(term);
      const inCategory = category.includes(term);
      const inIntro = intro.includes(term);
      const inCards = cards.includes(term);
      if (!(inTitle || inCov || inCreator || inCategory || inIntro || inCards)) return -1;
      if (inTitle) {
        score += 40;
        if (title === term) score += 120;
        else if (title.startsWith(term)) score += 60;
      }
      if (inCov) score += 15;
      if (inCreator) score += 35;
      if (inCategory) score += 30;
      if (inIntro) score += 15;
      if (inCards) score += 10;
    }
    return score;
  },

  renderSearch() {
    const base = this.data.search || {};
    const q = String(this._searchQ || '').trim();
    if (!q) {
      this.setData({ search: Object.assign({}, base, { q: '', rows: [], resultText: '' }) });
      return;
    }
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = (this.S.sets || [])
      .map(s => ({ s, score: this._searchScore(s, terms) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score
        || (b.s.heat || 0) - (a.s.heat || 0)
        || (b.s.date || '').localeCompare(a.s.date || ''))
      .map(x => this._bookRow(x.s));
    this.setData({
      search: Object.assign({}, base, {
        q,
        rows,
        resultText: rows.length ? `“${q}” · ${rows.length} 个卡集` : '',
      }),
    });
  },


  setCat(e) {
    this._hmCat = e.currentTarget.dataset.key || 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  /* 三宫格：分类 → 九类索引页 */
  tapQuickCat() {
    this.goCategories();
  },

  goCategories() {
    wx.navigateTo({ url: '/pages/categories/index' });
  },

  renderCategories() {
    const sets = this.S.sets || [];
    const items = CATS.map(c => {
      const pool = sets.filter(s => s.cat === c.key)
        .sort((a, b) => (b.heat || 0) - (a.heat || 0)
          || (b.date || '').localeCompare(a.date || ''));
      const rep = pool[0] || null;
      const cvm = rep ? core.setCoverVM(rep) : null;
      const t = core.inkTints(c.key);
      const count = pool.length;
      return {
        key: c.key,
        name: c.name,
        count,
        countText: count ? count + ' 个卡集' : '待上新',
        empty: !count,
        coverImage: rep ? (rep.coverImage || '') : '',
        coverNo: cvm ? cvm.noText : '',
        coverText: rep ? ((rep.covT || rep.title || '').slice(0, 4)) : '待上新',
        tintStyle: cvm ? cvm.tintStyle : '',
        ink: cvm ? cvm.ink : t.ink,
        cover: rep
          ? Object.assign({}, core.coverVMOf(rep), { compact: true })
          : {
            variant: core.COVER_VARIANT[c.key] || 'arch',
            countText: '00', title: '待上新', creator: '',
            coverImage: '', hasImg: false, compact: true,
          },
      };
    });
    this.setData({ categories: { items, total: sets.length } });
  },

  tapCategory(e) {
    const key = e.currentTarget.dataset.key;
    const item = (this.data.categories.items || []).find(x => x.key === key);
    if (!item || item.empty) {
      this.toast('这个分类还没有卡集');
      return;
    }
    this.S.pendingCat = key;
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) });
  },

  consumePendingCat() {
    const key = this.S && this.S.pendingCat;
    if (!key) return false;
    this.S.pendingCat = null;
    this._hmCat = key;
    return true;
  },

  /* 三宫格：热门活动 → 最热榜单 */
  tapQuickHot() {
    this.S.sort = 'hot';
    this._hmCat = 'all';
    this.renderHome();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    this.toast('已切换至热门榜单');
  },

  setSort(e) {
    this.S.sort = e.currentTarget.dataset.sort;
    this.renderHome();
  },


};
