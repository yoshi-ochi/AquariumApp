import { BED, box, buoy, clamp01, diver, glow, lamp, lerp, makeLine, makeNet, span } from './gearKit.js';

/** 網を使う漁法の動き。各関数は update(step, p, t) を返す */

function purse({ group, boat, makeBoat, school }) {
  const net = makeNet(group, 44, 6);
  const light = makeBoat(0xd9822b);
  const carrier = makeBoat(0x3f6d4e);
  const beam = lamp(group, 0, -1, 0, 0xcff6ff);
  const R = 15;
  school.set(0, -6, 0, 7);
  return (step, p) => {
    const sweep = step === 0 ? 0 : step === 1 ? p * Math.PI * 2 : Math.PI * 2;
    const a = sweep - Math.PI / 2;
    const radius = step === 3 ? lerp(R, R * 0.42, p) : step > 3 ? R * 0.42 : R;
    light.place(step === 0 ? lerp(-8, 2, p) : 2, step === 0 ? -6 : -R - 2.5, 0);
    beam.visible = step === 0;
    beam.position.set(light.position.x, -2, light.position.z + 2);
    if (step === 0) boat.place(lerp(-34, -6, p), -R - 7, 0);
    else boat.place(Math.cos(a) * radius, Math.sin(a) * radius, -a - Math.PI / 2 + Math.PI);
    carrier.visible = step === 4;
    carrier.place(radius + 7, 0, Math.PI / 2);
    const close = step < 2 ? 0 : step === 2 ? p : 1;
    net((u, v) => {
      const ang = -Math.PI / 2 + u * Math.max(0.001, sweep);
      const r = radius * (1 - close * v * v * 0.94);
      return [Math.cos(ang) * r, 0.1 - v * 11 * (1 - close * 0.3) * (step >= 3 ? 1 - (step === 3 ? p : 1) * 0.5 : 1), Math.sin(ang) * r];
    });
    school.set(0, step >= 3 ? -2.5 : -6, 0, step === 3 ? lerp(7, 3, p) : step > 3 ? 3 : 7);
  };
}

function trawl({ group, boat, school, bed }) {
  const net = makeNet(group, 16, 12);
  const warps = [makeLine(group), makeLine(group)];
  const boards = [0, 1].map(() => box(group, 1.8, 1.2, 0.2, 0x4a5560));
  boat.place(18, 0, 0);
  school.set(-16, BED + 2, 0, 6);
  return (step, p, t) => {
    const out = step === 0 ? p * 0.25 : step === 1 ? 0.25 + p * 0.75 : step === 2 ? 1 : 1 - p;
    const back = 6 + out * 26;
    const nx = 18 - back;
    const ny = lerp(-0.3, BED + 2.2, out);
    const open = 1.2 + out * 4;
    if (step === 2) {
      bed.position.x = (t * 3) % 8;
      school.set(nx - 5, ny, 0, lerp(6, 1.6, p));
    } else if (step === 3) school.set(nx - 8, ny, 0, 1.4);
    net((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.84;
      return [nx - v * 12, ny + Math.sin(a) * open * 0.45 * k, Math.cos(a) * open * k];
    });
    boards.forEach((b, i) => {
      b.visible = step > 0;
      b.position.set(nx + 3, ny, (i ? 1 : -1) * (open + 1.4));
    });
    warps.forEach((w, i) => w(step > 0 ? [[15, 0.8, (i ? 1 : -1) * 0.5], [nx + 3, ny, (i ? 1 : -1) * (open + 1.4)]] : []));
  };
}

