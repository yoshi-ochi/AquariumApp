import { getCreature } from '../expedition/creatureData.js';
import { xpPerFish, progressOf, sizeOf, MAX_LEVEL } from '../expedition/growth.js';
import { syncLife } from '../expedition/tankLife.js';
import { qtyPanel, creatureInfo } from './creatureGrid.js';

const num = (n) => Math.round(n).toLocaleString('ja-JP');

/** 展示している匹数（全水槽） */
export const shownCount = (manager, id) => manager.tanks.reduce((s, t) => s + (t.userData.creatures?.[id] ?? 0), 0);

/** レベルと次のレベルまでのバー */
export function growBar(expeditions, id) {
  const p = progressOf(expeditions.xp[id] ?? 0);
  const size = Math.round(sizeOf(p.lv) * 100);
  const rest = p.need ? `次まで ${num(p.need - p.have)} ・ 1匹 +${num(xpPerFish(id))}` : '最大レベル';
  return `<div class="cg-grow"><b>Lv ${p.lv}</b><div class="mo-bar"><span style="width:${p.need ? (p.have / p.need) * 100 : 100}%"></span></div><small>体の大きさ ${size}% ・ ${rest}</small></div>`;
}

/**
 * 図鑑の育成カードの中身：レベル・在庫と展示数・数の選択・「成長させる」。
 * 素材は在庫の同じ魚種だけ（展示中の魚は使わない）。在庫が無ければ選択の代わりに案内を出す。
 */
export function growPanel({ expeditions, manager, id, qty, note = '' }) {
  const c = getCreature(id);
  const have = expeditions.count(id);
  const info = creatureInfo(id, `在庫 ${have} ・ 展示中 ${shownCount(manager, id)}`);
  const extra = `${note}${growBar(expeditions, id)}`;
  const maxed = expeditions.level(id) >= MAX_LEVEL;
  if (!have || maxed) {
    const msg = maxed ? '最大レベルに達しました。' : '在庫がありません。採取すると成長に使えます（展示中の魚は使いません）。';
    return `<div class="cg-head"><b>${c.name}</b><small>${info}</small></div>${extra}<p class="gs-empty">${msg}</p>`;
  }
  return qtyPanel({
    title: c.name, info, extra, max: have, qty,
    buttons: [{ act: 'zk-grow', id: `${id}:{n}`, label: '{n}匹で成長させる +{xp}', xp: xpPerFish(id), primary: true }],
  });
}

/** 在庫の n 匹を成長に使い、展示中の同じ魚種を大きくする。結果を通知する */
export function growSpecies({ expeditions, manager, toast }, key) {
  const [id, n] = key.split(':');
  const r = expeditions.grow(id, Math.min(Number(n) || 1, expeditions.count(id)));
  if (!r) return false;
  for (const t of manager.tanks) if (t.userData.creatures?.[id]) syncLife(t);
  const name = getCreature(id).name;
  toast(r.to > r.from ? `${name} が Lv${r.to} に成長しました！` : `${name} に経験値 +${num(r.gained)}`);
  return true;
}
