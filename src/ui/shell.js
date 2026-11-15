import { CATEGORY } from '../tanks/tankData.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;

/**
 * 画面の外枠：上部ボタン（メニュー・戻る・編集・完了）、メニュー、編集シートの表示切替。
 * モード: 'home' | 'tank' | 'hall-edit' | 'interior-edit'
 */
export class AppShell {
  constructor({ economy, manager, onBack, onEdit, onDone, onFloorChange, onUpgrade, onSave, onLoad }) {
    this.economy = economy;
    this.manager = manager;
    this.mode = 'home';

    $('btn-back').addEventListener('click', onBack);
    $('btn-edit').addEventListener('click', onEdit);
    $('btn-done').addEventListener('click', onDone);
    $('btn-menu').addEventListener('click', () => this.toggleMenu());
    $('floor-up').addEventListener('click', () => onFloorChange(economy.floor + 1));
    $('floor-down').addEventListener('click', () => onFloorChange(economy.floor - 1));
    $('btn-upgrade').addEventListener('click', onUpgrade);
    $('btn-save').addEventListener('click', onSave);
    const file = $('file-load');
    $('btn-load').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      if (file.files[0]) onLoad(file.files[0]);
      file.value = '';
    });
    // メニュー外をタップしたら閉じる
    document.addEventListener('pointerdown', (e) => {
      if (!$('menu-sheet').hidden && !e.target.closest('#menu-sheet, #btn-menu')) this.toggleMenu(false);
    });

    economy.addEventListener('change', () => this.update());
    this.update();
  }

  setMode(mode, title = '') {
    this.mode = mode;
    const editing = mode === 'hall-edit' || mode === 'interior-edit';
    $('btn-menu').hidden = mode !== 'home' && mode !== 'hall-edit';
    $('btn-back').hidden = mode !== 'tank';
    $('btn-edit').hidden = editing;
    $('btn-done').hidden = !editing;
    $('editor').hidden = !editing;
    $('mode-title').textContent = title;
    document.body.classList.toggle('editing', editing);
    this.toggleMenu(false);
    this.update();
  }

  toggleMenu(force) {
    const sheet = $('menu-sheet');
    sheet.hidden = force === undefined ? !sheet.hidden : !force;
  }

  update() {
    const e = this.economy;
    const st = e.stage;
    $('menu-stats').textContent =
      `資金 ${yen(e.money)} ・ 来館者 ${e.visitors.toLocaleString('ja-JP')}人 ・ 水槽 ${this.manager.countByCategory(CATEGORY.TANK)}基`;
    $('floor-label').textContent = `${e.floor + 1}F / ${st.maxFloors}F`;
    $('floor-down').disabled = e.floor <= 0;
    $('floor-up').disabled = e.floor >= st.maxFloors - 1;
    $('menu-stage').textContent = `Lv${st.level} ${st.name}`;
    const next = e.nextStage;
    const up = $('btn-upgrade');
    up.textContent = next ? `拡張 ${yen(next.upgradeCost)}` : '最大規模';
    up.disabled = !next || !e.canAfford(next.upgradeCost);
  }

  setHint(text) {
    $('hint').textContent = text ?? '';
  }
}
