import * as THREE from 'three';
import { TankManager } from '../tanks/tankManager.js';
import { CELL } from '../room/floorPlan.js';

const BRUSH_TYPE = { floor: CELL.FLOOR, yard: CELL.YARD, erase: CELL.NONE };

const TAP_TOLERANCE = 8;

/** 床の形状編集：タップしたマスの ON/OFF を切り替える（ドラッグはカメラ操作） */
export class ShapeInteraction {
  constructor({ sceneMgr, room, manager, toast, onChanged, getBrush }) {
    Object.assign(this, { sceneMgr, room, manager, toast, onChanged, getBrush });
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.down = null;

    this.dom.addEventListener('pointerdown', (e) => {
      this.down = this.enabled && e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!this.enabled || !d || !e.isPrimary || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_TOLERANCE) return;
      this._tap(e);
    });
  }

  _tap(e) {
    const r = this.dom.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.sceneMgr.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!hit) return;
    const plan = this.room.plan;
    const [i, j] = plan.cellOf(hit.x, hit.z);
    const type = BRUSH_TYPE[this.getBrush()] ?? CELL.FLOOR;
    if (plan.at(i, j) && plan.at(i, j) !== type && this._occupied(i, j)) return this.toast('オブジェが載っているマスは変えられません', { error: true });
    const res = plan.setCell(i, j, type);
    if (!res.ok) return res.reason && this.toast(res.reason, { error: true });
    this.onChanged();
  }

  /** そのマスに（全階の）オブジェの足元が掛かっているか */
  _occupied(i, j) {
    for (const o of this.manager.objects.values()) {
      if (o.userData.embed) continue;
      const { hx, hz } = TankManager.footprintHalf(this.manager.defOf(o), o.rotation.y);
      if (this.room.plan.rectOverlapsCell(o.position.x, o.position.z, hx, hz, i, j)) return true;
    }
    return false;
  }
}
