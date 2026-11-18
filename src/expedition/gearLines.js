import * as THREE from 'three';
import { BED, box, buoy, clamp01, diver, fishMesh, glow, lamp, lerp, makeLine, mat, particles, span } from './gearKit.js';

/** 釣り・かご・潜水の動き。各関数は update(step, p, t) を返す */

function pole({ group, boat, school }) {
  const rods = [-4, -2, 0, 2, 4].map((x) => ({ x, line: makeLine(group, 0x4a3524), fish: fishMesh(group) }));
  const spray = particles(group, 40);
  const bait = particles(group, 24, 0xcfe6f2, 0.3);
  school.set(0, -3, 16, 7);
  return (step, p, t) => {
    boat.place(step === 0 ? lerp(-24, 0, p) : 0, 3, 0);
    bait.visible = step === 1 || step === 3;
    spray.visible = step >= 2;
    for (let i = 0; i < 40; i++) {
      const k = (t * 1.4 + i / 40) % 1;
      spray.setAt(i, -6 + (i % 13), 2.6 + k * 2 - k * k * 4.4, 5.4 + k * 7);
    }
    for (let i = 0; i < 24; i++) {
      const k = (t * 0.8 + i / 24) % 1;
      bait.setAt(i, -3 + (i % 7), 2.2 - k * k * 3, 5.4 + k * 5);
    }
    spray.flush();
    bait.flush();
    if (step >= 1) school.set(0, lerp(-3, -1, step === 1 ? p : 1), lerp(16, 10, step === 1 ? p : 1), 6);
    rods.forEach(({ x, line, fish }, i) => {
      const swing = step === 3 ? Math.max(0, Math.sin(t * 3.4 + i * 1.3)) : 0;
      const tip = [x, 5 + swing * 3, 8 - swing * 9];
      line(step >= 2 ? [[x, 2.3, 5.2], tip, [tip[0], tip[1] - 2.5 + swing * 1.5, tip[2]]] : []);
      fish.visible = step === 3 && swing > 0.08;
      fish.position.set(x, tip[1] - 1, tip[2]);
      fish.rotation.z = t * 7;
    });
  };
}

function longline({ group, boat, school }) {
  const main = makeLine(group);
  const sets = Array.from({ length: 13 }, () => ({ line: makeLine(group, 0xd9d2bd, 2), float: buoy(group), catch: fishMesh(group, 0x25364f, 2.4) }));
  school.set(0, -10, -6, 9);
  const X0 = -32;
  const L = 62;
  return (step, p, t) => {
    const laid = step === 0 ? p : 1;
    const taken = step === 2 ? p : 0; // 揚縄は入れ始めの端から巻く
    const head = X0 + laid * L;
    const tail = X0 + taken * L;
    boat.place(step === 2 ? tail : head, 0, 0);
    main(step === 2 && taken >= 1 ? [] : [[tail, 0.1, 0], [head, 0.1, 0]]);
    sets.forEach(({ line, float, catch: fish }, i) => {
      const x = X0 + (i / 12) * L;
      const on = x <= head && x >= tail;
      float.visible = on && i % 3 === 0;
      float.position.set(x, 0.25 + Math.sin(t * 2 + i) * 0.06, 0);
      const drop = step === 0 ? clamp01((head - x) / 12) * 9 : 9;
      line(on ? [[x, 0, 0], [x + 0.7, -drop, 0]] : []);
      const hooked = step >= 1 && i % 3 === 1 && (step === 2 || p > i / 13);
      fish.visible = hooked && on;
      fish.position.set(x + 0.7 + Math.sin(t * 3 + i) * 0.3, -9.4, 0);
    });
    if (step === 1) school.set(p * 10 - 5, -9, 0, 9 - p * 4);
  };
}

function tatenawa({ group, boat, school }) {
  const main = makeLine(group);
  const hooks = Array.from({ length: 10 }, () => ({ line: makeLine(group, 0xd9d2bd, 2), fish: fishMesh(group, 0xd8352a, 1) }));
  const weight = box(group, 0.5, 0.5, 0.5, 0x4a5560);
  school.set(6, BED + 2, 0, 6);
  return (step, p, t) => {
    boat.place(step === 0 ? lerp(-22, 0, p) : 0, -1, 0);
    const depth = step === 0 ? 0 : step === 1 ? p : 1 - p;
    const y = lerp(0, BED + 0.4, depth);
    weight.visible = step > 0;
    weight.position.set(0.6, y, 0);
    main(step > 0 ? [[0.6, 2, 0], [0.6, y, 0]] : []);
    hooks.forEach(({ line, fish }, i) => {
      const hy = y + 0.7 + i * 0.75;
      const on = step > 0 && hy < 0;
      line(on ? [[0.6, hy, 0], [1.9, hy - 0.2, 0]] : []);
      fish.visible = on && step === 2 && i % 2 === 0;
      fish.position.set(2.3 + Math.sin(t * 4 + i) * 0.2, hy - 0.2, 0);
    });
    school.set(step === 2 ? lerp(4, 2, p) : 6, lerp(BED + 2, y + 3, step === 2 ? p * 0.5 : 0), 0, 5);
  };
}

