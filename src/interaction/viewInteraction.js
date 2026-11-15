import * as THREE from 'three';
import { CATEGORY } from '../tanks/tankData.js';

const TAP_TOLERANCE = 8; // px

/** 閲覧モード（ホーム）：タップした水槽を onTankTap で知らせる。ドラッグはカメラ操作に任せる */
export class ViewInteraction {
  constructor({ sceneMgr, manager, onTankTap }) {
    this.sceneMgr = sceneMgr;
    this.manager = manager;
    this.onTankTap = onTankTap;
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.down = null;

    this.dom.addEventListener('pointerdown', (e) => {
      if (this.enabled && e.isPrimary) this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      else this.down = null; // 2本指はタップではない
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!this.enabled || !d || !e.isPrimary) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_TOLERANCE || performance.now() - d.t > 500) return;
      const tank = this._pickTank(e);
      if (tank) this.onTankTap(tank);
    });
  }

  _pickTank(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.sceneMgr.camera);
    for (const h of this.raycaster.intersectObjects(this.manager.getPickables(), true)) {
      const root = this.manager.findRoot(h.object);
      if (root) return this.manager.defOf(root).category === CATEGORY.TANK ? root : null;
    }
    return null;
  }
}
