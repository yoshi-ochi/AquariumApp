import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** OrbitControls のラッパー（Damping 有効、タッチ：1本指で回転・2本指でズーム/移動） */
export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 0.3;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
  }

  /** 床全体（外接矩形 b）が縦横どちらの画面でも収まる位置にカメラを置く */
  frameBounds(b) {
    const radius = Math.hypot(b.w, b.d) / 2;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.95;
    const target = new THREE.Vector3(b.cx, 0.4, b.cz);
    const dir = new THREE.Vector3(0.45, 0.85, 0.85).normalize();
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.controls.target.copy(target);
    this.controls.maxDistance = dist * 2.5;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  update() {
    this.controls.update();
  }
}
