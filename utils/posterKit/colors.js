/* ══════════════════════════════════════════════════════════
   posterKit/colors.js
   Canvas 不能读 CSS 变量，色值在此硬编码（与 app V6 设计令牌对齐）
   V6 冷灰橙白：白纸 / 冷灰墨层 / 品牌橙；旧哑金统一映射为橙
   ══════════════════════════════════════════════════════════ */
module.exports = {
  ink:   '#202124',   // 冷灰主文字
  ink2:  '#5F6368',   // 次文字
  ink3:  '#737980',   // 辅助
  gray700: '#5F6368',
  gray300: '#D9DCDF',
  gray50:  '#F7F8F9',
  paper: '#FFFFFF',
  paperWarm: '#F7F8F9',  // V6 冷灰纸底
  brand: '#FF6038',
  brandDeep: '#D04A12',
  orange100: '#FFE5D8',
  line:  '#EFF0F1',
  rar: { N: '#737980', R: '#737980', SR: '#D04A12', SSR: '#B83E0D' },
  stampInk: '#202124',   // 钢戳油墨
  gold: { deep: '#B83E0D', mid: '#D04A12', light: '#FFC4A8' },

  /* ── highlight / memorial 模板 ── */
  gray100:  '#F7F8F9',   // 内容盒底（surface-muted）
  rarText:  { N: '#5F6368', R: '#5F6368', SR: '#D04A12', SSR: '#B83E0D' },
  rarLight: { N: '#D9DCDF', R: '#D9DCDF', SR: '#FFC4A8', SSR: '#FFC4A8' },
};
