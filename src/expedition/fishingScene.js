import * as THREE from 'three';
import { BED, GEAR } from './fishingGear.js';
import { getMethod } from './fishingData.js';

const SCHOOL = 70;

/** 小さな魚の群れ。set() で指定した位置へ少しずつ移動する */
class School {
  constructor(group) {
    const geo = new THREE.ConeGeometry(0.16, 0.7, 5).rotateZ(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xbcd3df, metalness: 0.5, roughness: 0.3 }), SCHOOL);
    this.mesh.frustumCulled = false;
    group.add(this.mesh);
    this.c = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.r = 6;
    this.tr = 6;
    this.first = true;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
  }

  set(x, y, z, r) {
    this.target.set(x, y, z);
    this.tr = r;
    if (this.first) {
      this.c.copy(this.target);
      this.r = r;
      this.first = false;
    }
  }

  update(dt, t) {
    const k = Math.min(1, dt * 1.6);
    this.c.lerp(this.target, k);
    this.r += (this.tr - this.r) * k;
    for (let i = 0; i < SCHOOL; i++) {
      const a = t * (0.5 + (i % 5) * 0.08) + i * 2.4;
      const rr = this.r * (0.35 + ((i * 37) % 65) / 100);
      this.p.set(this.c.x + Math.cos(a) * rr, Math.min(-0.4, this.c.y + Math.sin(i * 1.7 + t * 0.7) * this.r * 0.32), this.c.z + Math.sin(a) * rr);
      this.q.setFromAxisAngle(this.up, -a - Math.PI / 2);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function buildBoat(hullColor = 0x1f5f8b) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f3f2, roughness: 0.5 });
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-5, 1.3);
  hullShape.lineTo(-5, -1.3);
  hullShape.lineTo(3, -1.5);
  hullShape.quadraticCurveTo(6, -0.6, 6.6, 0);
  hullShape.quadraticCurveTo(6, 0.6, 3, 1.5);
  hullShape.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 1.6, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.5 }));
  hull.position.y = -0.5;
  const house = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 2), white);
  house.position.set(-1.6, 2, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x24404f, roughness: 0.2 }));
  bridge.position.set(-1.6, 3.3, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4, 6), white);
  mast.position.set(1.5, 2.8, 0);
  g.add(hull, house, bridge, mast);
  return g;
}

/** 漁法の作業を3Dで再現し、解説を表示する全画面シーン */
export class FishingScene {
  constructor(el) {
    this.el = el;
    el.innerHTML = `<canvas id="fs-canvas"></canvas>
      <div class="fs-top"><b id="fs-name"></b><small id="fs-count"></small></div>
      <div class="fs-card"><b id="fs-step"></b><p id="fs-text"></p><div class="st-bar"><i id="fs-bar"></i></div>
        <details><summary>この漁法について</summary><p id="fs-how"></p><p id="fs-note"></p></details>
        <button id="fs-skip">スキップ</button></div>`;
    this.$ = (id) => el.querySelector(`#fs-${id}`);
    this.$('skip').addEventListener('click', () => this._finish());
  }

  /** 作業の再現を再生し、終わると解決する。lastText は最後に表示する結果 */
  play(methodId, lastText = '') {
    const method = getMethod(methodId);
    this.el.hidden = false;
    this.method = method;
    this.lastText = lastText;
    this.$('name').textContent = method.name;
    this.$('how').textContent = method.how;
    this.$('note').textContent = `資源を守る視点：${method.note}`;
    this.$('skip').textContent = 'スキップ';
    this._start(method);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  _start(method) {
    const canvas = this.$('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd8ef);
    scene.add(new THREE.HemisphereLight(0xf2fbff, 0x35617a, 1.7));
    const sun = new THREE.DirectionalLight(0xfff4dc, 1.5);
    sun.position.set(-20, 40, 20);
    scene.add(sun);
    const group = new THREE.Group();
    scene.add(group);
    // 水中が見える断面の海
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(130, 90, 48, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f8fb8, transparent: true, opacity: 0.42, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    const water = new THREE.Mesh(new THREE.BoxGeometry(130, -BED, 90), new THREE.MeshBasicMaterial({ color: 0x1c6f96, transparent: true, opacity: 0.2, depthWrite: false }));
    water.position.y = BED / 2;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(170, 110, 34, 22).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9a878, roughness: 1, flatShading: true }));
    const pos = bed.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 0.4) * 0.3 + Math.cos(pos.getZ(i) * 0.5) * 0.3);
    bed.geometry.computeVertexNormals();
    bed.position.y = BED;
    group.add(bed, water, sea);
    const makeBoat = (hull) => {
      const b = buildBoat(hull);
      group.add(b);
      b.place = (x, z, yaw) => {
        b.position.x = x;
        b.position.z = z;
        b.rotation.y = yaw;
      };
      return b;
    };
    const boat = makeBoat();
    const school = new School(group);
    const update = GEAR[method.id]({ group, boat, makeBoat, school, bed, scene });
    const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 300);
    this.view = { scene, camera, sea, boat, school, update };
    this.stepIndex = 0;
    this.stepTime = 0;
    this.time = 0;
    this._showStep();
    this.last = performance.now();
    this._resize();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    this.renderer.setSize(w, h, false);
    const { camera } = this.view;
    camera.aspect = w / h;
    const k = Math.max(1, 1.05 / camera.aspect);
    camera.position.set(-34 * k, 19 * k, 42 * k);
    camera.lookAt(0, -5, 0);
    camera.updateProjectionMatrix();
  }

  _showStep() {
    const s = this.method.steps[this.stepIndex];
    this.$('count').textContent = `作業 ${this.stepIndex + 1} / ${this.method.steps.length}`;
    this.$('step').textContent = s.title;
    this.$('text').textContent = s.text;
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.stepTime += dt;
    const steps = this.method.steps;
    const s = steps[this.stepIndex];
    const p = Math.min(1, this.stepTime / s.sec);
    const v = this.view;
    v.update(this.stepIndex, p, this.time);
    v.school.update(dt, this.time);
    v.boat.position.y = Math.sin(this.time * 1.3) * 0.12;
    v.boat.rotation.z = Math.sin(this.time * 0.9) * 0.025;
    const pos = v.sea.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 0.35 + this.time * 1.4) * 0.14 + Math.cos(pos.getZ(i) * 0.4 + this.time) * 0.1);
    pos.needsUpdate = true;
    this.$('bar').style.width = `${((this.stepIndex + p) / steps.length) * 100}%`;
    this.renderer.render(v.scene, v.camera);
    if (p < 1) return;
    if (this.stepIndex < steps.length - 1) {
      this.stepIndex++;
      this.stepTime = 0;
      this._showStep();
    } else this._complete();
  }

  /** 全作業が終わったら結果を見せて、閉じるボタンにする */
  _complete() {
    this.renderer.setAnimationLoop(null);
    if (!this.lastText) return this._finish();
    this.$('step').textContent = '結果';
    this.$('text').textContent = this.lastText;
    this.$('skip').textContent = '閉じる';
    this.lastText = '';
  }

  _finish() {
    if (this.lastText) return this._complete();
    this.renderer.setAnimationLoop(null);
    this.view.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    // 使い終えた canvas は作り直す（失われた描画コンテキストを再利用しない）
    const old = this.$('canvas');
    const fresh = old.cloneNode();
    old.replaceWith(fresh);
    this.el.hidden = true;
    this.resolve?.();
    this.resolve = null;
  }
}
