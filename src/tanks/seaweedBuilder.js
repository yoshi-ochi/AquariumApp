import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './random.js';

/**
 * 海藻・海草。1個体を1つのメッシュにまとめる（頂点色）ので、たくさん置いても描画が重くならない。
 *   アマモ（海草）… 砂地から伸びる細長いリボン状の葉の群落
 *   カジメ … 短い茎の先から、しわのある葉が何枚も出る褐藻（海中林）
 *   ジャイアントケルプ … 長い茎に沿って葉が並び、葉の付け根に浮き袋がある大型褐藻
 *   ホンダワラ … 枝分かれした茎に小さな葉と丸い気胞が付く褐藻（ガラモ場）
 *   ウミブドウ … 砂の上を這う茎から立つ枝に、粒状の小枝がブドウのように付く緑藻
 *   アオサ … 薄く波打つ明るい緑のシート状の緑藻
 *   テングサ … 細かく枝分かれする赤い紅藻
 *   ウミウチワ … 白っぽい縞のある扇形の褐藻
 */

const col = (hex, rand, k = 0.12) => {
  const c = new THREE.Color(hex);
  const f = 1 + (rand() - 0.5) * k * 2;
  return [c.r * f, c.g * f, c.b * f];
};

class Parts {
  list = [];
  /** geo に色を塗って行列で置く。color は [r,g,b] か、頂点ごとに色を返す関数 */
  add(geo, color, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    const pos = g.attributes.position;
    const c = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const v = typeof color === 'function' ? color(i, pos) : color;
      c.set(v, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    this.list.push(g);
  }
  mesh(roughness = 0.75) {
    const geo = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'body';
    return mesh;
  }
}

const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

/** 細長い葉：根元から先へ、幅を taper で細め、bend で前へしならせ、wave で縁を波打たせる */
function leaf(len, width, { bend = 0, wave = 0, taper = 'tip', segs = 8 } = {}) {
  const g = new THREE.PlaneGeometry(width, len, 2, segs);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / len;
    const shape = taper === 'tip' ? 1 - t * 0.85 : taper === 'oval' ? Math.sin(Math.PI * Math.min(0.98, Math.max(0.04, t))) : 1;
    const x = p.getX(i) * shape;
    p.setXYZ(i, x, p.getY(i), bend * t * t * len + Math.sin(t * 9 + x * 60) * wave);
  }
  g.computeVertexNormals();
  return g;
}

const ground = (parts, w, d, hex, rand) => {
  const g = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);
  parts.add(g, col(hex, rand, 0.05), M(0, 0.003, 0, 0, 0, 0, 1).scale(new THREE.Vector3(w * 0.9, 1, d * 0.9)));
};

export function buildAmamo(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  ground(P, w, d, 0xb8a888, rand);
  for (let k = 0; k < 34; k++) {
    const x = (rand() - 0.5) * w * 0.8;
    const z = (rand() - 0.5) * d * 0.8;
    const len = h * (0.45 + rand() * 0.55);
    P.add(leaf(len, 0.007 + rand() * 0.004, { bend: 0.25 + rand() * 0.35, taper: 'none', segs: 10 }), col(rand() < 0.3 ? 0x7a9a3a : 0x3f8a3a, rand), M(x, 0, z, 0, rand() * Math.PI * 2, (rand() - 0.5) * 0.25));
  }
  g.add(P.mesh(0.85));
}

export function buildKajime(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  for (let k = 0; k < 3; k++) {
    const x = (rand() - 0.5) * w * 0.5;
    const z = (rand() - 0.5) * d * 0.5;
    const sh = h * (0.35 + rand() * 0.15);
    P.add(new THREE.ConeGeometry(0.012, 0.015, 6).translate(0, 0.0075, 0), col(0x4a3418, rand), M(x, 0, z));
    P.add(new THREE.CylinderGeometry(0.004, 0.006, sh, 6).translate(0, sh / 2, 0), col(0x5a3e1a, rand), M(x, 0, z));
    // 茎の先から長い葉が広がり、先は重みで垂れる
    const n = 5 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
      const a = (b / n) * Math.PI * 2 + rand() * 0.4;
      P.add(leaf(h * (0.5 + rand() * 0.2), 0.055 + rand() * 0.02, { bend: 1.1, wave: 0.009, taper: 'oval', segs: 12 }), col(b % 3 ? 0x7a5420 : 0x8c6426, rand), M(x, sh * 0.95, z, 0.75 + rand() * 0.35, a, 0));
    }
  }
  g.add(P.mesh());
}

