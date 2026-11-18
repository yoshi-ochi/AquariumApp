import { GRID_X, GRID_Z, LAYOUTS } from '../building/blueprint.js';

/** 初期設定の間取り選択。選んだ間取りの id を返す */
const META = {
  entrance: '#7fc8e8', yard1: '#c9ccd0', yard2: '#c9ccd0', coast: '#6fbf9a', subtropical: '#f2b45a', gallery: '#8fd3e0',
  atrium: '#3f8fd0', deep: '#4a5a9c', archive: '#b79bd8', pool: '#54c0d8',
};
const FLOORS = [
  ['1F', ['pool', 'yard1', 'coast', 'subtropical', 'atrium', 'entrance']],
  ['2F', ['yard2', 'deep', 'archive', 'gallery']],
];
const LEGEND = [['entrance', '入口'], ['coast', '近海'], ['subtropical', '亜熱帯'], ['atrium', '大水槽'], ['deep', '深海'], ['archive', '資料'], ['yard1', '職員'], ['pool', 'プール']];

function planSvg(layout, ids, label) {
  const rects = ids.flatMap((id) => layout.rects[id].map(([x0, z0, x1, z1]) => `<rect x="${x0}" y="${z0}" width="${x1 - x0 + 1}" height="${z1 - z0 + 1}" fill="${META[id]}"/>`));
  const [vx0, vz0, vx1, vz1] = layout.voidRect;
  const hole = label === '2F' ? `<rect x="${vx0}" y="${vz0}" width="${vx1 - vx0 + 1}" height="${vz1 - vz0 + 1}" fill="#123f60"/>` : '';
  return `<figure><svg viewBox="0 0 ${GRID_X} ${GRID_Z}" role="img" aria-label="${layout.name} ${label}の間取り">${rects.join('')}${hole}</svg><figcaption>${label}</figcaption></figure>`;
}

export function pickLayout(el) {
  return new Promise((resolve) => {
    let chosen = LAYOUTS[0].id;
    const cards = LAYOUTS.map((l) => `<button class="lp-card" data-id="${l.id}">
      <span class="lp-plans">${FLOORS.map(([label, ids]) => planSvg(l, ids, label)).join('')}</span>
      <b>${l.name}</b><small>${l.summary}</small><small class="lp-from">${l.inspired}</small></button>`).join('');
    el.innerHTML = `<div class="lp-box"><h2>水族館の間取りを選ぶ</h2>
      <p>建物全体の形と順路が決まります。あとから変更はできません。</p>
      <div class="lp-grid">${cards}</div>
      <p class="lp-legend">${LEGEND.map(([id, t]) => `<i style="background:${META[id]}"></i>${t}`).join('')}</p>
      <button id="lp-ok" class="primary">この間取りで始める</button></div>`;
    el.hidden = false;
    const mark = () => el.querySelectorAll('.lp-card').forEach((c) => c.classList.toggle('active', c.dataset.id === chosen));
    mark();
    el.onclick = (e) => {
      const card = e.target.closest('.lp-card');
      if (card) {
        chosen = card.dataset.id;
        return mark();
      }
      if (e.target.id !== 'lp-ok') return;
      el.hidden = true;
      el.onclick = null;
      resolve(chosen);
    };
  });
}

