import { CREATURES, RARITY, getCreature } from '../expedition/creatureData.js';
import { tankCapacity, usedCapacity, syncLife } from '../expedition/tankLife.js';
import { WATER, ensureCare, feedCost, hasLife, isHungry, predatorConflict, tankHealth, waterMismatch, FEED_INTERVAL } from '../expedition/husbandry.js';
import { tankLabel, defaultTankLabel, cleanTankName } from '../tanks/tankLabel.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const span = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分` : `${Math.max(1, Math.ceil(s / 60))}分`);

/**
 * 水槽をタップしたときの管理シート：名前・展示生物の追加と削除・エサやり・水温・掃除・水槽内編集。
 * エサと掃除の処理は既存の CareView / CleanView に任せる。
 */
export class TankView {
  constructor({ manager, expeditions, economy, previews, toast, careView, cleanView, onInterior, onChanged }) {
    Object.assign(this, { manager, expeditions, economy, previews, toast, careView, cleanView, onInterior, onChanged });
    this.tank = null;
    this.adding = false;
  }

  get title() {
    return this.tank ? tankLabel(this.manager, this.tank) : '水槽';
  }

  open(tank) {
    this.tank = tank;
    this.adding = false;
  }

  _img(id) {
    return `<img src="${this.previews.get(`creature:${id}`) ?? ''}" alt="">`;
  }

  html() {
    const t = this.tank;
    if (!t || !this.manager.objects.has(t.userData.uid)) return '<p class="gs-empty">水槽がありません。</p>';
    return this.adding ? this._picker(t) : this._main(t);
  }

  _main(t) {
    const def = this.manager.defOf(t);
    const uid = t.userData.uid;
    const used = usedCapacity(t);
    const cap = tankCapacity(def);
    const name = `<div class="tv-name"><input id="tv-name" value="${esc(t.userData.name ?? '')}" maxlength="20" placeholder="${esc(defaultTankLabel(this.manager, t))}" aria-label="水槽の名前"><button data-act="tank-rename" class="primary">名前を付ける</button></div>
      <small class="tv-def">${esc(def.name)}</small>`;
    const shown = Object.entries(t.userData.creatures ?? {}).map(([id, n]) =>
      `<div class="gs-row">${this._img(id)}<div class="gs-info"><b>${esc(getCreature(id)?.name ?? id)} ×${n}</b><small>枠 ${getCreature(id)?.slots ?? 0} ・ ${RARITY[getCreature(id)?.rarity] ?? ''}</small></div><button data-act="tank-unshow" data-id="${id}">戻す</button></div>`);
    const life = `<h4 class="gs-sub">展示生物（収容枠 ${used}/${cap}）</h4>
      ${shown.join('') || '<p class="gs-empty">展示している生物はいません。</p>'}
      <button data-act="tank-add" class="primary tv-wide">＋ 生物を追加</button>`;
    return `${name}${life}${this._care(t, uid)}<h4 class="gs-sub">掃除</h4>${this.cleanView._row(t, Date.now())}
      <button data-act="tank-interior" class="tv-wide">✎ 水槽内レイアウトを編集</button>`;
  }

  _care(t, uid) {
    if (!hasLife(t)) return '';
    const now = Date.now();
    const care = ensureCare(t, now);
    const cost = feedCost(t);
    const notes = [];
    if (isHungry(t, now)) notes.push('お腹をすかせています');
    if (waterMismatch(t) > 0) notes.push('水温が合わない生物がいます');
    if (predatorConflict(t)) notes.push('捕食者と小さな生物が同居しています');
    const next = Math.max(0, FEED_INTERVAL - (now - care.fed)) / 1000;
    const seg = Object.entries(WATER).map(([k, w]) => `<button data-act="care-water" data-id="${uid}:${k}" class="${care.water === k ? 'active' : ''}">${w.label}</button>`).join('');
    return `<h4 class="gs-sub">飼育（健康度 ${Math.round(tankHealth(t, now) * 100)}%）</h4>
      <div class="gs-row wrap"><div class="gs-info">${notes.length ? `<em class="gs-alert">${notes.join('、')}</em>` : `<small>次のエサまで ${span(next)}</small>`}</div>
      <div class="gs-btns"><div class="sp-seg">${seg}</div><button data-act="care-feed" data-id="${uid}" class="primary" ${this.economy.canAfford(cost) ? '' : 'disabled'}>エサやり ${yen(cost)}</button></div></div>`;
  }

  _picker(t) {
    const free = tankCapacity(this.manager.defOf(t)) - usedCapacity(t);
    const rows = CREATURES.filter((c) => this.expeditions.count(c.id) > 0).map((c) =>
      `<div class="gs-row">${this._img(c.id)}<div class="gs-info"><b>${esc(c.name)}</b><small>所持 ${this.expeditions.count(c.id)} ・ 枠 ${c.slots}</small></div><button data-act="tank-show" data-id="${c.id}" class="primary" ${c.slots > free ? 'disabled' : ''}>展示</button></div>`);
    return `<button data-act="tank-add-back">← 戻る</button><p class="gs-empty">空き枠 ${free}。展示する生物を選んでください。</p>${rows.join('') || '<p class="gs-empty">生物を持っていません。採取遠征で捕まえましょう。</p>'}`;
  }

  act(act, id, b) {
    const t = this.tank;
    if (!t) return false;
    if (act.startsWith('care-')) return this.careView.act(act, id);
    if (act.startsWith('clean-')) return this.cleanView.act(act, String(t.userData.uid));
    if (act === 'tank-rename') {
      const name = cleanTankName(b?.closest('.gs-list')?.querySelector('#tv-name')?.value);
      if (name) t.userData.name = name;
      else delete t.userData.name;
      this.toast(name ? `「${name}」と名付けました` : '名前を外しました');
      this.onChanged();
    } else if (act === 'tank-add') this.adding = true;
    else if (act === 'tank-add-back') this.adding = false;
    else if (act === 'tank-show') this._show(t, id);
    else if (act === 'tank-unshow') this._unshow(t, id);
    else if (act === 'tank-interior') this.onInterior(t);
    else return false;
    return true;
  }

  _show(t, id) {
    const c = getCreature(id);
    if (!c || usedCapacity(t) + c.slots > tankCapacity(this.manager.defOf(t))) return;
    if (!this.expeditions.take(id)) return;
    const list = (t.userData.creatures ??= {});
    list[id] = (list[id] ?? 0) + 1;
    syncLife(t);
    this.toast(`${c.name} を展示しました`);
    this.onChanged();
  }

  _unshow(t, id) {
    if (!t.userData.creatures?.[id]) return;
    if (this.expeditions.usedSlots + getCreature(id).slots > this.expeditions.getCapacity()) return this.toast('保持枠がいっぱいです', { error: true });
    t.userData.creatures[id]--;
    if (!t.userData.creatures[id]) delete t.userData.creatures[id];
    syncLife(t);
    this.expeditions.give(id);
    this.onChanged();
  }
}