export function buildKelp(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  for (let k = 0; k < 3; k++) {
    const x0 = (rand() - 0.5) * w * 0.4;
    const z0 = (rand() - 0.5) * d * 0.4;
    const lean = new THREE.Vector3((rand() - 0.5) * 0.25, 1, (rand() - 0.5) * 0.25);
    const curve = new THREE.CatmullRomCurve3([0, 0.35, 0.7, 1].map((t) => new THREE.Vector3(x0 + lean.x * t * h + Math.sin(t * 4 + k) * 0.02, t * h * (0.8 + rand() * 0.2), z0 + lean.z * t * h)));
    P.add(new THREE.TubeGeometry(curve, 16, 0.003, 5, false), col(0x6a5020, rand));
    for (let t = 0.08; t < 0.98; t += 0.07 + rand() * 0.03) {
      const p = curve.getPoint(t);
      const side = rand() < 0.5 ? -1 : 1;
      // 葉の付け根の浮き袋
      P.add(new THREE.SphereGeometry(0.007, 6, 4), col(0x9a7a30, rand), M(p.x, p.y, p.z));
      P.add(leaf(h * (0.14 + rand() * 0.06), 0.028, { bend: 0.4, wave: 0.003, taper: 'oval' }), col(0x8a6a28, rand), M(p.x, p.y, p.z, 0.2, rand() * Math.PI * 2, side * (0.9 + rand() * 0.4)));
    }
  }
  g.add(P.mesh());
}

export function buildHondawara(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  for (let k = 0; k < 3; k++) {
    const x = (rand() - 0.5) * w * 0.5;
    const z = (rand() - 0.5) * d * 0.5;
    const sh = h * (0.7 + rand() * 0.3);
    P.add(new THREE.CylinderGeometry(0.0025, 0.004, sh, 5).translate(0, sh / 2, 0), col(0x5a4418, rand), M(x, 0, z, 0, 0, (rand() - 0.5) * 0.15));
    for (let t = 0.15; t < 1; t += 0.12) {
      const y = sh * t;
      const a = rand() * Math.PI * 2;
      const bl = h * 0.12 * (1.1 - t);
      const bx = Math.cos(a) * bl;
      const bz = Math.sin(a) * bl;
      P.add(new THREE.CylinderGeometry(0.0015, 0.002, bl, 4).translate(0, bl / 2, 0), col(0x6a5220, rand), M(x, y, z, Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1));
      for (let s = 0.3; s <= 1; s += 0.35) {
        const px = x + bx * s;
        const pz = z + bz * s;
        const py = y + bl * s * 0.45;
        P.add(leaf(0.025, 0.008, { taper: 'oval', segs: 3 }), col(0x8a6a24, rand), M(px, py, pz, rand(), rand() * 6.3, rand()));
        P.add(new THREE.SphereGeometry(0.0045, 6, 4), col(0xa08030, rand), M(px + 0.006, py + 0.004, pz));
      }
    }
  }
  g.add(P.mesh());
}

export function buildUmibudou(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  ground(P, w, d, 0xd8ccb0, rand);
  // 砂の上を這う茎
  const runner = new THREE.CatmullRomCurve3([-0.5, -0.2, 0.15, 0.5].map((t) => new THREE.Vector3(t * w * 0.85, 0.004, Math.sin(t * 5 + seed) * d * 0.25)));
  P.add(new THREE.TubeGeometry(runner, 20, 0.0025, 5, false), col(0x5a9a40, rand));
  const bead = new THREE.IcosahedronGeometry(0.0042, 0);
  for (let k = 0; k < 11; k++) {
    const p = runner.getPoint(0.05 + (k / 11) * 0.9);
    const sh = h * (0.45 + rand() * 0.55);
    const tilt = (rand() - 0.5) * 0.3;
    P.add(new THREE.CylinderGeometry(0.0018, 0.0022, sh, 4).translate(0, sh / 2, 0), col(0x4a8a38, rand), M(p.x, 0, p.z, 0, 0, tilt));
    for (let y = sh * 0.15; y < sh; y += 0.007) {
      for (let a = 0; a < 3; a++) {
        const ang = a * 2.1 + y * 90;
        P.add(bead, col(0x4cb850, rand, 0.15), M(p.x + Math.cos(ang) * 0.005 - Math.sin(tilt) * y, y, p.z + Math.sin(ang) * 0.005));
      }
    }
  }
  g.add(P.mesh(0.35));
}

