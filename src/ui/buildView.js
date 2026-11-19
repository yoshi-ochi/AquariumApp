import { BUILD_SHAPES, normalizeSpec, customDef, registerCustom, volumeOf } from '../tanks/customTanks.js';
import { tankCapacity } from '../expedition/tankLife.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const LABEL = { w: '幅', d: '奥行', h: '高さ' };

/** 水槽建造：形と寸法を決めて水槽を作り、在庫に加える */
export class BuildView {
  constructor({ economy, inventory, toast }) {
    Object.assign(this, { economy, inventory, toast });
    this.spec = normalizeSpec({ shape: 'box', w: 90, h: 45, d: 45 });
    this.built = null;
  }

  _summary() {
    const def = customDef(this.spec);
    return `<b>${def.name}</b><small>水量 ${Math.round(volumeOf(this.spec) * 1000).toLocaleString('ja-JP')}L ・ 収容枠 ${tankCapacity(def)} ・ 集客 ${def.appeal}</small><small>建造費 <b>${yen(def.price)}</b></small>`;
  }

  html() {
    const s = this.spec;
    const L = BUILD_SHAPES[s.shape].limits;
    const shapes = Object.entries(BUILD_SHAPES).map(([k, v]) => `<button data-act="build-shape" data-id="${k}" class="${s.shape === k ? 'active' : ''}">${v.label}</button>`).join('');
    const keys = s.shape === 'cylinder' ? ['w', 'h'] : ['w', 'd', 'h'];
    const sliders = keys.map((k) => {
      const label = s.shape === 'cylinder' && k === 'w' ? '直径' : LABEL[k];
      return `<label class="bd-slider"><span>${label}</span><input type="range" data-field="build-${k}" min="${L[k][0]}" max="${L[k][1]}" step="5" value="${s[k]}"><output>${s[k]}cm</output></label>`;
    }).join('');
    const def = customDef(s);
    const done = this.built ? `<div class="gs-row"><div class="gs-info"><b>${this.built.name} を建造しました</b><small>所持数 ${this.inventory.count(this.built.id)}</small></div><button data-act="place" data-id="${this.built.id}" class="primary">設置</button></div>` : '';
    return `<button data-act="build-back">← アイテムへ</button>
      <p class="gs-empty">形と寸法を自由に決めて、水槽を特注で建造します。完成した水槽は所持品に入ります。</p>
      <div class="sp-seg">${shapes}</div>
      ${sliders}
      <div class="st-sum bd-sum">${this._summary()}</div>
      <button data-act="build-make" class="primary tv-wide" ${this.economy.canAfford(def.price) ? '' : 'disabled'}>建造する ${yen(def.price)}</button>
      ${done}`;
  }

  /** スライダーは再描画せずに数値と見積もりを更新する */
  input(el) {
    const k = el.dataset.field?.replace('build-', '');
    if (!['w', 'd', 'h'].includes(k)) return;
    this.spec = normalizeSpec({ ...this.spec, [k]: el.value });
    el.parentElement.querySelector('output').textContent = `${this.spec[k]}cm`;
    const list = el.closest('.gs-list');
    list.querySelector('.bd-sum').innerHTML = this._summary();
    const price = customDef(this.spec).price;
    const btn = list.querySelector('[data-act="build-make"]');
    btn.textContent = `建造する ${yen(price)}`;
    btn.disabled = !this.economy.canAfford(price);
  }

  act(act, id) {
    if (act === 'build-shape') {
      this.spec = normalizeSpec({ ...this.spec, shape: id });
      return true;
    }
    if (act !== 'build-make') return false;
    const price = customDef(this.spec).price;
    if (!this.economy.spend(price)) {
      this.toast('資金が足りません', { error: true });
      return true;
    }
    const def = registerCustom(this.spec);
    this.inventory.add(def.id);
    this.built = def;
    this.toast(`${def.name} を建造しました`);
    return true;
  }
}
