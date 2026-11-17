import * as THREE from 'three';
import { mulberry32 } from './random.js';
import { ModParts, UP, C, V, unitCyl, leafSet, turn, node } from './coralParts.js';

/**
 * 枝状のサンゴ（ノード = 枝1本 a→b）。
 * 各種: defaults(seed) 初期形 / build(g, nodes, seed) 描画 / addR(親) 追加枝の太さ / addLen 既定の長さ
 */

const rnd = (r, lo, hi) => lo + r() * (hi - lo);

/** 汎用の分岐生成：親の先端から n 本の子枝 */
function grow(nodes, rand, pi, depth, opt) {
  if (depth <= 0) return;
  const par = nodes[pi];
  const a = V(par.b);
  const pd = V(par.b).sub(V(par.a)).normalize();
  const n = opt.kids(rand, depth);
  for (let k = 0; k < n; k++) {
    const dir = opt.dir(pd, k, n, rand);
    const len = V(par.b).distanceTo(V(par.a)) * rnd(rand, opt.lenK[0], opt.lenK[1]);
    nodes.push(node(a, a.clone().addScaledVector(dir, len), par.r * opt.rK, pi));
    grow(nodes, rand, nodes.length - 1, depth - 1, opt);
  }
}

/** 水平方向へ開く方向（全周に配る） */
const spread = (tilt) => (pd, k, n, rand) => {
  const yaw = (k / n) * Math.PI * 2 + rand() * 0.8;
  const side = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  return pd.clone().multiplyScalar(1 - tilt).addScaledVector(side, tilt).normalize();
};

function drawBranches(p, nodes, geoCache, color, seg = 5, tipK = 0.7) {
  nodes.forEach((n, i) => {
    const key = `${n.r}`;
    let g = geoCache.get(key);
    if (!g) geoCache.set(key, (g = unitCyl(n.r, n.r * tipK, seg)));
    p.seg(g, color, i, V(n.a), V(n.b));
  });
  geoCache.forEach((g) => g.dispose());
}

// ---- アカバナトサカ（Stereonephthya rubriflora）：白〜黄の透ける枝、枝先に赤いポリプの房 ----
export const akabana = {
  tree: true,
  addLen: 0.03,
  addR: (par) => Math.max(0.0025, par.r * 0.65),
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [node(new THREE.Vector3(), new THREE.Vector3(0, 0.055, 0), 0.011, -1)];
    grow(nodes, rand, 0, 3, {
      kids: (r, d) => (d === 3 ? 4 : 2 + Math.floor(r() * 2)),
      dir: spread(0.55),
      lenK: [0.55, 0.8],
      rK: 0.62,
    });
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const stalk = C(0xf3e7c4);
    const polyCols = [C(0xd8263a), C(0xb81e4a), C(0xe8443a)];
    drawBranches(p, nodes, new Map(), stalk, 6);
    const joint = new THREE.IcosahedronGeometry(1, 0);
    const polyp = new THREE.IcosahedronGeometry(0.0042, 0);
    const leaf = leafSet(nodes);
    nodes.forEach((n, i) => {
      p.at(joint, stalk, i, V(n.a), UP, n.r * 0.95);
      if (!leaf[i]) return;
      // 花頭：枝先にポリプが半球状に密集
      const rand = mulberry32(i * 977 + 13);
      const tip = V(n.b);
      const dir = tip.clone().sub(V(n.a)).normalize();
      for (let k = 0; k < 9; k++) {
        const off = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.007);
        if (off.dot(dir) < 0) off.addScaledVector(dir, -1.6 * off.dot(dir));
        p.at(polyp, polyCols[k % 3], i, tip.clone().add(off));
      }
    });
    joint.dispose();
    polyp.dispose();
    g.add(p.mesh());
  },
};

