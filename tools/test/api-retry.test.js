/* tools/test/api-retry.test.js — GET 幂等重试；写请求不自动重试 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installWx, resetModules } = require('./harness');

function loadReal(requestImpl) {
  installWx({
    getStorageSync: (k) => (k === 'dsm_token' ? 'test-token' : ''),
    request: requestImpl,
  });
  resetModules();
  return require('../../services/real/index.js');
}

test('GET retryable 失败重试一次并成功', async () => {
  let calls = 0;
  const real = loadReal((opts) => {
    calls++;
    if (calls === 1) opts.fail({ errMsg: 'network' });
    else opts.success({ statusCode: 200, data: [{ id: 1 }] });
  });
  const list = await real.listSets();
  assert.equal(calls, 2);
  assert.equal(list[0].id, 1);
});

test('GET 非 retryable 不重试', async () => {
  let calls = 0;
  const real = loadReal((opts) => {
    calls++;
    opts.success({ statusCode: 400, data: { code: 'BAD', message: 'bad', retryable: false } });
  });
  await assert.rejects(() => real.listSets(), (e) => e.code === 'BAD');
  assert.equal(calls, 1);
});

test('写请求失败不自动重试', async () => {
  let calls = 0;
  const real = loadReal((opts) => {
    calls++;
    opts.fail({ errMsg: 'network' });
  });
  await assert.rejects(() => real.draw({ setId: 1, requestId: 'r1' }), (e) => e.retryable === true);
  assert.equal(calls, 1);
});
