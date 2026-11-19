import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL_SIZE, FLOOR_COUNT, GRID_X, GRID_Z, LAYOUT, STORY_H, ZONES, ZONE_TYPE, ATRIUM_TANK_POS, getZone, zoneHas } from './blueprint.js';

/** 近代的な外観：ガラスのカーテンウォールと、間取りごとに形の違う白い大屋根 */
const TOP = STORY_H * FLOOR_COUNT;
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z / 2) * CELL_SIZE;

const MAT = {
  glass: new THREE.MeshStandardMaterial({ color: 0xa8dcea, metalness: 0.25, roughness: 0.08, transparent: true, opacity: 0.88 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x2e3f4b, metalness: 0.5, roughness: 0.4 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: 0.45, side: THREE.DoubleSide }),
  paving: new THREE.MeshStandardMaterial({ color: 0xd8d6cd, roughness: 0.95 }),
  water: new THREE.MeshStandardMaterial({ color: 0x39a7c9, metalness: 0.2, roughness: 0.12 }),
  green: new THREE.MeshStandardMaterial({ color: 0x5d9c58, roughness: 0.95 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x77604a, roughness: 0.9 }),
};
Object.values(MAT).forEach((m) => (m.userData.shared = true));

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** fn(u, v) → [x, y, z] の曲面 */
function surface(nu, nv, fn) {
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i;
    const c = a + nu + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const buildingZones = () => ZONES.filter((z) => z.type !== ZONE_TYPE.OUTDOOR && !z.wing);

/** 全エリアの外接矩形（ワールド座標） */
function footprint() {
  const rects = buildingZones().flatMap((z) => z.rects);
  return {
    x0: wx(Math.min(...rects.map((r) => r[0]))), z0: wz(Math.min(...rects.map((r) => r[1]))),
    x1: wx(Math.max(...rects.map((r) => r[2])) + 1), z1: wz(Math.max(...rects.map((r) => r[3])) + 1),
  };
}

/** 外周に沿ってガラス面と縦の方立てを並べる */
function curtainWall(group) {
  const solid = (i, j) => buildingZones().some((z) => zoneHas(z, i, j));
  const edges = [];
  for (let j = 0; j < GRID_Z; j++) for (let i = 0; i < GRID_X; i++) {
    if (!solid(i, j)) continue;
    if (!solid(i, j + 1)) edges.push([wx(i) + CELL_SIZE / 2, wz(j + 1), 0]);
    if (!solid(i, j - 1)) edges.push([wx(i) + CELL_SIZE / 2, wz(j), 0]);
    if (!solid(i + 1, j)) edges.push([wx(i + 1), wz(j) + CELL_SIZE / 2, Math.PI / 2]);
    if (!solid(i - 1, j)) edges.push([wx(i), wz(j) + CELL_SIZE / 2, Math.PI / 2]);
  }
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, TOP, 0.05), MAT.glass, edges.length);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, TOP, 0.14), MAT.white, edges.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  edges.forEach(([x, z, r], k) => {
    q.setFromAxisAngle(up, r);
    m.compose(new THREE.Vector3(x, TOP / 2, z), q, new THREE.Vector3(1, 1, 1));
    panels.setMatrixAt(k, m);
    fins.setMatrixAt(k, m);
  });
  group.add(panels, fins);
}

/** 各階の白いスラブと屋上 */
function slabs(group) {
  const parts = [];
  for (const zone of buildingZones()) for (const [x0, z0, x1, z1] of zone.rects) {
    const w = (x1 - x0 + 1) * CELL_SIZE;
    const d = (z1 - z0 + 1) * CELL_SIZE;
    const y = zone.floor === 0 ? STORY_H : TOP;
    parts.push(box(w + 0.7, 0.34, d + 0.7, wx(x0) + w / 2, y, wz(z0) + d / 2));
  }
  group.add(new THREE.Mesh(mergeGeometries(parts), MAT.white));
}

function entranceCanopy(group) {
  const [x0, , x1, z1] = getZone('entrance').rects[0];
  const cx = (wx(x0) + wx(x1 + 1)) / 2;
  const w = (x1 - x0 + 1) * CELL_SIZE + 3;
  const z = wz(z1 + 1);
  const canopy = surface(16, 4, (u, v) => [cx + (u - 0.5) * w, STORY_H + 0.2 + Math.sin(u * Math.PI) * 0.9 - v * 0.5, z + v * 6]);
  group.add(new THREE.Mesh(canopy, MAT.white));
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, STORY_H, 10), MAT.frame);
    col.position.set(cx + s * (w / 2 - 1), STORY_H / 2, z + 5.2);
    group.add(col);
  }
  // 館名の看板
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#10374f';
  c.fillRect(0, 0, 1024, 128);
  c.fillStyle = '#fff';
  c.font = '700 76px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('A Q U A R I U M', 512, 68);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.12), new THREE.MeshBasicMaterial({ map }));
  sign.position.set(cx, TOP - 1.1, z + 0.2);
  group.add(sign);
}

