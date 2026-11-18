import { mulberry32 } from '../tanks/random.js';
import { getCreature, getDestination, RARITY_WEIGHT } from './creatureData.js';

/**
 * 採取遠征の進行と、捕まえた生物の在庫。
 * 帰還時刻と成果の乱数 seed は出発時に確定する（再読み込みで成果が変わらない）。
 */
export class Expeditions extends EventTarget {
  constructor() {
    super();
    this.trips = [];
    this.creatures = {};
  }

  count(id) {
    return this.creatures[id] ?? 0;
  }

  /** 同時に出せる調査隊の数はステージのレベルと同じ */
  canDepart(stageLevel) {
    return this.trips.length < stageLevel;
  }

  depart(dest, now = Date.now()) {
    this.trips.push({ dest: dest.id, doneAt: now + dest.seconds * 1000, seed: Math.floor(Math.random() * 2 ** 31) });
    this._emit();
  }

  isDone(trip, now = Date.now()) {
    return trip.doneAt <= now;
  }

  /** 帰還した隊の成果を受け取り、捕まえた生物の id 一覧を返す */
  claim(index, now = Date.now()) {
    const trip = this.trips[index];
    if (!trip || !this.isDone(trip, now)) return [];
    const caught = rollCatch(trip);
    this.trips.splice(index, 1);
    for (const id of caught) this.creatures[id] = this.count(id) + 1;
    this._emit();
    return caught;
  }

  take(id) {
    if (this.count(id) <= 0) return false;
    this.creatures[id]--;
    this._emit();
    return true;
  }

  give(id, n = 1) {
    this.creatures[id] = this.count(id) + n;
    this._emit();
  }

  toJSON() {
    return { trips: this.trips.map((t) => ({ ...t })), creatures: { ...this.creatures } };
  }

  fromJSON(data) {
    this.trips = Array.isArray(data?.trips) ? data.trips.filter((t) => getDestination(t.dest)).map((t) => ({ ...t })) : [];
    this.creatures = { ...(data?.creatures ?? {}) };
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}

/** 2〜4匹をレア度の重みで抽選 */
export function rollCatch(trip) {
  const rand = mulberry32(trip.seed);
  const pool = getDestination(trip.dest).pool.map(getCreature);
  const total = pool.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
  const n = 2 + Math.floor(rand() * 3);
  return Array.from({ length: n }, () => {
    let r = rand() * total;
    for (const c of pool) {
      r -= RARITY_WEIGHT[c.rarity];
      if (r < 0) return c.id;
    }
    return pool[0].id;
  });
}
