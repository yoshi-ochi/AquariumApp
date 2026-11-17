import * as THREE from 'three';
import { mulberry32 } from './random.js';
import { ModParts, UP, C, V, node } from './coralParts.js';

/**
 * 個体・塊の集合でできるサンゴ（ノード = 1個体。a 付け根、b-a が向きと大きさ）。
 */

const rnd = (r, lo, hi) => lo + r() * (hi - lo);

/** 頂点ごとに色を塗った BufferGeometry を作る */
function gridGeo(nu, nv, fn) {
  const pos = [];
  const col = [];
  const P = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(fn(i / nu, j / nv));
  const push = (q) => {
    pos.push(q.p.x, q.p.y, q.p.z);
    col.push(q.c.r, q.c.g, q.c.b);
  };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P[j * (nu + 1) + i], b = P[j * (nu + 1) + i + 1], c = P[(j + 1) * (nu + 1) + i], d = P[(j + 1) * (nu + 1) + i + 1];
    [a, c, b, b, c, d].forEach(push);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ---- ウスカミサンゴ（Mycedium elephantotus）：薄い板が水平に重なる。莢が縁へ向いて突き出す（象の鼻） ----
export const usukami = {
  addLen: 0.06,
  addR: () => 1,
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [];
    for (let k = 0; k < 5; k++) {
      const a = new THREE.Vector3((rand() - 0.5) * 0.03, 0.008 + k * 0.014, (rand() - 0.5) * 0.03);
      const yaw = k * 2.3 + rand();
      const R = rnd(rand, 0.06, 0.09) * (1 - k * 0.12);
      nodes.push(node(a, a.clone().add(new THREE.Vector3(Math.cos(yaw) * R, 0, Math.sin(yaw) * R)), 1, k ? k - 1 : -1));
    }
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const plateIn = C(0x5e6e34);
    const plateOut = C(0x8c8a4a);
    const wall = C(0x6f7a3c);
    const disc = [C(0xe0602a), C(0xc8323a)];
    const nose = new THREE.ConeGeometry(0.004, 0.007, 5, 1, true);
    nose.rotateX(Math.PI); // 先が太い（象の鼻）
    nose.translate(0, 0.0035, 0);
    const mouth = new THREE.CircleGeometry(0.0034, 6);
    mouth.rotateX(-Math.PI / 2);
    nodes.forEach((n, i) => {
      const a = V(n.a);
      const d = V(n.b).sub(a);
      d.y = 0;
      const R = Math.max(0.02, d.length());
      const yaw = Math.atan2(d.z, d.x);
      const span = Math.PI * 1.15;
      const rand = mulberry32(i * 71 + 3);
      const ph = rand() * 6;
      // 扇形の薄い板：外へ向かってわずかに反り上がり、縁が波打つ
      const plate = gridGeo(12, 4, (u, v) => {
        const ang = yaw + (u - 0.5) * span;
        const r = R * (0.12 + 0.88 * v);
        const y = R * 0.18 * v * v + Math.sin(ang * 5 + ph) * 0.006 * v;
        return { p: new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r), c: plateIn.clone().lerp(plateOut, v) };
      });
      p.add(plate, null, i, new THREE.Matrix4().makeTranslation(a.x, a.y, a.z));
      plate.dispose();
      // 莢：縁の方向へ低く突き出す
      for (let ring = 1; ring <= 2; ring++) {
        const v = ring / 2.6;
        const cnt = Math.round(4 + ring * 3 * (R / 0.07));
        for (let k = 0; k < cnt; k++) {
          const ang = yaw + ((k + 0.5) / cnt - 0.5) * span * 0.9;
          const r = R * (0.12 + 0.88 * v);
          const y = R * 0.18 * v * v + Math.sin(ang * 5 + ph) * 0.006 * v;
          const pos = a.clone().add(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
          const out = new THREE.Vector3(Math.cos(ang), 0.9, Math.sin(ang));
          p.at(nose, wall, i, pos, out);
          p.at(mouth, disc[(k + ring) % 2], i, pos.clone().addScaledVector(out.normalize(), 0.007), out);
        }
      }
    });
    nose.dispose();
    mouth.dispose();
    g.add(p.mesh({ roughness: 0.7 }));
  },
};

