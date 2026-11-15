import * as THREE from 'three';
import { tubeGeometry, finMesh, orient, lowPolyMaterial, shade } from './lowpoly.js';

/**
 * ローポリの鯨類。頭が +x、背中が +y。尾（後部 + 尾びれ）は羽ばたけるよう別グループ。
 * 体長はワールド単位で、ザトウクジラ : シャチ : イルカ ≒ 14 : 7 : 3 の比率。
 */
const C = (r, g, b) => new THREE.Color(r, g, b);
const EYE = C(0.02, 0.02, 0.03);

/**
 * 胴体とヒレを組み立てる。
 * fins: [{ points, thickness, color, at:[t, y, z], x:[..], y:[..] }]（at は胴体ローカル）
 * flukes: { points, thickness, color }（尾の先端に水平に付く）
 */
function assemble({ length, profile, color, tailSplit, segments, radial, fins = [], flukes }) {
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.position.x = -length / 2;
  root.add(model);
  const mat = lowPolyMaterial();

  const segBody = Math.round(segments * (1 - tailSplit));
  const segTail = segments - segBody;
  model.add(new THREE.Mesh(
    tubeGeometry({ profile, color, length, segments: segBody, radial, from: tailSplit, to: 1, capEnd: true }),
    mat,
  ));

  const tail = new THREE.Group();
  const pivotX = tailSplit * length;
  tail.position.x = pivotX;
  tail.add(new THREE.Mesh(
    tubeGeometry({ profile, color, length, segments: segTail, radial, from: 0, to: tailSplit + 0.01, offsetX: -pivotX, capStart: true }),
    mat,
  ));
  model.add(tail);

  for (const f of fins) {
    const m = orient(finMesh(f.points, f.thickness, f.color), f.x ?? [1, 0, 0], f.y ?? [0, 1, 0]);
    m.position.set(f.at[0] * length, f.at[1], f.at[2]);
    model.add(m);
  }
  if (flukes) {
    const m = orient(finMesh(flukes.points, flukes.thickness, flukes.color), [1, 0, 0], [0, 0, 1]);
    m.position.x = -pivotX + length * 0.02;
    tail.add(m);
  }

  root.userData.tail = tail;
  return root;
}

const scale = (pts, s) => pts.map(([x, y]) => [x * s, y * s]);
/** 片側の輪郭を y=0 で鏡映して左右対称の尾びれにする */
const mirrored = (half) => [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [x, -y])];

/** 左右の胸びれ */
function pectoralPair({ points, thickness, color, t, profile, droop = 0.45 }) {
  const p = profile(t);
  return [-1, 1].map((side) => ({
    points, thickness, color,
    at: [t, p.cy - p.ry * 0.5, side * p.rz * 0.8],
    x: [1, 0, 0],
    y: [0, -droop, side],
  }));
}

// ---------------------------------------------------------------------------

export function buildHumpback(L) {
  const dark = C(0.13, 0.15, 0.19);
  const belly = C(0.86, 0.88, 0.9);
  const groove = C(0.52, 0.55, 0.6);

  const profile = (t) => {
    const s = t < 0.6 ? Math.sin((t / 0.6) * Math.PI / 2) : 1 - ((t - 0.6) / 0.4) ** 2 * 0.7;
    const base = (0.013 + 0.097 * Math.pow(Math.max(0, s), 1.15)) * L;
    return {
      ry: base * (t > 0.78 ? 0.95 - (t - 0.78) * 1.5 : 0.95),
      rz: base * (t < 0.22 ? 0.5 + t * 2.2 : 1),
      cy: t > 0.78 ? -(t - 0.78) * 0.07 * L : 0,
    };
  };
  const color = (t, ny, nz, i, j) => {
    if (t > 0.79 && t < 0.85 && ny > -0.45 && ny < 0.1 && Math.abs(nz) > 0.8) return EYE;
    if (ny < -0.35) {
      if (t > 0.55 && t < 0.95) return j % 2 ? groove : belly; // 腹の畝
      return shade(belly, i * 31 + j, 0.08);
    }
    return shade(dark, i * 17 + j, 0.06);
  };

  const pectoral = scale([[0, 0], [0.006, 0.08], [-0.004, 0.14], [0.004, 0.2], [-0.01, 0.26], [-0.06, 0.32], [-0.075, 0.28], [-0.07, 0.15], [-0.075, 0]], L);
  return assemble({
    length: L, profile, color, tailSplit: 0.22, segments: 26, radial: 12,
    fins: [
      { points: scale([[0, 0], [-0.03, 0.03], [-0.06, 0.025], [-0.08, 0]], L), thickness: L * 0.012, color: dark,
        at: [0.38, profile(0.38).ry * 0.92, 0] },
      ...pectoralPair({ points: pectoral, thickness: L * 0.012, color: belly, t: 0.7, profile }),
    ],
    flukes: {
      points: scale(mirrored([[0, 0], [-0.02, 0.05], [-0.07, 0.13], [-0.1, 0.16], [-0.115, 0.13], [-0.105, 0.1], [-0.115, 0.07], [-0.105, 0.04], [-0.115, 0]]), L),
      thickness: L * 0.01,
      color: dark,
    },
  });
}

