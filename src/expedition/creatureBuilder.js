import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FORMS } from './creatureForms.js';
import { extraSoftParts } from './creatureSoft.js';
import { RIM, bakeFacets, bandsFor, ringStops } from './creatureFacet.js';
import { ANATOMY } from './creatureAnatomy.js';
import { tracedParts } from './creatureTraced.js';

/**
 * 展示生物のポリゴンアートモデル。+X が頭、原点が体の中心。三角形ごとに塗り分けて質感を統一する。
 * 全パーツを1メッシュに結合し、遊泳は頂点シェーダーで体をくねらせる（スマホ向けに軽量）。
 */
const color = new THREE.Color();
const rgb = (hex) => color.set(hex).clone();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const noise = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

/** 面を大きく見せるため、格子の細かさを落とす */
const coarse = (n) => Math.max(3, Math.round(n * 0.62));

/** 格子状の面。fn(u, v) → [x, y, z, hex] */
function grid(nu0, nv0, fn) {
  const nu = coarse(nu0);
  const nv = coarse(nv0);
  const pos = [];
  const col = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const [x, y, z, hex] = fn(i / nu, j / nv);
    pos.push(x, y, z);
    rgb(hex).toArray(col, col.length);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i;
    const c = a + nu + 1;
    idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}

const tint = (hex, k) => rgb(hex).multiplyScalar(k).getHex();

/** 球は角ばった多面体に置き換える */
function faceted(geo) {
  if (geo.type !== 'SphereGeometry') return geo;
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const center = geo.boundingBox.getCenter(new THREE.Vector3());
  return new THREE.IcosahedronGeometry(1, 1).scale(size.x, size.y, size.z).translate(center.x, center.y, center.z);
}

