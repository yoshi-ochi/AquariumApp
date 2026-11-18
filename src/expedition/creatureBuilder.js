import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FORMS } from './creatureForms.js';

/**
 * 展示生物のローポリモデル。+X が頭、原点が体の中心。
 * 全パーツを1メッシュに結合し、遊泳は頂点シェーダーで体をくねらせる（スマホ向けに軽量）。
 */
const color = new THREE.Color();
const rgb = (hex) => color.set(hex).clone();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const noise = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

/** 格子状の面。fn(u, v) → [x, y, z, hex] */
function grid(nu, nv, fn, smoothNormals = true) {
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
  if (smoothNormals) g.computeVertexNormals();
  const out = g.toNonIndexed();
  if (!smoothNormals) out.computeVertexNormals();
  return out;
}

const tint = (hex, k) => rgb(hex).multiplyScalar(k).getHex();

function solid(geo, hex, matrix) {
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

/** 模様。t: 頭→尾、v: -1(腹)〜1(背) */
function bodyColor(c, f, t, v) {
  const { body, belly } = c.colors;
  const m = c.mark;
  let hex = v < -0.3 ? belly : v < -0.05 ? rgb(body).lerp(rgb(belly), 0.5).getHex() : body;
  const n = c.bands ?? 0;
  if (c.pat === 'bands' && t > 0.12) {
    const u = ((t - 0.12) / 0.88) * n;
    if (u - Math.floor(u) < 0.42) hex = m;
  } else if (c.pat === 'clown') {
    if (Math.abs(t - 0.24) < 0.05 || Math.abs(t - 0.56) < 0.06 || t > 0.9) hex = m;
    else if (Math.abs(t - 0.24) < 0.065 || Math.abs(t - 0.56) < 0.075) hex = 0x201c1a;
  } else if (c.pat === 'mask') {
    if (Math.abs(t - 0.16) < 0.045) hex = m;
  } else if (c.pat === 'palette') {
    if ((v > 0.15 && v < 0.5 && t > 0.2) || (t > 0.55 && v > -0.1 && v < 0.3)) hex = m;
    if (t > 0.93) hex = c.colors.fin;
  } else if (c.pat === 'lateral') {
    if (Math.abs(v - 0.05) < 0.1 && t > 0.2) hex = m;
  } else if (c.pat === 'spots') {
    if (noise(Math.floor(t * 18), Math.floor(v * 5)) > 0.74) hex = m;
  } else if (c.pat === 'mottle') {
    if (noise(Math.floor(t * 12), Math.floor(v * 3.5)) > 0.58) hex = m;
  }
  if (f.gills && t > 0.2 && t < 0.3 && Math.abs(v) < 0.5 && Math.floor(t * 60) % 2 === 0) hex = tint(hex, 0.7);
  if (!f.gills && t > 0.27 && t < 0.285 && v > -0.6) hex = tint(hex, 0.78); // エラぶた
  return hex;
}

/** ひれ：根元の線 base(s) から先端 tip(s) まで張った面。先端ほど淡く、すじ入り */
function fin(base, tip, hex, rays = 10) {
  return grid(rays, 2, (u, v) => {
    const [bx, by, bz] = base(u);
    const [tx, ty, tz] = tip(u);
    const ray = Math.floor(u * rays) % 2 === 0 ? 1 : 0.84;
    return [bx + (tx - bx) * v, by + (ty - by) * v, bz + (tz - bz) * v, tint(hex, ray * (0.82 + v * 0.3))];
  }, false);
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
  return fin((u) => [x0 + 0.01, (u * 2 - 1) * f.h * f.ped * 0.42, 0], (u) => {
    const [dx, dy] = shape(u * 2 - 1);
    return [x0 + dx, dy * H, 0];
  }, hex, 14);
}

function fishParts(c, f) {
  const parts = [];
  const finC = c.colors.fin;
  const X = (t) => 0.5 - t;
  // 胴体：頭から尾へ輪切りをつなぐ
  parts.push(grid(14, 22, (u, s) => {
    const a = u * Math.PI * 2;
    const t = s;
    const p = profile(f, t);
    const cy = Math.cos(a);
    const sz = Math.sin(a);
    const pw = f.boxy ? Math.sign(sz) * Math.pow(Math.abs(sz), 0.45) : sz;
    const py = f.boxy ? Math.sign(cy) * Math.pow(Math.abs(cy), 0.45) : cy;
    return [X(t), (py > 0 ? p.top : p.bot) * py, p.wide * pw, bodyColor(c, f, t, cy)];
  }));
  // 背びれ・尻びれ
  if (f.dorsal) {
    const [a, b, hK, sw] = f.dorsal;
    const H = f.h * hK;
    parts.push(fin((u) => { const t = a + (b - a) * u; return [X(t), profile(f, t).top * 0.92, 0]; }, (u) => {
      const t = a + (b - a) * u;
      const k = Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)) ** 0.5;
      return [X(t) - sw * 0.2 * (0.4 + u), profile(f, t).top + H * k, 0];
    }, finC, f.crest ? 40 : 12));
  }
  if (f.anal) {
    const [a, b, hK, sw] = f.anal;
    const H = f.h * hK;
    parts.push(fin((u) => { const t = a + (b - a) * u; return [X(t), -profile(f, t).bot * 0.92, 0]; }, (u) => {
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
  const pl = f.h * f.pect;
  const px = X(0.31);
  for (const s of [-1, 1]) {
    const z = s * f.w * 0.44;
    const y = -f.h * 0.12;
    parts.push(fin((u) => [px - u * pl * 0.3, y + u * pl * 0.1, z], (u) => [px - pl * (0.55 + u * 0.4), y - pl * (0.32 - u * 0.5), z + s * pl * 0.55], tint(finC, 1.1), 6));
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
    parts.push(solid(new THREE.SphereGeometry(R * 0.68, 7, 5), 0x0c1014, at(0.002, 0, s * R * 0.42)));
    parts.push(solid(new THREE.SphereGeometry(R * 0.2, 5, 4), 0xffffff, at(R * 0.3, R * 0.3, s * R * 0.96)));
  }
  // 口
  const mouth = tint(c.colors.body, 0.42);
  parts.push(fin((u) => [0.5 - u * 0.05, -f.h * 0.03, -f.w * 0.1], (u) => [0.5 - u * 0.05, -f.h * 0.035, f.w * 0.1], mouth, 2));
  return parts;
}

/** クラゲ・クリオネ・メンダコ・イカ・エイ */
function softParts(c) {
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
} else {
  float pulse = 1.0 + sin(uTime * 2.4) * 0.13 * smoothstep(-0.2, 0.3, position.y);
  transformed.xz *= pulse;
  transformed.y *= 2.0 - pulse;
}`;

/** c.len に拡大した1メッシュの生物を作る。fish.userData.uni.uTime を進めると泳ぐ */
export function buildCreature(c) {
  const root = new THREE.Group();
  root.userData.creature = c.id;
  const f = FORMS[c.form];
  const { parts, mode = 0, opacity = 1 } = f ? { parts: fishParts(c, f) } : softParts(c);
  const geo = mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }), false);
  parts.forEach((g) => g.dispose());
  const uni = { uTime: { value: 0 }, uMode: { value: mode }, uWave: { value: f?.wave ?? 1 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_DECL).replace('#include <begin_vertex>', VERT_BODY);
  };
  mat.customProgramCacheKey = () => 'creature-swim';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(c.len);
  mesh.raycast = () => {};
  root.add(mesh);
  root.userData.uni = uni;
  return root;
}
