import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './random.js';
import { capsule, lattice, capsuleShape, drape } from './growth.js';

export { mulberry32 };

function finish(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * ライブロックの配色。base = 地の色、patch = 斑・被覆の色、cover = 被覆の多さ（上面ほど多い）
 */
const ROCK_PALETTES = {
  // 赤〜ピンクの石灰藻で一部が覆われた岩
  coralline: { base: [0.66, 0.58, 0.5], patch: [[0.86, 0.36, 0.46], [0.93, 0.55, 0.62], [0.62, 0.3, 0.52]], cover: 0.28 },
  dark: { base: [0.2, 0.19, 0.19], patch: [[0.12, 0.12, 0.13], [0.3, 0.27, 0.25]], cover: 0.35 },
  brown: { base: [0.46, 0.33, 0.22], patch: [[0.36, 0.25, 0.16], [0.58, 0.45, 0.32]], cover: 0.35 },
  gray: { base: [0.56, 0.56, 0.55], patch: [[0.44, 0.44, 0.45], [0.68, 0.68, 0.66]], cover: 0.35 },
};

/**
 * ライブロック：インデックス付き（mergeVertices）の変形球。
 * 頂点が共有されているので、スカルプトで面が裂けない。
 */
export function buildLiveRock(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const pal = ROCK_PALETTES[def.palette] ?? ROCK_PALETTES.coralline;
  const { w, h, d } = def.size;
  let geo = new THREE.IcosahedronGeometry(0.5, w <= 0.1 ? 6 : 14);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);

  const ph = Array.from({ length: 10 }, () => rand() * Math.PI * 2);
  const lumps = Array.from({ length: 5 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.3, rand() - 0.5).normalize());
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    let f =
      1 +
      0.16 * Math.sin(n.x * 3.1 + ph[0]) * Math.cos(n.z * 2.7 + ph[1]) +
      0.09 * Math.sin(n.y * 7 + ph[2] + n.x * 5) +
      0.05 * Math.sin(n.z * 13 + ph[3] + n.y * 11);
    for (const l of lumps) f += (0.22 * Math.max(0, n.dot(l) - 0.7)) / 0.3;
    const flatten = n.y < 0 ? 0.55 : 1;
    pos.setXYZ(i, n.x * 0.5 * f * w, n.y * 0.5 * f * h * flatten, n.z * 0.5 * f * d);

    // 被覆：低周波ノイズ + 上面ほど多い
    const k = 0.5 + 0.5 * Math.sin(n.x * 4 + ph[4]) * Math.sin(n.y * 3.5 + ph[5]) * Math.sin(n.z * 4.5 + ph[6]);
    const cover = k + n.y * 0.25 > 1 - pal.cover;
    const j = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.07;
    const fine = Math.sin(n.x * 17 + ph[7]) * Math.sin(n.z * 15 + ph[8]) > 0.4;
    const c = cover ? pal.patch[(fine ? 1 : 0) + (k > 0.85 && pal.patch[2] ? 1 : 0)] ?? pal.patch[0] : fine ? pal.patch[1] ?? pal.base : pal.base;
    colors[i * 3] = c[0] - j;
    colors[i * 3 + 1] = c[1] - j;
    colors[i * 3 + 2] = c[2] - j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const mesh = finish(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
  mesh.name = 'rock';
  g.add(mesh);
}

/**
 * 流木の初期形（seed から決定）：幹 1 本 + 枝 3 本。各パーツは制御点の列と太さ。
 * parts[0] が幹。編集（枝を増やす・伸ばす・太くする）はこの配列を書き換える。
 */
export function defaultDriftwoodParts(seed, def) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const jitter = () => (rand() - 0.5) * d * 0.6;
  const trunkR = d * 0.16;
  const trunk = [
    [-w / 2, trunkR, jitter()],
    [-w * 0.15, h * 0.35, jitter()],
    [w * 0.2, h * 0.65, jitter()],
    [w / 2, h, jitter()],
  ];
  const curve = new THREE.CatmullRomCurve3(trunk.map((p) => new THREE.Vector3(...p)));
  const parts = [{ pts: trunk, r: trunkR }];
  for (let b = 0; b < 3; b++) {
    const start = curve.getPoint(0.25 + rand() * 0.6);
    const dir = new THREE.Vector3(rand() - 0.5, 0.4 + rand() * 0.6, rand() - 0.5).normalize();
    const len = w * (0.2 + rand() * 0.2);
    const mid = start.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(jitter(), 0, jitter()).multiplyScalar(0.3));
    const end = start.clone().addScaledVector(dir, len);
    parts.push({ pts: [start, mid, end].map((v) => v.toArray()), r: trunkR * 0.45 });
  }
  return parts;
}

/** 流木：growth.parts（なければ seed から初期形）を管状のメッシュにする。パーツごとに触れるよう partIndex を付ける */
export function buildDriftwood(g, def, { seed = 1, growth } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6e4b30, roughness: 0.9 });
  const parts = growth?.parts ?? defaultDriftwoodParts(seed, def);
  if (growth) growth.parts = parts; // 以降の編集の起点として保持
  parts.forEach((part, i) => {
    const pts = part.pts.map((p) => new THREE.Vector3(...p));
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts);
    const len = curve.getLength();
    const m = finish(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(6, Math.round(len * 80)), part.r, 7, false), mat));
    m.userData.partIndex = i;
    g.add(m);
    // 先端と付け根を丸く（継ぎ目を目立たなくする）
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const cap = finish(new THREE.Mesh(new THREE.SphereGeometry(part.r, 7, 5), mat));
      cap.position.copy(p);
      cap.userData.partIndex = i;
      g.add(cap);
    }
  });
}

/** 海藻・水草。growth.ext の方向へ群生の範囲が伸び、本数は面積に比例（1本の細かさは同じ） */
export function buildPlants(g, def, { seed = 1, growth, surface = () => 0 } = {}) {
  const { w, h } = def.size;
  const region = capsule(w * 0.4, growth?.ext ?? { x: 0, z: 0 });
  const greens = [0x3f9b3a, 0x5fbf4a, 0x2f7a3a, 0x8fcf4f, 0x7a5a2a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));

  const soilGeo = capsuleShape(region, region.R, seed % 5);
  drape(soilGeo, surface, 0.004);
  g.add(finish(new THREE.Mesh(soilGeo, new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1, side: THREE.DoubleSide }))));

  const blade = new THREE.ConeGeometry(0.5, 1, 5);
  blade.translate(0, 0.5, 0);
  const thick = 0.012;
  for (const { p, rand } of lattice(seed, 900, region, 0.01)) {
    const m = new THREE.Mesh(blade, greens[Math.floor(rand() * greens.length)]);
    const bh = h * (0.35 + rand() * 0.65);
    m.scale.set(thick * (0.6 + rand() * 0.6), bh, thick * (0.6 + rand() * 0.6));
    m.position.set(p.x, surface(p.x, p.y) + 0.004, p.y);
    m.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    g.add(finish(m));
  }
}
