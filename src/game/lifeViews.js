import { creatureThumb } from '../ui/creatureThumb.js';
import { tankLabel } from '../tanks/tankLabel.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
import { CREATURES, DESTINATIONS, JOINT_PROJECTS, RARITY, MAX_STARS, getCreature } from '../expedition/creatureData.js';
import { NOTES } from '../expedition/creatureNotes.js';
import { WATER, ensureCare, feed, feedCost, hasLife, isHungry, predatorConflict, tankHealth, waterMismatch, nextFeedIn, crowdFactor, zoneOf, FEED_INTERVAL } from '../expedition/husbandry.js';
import { EVENTS } from './gameData.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const span = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}時間${Math.floor((s % 3600) / 60)}分` : `${Math.max(1, Math.ceil(s / 60))}分`);

/** 飼育：幸福度・エサ・水温 */
export class CareView {
  constructor({ manager, economy, toast, onFed }) {
    Object.assign(this, { manager, economy, toast, onFed });
  }

  html() {
    const now = Date.now();
    const rows = this.manager.tanks.filter(hasLife).map((t) => {
      const care = ensureCare(t, now);
      const hp = Math.round(tankHealth(t, now) * 100);
      const cost = feedCost(t);
      const notes = [];
      if (isHungry(t, now)) notes.push('お腹をすかせています');
      if (waterMismatch(t) > 0) notes.push('水温が合わない生物がいます');
      if (predatorConflict(t)) notes.push('捕食者と小さな生物が同居しています');
    if (crowdFactor(t) < 1) notes.push('過密でストレスを感じています');
      const names = Object.keys(t.userData.creatures).map((id) => `${getCreature(id)?.name}（${WATER[zoneOf(id)].label.slice(0, 2)}）`).join('、');
      const seg = Object.entries(WATER).map(([k, w]) => `<button data-act="care-water" data-id="${t.userData.uid}:${k}" class="${care.water === k ? 'active' : ''}">${w.label}</button>`).join('');
      const next = nextFeedIn(t, now);
      return `<div class="gs-row wrap"><div class="gs-info"><b>${esc(tankLabel(this.manager, t))} ・ 幸福度 ${hp}%</b><small>${names}</small>
        ${notes.length ? `<em class="gs-alert">${notes.join('、')}</em>` : `<small>次のエサまで ${span(next)}</small>`}</div>
        <div class="gs-btns"><div class="sp-seg">${seg}</div><button data-act="care-feed" data-id="${t.userData.uid}" class="primary" ${this.economy.canAfford(cost) ? '' : 'disabled'}>エサ ${yen(cost)}</button></div></div>`;
    });
    return `<p class="gs-empty">飼育員が足りていれば、エサやりは自動で行われます。繁殖はバックヤードの繁殖水槽で行います。</p>${rows.join('') || '<p class="gs-empty">生き物を展示している水槽がありません。</p>'}`;
  }

  act(act, id) {
    if (act === 'care-water') {
      const [uid, water] = id.split(':');
      const t = this.manager.objects.get(+uid);
      if (t) ensureCare(t).water = water;
      return true;
    }
    if (act !== 'care-feed') return false;
    const t = this.manager.objects.get(+id);
    if (t && this.economy.spend(feedCost(t))) {
      feed(t);
      this.onFed();
      this.toast('エサをあげました');
    }
    return true;
  }
}

/** 生き物図鑑 */
export class ZukanView {
  constructor({ expeditions, previews, economy, state, toast }) {
    Object.assign(this, { expeditions, previews, economy, state, toast });
    this.pick = null;
    this.mode = 'area';
  }

  /** レア度（星の数）ごとのまとまり。報酬はなし */
  get starGroups() {
    return Array.from({ length: MAX_STARS }, (_, i) => MAX_STARS - i).map((n) => ({
      id: `star${n}`, name: `${'★'.repeat(n)}（星${n}つ）`, ids: CREATURES.filter((c) => c.stars === n).map((c) => c.id),
    })).filter((g) => g.ids.length);
  }

  get groups() {
    const joint = [...new Set(JOINT_PROJECTS.flatMap((p) => p.pool))];
    return [...DESTINATIONS.map((d) => ({ id: d.id, name: d.name, ids: d.pool, reward: d.cost * 5 })), { id: 'joint', name: '合同調査', ids: joint, reward: 3000000 }];
  }

