import * as THREE from 'three';

/**
 * 室内ライトのドラッグ操作（部屋 > 照明 を開いている間だけ有効）。
 * - 電球をドラッグ → 天井の高さのまま水平移動（位置）
 * - 床のリングをドラッグ → 照射点が動き、ライトの向きが変わる
 * ハンドルを掴んだときは他の操作（オブジェ選択・カメラ）にイベントを渡さない。
 */
export class LightInteraction {
  constructor({ sceneMgr, cameraCtl, room, getSettings, onSelect, onChanged }) {
    Object.assign(this, { sceneMgr, cameraCtl, room, getSettings, onSelect, onChanged });
    this.enabled = false;
    this.dom = sceneMgr.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.drag = null;

    this.dom.addEventListener('pointerdown', this._onDown, { capture: true });
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  _ray(e) {
    const r = this.dom.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.sceneMgr.camera);
  }

  _onDown = (e) => {
    if (!this.enabled || !e.isPrimary || e.button !== 0) return;
    this._ray(e);
    const hit = this.raycaster.intersectObjects(this.room.handles, false)[0];
    if (!hit) return;
    const { lightIndex, handle } = hit.object.userData;
    e.stopImmediatePropagation(); // 選択・カメラ操作に渡さない
    this.cameraCtl.setEnabled(false);
    this.drag = { lightIndex, handle };
    this.onSelect?.(lightIndex);
  };

  _onMove = (e) => {
    if (!this.drag || !e.isPrimary) return;
    const l = this.getSettings().lights[this.drag.lightIndex];
    this._ray(e);
    this.plane.constant = this.drag.handle === 'bulb' ? -l.height : 0;
    const p = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!p) return;
    const b = this.room.plan.bounds();
    const x = THREE.MathUtils.clamp(p.x, b.x0, b.x1);
    const z = THREE.MathUtils.clamp(p.z, b.z0, b.z1);
    if (this.drag.handle === 'bulb') {
      // 電球と一緒に照射点も平行移動（向きを保つ）
      l.tx += x - l.x;
      l.tz += z - l.z;
      l.x = x;
      l.z = z;
    } else {
      l.tx = x;
      l.tz = z;
    }
    this.room.updateLight(this.drag.lightIndex, l);
  };

  _onUp = (e) => {
    if (!this.drag || !e.isPrimary) return;
    this.drag = null;
    this.cameraCtl.setEnabled(true);
    this.onChanged?.();
  };
}
