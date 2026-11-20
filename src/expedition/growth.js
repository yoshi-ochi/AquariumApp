import { CREATURES, DESTINATIONS, JOINT_PROJECTS, RARITY_WEIGHT, DEFAULT_HOME, travelPlan, getCreature } from './creatureData.js';
import { SPECIES_METHODS, METHODS } from './fishingData.js';

/**
 * 生き物の成長（魚種ごとのレベル 1〜999）。在庫の同じ魚種を使うと経験値が入り、レベルが上がる。
 * レベルが上がるほど体が大きくなり（成魚の60%→100%）、集客力も上がる。
 *
 * 目安：やり込む人（調査隊10隊・1日8時間ほど遊ぶ）が1つの魚種に集中して、Lv300 まで約30日。
 *   1匹あたりの経験値は「その魚種がどれだけ捕れやすいか」から決める（捕れにくい魚ほど多い）。
 *   1日に得られる経験値が DAILY_XP、Lv300 までの累計が DAILY_XP×30 になるよう、全魚種共通の曲線を作る。
 *   星2までの魚は、Lv1→2 でも2匹分以上の経験値が要るように、1レベルの経験値に下限を設ける。
 */
export const MAX_LEVEL = 999;
const DAILY_XP = 10000;
const DAYS_TO_300 = 30;
const CURVE = 1.5; // 次のレベルまでの経験値 ∝ Lv^1.5（後半ほどゆっくり。Lv999 は約20か月）
const MIN_FISH = 2; // 星2までの魚で、1レベルに最低何匹ぶん要るか

// やり込みの想定（調査隊は最大の10隊）
const TEAMS = 10;
const ACTIVE_HOURS = 8;
const CHECK_SEC = 20 * 60; // 遊んでいる間、約20分ごとに受け取って出し直す（短い遠征もこれより速くは回らない）
const FISH_PER_TRIP = 3; // 1回の遠征で2〜4匹

/** やり込んだときに1日に手に入る匹数（その魚種がいちばん捕れる採取地・漁法で） */
function perDay(id) {
  let best = 0;
  for (const d of DESTINATIONS) {
    if (!d.pool.includes(id)) continue;
    const trip = travelPlan(d, DEFAULT_HOME).seconds;
    for (const m of [null, ...METHODS]) {
      if (m && !SPECIES_METHODS[id]?.includes(m.id)) continue;
      const usable = m ? d.pool.filter((x) => SPECIES_METHODS[x]?.includes(m.id)) : d.pool;
      const total = usable.reduce((s, x) => s + RARITY_WEIGHT[getCreature(x).rarity], 0);
      const share = RARITY_WEIGHT[getCreature(id).rarity] / total;
      const trips = (ACTIVE_HOURS * 3600) / Math.max(trip * (m?.time ?? 1), CHECK_SEC) + 1; // 寝ている間に1回
      best = Math.max(best, TEAMS * trips * FISH_PER_TRIP * share);
    }
  }
  // 合同調査でしか捕れない生き物（同盟で数時間ごとに数匹）
  for (const p of JOINT_PROJECTS) if (p.pool.includes(id)) best = Math.max(best, (16 / p.hours) * (FISH_PER_TRIP / p.pool.length));
  return best || 1;
}

/** 1匹を成長に使ったときの経験値 */
export const XP_PER_FISH = Object.fromEntries(CREATURES.map((c) => [c.id, Math.max(1, Math.min(50000, Math.round(DAILY_XP / perDay(c.id))))]));
export const xpPerFish = (id) => XP_PER_FISH[id] ?? 1;

/** 1レベルの経験値の下限：星2までの魚の「1匹の経験値」の最大×2 */
const FLOOR = MIN_FISH * Math.max(...CREATURES.filter((c) => c.stars <= 2).map((c) => XP_PER_FISH[c.id]));

/** 累計の表。CUM[lv] = Lv1 から lv までに必要な経験値。Lv300 までの累計が DAILY_XP×30 になる a を探す */
const CUM = (() => {
  const step = (a, k) => Math.max(FLOOR, Math.round(a * k ** CURVE));
  const total = (a) => {
    let s = 0;
    for (let k = 1; k < 300; k++) s += step(a, k);
    return s;
  };
  const target = DAILY_XP * DAYS_TO_300;
  let lo = 0;
  let hi = 10;
  while (total(hi) < target) hi *= 2;
  for (let n = 0; n < 50; n++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < target) lo = mid;
    else hi = mid;
  }
  const cum = [0, 0];
  for (let lv = 1; lv < MAX_LEVEL; lv++) cum.push(cum[lv] + step(hi, lv));
  return cum;
})();

export const xpForLevel = (lv) => CUM[Math.min(MAX_LEVEL, Math.max(1, lv))];
export function levelOf(xp = 0) {
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (CUM[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
/** 今のレベルの中での進み具合 { lv, have, need }（経験値） */
export function progressOf(xp = 0) {
  const lv = levelOf(xp);
  if (lv >= MAX_LEVEL) return { lv, have: 0, need: 0 };
  return { lv, have: xp - CUM[lv], need: CUM[lv + 1] - CUM[lv] };
}
/** 次のレベルまでに要る匹数（最大レベルなら Infinity） */
export function fishToNext(id, xp = 0) {
  const p = progressOf(xp);
  return p.need ? Math.ceil((p.need - p.have) / xpPerFish(id)) : Infinity;
}

/** 体の大きさの倍率（Lv1 で 0.6、Lv999 で 1） */
export const sizeOf = (lv) => 0.6 + 0.4 * Math.sqrt((lv - 1) / (MAX_LEVEL - 1));
/** 集客力の倍率（Lv1 で 1、Lv300 で約1.15、Lv999 で 1.5） */
export const appealOf = (lv) => 1 + 0.5 * ((lv - 1) / (MAX_LEVEL - 1));

/** 総合レベルで星の数にかける重み */
export const STAR_WEIGHT = { 1: 1, 2: 1.5, 3: 2.5, 4: 4, 5: 6, 6: 10 };

/** 総合レベル：展示している魚種ごとの「レベル×星の重み」の合計（同じ魚種は何匹でも1回） */
export function totalScore(tanks, levelOfId) {
  const ids = new Set();
  for (const t of tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) if (n > 0 && getCreature(id)) ids.add(id);
  let s = 0;
  for (const id of ids) s += levelOfId(id) * STAR_WEIGHT[getCreature(id).stars];
  return Math.round(s);
}

// 展示の大きさ・集客の計算から参照するレベル（main で在庫と結びつける。訪問先の水族館も同じ仕組み）
let source = () => 1;
export const setLevelSource = (fn) => (source = fn);
export const speciesLevel = (id) => source(id);