// ---- アカヤギ（Menella rigida）：主幹から二又分岐を繰り返す縦長の扇。血赤色、枝先が太い ----
export const akayagi = {
  tree: true,
  addLen: 0.04,
  addR: (par) => Math.max(0.0018, par.r * 0.85),
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [node(new THREE.Vector3(), new THREE.Vector3(0, 0.05, 0), 0.0045, -1)];
    const Z = new THREE.Vector3(0, 0, 1);
    grow(nodes, rand, 0, 5, {
      kids: () => 2,
      dir: (pd, k) => turn(pd, Z, (k ? 1 : -1) * rnd(rand, 0.3, 0.55)).add(new THREE.Vector3(0, 0.25, (rand() - 0.5) * 0.12)).normalize(),
      lenK: [0.7, 0.9],
      rK: 0.84,
    });
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const red = C(0xa3161c);
    const tipC = C(0xc8323a);
    drawBranches(p, nodes, new Map(), red, 4, 0.9);
    const knob = new THREE.IcosahedronGeometry(1, 0);
    const leaf = leafSet(nodes);
    nodes.forEach((n, i) => {
      p.at(knob, red, i, V(n.a), UP, n.r);
      if (leaf[i]) p.at(knob, tipC, i, V(n.b), UP, n.r * 1.7); // 枝先が棍棒状に太い
    });
    knob.dispose();
    g.add(p.mesh({ roughness: 0.8 }));
  },
};

// ---- ウミエダミドリイシ（Acropora）：管状の枝が斜め上へ広がる。枝に放射個体、枝先は淡色 ----
export const umieda = {
  tree: true,
  addLen: 0.035,
  addR: (par) => Math.max(0.004, par.r * 0.85),
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [node(new THREE.Vector3(), new THREE.Vector3(0, 0.02, 0), 0.012, -1)];
    grow(nodes, rand, 0, 3, {
      kids: (r, d) => (d === 3 ? 6 : 1 + Math.floor(r() * 2)),
      dir: (pd, k, n, r) => {
        const yaw = (k / n) * Math.PI * 2 + r() * 0.6;
        return new THREE.Vector3(Math.cos(yaw) * 0.9, 0.5 + r() * 0.3, Math.sin(yaw) * 0.8).add(pd.clone().multiplyScalar(0.4)).normalize();
      },
      lenK: [1.1, 1.6],
      rK: 0.78,
    });
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const body = C(0xb49a6c);
    const tipC = C(0xd8c8f0);
    const cor = C(0xc8b080);
    drawBranches(p, nodes, new Map(), body, 6, 0.85);
    const cap = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    const radial = new THREE.ConeGeometry(0.0028, 0.006, 4, 1, true);
    radial.translate(0, 0.003, 0);
    const joint = new THREE.IcosahedronGeometry(1, 0);
    const leaf = leafSet(nodes);
    nodes.forEach((n, i) => {
      const a = V(n.a);
      const b = V(n.b);
      const d = b.clone().sub(a);
      const len = d.length();
      d.normalize();
      p.at(joint, body, i, a, UP, n.r);
      if (leaf[i]) p.at(cap, tipC, i, b, d, n.r * 0.85); // 軸個体（枝先）
      // 放射個体：枝の側面に斜め上向きの小さな筒
      const side = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
      const cnt = Math.min(10, Math.floor(len / 0.009));
      for (let k = 0; k < cnt; k++) {
        const t = (k + 0.5) / cnt;
        const s = turn(side, d, k * 2.4);
        const pos = a.clone().lerp(b, t).addScaledVector(s, n.r * (1 - 0.15 * t));
        p.at(radial, cor, i, pos, s.clone().add(d.clone().multiplyScalar(1.2)));
      }
    });
    [cap, radial, joint].forEach((x) => x.dispose());
    g.add(p.mesh({ roughness: 0.8 }));
  },
};

