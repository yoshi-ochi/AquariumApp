import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL } from '../room/floorPlan.js';
import { TankManager } from '../tanks/tankManager.js';

/**
 * 館内を歩く来館者。InstancedMesh で描くのでスマホでも軽い。
 * 床のマス目を幅優先探索で移動し、水槽の前で立ち止まって眺める。
 */
const MAX_AGENTS = 40;
const SPEED = 0.55;
const SHIRTS = [0xe2574c, 0x3f8fd0, 0xf0b63c, 0x4fb286, 0x9a6cc8, 0xf2f2ee, 0x39424d, 0xe98aa8];
const SKIN = [0xf2cda8, 0xe0b48c, 0xc99570];
const EMOTES = 4;
const PANTS = [0x2f3b4c, 0x4a5568, 0x6b5a48, 0x24303f, 0x8a8f96];
/** 1人あたりに必要な歩けるマス数（狭い部屋が人で埋まらないように） */
const CELLS_PER_AGENT = 4;

function emoteTexture(happy) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(32, 28, 26, 0, Math.PI * 2);
  c.moveTo(24, 50);
  c.lineTo(32, 63);
  c.lineTo(40, 50);
  c.fill();
  c.fillStyle = c.strokeStyle = happy ? '#e8703c' : '#5a6b7a';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(22, 23, 4, 0, Math.PI * 2);
  c.arc(42, 23, 4, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  if (happy) c.arc(32, 30, 12, 0.25, Math.PI - 0.25);
  else c.arc(32, 46, 12, Math.PI + 0.5, -0.5);
  c.stroke();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export class Crowd {
  constructor({ scene, room, manager }) {
    Object.assign(this, { room, manager });
    this.group = new THREE.Group();
    this.group.name = 'visitors';
    scene.add(this.group);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    // 胴体＋両腕、両脚、頭の3パーツ（身長約1.6m）
    const torso = new THREE.CapsuleGeometry(0.14, 0.34, 3, 8);
    torso.scale(1, 1, 0.68);
    torso.translate(0, 1.08, 0);
    const limb = (r, len, x, y) => {
      const g = new THREE.CapsuleGeometry(r, len, 2, 6);
      g.translate(x, y, 0);
      return g;
    };
    const body = mergeGeometries([torso, limb(0.04, 0.42, -0.18, 1.06), limb(0.04, 0.42, 0.18, 1.06)]);
    const legs = mergeGeometries([limb(0.06, 0.66, -0.075, 0.39), limb(0.06, 0.66, 0.075, 0.39)]);
    const head = new THREE.SphereGeometry(0.115, 10, 8);
    head.translate(0, 1.5, 0);
    this.bodies = new THREE.InstancedMesh(body, mat, MAX_AGENTS);
    this.legs = new THREE.InstancedMesh(legs, mat, MAX_AGENTS);
    this.heads = new THREE.InstancedMesh(head, mat, MAX_AGENTS);
    this.parts = [this.bodies, this.legs, this.heads];
    for (const m of this.parts) {
      m.raycast = () => {};
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    const color = new THREE.Color();
    for (let i = 0; i < MAX_AGENTS; i++) {
      this.bodies.setColorAt(i, color.set(SHIRTS[i % SHIRTS.length]));
      this.heads.setColorAt(i, color.set(SKIN[i % SKIN.length]));
      this.legs.setColorAt(i, color.set(PANTS[i % PANTS.length]));
    }
    this.happy = new THREE.SpriteMaterial({ map: emoteTexture(true), depthWrite: false });
    this.sad = new THREE.SpriteMaterial({ map: emoteTexture(false), depthWrite: false });
    this.emotes = Array.from({ length: EMOTES }, () => {
      const s = new THREE.Sprite(this.happy);
      s.scale.setScalar(0.34);
      s.visible = false;
      s.raycast = () => {};
      this.group.add(s);
      return { sprite: s, agent: null, until: 0 };
    });
    this.agents = [];
    this.free = [];
    this.gridKey = '';
    this._gridTimer = 0;
    this._emoteTimer = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  setVisible(v) {
    this.group.visible = v;
  }

  /** 歩けるマス（館内の床で、物が置かれていないマス）を作り直す */
  _rebuildGrid() {
    const plan = this.room.plan;
    const floor = this.manager.currentFloor;
    const objects = [...this.manager.objects.values()].filter((o) => o.userData.floor === floor && !o.userData.embed);
    const key = `${plan.cell}:${plan.toJSON().cells.length}:${floor}:${objects.map((o) => `${o.userData.uid},${o.position.x},${o.position.z},${o.rotation.y}`).join(';')}`;
    if (key === this.gridKey && this.plan === plan) return;
    this.gridKey = key;
    this.plan = plan;
    const blocked = new Set();
    for (const o of objects) {
      const { hx, hz } = TankManager.footprintHalf(this.manager.defOf(o), o.rotation.y);
      for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
        if (plan.rectOverlapsCell(o.position.x, o.position.z, hx, hz, i, j)) blocked.add(plan.idx(i, j));
      }
    }
    this.blocked = blocked;
    this.free = [];
    for (let j = 0; j < plan.GZ; j++) for (let i = 0; i < plan.GX; i++) {
      if (plan.at(i, j) === CELL.FLOOR && !blocked.has(plan.idx(i, j))) this.free.push([i, j]);
    }
    // 見どころ：水槽に隣接する歩けるマス
    this.spots = this.free.filter(([i, j]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => blocked.has(plan.idx(i + a, j + b))));
    for (const a of this.agents) this._reset(a);
  }

  _walkable(i, j) {
    return this.plan.at(i, j) === CELL.FLOOR && !this.blocked.has(this.plan.idx(i, j));
  }

  _center(i, j) {
    const [x, z] = this.plan.cellMin(i, j);
    return [x + this.plan.cell / 2, z + this.plan.cell / 2];
  }

  /** 幅優先探索で経路を求める */
  _route(from, to) {
    const plan = this.plan;
    const prev = new Map([[plan.idx(from[0], from[1]), -1]]);
    const queue = [from];
    const goal = plan.idx(to[0], to[1]);
    for (let q = 0; q < queue.length; q++) {
      const [i, j] = queue[q];
      if (plan.idx(i, j) === goal) break;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = plan.idx(i + a, j + b);
        if (prev.has(k) || !this._walkable(i + a, j + b)) continue;
        prev.set(k, plan.idx(i, j));
        queue.push([i + a, j + b]);
      }
    }
    if (!prev.has(goal)) return [];
    const path = [];
    for (let k = goal; k !== -1; k = prev.get(k)) path.unshift([k % plan.GX, Math.floor(k / plan.GX)]);
    return path;
  }

  _reset(a) {
    const [i, j] = this.free[Math.floor(Math.random() * this.free.length)] ?? [0, 0];
    const [x, z] = this.free.length ? this._center(i, j) : [0, 0];
    Object.assign(a, { i, j, x, z, path: [], wait: Math.random() * 3, watching: false });
  }

  _next(a) {
    const pool = this.spots.length ? this.spots : this.free;
    if (!pool.length) return;
    a.path = this._route([a.i, a.j], pool[Math.floor(Math.random() * pool.length)]).slice(1);
  }

  _step(a, dt) {
    if (a.wait > 0) {
      a.wait -= dt;
      return;
    }
    if (!a.path.length) {
      if (a.watching) {
        a.watching = false;
        return this._next(a);
      }
      a.watching = true;
      a.wait = 3 + Math.random() * 6;
      return;
    }
    const [ci, cj] = a.path[0];
    const [tx, tz] = this._center(ci, cj);
    const dx = tx - a.x;
    const dz = tz - a.z;
    const d = Math.hypot(dx, dz);
    const move = SPEED * dt;
    a.yaw = Math.atan2(dx, dz);
    a.phase = (a.phase ?? 0) + dt * 9;
    if (d <= move) {
      Object.assign(a, { x: tx, z: tz, i: ci, j: cj });
      a.path.shift();
      if (!a.path.length) a.watching = false;
    } else {
      a.x += (dx / d) * move;
      a.z += (dz / d) * move;
    }
  }

  update(dt, visitors, satisfaction) {
    if (!this.group.visible) return;
    this._gridTimer -= dt;
    if (this._gridTimer <= 0) {
      this._gridTimer = 1.5;
      this._rebuildGrid();
    }
    const want = this.free.length ? Math.min(MAX_AGENTS, Math.round(visitors), Math.ceil(this.free.length / CELLS_PER_AGENT)) : 0;
    while (this.agents.length < want) {
      const a = { offX: (Math.random() - 0.5) * 0.2, offZ: (Math.random() - 0.5) * 0.2, scale: 0.88 + Math.random() * 0.2 };
      this._reset(a);
      this.agents.push(a);
    }
    this.agents.length = want;
    this.agents.forEach((a, i) => {
      this._step(a, dt);
      const bob = a.path.length && a.wait <= 0 ? Math.abs(Math.sin(a.phase ?? 0)) * 0.035 : 0;
      this._p.set(a.x + a.offX, bob, a.z + a.offZ);
      this._q.setFromAxisAngle(this._up, a.yaw ?? 0);
      this._s.setScalar(a.scale);
      this._m.compose(this._p, this._q, this._s);
      for (const m of this.parts) m.setMatrixAt(i, this._m);
    });
    for (const m of this.parts) {
      m.count = want;
      m.instanceMatrix.needsUpdate = true;
    }
    this._updateEmotes(dt, satisfaction);
  }

  /** 眺めている人の頭上に、満足度に応じた表情を出す */
  _updateEmotes(dt, satisfaction) {
    this._emoteTimer -= dt;
    const now = performance.now();
    for (const e of this.emotes) {
      if (e.agent && (now > e.until || !this.agents.includes(e.agent))) e.agent = null;
      e.sprite.visible = !!e.agent;
      if (e.agent) e.sprite.position.set(e.agent.x, 1.95 * e.agent.scale, e.agent.z);
    }
    if (this._emoteTimer > 0) return;
    this._emoteTimer = 1.6;
    const slot = this.emotes.find((e) => !e.agent);
    const viewer = this.agents.filter((a) => a.watching && !this.emotes.some((e) => e.agent === a))[0];
    if (!slot || !viewer) return;
    slot.agent = viewer;
    slot.until = now + 2600;
    slot.sprite.material = satisfaction >= 60 ? this.happy : this.sad;
  }
}
