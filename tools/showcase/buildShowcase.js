/**
 * 見本の水族館（最大レベル）を組み立てて、セーブデータ（JSON）を返す。開発用。
 * 使い方（npm run dev 中のブラウザのコンソール）:
 *   const { buildShowcase } = await import('/tools/showcase/buildShowcase.js');
 *   const data = await buildShowcase(window.__app);
 * 配置はゲームと同じ床の判定（FloorPlan）で確かめ、物どうしは通路を空けて重ならないように置く。
 */
import { ZONES, CELL_SIZE, GRID_X, GRID_Z, SERVICE_WIDTH, EXHIBIT_ZONES, ZONE_TYPE, getZone, setLayout } from '/src/building/blueprint.js';
import { FloorPlan, CELL } from '/src/room/floorPlan.js';
import { TankManager } from '/src/tanks/tankManager.js';
import { getDef } from '/src/tanks/tankData.js';
import { registerCustom } from '/src/tanks/customTanks.js';
import { CREATURES, getCreature } from '/src/expedition/creatureData.js';
import { tankCapacity, tankVolume, syncLife } from '/src/expedition/tankLife.js';
import { ensureCare, zoneOf } from '/src/expedition/husbandry.js';
import { mulberry32 } from '/src/tanks/random.js';

const LAYOUT = 'spiral';
const WINGS = ['wing1', 'wing2'];
const ANNEXES = ['annex1', 'annex2', 'annex3'];
const wx = (i) => (i - GRID_X / 2) * CELL_SIZE;
const wz = (j) => (j - GRID_Z / 2) * CELL_SIZE;
const PREDATORS = new Set(['shark', 'hammer', 'eel', 'squid', 'whale']);
const BIG_FORMS = new Set(['shark', 'hammer', 'whale', 'ray', 'mola', 'turtle', 'tuna']);
const JELLY = new Set(['jelly', 'clione']);
/** 群れで見せる種類（他は数匹ずつ） */
const SCHOOL = new Set(['maiwashi', 'sanma', 'nishin', 'maaji', 'sakuraebi', 'deba', 'kakure', 'nenbutsu', 'kingyohana', 'sorasuzume', 'gingame', 'katakuchi', 'kibinago', 'rurisuzume', 'mizukurage', 'clione', 'chinanago']);

