import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * パーツ（ノード）単位で編集できるサンゴの共通部品。
 * growth.nodes = [{ a:[x,y,z] 付け根, b:[x,y,z] 先端/向き, r 太さ, p 親index(-1=根元) }]
 * 1メッシュに結合し、三角形→ノードの対応（faceNode）を持たせてタップしたパーツを特定する。
 */

export const UP = new THREE.Vector3(0, 1, 0);
export const C = (hex) => new THREE.Color(hex);
export const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

export class ModParts {
  constructor() {
    this.list = [];
    this.faceNode = [];
  }

  /** geo を行列 m で置く。color は Color か、geo が color 属性を持つなら null */
  add(geo, color, node, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.normal) g.deleteAttribute('normal');
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    if (color) {
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) color.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    for (let i = 0; i < n / 3; i++) this.faceNode.push(node);
    this.list.push(g);
  }

  /** +Y 長さ1の部品を a→b に伸ばして置く */
  seg(geo, color, node, a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(1e-4, d.length());
    _q.setFromUnitVectors(UP, d.divideScalar(len));
    this.add(geo, color, node, _m.compose(a, _q, _s.set(1, len, 1)));
  }

  /** 部品を pos に置き +Y を dir に向け、scale 倍 */
  at(geo, color, node, pos, dir = UP, scale = 1) {
    _q.setFromUnitVectors(UP, dir.clone().normalize());
    const sv = typeof scale === 'number' ? _s.setScalar(scale) : _s.copy(scale);
    this.add(geo, color, node, _m.compose(pos, _q, sv));
  }

  mesh({ roughness = 0.65, flat = true } = {}) {
    const geo = mergeGeometries(this.list, false);
    this.list.forEach((g) => g.dispose());
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    m.userData.faceNode = Uint16Array.from(this.faceNode);
    return m;
  }
}

/** 高さ1の円柱（付け根 rb・先端 rt、上下ふたなし） */
export const unitCyl = (rb, rt, seg = 5) => {
  const g = new THREE.CylinderGeometry(rt, rb, 1, seg, 1, true);
  g.translate(0, 0.5, 0);
  return g;
};

/** 子を持たないノード（枝先） */
export function leafSet(nodes) {
  const has = new Set(nodes.map((n) => n.p));
  return nodes.map((_, i) => !has.has(i));
}

/** 子孫（自分を含む）の index */
export function subtree(nodes, idx) {
  const out = new Set([idx]);
  let grew = true;
  while (grew) {
    grew = false;
    nodes.forEach((n, i) => {
      if (!out.has(i) && out.has(n.p)) {
        out.add(i);
        grew = true;
      }
    });
  }
  return out;
}

/** idx 以下を削除して親 index を詰め直す */
export function removeSubtree(nodes, idx) {
  const del = subtree(nodes, idx);
  const map = new Map();
  const kept = [];
  nodes.forEach((n, i) => {
    if (del.has(i)) return;
    map.set(i, kept.length);
    kept.push(n);
  });
  return kept.map((n) => ({ ...n, p: n.p < 0 ? -1 : map.get(n.p) ?? -1 }));
}

/** 方向 dir を軸 axis 回りに ang 回す */
export const turn = (dir, axis, ang) => dir.clone().applyAxisAngle(axis.clone().normalize(), ang);

export const node = (a, b, r, p) => ({ a: a.toArray(), b: b.toArray(), r, p });
