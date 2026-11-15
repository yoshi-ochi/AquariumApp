import * as THREE from 'three';

/**
 * ローポリ用のヘルパー。
 * flatShading + 面ごとの頂点カラーで、カクカクした面の陰影を出す。
 */

export function lowPolyMaterial(options = {}) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
    ...options,
  });
}

/**
 * 断面が楕円の胴体（尾 t=0 → 頭 t=1、+x 方向）。
 * profile(t) → { ry, rz, cy }（ワールド単位）、color(t, ny, nz, i, j) → THREE.Color（面ごと）
 */
export function tubeGeometry({ profile, color, length, segments, radial, from = 0, to = 1, offsetX = 0, capStart = false, capEnd = false }) {
  const rings = [];
  const ts = [];
  for (let i = 0; i <= segments; i++) {
    const t = from + ((to - from) * i) / segments;
    const p = profile(t);
    const ring = [];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      ring.push(new THREE.Vector3(t * length + offsetX, p.cy + p.ry * Math.cos(a), p.rz * Math.sin(a)));
    }
    rings.push(ring);
    ts.push(t);
  }

  const pos = [];
  const col = [];
  const tri = (a, b, c, color) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
  };

  for (let i = 0; i < segments; i++) {
    const tm = (ts[i] + ts[i + 1]) / 2;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const am = ((j + 0.5) / radial) * Math.PI * 2;
      const c = color(tm, Math.cos(am), Math.sin(am), i, j);
      tri(rings[i][j], rings[i][j1], rings[i + 1][j], c);
      tri(rings[i][j1], rings[i + 1][j1], rings[i + 1][j], c);
    }
  }

  const cap = (ring, t, tipX) => {
    const p = profile(t);
    const tip = new THREE.Vector3(tipX, p.cy, 0);
    for (let j = 0; j < radial; j++) {
      const am = ((j + 0.5) / radial) * Math.PI * 2;
      tri(ring[j], ring[(j + 1) % radial], tip, color(t, Math.cos(am), Math.sin(am), -1, j));
    }
  };
  if (capStart) cap(rings[0], from, from * length + offsetX - length * 0.01);
  if (capEnd) cap(rings[segments], to, to * length + offsetX + length * 0.015);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/** 2D 輪郭（XY 平面）を薄く押し出したヒレ */
export function finMesh(points, thickness, color) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, side: THREE.DoubleSide }),
  );
}

/** 指定した基底（ローカル X→xAxis, Y→yAxis）にメッシュを向ける */
export function orient(mesh, xAxis, yAxis) {
  const X = new THREE.Vector3(...xAxis).normalize();
  const Y = new THREE.Vector3(...yAxis);
  Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  return mesh;
}

/** 座標から決まる擬似乱数 [0,1) */
export function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export function shade(color, seed, amount = 0.05) {
  return color.clone().offsetHSL(0, 0, (hash3(seed, seed * 1.7, 3.1) - 0.5) * amount);
}
