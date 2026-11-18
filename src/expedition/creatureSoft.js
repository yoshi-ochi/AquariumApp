import * as THREE from 'three';

/** 魚以外の体形（カニ・エビ・タコ・ヒラメ・タツノオトシゴ・チンアナゴ）。全長1に正規化 */
const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/** a から b へ伸びる細い円柱 */
function rod(solid, r0, r1, a, b, hex) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), q, new THREE.Vector3(1, 1, 1));
  return solid(new THREE.CylinderGeometry(r1, r0, len, 6, 1), hex, m);
}

function eyes(solid, x, y, z, r) {
  return [-1, 1].map((s) => solid(new THREE.SphereGeometry(r, 7, 5), 0x0c1014, at(x, y, s * z)));
}

function crab(c, { solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [solid(new THREE.SphereGeometry(0.2, 14, 8).scale(1, 0.5, 1.15), body, at(0, 0.18, 0)), solid(new THREE.SphereGeometry(0.17, 10, 6).scale(1, 0.3, 1.1), belly, at(0, 0.12, 0))];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x = 0.1 - k * 0.08;
      const reach = c.longLegs ? 0.62 : 0.34;
      const knee = [x - 0.05, 0.3, s * (0.2 + reach * 0.55)];
      const foot = [x - 0.12, 0, s * (0.2 + reach)];
      parts.push(rod(solid, 0.022, 0.018, [x, 0.17, s * 0.17], knee, fin), rod(solid, 0.018, 0.006, knee, foot, fin));
    }
    const elbow = [0.3, 0.22, s * 0.24];
    parts.push(rod(solid, 0.03, 0.03, [0.13, 0.17, s * 0.14], elbow, body));
    parts.push(solid(new THREE.SphereGeometry(0.075, 8, 6).scale(1.5, 0.8, 0.8), belly, at(0.4, 0.22, s * 0.24)));
  }
  parts.push(...eyes(solid, 0.19, 0.25, 0.06, 0.018));
  return parts;
}

function lobster(c, { grid, fin: finSheet, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [grid(10, 16, (u, v) => {
    const a = u * Math.PI * 2;
    const r = 0.1 * (1 - v * 0.55) * Math.min(1, v * 7 + 0.3);
    const ring = Math.floor(v * 8) % 2 === 0;
    return [0.32 - v * 0.72, 0.1 + Math.cos(a) * r * 0.8, Math.sin(a) * r, Math.cos(a) < -0.3 ? belly : ring ? body : fin];
  })];
  for (const s of [-1, 1]) {
    parts.push(finSheet((u) => [-0.4, 0.09, s * u * 0.05], (u) => [-0.54, 0.08, s * (0.03 + u * 0.13)], fin, 5));
    parts.push(rod(solid, 0.012, 0.003, [0.3, 0.14, s * 0.05], [0.72, 0.3, s * 0.42], fin));
    for (let k = 0; k < 4; k++) {
      const x = 0.2 - k * 0.09;
      parts.push(rod(solid, 0.014, 0.006, [x, 0.06, s * 0.08], [x + 0.02, 0, s * 0.27], fin));
    }
  }
  parts.push(...eyes(solid, 0.3, 0.17, 0.05, 0.022));
  return parts;
}

function octopus(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [solid(new THREE.SphereGeometry(0.17, 14, 10).scale(1.1, 1.3, 1), body, at(-0.04, 0.28, 0))];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    parts.push(grid(5, 10, (u, v) => {
      const r = 0.1 + v * 0.42;
      const ang = a + Math.sin(v * 5 + k) * 0.28;
      const w = 0.042 * (1 - v * 0.9);
      const t = u * Math.PI * 2;
      return [Math.cos(ang) * r + Math.cos(t) * w, 0.14 - v * 0.1 + Math.sin(v * 8 + k) * 0.02 + Math.sin(t) * w, Math.sin(ang) * r + Math.sin(t) * w, Math.sin(t) < 0 ? belly : fin];
    }));
  }
  parts.push(...eyes(solid, 0.1, 0.3, 0.09, 0.03));
  return parts;
}

