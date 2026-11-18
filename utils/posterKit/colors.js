/* ══════════════════════════════════════════════════════════
   posterKit/colors.js
   Canvas 不能读 CSS 变量，色值在此硬编码（与 app 设计令牌对齐）
   V2.7 暖纸系统：纸层 / 暖灰墨层 / 珊瑚层 / 校准彩墨层
   ══════════════════════════════════════════════════════════ */
module.exports = {
  ink:   '#292421',   // 暖灰主文字
  ink2:  '#6C645A',   // 次文字
  ink3:  '#7E7469',   // 辅助：暖灰加深（对比 ≈4.2:1），保色相
  gray700: '#5A5248',
  gray300: '#C9BFB2',
  gray50:  '#F4EEE4',
  paper: '#FFFFFF',
  paperWarm: '#FBF7F0',  // 暖纸底
  brand: '#FF6B35',
  brandDeep: '#E5541F',
  orange100: '#EFE8DD',
  line:  '#EAE2D5',
  rar: { N: '#43A585', R: '#4E9ED9', SR: '#E2A236', SSR: '#D9A227' },
  stampInk: '#292421',   // 钢戳油墨
  gold: { deep: '#7A5410', mid: '#D9A227', light: '#F0CF7E' },

  /* ── highlight / memorial 模板 ── */
  gray100:  '#F4EEE4',   // 内容盒底（surface-muted）
  // 600 级：小字/标签/徽章用
  rarText:  { N: '#2F8A6E', R: '#2C6FA5', SR: '#A86F14', SSR: '#7A5410' },
  // 300 级：稀有度渐变浅端
  rarLight: { N: '#7FC9AD', R: '#7DBBE3', SR: '#EDBB6B', SSR: '#F0CF7E' },
};
