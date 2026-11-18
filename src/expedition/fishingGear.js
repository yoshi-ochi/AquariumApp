import * as THREE from 'three';

/**
 * 漁具の動き。各漁法は { setup(ctx), update(step, p, t) } を返す。
 * step: 作業の番号、p: その作業の進み具合(0〜1)、t: 経過秒。海面は y=0、海底は y=BED。
 */
export const BED = -15;
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
const netMat = () => new THREE.MeshBasicMaterial({ color: 0xf2efe2, wireframe: true, transparent: true, opacity: 0.55 });
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** fn(u, v) → [x, y, z] で形が変わる網 */
function makeNet(group, nu, nv) {
  const geo = new THREE.PlaneGeometry(1, 1, nu, nv);
  const mesh = new THREE.Mesh(geo, netMat());
  mesh.frustumCulled = false;
  group.add(mesh);
  return (fn) => {
    const pos = geo.attributes.position;
    for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) pos.setXYZ(k, ...fn(i / nu, j / nv));
    pos.needsUpdate = true;
  };
}

function makeLine(group, color = 0xf4e9c8, count = 2) {
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  line.frustumCulled = false;
  group.add(line);
  return (pts) => {
    pts.forEach((p, i) => geo.attributes.position.setXYZ(i, p[0], p[1], p[2]));
    geo.setDrawRange(0, pts.length);
    geo.attributes.position.needsUpdate = true;
  };
}

function buoy(group, color = 0xf0712c) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(color));
  group.add(m);
  return m;
}

// ---- 各漁法 --------------------------------------------------------------------

function purse({ group, boat, school }) {
  const net = makeNet(group, 40, 6);
  const R = 15;
  school.set(0, -6, 0, 7);
  return (step, p, t) => {
    const sweep = step === 0 ? 0 : step === 1 ? p * Math.PI * 2 : Math.PI * 2;
    const a = sweep - Math.PI / 2;
    const radius = step === 3 ? R * (1 - p * 0.55) : R;
    if (step === 0) boat.place(-30 + p * 30, -R * p - 12 * (1 - p), Math.PI / 2 * 0);
    else boat.place(Math.cos(a) * radius, Math.sin(a) * radius, -a);
    const close = step < 2 ? 0 : step === 2 ? p : 1;
    net((u, v) => {
      const ang = -Math.PI / 2 + u * Math.max(0.001, sweep);
      const r = radius * (1 - close * v * v * 0.92);
      return [Math.cos(ang) * r, 0.1 - v * 11 * (1 - close * 0.25), Math.sin(ang) * r];
    });
    if (step === 3) school.set(0, -4, 0, 7 - p * 4);
  };
}

function trawl({ group, boat, school, bed }) {
  const net = makeNet(group, 16, 12);
  const warpA = makeLine(group);
  const warpB = makeLine(group);
  const boards = [-1, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.2), mat(0x4a5560));
    group.add(m);
    return m;
  });
  boat.place(16, 0, 0);
  school.set(-16, BED + 2, 0, 6);
  return (step, p, t) => {
    const depth = step === 0 ? p : step === 1 ? 1 : 1 - p;
    const back = 8 + depth * 22;
    const nx = 16 - back;
    const ny = -0.3 + (BED + 2.2) * depth;
    const open = 2 + depth * 3.4;
    if (step === 1) {
      bed.position.x = (t * 3) % 8;
      school.set(nx - 5, ny, 0, 2 + (1 - p) * 4);
    }
    net((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.82;
      return [nx - v * 12, ny + Math.sin(a) * open * 0.45 * k, Math.cos(a) * open * k];
    });
    boards.forEach((b, i) => b.position.set(nx + 3, ny, (i ? 1 : -1) * (open + 1.4)));
    warpA([[13, 0.8, 0.5], [nx + 3, ny, open + 1.4]]);
    warpB([[13, 0.8, -0.5], [nx + 3, ny, -open - 1.4]]);
    if (step === 2) school.set(nx - 8, ny, 0, 1.5);
  };
}

