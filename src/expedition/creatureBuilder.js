import * as THREE from 'three';

/** 展示生物のローポリモデル。+X が頭、原点が体の中心。頂点カラーで1マテリアルにまとめる */
const noRaycast = () => {};

function paint(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.set(fn(p.getX(i), p.getY(i), p.getZ(i)));
    c.toArray(col, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function fin(points, color) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return paint(new THREE.ShapeGeometry(shape), () => color);
}

function part(root, geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.raycast = noRaycast;
  if (name) root.userData[name] = m;
  root.add(m);
  return m;
}

/** 魚類共通：胴体（長さ L・高さ H・幅 W）、尾びれ、背びれ、尻びれ、目 */
function fishBody(root, mat, c, L, H, W) {
  const { body, belly, fin: finC } = c.colors;
  const bands = c.bands ?? 0;
  const geo = new THREE.SphereGeometry(1, 12, 8);
  geo.rotateZ(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (1 - p.getX(i)) / 2; // 0=頭 1=尾
    const k = 1 - t * t * 0.72;
    p.setXYZ(i, (p.getX(i) * L) / 2, p.getY(i) * k * (H / 2), p.getZ(i) * k * (W / 2));
  }
  paint(geo, (x, y) => {
    if (bands) {
      const u = (x / L + 0.5) * bands;
      if (u - Math.floor(u) < 0.26 && u > 0.5) return c.band;
    }
    return y < -H * 0.14 ? belly : body;
  });
  geo.computeVertexNormals();
  part(root, geo, mat);

  const tailH = Math.max(H, L * 0.2);
  const tail = part(root, fin([[0, 0], [-tailH * 0.75, tailH * 0.55], [-tailH * 0.55, 0], [-tailH * 0.75, -tailH * 0.55]], finC), mat, 'tail');
  tail.position.x = -L * 0.46;
  part(root, fin([[L * 0.2, H * 0.42], [-L * 0.28, H * 0.3], [-L * 0.16, H * 0.72], [L * 0.1, H * 0.74]], finC), mat);
  part(root, fin([[-L * 0.05, -H * 0.42], [-L * 0.3, -H * 0.26], [-L * 0.24, -H * 0.66]], finC), mat);
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(Math.max(H * 0.075, 0.0035), 6, 4);
    eye.translate(L * 0.33, H * 0.1, (s * W) / 2.9);
    part(root, paint(eye, () => 0x10151a), mat);
  }
}

function jelly(root, mat, c, L) {
  const R = L / 2;
  const bell = new THREE.SphereGeometry(R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  bell.scale(1, 0.75, 1);
  paint(bell, (x, y) => (y > R * 0.45 ? c.colors.belly : c.colors.body));
  part(root, bell, mat, 'bell');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.ConeGeometry(R * 0.08, L * 0.9, 3, 1, true);
    t.rotateX(Math.PI);
    t.translate(Math.cos(a) * R * 0.6, -L * 0.45, Math.sin(a) * R * 0.6);
    part(root, paint(t, () => c.colors.fin), mat);
  }
}

function ray(root, mat, c, L) {
  const { body, belly, fin: finC } = c.colors;
  const wing = (s) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([L * 0.32, 0, 0, -L * 0.3, 0, 0, -L * 0.08, 0, s * L * 0.9], 3));
    g.computeVertexNormals();
    return paint(g, (x, y, z) => (Math.abs(z) > L * 0.6 ? finC : body));
  };
  const core = new THREE.SphereGeometry(1, 10, 6);
  core.scale(L * 0.36, L * 0.07, L * 0.17);
  paint(core, (x, y) => (y < 0 ? belly : body));
  part(root, core, mat);
  part(root, wing(1), mat, 'wingL');
  part(root, wing(-1), mat, 'wingR');
  const tail = part(root, fin([[0, L * 0.008], [-L * 0.6, 0], [0, -L * 0.008]], finC), mat, 'tail');
  tail.position.x = -L * 0.3;
}

export function buildCreature(c) {
  const root = new THREE.Group();
  root.userData.creature = c.id;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, side: THREE.DoubleSide });
  const L = c.len;
  if (c.shape === 'jelly') jelly(root, mat, c, L);
  else if (c.shape === 'ray') ray(root, mat, c, L);
  else if (c.shape === 'disc') fishBody(root, mat, c, L, L * 0.78, L * 0.24);
  else if (c.shape === 'long') fishBody(root, mat, c, L, L * 0.14, L * 0.06);
  else fishBody(root, mat, c, L, L * 0.36, L * 0.2);
  return root;
}