function solid(geo0, hex, matrix) {
  const geo = faceted(geo0);
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (matrix) g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = rgb(hex);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** 体の輪郭。t=0 が吻端、1 が尾の付け根。上半分・下半分の高さ（全長比） */
function profile(f, t) {
  const nose = Math.pow(Math.min(1, t / 0.32), f.head);
  const taper = 1 - smooth(0.42, 1, t) * (1 - f.ped);
  const end = f.cut ? 1 - smooth(f.cut, 1, t) * 0.25 : 1;
  const top = (f.h / 2) * nose * taper * end;
  const hump = f.hump ? f.hump * f.h * Math.exp(-(((t - 0.14) / 0.11) ** 2)) : 0;
  return { top: top + hump, bot: (f.h / 2) * nose * taper * end, wide: (f.w / 2) * Math.pow(Math.min(1, t / 0.3), 0.7) * (1 - smooth(0.4, 1, t) * 0.78) };
}

/** 模様。t: 頭→尾、v: -1(腹)〜1(背)、seed: 面ごとの乱数 */
function bodyColor(c, f, t, v, seed) {
  const { body, belly } = c.colors;
  const m = c.mark;
  const band = bandsFor(c).find(([a, b]) => t >= a && t < b);
  if (band) return band[2];
  let hex = v < -0.35 ? belly : v < -0.05 ? rgb(body).lerp(rgb(belly), 0.5).getHex() : body;
  if (c.pat === 'palette') {
    if ((v > 0.1 && v < 0.75 && t > 0.2) || (t > 0.55 && v > -0.2 && v < 0.4)) hex = m;
    if (t > 0.92) hex = c.colors.fin;
  } else if (c.pat === 'lateral') {
    if (Math.abs(v) < 0.42 && t > 0.2) hex = m;
  } else if (c.pat === 'spots') {
    if (noise(seed, 3.1) > 0.72) hex = m;
  } else if (c.pat === 'mottle') {
    if (noise(seed, 7.7) > 0.56) hex = m;
  }
  if (f.gills ? t >= 0.2 && t < 0.22 || t >= 0.24 && t < 0.26 : t >= 0.27 && t < 0.295) {
    if (Math.abs(v) < 0.8) hex = tint(hex, 0.55); // エラ
  }
  return hex;
}

/** 胴体：模様の境目に合わせた輪切りを、半周ずつずらしてつなぐ（菱形の面になる） */
function facetedBody(c, f) {
  const SEG = 8;
  const stops = ringStops(c, f.gills);
  const pos = [];
  const col = [];
  const vertex = (r, k) => {
    const t = stops[r];
    const a = ((k + (r % 2) * 0.5) / SEG) * Math.PI * 2;
    const p = profile(f, t < 0.16 ? 0.16 * Math.pow(t / 0.16, 0.72) : t); // 頭先を丸くする
    const cy = Math.cos(a);
    const sz = Math.sin(a);
    const pw = f.boxy ? Math.sign(sz) * Math.pow(Math.abs(sz), 0.45) : sz;
    const py = f.boxy ? Math.sign(cy) * Math.pow(Math.abs(cy), 0.45) : cy;
    const bump = 1 + (noise(r + 1, k % SEG) - 0.5) * 0.14; // 面に表情をつける
    return { p: [0.5 - t, (py > 0 ? p.top : p.bot) * py * bump, p.wide * pw * bump], a };
  };
  const tri = (A, B, C, r, seed) => {
    const t = (stops[r] + stops[r + 1]) / 2;
    const v = Math.cos((A.a + B.a + C.a) / 3);
    const c0 = rgb(bodyColor(c, f, t, v, seed));
    for (const q of [A, B, C]) {
      pos.push(...q.p);
      c0.toArray(col, col.length);
    }
  };
  for (let r = 0; r < stops.length - 1; r++) for (let k = 0; k < SEG; k++) {
    const A = vertex(r, k);
    const B = vertex(r, k + 1);
    // 奇数の輪は半周ずれているので、対応する頂点を合わせる
    const C = vertex(r + 1, k + (r % 2 ? 1 : 0));
    const D = vertex(r + 1, k - (r % 2 ? 0 : 1));
    tri(A, B, C, r, r * 17 + k);
    tri(A, C, D, r, r * 17 + k + 40);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** ひれ：根元の線 base(s) から先端 tip(s) まで張った面 */
function fin(base, tip, hex, rays = 10) {
  return grid(rays, 2, (u, v) => {
    const [bx, by, bz] = base(u);
    const [tx, ty, tz] = tip(u);
    return [bx + (tx - bx) * v, by + (ty - by) * v, bz + (tz - bz) * v, hex];
  });
}

/** 黒い縁取りのあるひれ */
function rimFin(base, tip, hex, rays = 10) {
  const rows = [0, 0.5, 0.84, 1];
  const nu = Math.max(3, Math.round(rays * 0.7));
  const pos = [];
  const col = [];
  const point = (i, j) => {
    const u = i / nu;
    const v = rows[j];
    const [bx, by, bz] = base(u);
    const [tx, ty, tz] = tip(u);
    return [bx + (tx - bx) * v, by + (ty - by) * v, bz + (tz - bz) * v];
  };
  const face = (a, b, c0, hexColor) => {
    const k = rgb(hexColor);
    for (const q of [a, b, c0]) {
      pos.push(...q);
      k.toArray(col, col.length);
    }
  };
  for (let j = 0; j < 3; j++) for (let i = 0; i < nu; i++) {
    const h = j === 2 ? RIM : hex;
    const [a, b, c0, d] = [point(i, j), point(i + 1, j), point(i, j + 1), point(i + 1, j + 1)];
    if ((i + j) % 2) {
      face(a, c0, b, h);
      face(b, c0, d, h);
    } else {
      face(a, c0, d, h);
      face(a, d, b, h);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function tailFin(f, hex) {
  const H = f.h * f.tailH;
  const x0 = -0.5;
  const shapes = {
    fork: (s) => [-0.17 - Math.abs(s) * 0.03 + (1 - Math.abs(s)) * 0.09, s * 0.62],
    lunate: (s) => [-0.14 - Math.abs(s) * 0.08 + (1 - Math.abs(s)) * 0.12, s * 0.8],
    round: (s) => [-0.15 * Math.sqrt(1 - s * s * 0.8), s * 0.5],
    cut: (s) => [-0.14, s * 0.56],
    hetero: (s) => (s > 0 ? [-0.24 * s - 0.04, s * 0.95] : [-0.1 * -s - 0.04, s * 0.42]),
    lobed: (s) => [-0.17 * (1 - 0.35 * Math.abs(Math.sin(s * 4.7))), s * 0.56],
    clavus: (s) => [-0.05 - 0.03 * Math.cos(s * 9), s * 0.62],
  };
  const shape = shapes[f.tail];
  if (!shape) return null;
  return rimFin((u) => [x0 + 0.01, (u * 2 - 1) * f.h * f.ped * 0.42, 0], (u) => {
    const [dx, dy] = shape(u * 2 - 1);
    return [x0 + dx, dy * H, 0];
  }, hex, 14);
}

function fishParts(c, f) {
  const parts = [];
  const finC = c.colors.fin;
  const X = (t) => 0.5 - t;
  parts.push(facetedBody(c, f));
  // 背びれ・尻びれ
  if (f.dorsal) {
    const [a, b, hK, sw] = f.dorsal;
    const H = f.h * hK;
    parts.push(rimFin((u) => { const t = a + (b - a) * u; return [X(t), profile(f, t).top * 0.92, 0]; }, (u) => {
      const t = a + (b - a) * u;
      const k = Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)) ** 0.5;
      return [X(t) - sw * 0.2 * (0.4 + u), profile(f, t).top + H * k, 0];
    }, finC, f.crest ? 40 : 12));
  }
  if (f.anal) {
    const [a, b, hK, sw] = f.anal;
    const H = f.h * hK;
    parts.push(rimFin((u) => { const t = a + (b - a) * u; return [X(t), -profile(f, t).bot * 0.92, 0]; }, (u) => {
      const t = a + (b - a) * u;
      return [X(t) - sw * 0.2, -profile(f, t).bot - H * Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)) ** 0.5, 0];
    }, finC));
  }
  const tail = tailFin(f, finC);
  if (tail) parts.push(tail);
  // リュウグウノツカイの冠
  if (f.crest) {
    for (let i = 0; i < 6; i++) {
      const dx = 0.02 + i * 0.012;
      parts.push(fin((u) => [0.44 - i * 0.006 + u * 0.004, f.h * 0.4, 0], (u) => [0.44 - dx * 0.6 + u * 0.004, f.h * (1.6 + i * 0.5), 0], finC, 1));
    }
  }
  // 胸びれ（左右）
  const pl = f.h * f.pect * 1.2;
  const px = X(0.31);
  for (const s of [-1, 1]) {
    const z = s * f.w * 0.44;
    const y = -f.h * 0.12;
    parts.push(rimFin((u) => [px - u * pl * 0.3, y + u * pl * 0.1, z], (u) => [px - pl * (0.55 + u * 0.4), y - pl * (0.32 - u * 0.5), z + s * pl * 0.55], tint(finC, 1.1), 6));
  }
  // シュモクザメの頭
  if (f.hammer) {
    parts.push(solid(new THREE.BoxGeometry(0.055, f.h * 0.22, 0.26), c.colors.body, new THREE.Matrix4().makeTranslation(0.47, 0, 0)));
  }
  // 目（白目・虹彩・瞳・光）
  const R = Math.max(f.h * (c.bigEye ? 0.13 : 0.085), 0.0085);
  const eyeT = f.dome ? 0.15 : f.hammer ? 0.03 : 0.16;
  const p = profile(f, eyeT);
  for (const s of [-1, 1]) {
    const ex = f.hammer ? 0.47 : X(eyeT);
    const ey = f.dome ? p.top * 0.9 : f.hammer ? 0 : p.top * 0.32;
    const ez = f.hammer ? s * 0.13 : s * Math.max(p.wide * 0.82, R * 0.4);
    const at = (dx, dy, dz) => new THREE.Matrix4().makeTranslation(ex + dx, ey + dy, ez + dz);
    parts.push(solid(new THREE.SphereGeometry(R, 8, 6), c.iris ?? 0xf0e6c8, at(0, 0, 0)));
    parts.push(solid(new THREE.SphereGeometry(R * 0.82, 7, 5), 0x0c1014, at(0.002, 0, s * R * 0.3)));
    parts.push(solid(new THREE.SphereGeometry(R * 0.2, 5, 4), 0xffffff, at(R * 0.3, R * 0.3, s * R * 0.96)));
  }
  // 口
  const mouth = tint(c.colors.body, 0.42);
  parts.push(fin((u) => [0.5 - u * 0.05, -f.h * 0.03, -f.w * 0.1], (u) => [0.5 - u * 0.05, -f.h * 0.035, f.w * 0.1], mouth, 2));
  return parts;
}

/** クラゲ・クリオネ・メンダコ・イカ・エイ */
function softParts(c) {
  const extra = extraSoftParts(c, { grid, fin, solid, tint });
  if (extra) return extra;
  const { body, belly, fin: finC } = c.colors;
  const parts = [];
  if (c.form === 'jelly') {
    parts.push(grid(16, 7, (u, v) => {
      const a = u * Math.PI * 2;
      const r = 0.5 * Math.sin(v * Math.PI * 0.56) * (1 + Math.sin(a * 8) * 0.03 * v);
      const ring = Math.abs(v - 0.3) < 0.1 && Math.cos(a * 4) > 0.3; // 四つ葉の胃腔
      return [Math.cos(a) * r, 0.3 * Math.cos(v * Math.PI * 0.56), Math.sin(a) * r, ring ? belly : body];
    }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(grid(2, 8, (u, v) => {
        const r = 0.44 - v * 0.08;
        const sway = Math.sin(v * 7 + i) * 0.03 * v;
        return [Math.cos(a) * r + sway + (u - 0.5) * 0.02, 0.02 - v * 0.75, Math.sin(a) * r + (u - 0.5) * 0.02, finC];
      }));
    }
    return { parts, mode: 2, opacity: 0.82 };
  }
  if (c.form === 'clione') {
    parts.push(grid(10, 12, (u, v) => {
      const a = u * Math.PI * 2;
      const r = 0.2 * Math.sin(Math.PI * Math.pow(v, 0.7)) ** 0.8;
      return [Math.cos(a) * r, 0.5 - v, Math.sin(a) * r, v > 0.24 && v < 0.5 && r > 0.1 ? belly : body];
    }));
    for (const s of [-1, 1]) {
      parts.push(fin((u) => [s * 0.14, 0.2 - u * 0.12, 0], (u) => [s * 0.5, 0.26 - u * 0.2, Math.sin(u * 3) * 0.05], finC, 5));
    }
    return { parts, mode: 1, opacity: 0.86 };
  }
  if (c.form === 'dumbo') {
    parts.push(grid(14, 9, (u, v) => {
      const a = u * Math.PI * 2;
      const skirt = smooth(0.62, 1, v);
      const r = 0.3 * Math.sin(Math.min(1, v * 1.4) * Math.PI * 0.5) + skirt * 0.28 * (1 + Math.cos(a * 8) * 0.14);
      return [Math.cos(a) * r, 0.3 - v * 0.46 - skirt * 0.04, Math.sin(a) * r, skirt > 0.3 ? belly : body];
    }));
    for (const s of [-1, 1]) {
      parts.push(fin((u) => [s * 0.17, 0.3 - u * 0.1, (u - 0.5) * 0.14], (u) => [s * (0.44 - Math.abs(u - 0.5) * 0.2), 0.38 - u * 0.14, (u - 0.5) * 0.3], finC, 5));
      const at = new THREE.Matrix4().makeTranslation(0.14, 0.04, s * 0.24);
      parts.push(solid(new THREE.SphereGeometry(0.045, 7, 5), 0x12100f, at));
    }
    return { parts, mode: 2 };
  }
  if (c.form === 'squid') {
    // 外套膜は尾側(+X)を前に泳ぐ
    parts.push(grid(10, 16, (u, v) => {
      const a = u * Math.PI * 2;
      const r = 0.075 * Math.pow(Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.5), 0.7);
      return [0.5 - v * 0.46, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) < -0.2 ? belly : body];
    }));
    for (const s of [-1, 1]) parts.push(fin((u) => [0.5 - u * 0.12, 0, s * 0.02], (u) => [0.46 - u * 0.1, 0, s * 0.13 * Math.sin(u * Math.PI)], finC, 5));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const len = i % 5 === 0 ? 0.5 : 0.28; // 2本の触腕は長い
      parts.push(grid(3, 8, (u, v) => {
        const r = 0.05 + v * 0.03;
        const w = 0.012 * (1 - v * 0.7);
        const ta = a + (u - 0.5) * 1.2;
        return [0.04 - v * len, Math.cos(ta) * (r * 0.8) * (1 + (w / r)), Math.sin(ta) * (r * 0.8), v > 0.2 ? finC : belly];
      }));
    }
    for (const s of [-1, 1]) parts.push(solid(new THREE.SphereGeometry(0.03, 8, 6), 0x101014, new THREE.Matrix4().makeTranslation(0.06, 0.03, s * 0.06)));
    return { parts, mode: 0 };
  }
  // エイ：背面と腹面の2枚の翼、頭鰭、細い尾
  const outline = (v) => 0.95 * Math.pow(Math.sin(Math.pow(Math.min(1, v), 0.8) * Math.PI), 1.5); // 三角形の大きな胸びれ
  for (const side of [1, -1]) {
    parts.push(grid(12, 12, (u, v) => {
      const z = (u * 2 - 1) * outline(v);
      const dome = 0.06 * Math.exp(-((z / 0.2) ** 2)) * Math.sin(v * Math.PI);
      const shoulder = v > 0.2 && v < 0.5 && Math.abs(Math.abs(z) - 0.3) < 0.1;
      const hex = side > 0 ? (shoulder ? belly : Math.abs(z) > 0.6 ? finC : body) : belly;
      return [0.42 - v * 0.8 - Math.abs(z) * 0.3, side * dome, z, hex];
    }));
  }
  for (const s of [-1, 1]) {
    parts.push(fin((u) => [0.42, 0, s * (0.06 + u * 0.03)], (u) => [0.56, -0.02, s * (0.07 + u * 0.03)], finC, 2));
    parts.push(solid(new THREE.SphereGeometry(0.018, 6, 4), 0x0d1014, new THREE.Matrix4().makeTranslation(0.4, 0.02, s * 0.11)));
  }
  parts.push(fin((u) => [-0.36, 0.006, (u - 0.5) * 0.03], (u) => [-0.95, 0.006, (u - 0.5) * 0.004], finC, 2));
  return { parts, mode: 1 };
}

