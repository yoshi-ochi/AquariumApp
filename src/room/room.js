import * as THREE from 'three';
import { FloorPlan, CELL } from './floorPlan.js';
import { getTexture } from './textures.js';
import { runTheta } from './embed.js';
import { STORY_H } from '../building/blueprint.js';

const DIRT_MARGIN = 1.6;
const RAIL_H = 1.1;
const SHUTTER_H = 2.4;

/** 未解放エリアとの境の工事用パネル */
function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = '#f2c230';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#2c3238';
  c.lineWidth = 14;
  for (let k = -64; k < 128; k += 40) {
    c.beginPath();
    c.moveTo(k, 64);
    c.lineTo(k + 64, 0);
    c.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/**
 * 部屋：マス目の床（館内・バックヤード）、外壁・仕切り壁（埋め込み穴あき）、室内ライト、屋外の地面。
 */
export class Room {
  constructor(scene, sceneMgr) {
    this.scene = scene;
    this.sceneMgr = sceneMgr;
    this.group = new THREE.Group();
    this.group.name = 'room';
    scene.add(this.group);

    this.floorMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    // 壁は片面だが、室内ライトの影は両面で落とす（光が壁を突き抜けて外を照らさない）
    this.wallMat.shadowSide = THREE.DoubleSide;
    this.yardFloorMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xb9bec2, roughness: 0.95 });
    this.yardWallMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xd5d8da, roughness: 0.95 });
    this.yardWallMat.shadowSide = THREE.DoubleSide;
    this.alcoveMat = new THREE.MeshStandardMaterial({ map: getTexture('concrete'), color: 0xd5d8da, roughness: 0.95, side: THREE.DoubleSide });
    this.dirtMat = new THREE.MeshStandardMaterial({ map: getTexture('dirt'), roughness: 1, side: THREE.DoubleSide, depthWrite: false });

    // 屋外の芝生（固定）
    // 地面は深度を書かない（2階の吹き抜けから、地面より下に置いた1階部分を見下ろすため）
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: getTexture('grass'), roughness: 1, depthWrite: false }));
    grass.renderOrder = -10;
    grass.geometry.attributes.uv.array.forEach((_, i, a) => (a[i] *= 400)); // UV をメートル単位に
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.03;
    grass.receiveShadow = true;
    scene.add(grass);

    this.built = new THREE.Group();
    this.lightGroup = new THREE.Group();
    this.helperGroup = new THREE.Group();
    this.helperGroup.visible = false;
    this.group.add(this.built, this.lightGroup, this.helperGroup);
    this.lights = []; // { spot, bulb, aim, line }
    this.holes = [];
    this.lockedFloorMat = new THREE.MeshStandardMaterial({ color: 0x7d858b, roughness: 1 });
    this.shutterMat = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.8, side: THREE.DoubleSide });
    this.railMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ee, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  }

  // ---- 設定 -----------------------------------------------------------------

  /** 表示するフロアと解放済みエリアを設定する */
  setStage(stage, floor, unlocked) {
    this.stage = stage;
    this.plan = new FloorPlan(floor, unlocked);
  }

  applyLook({ floor, wall }) {
    // 塗りつぶし：模様なしのマット調
    this.floorMat.map = floor.type === 'solid' ? null : getTexture(floor.type);
    this.floorMat.roughness = floor.type === 'solid' ? 1 : 0.85;
    this.floorMat.color.set(floor.color);
    this.floorMat.needsUpdate = true;
    this.wallMat.map = getTexture(wall.type);
    this.wallMat.color.set(wall.color);
    this.wallMat.needsUpdate = true;
  }

  /** ライトを作り直す（数が変わるとき） */
  setLights(list) {
    for (const o of [...this.lightGroup.children, ...this.helperGroup.children]) {
      o.parent.remove(o);
      o.geometry?.dispose();
      o.material?.dispose();
      o.dispose?.();
    }
    this.lights = list.map((l, i) => {
      const spot = new THREE.SpotLight(0xffffff, 1, 0, 1, 0.6, 0);
      // 壁で光を止めるため影を落とす（スマホ向けに影の解像度は控えめ）
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      spot.shadow.bias = -0.0008;
      spot.shadow.normalBias = 0.03;
      spot.shadow.camera.near = 0.1;
      spot.shadow.camera.far = 30;
      this.lightGroup.add(spot, spot.target);
      // 編集時だけ見えるハンドル：電球（位置）と床の照射点（向き）
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial());
      bulb.userData = { lightIndex: i, handle: 'bulb' };
      // 中央まで塗った円（リングだと中心をタップしても掴めない）
      const aim = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false }));
      aim.rotation.x = -Math.PI / 2;
      aim.renderOrder = 6;
      aim.userData = { lightIndex: i, handle: 'aim' };
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.06 }));
      this.helperGroup.add(bulb, aim, line);
      const entry = { spot, bulb, aim, line };
      this._applyLight(entry, l);
      return entry;
    });
  }

  /** ライト1灯の値だけ更新（ドラッグ中など） */
  updateLight(i, l) {
    if (this.lights[i]) this._applyLight(this.lights[i], l);
  }

  _applyLight({ spot, bulb, aim, line }, l) {
    spot.color.set(l.color);
    spot.intensity = l.intensity * 3;
    spot.angle = THREE.MathUtils.degToRad(l.angle / 2);
    spot.position.set(l.x, l.height, l.z);
    spot.target.position.set(l.tx, 0, l.tz);
    bulb.position.copy(spot.position);
    bulb.material.color.set(l.color);
    aim.position.set(l.tx, 0.03, l.tz);
    aim.material.color.set(l.color);
    line.geometry.setFromPoints([spot.position, aim.position]);
    line.computeLineDistances();
    line.material.color.set(l.color);
  }

  /** ドラッグ可能なハンドル（レイキャスト対象） */
  get handles() {
    return this.lights.flatMap((e) => [e.bulb, e.aim]);
  }

  setEditVisible(visible) {
    this.helperGroup.visible = visible;
  }

  // ---- 形状 -----------------------------------------------------------------

  /** 床・壁・土を作り直す。holes: [{ key, along, width, bottom, top }] */
  rebuild(holes = this.holes) {
    this.holes = holes;
    for (const o of [...this.built.children]) {
      this.built.remove(o);
      o.geometry.dispose();
    }
    const plan = this.plan;
    this.built.add(this._floorMesh(plan, CELL.FLOOR, this.floorMat));
    this.built.add(this._floorMesh(plan, CELL.YARD, this.yardFloorMat));
    this.built.add(this._floorMesh(plan, CELL.LOCKED, this.lockedFloorMat));
    // 吹き抜けから見下ろす1階の床
    this.built.add(this._floorMesh(plan, CELL.VOID, this.floorMat, -STORY_H));
    for (const run of plan.runs()) {
      if (run.kind === 'shutter' || run.kind === 'rail') {
        this.built.add(this._wallMesh(run, [], run.kind === 'rail' ? this.railMat : this.shutterMat, false, run.kind === 'rail' ? RAIL_H : SHUTTER_H));
        continue;
      }
      const hs = holes.filter((h) => h.key === run.key && h.along >= run.from && h.along <= run.to);
      if (run.kind === 'partition') {
        // 仕切り壁は両面：館内側は選んだ壁材、バックヤード側はコンクリート
        this.built.add(this._wallMesh(run, hs, this.wallMat, false));
        this.built.add(this._wallMesh(run, hs, this.yardWallMat, true));
      } else {
        this.built.add(this._wallMesh(run, hs, run.side === CELL.YARD ? this.yardWallMat : this.wallMat, false));
        // 外壁に埋め込んだ水槽の外側を囲う張り出し
        for (const h of hs) this.built.add(this._alcove(run, h));
      }
    }
    const b = plan.bounds();
    this.built.add(this._dirtMesh(b));
    this.sceneMgr.fitShadow(b.cx, b.cz, Math.max(b.w, b.d) / 2 + DIRT_MARGIN);
  }

  _floorMesh(plan, type, material, y = 0) {
    const pos = [];
    const uv = [];
    const c = plan.cell;
    for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
      if (plan.at(i, j) !== type) continue;
      const [x, z] = plan.cellMin(i, j);
      for (const [qx, qz] of [[x, z], [x, z + c], [x + c, z], [x + c, z], [x, z + c], [x + c, z + c]]) {
        pos.push(qx, y, qz);
        uv.push(qx, -qz);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    return m;
  }

  /** 壁1面。flip で裏向き（法線を反転）にする */
  _wallMesh(run, holes, material, flip, height = this.stage.wallHeight) {
    const H = height;
    const len = run.to - run.from;
    const mid = (run.from + run.to) / 2;
    const theta = runTheta(run) + (flip ? Math.PI : 0);
    // ラン方向の単位ベクトルと、壁ローカル X 軸との向きの一致（±1）
    const u = run.axis === 'x' ? [1, 0] : [0, 1];
    const sign = Math.sign(u[0] * Math.cos(theta) - u[1] * Math.sin(theta)) || 1;

    const shape = new THREE.Shape();
    shape.moveTo(-len / 2, 0);
    shape.lineTo(len / 2, 0);
    shape.lineTo(len / 2, H);
    shape.lineTo(-len / 2, H);
    shape.closePath();
    for (const h of holes) {
      const cx = (h.along - mid) * sign;
      const x0 = Math.max(-len / 2 + 0.01, cx - h.width / 2);
      const x1 = Math.min(len / 2 - 0.01, cx + h.width / 2);
      const y0 = Math.max(0.005, h.bottom);
      const y1 = Math.min(H - 0.01, h.top);
      if (x1 - x0 < 0.02 || y1 - y0 < 0.02) continue;
      const p = new THREE.Path();
      p.moveTo(x0, y0);
      p.lineTo(x0, y1);
      p.lineTo(x1, y1);
      p.lineTo(x1, y0);
      p.closePath();
      shape.holes.push(p);
    }
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    const [px, pz] = run.axis === 'x' ? [mid, run.line] : [run.line, mid];
    mesh.position.set(px, 0, pz);
    mesh.rotation.y = theta;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  /** 外壁の外側に、埋め込み水槽を囲うコンクリートの箱（前面は壁の穴）を作る */
  _alcove(run, h) {
    const m = 0.08;
    const W = h.width + m * 2;
    const D = h.depth + m;
    const H = Math.min(this.stage.wallHeight, Math.max(h.top, h.bottom + h.lightTop) + m);
    const pos = [];
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    // 壁ローカル：x = 壁沿い, y = 上, z = 内側（法線）。外側は -z
    const x0 = -W / 2, x1 = W / 2, z0 = 0, z1 = -D;
    quad([x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]); // 奥
    quad([x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]); // 左
    quad([x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1]); // 右
    quad([x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0]); // 屋根
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.alcoveMat);
    const theta = runTheta(run);
    const u = run.axis === 'x' ? [1, 0] : [0, 1];
    const sign = Math.sign(u[0] * Math.cos(theta) - u[1] * Math.sin(theta)) || 1;
    const mid = (run.from + run.to) / 2;
    const [px, pz] = run.axis === 'x' ? [mid, run.line] : [run.line, mid];
    mesh.position.set(px, 0, pz);
    mesh.rotation.y = theta;
    mesh.position.x += Math.cos(theta) * (h.along - mid) * sign;
    mesh.position.z += -Math.sin(theta) * (h.along - mid) * sign;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  /** 建物の周りの土（角丸の矩形） */
  _dirtMesh(b) {
    const m = DIRT_MARGIN;
    const x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
    const r = m * 0.9;
    const s = new THREE.Shape();
    s.moveTo(x0 + r, z0);
    s.lineTo(x1 - r, z0);
    s.absarc(x1 - r, z0 + r, r, -Math.PI / 2, 0);
    s.lineTo(x1, z1 - r);
    s.absarc(x1 - r, z1 - r, r, 0, Math.PI / 2);
    s.lineTo(x0 + r, z1);
    s.absarc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x0, z0 + r);
    s.absarc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5);
    const geo = new THREE.ShapeGeometry(s, 8);
    geo.rotateX(Math.PI / 2); // Shape の XY → XZ
    const mesh = new THREE.Mesh(geo, this.dirtMat);
    mesh.position.y = -0.015;
    mesh.renderOrder = -9;
    mesh.receiveShadow = true;
    return mesh;
  }
}
