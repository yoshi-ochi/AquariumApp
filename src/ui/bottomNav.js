import { icon } from './icons.js';

const ITEMS = [
  ['layout', 'layout', 'レイアウト'],
  ['shop', 'shop', '店舗運営'],
  ['ally', 'ally', '同盟水族館'],
  ['items', 'items', 'アイテム'],
  ['event', 'event', 'イベント'],
  ['map', 'map', '地図'],
];

/** 画面下部のメインメニュー。押された id を onSelect に渡す */
export class BottomNav {
  constructor({ el, onSelect }) {
    el.innerHTML = ITEMS.map(
      ([id, ic, label]) => `<button data-nav="${id}" id="nav-${id}" class="${id === 'map' ? 'nav-main' : ''}"><span class="nav-ico">${icon(ic, id === 'map' ? 30 : 24)}</span><span>${label}</span></button>`,
    ).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-nav]');
      if (b) onSelect(b.dataset.nav);
    });
    this.el = el;
  }

  /** ボタンの表示を変える（地図を開いている間は「地図」を「水族館」にする など） */
  setButton(id, iconName, label) {
    const b = this.el.querySelector(`#nav-${id}`);
    if (!b) return;
    const big = b.classList.contains('nav-main');
    b.innerHTML = `<span class="nav-ico">${icon(iconName, big ? 30 : 24)}</span><span>${label}</span>`;
  }
}
