const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  if (event.Event !== 'wxa_media_check') return 'ignored';
  const traceId = event.trace_id;
  const result = event.result || {};
  const suggest = result.suggest || 'review';

  try {
    await db.collection('sec_traces').where({ traceId }).update({
      data: { mediaSuggest: suggest, checkedAt: Date.now() },
    });
  } catch (e) {
    console.warn('[sec-callback] update trace failed', e && e.message);
  }

  // 业务级联：若业务集合已落库，可按 traceId 更新对应内容状态。
  // P0-1 客户端仍以内存状态为主，待 P0-2 服务端化后在此扩展。
  return 'success';
};