export function buildOrca(L, { male = true } = {}) {
  const black = C(0.05, 0.05, 0.06);
  const white = C(0.95, 0.95, 0.95);
  const gray = C(0.6, 0.62, 0.66);

  const profile = (t) => {
    const s = t < 0.5 ? Math.sin((t / 0.5) * Math.PI / 2) : 1 - ((t - 0.5) / 0.5) ** 2 * 0.6;
    let base = (0.016 + 0.124 * Math.max(0, s)) * L;
    if (t > 0.9) base *= 1 - ((t - 0.9) / 0.1) ** 2 * 0.55;
    return { ry: base, rz: base * (t < 0.25 ? 0.55 + t * 1.8 : 0.95), cy: 0 };
  };
  const color = (t, ny, nz, i, j) => {
    if (t > 0.8 && t < 0.86 && ny > -0.3 && ny < 0.15 && Math.abs(nz) > 0.8) return EYE;
    if (t > 0.72 && t < 0.86 && ny > 0.05 && ny < 0.6 && Math.abs(nz) > 0.5) return white; // アイパッチ
    if (ny < -0.45 && t > 0.33) return white; // 腹
    if (t > 0.87 && ny < -0.1) return white; // 下あご
    if (t > 0.2 && t < 0.4 && ny < 0.15 - (0.4 - t) * 2 && ny > -0.95) return white; // 脇腹
    if (t > 0.42 && t < 0.58 && ny > 0.65) return gray; // サドルパッチ
    return black;
  };

  const dorsal = male
    ? [[0, 0], [-0.025, 0.25], [-0.045, 0.26], [-0.11, 0]]
    : [[0, 0], [-0.04, 0.1], [-0.08, 0.15], [-0.09, 0.12], [-0.12, 0]];
  return assemble({
    length: L, profile, color, tailSplit: 0.22, segments: 24, radial: 12,
    fins: [
      { points: scale(dorsal, L), thickness: L * 0.02, color: black, at: [0.6, profile(0.6).ry * 0.9, 0] },
      ...pectoralPair({
        points: scale([[0, 0], [0.01, 0.06], [-0.02, 0.13], [-0.07, 0.12], [-0.085, 0.05], [-0.075, 0]], L),
        thickness: L * 0.02, color: black, t: 0.7, profile, droop: 0.7,
      }),
    ],
    flukes: {
      points: scale(mirrored([[0, 0], [-0.03, 0.06], [-0.08, 0.15], [-0.11, 0.16], [-0.1, 0.08], [-0.11, 0]]), L),
      thickness: L * 0.015,
      color: black,
    },
  });
}

export function buildDolphin(L) {
  const top = C(0.33, 0.38, 0.45);
  const flank = C(0.56, 0.61, 0.68);
  const belly = C(0.9, 0.9, 0.92);

  const profile = (t) => {
    const s = t < 0.55 ? Math.sin((t / 0.55) * Math.PI / 2) : 1 - Math.pow((t - 0.55) / 0.45, 1.6) * 0.75;
    let base = (0.025 + 0.11 * Math.max(0, s)) * L;
    if (t > 0.9) base = Math.min(base, 0.035 * L); // くちばし
    return { ry: base, rz: base * (t < 0.3 ? 0.6 + t * 1.3 : 0.9), cy: 0 };
  };
  const color = (t, ny, nz) => {
    if (t > 0.78 && t < 0.86 && Math.abs(ny) < 0.4 && Math.abs(nz) > 0.8) return EYE;
    if (ny > 0.3) return top;
    if (ny > -0.4) return flank;
    return belly;
  };

  return assemble({
    length: L, profile, color, tailSplit: 0.25, segments: 20, radial: 10,
    fins: [
      { points: scale([[0, 0], [-0.07, 0.15], [-0.12, 0.17], [-0.1, 0.11], [-0.15, 0]], L), thickness: L * 0.02, color: top,
        at: [0.58, profile(0.58).ry * 0.9, 0] },
      ...pectoralPair({ points: scale([[0, 0], [-0.04, 0.12], [-0.07, 0.13], [-0.06, 0]], L), thickness: L * 0.015, color: top, t: 0.68, profile, droop: 0.6 }),
    ],
    flukes: {
      points: scale(mirrored([[0, 0], [-0.03, 0.07], [-0.08, 0.15], [-0.11, 0.14], [-0.09, 0.06], [-0.1, 0]]), L),
      thickness: L * 0.015,
      color: top,
    },
  });
}
