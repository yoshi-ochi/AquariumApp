import { FLOOR_TYPES, WALL_TYPES, MAX_LIGHTS, defaultLight } from '../room/roomData.js';

/**
 * 部屋の編集パネル（床・壁・照明・形状）。
 * 設定オブジェクト settings を直接書き換え、onChange(kind) で反映を依頼する。
 * kind: 'look' | 'lights' | 'shape-mode'
 */
export class RoomPanel {
  constructor({ el, getSettings, getPlan, onChange }) {
    Object.assign(this, { el, getSettings, getPlan, onChange });
    this.section = 'floor';
    this.brush = 'floor';
    this.lightIndex = 0;
    this.shapeEditing = false;

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn) this._act(btn.dataset.act, btn.dataset.v);
    });
    el.addEventListener('input', (e) => {
      const input = e.target.closest('[data-field]');
      if (input) this._field(input.dataset.field, input.type === 'color' ? input.value : Number(input.value), input);
    });
  }

  render() {
    const s = this.getSettings();
    const tab = (id, label) => `<button data-act="section" data-v="${id}" class="${this.section === id ? 'active' : ''}">${label}</button>`;
    let body = '';
    if (this.section === 'floor') body = this._lookSection('floor', FLOOR_TYPES, s.floor);
    else if (this.section === 'wall') body = this._lookSection('wall', WALL_TYPES, s.wall);
    else if (this.section === 'light') body = this._lightSection(s.lights);
    else body = this._shapeSection();
    this.el.innerHTML = `<div class="seg">${tab('floor', '床')}${tab('wall', '壁')}${tab('light', '照明')}${tab('shape', '形状')}</div>${body}`;
  }

  setVisible(visible) {
    this.el.hidden = !visible;
    if (visible) this.render();
    this._setShapeEditing(visible && this.section === 'shape');
    this.onChange('light-mode', visible && this.section === 'light');
  }

  /** 電球のドラッグなどで照明が選ばれたとき */
  selectLight(i) {
    if (this.lightIndex === i) return;
    this.lightIndex = i;
    this.render();
  }

  _lookSection(kind, types, cur) {
    return `
      <div class="seg">${types.map((t) => `<button data-act="${kind}-type" data-v="${t.id}" class="${cur.type === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div>
      <div class="row"><span class="label">色</span><input type="color" data-field="${kind}-color" value="${cur.color}"></div>`;
  }

  _lightSection(lights) {
    this.lightIndex = Math.min(this.lightIndex, lights.length - 1);
    const l = lights[this.lightIndex];
    const chips = lights
      .map((_, i) => `<button data-act="light-pick" data-v="${i}" class="${i === this.lightIndex ? 'active' : ''}">💡${i + 1}</button>`)
      .join('');
    const range = (name, label, min, max, step, value, unit) =>
      `<label class="slider">${label}<input type="range" data-field="light-${name}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}${unit}</output></label>`;
    return `
      <div class="seg">${chips}
        <button data-act="light-add" ${lights.length >= MAX_LIGHTS ? 'disabled' : ''}>＋</button>
        <button data-act="light-remove" class="danger" ${lights.length <= 1 ? 'disabled' : ''}>削除</button></div>
      ${l ? `
      <p class="note">💡 電球をドラッグで移動、床の ◎ をドラッグで照らす向きを変えられます。</p>
      ${range('height', '高さ', 0.5, 5, 0.05, l.height, 'm')}
      ${range('intensity', '光量', 0, 4, 0.05, l.intensity, '')}
      ${range('angle', '照射角', 20, 150, 5, l.angle, '°')}
      <div class="row"><span class="label">色調</span><input type="color" data-field="light-color" value="${l.color}">
        <button data-act="light-preset" data-v="#ffd9a8">電球色</button>
        <button data-act="light-preset" data-v="#fff6e8">温白色</button>
        <button data-act="light-preset" data-v="#e8f2ff">昼光色</button></div>` : ''}`;
  }

  _shapeSection() {
    const plan = this.getPlan();
    const b = (id, label) => `<button data-act="brush" data-v="${id}" class="${this.brush === id ? 'active' : ''}">${label}</button>`;
    return `
      <div class="seg">${b('floor', '🟩 館内')}${b('yard', '🟧 バックヤード')}${b('erase', '⬜ 消す')}</div>
      <p class="note">選んだ種類でマスをタップして塗ります。面積（マス数）は一定です。<br>
      館内とバックヤードの境は仕切り壁になり、水槽の埋め込みと飼育員用ドアの設置ができます。</p>
      <div class="row"><b>残り ${plan.remaining} マス</b><span class="note">（全 ${plan.quota} マス）</span>
        <button data-act="shape-reset">長方形に戻す</button></div>`;
  }

  _setShapeEditing(v) {
    if (this.shapeEditing === v) return;
    this.shapeEditing = v;
    this.onChange('shape-mode', v);
  }

  _act(act, v) {
    const s = this.getSettings();
    if (act === 'section') {
      this.section = v;
      this.render();
      this._setShapeEditing(v === 'shape');
      this.onChange('light-mode', v === 'light');
      return;
    }
    if (act === 'brush') {
      this.brush = v;
      return this.render();
    }
    if (act === 'floor-type') s.floor.type = v;
    else if (act === 'wall-type') s.wall.type = v;
    else if (act === 'light-pick') this.lightIndex = Number(v);
    else if (act === 'light-add' && s.lights.length < MAX_LIGHTS) {
      const b = this.getPlan().bounds();
      s.lights.push(defaultLight(b.cx, b.cz));
      this.lightIndex = s.lights.length - 1;
    } else if (act === 'light-remove' && s.lights.length > 1) {
      s.lights.splice(this.lightIndex, 1);
      this.lightIndex = 0;
    } else if (act === 'light-preset') {
      s.lights[this.lightIndex].color = v;
      this.onChange('light-update', this.lightIndex);
      return this.render();
    }
    else if (act === 'shape-reset') return this.onChange('shape-reset');
    this.onChange(act.startsWith('light') ? 'lights' : 'look');
    this.render();
  }

  _field(field, value, input) {
    const s = this.getSettings();
    if (field === 'floor-color') s.floor.color = value;
    else if (field === 'wall-color') s.wall.color = value;
    else if (field.startsWith('light-')) {
      s.lights[this.lightIndex][field.slice(6)] = value;
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = `${value}${out.textContent.replace(/^[-\d.]+/, '')}`;
      return this.onChange('light-update', this.lightIndex);
    }
    this.onChange('look');
  }

  /** 形状編集のマス数表示を更新 */
  refresh() {
    if (!this.el.hidden && this.section === 'shape') this.render();
  }
}
