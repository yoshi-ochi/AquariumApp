import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * セーブの圧縮：JSON を gzip して base64 の文字列にする（クラウドの転送量と容量を減らす）。
 * 古いアプリが開いたままの端末が、読めない形式を誤って上書きしないよう、圧縮して書くのはこの日時から。
 * それまでも圧縮されたセーブは読める。
 */
export const COMPRESS_FROM = Date.parse('2026-11-21T00:00:00+09:00');
export const compressOn = (now = Date.now()) => now >= COMPRESS_FROM;

const toB64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};

export const packJSON = (obj) => toB64(gzipSync(strToU8(JSON.stringify(obj)), { level: 9 }));
export const unpackJSON = (b64) => JSON.parse(strFromU8(gunzipSync(fromB64(b64))));

/** 保存する行の中身 { data, zdata } */
export const encodeRow = (obj, now = Date.now()) => (compressOn(now) ? { data: null, zdata: packJSON(obj) } : { data: obj, zdata: null });

/** 読み込んだ行 → セーブ（無ければ null） */
export const decodeRow = (row) => (row?.zdata ? unpackJSON(row.zdata) : row?.data ?? null);
