const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MAX_TEXT = 2500;

async function checkText(content, openid, scene) {
  const text = String(content || '').slice(0, MAX_TEXT);
  if (!text.trim()) return { suggest: 'pass', label: 100 };
  const res = await cloud.openapi.security.msgSecCheck({
    version: 2,
    content: text,
    openid,
    scene: scene || 2,
  });
  const r = (res && res.result) || {};
  return { suggest: r.suggest || 'review', label: r.label || 0 };
}

async function trace(data) {
  try {
    await db.collection('sec_traces').add({ data });
  } catch (e) {
    // 集合不存在时不阻塞业务流程；上线前需在云开发控制台创建
    console.warn('[sec] trace write failed', e && e.message);
  }
}

async function submitImage(fileID, openid, scene) {
  if (!fileID) return { media: 'none', traceId: '' };
  try {
    const urlRes = await cloud.getTempFileURL({ fileList: [fileID] });
    const file = urlRes && urlRes.fileList && urlRes.fileList[0];
    const url = file && file.tempFileURL;
    if (!url) throw new Error('no temp url');
    const res = await cloud.openapi.security.mediaCheckAsync({
      media_url: url,
      media_type: 1,
      version: 2,
      openid,
      scene: scene || 4,
    });
    const traceId = res && res.trace_id;
    await trace({
      traceId,
      fileID,
      openid,
      scene: scene || 4,
      mediaSuggest: 'pending',
      createdAt: Date.now(),
    });
    return { media: 'pending', traceId };
  } catch (e) {
    console.warn('[sec] media check failed', e && e.message);
    return { media: 'pending', traceId: '' };
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action;

  switch (action) {
    case 'text.check': {
      const r = await checkText(event.text, OPENID, event.scene);
      return { suggest: r.suggest, label: r.label };
    }

    case 'comment.create': {
      let r;
      try { r = await checkText(event.text, OPENID, 2); }
      catch (e) { return { status: 'pending', saved: true }; }
      if (r.suggest === 'risky') return { status: 'rejected' };
      return { status: r.suggest === 'pass' ? 'visible' : 'pending' };
    }

    case 'stamp.create': {
      let text = 'pending';
      try { text = (await checkText(event.note, OPENID, 4)).suggest; }
      catch (e) { /* 私有内容 fail-open */ }
      const img = await submitImage(event.imgFileID, OPENID, 4);
      return { ok: true, sec: { text, media: img.media, traceId: img.traceId } };
    }

    case 'set.submit': {
      const s = event.set || {};
      const allText = [
        s.title,
        s.intro,
        ...(s.pool || []).map(c => `${(c && c.w) || ''}\n${(c && c.b) || ''}`),
        s.signatureNote || '',
      ].filter(Boolean).join('\n');
      let t;
      try { t = await checkText(allText, OPENID, 3); }
      catch (e) { return { status: 'pending', machineFlag: true, error: true }; }
      if (t.suggest === 'risky') return { status: 'machine_reject', machineFlag: false };
      let cover = { media: 'none', traceId: '' };
      if (s.coverFileID) cover = await submitImage(s.coverFileID, OPENID, 3);
      return { status: 'submitted', machineFlag: t.suggest === 'review', coverTraceId: cover.traceId };
    }

    case 'name.check': {
      const r = await checkText(event.name, OPENID, 1);
      return { suggest: r.suggest, label: r.label };
    }

    case 'image.submit': {
      const r = await submitImage(event.fileID, OPENID, event.scene && event.scene !== 4 ? event.scene : 4);
      return { media: r.media, traceId: r.traceId };
    }

    case 'status': {
      if (!event.traceId) return { media: 'none' };
      try {
        const r = await db.collection('sec_traces').where({ traceId: event.traceId }).limit(1).get();
        const row = r.data && r.data[0];
        return { media: (row && row.mediaSuggest) || 'pending' };
      } catch (e) { return { media: 'pending' }; }
    }

    default:
      return { error: 'unknown action' };
  }
};
