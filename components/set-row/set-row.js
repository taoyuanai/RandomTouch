/* components/set-row — 卡集行；事件由页面在组件 host 上 bindtap 处理 */
Component({
  options: {
    addGlobalClass: true,
    styleIsolation: 'apply-shared',
  },
  properties: {
    item: { type: Object, value: {} },
    mode: { type: String, value: 'public' }, // public | cards | craft | author
    groupName: { type: String, value: '' },
  },
  methods: {
    onTap() {
      this.triggerEvent('rowtap');
    },
  },
});