function setnet({ group, boat, school }) {
  const leader = makeNet(group, 20, 4);
  const box = makeNet(group, 32, 6);
  const floats = Array.from({ length: 8 }, () => buoy(group));
  school.set(-24, -6, 10, 5);
  return (step, p) => {
    const len = step === 0 ? p : 1;
    boat.place(-28 + len * 28, 6, 0);
    leader((u, v) => [-30 + u * len * 28, 0.1 - v * 11, 6]);
    floats.forEach((f, i) => {
      const k = i / 7;
      f.visible = k <= len;
      f.position.set(-30 + k * 28, 0.2, 6);
    });
    const drop = step === 0 ? 0 : step === 1 ? p : 1;
    box((u, v) => {
      const a = u * Math.PI * 2;
      return [4 + Math.cos(a) * 8, 0.1 - v * 11 * drop, 6 + Math.sin(a) * 6];
    });
    if (step === 2) school.set(-24 + p * 28, -6, 8 - p * 2, 5 - p * 2);
  };
}

function pole({ group, boat, school, scene }) {
  const rods = [-3, -1, 1, 3].map((x) => {
    const r = makeLine(group, 0x4a3524);
    return { x, r };
  });
  const spray = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(90), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 }),
  );
  spray.frustumCulled = false;
  group.add(spray);
  const fish = rods.map(() => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 6).rotateZ(Math.PI / 2), mat(0x36506e));
    group.add(m);
    return m;
  });
  school.set(0, -2, 13, 6);
  return (step, p, t) => {
    boat.place(step === 0 ? -20 + p * 20 : 0, 3, 0);
    spray.visible = step >= 1;
    const pos = spray.geometry.attributes.position;
    for (let i = 0; i < 30; i++) {
      const k = ((t * 1.4 + i / 30) % 1);
      pos.setXYZ(i, -5 + (i % 10), 2.2 + k * 2 - k * k * 4, 6 + k * 6);
    }
    pos.needsUpdate = true;
    rods.forEach(({ x, r }, i) => {
      const swing = step === 2 ? Math.max(0, Math.sin(t * 3.2 + i * 1.4)) : 0;
      const tip = [x, 2.2 + 3 + swing * 3, 7 - swing * 8];
      r([[x, 2.2, 5.6], tip]);
      fish[i].visible = step === 2;
      fish[i].position.set(x, swing > 0.1 ? tip[1] - 1 : -0.3, swing > 0.1 ? tip[2] : 11);
      fish[i].rotation.z = t * 6 * swing;
    });
  };
}

function longline({ group, boat, school }) {
  const main = makeLine(group, 0xf4e9c8, 2);
  const branches = Array.from({ length: 12 }, () => ({ line: makeLine(group, 0xd9d2bd), float: buoy(group) }));
  school.set(0, -9, -4, 9);
  return (step, p, t) => {
    const len = step === 0 ? p : 1;
    const x = -30 + len * 58;
    boat.place(x, 0, 0);
    main([[-30, 0.1, 0], [x, 0.1, 0]]);
    const drop = step === 0 ? 0.35 : step === 1 ? 0.35 + p * 0.65 : 1;
    branches.forEach(({ line, float }, i) => {
      const bx = -28 + (i / 11) * 54;
      const on = bx < x;
      float.visible = on;
      float.position.set(bx, 0.2 + Math.sin(t * 2 + i) * 0.06, 0);
      line(on ? [[bx, 0, 0], [bx + 0.6, -9 * drop, 0]] : [[bx, 0, 0], [bx, 0, 0]]);
    });
    if (step === 2) school.set(p * 12 - 6, -8, 0, 9 - p * 4);
  };
}

function gill({ group, boat, school }) {
  const net = makeNet(group, 30, 5);
  const floats = Array.from({ length: 11 }, () => buoy(group, 0xf4d03f));
  school.set(-4, -7, 14, 7);
  return (step, p) => {
    const len = step === 0 ? p : 1;
    boat.place(-26 + len * 52, -2, 0);
    net((u, v) => [-26 + u * len * 52, 0 - v * 9, 0]);
    floats.forEach((f, i) => {
      const k = i / 10;
      f.visible = k <= len;
      f.position.set(-26 + k * 52, 0.2, 0);
    });
    if (step === 1) school.set(-4 + p * 4, -6, 14 * (1 - p), 7 - p * 3);
  };
}