function kakemawashi({ group, boat, school }) {
  const ropes = [makeLine(group), makeLine(group)];
  const net = makeNet(group, 12, 8);
  const mark = buoy(group);
  school.set(6, BED + 1.5, 0, 9);
  const W = 15;
  const path = [[-22, 0], [0, -W], [20, 0], [0, W], [-22, 0]];
  const onPath = (k) => {
    const s = clamp01(k) * 4;
    const i = Math.min(3, Math.floor(s));
    const f = s - i;
    return [lerp(path[i][0], path[i + 1][0], f), lerp(path[i][1], path[i + 1][1], f)];
  };
  return (step, p) => {
    const run = step === 0 ? 0 : step === 1 ? p : 1;
    const [bx, bz] = onPath(run);
    const pull = step === 3 ? p : step > 3 ? 1 : 0;
    if (step >= 2) boat.place(-22 - pull * 4, 0, 0);
    else boat.place(bx, bz, -Math.atan2(onPath(run + 0.02)[1] - bz, onPath(run + 0.02)[0] - bx));
    mark.visible = step < 2;
    mark.position.set(-22, 0.2, 0);
    const squeeze = 1 - pull * 0.72;
    const netX = lerp(20, 4, step === 4 ? p : 0) - pull * 8;
    const laid = (k) => {
      const [x, z] = onPath(k);
      return [lerp(-22, x, 1) - pull * 6, BED + 0.25, z * squeeze];
    };
    for (const [side, line] of ropes.entries()) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const k = side === 0 ? (i / 14) * 0.5 : 1 - (i / 14) * 0.5;
        if (k <= run || side === 0 ? k <= run : run >= 1) pts.push(laid(k));
      }
      line(pts);
    }
    net.mesh.visible = run >= 0.45;
    net((u, v) => [netX + v * 8, BED + 0.6 + Math.sin(u * Math.PI) * 2.2 * (1 - v * 0.7), (u - 0.5) * 8 * (1 - v * 0.8) * squeeze]);
    school.set(lerp(6, netX + 3, pull), BED + 1.5, 0, lerp(9, 2, pull));
  };
}

function setnet({ group, boat, makeBoat, school }) {
  const leader = makeNet(group, 20, 4);
  const yard = makeNet(group, 36, 5);
  const ramp = makeNet(group, 10, 8);
  const pocket = makeNet(group, 28, 7);
  const floats = Array.from({ length: 10 }, () => buoy(group, 0xf4d03f, 0.34));
  const side = makeBoat(0x7a4a2a);
  school.set(-30, -6, 12, 5);
  return (step, p) => {
    const built = step === 0 ? p : 1;
    leader.mesh.visible = built > 0;
    leader((u, v) => [-36 + u * built * 22, 0.1 - v * 11, 0]);
    floats.forEach((f, i) => {
      f.visible = i / 9 <= built;
      f.position.set(-36 + (i / 9) * 22, 0.2, 0);
    });
    const a2 = span(built, 0.3, 0.7);
    yard.mesh.visible = a2 > 0;
    yard((u, v) => {
      const a = u * Math.PI * 2;
      return [-5 + Math.cos(a) * 9, 0.1 - v * 11 * a2, Math.sin(a) * 8];
    });
    const a3 = span(built, 0.6, 0.85);
    ramp.mesh.visible = a3 > 0;
    ramp((u, v) => [4 + v * 7 * a3, -11 * (1 - v) * a3 - 1, (u - 0.5) * 5]);
    const haul = step === 2 ? p : step > 2 ? 1 : 0;
    const a4 = span(built, 0.8, 1);
    pocket.mesh.visible = a4 > 0;
    pocket((u, v) => {
      const a = u * Math.PI * 2;
      const shrink = 1 - haul * 0.55;
      return [16 + Math.cos(a) * 6 * shrink + haul * 2, 0.1 - v * lerp(10, 2.2, haul) * a4, Math.sin(a) * 5 * shrink];
    });
    boat.place(step < 2 ? lerp(-34, 12, built) : 12, step < 2 ? -9 : -6.5, 0);
    side.visible = step >= 2;
    side.place(19, 6.8, Math.PI);
    if (step === 1) {
      const k = p;
      const x = k < 0.35 ? lerp(-30, -12, k / 0.35) : k < 0.7 ? lerp(-12, 2, (k - 0.35) / 0.35) : lerp(2, 17, (k - 0.7) / 0.3);
      school.set(x, -6, k < 0.35 ? lerp(6, 3, k / 0.35) : 0, lerp(5, 3, k));
    } else if (step >= 2) school.set(17, lerp(-5, -1.3, haul), 0, lerp(3, 1.8, haul));
  };
}

function gill({ group, boat, school }) {
  const net = makeNet(group, 30, 5);
  const floats = Array.from({ length: 11 }, () => buoy(group, 0xf4d03f, 0.32));
  school.set(-4, -7, 14, 7);
  return (step, p) => {
    const len = step === 0 ? p : step === 2 ? 1 - p : 1;
    const start = step === 2 ? -26 + p * 52 : -26;
    const end = step === 0 ? -26 + p * 52 : 26;
    boat.place(step === 2 ? start : end, -2, step === 2 ? Math.PI : 0);
    net.mesh.visible = len > 0.01;
    net((u, v) => [lerp(start, end, u), -v * 9, 0]);
    floats.forEach((f, i) => {
      const x = -26 + (i / 10) * 52;
      f.visible = x >= start && x <= end;
      f.position.set(x, 0.2, 0);
    });
    if (step === 1) school.set(-4 + p * 4, -5, 14 * (1 - p), 7 - p * 3);
  };
}

