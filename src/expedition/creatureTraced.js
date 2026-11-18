import * as THREE from 'three';
import { RIM } from './creatureFacet.js';

/** トレースした頂点（creatureAnatomy.js）をそのままつないだ低ポリゴンの魚 */
class Mesh {
  pos = [];
  col = [];

  tri(a, b, c, hex) {
    const k = new THREE.Color(hex);
    for (const p of [a, b, c]) {
      this.pos.push(...p);
      k.toArray(this.col, this.col.length);
    }
  }

  quad(a, b, c, d, hex, flip) {
    if (flip) {
      this.tri(a, c, b, hex);
      this.tri(b, c, d, hex);
    } else {
      this.tri(a, c, d, hex);
      this.tri(a, d, b, hex);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

/** 写真の座標 → モデル座標（吻端が +X、全長 1、体軸を水平に補正） */
const projector = ({ origin: [ox, oy], slope, length }) => ([x, y], z = 0) => {
  const dx = x - ox;
  const dy = y - oy;
  return [0.5 - (dx + dy * slope) / length, -(dy - dx * slope) / length, z];
};

const ROW_DEPTH = [0, 0.78, 1, 0.78, 0]; // 背・腹は薄く、体側の中央が最も厚い

const lerp = (p, q, u) => p + (q - p) * u;

/** 写真上の点 (x, y) における体表の半幅 */
function surfaceDepth(a, [x, y]) {
  const sample = (i) => {
    const st = a.stations[i];
    let r = 0;
    while (r < 3 && y > st[r + 1][1]) r++;
    const u = Math.min(1, Math.max(0, (y - st[r][1]) / Math.max(1e-6, st[r + 1][1] - st[r][1])));
    return { x: lerp(st[r][0], st[r + 1][0], u), z: a.depth[i] * lerp(ROW_DEPTH[r], ROW_DEPTH[r + 1], u) };
  };
  for (let i = 0; i < a.stations.length - 1; i++) {
    const [p, q] = [sample(i), sample(i + 1)];
    if (x <= q.x) return lerp(p.z, q.z, Math.min(1, Math.max(0, (x - p.x) / Math.max(1e-6, q.x - p.x))));
  }
  return 0;
}

function tracedBody(a, c, P) {
  const mesh = new Mesh();
  const hexOf = (i) => (a.paint[i] === 'mark' ? c.mark : c.colors.body);
  for (const s of [-1, 1]) {
    const v = (i, r) => P(a.stations[i][r], s * a.depth[i] * ROW_DEPTH[r]);
    const tip = P(a.snout);
    for (let r = 0; r < 4; r++) mesh.tri(tip, v(0, r), v(0, r + 1), hexOf(0));
    for (let i = 0; i < a.stations.length - 1; i++) for (let r = 0; r < 4; r++) {
      mesh.quad(v(i, r), v(i, r + 1), v(i + 1, r), v(i + 1, r + 1), hexOf(i + 1), (i + r) % 2);
    }
  }
  return mesh.build();
}

/** 2本の点列の間に面を張る */
function band(from, to, hex) {
  const mesh = new Mesh();
  for (let i = 0; i < from.length - 1; i++) mesh.quad(from[i], from[i + 1], to[i], to[i + 1], hex, i % 2);
  return mesh.build();
}

const mix = (p, q, k) => p.map((n, i) => n + (q[i] - n) * k);

function tracedFin(a, f, hex, P, side) {
  if (f.lift) {
    // 一対のひれ：根元は体表へ少し埋めて隙間をなくし、そこから先は体表の外側に沿わせて貫通を防ぐ
    const row = (k) => f.base.map((p, i) => {
      const px = mix(p, f.outer[i], k);
      const z = k === 0 ? surfaceDepth(a, px) * 0.9 : surfaceDepth(a, px) + 0.006 + f.lift * k;
      return P(px, side * z);
    });
    const [root, mid, inner, outer] = [0, 0.5, 1 - f.rim, 1].map(row);
    return [band(root, mid, hex), band(mid, inner, hex), band(inner, outer, RIM)];
  }
  const tipZ = 0;
  const base = f.base.map((p) => P(p, 0));
  const outer = f.outer.map((p) => P(p, tipZ));
  const parts = [];
  if (f.rim) {
    const inner = base.map((p, i) => mix(p, outer[i], 1 - f.rim));
    parts.push(band(base, inner, hex), band(inner, outer, RIM));
  } else parts.push(band(base, outer, hex));
  if (f.clear) {
    const g = band(outer, f.clear.map((p) => P(p, tipZ)), new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.45).getHex());
    g.userData.clear = true;
    parts.push(g);
  }
  return parts;
}

/** 体表に貼る正多角形 */
function disc(mesh, [x, y, z], r, n, hex, side) {
  for (let i = 0; i < n; i++) {
    const at = (k) => {
      const ang = (k / n) * Math.PI * 2;
      return [x + Math.cos(ang) * r, y + Math.sin(ang) * r, z];
    };
    mesh.tri([x, y, z + side * r * 0.25], at(i), at(i + 1), hex);
  }
}

export function tracedParts(c, a) {
  const P = projector(a.photo);
  const parts = [tracedBody(a, c, P)];
  for (const f of a.fins) {
    const hex = f.hex ?? c.colors.fin;
    for (const side of f.lift ? [-1, 1] : [1]) parts.push(...tracedFin(a, f, hex, P, side));
  }
  const face = new Mesh();
  const { eye, mouth } = a;
  for (const s of [-1, 1]) {
    const [x, y] = P(eye.at);
    const z = s * (surfaceDepth(a, eye.at) + 0.003);
    disc(face, [x, y, z], eye.ring, 7, eye.iris, s);
    disc(face, [x, y, z + s * 0.003], eye.pupil, 6, 0x0a0c10, s);
    disc(face, [x + eye.pupil * 0.35, y + eye.pupil * 0.35, z + s * 0.006], eye.pupil * 0.32, 4, 0xffffff, s);
    const [m0, m1] = mouth.map((p) => P(p, s * (surfaceDepth(a, p) + 0.002)));
    face.tri(m0, m1, [m1[0], m1[1] - 0.005, m1[2]], 0x3a1608);
  }
  parts.push(face.build());
  return parts;
}
