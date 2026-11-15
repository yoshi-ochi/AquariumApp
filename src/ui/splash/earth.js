import * as THREE from 'three';
import { lowPolyMaterial, hash3 } from './lowpoly.js';

/**
 * ローポリの地球。大陸は (緯度, 経度, 角度半径[rad]) の円を重ねた簡略形で、
 * 縁をノイズで崩して海岸線にする。陸は少し盛り上げ、極は氷で覆う。
 */
const LAND = [
  // 北アメリカ・グリーンランド
  [50, -100, 0.42], [38, -95, 0.33], [60, -118, 0.32], [64, -150, 0.22], [22, -102, 0.16], [15, -90, 0.08], [55, -75, 0.22], [72, -42, 0.24],
  // 南アメリカ
  [-8, -60, 0.36], [-25, -60, 0.28], [-40, -68, 0.15], [-52, -71, 0.08], [5, -68, 0.2],
  // ヨーロッパ
  [50, 12, 0.2], [60, 22, 0.17], [42, 0, 0.1], [42, 23, 0.08], [64, 14, 0.1],
  // アフリカ
  [10, 20, 0.42], [-12, 25, 0.3], [-26, 25, 0.2], [24, 12, 0.36], [26, 32, 0.2], [8, 40, 0.14],
  // アジア
  [52, 90, 0.45], [62, 110, 0.42], [35, 105, 0.33], [45, 62, 0.3], [24, 45, 0.2], [22, 79, 0.2], [14, 103, 0.13], [66, 140, 0.32], [68, 75, 0.3],
  // オーストラリア
  [-25, 134, 0.3], [-17, 128, 0.12], [-32, 145, 0.12],
  // 島々
  [36, 138, 0.06], [43, 142, 0.04], [54, -2, 0.06], [-19, 47, 0.06], [-42, 173, 0.05], [-2, 113, 0.07], [-5, 141, 0.07], [12, 122, 0.04], [65, -18, 0.04],
  // 南の島3つ（南太平洋）
  [-15, -150, 0.04], [-21, -175, 0.035], [-27, -128, 0.03],
].map(([lat, lon, r]) => ({ dir: dirFromLatLon(lat, lon), r }));

function dirFromLatLon(lat, lon) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

function wobble(n) {
  return 0.5 * Math.sin(n.x * 9.1 + 1.3) * Math.cos(n.z * 7.7 - 0.4) + 0.5 * Math.sin(n.y * 11.3 + n.x * 5.1);
}

/** >0 なら陸（値が大きいほど内陸） */
function landValue(n) {
  const wb = wobble(n);
  let v = -1;
  for (const b of LAND) {
    const ang = Math.acos(THREE.MathUtils.clamp(n.dot(b.dir), -1, 1));
    v = Math.max(v, 1 - ang / (b.r * (1 + 0.3 * wb)));
  }
  return v;
}

const isIce = (n) => Math.abs(n.y) > 0.86 + wobble(n) * 0.04;

const COL = {
  deep: new THREE.Color(0.05, 0.24, 0.55),
  ocean: new THREE.Color(0.08, 0.36, 0.68),
  shallow: new THREE.Color(0.2, 0.62, 0.78),
  sand: new THREE.Color(0.92, 0.84, 0.6),
  jungle: new THREE.Color(0.13, 0.48, 0.2),
  grass: new THREE.Color(0.36, 0.62, 0.28),
  desert: new THREE.Color(0.86, 0.7, 0.42),
  tundra: new THREE.Color(0.48, 0.55, 0.45),
  rock: new THREE.Color(0.5, 0.45, 0.4),
  ice: new THREE.Color(0.94, 0.97, 1),
};

function surfaceColor(n, seed) {
  if (isIce(n)) return COL.ice;
  const lv = landValue(n);
  const lat = Math.abs(THREE.MathUtils.radToDeg(Math.asin(n.y)));
  if (lv > 0) {
    if (lv < 0.1) return COL.sand;
    if (lv > 0.55 && hash3(seed, 1, 2) > 0.6) return COL.rock;
    if (lat > 58) return COL.tundra;
    if (lat < 12) return COL.jungle;
    if (lat > 15 && lat < 33 && lv > 0.2) return COL.desert;
    return hash3(seed, 3, 4) > 0.7 ? COL.jungle : COL.grass;
  }
  if (lv > -0.2) return COL.shallow;
  // 深さは滑らかなノイズで（面ごとのランダムだとざらつく）
  const depth = 0.5 + 0.5 * Math.sin(n.x * 4.3 + 0.7) * Math.cos(n.y * 3.1 - n.z * 2.2);
  return COL.ocean.clone().lerp(COL.deep, depth);
}

function buildSurface(R) {
  const geo = new THREE.IcosahedronGeometry(1, 14); // 非インデックス（面ごとに頂点を持つ）
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  // 頂点の高さ（同じ位置の頂点は同じ値になるので面は割れない）
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lv = landValue(v);
    let h = 0;
    if (lv > 0) h = 0.012 + lv * 0.03 + Math.max(0, Math.sin(v.x * 23) * Math.cos(v.z * 19)) * 0.03 * lv;
    if (isIce(v)) h = Math.max(h, 0.014);
    v.multiplyScalar(R * (1 + h));
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // 面ごとの色（重心の向きで判定）
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    c.fromBufferAttribute(pos, f + 2);
    const n = a.add(b).add(c).normalize();
    const col = surfaceColor(n, f).clone().offsetHSL(0, 0, (hash3(f, 7, 8) - 0.5) * 0.04);
    for (let k = 0; k < 3; k++) col.toArray(colors, (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, lowPolyMaterial({ side: THREE.FrontSide }));
}

function buildClouds(R, count = 16) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.88, roughness: 1 });
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Group();
    const n = 2 + Math.floor(hash3(i, 1, 1) * 3);
    for (let k = 0; k < n; k++) {
      const s = R * (0.035 + hash3(i, k, 2) * 0.035);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
      m.position.set((k - n / 2) * s * 1.2, 0, (hash3(i, k, 3) - 0.5) * s);
      m.scale.y = 0.55;
      puff.add(m);
    }
    // 極付近を避けて散らす
    v.set(hash3(i, 4, 4) - 0.5, (hash3(i, 5, 5) - 0.5) * 1.3, hash3(i, 6, 6) - 0.5).normalize();
    puff.position.copy(v).multiplyScalar(R * 1.08);
    puff.lookAt(0, 0, 0);
    puff.rotateX(Math.PI / 2);
    group.add(puff);
  }
  return group;
}

/** 縁ほど明るくなる大気のグロー（フレネル） */
function buildAtmosphere(R) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.14, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x5fb8ff) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(clamp(0.75 + dot(vNormal, vView), 0.0, 1.0), 4.0);
          gl_FragColor = vec4(uColor, rim * 0.9);
        }`,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/** 地球一式。surface と clouds を個別に回転できるよう返す */
export function buildEarth(R) {
  const group = new THREE.Group();
  const surface = buildSurface(R);
  const clouds = buildClouds(R);
  group.add(surface, clouds, buildAtmosphere(R));
  return { group, surface, clouds };
}
