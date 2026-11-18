import * as THREE from 'three';

/** 漁具の動きに使う共通部品。海面は y=0、海底は y=BED、船首は +X、右舷は +Z */
export const BED = -15;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** p のうち a〜b の区間の進み具合 */
export const span = (p, a, b) => clamp01((p - a) / (b - a));

export const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
const netMat = (color) => new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.6 });

/** fn(u, v) → [x, y, z] で形が変わる網 */
export function makeNet(group, nu, nv, color = 0xf2efe2) {
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const mesh = new THREE.Mesh(geo, netMat(color));
  mesh.frustumCulled = false;
  group.add(mesh);
  const draw = (fn) => {
    const pos = geo.attributes.position;
    for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) pos.setXYZ(k, ...fn(i / nu, j / nv));
    pos.needsUpdate = true;
  };
  draw.mesh = mesh;
  return draw;
}

/** 点列を結ぶ綱 */
export function makeLine(group, color = 0xf4e9c8, count = 32) {
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  line.frustumCulled = false;
  group.add(line);
  return (pts) => {
    pts.slice(0, count).forEach((p, i) => geo.attributes.position.setXYZ(i, p[0], p[1], p[2]));
    geo.setDrawRange(0, Math.min(count, pts.length));
    geo.attributes.position.needsUpdate = true;
  };
}

export function buoy(group, color = 0xf0712c, r = 0.42) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color));
  group.add(m);
  return m;
}

/** 点灯・消灯できるランプ */
export function lamp(group, x, y, z, color = 0xffefb0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

/** 海面を照らす光 */
export function glow(group, x, z, color = 0xffe7a8) {
  const l = new THREE.PointLight(color, 0, 70, 1.3);
  l.position.set(x, 5, z);
  group.add(l);
  return l;
}

export function box(group, w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  group.add(m);
  return m;
}

/** 水しぶきなどの粒 */
export function particles(group, count, color = 0xffffff, size = 0.25) {
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)), new THREE.PointsMaterial({ color, size }));
  pts.frustumCulled = false;
  group.add(pts);
  pts.setAt = (i, x, y, z) => pts.geometry.attributes.position.setXYZ(i, x, y, z);
  pts.flush = () => (pts.geometry.attributes.position.needsUpdate = true);
  return pts;
}

/** 釣れた魚（竿の先などで動かす） */
export function fishMesh(group, color = 0x36506e, len = 1.1) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(len * 0.25, len, 6).rotateZ(Math.PI / 2), mat(color));
  group.add(m);
  return m;
}

/** ダイバー */
export function diver(group) {
  const d = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.3, 3, 8).rotateZ(Math.PI / 2), mat(0x1d2730));
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8).rotateZ(Math.PI / 2), mat(0xf0c23c));
  tank.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(0xe2b48c));
  head.position.x = 1;
  d.add(body, tank, head);
  group.add(d);
  return d;
}