  html() {
    const seen = (id) => this.expeditions.seenCount(id) > 0;
    const total = CREATURES.filter((c) => seen(c.id)).length;
    let detail = '';
    if (this.pick && seen(this.pick)) {
      const c = getCreature(this.pick);
      detail = `<div class="st-sum zk-detail">${creatureThumb(this.previews, c.id)}<div class="gs-info"><b>${c.name}</b><small>${RARITY[c.rarity]} ・ 全長 ${Math.round(c.len * 100)}cm ・ 捕獲 ${this.expeditions.seenCount(c.id)}匹 ・ ${WATER[zoneOf(c.id)].label}</small><small>${NOTES[c.id]}</small></div></div>`;
    }
    const byStar = this.mode === 'star';
    const tabs = `<div class="sp-seg zk-mode"><button data-act="zk-mode" data-id="area" class="${byStar ? '' : 'active'}">地域別</button><button data-act="zk-mode" data-id="star" class="${byStar ? 'active' : ''}">レア度別</button></div>`;
    const sections = (byStar ? this.starGroups : this.groups).map((g) => {
      const got = g.ids.filter(seen).length;
      const done = !byStar && got === g.ids.length;
      const claimed = this.state.zukan.includes(g.id);
      const cells = g.ids.map((id) => (seen(id)
        ? `<button class="zk-cell" data-act="zk-pick" data-id="${id}">${creatureThumb(this.previews, id)}<small>${getCreature(id).name}</small></button>`
        : '<div class="zk-cell unknown"><span>？</span><small>未発見</small></div>')).join('');
      const reward = done && !claimed ? `<button data-act="zk-claim" data-id="${g.id}" class="primary">達成報酬 ${yen(g.reward)}</button>` : '';
      return `<h4 class="gs-sub">${g.name} ${got}/${g.ids.length}${!byStar && claimed ? ' ・ 達成' : ''}</h4><div class="zk-grid">${cells}</div>${reward}`;
    });
    return `<p class="gs-empty">発見 ${total}/${CREATURES.length}種</p>${tabs}${detail}${sections.join('')}`;
  }

  act(act, id) {
    if (act === 'zk-pick') this.pick = id;
    else if (act === 'zk-mode') this.mode = id === 'star' ? 'star' : 'area';
    else if (act === 'zk-claim') {
      const g = this.groups.find((x) => x.id === id);
      if (!this.state.zukan.includes(id)) {
        this.state.zukan.push(id);
        this.economy.earn(g.reward);
        this.toast(`${g.name} の図鑑を達成！ ${yen(g.reward)} を獲得`);
      }
    } else return false;
    return true;
  }
}

/** イベント開催 */
export class EventView {
  constructor({ economy, state, getStats, toast, onStart }) {
    Object.assign(this, { economy, state, getStats, toast, onStart });
  }

  html() {
    const now = Date.now();
    const active = this.state.event?.until > now ? this.state.event : null;
    const stats = this.getStats();
    const head = active
      ? `<div class="st-sum"><b>開催中：${EVENTS.find((e) => e.id === active.id).name}</b><small>残り <span data-until="${active.until}"></span></small></div>`
      : '<p class="gs-empty">開催中は来館者が増えます。同時に開けるのは1つです。</p>';
    const rows = EVENTS.map((e) => {
      const cool = (this.state.cooldown[e.id] ?? 0) - now;
      const lack = e.need(stats);
      const ok = !active && cool <= 0 && !lack && this.economy.canAfford(e.cost);
      const note = lack || (cool > 0 ? `次の開催まで ${span(cool / 1000)}` : `${e.minutes}分間 ・ 来館者 ${e.mult}倍`);
      return `<div class="gs-row"><div class="gs-info"><b>${e.name}</b><small>${e.text}</small><small>${note}</small></div><button data-act="event-start" data-id="${e.id}" class="primary" ${ok ? '' : 'disabled'}>${yen(e.cost)}</button></div>`;
    });
    return head + rows.join('');
  }

  act(act, id) {
    if (act !== 'event-start') return false;
    const e = EVENTS.find((x) => x.id === id);
    const now = Date.now();
    if (this.state.event?.until > now || e.need(this.getStats()) || !this.economy.spend(e.cost)) return true;
    this.state.event = { id, until: now + e.minutes * 60000 };
    this.state.cooldown[id] = now + (e.minutes + 30) * 60000;
    this.onStart();
    this.toast(`${e.name} を開催しました`);
    return true;
  }
}
