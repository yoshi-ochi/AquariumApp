import { packJSON, unpackJSON } from './saveCodec.js';

/**
 * 端末内の控え（localStorage）。クラウドへの保存は通信なので、急にサイトを閉じると間に合わないことがある。
 * 変更のたびに圧縮したセーブをこの端末に書き、閉じる瞬間（pagehide）にも同期的に書く。
 * 次に開いたとき、クラウドに届いていない控えがあればそれを使い、クラウドへ送り直す。
 *   rev    : 控えの元になったクラウドの版（updated_at）。別の端末がその後に保存していたら控えは使わない
 *   synced : クラウドへ保存済みか
 */
const key = (uid) => `aq.journal.${uid}`;

export function writeJournal(uid, data, rev, synced = false) {
  try {
    localStorage.setItem(key(uid), JSON.stringify({ v: 1, rev: rev ?? null, synced, savedAt: data.savedAt, z: packJSON(data, 6) }));
    return true;
  } catch (err) {
    console.warn('端末への控えを書けませんでした', err.message);
    return false;
  }
}

/** クラウドへ保存できたら印を付ける（中身は書き直さない） */
export function markJournalSynced(uid, rev) {
  try {
    const j = JSON.parse(localStorage.getItem(key(uid)));
    if (!j) return;
    localStorage.setItem(key(uid), JSON.stringify({ ...j, rev, synced: true }));
  } catch { /* 読めなければ何もしない */ }
}

/**
 * クラウドに届いていない控え。cloud は読み込んだクラウドのセーブ、rev はその版。
 * 同じ版から作られ、クラウドより新しいときだけ返す（別の端末の新しい保存は上書きしない）
 */
export function pendingJournal(uid, cloud, rev) {
  try {
    const j = JSON.parse(localStorage.getItem(key(uid)));
    if (!j || j.synced || (j.rev ?? null) !== (rev ?? null)) return null;
    if (cloud?.savedAt && !(Date.parse(j.savedAt) > Date.parse(cloud.savedAt))) return null;
    return unpackJSON(j.z);
  } catch {
    return null;
  }
}
