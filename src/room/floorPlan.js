import { ATRIUM_VOID, CELL_SIZE, GRID_X, GRID_Z, LAYOUT, ZONES, ZONE_TYPE, inRect, zoneHas } from '../building/blueprint.js';

/**
 * 建物の1フロア分のマス目。形は設計図（blueprint.js）で決まり、解放済みのエリアだけ使える。
 * NONE = 建物の外、FLOOR = 展示フロア、YARD = バックヤード、LOCKED = 未解放、VOID = 吹き抜け
 */
export const CELL = Object.freeze({ NONE: 0, FLOOR: 1, YARD: 2, LOCKED: 3, VOID: 4 });

const OPEN = (t) => t === CELL.FLOOR || t === CELL.YARD;

export class FloorPlan {
  constructor(floor, unlocked) {
    this.floor = floor;
    this.cell = CELL_SIZE;
    this.GX = GRID_X;
    this.GZ = GRID_Z;
    this.active = new Uint8Array(this.GX * this.GZ);
    this.signature = `${LAYOUT.id}:${floor}:${[...unlocked].sort().join(',')}`;
    this.zoneIds = new Int8Array(this.GX * this.GZ).fill(-1);
    ZONES.forEach((zone, n) => {
      if (zone.floor !== floor || zone.type === ZONE_TYPE.OUTDOOR) return;
      const type = !unlocked.has(zone.id) ? CELL.LOCKED : zone.type === ZONE_TYPE.YARD ? CELL.YARD : CELL.FLOOR;
      for (const rect of zone.rects) this._fill(rect, type);
      for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) if (zoneHas(zone, i, j)) this.zoneIds[this.idx(i, j)] = n;
    });
    if (floor === ATRIUM_VOID.floor) this._fill(ATRIUM_VOID.rect, unlocked.has(ATRIUM_VOID.zone) ? CELL.VOID : CELL.LOCKED);
    this.doors = this._findDoors();
  }

  _zoneAt(i, j) {
    return i >= 0 && j >= 0 && i < this.GX && j < this.GZ ? this.zoneIds[this.idx(i, j)] : -1;
  }

  _edge(i0, j0, i1, j1) {
    const a = this.idx(i0, j0);
    const b = this.idx(i1, j1);
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /** 順路でつながるエリアの境に、幅4マスの出入口をあける */
  _findDoors() {
    const doors = new Set();
    for (const [a, b] of LAYOUT.links) {
      const na = ZONES.findIndex((z) => z.id === a);
      const nb = ZONES.findIndex((z) => z.id === b);
      if (ZONES[na].floor !== this.floor || ZONES[nb].floor !== this.floor) continue;
      const lines = new Map();
      for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) {
        for (const [di, dj, axis] of [[1, 0, 'v'], [0, 1, 'h']]) {
          const p = this._zoneAt(i, j);
          const q = this._zoneAt(i + di, j + dj);
          if (!((p === na && q === nb) || (p === nb && q === na))) continue;
          const key = axis === 'v' ? `v${i}` : `h${j}`;
          if (!lines.has(key)) lines.set(key, []);
          lines.get(key).push(this._edge(i, j, i + di, j + dj));
        }
      }
      const best = [...lines.values()].sort((x, y) => y.length - x.length)[0] ?? [];
      const start = Math.max(0, Math.floor(best.length / 2) - 2);
      best.slice(start, start + 4).forEach((e) => doors.add(e));
    }
    return doors;
  }

  /** 隣のマスへ歩いて移動できるか（部屋の壁は出入口だけ通れる） */
  passable(i0, j0, i1, j1) {
    const p = this._zoneAt(i0, j0);
    const q = this._zoneAt(i1, j1);
    return p === q || this.doors.has(this._edge(i0, j0, i1, j1));
  }

  _fill(rect, type) {
    for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) if (inRect(rect, i, j)) this.active[this.idx(i, j)] = type;
  }

  idx(i, j) {
    return j * this.GX + i;
  }

  at(i, j) {
    return i >= 0 && j >= 0 && i < this.GX && j < this.GZ ? this.active[this.idx(i, j)] : 0;
  }

  cellOf(x, z) {
    return [Math.floor(x / this.cell + this.GX / 2), Math.floor(z / this.cell + this.GZ / 2)];
  }

  cellMin(i, j) {
    return [(i - this.GX / 2) * this.cell, (j - this.GZ / 2) * this.cell];
  }

  /** 使える床の上か */
  containsPoint(x, z) {
    const [i, j] = this.cellOf(x, z);
    return OPEN(this.at(i, j));
  }

  typeAt(x, z) {
    const [i, j] = this.cellOf(x, z);
    return this.at(i, j);
  }

  /** 軸平行の矩形がすべて使える床の上にあり、展示フロアとバックヤードをまたがないか */
  containsRect(cx, cz, hx, hz) {
    const e = 1e-4;
    const step = this.cell * 0.5;
    const xs = [];
    for (let x = cx - hx + e; x < cx + hx - e; x += step) xs.push(x);
    xs.push(cx + hx - e);
    const zs = [];
    for (let z = cz - hz + e; z < cz + hz - e; z += step) zs.push(z);
    zs.push(cz + hz - e);
    let type = null;
    let room = null;
    for (const x of xs) for (const z of zs) {
      const [i, j] = this.cellOf(x, z);
      const t = this.at(i, j);
      const n = this._zoneAt(i, j);
      if (!OPEN(t) || (type !== null && (t !== type || n !== room))) return false;
      type = t;
      room = n;
    }
    return true;
  }

  rectOverlapsCell(cx, cz, hx, hz, i, j) {
    const [x0, z0] = this.cellMin(i, j);
    return cx + hx > x0 && cx - hx < x0 + this.cell && cz + hz > z0 && cz - hz < z0 + this.cell;
  }

  /**
   * 壁のラン。{ key, kind, side, axis, line, from, to, normal:[nx,nz] }
   * kind: exterior 外壁 / partition 展示とバックヤードの仕切り / room 展示室の間の壁 / shutter 未解放エリアとの境 / rail 吹き抜けの手すり
   */
  runs() {
    const c = this.cell;
    const runs = [];
    const classify = (a, b, i0, j0, i1, j1) => {
      if (a === b) {
        if (a !== CELL.FLOOR || this.passable(i0, j0, i1, j1)) return null;
        return { kind: 'room', n: 1, side: CELL.FLOOR };
      }
      if (a === CELL.VOID || b === CELL.VOID) {
        if (!OPEN(a) && !OPEN(b)) return { kind: 'shutter', n: a === CELL.VOID ? 1 : -1, side: CELL.LOCKED };
        return { kind: 'rail', n: OPEN(b) ? 1 : -1, side: CELL.FLOOR };
      }
      if (a === CELL.LOCKED && OPEN(b)) return { kind: 'shutter', n: 1, side: b };
      if (b === CELL.LOCKED && OPEN(a)) return { kind: 'shutter', n: -1, side: a };
      if (!a || !b) return { kind: 'exterior', n: b ? 1 : -1, side: a || b };
      return { kind: 'partition', n: b === CELL.FLOOR ? 1 : -1, side: CELL.FLOOR };
    };
    const push = (axis, lineIdx, cls, a0, a1) => {
      const halfLine = (axis === 'x' ? this.GZ : this.GX) / 2;
      const halfAlong = (axis === 'x' ? this.GX : this.GZ) / 2;
      runs.push({
        key: `${axis}:${lineIdx}:${cls.n}:${cls.kind}`,
        kind: cls.kind,
        side: cls.side,
        axis,
        line: (lineIdx - halfLine) * c,
        from: (a0 - halfAlong) * c,
        to: (a1 - halfAlong) * c,
        normal: axis === 'x' ? [0, cls.n] : [cls.n, 0],
      });
    };
    const same = (p, q) => p && q && p.kind === q.kind && p.n === q.n && p.side === q.side;
    const scan = (axis, lines, len, posA, posB) => {
      for (let l = 0; l <= lines; l++) {
        let cur = null;
        let start = 0;
        for (let s = 0; s <= len; s++) {
          const [i0, j0] = posA(s, l);
          const [i1, j1] = posB(s, l);
          const cls = s < len ? classify(this.at(i0, j0), this.at(i1, j1), i0, j0, i1, j1) : null;
          if (cur && same(cur, cls)) continue;
          if (cur) push(axis, l, cur, start, s);
          cur = cls;
          start = s;
        }
      }
    };
    scan('x', this.GZ, this.GX, (s, l) => [s, l - 1], (s, l) => [s, l]); // z = 一定 の線
    scan('z', this.GX, this.GZ, (s, l) => [l - 1, s], (s, l) => [l, s]); // x = 一定 の線
    return runs;
  }

  /** 床の外接矩形。type を渡すとその種類だけ */
  bounds(type = null) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let j = 0; j < this.GZ; j++) for (let i = 0; i < this.GX; i++) {
      const t = this.at(i, j);
      if (!t || (type && t !== type)) continue;
      const [x, z] = this.cellMin(i, j);
      x0 = Math.min(x0, x); z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + this.cell); z1 = Math.max(z1, z + this.cell);
    }
    if (x0 === Infinity) return this.bounds();
    return { x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }
}