function troll({ group, boat, school, bed }) {
  const lines = [-1, 0, 1].map(() => makeLine(group));
  const planers = [-1, 0, 1].map(() => box(group, 0.7, 0.1, 0.4, 0xf0c23c));
  const lures = [-1, 0, 1].map(() => fishMesh(group, 0xf2f2f2, 0.7));
  const hooked = fishMesh(group, 0x36506e, 1.6);
  const poles = [-1, 1].map(() => makeLine(group, 0x4a3524, 2));
  school.set(-24, -2.5, 0, 6);
  return (step, p, t) => {
    boat.place(14, 0, 0);
    bed.position.x = (t * 5) % 8;
    const reach = step === 0 ? p : 1;
    [-1, 0, 1].forEach((s, i) => {
      const tipZ = s * 6;
      const haul = step === 2 && i === 2 ? p : 0;
      const lx = lerp(14, lerp(-4 - i * 3, 9, haul), reach);
      const ly = -1.2 - Math.sin(t * 3 + i) * 0.25;
      const px = lerp(10, lx + 5, 0.7);
      lines[i]([[10, 1.8, tipZ * 0.9], [px, -1, tipZ * 0.9], [lx, ly, tipZ]]);
      planers[i].position.set(px, -1, tipZ * 0.9);
      lures[i].position.set(lx, ly, tipZ);
    });
    poles.forEach((l, i) => l([[11, 1.4, 0], [10, 3.2, (i ? 1 : -1) * 6]]));
    hooked.visible = step >= 1 && (step === 2 || p > 0.6);
    const hx = step === 2 ? lerp(-10, 9, p) : -10;
    hooked.position.set(hx + Math.sin(t * 8) * 0.4, step === 2 ? lerp(-1.4, 1.6, span(p, 0.7, 1)) : -1.4, 6 + Math.sin(t * 6) * 0.5);
    school.set(step === 0 ? -24 : lerp(-24, -10, step === 1 ? p : 1), -2.5, 3, 6);
  };
}

function squid({ group, boat, school, scene }) {
  scene.background.set(0x07121f);
  const anchor = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xd9822b, wireframe: true }));
  anchor.rotation.z = Math.PI / 2;
  group.add(anchor);
  const anchorLine = makeLine(group);
  const lamps = [-6, -3, 0, 3, 6].flatMap((x) => [lamp(group, x, 4.6, 1.4), lamp(group, x, 4.6, -1.4)]);
  const sun = glow(group, 0, 4, 0xe9fbff);
  const reels = [-5, -2.5, 0, 2.5, 5].flatMap((x) => [-1, 1].map((s) => ({ x, s, line: makeLine(group, 0xbfe9ff, 2), squid: fishMesh(group, 0xf0d8c8, 0.9) })));
  boat.place(0, 0, 0);
  school.set(0, BED + 3, 8, 8);
  return (step, p, t) => {
    const set = step === 0 ? p : 1;
    anchor.position.set(lerp(6, 18, set), -1.5, 0);
    anchorLine([[6, 0.5, 0], [anchor.position.x - 1, -1.5, 0]]);
    const on = step === 0 ? 0 : step === 1 ? p : 1;
    lamps.forEach((l) => (l.visible = on > 0.05));
    sun.intensity = on * 260;
    school.set(0, lerp(BED + 3, -5, step === 1 ? p : step > 1 ? 1 : 0), lerp(8, 5, on), 7);
    reels.forEach(({ x, s, line, squid: sq }, i) => {
      const show = step === 2;
      const y = -6 + Math.sin(t * 1.6 + i) * 5;
      line(show ? [[x, 1.5, s * 2.2], [x, y, s * 5]] : []);
      sq.visible = show && i % 3 === 0;
      sq.position.set(x, y - 0.4, s * 5);
      sq.rotation.z = Math.PI / 2;
    });
  };
}