function pots({ group, boat, school }) {
  const items = Array.from({ length: 5 }, (_, i) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8c77f, wireframe: true }));
    group.add(pot);
    return { x: -20 + i * 10, pot, rope: makeLine(group), float: buoy(group) };
  });
  school.set(0, BED + 1.5, 7, 12);
  return (step, p) => {
    const reach = step === 0 ? 0 : step === 1 ? p * items.length : items.length;
    boat.place(-24 + (reach / items.length) * 44, -3, 0);
    items.forEach((it, i) => {
      const k = clamp01(reach - i);
      const y = 1.5 + (BED + 0.6 - 1.5) * k;
      it.pot.visible = reach > i || step === 0;
      it.pot.position.set(it.x, step === 0 ? 2.2 : y, 0);
      it.float.visible = k > 0;
      it.float.position.set(it.x, 0.2, 0);
      it.rope(k > 0 ? [[it.x, 0.2, 0], [it.x, y, 0]] : [[it.x, 0, 0], [it.x, 0, 0]]);
    });
    if (step === 2) school.set(0, BED + 1, 1, 12 - p * 6);
  };
}

function bouke({ group, boat, school, scene }) {
  scene.background = new THREE.Color(0x07121f);
  const net = makeNet(group, 20, 8);
  const lights = [-6, -2, 2, 6].map((x) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffefb0 }));
    l.position.set(x, 4.2, 4);
    group.add(l);
    return l;
  });
  const glow = new THREE.PointLight(0xffe7a8, 0, 60, 1.3);
  glow.position.set(0, 5, 8);
  group.add(glow);
  school.set(-4, -8, 20, 8);
  boat.place(0, 0, 0);
  return (step, p) => {
    const on = step === 0 ? p : 1;
    glow.intensity = on * 180;
    lights.forEach((l) => (l.visible = on > 0.05));
    school.set(0, -8 + on * 5, 20 - on * 10, 8 - on * 3);
    const open = step === 0 ? 0 : step === 1 ? p : 1;
    const lift = step === 2 ? p : 0;
    net((u, v) => [(u - 0.5) * 18, 0.2 - (1 - lift) * v * 10 * open, 4 + v * 12 * open]);
    if (step === 2) school.set(0, -3 + p * 2.6, 9 - p * 3, 5 - p * 3);
  };
}

function diving({ group, boat, school }) {
  boat.place(-12, -8, 0);
  const divers = [0, 1].map((i) => {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.3, 3, 8).rotateZ(Math.PI / 2), mat(0x1d2730));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8).rotateZ(Math.PI / 2), mat(0xf0c23c));
    tank.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(0xe2b48c));
    head.position.x = 1;
    d.add(body, tank, head);
    group.add(d);
    return { d, i };
  });
  const scoop = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 16), mat(0xf4f0e0));
  group.add(scoop);
  const bubbles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(90), 3)), new THREE.PointsMaterial({ color: 0xdff4fb, size: 0.2 }));
  bubbles.frustumCulled = false;
  group.add(bubbles);
  school.set(8, BED + 4, 2, 5);
  return (step, p, t) => {
    const k = step === 0 ? 0 : step === 1 ? p : 1;
    const reach = step === 2 ? p : 0;
    divers.forEach(({ d, i }) => {
      d.position.set(-12 + k * 12 + reach * 5 + i * 2, 0.6 + (BED + 5 - 0.6) * k + Math.sin(t * 2 + i) * 0.2, -8 + k * 8 + i * 2.5);
    });
    scoop.position.copy(divers[0].d.position).add(new THREE.Vector3(2, -0.2, 0));
    scoop.rotation.y = Math.PI / 2;
    const pos = bubbles.geometry.attributes.position;
    const from = divers[0].d.position;
    for (let i = 0; i < 30; i++) {
      const u = (t * 0.5 + i / 30) % 1;
      pos.setXYZ(i, from.x + Math.sin(i * 3 + t) * 0.6, from.y + u * 7, from.z + Math.cos(i * 2) * 0.5);
    }
    pos.needsUpdate = true;
    if (step === 2) school.set(8 - p * 2, BED + 4, 2, 5 - p * 3);
  };
}

export const GEAR = { purse, trawl, setnet, pole, longline, gill, pots, bouke, diving };
