/**
 * 世界地図（メルカトル図法の Canvas）。ドラッグで移動、ピンチ・ホイールで拡大縮小、タップでピン選択。
 * 地形データは Natural Earth（world-atlas）。初回に開くときだけ読み込む。
 */
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const toWorld = (lat, lon) => ({
  x: (lon + 180) / 360,
  y: 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamp(lat, -85, 85) * RAD) / 2)) / (2 * Math.PI),
});
export const toLatLon = (x, y) => ({
  lat: (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / RAD,
  lon: x * 360 - 180,
});

const PIN = { dest: '#ff9f2e', done: '#ef3b3b', locked: '#8796a3', ally: '#35c98b', friend: '#58b7ff', me: '#ffd36b', joint: '#c98bff' };
const TAP_PX = 8;

async function loadLand() {
  const [{ feature }, topo] = await Promise.all([import('topojson-client'), import('world-atlas/land-50m.json')]);
  const land = feature(topo.default, topo.default.objects.land);
  const fill = new Path2D();
  const coast = new Path2D();
  const polys = land.features ? land.features.flatMap((f) => geomPolys(f.geometry)) : geomPolys(land.geometry);
  for (const poly of polys) for (const ring of poly) addRing(fill, coast, ring);
  return { fill, coast };
}

/** 日付変更線をまたぐ輪を連続した経度に直し、左右の世界にも複製して描く */
function addRing(fill, coast, ring) {
  let shift = 0;
  let prev = ring[0][0];
  const pts = ring.map(([lon, lat]) => {
    if (lon - prev > 180) shift -= 360;
    else if (prev - lon > 180) shift += 360;
    prev = lon;
    return toWorld(lat, lon + shift);
  });
  const xs = pts.map((p) => p.x);
  const wraps = shift !== 0; // 極を囲む輪（南極大陸）
  const offsets = Math.min(...xs) < 0 || Math.max(...xs) > 1 ? [-1, 0, 1] : [0];
  for (const dx of offsets) {
    pts.forEach((p, i) => {
      for (const path of [fill, coast]) {
        if (i) path.lineTo(p.x + dx, p.y);
        else path.moveTo(p.x + dx, p.y);
      }
    });
    if (wraps) {
      const bottom = toWorld(-85, 0).y;
      fill.lineTo(pts[pts.length - 1].x + dx, bottom);
      fill.lineTo(pts[0].x + dx, bottom);
    }
    fill.closePath();
  }
}
const geomPolys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

export class WorldMap {
  constructor({ canvas, onPin, onPoint }) {
    Object.assign(this, { canvas, onPin, onPoint });
    this.ctx = canvas.getContext('2d');
    this.pins = [];
    this.land = null;
    this.view = { x: 0.5, y: 0.5, s: 400 };
    this.pointers = new Map();
    this._queued = false;
    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
  }

  async ensureLand() {
    this.land ??= await loadLand();
    this.draw();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    if (!this._framed && r.width) {
      this._framed = true;
      this.showJapan();
    }
    this.draw();
  }

  /** 緯度経度の範囲が画面に収まるように表示する */
  fit(lat0, lat1, lon0, lon1) {
    const a = toWorld(lat1, lon0);
    const b = toWorld(lat0, lon1);
    this.view = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, s: Math.min(this.w / (b.x - a.x), this.h / (b.y - a.y)) };
    this.draw();
  }

  showJapan() {
    this.fit(24, 46, 124, 149);
  }

  showWorld() {
    this.fit(-60, 75, -180, 180);
  }

  setPins(pins) {
    this.pins = pins;
    this.draw();
  }

  _screen(lat, lon) {
    const p = toWorld(lat, lon);
    return { x: (p.x - this.view.x) * this.view.s + this.w / 2, y: (p.y - this.view.y) * this.view.s + this.h / 2 };
  }

  _zoomAt(sx, sy, k) {
    const v = this.view;
    const min = Math.max(this.w, 300) * 0.9;
    const s = clamp(v.s * k, min, 60000);
    const wx = v.x + (sx - this.w / 2) / v.s;
    const wy = v.y + (sy - this.h / 2) / v.s;
    v.x = clamp(wx - (sx - this.w / 2) / s, 0, 1);
    v.y = clamp(wy - (sy - this.h / 2) / s, 0, 1);
    v.s = s;
    this.draw();
  }

  _down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    this.tap = this.pointers.size === 1 ? { x: e.offsetX, y: e.offsetY } : null;
  }

  _move(e) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const pts = [...this.pointers.entries()];
    if (pts.length === 2) {
      const other = pts.find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.offsetX - other.x, e.offsetY - other.y);
      if (before > 0) this._zoomAt((e.offsetX + other.x) / 2, (e.offsetY + other.y) / 2, after / before);
    } else {
      if (this.tap && Math.hypot(e.offsetX - this.tap.x, e.offsetY - this.tap.y) > TAP_PX) this.tap = null;
      if (!this.tap) {
        this.view.x = clamp(this.view.x - (e.offsetX - prev.x) / this.view.s, 0, 1);
        this.view.y = clamp(this.view.y - (e.offsetY - prev.y) / this.view.s, 0, 1);
        this.draw();
      }
    }
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
    if (!this.tap) return;
    const { x, y } = this.tap;
    this.tap = null;
    const world = toLatLon(this.view.x + (x - this.w / 2) / this.view.s, this.view.y + (y - this.h / 2) / this.view.s);
    if (this.onPoint?.(world)) return;
    let best = null;
    let dist = 26;
    for (const pin of this.pins) {
      const p = this._screen(pin.lat, pin.lon);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) [best, dist] = [pin, d];
    }
    if (best) this.onPin(best);
  }

  draw() {
    if (this._queued) return;
    this._queued = true;
    requestAnimationFrame(() => {
      this._queued = false;
      this._paint();
    });
  }

  _paint() {
    const { ctx, dpr, w, h, view: v } = this;
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#123f60';
    ctx.fillRect(0, 0, w, h);
    if (this.land) {
      ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * (w / 2 - v.x * v.s), dpr * (h / 2 - v.y * v.s));
      ctx.fillStyle = '#d8d6b4';
      ctx.fill(this.land.fill);
      ctx.strokeStyle = '#7fb9c9';
      ctx.lineWidth = 1.2 / v.s;
      ctx.stroke(this.land.coast);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.font = '700 11px system-ui, sans-serif';
    const labels = [];
    // 自分の水族館を最後に描いて手前に出し、名前は重ならないものだけ表示する
    const order = [...this.pins].sort((a, b) => (a.kind === 'me') - (b.kind === 'me'));
    for (const pin of [...order].reverse()) {
      const p = this._screen(pin.lat, pin.lon);
      const half = ctx.measureText(pin.label).width / 2 + 3;
      const box = { x0: p.x - half, x1: p.x + half, y0: p.y + 11, y1: p.y + 26 };
      pin.showLabel = !labels.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      if (pin.showLabel) labels.push(box);
    }
    for (const pin of order) {
      const p = this._screen(pin.lat, pin.lon);
      if (p.x < -60 || p.x > w + 60 || p.y < -30 || p.y > h + 30) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = PIN[pin.kind];
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (!pin.showLabel) continue;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#0d2c44';
      ctx.strokeText(pin.label, p.x, p.y + 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(pin.label, p.x, p.y + 22);
    }
  }
}