// ---- ウミアザミ（Xenia）：白い柄が分かれ、先端に8枚の羽状触手の冠 ----
export const xenia = {
  tree: true,
  addLen: 0.025,
  addR: (par) => Math.max(0.0025, par.r * 0.75),
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [];
    for (let s = 0; s < 4; s++) {
      const a = new THREE.Vector3((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.04);
      nodes.push(node(a, a.clone().add(new THREE.Vector3((rand() - 0.5) * 0.01, 0.025, (rand() - 0.5) * 0.01)), 0.0042, -1));
      grow(nodes, rand, nodes.length - 1, 1, { kids: (r) => 2 + Math.floor(r() * 2), dir: spread(0.45), lenK: [0.7, 1], rK: 0.7 });
    }
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const stem = C(0xece4ea);
    const petalC = C(0xf2d4e2);
    const pinC = C(0xfaf0f4);
    drawBranches(p, nodes, new Map(), stem, 6, 0.85);
    const petal = new THREE.ConeGeometry(0.0018, 0.018, 3, 1, true);
    petal.translate(0, 0.009, 0);
    const pin = new THREE.ConeGeometry(0.0012, 0.004, 3, 1, true);
    pin.translate(0, 0.002, 0);
    const leaf = leafSet(nodes);
    nodes.forEach((n, i) => {
      if (!leaf[i]) return;
      const top = V(n.b);
      const ax = top.clone().sub(V(n.a)).normalize();
      const ref = Math.abs(ax.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP;
      const side = new THREE.Vector3().crossVectors(ax, ref).normalize();
      for (let k = 0; k < 8; k++) {
        const out = turn(side, ax, (k / 8) * Math.PI * 2);
        const dir = out.clone().add(ax.clone().multiplyScalar(0.9)).normalize();
        p.at(petal, petalC, i, top, dir);
        // 羽状の小羽片（触手の両脇）
        for (const t of [0.45, 0.8]) p.at(pin, pinC, i, top.clone().addScaledVector(dir, 0.018 * t), out.clone().add(dir).normalize());
      }
    });
    petal.dispose();
    pin.dispose();
    g.add(p.mesh());
  },
};

// ---- リュウキュウミゾヤギ（Junceella fragilis）：分岐しない鞭状の群体が直立。白〜淡黄褐色 ----
export const junceella = {
  tree: true,
  addLen: 0.12,
  addR: () => 0.0028,
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [];
    for (let s = 0; s < 6; s++) {
      const a = new THREE.Vector3((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.03);
      const dir = new THREE.Vector3((rand() - 0.5) * 0.5, 1, (rand() - 0.5) * 0.5).normalize();
      nodes.push(node(a, a.clone().addScaledVector(dir, rnd(rand, 0.18, 0.32)), 0.003, -1));
    }
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const cols = [C(0xf1ead6), C(0xdcc58f)];
    const bump = new THREE.OctahedronGeometry(1, 0);
    const foot = new THREE.CylinderGeometry(1, 1.3, 0.3, 7);
    nodes.forEach((n, i) => {
      const col = cols[i % 2];
      const a = V(n.a);
      const b = V(n.b);
      const len = a.distanceTo(b);
      // 3節でゆるく曲げる
      const rand = mulberry32(i * 131 + 7);
      const bend = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(len * 0.12);
      const pts = [a, a.clone().lerp(b, 0.35), a.clone().lerp(b, 0.7).add(bend), b.clone().add(bend.clone().multiplyScalar(1.6))];
      for (let k = 0; k < 3; k++) {
        const r = n.r * (1 - k * 0.22);
        const g2 = unitCyl(r, r * 0.8, 5);
        p.seg(g2, col, i, pts[k], pts[k + 1]);
        g2.dispose();
      }
      p.at(foot, col, i, a, UP, n.r * 2.2);
      // 表面の小さなポリプ（左右交互）
      const cnt = Math.min(18, Math.floor(len / 0.016));
      for (let k = 1; k <= cnt; k++) {
        const t = k / (cnt + 1);
        const seg = Math.min(2, Math.floor(t * 3));
        const pos = pts[seg].clone().lerp(pts[seg + 1], t * 3 - seg);
        const s = new THREE.Vector3(Math.cos(k * 2.1), 0, Math.sin(k * 2.1));
        p.at(bump, cols[(i + 1) % 2], i, pos.addScaledVector(s, n.r * 0.8), UP, n.r * 0.55);
      }
    });
    [bump, foot].forEach((x) => x.dispose());
    g.add(p.mesh({ roughness: 0.85 }));
  },
};
