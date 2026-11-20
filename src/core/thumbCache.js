import { ANATOMY } from '../expedition/creatureAnatomy.js';

/**
 * 配信サムネイル（GitHub Pages の public/thumbs/ に置いた WebP）。
 * 起動時は manifest.json と照らし合わせ、形のデータが変わっていない物は配信画像の URL を使う。
 * 無い物・データが変わった物だけ端末で撮影する（追加直後でも表示が欠けない）。
 * 画像の作り直し：開発中に tools/thumbs/bakeThumbs.js を実行する。
 */
export const THUMB_REV = 1; // 撮り方や形を作るコードを変えたら上げる（全部の画像を作り直す合図）

const base = `${import.meta.env.BASE_URL}thumbs/`;

/** 文字列の短いハッシュ（FNV-1a） */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** 定義の中身から作る版。kind: 'd'（水槽・オブジェ）/ 'c'（生き物） */
export const thumbKey = (kind, def) => hash(`${THUMB_REV}|${JSON.stringify(def)}|${kind === 'c' ? JSON.stringify(ANATOMY[def.id] ?? null) : ''}`);
export const thumbFile = (kind, id) => `${kind}_${id}.webp`;

export async function loadThumbManifest() {
  try {
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** 配信画像を使える物（URL）と、端末で撮影する物に分ける */
export function splitThumbs(kind, defs, manifest) {
  const urls = new Map();
  const missing = [];
  for (const def of defs) {
    const key = thumbKey(kind, def);
    if (manifest?.[kind]?.[def.id] === key) urls.set(def.id, `${base}${thumbFile(kind, def.id)}?v=${key}`);
    else missing.push(def);
  }
  return { urls, missing };
}
