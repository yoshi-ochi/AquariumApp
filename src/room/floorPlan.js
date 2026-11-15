/**
 * マス目の床形状。ステージの面積（cellsX×cellsZ マス）は変えずに形だけ編集できる。
 * マスの種類：0 = なし、1 = 館内（展示フロア）、2 = バックヤード（飼育員エリア）
 * 外周には外壁、館内とバックヤードの境には仕切り壁（水槽を埋め込める壁）ができる。
 */
export const CELL = Object.freeze({ NONE: 0, FLOOR: 1, YARD: 2 });

export class FloorPlan {
  constructor(stage, saved = null) {
    this.cols = stage.cellsX;
    this.rows = stage.cellsZ;
    this.cell = stage.width / stage.cellsX;
    const mx = Math.ceil(this.cols * 0.25);
    const mz = Math.ceil(this.rows * 0.25);
    this.GX = this.cols + mx * 2;
    this.GZ = this.rows + mz * 2;
    this.quota = this.cols * this.rows;
    this.active = new Uint8Array(this.GX * this.GZ);

    const yard = saved?.yard ?? [];
    const valid =
      saved && saved.GX === this.GX && saved.GZ === this.GZ && Array.isArray(saved.cells) && saved.cells.length + yard.length === this.quota;
    if (valid) {
      for (const k of saved.cells) if (k >= 0 && k < this.active.length) this.active[k] = CELL.FLOOR;
      for (const k of yard) if (k >= 0 && k < this.active.length) this.active[k] = CELL.YARD;
    } else {
      // 初期形状：長方形。奥（-Z 側）の数列をバックヤードに
      const yardRows = Math.max(1, Math.round(this.rows * 0.25));
      for (let j = mz; j < mz + this.rows; j++) {
        for (let i = mx; i < mx + this.cols; i++) this.active[this.idx(i, j)] = j < mz + yardRows ? CELL.YARD : CELL.FLOOR;
      }
    }
  }

  idx(i, j) {
    return j * this.GX + i;
  }

  at(i, j) {
    return i >= 0 && j >= 0 && i < this.GX && j < this.GZ ? this.active[this.idx(i, j)] : 0;
  }

  get count() {
    let n = 0;
    for (const v of this.active) if (v) n++;
    return n;
  }

  get remaining() {
    return this.quota - this.count;
  }

  cellOf(x, z) {
    return [Math.floor(x / this.cell + this.GX / 2), Math.floor(z / this.cell + this.GZ / 2)];
  }

  cellMin(i, j) {
    return [(i - this.GX / 2) * this.cell, (j - this.GZ / 2) * this.cell];
  }

  /** 館内・バックヤードのどちらかのマスの上か */
  containsPoint(x, z) {
    const [i, j] = this.cellOf(x, z);
    return !!this.at(i, j);
  }

  /** 軸平行の矩形（中心・半径）がすべて床の上にあり、館内とバックヤードをまたがないか */
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
    for (const x of xs) for (const z of zs) {
      const [i, j] = this.cellOf(x, z);
      const t = this.at(i, j);
      if (!t || (type !== null && t !== type)) return false;
      type = t;
    }
    return true;
  }

  rectOverlapsCell(cx, cz, hx, hz, i, j) {
    const [x0, z0] = this.cellMin(i, j);
    return cx + hx > x0 && cx - hx < x0 + this.cell && cz + hz > z0 && cz - hz < z0 + this.cell;
  }

  /** マスを指定の種類にする（面積の上限・下限を守る） */
  setCell(i, j, type) {
    if (i < 0 || j < 0 || i >= this.GX || j >= this.GZ) return { ok: false };
    const k = this.idx(i, j);
    const cur = this.active[k];
    if (cur === type) return { ok: false };
    if (!cur && this.remaining <= 0) return { ok: false, reason: '面積の上限です。先に別のマスを消してください' };
    if (!type && this.count <= 1) return { ok: false, reason: 'これ以上減らせません' };
    this.active[k] = type;
    return { ok: true };
  }

  /**
   * 壁のラン。{ key, kind, side, axis, line, from, to, normal:[nx,nz] }
   *   kind='exterior'  : 外壁。normal は建物の内側向き、side は内側のマス種類
   *   kind='partition' : 館内とバックヤードの仕切り。normal は館内側向き
   */
  runs() {
    const c = this.cell;
    const runs = [];
    const classify = (a, b) => {
      if (a === b) return null;
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
    const scan = (axis, lines, len, cellA, cellB) => {
      for (let l = 0; l <= lines; l++) {
        let cur = null;
        let start = 0;
        for (let s = 0; s <= len; s++) {
          const cls = s < len ? classify(cellA(s, l), cellB(s, l)) : null;
          if (cur && same(cur, cls)) continue;
          if (cur) push(axis, l, cur, start, s);
          cur = cls;
          start = s;
        }
      }
    };
    scan('x', this.GZ, this.GX, (s, l) => this.at(s, l - 1), (s, l) => this.at(s, l)); // z = 一定 の線
    scan('z', this.GX, this.GZ, (s, l) => this.at(l - 1, s), (s, l) => this.at(l, s)); // x = 一定 の線
    return runs;
  }

  /** 床（館内＋バックヤード）の外接矩形。type を渡すとその種類だけ */
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

  toJSON() {
    const cells = [];
    const yard = [];
    this.active.forEach((v, k) => (v === CELL.FLOOR ? cells : v === CELL.YARD ? yard : null)?.push(k));
    return { GX: this.GX, GZ: this.GZ, cells, yard };
  }
}
