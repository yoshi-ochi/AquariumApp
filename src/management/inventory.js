/**
 * 水槽の在庫と外注の発注。取引先は定価で即納、外注は安いが完成まで時間がかかる。
 * 完成時刻は実時間で持つので、アプリを閉じている間も製作が進む。
 */
export const OUTSOURCE_RATE = 0.6;
export const MAX_ORDERS = 3;
const MIN_SEC = 30;
const MAX_SEC = 1800;

export const outsourceCost = (def) => Math.floor(def.price * OUTSOURCE_RATE);
export const outsourceSeconds = (def) => Math.min(MAX_SEC, Math.max(MIN_SEC, Math.round(def.price / 100)));

export class Inventory extends EventTarget {
  constructor() {
    super();
    this.stock = {};
    this.orders = [];
  }

  count(id) {
    return this.stock[id] ?? 0;
  }

  add(id, n = 1) {
    this.stock[id] = this.count(id) + n;
    this._emit();
  }

  /** 在庫を1つ使う。無ければ false */
  take(id) {
    if (this.count(id) <= 0) return false;
    this.stock[id]--;
    this._emit();
    return true;
  }

  order(def, now = Date.now()) {
    this.orders.push({ defId: def.id, doneAt: now + outsourceSeconds(def) * 1000 });
    this._emit();
  }

  /** 完成した発注を在庫へ移し、その defId の一覧を返す */
  collect(now = Date.now()) {
    const done = this.orders.filter((o) => o.doneAt <= now);
    if (!done.length) return done;
    this.orders = this.orders.filter((o) => o.doneAt > now);
    for (const o of done) this.stock[o.defId] = this.count(o.defId) + 1;
    this._emit();
    return done.map((o) => o.defId);
  }

  toJSON() {
    return { stock: { ...this.stock }, orders: this.orders.map((o) => ({ ...o })) };
  }

  fromJSON(data) {
    this.stock = { ...(data?.stock ?? {}) };
    this.orders = Array.isArray(data?.orders) ? data.orders.map((o) => ({ ...o })) : [];
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