function boatseine({ group, boat, makeBoat, school, bed }) {
  const mate = makeBoat(0x8a5a2a);
  const net = makeNet(group, 16, 10);
  const ropes = [makeLine(group), makeLine(group)];
  school.set(-12, -5, 0, 7);
  return (step, p, t) => {
    const out = step === 0 ? p : 1;
    const gap = step === 2 ? lerp(11, 2.5, p) : lerp(3, 11, out);
    const back = lerp(4, 24, out);
    const lift = step === 2 ? p : 0;
    boat.place(14, -gap, 0);
    mate.place(14, gap, 0);
    const nx = 14 - back + lift * 14;
    const ny = lerp(-1, -5, out) * (1 - lift) - lift * 0.4;
    if (step === 1) bed.position.x = (t * 3) % 8;
    net((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.86;
      return [nx - v * 11, ny + Math.sin(a) * 2.6 * k, Math.cos(a) * (gap * 0.6) * k];
    });
    ropes.forEach((r, i) => r([[12, 0.6, (i ? 1 : -1) * gap], [nx, ny, (i ? 1 : -1) * gap * 0.6]]));
    school.set(nx - 8, ny, 0, step === 1 ? lerp(7, 2, p) : step === 2 ? 1.6 : 7);
  };
}

function beachseine({ group, boat, school, scene }) {
  const shore = box(group, 130, 1.6, 26, 0xe2cf9c);
  shore.position.set(0, -0.3, 34);
  const net = makeNet(group, 30, 4);
  const ropes = [makeLine(group), makeLine(group)];
  const crews = [-1, 1].map((s) => {
    const d = box(group, 0.6, 1.7, 0.6, 0x35506e);
    d.position.set(s * 18, 1.3, 23);
    return d;
  });
  school.set(0, -3, 2, 7);
  return (step, p) => {
    const lay = step === 0 ? 0 : step === 1 ? p : 1;
    const a = Math.PI * (1 - lay);
    boat.visible = step < 2;
    if (step === 0) boat.place(-16, 17, 0);
    else boat.place(Math.cos(a) * 16, 8 - Math.sin(a) * 14 + 6 * (1 - Math.sin(a)), -a);
    const pull = step === 2 ? p : 0;
    const cz = lerp(8, 19, pull);
    net.mesh.visible = lay > 0;
    net((u, v) => {
      const ang = Math.PI - u * Math.PI * lay;
      return [Math.cos(ang) * lerp(16, 9, pull), -v * lerp(5, 2.2, pull), cz - Math.sin(ang) * lerp(14, 4, pull)];
    });
    ropes.forEach((r, i) => {
      const s = i ? 1 : -1;
      r(i === 1 && lay < 1 ? [] : [[s * 18, 1.2, 23], [s * lerp(16, 9, pull), 0, cz]]);
    });
    crews.forEach((c, i) => (c.position.z = 23 + Math.sin(p * 30 + i) * (step === 2 ? 0.25 : 0)));
    school.set(0, lerp(-3, -1.5, pull), lerp(2, 16, pull), lerp(7, 3, pull));
  };
}

function oikomi({ group, boat, school }) {
  const wings = [makeNet(group, 12, 4), makeNet(group, 12, 4)];
  const bag = makeNet(group, 20, 8);
  const swimmers = [0, 1, 2].map(() => diver(group));
  boat.place(18, -12, 0);
  school.set(-16, BED + 5, 0, 6);
  return (step, p) => {
    const set = step === 0 ? p : 1;
    wings.forEach((w, i) => {
      const s = i ? 1 : -1;
      w((u, v) => [lerp(12, 12 - 22 * set, u), BED + v * 8, s * lerp(2.5, 2.5 + 14 * set, u)]);
    });
    const lift = step === 2 ? p : 0;
    bag((u, v) => {
      const a = u * Math.PI * 2;
      const k = 1 - v * 0.7;
      return [12 + v * 7, lerp(BED + 4, -1.2, lift) + Math.sin(a) * 3.2 * k * (1 - lift * 0.4), Math.cos(a) * 3.2 * k * (1 - lift * 0.4)];
    });
    const chase = step === 1 ? p : step > 1 ? 1 : 0;
    swimmers.forEach((d, i) => {
      d.visible = step === 1;
      d.position.set(lerp(-26, 2, chase), BED + 5 + i * 1.2, (i - 1) * lerp(12, 3, chase));
    });
    school.set(lerp(-16, 15, chase), lift ? lerp(BED + 4, -1.2, lift) : BED + 5, 0, lerp(6, 2, chase));
  };
}