/** かご漁とたこつぼの共通の動き。幹縄につないだ入れ物を順に沈め、順に揚げる */
function groundLine({ group, boat, school }, { count, makeTrap, castStep, waitStep, haulStep, prey }) {
  const traps = Array.from({ length: count }, (_, i) => ({ x: -26 + (i / (count - 1)) * 50, trap: makeTrap() }));
  const ground = makeLine(group);
  const riser = makeLine(group, 0xf4e9c8, 2);
  const flag = buoy(group);
  const catchMesh = traps.map(() => fishMesh(group, prey, 0.8));
  school.set(0, BED + 1, 8, 13);
  return (step, p) => {
    const laid = step < castStep ? 0 : step === castStep ? p : 1;
    const raised = step === haulStep ? p : 0;
    const bx = step === haulStep ? -26 + raised * 50 : -26 + laid * 50;
    boat.place(bx, -3, 0);
    flag.visible = laid > 0 && raised < 1;
    flag.position.set(step === haulStep ? bx : -26, 0.2, 0);
    riser(flag.visible ? [[flag.position.x, 0.2, 0], [flag.position.x, BED + 0.3, 0]] : []);
    const pts = [];
    traps.forEach(({ x, trap }, i) => {
      const k = (x + 26) / 50;
      const placed = laid >= k;
      const up = raised >= k;
      trap.visible = (placed && !up) || (step < castStep && i === 0);
      const sink = clamp01((laid - k) * count * 0.8);
      const y = step < castStep ? 2.2 : lerp(0, BED + 0.5, sink);
      trap.position.set(step < castStep ? bx + 2 : x, y, 0);
      catchMesh[i].visible = trap.visible && (step === waitStep ? p > k : step > waitStep);
      catchMesh[i].position.set(x, y, 0);
      if (placed && !up) pts.push([x, y, 0]);
    });
    ground(pts);
    if (step === waitStep) school.set(0, BED + 1, lerp(8, 1, p), lerp(13, 20, p));
  };
}

function pots(ctx) {
  return groundLine(ctx, {
    count: 8, castStep: 1, waitStep: 2, haulStep: 3, prey: 0xb5482f,
    makeTrap: () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8c77f, wireframe: true }));
      ctx.group.add(m);
      return m;
    },
  });
}

function takotsubo(ctx) {
  return groundLine(ctx, {
    count: 12, castStep: 0, waitStep: 1, haulStep: 2, prey: 0xa8503c,
    makeTrap: () => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.9, 10), mat(0x9a5a3a));
      m.rotation.z = Math.PI / 2;
      ctx.group.add(m);
      return m;
    },
  });
}

function diving({ group, boat, school }) {
  boat.place(-12, -8, 0);
  const divers = [diver(group), diver(group)];
  const scoop = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 16), mat(0xf4f0e0));
  group.add(scoop);
  const barrier = makeLine(group, 0xf2efe2);
  const bubbles = particles(group, 30, 0xdff4fb, 0.2);
  school.set(8, BED + 4, 2, 5);
  return (step, p, t) => {
    const down = step === 0 ? 0 : step === 1 ? p : step === 2 ? 1 : 1 - p;
    const reach = step === 2 ? p : step === 3 ? 1 : 0;
    divers.forEach((d, i) => d.position.set(-12 + down * 12 + reach * 5 + i * 2, lerp(0.6, BED + 5, down) + Math.sin(t * 2 + i) * 0.2, lerp(-8, 0, down) + i * 2.5));
    scoop.position.copy(divers[0].position).add(new THREE.Vector3(2, -0.2, 0));
    scoop.rotation.y = Math.PI / 2;
    barrier(step === 2 ? [[10, BED, -4], [10, BED + 6 * p, -4], [10, BED + 6 * p, 7], [10, BED, 7]] : []);
    const from = divers[0].position;
    for (let i = 0; i < 30; i++) {
      const u = (t * 0.5 + i / 30) % 1;
      bubbles.setAt(i, from.x + Math.sin(i * 3 + t) * 0.6, Math.min(0, from.y + u * 7), from.z + Math.cos(i * 2) * 0.5);
    }
    bubbles.flush();
    if (step >= 2) school.set(lerp(8, 6.5, reach), BED + 4, 2, lerp(5, 2, reach));
  };
}

export const LINE_GEAR = { pole, longline, tatenawa, troll, squid, pots, takotsubo, diving };
