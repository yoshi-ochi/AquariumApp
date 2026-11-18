import * as THREE from 'three';

/**
 * ポリゴンアートの質感。三角形ごとに1色で塗り、光の当たる面は暖かく明るく、
 * 影の面は深い色へずらす。照明に左右されないよう色を頂点へ焼き込む。
 */
const LIGHT = new THREE.Vector3(0.42, 0.8, 0.42).normalize();
const WARM_HUE = 0.13; // 光が当たる面の色相を寄せる先（黄色）
const COOL_HUE = 0.96; // 影の面の色相を寄せる先（赤紫）

export const RIM = 0x14151a; // ひれの縁や模様の輪郭

const hash = (n) => {
  const x = Math.sin(n * 91.73) * 43758.5453;
  return x - Math.floor(x);
};

/** 色相環の近い方向へ h を target に寄せる */
function shiftHue(h, target, amount) {
  let d = target - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (h + d * amount + 1) % 1;
}

/** 面の明るさ（0〜1）に応じて基本色を塗り分ける */
function shade(out, base, light, seed) {
  const hsl = base.getHSL({}, THREE.SRGBColorSpace);
  const jitter = (hash(seed) - 0.5) * 0.07;
  if (hsl.l < 0.14) return out.setHSL(hsl.h, hsl.s, Math.max(0.03, hsl.l * (0.75 + light * 0.7)), THREE.SRGBColorSpace); // 黒はつぶさない
  if (hsl.s < 0.1) return out.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * (0.72 + light * 0.36) + jitter * 0.5), THREE.SRGBColorSpace); // 白・灰は色を足さない
  const bright = light - 0.5;
  // 青系の魚は色相をほぼ保つ（黄や赤紫へ寄せると緑や紫に転んでしまう）
  const keep = hsl.h > 0.42 && hsl.h < 0.78 ? 0.12 : 1;
  const h = bright > 0 ? shiftHue(hsl.h, WARM_HUE, bright * 0.5 * keep) : shiftHue(hsl.h, COOL_HUE, -bright * 0.5 * keep);
  const s = Math.min(1, hsl.s * (1.2 + (0.5 - light) * 0.35));
  const l = Math.min(0.86, Math.max(0.07, hsl.l * (0.36 + light * 0.8) + jitter));
  return out.setHSL(h, s, l, THREE.SRGBColorSpace);
}

/** 非インデックスの形状へ、三角形単位の色を焼き込む（各面の色は1頂点目の色を基準にする） */
export function bakeFacets(geo) {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  const [a, b, c, ab, ac, n, center] = Array.from({ length: 7 }, () => new THREE.Vector3());
  const base = new THREE.Color();
  const out = new THREE.Color();
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const span = Math.max(1e-4, box.max.y - box.min.y);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
    center.copy(a).add(b).add(c).divideScalar(3);
    // 体の軸から外向きにそろえ、左右の面は同じ明るさにする
    if (n.y * center.y + n.z * center.z < 0) n.negate();
    n.z = Math.abs(n.z);
    // 面の向きに体の高さを混ぜ、背は明るく腹は深い色にする
    const height = (center.y - box.min.y) / span;
    const raw = 0.5 + 0.5 * n.dot(LIGHT);
    const light = Math.min(1, Math.max(0, 0.5 + ((raw * 0.6 + height * 0.4) - 0.52) * 2.1));
    base.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    shade(out, base, light, i);
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, out.r, out.g, out.b);
  }
  col.needsUpdate = true;
}

/** 胴体の帯模様。[開始, 終了, 色] の一覧（t: 頭 0 → 尾 1） */
export function bandsFor(c) {
  const m = c.mark;
  if (c.pat === 'clown') {
    return [[0.19, 0.21, RIM], [0.21, 0.28, m], [0.28, 0.3, RIM], [0.51, 0.53, RIM], [0.53, 0.61, m], [0.61, 0.63, RIM], [0.87, 0.89, RIM], [0.89, 0.97, m], [0.97, 1, RIM]];
  }
  if (c.pat === 'mask') return [[0.125, 0.185, m]];
  if (c.pat === 'bands') {
    const n = c.bands ?? 3;
    return Array.from({ length: n }, (_, i) => {
      const start = 0.14 + (i / n) * 0.82;
      return [start, start + (0.82 / n) * 0.44, m];
    });
  }
  return [];
}

/** 胴体を輪切りにする位置。模様の境目に必ず輪が来るようにして、帯の縁をまっすぐ保つ */
export function ringStops(c, gills) {
  const fixed = [...bandsFor(c).flatMap(([a, b]) => [a, b]), ...(gills ? [0.2, 0.22, 0.24, 0.26] : [0.27, 0.295])];
  const base = [0, 0.035, 0.09, 0.16, 0.24, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92, 1];
  const keep = base.filter((t) => t === 0 || t === 1 || !fixed.some((s) => Math.abs(s - t) < 0.022));
  return [...new Set([...keep, ...fixed])].sort((x, y) => x - y);
}
