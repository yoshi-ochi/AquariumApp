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

  /** hex は1色、または2枚の三角形それぞれの色 [色1, 色2] */
  quad(a, b, c, d, hex, flip) {
    const [h1, h2] = Array.isArray(hex) ? hex : [hex, hex];
    if (flip) {
      this.tri(a, c, b, h1);
      this.tri(b, c, d, h2);
    } else {
      this.tri(a, c, d, h1);
      this.tri(a, d, b, h2);
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

/** 写真上の点 (x, y) を含む体の三角形から、実際の面の半幅を求める */
function exactDepth(a, [x, y]) {
  const v = (i, r) => [a.stations[i][r][0], a.stations[i][r][1], a.depth[i] * ROW_DEPTH[r]];
  const inTri = (p, q, s) => {
    const det = (q[1] - s[1]) * (p[0] - s[0]) + (s[0] - q[0]) * (p[1] - s[1]);
    if (Math.abs(det) < 1e-9) return null;
    const u = ((q[1] - s[1]) * (x - s[0]) + (s[0] - q[0]) * (y - s[1])) / det;
    const w = ((s[1] - p[1]) * (x - s[0]) + (p[0] - s[0]) * (y - s[1])) / det;
    return u >= -0.001 && w >= -0.001 && u + w <= 1.001 ? u * p[2] + w * q[2] + (1 - u - w) * s[2] : null;
  };
  for (let i = 0; i < a.stations.length - 1; i++) for (let r = 0; r < 4; r++) {
    const [p, q, m, n] = [v(i, r), v(i, r + 1), v(i + 1, r), v(i + 1, r + 1)];
    const tris = (i + r) % 2 ? [[p, m, q], [q, m, n]] : [[p, m, n], [p, n, q]];
    for (const [e, f, g] of tris) {
      const z = inTri(e, f, g);
      if (z !== null) return z;
    }
  }
  return surfaceDepth(a, [x, y]);
}

/** 体表に貼り付けた丸い模様。頂点ごとに実際の面の高さへ合わせるので浮き上がらない */
function flatSpot(mesh, a, P, [x, y], r, n, hex, side) {
  const R = r * a.photo.length;
  const at = (px, py) => P([px, py], side * (exactDepth(a, [px, py]) + 0.0025));
  const center = at(x, y);
  for (let i = 0; i < n; i++) {
    const rim = (k) => {
      const ang = (k / n) * Math.PI * 2;
      return at(x + Math.cos(ang) * R, y + Math.sin(ang) * R);
    };
    mesh.tri(center, rim(i), rim(i + 1), hex);
  }
}

/** 模様を体表の面に埋もれさせない高さ（面の折れ目は推定値より外へ張り出すため余裕を持たせる） */
const aboveSurface = (a, p) => surfaceDepth(a, p) * 1.16 + 0.006;

function tracedBody(a, c, P) {
  const mesh = new Mesh();
  const named = { body: c.colors.body, belly: c.colors.belly, mark: c.mark, fin: c.colors.fin };
  // paint: 列ごとの色、rows: 背から腹へ4段の色（paint が body の区間に適用）
  const hexOf = (i, r) => {
    if (a.cells) return a.cells[i][r]; // 参考画像から採取した色
    const name = a.paint?.[i] ?? 'body';
    if (name === 'saddle') return r < 2 ? c.mark : named[a.rows?.[r] ?? 'body']; // 背側だけの暗色帯
    return named[name === 'body' ? a.rows?.[r] ?? 'body' : name];
  };
  for (const s of [-1, 1]) {
    const v = (i, r) => P(a.stations[i][r], s * a.depth[i] * ROW_DEPTH[r]);
    const tip = P(a.snout);
    for (let r = 0; r < 4; r++) mesh.tri(tip, v(0, r), v(0, r + 1), s < 0 && a.ventral ? a.ventral : hexOf(0, r));
    for (let i = 0; i < a.stations.length - 1; i++) for (let r = 0; r < 4; r++) {
      mesh.quad(v(i, r), v(i, r + 1), v(i + 1, r), v(i + 1, r + 1), s < 0 && a.ventral ? a.ventral : hexOf(i + 1, r), (i + r) % 2);
    }
  }
  return mesh.build();
}

/** 2本の点列の間に面を張る */
function band(from, to, hex) {
  const mesh = new Mesh();
  for (let i = 0; i < from.length - 1; i++) mesh.quad(from[i], from[i + 1], to[i], to[i + 1], Array.isArray(hex) ? hex[i] : hex, i % 2);
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
    if (!f.rim) {
      const [root, mid, outer] = [0, 0.5, 1].map(row);
      return [band(root, mid, hex), band(mid, outer, hex)];
    }
    const [root, mid, inner, outer] = [0, 0.5, 1 - f.rim, 1].map(row);
    return [band(root, mid, hex), band(mid, inner, hex), band(inner, outer, RIM)];
  }
  const tipZ = 0;
  const base = f.base.map((p) => P(p, 0));
  const outer = f.outer.map((p) => P(p, tipZ));
  const parts = [];
  if (f.rim) {
    const inner = base.map((p, i) => mix(p, outer[i], 1 - f.rim));
    parts.push(band(base, inner, hex), band(inner, outer, f.rimHex ?? RIM));
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
    mesh.tri([x, y, z + side * r * 0.04], at(i), at(i + 1), hex);
  }
}

/** 棘や鰭条を1本ずつ作る。根元から先へ細くなり、colors を交互に塗って縞にする */
function tracedRay(mesh, a, r, P, side) {
  const [p0, p1, p2] = r.pts;
  const at = (u) => [0, 1].map((k) => (1 - u) ** 2 * p0[k] + 2 * u * (1 - u) * p1[k] + u * u * p2[k]);
  const root = r.lift ? surfaceDepth(a, p0) * 0.9 : 0;
  const edge = (u) => {
    const [x, y] = at(u);
    const [x2, y2] = at(Math.min(1, u + 0.02));
    const [x1, y1] = at(Math.max(0, u - 0.02));
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const hw = (r.w / 2) * (1 - 0.72 * u);
    const nx = (-(y2 - y1) / len) * hw;
    const ny = ((x2 - x1) / len) * hw;
    const z = r.lift ? side * (root + (r.lift + 0.02) * Math.min(1, u * 2.5)) : 0;
    return [P([x + nx, y + ny], z), P([x - nx, y - ny], z)];
  };
  for (let i = 0; i < r.n; i++) {
    const [l0, r0] = edge(i / r.n);
    const [l1, r1] = edge((i + 1) / r.n);
    mesh.quad(l0, r0, l1, r1, r.colors[i % r.colors.length], i % 2);
  }
}

/** 体表に重ねる模様の帯（点列 a と b の間） */
function tracedDecal(mesh, a, d, P, side) {
  const at = (p) => P(p, side * aboveSurface(a, p));
  for (let i = 0; i < d.a.length - 1; i++) mesh.quad(at(d.a[i]), at(d.b[i]), at(d.a[i + 1]), at(d.b[i + 1]), d.hex, i % 2);
}

export function tracedParts(c, a) {
  const P = projector(a.photo);
  const parts = [tracedBody(a, c, P)];
  for (const f of a.fins) {
    const hex = f.cols ?? f.hex ?? c.colors.fin;
    for (const side of f.lift ? [-1, 1] : [1]) parts.push(...tracedFin(a, f, hex, P, side));
  }
  const face = new Mesh();
  for (const r of a.rays ?? []) for (const s of r.lift && !r.up ? [-1, 1] : [1]) tracedRay(face, a, r, P, s);
  for (const d of a.decals ?? []) for (const s of [-1, 1]) tracedDecal(face, a, d, P, s);
  const { eye, mouth } = a;
  // 上面図の種は目や模様を背側だけに付ける
  for (const s of a.topView ? [1] : [-1, 1]) {
    const [x, y] = P(eye.at);
    const z = s * aboveSurface(a, eye.at);
    disc(face, [x, y, z], eye.ring, 7, eye.iris, s);
    // 虹彩の中心の盛り上がりより手前に瞳と光を重ねる
    const lift = eye.ring * 0.04 + 0.002;
    disc(face, [x, y, z + s * lift], eye.pupil, 6, 0x0a0c10, s);
    disc(face, [x + eye.pupil * 0.35, y + eye.pupil * 0.35, z + s * (lift + eye.pupil * 0.04 + 0.002)], eye.pupil * 0.32, 4, 0xffffff, s);
    const [m0, m1] = mouth.map((p) => P(p, s * aboveSurface(a, p)));
    face.tri(m0, m1, [m1[0], m1[1] - 0.005, m1[2]], 0x3a1608);
    // 体側の縦縞
    for (const line of a.lines ?? []) {
      for (let i = 0; i < line.length - 1; i++) {
        const at = (p, dy) => {
          const q = P(p, s * aboveSurface(a, p));
          return [q[0], q[1] + dy, q[2]];
        };
        const hw = a.lineWidth ?? 0.004;
        face.quad(at(line[i], hw), at(line[i], -hw), at(line[i + 1], hw), at(line[i + 1], -hw), a.lineHex ?? c.mark, i % 2);
      }
    }
    for (const m of a.minis ?? []) flatSpot(face, a, P, m, m[2], 7, m[3], s);
    for (const d of a.dots ?? []) {
      if (a.flatDots) {
        flatSpot(face, a, P, d, a.dotR, a.dotR < 0.025 ? 6 : 9, a.dotHex, s);
        continue;
      }
      const [dx, dy] = P(d);
      disc(face, [dx, dy, s * aboveSurface(a, d)], a.dotR ?? 0.007, a.dotR ? 6 : 4, a.dotHex ?? c.mark, s);
    }
  }
  parts.push(face.build());
  // 上面図から作った種は、画像の面を背側へ向ける
  if (a.topView) parts.forEach((g) => g.rotateX(-Math.PI / 2));
  return parts;
}
