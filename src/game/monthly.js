import { MONTHLY, MONTHLY_MISSIONS, MONTHLY_BONUS } from './gameData.js';
import { getCreature } from '../expedition/creatureData.js';

/** 今月のキー（例 2026-11）と、その月の特集 */
export const monthKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const themeOf = (key) => {
  const t = MONTHLY[Number(key.slice(5)) - 1];
  return { ...t, featured: t.featured.filter((id) => getCreature(id)) };
};
/** 月末（次の月の1日 0:00）の時刻 */
export const monthEnd = (t = Date.now()) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
};

/**
 * 月替わりイベントの進み具合（state.monthly に保存）。
 *   { key, base: { 生き物id: 月はじめの捕獲数 }, events: 今月の開催回数, claimed: [ミッションid] }
 * state.badges には「すべて展示」を達成した月の記念バッジを残す。
 */
export class Monthly {
  constructor({ state, manager, expeditions }) {
    Object.assign(this, { state, manager, expeditions });
  }

  /** 月が変わっていたら新しい月を始める。始めたときは true */
  ensure(now = Date.now()) {
    const key = monthKey(now);
    if (this.state.monthly?.key === key) return false;
    const base = Object.fromEntries(themeOf(key).featured.map((id) => [id, this.expeditions.seenCount(id)]));
    this.state.monthly = { key, base, events: 0, claimed: [] };
    return true;
  }

  get theme() {
    return themeOf(this.state.monthly.key);
  }

  /** 展示している生き物の種類 */
  _shown() {
    const ids = new Set();
    for (const t of this.manager.tanks) for (const [id, n] of Object.entries(t.userData.creatures ?? {})) if (n > 0) ids.add(id);
    return ids;
  }

  /** 展示中の特集種 */
  shownFeatured() {
    const shown = this._shown();
    return this.theme.featured.filter((id) => shown.has(id));
  }

  caught() {
    const m = this.state.monthly;
    return this.theme.featured.reduce((s, id) => s + Math.max(0, this.expeditions.seenCount(id) - (m.base[id] ?? 0)), 0);
  }

  /** 各ミッションの { mission, have, need, done, claimed } */
  missions() {
    const shown = this.shownFeatured().length;
    const all = this.theme.featured.length;
    const m = this.state.monthly;
    return MONTHLY_MISSIONS.map((x) => {
      const have = x.kind === 'show' ? shown : x.kind === 'catch' ? this.caught() : x.kind === 'event' ? m.events : shown;
      const need = x.kind === 'all' ? all : x.n;
      return { mission: x, have: Math.min(have, need), need, done: have >= need, claimed: m.claimed.includes(x.id) };
    });
  }

  /** 来館者の倍率（特集種1種ごとに +5%、上限 +30%） */
  get bonus() {
    if (!this.state.monthly) return 1;
    return 1 + Math.min(MONTHLY_BONUS.max, this.shownFeatured().length * MONTHLY_BONUS.per);
  }

  countEvent() {
    this.ensure();
    this.state.monthly.events++;
  }

  /** 報酬を受け取る。受け取れたら { money, badge } */
  claim(id, scale) {
    const row = this.missions().find((r) => r.mission.id === id);
    if (!row || !row.done || row.claimed) return null;
    this.state.monthly.claimed.push(id);
    const money = Math.round(row.mission.reward * scale);
    let badge = null;
    if (row.mission.badge) {
      badge = `${this.state.monthly.key.replace('-', '年')}月 ${this.theme.name}`;
      this.state.badges = [...(this.state.badges ?? []), badge];
    }
    return { money, badge };
  }

  /** 受け取れる報酬の数（バッジ表示用） */
  get claimable() {
    return this.state.monthly ? this.missions().filter((r) => r.done && !r.claimed).length : 0;
  }
}