// ---- キクメイシ（Dipsastraea）：半球状の塊。丸い莢が密に並び互いに分離 ----
export const kikumeishi = {
  addLen: 0.035,
  addR: () => 1,
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [node(new THREE.Vector3(), new THREE.Vector3(0, 0.055, 0), 1, -1)];
    for (let k = 0; k < 2; k++) {
      const ang = k * 2.6 + rand();
      const a = new THREE.Vector3(Math.cos(ang) * 0.045, 0, Math.sin(ang) * 0.045);
      nodes.push(node(a, a.clone().add(new THREE.Vector3(0, rnd(rand, 0.03, 0.04), 0)), 1, 0));
    }
    return nodes;
  },
  build(g, nodes, seed) {
    const p = new ModParts();
    const tissue = C(0x7a6a3e);
    const walls = [C(0x8f7d48), C(0x6e8a3a)];
    const discs = [C(0x7ce86a), C(0xb8f05a)];
    const dome = new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const cup = new THREE.CylinderGeometry(0.0055, 0.006, 0.004, 7, 1, true);
    cup.translate(0, 0.002, 0);
    const mouth = new THREE.CircleGeometry(0.0045, 7);
    mouth.rotateX(-Math.PI / 2);
    const tone = seed % 2;
    nodes.forEach((n, i) => {
      const a = V(n.a);
      const R = Math.max(0.015, V(n.b).distanceTo(a));
      const sy = 0.75;
      p.at(dome, tissue, i, a, UP, new THREE.Vector3(R, R * sy, R));
      // 半球上にフィボナッチ配置で莢を並べる
      const cnt = Math.min(60, Math.round((2 * Math.PI * R * R) / (0.0125 * 0.0125)));
      for (let k = 0; k < cnt; k++) {
        const y = 1 - (k + 0.5) / cnt * 0.95;
        const rr = Math.sqrt(1 - y * y);
        const ang = k * 2.39996;
        const nrm = new THREE.Vector3(Math.cos(ang) * rr, y, Math.sin(ang) * rr);
        const pos = a.clone().add(new THREE.Vector3(nrm.x * R, nrm.y * R * sy, nrm.z * R));
        const outN = new THREE.Vector3(nrm.x / R, nrm.y / (R * sy), nrm.z / R).normalize();
        p.at(cup, walls[tone], i, pos, outN);
        p.at(mouth, discs[(k + tone) % 2], i, pos.clone().addScaledVector(outN, 0.0025), outN);
      }
    });
    [dome, cup, mouth].forEach((x) => x.dispose());
    g.add(p.mesh({ roughness: 0.75 }));
  },
};

// ---- オオシャコガイ（Tridacna gigas）：波打つ肋の二枚の殻。外套膜は褐色・金地に青緑の斑紋 ----
const shellCache = new Map();
function clamGeos(seed) {
  if (shellCache.has(seed)) return shellCache.get(seed);
  const rand = mulberry32(seed);
  const ph = rand() * 6;
  const L = 1, H = 0.42, W = 0.32;
  const shellA = C(0xe6dfcc), shellB = C(0xbdb39a);
  const valve = (s) =>
    gridGeo(24, 6, (u, v) => {
      const env = Math.pow(Math.sin(Math.PI * u), 0.6);
      const phi = v * Math.PI * 0.5;
      const rib = Math.sin(u * Math.PI * 10); // 太い放射肋
      const x = (u - 0.5) * L;
      const z = s * env * W * Math.sin(phi) * (1 + 0.1 * rib * v);
      const y = env * H * (1 - Math.cos(phi)) + v * v * s * rib * 0.035; // 縁がジグザグに噛み合う
      return { p: new THREE.Vector3(x, y, z), c: rib > 0 ? shellA : shellB };
    });
  const mantleCols = [C(0x7a5420), C(0xb08a30), C(0x2fb7a8), C(0x1e7a8a)];
  const mantle = gridGeo(24, 6, (u, v) => {
    const env = Math.pow(Math.sin(Math.PI * u), 0.6);
    const w = v * 2 - 1;
    const x = (u - 0.5) * L;
    const z = w * env * W * 1.12;
    const y = env * H * 0.98 + Math.sin(u * 30 + w * 4 + ph) * 0.012 + Math.abs(w) * 0.03 * env;
    const spot = Math.sin(u * 47 + ph) * Math.sin(w * 13 + ph * 2) > 0.45;
    const slit = Math.abs(w) < 0.12; // 中央の入水管の溝
    const c = slit ? mantleCols[0] : spot ? mantleCols[2 + ((u * 9) | 0) % 2] : mantleCols[(Math.abs(w) > 0.7) | 0];
    return { p: new THREE.Vector3(x, y, z), c };
  });
  const out = [valve(1), valve(-1), mantle];
  shellCache.set(seed, out);
  return out;
}