const VERT_DECL = 'uniform float uTime;\nuniform float uMode;\nuniform float uWave;\n#include <common>';
const VERT_BODY = `#include <begin_vertex>
if (uMode < 0.5) {
  float amp = smoothstep(0.3, -0.5, position.x);
  transformed.z += sin(position.x * 7.0 * uWave + uTime * 7.0) * 0.075 * amp;
} else if (uMode < 1.5) {
  transformed.y += sin(uTime * 2.2 + position.x * 2.0) * 0.5 * abs(position.z) * abs(position.z) * 1.4;
} else if (uMode < 2.5) {
  float pulse = 1.0 + sin(uTime * 2.4) * 0.13 * smoothstep(-0.2, 0.3, position.y);
  transformed.xz *= pulse;
  transformed.y *= 2.0 - pulse;
}`;

/** c.len に拡大した1メッシュの生物を作る。fish.userData.uni.uTime を進めると泳ぐ */
export function buildCreature(c) {
  const root = new THREE.Group();
  root.userData.creature = c.id;
  const f = FORMS[c.form];
  const { parts, mode = 0, opacity = 1 } = ANATOMY[c.id] ? { parts: tracedParts(c, ANATOMY[c.id]) } : f ? { parts: fishParts(c, f) } : softParts(c);
  const merge = (list) => {
    const geo = mergeGeometries(list.map((g) => {
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      return g;
    }), false);
    bakeFacets(geo);
    return geo;
  };
  const clear = parts.filter((g) => g.userData.clear); // ひれの透ける膜
  const geo = merge(parts.filter((g) => !g.userData.clear));
  const clearGeo = clear.length ? merge(clear) : null;
  parts.forEach((g) => g.dispose());
  const uni = { uTime: { value: 0 }, uMode: { value: mode }, uWave: { value: f?.wave ?? 1 } };
  // 色は焼き込み済みなので、館内の照明に左右されない
  const addMesh = (g, alpha) => {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uni);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_DECL).replace('#include <begin_vertex>', VERT_BODY);
    };
    mat.customProgramCacheKey = () => 'creature-swim';
    const mesh = new THREE.Mesh(g, mat);
    mesh.scale.setScalar(c.len);
    mesh.raycast = () => {};
    root.add(mesh);
  };
  addMesh(geo, opacity);
  if (clearGeo) addMesh(clearGeo, 0.38);
  root.userData.uni = uni;
  return root;
}