/** さんま棒受け網：右舷で集める間に左舷へ網を張り、灯りの切り替えで網の上へ誘導する */
function bouke({ group, boat, school, scene }) {
  scene.background.set(0x07121f);
  const STAR = 7; // 右舷の魚群の位置
  const PORT = -10; // 左舷の網の位置
  const xs = [-6, -3, 0, 3, 6];
  const starLamps = xs.map((x) => lamp(group, x, 4, 2.4));
  const portLamps = xs.map((x) => lamp(group, x, 4, -2.4));
  const reds = [-3, 0, 3].map((x) => lamp(group, x, 3.4, -2.6, 0xff3b30));
  const lightS = glow(group, 0, 8);
  const lightP = glow(group, 0, -8);
  const lightR = glow(group, 0, -8, 0xff4a3a);
  const net = makeNet(group, 22, 10);
  const poles = [-7, 7].map((x) => makeLine(group, 0xd9c9a0));
  const hose = makeLine(group, 0x2a7fb5, 12);
  boat.place(0, 0, 0);
  school.set(0, -8, 26, 9);
  return (step, p, t) => {
    // 灯り：右舷→左舷へ順に点灯→赤色灯
    const star = step === 0 ? p : step === 1 ? 1 : step === 2 ? 1 - span(p, 0, 0.4) : 0;
    const port = step === 0 ? p : step === 1 ? 1 - span(p, 0, 0.3) : step === 2 ? span(p, 0.3, 1) : 0;
    const red = step >= 3 ? 1 : 0;
    starLamps.forEach((l) => (l.visible = star > 0.1));
    portLamps.forEach((l, i) => (l.visible = step === 2 ? span(p, 0.3 + i * 0.12, 0.42 + i * 0.12) > 0 : port > 0.1));
    reds.forEach((l) => (l.visible = red > 0));
    lightS.intensity = star * 200;
    lightP.intensity = port * 200;
    lightR.intensity = red * 60;
    // 網：左舷に張り出し、起こすと舷側へたぐり寄せる
    const spread = step === 0 ? 0 : step === 1 ? p : 1;
    const haul = step === 4 ? p : step > 4 ? 1 : 0;
    net.mesh.visible = spread > 0;
    const edge = lerp(PORT - 8, -3, haul);
    net((u, v) => {
      const sag = Math.sin(v * Math.PI) * lerp(7, 1.5, haul);
      return [(u - 0.5) * lerp(20, 13, haul), 0.1 - sag * spread, lerp(-2.6, edge, v * spread)];
    });
    poles.forEach((line, i) => line(spread > 0 ? [[i ? 7 : -7, 1.2, -2], [(i ? 10 : -10) * lerp(1, 0.65, haul), 0.2, lerp(-2.6, edge, spread)]] : []));
    hose(step === 5 ? [[0, 1.8, -2], [0, 0.8, -3.2], [0, -0.5, -4.5]] : []);
    // 魚群：右舷へ集まる→船の下をくぐって網の上へ
    if (step === 0) school.set(0, lerp(-8, -3, p), lerp(26, STAR, p), lerp(9, 5.5, p));
    else if (step === 1) school.set(0, -3, STAR, 5);
    else if (step === 2) {
      const k = span(p, 0.15, 1);
      school.set(0, -3 - Math.sin(k * Math.PI) * 2.5, lerp(STAR, PORT, k), 5);
    } else if (step === 3) school.set(0, -2, PORT, 4);
    else if (step === 4) school.set(0, lerp(-2, -0.9, p), lerp(PORT, -5, p), lerp(4, 2, p));
    else school.set(0, -0.8, -5, lerp(2, 0.5, p + Math.sin(t) * 0));
  };
}

export const NET_GEAR = { purse, trawl, kakemawashi, setnet, gill, boatseine, beachseine, oikomi, bouke };
