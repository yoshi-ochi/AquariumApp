import { CREATURES, DESTINATIONS, RARITY, getCreature, getDestination } from '../expedition/creatureData.js';
import { tankCapacity, usedCapacity, syncLife } from '../expedition/tankLife.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
export const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}分${s % 60 ? `${s % 60}秒` : ''}` : `${s}秒`);
const until = (t) => `<span data-until="${t}">${fmtTime(Math.max(0, Math.ceil((t - Date.now()) / 1000)))}</span>`;

/** 採取遠征：調査隊の状況と行き先 */
export class ExpeditionView {
  constructor({ economy, expeditions, toast }) {
    Object.assign(this, { economy, expeditions, toast });
  }

  html() {
    const ex = this.expeditions;
    const level = this.economy.stage.level;
    const trips = ex.trips.map((t, i) => {
      const d = getDestination(t.dest);
      return ex.isDone(t)
        ? `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>調査隊が帰還しました</small></div><button data-act="claim" data-id="${i}" class="primary">受け取る</button></div>`
        : `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>採取中 ・ 残り ${until(t.doneAt)}</small></div></div>`;
    });
    const dests = DESTINATIONS.map((d) => {
      if (d.stage > level) return `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>ステージ${d.stage}で解放</small></div></div>`;
      const ok = ex.canDepart(level) && this.economy.canAfford(d.cost);
      return `<div class="gs-row"><div class="gs-info"><b>${d.name}</b><small>${d.text}</small><small>${yen(d.cost)} ・ ${fmtTime(d.seconds)}</small></div><button data-act="depart" data-id="${d.id}" class="primary" ${ok ? '' : 'disabled'}>出発</button></div>`;
    });
    return `<p class="gs-empty">調査隊 ${ex.trips.length}/${level}</p>${trips.join('')}<h4 class="gs-sub">行き先</h4>${dests.join('')}`;
  }

  act(act, id) {
    const ex = this.expeditions;
    if (act === 'depart') {
      const d = getDestination(id);
      if (ex.canDepart(this.economy.stage.level) && this.economy.spend(d.cost)) {
        ex.depart(d);
        this.toast(`${d.name} へ出発しました`);
      }
      return true;
    }
    if (act === 'claim') {
      const caught = ex.claim(+id);
      const names = [...new Set(caught)].map((c) => `${getCreature(c).name}×${caught.filter((x) => x === c).length}`);
      if (names.length) this.toast(`採取成功：${names.join('、')}`, { duration: 4000 });
      return true;
    }
    return false;
  }
}

/** アイテムの「生物」タブ：所持している生物と水槽への展示 */
export class CreatureView {
  constructor({ manager, expeditions, previews, toast, onChanged }) {
    Object.assign(this, { manager, expeditions, previews, toast, onChanged });
    this.picking = null;
  }

  get _tanks() {
    return [...this.manager.objects.values()].filter((o) => o.userData.clip);
  }

  _img(id) {
    return `<img src="${this.previews.get(`creature:${id}`) ?? ''}" alt="">`;
  }

  html() {
    return this.picking ? this._picker() : this._list();
  }

  _list() {
    const ex = this.expeditions;
    const owned = CREATURES.filter((c) => ex.count(c.id) > 0).map(
      (c) => `<div class="gs-row">${this._img(c.id)}<div class="gs-info"><b>${c.name}</b><small>${RARITY[c.rarity]} ・ 所持 ${ex.count(c.id)} ・ 枠 ${c.slots}</small></div><button data-act="pick" data-id="${c.id}" class="primary">展示</button></div>`,
    );
    const shown = this._tanks.flatMap((t) =>
      Object.entries(t.userData.creatures ?? {}).map(
        ([id, n]) => `<div class="gs-row">${this._img(id)}<div class="gs-info"><b>${getCreature(id)?.name ?? id} ×${n}</b><small>${t.userData.floor + 1}F ${this.manager.defOf(t).name}</small></div><button data-act="unshow" data-id="${t.userData.uid}:${id}">戻す</button></div>`,
      ),
    );
    return `${owned.join('') || '<p class="gs-empty">生物を持っていません。採取遠征で捕まえましょう。</p>'}${shown.length ? `<h4 class="gs-sub">展示中</h4>${shown.join('')}` : ''}`;
  }

  _picker() {
    const c = getCreature(this.picking);
    const rows = this._tanks.map((t) => {
      const def = this.manager.defOf(t);
      const used = usedCapacity(t);
      const cap = tankCapacity(def);
      return `<div class="gs-row"><div class="gs-info"><b>${t.userData.floor + 1}F ${def.name}</b><small>収容枠 ${used}/${cap}</small></div><button data-act="show" data-id="${t.userData.uid}" class="primary" ${used + c.slots > cap ? 'disabled' : ''}>ここに展示</button></div>`;
    });
    return `<button data-act="pick-back">← 戻る</button><p class="gs-empty">${c.name}（枠 ${c.slots}）を展示する水槽を選んでください。</p>${rows.join('') || '<p class="gs-empty">水槽がありません。</p>'}`;
  }

  act(act, id) {
    if (act === 'pick') this.picking = id;
    else if (act === 'pick-back') this.picking = null;
    else if (act === 'show') this._show(+id);
    else if (act === 'unshow') this._unshow(id);
    else return false;
    return true;
  }

  _show(uid) {
    const tank = this.manager.objects.get(uid);
    const id = this.picking;
    const c = getCreature(id);
    if (!tank || usedCapacity(tank) + c.slots > tankCapacity(this.manager.defOf(tank))) return;
    if (this.expeditions.count(id) === 1) this.picking = null; // 最後の1匹なら一覧へ戻る
    if (!this.expeditions.take(id)) return;
    const list = (tank.userData.creatures ??= {});
    list[id] = (list[id] ?? 0) + 1;
    syncLife(tank);
    this.toast(`${c.name} を展示しました`);
    this.onChanged();
  }

  _unshow(key) {
    const [uid, id] = key.split(':');
    const tank = this.manager.objects.get(+uid);
    if (!tank?.userData.creatures?.[id]) return;
    tank.userData.creatures[id]--;
    if (!tank.userData.creatures[id]) delete tank.userData.creatures[id];
    syncLife(tank);
    this.expeditions.give(id);
    this.onChanged();
  }
}