export async function buildShowcase(app) {
  const { manager, economy, expeditions, ops, snapshot, applySnapshot } = app;
  const rand = mulberry32(20261120);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  // ---- 最大レベル・全エリア解放の空の館から始める ----
  setLayout(LAYOUT);
  const base = snapshot();
  const all = ZONES.filter((z) => !z.wing && !z.annex).map((z) => z.id);
  base.room = { ...base.room, layout: LAYOUT, unlocked: [...all, ...ANNEXES, ...WINGS], walls: {}, atriumGiven: false };
  base.objects = [];
  base.economy = { money: 80000000, stageIndex: 3, floor: 0 };
  base.expedition = { ...base.expedition, extraTeams: 6, trips: [], creatures: {} };
  base.room.zoneNames = { coast: '日本の海', subtropical: 'サンゴ礁の海', deep: '深海の世界', archive: 'くらげ館', annex1: '地下トンネル水槽', annex2: '世界の川と干潟', annex3: '小さな生き物の部屋', wing1: '大洋の大水槽', wing2: 'くらげと深海のギャラリー' };
  base.room.zoneLook = {
    coast: { floor: '#d9cdb0', wall: '#2c5a70' }, subtropical: { floor: '#efe3c4', wall: '#1d7c97' },
    deep: { floor: '#1d2433', wall: '#101a2c' }, archive: { floor: '#262a3d', wall: '#2b2550' },
    annex1: { floor: '#203646', wall: '#173a52' }, annex2: { floor: '#cdbf9b', wall: '#3f6b5a' }, annex3: { floor: '#e8e2d2', wall: '#5b7f9a' },
    wing1: { floor: '#173547', wall: '#0e2a3c' }, wing2: { floor: '#151a2b', wall: '#1a1838' },
  };
  applySnapshot(base);
  const unlocked = new Set(base.room.unlocked);
  const plans = new Map();
  const planOf = (f) => plans.get(f) ?? plans.set(f, new FloorPlan(f, unlocked)).get(f);
  const placed = []; // { floor, x, z, hx, hz }
  const tanks = [];

  // ---- 置く：床の上か・重ならないか（clear は周りに空ける通路） ----
  function place(defId, floor, x, z, { rotY = 0, clear = 0.5, yard = false, onStand = false } = {}) {
    const def = getDef(defId);
    const { hx, hz } = TankManager.footprintHalf(def, rotY);
    const plan = planOf(floor);
    if (!plan.containsRect(x, z, hx, hz)) return null;
    if (yard !== (plan.typeAt(x, z) === CELL.YARD)) return null;
    if (!onStand && placed.some((p) => p.floor === floor && Math.abs(p.x - x) < p.hx + hx + clear && Math.abs(p.z - z) < p.hz + hz + clear)) return null;
    const obj = manager.add(defId, { x, z, rotY, floor });
    if (!onStand) placed.push({ floor, x, z, hx, hz });
    if (def.category === 'tank') tanks.push(obj);
    return obj;
  }
  /** 水槽台に載せた水槽 */
  function onStand(size, floor, x, z, rotY) {
    const stand = place(`stand${size}`, floor, x, z, { rotY });
    if (!stand) return null;
    return place(`tank${size}`, floor, x, z, { rotY, onStand: true });
  }
  const custom = (spec) => registerCustom(spec).id;

  /** エリアの内側の範囲（展示室は壁の裏の管理通路ぶん内側） */
  function inner(id, extra = 0.35) {
    const z = getZone(id);
    const [x0, z0, x1, z1] = z.rects[0];
    const pad = (EXHIBIT_ZONES.includes(id) ? SERVICE_WIDTH * CELL_SIZE : 0) + extra;
    return { floor: z.floor, x0: wx(x0) + pad, z0: wz(z0) + pad, x1: wx(x1 + 1) - pad, z1: wz(z1 + 1) - pad };
  }

  /** 長い2辺の壁沿いに、水槽台つき水槽を並べ、中央に大きな水槽を置く */
  function gallery(id, { centers = [], wallStep = 2.6, wallSizes = ['180', '120'] } = {}) {
    const r = inner(id);
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const n = Math.max(1, Math.floor((len - 0.6) / wallStep));
    const start = (len - (n - 1) * wallStep) / 2;
    for (let k = 0; k < n; k++) {
      const size = wallSizes[k % wallSizes.length];
      const d = getDef(`stand${size}`).size.d / 2 + 0.05;
      const t = start + k * wallStep;
      if (alongX) {
        onStand(size, r.floor, r.x0 + t, r.z0 + d, 0);
        onStand(size, r.floor, r.x0 + t, r.z1 - d, 0);
      } else {
        onStand(size, r.floor, r.x0 + d, r.z0 + t, Math.PI / 2);
        onStand(size, r.floor, r.x1 - d, r.z0 + t, Math.PI / 2);
      }
    }
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    centers.forEach(([defId, k], i) => {
      const off = (centers.length > 1 ? (i / (centers.length - 1) - 0.5) : 0) * len * 0.55;
      const [x, z] = alongX ? [cx + off, cz] : [cx, cz + off];
      place(defId, r.floor, x, z, { clear: 0.9, rotY: alongX ? 0 : Math.PI / 2 });
    });
    return r;
  }

  // ---- 展示：テーマ（水温）と水槽の大きさに合う生き物を、見た目に自然な数だけ入れる ----
  const pool = (theme) => CREATURES.filter((c) => zoneOf(c.id) === theme);
  /** 1種あたりの数：体の大きさで上限を決め、水量でも絞る（群れる小魚は多め） */
  function countFor(c, def, volume) {
    const school = SCHOOL.has(c.id);
    const byLen = school ? (c.len < 0.1 ? 24 : 16) : c.len < 0.08 ? 6 : c.len < 0.15 ? 5 : c.len < 0.4 ? 3 : c.len < 1 ? 2 : 1;
    const byVol = Math.floor(volume / (c.len ** 3 * 0.8));
    return Math.max(1, Math.min(byLen, byVol));
  }
  function stock(tank, theme, { big = false, jelly = false, prefer = [] } = {}) {
    const def = manager.defOf(tank);
    const cap = tankCapacity(def);
    const I = tank.userData.interior;
    const span = Math.min(def.size.w, def.size.d);
    const long = Math.max(def.size.w, def.size.d);
    const volume = tankVolume(def);
    let list = pool(theme).filter((c) => (jelly ? JELLY.has(c.form) : !JELLY.has(c.form)));
    // 体が水槽の奥行の4割・長さの3割に収まる生き物だけ
    list = list.filter((c) => c.len <= span * 0.4 && c.len <= long * 0.3 && (big || !BIG_FORMS.has(c.form)));
    const hunters = list.filter((c) => PREDATORS.has(c.form));
    const peaceful = list.filter((c) => !PREDATORS.has(c.form));
    // 捕食者を入れるなら、食べられない大きさの生き物とだけ組む
    let group = big && hunters.length && rand() < 0.5 ? [...hunters, ...peaceful.filter((c) => c.len >= 0.5)] : peaceful;
    for (const id of prefer) {
      const c = getCreature(id);
      if (c && c.len <= span * 0.5 && !group.includes(c)) group = [c, ...group];
    }
    if (!group.length) return;
    const kinds = Math.min(group.length, long >= 3 ? 4 : long >= 1.5 ? 3 : long >= 0.9 ? 2 : 1 + (rand() < 0.4 ? 1 : 0));
    const chosen = new Set(prefer.filter((id) => group.some((c) => c.id === id)));
    while (chosen.size < kinds) chosen.add(pick(group).id);
    const creatures = {};
    let used = 0;
    for (const c of [...chosen].map(getCreature)) {
      const n = Math.min(countFor(c, def, volume), Math.floor((cap * 0.6 - used) / c.slots));
      if (n <= 0) continue;
      creatures[c.id] = n;
      used += n * c.slots;
    }
    if (!Object.keys(creatures).length) return;
    tank.userData.creatures = creatures;
    ensureCare(tank).water = theme;
    syncLife(tank);
    for (const id of Object.keys(creatures)) expeditions.markSeen(id);
  }

  // ---- 水槽内のレイアウト：岩は背面のガラスに寄せ、前面には触れさせない。前には背の低い海藻・サンゴ ----
  const ROCKS = ['rock100', 'rock50', 'rock30', 'rock10'];
  /** 岩はこぶで寸法より少し大きくなるので、1.2倍で見積もる */
  const R_PAD = 1.2;
  function decorate(tank, theme) {
    const I = tank.userData.interior;
    if (!I || I.tunnel || I.swim) return;
    const cyl = I.shape === 'cylinder';
    const W = I.halfW * 2;
    const D = cyl ? I.radius * 2 : I.halfD * 2;
    const waterH = I.waterTop - I.floorY;
    // 奥行の6割・幅の5割・水深の6割に収まる、いちばん大きな岩
    const rock = ROCKS.find((id) => {
      const z = getDef(id).size;
      return z.d * R_PAD <= D * 0.75 && z.w * R_PAD <= W * 0.5 && z.h <= waterH * 0.6;
    });
    const add = (id, x, z, rotY = rand() * 6.28, y = I.floorY) => manager.createInterior(tank, id, { x, y, z, rotY });
    const fits = (id, x, z) => {
      const s = getDef(id).size;
      const r = (Math.max(s.w, s.d) * R_PAD) / 2;
      if (s.h > waterH - 0.03) return false;
      // 背面側（z<0）はガラスに寄せてよいが、前面側（z>0）には3cm以上の隙間を空ける
      const gap = z > 0 ? 0.03 : 0.005;
      return cyl ? Math.hypot(x, z) + r <= I.radius - gap : Math.abs(x) + r <= I.halfW - 0.02 && Math.abs(z) + r <= I.halfD - gap;
    };
    const put = (id, x, z) => fits(id, x, z) && add(id, x, z);
    let backZ = 0;
    if (rock) {
      const s = getDef(rock).size;
      const rd = (s.d * R_PAD) / 2;
      // 背面のガラスにほぼ接するところ（円形水槽は奥側の弧に沿って）
      backZ = cyl ? -(I.radius - rd - 0.02) : -(I.halfD - rd - 0.008);
      const n = Math.max(1, Math.min(4, Math.floor((W * 0.9) / (s.w * R_PAD * 1.1))));
      for (let k = 0; k < n; k++) {
        const x = n === 1 ? (rand() - 0.5) * W * 0.15 : (-0.5 + (k + 0.5) / n) * W * 0.85;
        const z = cyl ? backZ * Math.cos(Math.asin(Math.min(0.9, Math.abs(x) / I.radius))) : backZ;
        if (fits(rock, x, z)) add(rock, x, z);
      }
      // 奥の岩の上にサンゴ・海藻を載せる
      const topY = I.floorY + s.h * 0.8;
      const onTop = theme === 'tropical' ? ['acropora', 'umieda', 'euphyllia', 'brain', 'tosaka', 'akayagi'] : theme === 'temperate' ? ['hondawara', 'tengusa', 'umiuchiwa', 'kajime'] : ['akayagi', 'junceella'];
      for (let k = 0; k < Math.min(3, n); k++) {
        const id = pick(onTop);
        const x = (-0.5 + (k + 0.5) / Math.min(3, n)) * W * 0.6;
        if (getDef(id).size.h < waterH - s.h - 0.05) add(id, x, backZ * 0.8, rand() * 6.28, topY);
      }
    }
    // 前側（中央より手前）には背の低いものだけ
    const frontZ = (cyl ? I.radius : I.halfD) * 0.35;
    const lowTropical = ['brain', 'gsp', 'kikumeishi', 'shakogai', 'tama', 'umibudou', 'xenia', 'usukami'];
    const lowTemperate = ['amamo', 'aosa', 'umiuchiwa', 'tengusa'];
    const tall = ['kajime', 'hondawara', 'kelp'];
    const spots = W >= 1 ? 5 : W >= 0.5 ? 3 : 1;
    for (let k = 0; k < spots; k++) {
      const x = (-0.5 + (k + 0.5) / spots) * W * 0.8 + (rand() - 0.5) * 0.04;
      const z = frontZ * (rand() * 0.8 - 0.2);
      if (theme === 'tropical') put(pick(lowTropical), x, z);
      else if (theme === 'temperate') put(pick(lowTemperate), x, z);
      else if (rand() < 0.4) put('junceella', x, z);
    }
    // 温帯の背の高い水槽には、奥に海中林（カジメ・ホンダワラ、深ければジャイアントケルプ）
    if (theme === 'temperate') {
      const n = W >= 1 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const x = (-0.5 + (k + 0.5) / n) * W * 0.7;
        const id = waterH > 1.3 && rand() < 0.7 ? 'kelp' : pick(tall);
        put(id, x + 0.05, backZ * 0.55);
      }
      if (W >= 1) put('driftwood', (rand() - 0.5) * W * 0.3, 0);
    }
    put('aeration', I.halfW * 0.6, backZ * 0.5);
  }

  const fill = (list, theme, opts = {}) => list.forEach((t) => {
    stock(t, theme, { big: manager.defOf(t).size.w >= 2, ...opts });
    if (!opts.jelly) decorate(t, theme);
  });

  // ---- 1F：日本の海（温帯）・サンゴ礁の海（熱帯） ----
  let mark = tanks.length;
  gallery('coast', { centers: [[custom({ shape: 'cylinder', w: 220, h: 220 }), 1], [custom({ shape: 'box', w: 300, h: 180, d: 140 }), 1]] });
  fill(tanks.slice(mark), 'temperate');
  mark = tanks.length;
  gallery('subtropical', { centers: [[custom({ shape: 'box', w: 320, h: 200, d: 150 }), 1], [custom({ shape: 'cylinder', w: 240, h: 220 }), 1]] });
  fill(tanks.slice(mark), 'tropical');

  // 大水槽：外洋の大型魚
  const atrium = [...manager.objects.values()].find((o) => manager.defOf(o).atrium);
  if (atrium) {
    atrium.userData.creatures = { jinbei: 1, manta: 2, kuromaguro: 5, buri: 8, maiwashi: 40, shiira: 3, gingame: 14 };
    for (const id of Object.keys(atrium.userData.creatures)) if (!getCreature(id)) delete atrium.userData.creatures[id];
    ensureCare(atrium).water = 'tropical';
    syncLife(atrium);
    Object.keys(atrium.userData.creatures).forEach((id) => expeditions.markSeen(id));
  }

  // エントランス・2F回廊：円形水槽とお店
  for (const id of ['entrance', 'gallery']) {
    const r = inner(id, 0.6);
    const cx = (r.x0 + r.x1) / 2;
    mark = tanks.length;
    place('round', r.floor, cx - 2.2, (r.z0 + r.z1) / 2, { clear: 0.8 });
    place('round', r.floor, cx + 2.2, (r.z0 + r.z1) / 2, { clear: 0.8 });
    fill(tanks.slice(mark), 'tropical');
    place('souvenirShop', r.floor, r.x0 + 1.0, r.z1 - 0.8, { clear: 0.4 });
    place('cafe', r.floor, r.x1 - 1.1, r.z1 - 0.9, { clear: 0.4 });
  }

  // ---- 2F：深海（冷水）・くらげ館 ----
  mark = tanks.length;
  gallery('deep', { centers: [[custom({ shape: 'cylinder', w: 200, h: 200 }), 1]], wallSizes: ['120', '180'] });
  fill(tanks.slice(mark), 'cold');
  mark = tanks.length;
  gallery('archive', { centers: [[custom({ shape: 'cylinder', w: 160, h: 180 }), 1], [custom({ shape: 'cylinder', w: 160, h: 180 }), 1]], wallSizes: ['60', '60', '120'], wallStep: 1.6 });
  tanks.slice(mark).forEach((t) => stock(t, rand() < 0.5 ? 'cold' : 'tropical', { jelly: true, big: true }));

  // ---- 屋外：海獣エリア（イルカ）・ひろば ----
  const marine = getZone('marine');
  if (marine) {
    // 作り付けのアザラシ池の手前（区画の下端の帯）に置く
    const [x0, , x1, z1] = marine.rects[0];
    const m = place('mammal', 0, (wx(x0) + wx(x1 + 1)) / 2, wz(z1 + 1) - 2.25, { clear: 0.2 });
    if (m) stock(m, 'tropical', { big: true, prefer: ['bandou'] });
  }

  // ---- 地下：トンネル水槽・干潟・小さな生き物 ----
  {
    const r = inner('annex1', 0.8);
    mark = tanks.length;
    place('tunnel', r.floor, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, { clear: 0.8 });
    place(custom({ shape: 'box', w: 400, h: 220, d: 160 }), r.floor, (r.x0 + r.x1) / 2, r.z0 + 1.0, { clear: 0.3 });
    fill(tanks.slice(mark), 'tropical');
  }
  mark = tanks.length;
  gallery('annex2', { centers: [[custom({ shape: 'box', w: 360, h: 90, d: 200 }), 1]] });
  fill(tanks.slice(mark), 'temperate');
  mark = tanks.length;
  gallery('annex3', { wallSizes: ['60', '60'], wallStep: 1.3, centers: [['round', 1]] });
  fill(tanks.slice(mark), rand() < 0.5 ? 'tropical' : 'temperate');

  // ---- 別棟1F：大洋の大水槽（直径8mの円形水槽と、壁沿いの大型水槽） ----
  {
    const r = inner('wing1', 1.0);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    mark = tanks.length;
    place(custom({ shape: 'cylinder', w: 800, h: 600 }), r.floor, cx, cz, { clear: 1.5 });
    const wallTank = custom({ shape: 'box', w: 600, h: 300, d: 200 });
    // 壁沿いに大型水槽を2基ずつ、四隅に円形水槽
    for (const s of [-1, 1]) {
      place(wallTank, r.floor, cx + s * 6.5, r.z0 + 1.0, { clear: 0.3 });
      place(wallTank, r.floor, cx + s * 6.5, r.z1 - 1.0, { clear: 0.3 });
      place(wallTank, r.floor, r.x0 + 1.0, cz + s * 6.5, { rotY: Math.PI / 2, clear: 0.3 });
      place(wallTank, r.floor, r.x1 - 1.0, cz + s * 6.5, { rotY: Math.PI / 2, clear: 0.3 });
    }
    const pillar = custom({ shape: 'cylinder', w: 250, h: 300 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) place(pillar, r.floor, cx + a * 8, cz + b * 8, { clear: 0.6 });
    const side = tanks.slice(mark);
    stock(side[0], 'tropical', { big: true, prefer: ['shirowani', 'manta', 'aoumigame'] });
    decorate(side[0], 'tropical');
    side.slice(1).forEach((t, i) => {
      stock(t, i % 2 ? 'tropical' : 'temperate', { big: true });
      decorate(t, i % 2 ? 'tropical' : 'temperate');
    });
    place('souvenirShop', r.floor, r.x0 + 1.2, r.z1 - 1.0, { clear: 0.4 });
    place('cafe', r.floor, r.x1 - 1.3, r.z1 - 1.0, { clear: 0.4 });
  }
  // 別棟2F：くらげと深海のギャラリー
  {
    const r = inner('wing2', 1.0);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    mark = tanks.length;
    const jellyTank = custom({ shape: 'cylinder', w: 180, h: 250 });
    for (let a = 0; a < 8; a++) place(jellyTank, r.floor, cx + Math.cos((a / 8) * Math.PI * 2) * 6.5, cz + Math.sin((a / 8) * Math.PI * 2) * 6.5, { clear: 0.6 });
    tanks.slice(mark).forEach((t, i) => stock(t, i % 2 ? 'cold' : 'tropical', { jelly: true, big: true }));
    mark = tanks.length;
    place(custom({ shape: 'cylinder', w: 400, h: 400 }), r.floor, cx, cz, { clear: 1.0 });
    // 壁沿いに深海の水槽
    const deepTank = custom({ shape: 'box', w: 400, h: 200, d: 150 });
    for (const s of [-1, 0, 1]) {
      place(deepTank, r.floor, cx + s * 8.5, r.z0 + 0.8, { clear: 0.3 });
      place(deepTank, r.floor, cx + s * 8.5, r.z1 - 0.8, { clear: 0.3 });
    }
    for (const s of [-1, 1]) {
      place(deepTank, r.floor, r.x0 + 0.8, cz + s * 5, { rotY: Math.PI / 2, clear: 0.3 });
      place(deepTank, r.floor, r.x1 - 0.8, cz + s * 5, { rotY: Math.PI / 2, clear: 0.3 });
    }
    fill(tanks.slice(mark), 'cold');
  }

  // ---- バックヤード・地下の設備 ----
  const yard = (id, list) => {
    const r = inner(id, 0.5);
    let x = r.x0 + 1.2;
    let z = r.z0 + 1.0;
    for (const defId of list) {
      for (let tries = 0; tries < 40; tries++) {
        if (place(defId, r.floor, x, z, { yard: true, clear: 0.4 })) break;
        x += 1.3;
        if (x > r.x1 - 1) {
          x = r.x0 + 1.2;
          z += 1.6;
        }
        if (z > r.z1 - 0.8) break;
      }
      x += 2.4;
    }
  };
  yard('yard1', ['researchLab', 'breedingTank', 'breedingTank', 'freezer', 'liveFeed', 'foodPrep']);
  yard('yard2', ['researchLab', 'breedingTank', 'freezer']);
  yard('b1a', ['waterPlant', 'cleanCenter', 'holdingTank', 'holdingTank']);
  yard('b1b', ['waterPlant', 'holdingTank', 'holdingTank']);
  yard('b1c', ['cleanCenter', 'holdingTank', 'holdingTank', 'waterPlant']);
  yard('b1d', ['holdingTank', 'holdingTank', 'holdingTank', 'waterPlant', 'cleanCenter', 'holdingTank', 'holdingTank', 'holdingTank', 'freezer', 'liveFeed', 'foodPrep']);

  // ---- 仕上げ：スタッフを必要数＋余裕、在庫に少し生き物、研究 ----
  manager.refreshElevations();
  for (const f of new Set(placed.map((p) => p.floor))) manager.refreshElevations(f);
  // 必要人数は来館者数で決まるので、落ち着くまで待ってから配置する
  let last = '';
  for (let k = 0; k < 20; k++) {
    await new Promise((r) => setTimeout(r, 1000));
    const now = JSON.stringify(ops.required);
    if (now === last && economy.visitors > 1000) break;
    last = now;
  }
  for (const [role, need] of Object.entries(ops.required)) ops.staff[role] = Math.ceil(need * 1.05) + 1;
  for (const id of ['kakure', 'nanyouhagi', 'clione', 'mizukurage', 'tatsu']) if (getCreature(id)) expeditions.give(id, 3);
  economy.setFloor?.(0);
  manager.setFloor(0);
  const data = snapshot();
  return { data, tanks: tanks.length, objects: manager.objects.size, placed: placed.length };
}
