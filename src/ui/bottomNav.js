import { icon } from './icons.js';

const ITEMS = [
  ['expedition', 'expedition', '採取遠征'],
  ['shop', 'shop', '店舗運営'],
  ['ally', 'ally', '同盟水族館'],
  ['items', 'items', 'アイテム'],
  ['more', 'more', 'その他'],
  ['layout', 'layout', 'レイアウト'],
];

/** 画面下部のメインメニュー。押された id を onSelect に渡す */
export class BottomNav {
  constructor({ el, onSelect }) {
    el.innerHTML = ITEMS.map(
      ([id, ic, label]) => `<button data-nav="${id}" id="nav-${id}" class="${id === 'layout' ? 'nav-main' : ''}"><span class="nav-ico">${icon(ic, id === 'layout' ? 30 : 24)}</span><span>${label}</span></button>`,
    ).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-nav]');
      if (b) onSelect(b.dataset.nav);
    });
  }
}