export const shakogai = {
  addLen: 0.12,
  addR: () => 1,
  defaults() {
    return [node(new THREE.Vector3(), new THREE.Vector3(0, 0.25, 0), 1, -1)];
  },
  build(g, nodes, seed) {
    const p = new ModParts();
    const geos = clamGeos(seed % 4);
    nodes.forEach((n, i) => {
      const a = V(n.a);
      const d = V(n.b).sub(a);
      const L = Math.max(0.03, d.length());
      const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
      q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, i * 1.3));
      const m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(L, L, L));
      for (const geo of geos) p.add(geo, null, i, m);
    });
    g.add(p.mesh({ roughness: 0.45, flat: false }));
  },
};

// ---- タマイワスナギンチャク（Palythoa leseuri）：砂粒を含む太い筒状ポリプ（径約1.5cm）が共肉で群れる ----
export const tama = {
  addLen: 0.02,
  addR: () => 0.0075,
  defaults(seed) {
    const rand = mulberry32(seed);
    const nodes = [];
    for (let k = 0; k < 22; k++) {
      const ang = k * 2.39996;
      const r = Math.sqrt(k) * 0.0125;
      const a = new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      const dir = new THREE.Vector3(a.x * 6, 1, a.z * 6).normalize();
      nodes.push(node(a, a.clone().addScaledVector(dir, rnd(rand, 0.014, 0.026)), 0.0075, -1));
    }
    return nodes;
  },
  build(g, nodes) {
    const p = new ModParts();
    const sand = [C(0xb8a37a), C(0xa89468)];
    const discC = C(0x6e6a3a);
    const mouthC = C(0x3e4a2a);
    const tentC = C(0xd4c48e);
    const col = new THREE.CylinderGeometry(1, 0.85, 1, 8, 1, true);
    col.translate(0, 0.5, 0);
    const disc = new THREE.CircleGeometry(1, 8);
    disc.rotateX(-Math.PI / 2);
    const mouth = new THREE.CircleGeometry(0.25, 5);
    mouth.rotateX(-Math.PI / 2);
    mouth.translate(0, 0.02, 0);
    const tent = new THREE.ConeGeometry(0.0011, 0.0045, 3, 1, true);
    tent.translate(0, 0.00225, 0);
    const mat = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    nodes.forEach((n, i) => {
      const a = V(n.a);
      const d = V(n.b).sub(a);
      const h = Math.max(0.005, d.length());
      const ax = d.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, ax);
      p.add(col, sand[i % 2], i, new THREE.Matrix4().compose(a, q, new THREE.Vector3(n.r, h, n.r)));
      p.at(mat, sand[1], i, a, UP, new THREE.Vector3(n.r * 1.7, n.r * 0.6, n.r * 1.7)); // 共肉
      const top = a.clone().addScaledVector(ax, h);
      p.at(disc, discC, i, top, ax, n.r * 0.95);
      p.at(mouth, mouthC, i, top, ax, n.r);
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * Math.PI * 2;
        const out = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).applyQuaternion(q);
        p.at(tent, tentC, i, top.clone().addScaledVector(out, n.r), out.clone().add(ax.clone().multiplyScalar(0.3)));
      }
    });
    [col, disc, mouth, tent, mat].forEach((x) => x.dispose());
    g.add(p.mesh({ roughness: 0.8 }));
  },
};
