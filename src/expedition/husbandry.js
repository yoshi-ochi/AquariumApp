import { DESTINATIONS, getCreature } from './creatureData.js';

/** 飼育：エサ・水温・混泳の相性・繁殖。tank.userData.care = { fed, bred, water } */
const H = 3600 * 1000;
export const FEED_INTERVAL = 8 * H;
export const BREED_INTERVAL = 12 * H;
export const WATER = {
  tropical: { label: '熱帯 26℃' },
  temperate: { label: '温帯 18℃' },
  cold: { label: '冷水 8℃' },
};

const REGION_ZONE = { iso: 'temperate', sanriku: 'temperate', reef: 'tropical', gbr: 'tropical', ocean: 'tropical', galapagos: 'tropical', okhotsk: 'cold', deep: 'cold' };
const JOINT_ZONE = { seela: 'cold', demenigisu: 'cold', daiou: 'cold', koori: 'cold', greenland: 'cold' };
const PREDATOR_FORMS = new Set(['shark', 'hammer', 'eel', 'squid']);

export function zoneOf(id) {
  if (JOINT_ZONE[id]) return JOINT_ZONE[id];
  const d = DESTINATIONS.find((x) => x.pool.includes(id));
  return REGION_ZONE[d?.id] ?? 'temperate';
}

const speciesIn = (tank) => Object.entries(tank.userData.creatures ?? {}).filter(([id, n]) => n > 0 && getCreature(id));
export const hasLife = (tank) => speciesIn(tank).length > 0;

export function ensureCare(tank, now = Date.now()) {
  const list = speciesIn(tank);
  tank.userData.care ??= { fed: now, bred: now, water: list.length ? zoneOf(list[0][0]) : 'tropical' };
  return tank.userData.care;
}

/** 水温が合わない生物の割合 */
export function waterMismatch(tank) {
  const list = speciesIn(tank);
  const total = list.reduce((s, [, n]) => s + n, 0);
  if (!total) return 0;
  const { water } = ensureCare(tank);
  return list.reduce((s, [id, n]) => s + (zoneOf(id) === water ? 0 : n), 0) / total;
}

/** 大型の捕食者と、食べられてしまう小さな生物が同居しているか */
export function predatorConflict(tank) {
  const list = speciesIn(tank).map(([id]) => getCreature(id));
  const hunters = list.filter((c) => PREDATOR_FORMS.has(c.form));
  return hunters.some((h) => list.some((c) => c !== h && c.len < h.len / 4));
}

export const isHungry = (tank, now = Date.now()) => hasLife(tank) && now - ensureCare(tank, now).fed >= FEED_INTERVAL;

/** 健康度 0.3〜1。展示生物の魅力に掛かる */
export function tankHealth(tank, now = Date.now()) {
  if (!hasLife(tank)) return 1;
  const over = (now - ensureCare(tank, now).fed) / FEED_INTERVAL;
  const food = over <= 1 ? 1 : Math.max(0.3, 1 - (over - 1) * 0.5);
  const temp = 1 - waterMismatch(tank) * 0.6;
  return Math.max(0.3, food * temp * (predatorConflict(tank) ? 0.7 : 1));
}

export const feedCost = (tank) => speciesIn(tank).reduce((s, [id, n]) => s + getCreature(id).slots * n * 30, 0);

export function feed(tank, now = Date.now()) {
  ensureCare(tank, now).fed = now;
}

/** 条件を満たす水槽で1匹生まれる。生まれた種の id を返す */
export function tryBreed(tank, now = Date.now()) {
  if (!hasLife(tank) || tankHealth(tank, now) < 0.8) return null;
  const care = ensureCare(tank, now);
  if (now - care.bred < BREED_INTERVAL) return null;
  const pair = speciesIn(tank).find(([id, n]) => n >= 2 && getCreature(id).rarity < 3);
  if (!pair) return null;
  care.bred = now;
  return pair[0];
}
