import * as THREE from 'three';
import { FloorPlan, CELL } from '../room/floorPlan.js';
import { TankManager } from '../tanks/tankManager.js';
import { CATEGORY } from '../tanks/tankData.js';
import { CELL_SIZE, FLOOR_COUNT, GRID_X, GRID_Z, ZONES, zoneCenter, zoneHas } from './blueprint.js';
import { Exterior } from './exterior.js';

/** フロアを上下に離して並べる全館ビューの階の間隔(m) */
const STACK_GAP = 24;
const TWEEN = 0.8;
const ease = (t) => t * t * (3 - 2 * t);

function textSprite(text, bg, w = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 88;
  const c = canvas.getContext('2d');
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(2, 2, 380, 84, 22);
  c.fill();
  c.fillStyle = '#fff';
  c.font = '700 40px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 192, 46);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false }));
  s.scale.set(w, (w * 88) / 384, 1);
  s.renderOrder = 950;
  s.raycast = () => {};
  return s;
}

/**
 * 表示の切り替え：floor（各階の編集画面）/ stack（全館を上下に分解した模型）/ exterior（外観）。
 * 全館ビューでは階をタップするとその階へ移動する。
 */
export class ViewModes {
  constructor({ sceneMgr, cameraCtl, room, manager, labels, pool, railEl, getFloor, getUnlocked, onFloor, onModeChange }) {
    Object.assign(this, { sceneMgr, cameraCtl, room, manager, labels, pool, railEl, getFloor, getUnlocked, onFloor, onModeChange });
    this.mode = 'floor';
    this.exterior = new Exterior(sceneMgr.scene);
    this.stack = new THREE.Group();
    this.stack.visible = false;
    sceneMgr.scene.add(this.stack);
    this.tween = null;
    this.slide = 0;
    this.raycaster = new THREE.Raycaster();
    railEl.innerHTML = `<button data-view="exterior">外観</button><button data-view="stack">全館</button>
      ${Array.from({ length: FLOOR_COUNT }, (_, f) => `<button data-floor="${FLOOR_COUNT - 1 - f}">${FLOOR_COUNT - f}F</button>`).join('')}`;
    railEl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.view) this.setMode(b.dataset.view);
      else this.goFloor(+b.dataset.floor);
    });
    const dom = sceneMgr.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => (this.down = [e.clientX, e.clientY]));
    dom.addEventListener('pointerup', (e) => this._tapStack(e));
    this.syncRail();
  }

  syncRail() {
    this.railEl.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.view ? b.dataset.view === this.mode : this.mode === 'floor' && +b.dataset.floor === this.getFloor();
      b.classList.toggle('active', on);
    });
  }

  /** 階を移動する（上下にスライドして切り替える） */
  goFloor(floor) {
    const from = this.getFloor();
    if (this.mode !== 'floor') this.setMode('floor');
    if (floor !== from) {
      this.onFloor(floor);
      this.slide = (floor - from) * 2.4;
    }
    this.syncRail();
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (this.mode === 'floor') this.saved = this._camera();
    this.mode = mode;
    const floor = mode === 'floor';
    this.room.group.visible = floor;
    this.room.built.visible = floor;
    this.manager.group.visible = floor;
    this.labels.group.visible = floor;
    this.exterior.show(mode === 'exterior');
    this.stack.visible = mode === 'stack';
    // 引きの表示では霞ませない
    const scene = this.sceneMgr.scene;
    if (!floor && scene.fog) [this.fog, scene.fog] = [scene.fog, null];
    else if (floor && this.fog) [scene.fog, this.fog] = [this.fog, null];
    this.pool.group.visible = mode !== 'stack' && this.getUnlocked().has('pool');
    if (mode === 'stack') this._buildStack();
    const c = this.cameraCtl.controls;
    c.maxDistance = floor ? this.saved?.maxDistance ?? c.maxDistance : 260;
    c.maxPolarAngle = Math.PI / 2 - 0.03;
    if (floor && this.saved) this._fly(this.saved.pos, this.saved.target);
    else if (mode === 'stack') this._fly(this._away(16, 74, 62, STACK_GAP / 2), new THREE.Vector3(0, STACK_GAP / 2, 0));
    else if (mode === 'exterior') this._fly(this._away(-34, 20, 62, 5), new THREE.Vector3(0, 5, 4));
    this.syncRail();
    this.onModeChange(mode);
  }

  /** 縦長の画面でも建物全体が収まるようカメラを引く */
  _away(x, y, z, targetY) {
    const k = Math.max(1, 0.72 / this.cameraCtl.camera.aspect);
    return new THREE.Vector3(x * k, targetY + (y - targetY) * k, z * k);
  }

  _camera() {
    const c = this.cameraCtl.controls;
    return { pos: this.cameraCtl.camera.position.clone(), target: c.target.clone(), maxDistance: c.maxDistance };
  }

  _fly(pos, target) {
    const c = this.cameraCtl.controls;
    this.tween = { t: 0, pos, target, fromPos: this.cameraCtl.camera.position.clone(), fromTarget: c.target.clone() };
  }

  /** 毎フレーム：カメラの移動と、階を切り替えたときのスライド */
  update(dt) {
    if (this.tween) {
      const w = this.tween;
      w.t = Math.min(1, w.t + dt / TWEEN);
      const k = ease(w.t);
      this.cameraCtl.camera.position.lerpVectors(w.fromPos, w.pos, k);
      this.cameraCtl.controls.target.lerpVectors(w.fromTarget, w.target, k);
      if (w.t >= 1) this.tween = null;
    }
    this.slide *= Math.exp(-dt * 9);
    if (Math.abs(this.slide) < 0.01) this.slide = 0;
    this.room.built.position.y = this.manager.group.position.y = -this.slide;
    this.room.lightGroup.position.y = -this.slide;
  }

  // ---- 全館ビュー --------------------------------------------------------------

  _buildStack() {
    this.stack.traverse((o) => {
      o.geometry?.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    });
    this.stack.clear();
    this.slabs = [];
    const unlocked = this.getUnlocked();
    for (let f = 0; f < FLOOR_COUNT; f++) this.stack.add(this._floorModel(f, unlocked));
  }

  _floorModel(floor, unlocked) {
    const g = new THREE.Group();
    g.position.y = floor * STACK_GAP;
    const plan = new FloorPlan(floor, unlocked);
    const cells = [];
    for (let j = 0; j < GRID_Z; j++) for (let i = 0; i < GRID_X; i++) if (plan.at(i, j) && plan.at(i, j) !== CELL.VOID) cells.push([i, j]);
    const tile = new THREE.BoxGeometry(CELL_SIZE, 0.3, CELL_SIZE);
    const slab = new THREE.InstancedMesh(tile, new THREE.MeshStandardMaterial({ roughness: 0.8 }), cells.length);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    cells.forEach(([i, j], k) => {
      const [x, z] = plan.cellMin(i, j);
      slab.setMatrixAt(k, m.makeTranslation(x + CELL_SIZE / 2, -0.15, z + CELL_SIZE / 2));
      const zone = ZONES.find((a) => a.floor === floor && zoneHas(a, i, j));
      slab.setColorAt(k, color.set(plan.at(i, j) === CELL.LOCKED ? '#6d7780' : zone?.color ?? '#cccccc'));
    });
    slab.userData.floor = floor;
    this.slabs.push(slab);
    g.add(slab);
    // 壁（模型なので低く）
    const runs = plan.runs().filter((r) => r.kind !== 'rail');
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.5, 0.14), new THREE.MeshStandardMaterial({ color: 0xf5f6f4, roughness: 0.7 }), runs.length);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    runs.forEach((r, k) => {
      const mid = (r.from + r.to) / 2;
      const pos = r.axis === 'x' ? new THREE.Vector3(mid, 0.75, r.line) : new THREE.Vector3(r.line, 0.75, mid);
      q.setFromAxisAngle(up, r.axis === 'x' ? 0 : Math.PI / 2);
      walls.setMatrixAt(k, m.compose(pos, q, new THREE.Vector3(r.to - r.from, 1, 1)));
    });
    walls.raycast = () => {};
    g.add(walls);
    // 置いてある物
    const objs = [...this.manager.objects.values()].filter((o) => o.userData.floor === floor && !o.userData.embed);
    if (objs.length) {
      const items = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), objs.length);
      objs.forEach((o, k) => {
        const def = this.manager.defOf(o);
        const { hx, hz } = TankManager.footprintHalf(def, o.rotation.y);
        const h = Math.min(def.size.h, 6);
        items.setMatrixAt(k, m.compose(new THREE.Vector3(o.position.x, h / 2, o.position.z), new THREE.Quaternion(), new THREE.Vector3(hx * 2, h, hz * 2)));
        items.setColorAt(k, color.set(def.category === CATEGORY.TANK ? '#2f9fd6' : '#e8dcc8'));
      });
      items.raycast = () => {};
      g.add(items);
    }
    // 名札
    for (const z of ZONES.filter((a) => a.floor === floor && a.type !== 'outdoor')) {
      const c = zoneCenter(z);
      const s = textSprite(z.name, unlocked.has(z.id) ? 'rgba(15,53,80,.9)' : 'rgba(80,88,96,.9)');
      s.position.set(c.x, 3.4, c.z);
      g.add(s);
    }
    const badge = textSprite(`${floor + 1}F`, '#e8862e', 5);
    badge.position.set(-(GRID_X / 2) * CELL_SIZE - 3.5, 2, (GRID_Z / 2) * CELL_SIZE - 4);
    g.add(badge);
    return g;
  }

  _tapStack(e) {
    if (this.mode !== 'stack' || !this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 8) return;
    const r = e.target.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.cameraCtl.camera);
    const hit = this.raycaster.intersectObjects(this.slabs, false)[0];
    if (hit) this.goFloor(hit.object.userData.floor);
  }
}
