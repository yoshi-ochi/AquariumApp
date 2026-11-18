import { TANK_DEFS } from '../tanks/tankData.js';
import { MAX_ORDERS, outsourceCost, outsourceSeconds } from '../management/inventory.js';
import { icon } from './icons.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const time = (s) => (s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ''}` : `${s}秒`);
const TABS = [['stock', '所持品'], ['supplier', '取引先'], ['outsource', '外注']];

/** 今後追加する機能の案内 */
export const FEATURES = {
  expedition: ['expedition', '採取遠征', '調査隊を海へ送り、展示する生き物を採取します。'],
  shop: ['shop', '店舗運営', 'お土産店を運営して、来館者から売上を得ます。'],
  ally: ['ally', '同盟水族館', 'ほかの水族館と同盟を組み、協力して運営します。'],
  clean: ['clean', '水槽の掃除', '水槽をきれいに保ち、展示の魅力を高めます。'],
  event: ['event', 'イベント開催', '館内イベントを開いて、来館者を増やします。'],
};

/** 下部バーから開くシート：アイテム（所持品・取引先・外注）と各機能の案内 */
export class GameSheet {
  constructor({ el, economy, inventory, previews, toast, onPlace }) {
    Object.assign(this, { el, economy, inventory, previews, toast, onPlace });
    this.view = null;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (b) this._act(b.dataset.act, b.dataset.id);
    });
    inventory.addEventListener('change', () => this.view && this.render());
    setInterval(() => this._tick(), 1000);
  }

  get _level() {
    return this.economy.stage.level;
  }

  openItems(tab = 'stock') {
    this.view = tab;
    this.el.hidden = false;
    this.render();
  }

  openFeature(id) {
    this.view = `feature:${id}`;
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.view = null;
    this.el.hidden = true;
  }

  render() {
    const head = (title) => `<div class="gs-head"><h3>${title}</h3><button data-act="close" class="gs-close" aria-label="閉じる">✕</button></div>`;
    if (this.view.startsWith('feature:')) {
      const [ic, title, text] = FEATURES[this.view.slice(8)];
      this.el.innerHTML = `${head(title)}<div class="gs-soon">${icon(ic, 40)}<p>${text}</p><b>準備中</b></div>`;
      return;
    }
    const tabs = TABS.map(([id, label]) => `<button data-act="tab" data-id="${id}" class="${this.view === id ? 'active' : ''}">${label}</button>`).join('');
    this.el.innerHTML = `${head('アイテム')}<div class="gs-tabs">${tabs}</div><div class="gs-list">${this[`_${this.view}`]()}</div>`;
  }

  _row(def, info, button) {
    return `<div class="gs-row"><img src="${this.previews.get(def.id) ?? ''}" alt=""><div class="gs-info"><b>${def.name}</b><small>${info}</small></div>${button}</div>`;
  }

  _stock() {
    const owned = TANK_DEFS.filter((d) => this.inventory.count(d.id) > 0);
    const orders = this.inventory.orders.map((o, i) => {
      const def = TANK_DEFS.find((d) => d.id === o.defId);
      return def ? this._row(def, `外注で製作中 ・ 残り <span data-left="${i}">${this._left(o)}</span>`, '') : '';
    });
    const rows = owned.map((d) => this._row(d, `所持数 ${this.inventory.count(d.id)}`, `<button data-act="place" data-id="${d.id}" class="primary">設置</button>`));
    return [...rows, ...orders].join('') || '<p class="gs-empty">水槽を持っていません。取引先からの購入か、外注で入手できます。</p>';
  }

  _supplier() {
    return this._available((d) => this._row(d, `${yen(d.price)} ・ すぐ届く`, `<button data-act="buy" data-id="${d.id}" class="primary" ${this.economy.canAfford(d.price) ? '' : 'disabled'}>購入</button>`));
  }

  _outsource() {
    const full = this.inventory.orders.length >= MAX_ORDERS;
    const note = `<p class="gs-empty">定価の6割で作れますが、完成まで時間がかかります（発注中 ${this.inventory.orders.length}/${MAX_ORDERS}）。</p>`;
    return note + this._available((d) => {
      const cost = outsourceCost(d);
      return this._row(d, `${yen(cost)} ・ ${time(outsourceSeconds(d))}`, `<button data-act="order" data-id="${d.id}" class="primary" ${full || !this.economy.canAfford(cost) ? 'disabled' : ''}>発注</button>`);
    });
  }

  _available(row) {
    return TANK_DEFS.map((d) => (d.requiredStage > this._level ? this._row(d, `ステージ${d.requiredStage}で解放`, '') : row(d))).join('');
  }

  _left(o) {
    return time(Math.max(0, Math.ceil((o.doneAt - Date.now()) / 1000)));
  }

  _tick() {
    if (this.view !== 'stock') return;
    this.el.querySelectorAll('[data-left]').forEach((s) => {
      const o = this.inventory.orders[+s.dataset.left];
      if (o) s.textContent = this._left(o);
    });
  }

  _act(act, id) {
    const def = TANK_DEFS.find((d) => d.id === id);
    if (act === 'close') return this.close();
    if (act === 'tab') {
      this.view = id;
      return this.render();
    }
    if (act === 'place') {
      this.close();
      return this.onPlace(id);
    }
    if (act === 'buy' && this.economy.spend(def.price)) {
      this.inventory.add(id);
      this.toast(`${def.name} を購入しました`);
    } else if (act === 'order' && this.inventory.orders.length < MAX_ORDERS && this.economy.spend(outsourceCost(def))) {
      this.inventory.order(def);
      this.toast(`${def.name} を外注しました`);
    }
  }
}
