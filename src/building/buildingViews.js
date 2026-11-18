import { ZONES, getZone } from './blueprint.js';
import { CREATURES, RARITY, getCreature } from '../expedition/creatureData.js';
import { RESEARCH, BREED_HOURS, researchCost, breedHours } from './backyardData.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;

/** 館内エリアの解放 */
export class ZoneView {
  constructor({ economy, getUnlocked, onUnlock }) {
    Object.assign(this, { economy, getUnlocked, onUnlock });
  }

  html() {
    const unlocked = this.getUnlocked();
    const level = this.economy.stage.level;
    const rows = [0, 1].map((floor) => {
      const items = ZONES.filter((z) => z.floor === floor).map((z) => {
        if (unlocked.has(z.id)) return `<div class="gs-row"><div class="gs-info"><b>${z.name}</b><small>${z.text}</small></div><span class="zn-open">解放済み</span></div>`;
        const lack = z.stage > level ? `ステージ${z.stage}で解放` : z.requires && !unlocked.has(z.requires) ? `先に${getZone(z.requires).name}を解放` : '';
        const ok = !lack && this.economy.canAfford(z.cost);
        return `<div class="gs-row"><div class="gs-info"><b>${z.name}</b><small>${z.text}</small>${lack ? `<small>${lack}</small>` : ''}</div><button data-act="zone-open" data-id="${z.id}" class="primary" ${ok ? '' : 'disabled'}>${yen(z.cost)}</button></div>`;
      });
      return `<h4 class="gs-sub">${floor + 1}階</h4>${items.join('')}`;
    });
    return rows.join('');
  }

  act(act, id) {
    if (act !== 'zone-open') return false;
    const z = getZone(id);
    if (this.economy.spend(z.cost)) this.onUnlock(id);
    return true;
  }
}

/** バックヤード：研究と繁殖 */
export class BackyardView {
  constructor({ backyard, expeditions, previews, toast }) {
    Object.assign(this, { backyard, expeditions, previews, toast });
  }

  html() {
    const b = this.backyard;
    const research = RESEARCH.map((r) => {
      const lv = b.level(r.id);
      const cost = researchCost(lv);
      const max = cost == null;
      return `<div class="gs-row"><div class="gs-info"><b>${r.name} Lv${lv}</b><small>${r.text}</small></div>${max ? '<span class="zn-open">最大</span>' : `<button data-act="lab-up" data-id="${r.id}" class="primary" ${b.points >= cost ? '' : 'disabled'}>${cost}pt</button>`}</div>`;
    });
    const slots = b.breeders.map((uid, i) => this._slot(uid, i));
    return `<div class="st-sum"><div class="st-head"><b>研究ポイント ${Math.floor(b.points)}pt</b><small>${b.ratePerMin.toFixed(1)}pt/分</small></div>
        <small>研究室 ${b.labCount}室 ・ 研究員 ${b.researchers}人</small>
        ${b.labCount ? '' : '<em class="gs-alert">レイアウトでバックヤードに研究室を設置してください</em>'}
        ${b.labCount > b.researchers ? '<em class="gs-alert">スタッフから研究員を配置してください</em>' : ''}</div>
      <h4 class="gs-sub">研究</h4>${research.join('')}
      <h4 class="gs-sub">繁殖</h4>${slots.join('') || '<p class="gs-empty">レイアウトでバックヤードに繁殖水槽を設置すると、在庫の親2匹から赤ちゃんを増やせます。親は減りません。</p>'}`;
  }

  _slot(uid, i) {
    const b = this.backyard;
    const job = b.jobs[uid];
    if (job) {
      const c = getCreature(job.id);
      return `<div class="gs-row"><img src="${this.previews.get(`creature:${job.id}`)}" alt=""><div class="gs-info"><b>繁殖水槽${i + 1}：${c.name}</b><small>誕生まで <span data-until="${job.until}"></span></small></div></div>`;
    }
    const opts = CREATURES.filter((c) => this.expeditions.count(c.id) >= 2 && b.canBreed(c));
    const rows = opts.map((c) => `<button data-act="breed" data-id="${uid}:${c.id}">${c.name}（${RARITY[c.rarity]}・${breedHours(c.rarity, b.level('breeding'))}時間）</button>`);
    return `<div class="gs-row wrap"><div class="gs-info"><b>繁殖水槽${i + 1}：空き</b><small>同じ種類を2匹以上持っている生き物を選びます（基本${BREED_HOURS[1]}〜${BREED_HOURS[3]}時間）</small></div><div class="gs-btns">${rows.join('') || '<small>繁殖できる生き物がいません</small>'}</div></div>`;
  }

  act(act, id) {
    const b = this.backyard;
    if (act === 'lab-up') b.upgrade(id);
    else if (act === 'breed') {
      const [uid, cid] = id.split(':');
      if (b.startBreeding(+uid, cid)) this.toast(`${getCreature(cid).name} の繁殖を始めました`);
    } else return false;
    return true;
  }
}
