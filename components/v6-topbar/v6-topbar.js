/* components/v6-topbar — 原生导航页统一顶栏 */
Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },
  properties: {
    title: { type: String, value: '' },
    statusBarHeight: { type: Number, value: 20 },
    back: { type: Boolean, value: true },
    hasRight: { type: Boolean, value: false },
  },
  methods: {
    onBack() {
      this.triggerEvent('back');
    },
  },
});
