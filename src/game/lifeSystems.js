import { INCOME_PER_VISITOR } from '../management/stageData.js';
import { CREATURES } from '../expedition/creatureData.js';
import { feed, feedCost, isHungry, hasLife } from '../expedition/husbandry.js';
import { Backyard } from '../building/backyard.js';
import { setCleanIntervalBoost } from '../tanks/tankCleaning.js';
import { BackyardView } from '../building/buildingViews.js';
import { Crowd } from '../visitors/crowd.js';
import { CareView, EventView, ZukanView } from './lifeViews.js';
import { EVENTS, GOALS, OFFLINE_MAX_HOURS, OFFLINE_RATE } from './gameData.js';

const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const emptyState = () => ({ goals: [], flags: {}, zukan: [], event: null, cooldown: {} });

/** 目標・オフライン収入・来館者・飼育・図鑑・イベントをまとめて管理する */
export class LifeSystems {
  constructor({ sceneMgr, room, manager, economy, ops, inventory, expeditions, previews, toast, getHome, goalEl, reportEl, isUnlocked }) {
    Object.assign(this, { manager, economy, ops, inventory, expeditions, toast, getHome, goalEl, reportEl });
    this.state = emptyState();
    this.crowd = new Crowd({ scene: sceneMgr.scene, room, manager });
    this.backyard = new Backyard({ manager, ops, economy, expeditions, toast, isUnlocked });
    expeditions.getCapacity = () => this.backyard.capacity;
    this.panels = {
      backyard: { title: 'バックヤード', live: true, view: new BackyardView({ backyard: this.backyard, expeditions, economy, previews, toast }) },
      care: { title: '飼育', live: true, view: new CareView({ manager, economy, toast, onFed: () => (this.state.flags.fed = true) }) },
      zukan: { title: '生き物図鑑', view: new ZukanView({ expeditions, previews, economy, state: this.state, toast }) },
      event: { title: 'イベント', live: true, view: new EventView({ economy, state: this.state, getStats: () => this.stats(), toast, onStart: () => (this.state.flags.event = true) }) },
    };
    goalEl.addEventListener('click', (e) => e.target.closest('button') && this._claimGoal());
    reportEl.addEventListener('click', (e) => e.target.closest('button') && (reportEl.hidden = true));
  }

  stats() {
    const tanks = this.manager.tanks;
    const count = (id) => [...this.manager.objects.values()].filter((o) => o.userData.defId === id).length;
    return {
      tanks: tanks.length,
      creatures: tanks.reduce((s, t) => s + Object.values(t.userData.creatures ?? {}).reduce((a, n) => a + n, 0), 0),
      species: CREATURES.filter((c) => this.expeditions.seenCount(c.id) > 0).length,
      guides: this.ops.staff.guide,
      shops: count('souvenirShop'),
      cafes: count('cafe'),
      hasHome: !!this.getHome(),
      flags: this.state.flags,
    };
  }

  /** イベント開催中の来館者倍率 */
  get visitorMult() {
    const e = this.state.event;
    const event = e && e.until > Date.now() ? EVENTS.find((x) => x.id === e.id).mult : 1;
    return event * (1 + this.backyard.level('display') * 0.05);
  }

  // ---- 毎秒の処理 ------------------------------------------------------------

  tick() {
    const s = this.stats();
    const count = (id) => [...this.manager.objects.values()].filter((o) => o.userData.defId === id).length;
    this.ops.shops = s.shops;
    this.ops.cafes = s.cafes;
    this.ops.wageMult = 1 - this.backyard.level('welfare') * 0.05;
    this.ops.cleanerRelief = count('cleanCenter');
    setCleanIntervalBoost(1 + Math.min(4, count('waterPlant')) * 0.25);
    this.backyard.tick();
    this._husbandry();
    this._renderGoal(s);
  }

  /** 飼育員が足りていれば自動でエサやり */
  _husbandry() {
    const staffed = this.ops.staff.keeper >= this.ops.required.keeper;
    for (const t of this.manager.tanks.filter(hasLife)) {
      if (staffed && isHungry(t) && this.economy.spend(feedCost(t))) feed(t);
    }
  }

  get _goal() {
    return GOALS.find((g) => !this.state.goals.includes(g.id));
  }

  _renderGoal(s) {
    const g = this._goal;
    const key = g ? `${g.id}:${g.done(s)}` : 'none';
    this.goalEl.hidden = !g;
    if (key === this._goalKey) return;
    this._goalKey = key;
    if (!g) return;
    const ready = g.done(s);
    this.goalEl.innerHTML = `<small>目標 ${GOALS.indexOf(g) + 1}/${GOALS.length}</small><b>${g.text}</b>${ready ? `<button class="primary">報酬 ${yen(g.reward)}</button>` : `<small>報酬 ${yen(g.reward)}</small>`}`;
  }

  _claimGoal() {
    const g = this._goal;
    if (!g || !g.done(this.stats())) return;
    this.state.goals.push(g.id);
    this.economy.earn(g.reward);
    this.toast(`目標達成！ ${yen(g.reward)} を獲得`);
    this._goalKey = null;
  }

  // ---- 閉じていた間の収入 ------------------------------------------------------

  /** 前回の保存からの経過時間ぶんの収入を受け取り、報告を表示する */
  settleOffline(savedAt, visitorMult) {
    const away = (Date.now() - Date.parse(savedAt)) / 1000;
    if (!(away >= 300)) return;
    const secs = Math.min(away, OFFLINE_MAX_HOURS * 3600);
    const visitors = Math.round(this.manager.totalAppeal() * this.economy.stage.visitorFactor * visitorMult);
    const income = visitors * INCOME_PER_VISITOR * secs * OFFLINE_RATE;
    const wages = this.ops.wages * secs * OFFLINE_RATE;
    const net = Math.max(0, Math.floor(income - wages));
    this.economy.earn(net);
    const h = Math.floor(away / 3600);
    const m = Math.floor((away % 3600) / 60);
    this.reportEl.innerHTML = `<h3>留守中の報告</h3><p>${h ? `${h}時間` : ''}${m}分の営業結果です。</p>
      <dl><dt>来館者</dt><dd>${visitors.toLocaleString('ja-JP')}人</dd><dt>入館料</dt><dd>${yen(income)}</dd><dt>賃金</dt><dd>−${yen(wages)}</dd><dt>受け取り</dt><dd><b>${yen(net)}</b></dd></dl>
      ${away > OFFLINE_MAX_HOURS * 3600 ? `<small>計算されるのは最大${OFFLINE_MAX_HOURS}時間までです。</small>` : ''}<button class="primary">受け取る</button>`;
    this.reportEl.hidden = false;
  }

  // ---- 保存 ------------------------------------------------------------------

  toJSON() {
    return { ...this.state, backyard: this.backyard.toJSON() };
  }

  /** 読み込み。旧データの「開店済み店舗」は設置待ちの在庫に変換する */
  fromJSON(data, { own, oldShops = 0 } = {}) {
    const { backyard, ...rest } = data ?? {};
    Object.assign(this.state, emptyState(), rest);
    this.backyard.fromJSON(backyard);
    this._goalKey = null;
    if (!own) return;
    for (const t of this.manager.tanks) for (const id of Object.keys(t.userData.creatures ?? {})) this.expeditions.markSeen(id);
    const placed = this.stats().shops;
    if (oldShops > placed) this.inventory.add('souvenirShop', oldShops - placed);
    this.ops.shops = placed;
  }
}