function flat(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const outline = (v) => 0.3 * Math.pow(Math.sin(Math.min(1, v) * Math.PI), 0.65) * (1 - v * 0.3);
  const parts = [];
  for (const side of [1, -1]) {
    parts.push(grid(12, 16, (u, v) => {
      const z = (u * 2 - 1) * outline(v);
      const spot = side > 0 && Math.sin(v * 31 + u * 17) * Math.cos(u * 23) > 0.55;
      return [0.5 - v, 0.05 + side * 0.035 * (1 - (z / 0.3) ** 2), z, side > 0 ? (spot ? fin : body) : belly];
    }));
  }
  parts.push(solid(new THREE.SphereGeometry(0.03, 8, 6), 0x0c1014, at(0.32, 0.1, 0.07)), solid(new THREE.SphereGeometry(0.03, 8, 6), 0x0c1014, at(0.25, 0.1, -0.02)));
  return parts;
}

function seahorse(c, { grid, fin: finSheet, solid }) {
  const { body, belly, fin } = c.colors;
  const spine = (v) => {
    const a = v * Math.PI * 1.45;
    return v < 0.62 ? [0.04 + Math.sin(v * 5) * 0.1, 0.42 - v * 1.0, 0] : [0.16 + Math.cos(a * 2.6) * 0.1, -0.2 + Math.sin(a * 2.6) * 0.1, 0];
  };
  const parts = [grid(8, 28, (u, v) => {
    const [x, y] = spine(v);
    const r = 0.09 * (1 - v * 0.85) * Math.min(1, v * 7 + 0.5);
    const a = u * Math.PI * 2;
    return [x + Math.cos(a) * r, y, Math.sin(a) * r, Math.floor(v * 16) % 2 ? body : belly];
  })];
  parts.push(rod(solid, 0.045, 0.022, [0.05, 0.42, 0], [0.26, 0.38, 0], body));
  parts.push(finSheet((u) => [-0.06, 0.2 - u * 0.15, 0], (u) => [-0.17, 0.2 - u * 0.15, 0], fin, 5));
  parts.push(...eyes(solid, 0.09, 0.44, 0.05, 0.02));
  return parts;
}

/** チンアナゴ：砂から体を出して揺れる */
function garden(c, { grid, solid }) {
  const { body, belly, fin } = c.colors;
  const parts = [grid(8, 20, (u, v) => {
    const a = u * Math.PI * 2;
    const r = 0.035;
    const lean = Math.sin(v * 2.4) * 0.14;
    const spot = Math.floor(v * 14) % 3 === 0 && Math.cos(a) > 0;
    return [lean + Math.cos(a) * r, v * 0.8, Math.sin(a) * r, spot ? fin : Math.cos(a) < -0.2 ? belly : body];
  })];
  parts.push(solid(new THREE.SphereGeometry(0.045, 8, 6).scale(1.3, 1, 1), body, at(Math.sin(2.4) * 0.14 + 0.02, 0.82, 0)));
  parts.push(...eyes(solid, Math.sin(2.4) * 0.14 + 0.06, 0.84, 0.03, 0.013));
  return parts;
}

const BUILDERS = { crab, lobster, octopus, flat, seahorse, garden };

/** 該当する体形なら { parts, mode } を返す（mode 3 = 体をくねらせない） */
export function extraSoftParts(c, helpers) {
  const build = BUILDERS[c.form];
  return build ? { parts: build(c, helpers), mode: 3 } : null;
}

/** 水槽の底付近で暮らす体形 */
export const BENTHIC_FORMS = new Set(['crab', 'lobster', 'octopus', 'flat', 'garden']);
/** その場からあまり動かない体形 */
export const STATIONARY_FORMS = new Set(['seahorse', 'garden']);
