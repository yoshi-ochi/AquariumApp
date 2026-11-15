/**
 * ベイク済み水面データを IndexedDB に保存し、次回起動時は計算を省略する。
 * IndexedDB が使えない環境（プライベートモード等）では常に null / 何もしないで動く。
 */
const DB_NAME = 'aquarium-cache';
const STORE = 'blobs';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadCached(key) {
  try {
    const buf = await withStore('readonly', (s) => s.get(key));
    return buf ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

export async function saveCached(key, data) {
  try {
    await withStore('readwrite', (s) => s.put(data.buffer, key));
  } catch {
    /* キャッシュできなくても動作には影響しない */
  }
}