export function buildAosa(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  // 縁が不規則に波打つ丸いシートを、根元から重ねて広げる
  for (let k = 0; k < 11; k++) {
    const s = 0.035 + rand() * 0.03;
    const sheet = new THREE.CircleGeometry(s, 18, 0, Math.PI * 2);
    const p = sheet.attributes.position;
    const ph = rand() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const r = Math.hypot(x, y) / s;
      const a = Math.atan2(y, x);
      const edge = 1 + Math.sin(a * 5 + ph) * 0.18 + Math.sin(a * 11 + ph * 2) * 0.08;
      p.setXYZ(i, x * edge, y * edge * 1.25 + s, Math.sin(a * 7 + ph) * 0.008 * r * r + r * r * 0.01);
    }
    sheet.computeVertexNormals();
    P.add(sheet, col(k % 3 ? 0x7ccf5a : 0x9ade6a, rand, 0.12), M((rand() - 0.5) * w * 0.5, 0.004, (rand() - 0.5) * d * 0.5, -0.3 - rand() * 0.9, rand() * 6.3, (rand() - 0.5) * 0.5));
  }
  g.add(P.mesh(0.6));
}

export function buildTengusa(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h } = def.size;
  const P = new Parts();
  const branch = (base, dir, len, r, depth) => {
    const end = base.clone().addScaledVector(dir, len);
    const geo = new THREE.CylinderGeometry(r * 0.7, r, len, 4).translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    P.add(geo, col(depth > 3 ? 0xc0505a : depth > 1 ? 0xa0303c : 0x7a2028, rand), new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1)));
    if (depth >= 5) return;
    for (let k = 0; k < 2 + (rand() < 0.5 ? 1 : 0); k++) {
      const nd = dir.clone().add(new THREE.Vector3((rand() - 0.5) * 1.3, 0.2 + rand() * 0.4, (rand() - 0.5) * 1.3)).normalize();
      branch(end, nd, len * (0.6 + rand() * 0.2), r * 0.7, depth + 1);
    }
  };
  for (let k = 0; k < 5; k++) branch(new THREE.Vector3((rand() - 0.5) * w * 0.45, 0, (rand() - 0.5) * w * 0.45), new THREE.Vector3((rand() - 0.5) * 0.6, 1, (rand() - 0.5) * 0.6).normalize(), h * 0.3, 0.003, 0);
  g.add(P.mesh(0.7));
}

export function buildUmiuchiwa(g, def, { seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const { w, h, d } = def.size;
  const P = new Parts();
  for (let k = 0; k < 4; k++) {
    const r = h * (0.55 + rand() * 0.4);
    const fan = new THREE.CircleGeometry(r, 14, Math.PI * 0.15, Math.PI * 0.7);
    const p = fan.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(Math.atan2(p.getY(i), p.getX(i)) * 6) * 0.004 + (p.getX(i) ** 2 + p.getY(i) ** 2) * 1.2);
    fan.computeVertexNormals();
    // 中心からの距離で白っぽい縞を入れる
    const base = col(0xa07848, rand);
    const band = (i, pos) => {
      const t = Math.hypot(pos.getX(i), pos.getY(i)) / r;
      const s = Math.sin(t * 22) > 0.55 ? 1.45 : 1;
      return base.map((v) => Math.min(1, v * s));
    };
    P.add(fan, band, M((rand() - 0.5) * w * 0.5, 0, (rand() - 0.5) * d * 0.4, 0, rand() * Math.PI, 0));
  }
  g.add(P.mesh(0.8));
}

export const SEAWEED_BUILDERS = {
  amamo: buildAmamo,
  kajime: buildKajime,
  kelp: buildKelp,
  hondawara: buildHondawara,
  umibudou: buildUmibudou,
  aosa: buildAosa,
  tengusa: buildTengusa,
  umiuchiwa: buildUmiuchiwa,
};
