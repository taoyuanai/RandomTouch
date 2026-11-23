// custom-tab-bar/index.js — V6 自定义 tabBar（Demo 线框图标 + 毛玻璃）
Component({
  options: { addGlobalClass: true },
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', text: '发现', icon: '/assets/icons/v6/tab-home.png', iconOn: '/assets/icons/v6/tab-home-on.png' },
      { pagePath: '/pages/cards/index', text: '订阅', icon: '/assets/icons/v6/tab-cards.png', iconOn: '/assets/icons/v6/tab-cards-on.png' },
      { pagePath: '/pages/create/index', text: '创作', icon: '/assets/icons/v6/tab-create.png', iconOn: '/assets/icons/v6/tab-create-on.png' },
      { pagePath: '/pages/me/index', text: '我的', icon: '/assets/icons/v6/tab-me.png', iconOn: '/assets/icons/v6/tab-me-on.png' },
    ],
  },
  methods: {
    switchTab(e) {
      const i = Number(e.currentTarget.dataset.index);
      const item = this.data.list[i];
      if (!item || i === this.data.selected) return;
      this.setData({ selected: i });
      wx.switchTab({ url: item.pagePath });
    },
  },
});
