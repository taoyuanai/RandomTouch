/* tools/test/photo-poster.test.js — 照片优先海报 Canvas 版式烟测 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { drawPhotoPoster } = require('../../utils/posterKit/templates/highlight34.js');

function fakeCtx() {
  const gradient = { addColorStop() {} };
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
    createLinearGradient: () => gradient,
    measureText: (t) => ({ width: String(t || '').length * 7 }),
    save() {}, restore() {}, translate() {}, rotate() {}, setLineDash() {},
    fillRect() {}, strokeRect() {}, fillText() {}, drawImage() {},
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, arc() {},
  };
  return ctx;
}

const data = {
  kind: 'highlight',
  date: '11月25日',
  stampText: '2026.11.25',
  word: '立春前夜',
  text: '再忍一忍，春天已经在路上了。',
  setTitle: '冬天的二十四个词',
  creator: '老树',
  count: 8,
  collect: true,
  gotN: 3,
  sig: true,
  rec: { img: 'photo.jpg', note: '城市的体温，藏在深夜的灯里。' },
};

test('3:4 照片优先版式可绘制', () => {
  const ctx = fakeCtx();
  const img = { width: 900, height: 1200 };
  assert.doesNotThrow(() => drawPhotoPoster(ctx, data, img, null, {
    W: 414, H: 552, M: 24, panelH: 158, mediaH: 552, overlay: true,
  }));
});

test('9:16 照片优先版式可绘制', () => {
  const ctx = fakeCtx();
  const img = { width: 900, height: 1200 };
  assert.doesNotThrow(() => drawPhotoPoster(ctx, data, img, null, {
    W: 360, H: 640, M: 24, panelH: 160, mediaH: 480, overlay: false,
  }));
});
