import { getCreature, MAX_STARS } from '../expedition/creatureData.js';

/** 生き物のサムネイル。右上にレア度を星（最大6つ）で重ねる */
export function creatureThumb(previews, id) {
  const n = getCreature(id)?.stars ?? 1;
  const label = `レア度 星${n}つ（${MAX_STARS}段階）`;
  return `<span class="cthumb"><img src="${previews.get(`creature:${id}`) ?? ''}" alt=""><i class="cstars" title="${label}" aria-label="${label}">${'★'.repeat(n)}</i></span>`;
}