/** 広場・水盤・植栽 */
function grounds(group) {
  const b = footprint();
  const m = 7;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + m * 2, b.z1 - b.z0 + m * 2 + 6).rotateX(-Math.PI / 2), MAT.paving);
  plaza.position.set((b.x0 + b.x1) / 2, 0.01, (b.z0 + b.z1) / 2 + 3);
  group.add(plaza);
  for (const s of [-1, 1]) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 4).rotateX(-Math.PI / 2), MAT.water);
    pool.position.set((b.x0 + b.x1) / 2 + s * 11, 0.03, b.z1 + 6);
    group.add(pool);
  }
  const trees = [];
  for (let k = 0; k < 14; k++) trees.push([b.x0 - 4 + (k / 13) * (b.x1 - b.x0 + 8), b.z1 + 11]);
  for (let k = 0; k < 8; k++) for (const x of [b.x0 - 4.5, b.x1 + 4.5]) trees.push([x, b.z0 + (k / 7) * (b.z1 - b.z0)]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 6), MAT.trunk, trees.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 1), MAT.green, trees.length);
  const mx = new THREE.Matrix4();
  trees.forEach(([x, z], k) => {
    trunk.setMatrixAt(k, mx.makeTranslation(x, 1.1, z));
    crown.setMatrixAt(k, mx.makeTranslation(x, 3, z));
  });
  group.add(trunk, crown);
}

// ---- 間取りごとの大屋根 ------------------------------------------------------

/** 回遊らせん型：大水槽を包むガラスの塔と、巻き上がる白いリボン */
function spiralRoof(group) {
  const { x, z } = ATRIUM_TANK_POS;
  const R = 6.6;
  const H = TOP + 7;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true), MAT.glass);
  drum.position.set(x, H / 2, z);
  const pts = [];
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 7;
    pts.push(new THREE.Vector3(x + Math.cos(a) * (R + 0.4), 0.8 + (k / 96) * (H - 0.8), z + Math.sin(a) * (R + 0.4)));
  }
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.34, 6), MAT.white);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R + 0.5, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1), MAT.white);
  cap.position.set(x, H, z);
  group.add(drum, ribbon, cap);
}

/** 海の旅路型：建物全体を覆う波の大屋根 */
function waveRoof(group) {
  const b = footprint();
  const roof = surface(44, 18, (u, v) => {
    const x = b.x0 - 3 + u * (b.x1 - b.x0 + 6);
    const z = b.z0 - 2 + v * (b.z1 - b.z0 + 4);
    return [x, TOP + 2 + Math.sin(u * Math.PI * 3 + v * 1.4) * 1.5 + (1 - u) * 2.4, z];
  });
  group.add(new THREE.Mesh(roof, MAT.white));
}

/** 放射ギャラリー型：ガラスのドームと、展示棟に架かる白い帆 */
function domeRoof(group) {
  const { x, z } = ATRIUM_TANK_POS;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6.4, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass);
  dome.position.set(x, TOP, z);
  group.add(dome);
  for (let k = 0; k < 12; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(6.45, 0.07, 6, 28, Math.PI), MAT.white);
    rib.position.set(x, TOP, z);
    rib.rotation.y = (k / 12) * Math.PI;
    group.add(rib);
  }
  for (const id of ['coast', 'subtropical', 'entrance']) {
    const [x0, z0, x1, z1] = getZone(id).rects[0];
    const alongX = x1 - x0 >= z1 - z0;
    const sail = surface(20, 8, (u, v) => {
      const lift = Math.sin((alongX ? v : u) * Math.PI) * 2.4;
      return [wx(x0) - 0.6 + u * (wx(x1 + 1) - wx(x0) + 1.2), TOP + 0.5 + lift, wz(z0) - 0.6 + v * (wz(z1 + 1) - wz(z0) + 1.2)];
    });
    group.add(new THREE.Mesh(sail, MAT.white));
  }
}

/** 分棟パビリオン型：棟ごとの薄いシェル屋根と、中庭の水盤 */
function shellRoofs(group) {
  for (const id of ['coast', 'subtropical', 'atrium', 'yard1']) {
    const [x0, z0, x1, z1] = getZone(id).rects[0];
    const w = wx(x1 + 1) - wx(x0) + 2;
    const d = wz(z1 + 1) - wz(z0) + 2;
    const shell = surface(24, 24, (u, v) => {
      const a = u * 2 - 1;
      const b = v * 2 - 1;
      return [wx(x0) - 1 + u * w, TOP + 2.2 + (a * a - b * b) * 2.2, wz(z0) - 1 + v * d];
    });
    group.add(new THREE.Mesh(shell, MAT.white));
  }
  const lagoon = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), MAT.water);
  lagoon.scale.set(4.2, 1, 3.6);
  for (const s of [-1, 1]) {
    const pond = lagoon.clone();
    pond.position.set(s * 6.4, 0.04, wz(38));
    group.add(pond);
  }
}

const ROOFS = { spiral: spiralRoof, descent: waveRoof, radial: domeRoof, pavilion: shellRoofs };

export class Exterior {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'exterior';
    this.group.visible = false;
    scene.add(this.group);
  }

  /** 選択中の間取りの外観を作り直す */
  build() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && !o.material.userData.shared) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.group.clear();
    grounds(this.group);
    curtainWall(this.group);
    slabs(this.group);
    entranceCanopy(this.group);
    ROOFS[LAYOUT.style](this.group);
    this.layoutId = LAYOUT.id;
  }

  show(v) {
    if (v && this.layoutId !== LAYOUT.id) this.build();
    this.group.visible = v;
  }
}
