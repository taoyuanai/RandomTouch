/* 盖邮戳：collect 覆盖单条；resident 同 idx 追加。返回 rec（含 COS 展示地址）。 */
const { withTx, pool } = require('../db');
const { safeDel } = require('../redis');
const { setNotFound, secRejected } = require('../http/errors');
const { signedUrl, keyOfImage, isOwnedKey } = require('./cos');
const { checkText, checkMedia } = require('./sec');
const time = require('./time');
const { ensureProgress, loadSetRow } = require('./sets');

async function recOfRow(r) {
  const key = keyOfImage(r.img_file_id, r.img_url);
  return {
    img: key ? await signedUrl(key) : '',
    imgFileID: key,
    note: r.note || '',
    date: r.date_text || '',
    stampDate: r.stamp_date || '',
    dateText: r.stamp_date || '',
    dayText: r.day_text || '',
    sec: { text: r.sec_text || 'pass', media: r.sec_media || 'none' },
  };
}

async function saveStamp(user, setIdInput, { idx: idxInput, note: noteInput, imgFileID } = {}) {
  const userId = user.id;
  const setId = Number(setIdInput);
  const idx = Number(idxInput);
  if (!Number.isInteger(idx) || idx < 0) throw setNotFound();
  const note = String(noteInput || '').trim().slice(0, 50);
  const key = keyOfImage(imgFileID);
  if (key && !isOwnedKey(key, 'stamps', userId)) throw secRejected('图片无效');
  if (!note && !key) throw secRejected('请写一句话或选一张图');
  /* 内容安全需要可访问 URL；只用于校验，不落库。 */
  const imgUrl = key ? await signedUrl(key, 600) : '';

  const set = await loadSetRow(pool, setId);
  if (!set) throw setNotFound();

  const [[card]] = await pool.query(
    'SELECT idx FROM set_cards WHERE set_id = ? AND idx = ?', [setId, idx]
  );
  if (!card) throw setNotFound();

  /* 内容安全（SEC_MODE=mock 时直接 pass） */
  const textStatus = await checkText({ content: note, openid: user.openid });
  if (textStatus === 'risky') throw secRejected();
  const mediaStatus = await checkMedia({ mediaUrl: imgUrl, openid: user.openid });

  const now = Date.now();
  const out = await withTx(async (conn) => {
    const own = Number(set.creator_user_id) === Number(userId);
    const unlockedDefault = Number(set.price) === 0 || own;
    await ensureProgress(conn, userId, setId, unlockedDefault, now);

    let updated = false;
    if (set.type === 'resident') {
      // 追加一条
    } else {
      const [[prev]] = await conn.query(
        'SELECT COUNT(*) AS n FROM stamps WHERE user_id = ? AND set_id = ? AND card_idx = ?',
        [userId, setId, idx]
      );
      updated = Number(prev.n) > 0;
      if (updated) {
        await conn.query(
          'DELETE FROM stamps WHERE user_id = ? AND set_id = ? AND card_idx = ?',
          [userId, setId, idx]
        );
      }
    }

    const dateText = time.todayShort(now);
    const stampDate = time.todayDot(now);
    const dayText = time.dayText(now);
    const [ins] = await conn.query(
      `INSERT INTO stamps
        (user_id, set_id, card_idx, img_url, img_file_id, note, day_key, date_text, day_text, stamp_date, sec_text, sec_media, created_ts)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, setId, idx, '', key, note, time.todayKey(now), dateText, dayText, stampDate,
        textStatus, mediaStatus, now]
    );
    return {
      rec: await recOfRow({
        img_url: '', img_file_id: key, note,
        date_text: dateText, stamp_date: stampDate, day_text: dayText,
        sec_text: textStatus, sec_media: mediaStatus,
      }),
      updated,
      id: ins.insertId,
    };
  });

  await safeDel(`feed:${userId}`);
  return { rec: out.rec, updated: out.updated };
}

module.exports = { saveStamp };
