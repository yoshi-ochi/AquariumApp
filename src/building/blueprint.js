/**
 * 水族館の間取り（データのみ）。地上2階建て＋屋外イルカプール。
 * rects は [x0, z0, x1, z1]（マス番号、両端を含む）。1マス = CELL_SIZE(m)。+Z が正面。
 * エリアの id と解放条件は全間取りで共通、形と順路だけが間取りごとに変わる。
 */
export const CELL_SIZE = 0.9;
/** 建物の左右に屋外エリアの敷地（各16マス）を持つ */
export const GRID_X = 72;
const SITE_X = 16;
export const GRID_Z = 46;
export const FLOOR_COUNT = 2;
/** 地下1階のフロア番号（地上は 0, 1） */
export const BASEMENT = 2;
export const PLAN_FLOORS = [0, 1, BASEMENT];
export const floorLabel = (floor) => (floor === BASEMENT ? 'B1' : `${floor + 1}F`);
/** 展示室の壁の裏に設ける管理通路の幅（2マス = 1.8m） */
export const SERVICE_WIDTH = 2;
export const EXHIBIT_ZONES = ['coast', 'subtropical', 'deep', 'archive'];
/** 1階分の高さ(m) */
export const STORY_H = 3.6;

export const ZONE_TYPE = Object.freeze({ HALL: 'hall', YARD: 'yard', VOID: 'void', OUTDOOR: 'outdoor' });
const { HALL, YARD, OUTDOOR } = ZONE_TYPE;

const ZONE_META = [
  { id: 'entrance', name: 'エントランス', floor: 0, type: HALL, stage: 1, cost: 0, color: '#7fc8e8', text: '来館者を迎える最初のホール' },
  { id: 'yard1', name: '1Fバックヤード', floor: 0, type: YARD, stage: 1, cost: 0, color: '#c9ccd0', text: '研究室と繁殖設備を置ける職員エリア' },
  { id: 'coast', name: '近海エリア', floor: 0, type: HALL, stage: 1, cost: 150000, theme: 'temperate', color: '#6fbf9a', text: '日本近海の生き物を展示すると集客+25%' },
  { id: 'subtropical', name: '亜熱帯エリア', floor: 0, type: HALL, stage: 1, cost: 300000, theme: 'tropical', color: '#f2b45a', text: '熱帯の生き物を展示すると集客+25%' },
  { id: 'gallery', name: '2F回廊', floor: 1, type: HALL, stage: 1, cost: 500000, color: '#8fd3e0', text: '2階の入口。お土産店やカフェに最適' },
  { id: 'yard2', name: '2Fバックヤード', floor: 1, type: YARD, stage: 1, cost: 200000, requires: 'gallery', color: '#c9ccd0', text: '2階の職員エリア' },
  { id: 'atrium', name: '大水槽ホール', floor: 0, type: HALL, stage: 2, cost: 1500000, color: '#3f8fd0', text: '2階まで吹き抜けの大水槽を備えたホール' },
  { id: 'deep', name: '深海エリア', floor: 1, type: HALL, stage: 2, cost: 2000000, requires: 'gallery', theme: 'cold', color: '#4a5a9c', text: '冷たい海の生き物を展示すると集客+25%' },
  { id: 'archive', name: '資料エリア', floor: 1, type: HALL, stage: 2, cost: 1000000, requires: 'gallery', color: '#b79bd8', text: '研究の進み方が1.5倍になる' },
  { id: 'plaza', name: '屋外ひろば', floor: 0, type: OUTDOOR, open: true, stage: 1, cost: 400000, requires: 'coast', color: '#d9c49a', text: '屋外の多目的エリア。お店や水槽を自由に置ける' },
  { id: 'marine', name: '海獣エリア', floor: 0, type: OUTDOOR, open: true, stage: 2, cost: 1200000, requires: 'plaza', color: '#8aa6b8', text: 'アザラシのプールがある屋外エリア。海獣用水槽も置ける' },
  { id: 'nature', name: '自然再現エリア', floor: 0, type: OUTDOOR, open: true, stage: 3, cost: 3000000, requires: 'subtropical', color: '#7fae62', text: '磯・干潟・小川を再現した屋外エリア' },
  { id: 'b1a', name: '地下機械室', floor: BASEMENT, type: YARD, stage: 1, cost: 0, color: '#9aa4ad', text: '水質管理と予備水槽の基本エリア' },
  { id: 'b1b', name: '地下西ブロック', floor: BASEMENT, type: YARD, stage: 2, cost: 800000, requires: 'b1a', color: '#9aa4ad', text: '設備を増やせる地下の拡張区画' },
  { id: 'b1c', name: '地下東ブロック', floor: BASEMENT, type: YARD, stage: 3, cost: 2500000, requires: 'b1a', color: '#9aa4ad', text: '設備を増やせる地下の拡張区画' },
  { id: 'b1d', name: '地下南ブロック', floor: BASEMENT, type: YARD, stage: 4, cost: 8000000, requires: 'b1c', color: '#9aa4ad', text: '大規模な保持設備を置ける最大の区画' },
  { id: 'pool', name: 'イルカプール', floor: 0, type: OUTDOOR, stage: 3, cost: 8000000, color: '#54c0d8', text: '2階建ての観客席を備えたショープール' },
];

/** 吹き抜けを囲む2階の回廊 */
const ring = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0 + 1, x0, z1 - 1], [x1, z0 + 1, x1, z1 - 1]];

export const LAYOUTS = [
  {
    id: 'spiral',
    name: '回遊らせん型',
    inspired: '大阪・海遊館の、中央の大水槽を巡りながら見る構成に着想',
    summary: '中央の大水槽をぐるりと囲む王道の間取り。どの展示室からも大水槽へ戻れます。',
    style: 'spiral',
    rects: {
      entrance: [[14, 37, 25, 45]], yard1: [[3, 14, 36, 19]], coast: [[3, 20, 13, 41]], subtropical: [[26, 20, 36, 41]],
      atrium: [[14, 20, 25, 36]], pool: [[3, 0, 36, 13]],
      gallery: [[14, 37, 25, 45], ...ring(14, 20, 25, 36)], yard2: [[3, 14, 36, 19]], deep: [[3, 20, 13, 41]], archive: [[26, 20, 36, 41]],
    },
    outdoor: { plaza: [1, 26, 18, 45], marine: [1, 4, 18, 25], nature: [53, 4, 70, 45] },
    voidRect: [15, 21, 24, 35],
    links: [['entrance', 'atrium'], ['atrium', 'coast'], ['atrium', 'subtropical'], ['entrance', 'coast'], ['entrance', 'subtropical'], ['gallery', 'deep'], ['gallery', 'archive'], ['coast', 'plaza'], ['subtropical', 'nature']],
  },
  {
    id: 'descent',
    name: '海の旅路型',
    inspired: '沖縄美ら海水族館の、サンゴ礁から黒潮、深海へ進む順路に着想',
    summary: '展示室を一本道でたどる物語型。奥へ進むほど海が深くなり、最後に大水槽が現れます。',
    style: 'descent',
    rects: {
      entrance: [[28, 33, 38, 45]], coast: [[14, 33, 27, 45]], subtropical: [[2, 33, 13, 45]], atrium: [[2, 19, 15, 32]],
      yard1: [[16, 19, 38, 32]], pool: [[2, 0, 38, 18]],
      gallery: [[28, 33, 38, 45]], archive: [[14, 33, 27, 45]], deep: [[2, 33, 13, 45]], yard2: [[16, 19, 38, 32]],
    },
    outdoor: { plaza: [1, 33, 17, 45], marine: [1, 4, 17, 32], nature: [55, 4, 70, 45] },
    voidRect: [2, 19, 15, 32],
    links: [['entrance', 'coast'], ['coast', 'subtropical'], ['subtropical', 'atrium'], ['gallery', 'archive'], ['archive', 'deep'], ['subtropical', 'plaza'], ['entrance', 'nature']],
    requires: { subtropical: 'coast', atrium: 'subtropical', deep: 'archive', plaza: 'subtropical', nature: 'entrance' },
  },
  {
    id: 'radial',
    name: '放射ギャラリー型',
    inspired: 'ジョージア水族館の、中央ホールから各展示棟へ分かれる構成に着想',
    summary: '十字に広がる展示棟の中心が大ホール。好きな順に回れて、来館者が滞りにくい間取りです。',
    style: 'radial',
    rects: {
      atrium: [[14, 19, 25, 30]], entrance: [[14, 31, 25, 45]], coast: [[1, 19, 13, 30]], subtropical: [[26, 19, 38, 30]],
      yard1: [[1, 31, 13, 42], [26, 31, 38, 42]], pool: [[6, 0, 33, 17]],
      gallery: [[14, 31, 25, 45], ...ring(14, 19, 25, 30)], deep: [[1, 19, 13, 30]], archive: [[26, 19, 38, 30]], yard2: [[1, 31, 13, 42], [26, 31, 38, 42]],
    },
    outdoor: { plaza: [1, 19, 16, 45], marine: [1, 4, 16, 18], nature: [55, 4, 70, 45] },
    voidRect: [15, 20, 24, 29],
    links: [['entrance', 'atrium'], ['atrium', 'coast'], ['atrium', 'subtropical'], ['gallery', 'deep'], ['gallery', 'archive'], ['coast', 'plaza'], ['subtropical', 'nature']],
    // 大ホールの裏で東西の管理通路をつなぐ
    serviceLinks: [[1, 18, 38, 18]],
  },
  {
    id: 'pavilion',
    name: '分棟パビリオン型',
    inspired: 'バレンシア・オセアノグラフィックの、海域ごとに建物を分ける構成に着想',
    summary: '海域ごとの独立した棟を渡り廊下でつなぎます。棟ごとに世界観をはっきり分けられます。',
    style: 'pavilion',
    rects: {
      entrance: [[15, 36, 24, 45], [19, 26, 20, 35], [15, 30, 18, 31], [21, 30, 24, 31]], coast: [[3, 26, 14, 40]], subtropical: [[25, 26, 36, 40]],
      atrium: [[14, 14, 25, 25]], yard1: [[3, 14, 13, 24]], pool: [[2, 0, 37, 12]],
      gallery: [[15, 36, 24, 45], [19, 26, 20, 35], [15, 30, 18, 31], [21, 30, 24, 31], ...ring(14, 14, 25, 25)], deep: [[3, 26, 14, 40]], archive: [[25, 26, 36, 40]], yard2: [[3, 14, 13, 24]],
    },
    outdoor: { plaza: [1, 26, 18, 45], marine: [1, 4, 18, 25], nature: [53, 4, 70, 45] },
    voidRect: [15, 15, 24, 24],
    links: [['entrance', 'coast'], ['entrance', 'subtropical'], ['entrance', 'atrium'], ['gallery', 'deep'], ['gallery', 'archive'], ['coast', 'plaza'], ['subtropical', 'nature']],
    // 離れた棟の管理通路をメインバックヤードへつなぐ渡り通路
    serviceLinks: [[5, 25, 8, 25], [26, 13, 27, 25], [12, 13, 27, 13]],
  },
];

// 建物の区画を敷地の中央へ寄せる（ワールド座標は変わらない）
const shift = ([x0, z0, x1, z1]) => [x0 + SITE_X, z0, x1 + SITE_X, z1];
for (const l of LAYOUTS) {
  for (const id of Object.keys(l.rects)) l.rects[id] = l.rects[id].map(shift);
  l.voidRect = shift(l.voidRect);
  for (const [id, rect] of Object.entries(l.outdoor)) l.rects[id] = [rect];
  l.serviceLinks = (l.serviceLinks ?? []).map(shift);
  Object.assign(l.rects, { b1a: [[28, 20, 43, 33]], b1b: [[18, 20, 27, 33]], b1c: [[44, 20, 53, 33]], b1d: [[18, 34, 53, 43]] });
}

/** 作り付けの景観が占める区画（区画の内側に余白をとる） */
function sceneryRect(id, [x0, z0, x1, z1]) {
  if (id === 'marine') return [x0 + 2, z0 + 2, x1 - 2, z1 - 5];
  if (id === 'nature') return [x0 + 2, z0 + 2, x1 - 3, z1 - 3];
  return null;
}

export const DEFAULT_LAYOUT = LAYOUTS[0].id;
export const START_ZONES = ZONE_META.filter((z) => z.cost === 0).map((z) => z.id);
export const inRect = ([x0, z0, x1, z1], i, j) => i >= x0 && i <= x1 && j >= z0 && j <= z1;
const rectCenter = ([x0, z0, x1, z1]) => ({ x: ((x0 + x1 + 1) / 2 - GRID_X / 2) * CELL_SIZE, z: ((z0 + z1 + 1) / 2 - GRID_Z / 2) * CELL_SIZE });

// 選択中の間取り（setLayout で切り替わる）
export let LAYOUT = LAYOUTS[0];
export let ZONES = [];
export let ATRIUM_VOID = null;
export let ATRIUM_TANK_POS = null;
/** 自由に編集した壁。{ 階: { add: [境目キー], remove: [境目キー] } } */
export let WALL_EDITS = {};
export const setWallEdits = (edits) => (WALL_EDITS = JSON.parse(JSON.stringify(edits ?? {})));

/** プレイヤーが付けたエリア名 { id: 名前 } */
let ZONE_NAMES = {};
export const MAX_ZONE_NAME = 16;
export const defaultZoneName = (id) => ZONE_META.find((z) => z.id === id)?.name ?? id;
/** エリア名を設定する（空なら元の名前に戻す） */
export function setZoneNames(names) {
  ZONE_NAMES = {};
  for (const [id, n] of Object.entries(names ?? {})) {
    const name = String(n ?? '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, MAX_ZONE_NAME);
    if (name && ZONE_META.some((z) => z.id === id)) ZONE_NAMES[id] = name;
  }
  for (const z of ZONES) z.name = ZONE_NAMES[z.id] ?? defaultZoneName(z.id);
  return { ...ZONE_NAMES };
}

export function setLayout(id) {
  LAYOUT = LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
  ZONES = ZONE_META.map((z) => ({ ...z, name: ZONE_NAMES[z.id] ?? z.name, rects: LAYOUT.rects[z.id], requires: LAYOUT.requires?.[z.id] ?? z.requires, scenery: z.open ? sceneryRect(z.id, LAYOUT.rects[z.id][0]) : null }));
  ATRIUM_VOID = { floor: 1, rect: LAYOUT.voidRect, zone: 'atrium' };
  ATRIUM_TANK_POS = rectCenter(LAYOUT.voidRect);
}
setLayout(DEFAULT_LAYOUT);

export const getZone = (id) => ZONES.find((z) => z.id === id);
/** レベル2以降は、そのレベルまでのエリアがレベルアップで解放される（レベル1は購入のみ） */
export const zonesUpToLevel = (level) => (level >= 2 ? ZONES.filter((z) => z.stage <= level).map((z) => z.id) : []);
export const zoneHas = (zone, i, j) => zone.rects.some((r) => inRect(r, i, j));

/** ワールド座標 → マス番号 */
export const cellAt = (x, z) => [Math.floor(x / CELL_SIZE + GRID_X / 2), Math.floor(z / CELL_SIZE + GRID_Z / 2)];

/** その位置のエリア */
export function zoneAt(floor, x, z) {
  const [i, j] = cellAt(x, z);
  return ZONES.find((a) => a.floor === floor && zoneHas(a, i, j)) ?? null;
}

/** エリアの中心（最初の区画の中心。ワールド座標） */
export const zoneCenter = (zone) => rectCenter(zone.rects[0]);

/** 間取りを選ぶ前の建物（旧セーブの移行に使う） */
const OLD_RECTS = {
  entrance: [14, 33, 25, 45], yard1: [2, 16, 37, 20], coast: [2, 21, 13, 45], subtropical: [26, 21, 37, 45], gallery: [14, 33, 25, 45],
  yard2: [2, 16, 37, 20], atrium: [14, 21, 25, 32], deep: [2, 21, 13, 45], archive: [26, 21, 37, 45],
};
/** 旧建物でのエリアと、その中心からのずれ */
export function oldZoneOffset(floor, x, z) {
  const [i, j] = cellAt(x, z);
  const hit = ZONE_META.find((m) => m.floor === floor && OLD_RECTS[m.id] && inRect(shift(OLD_RECTS[m.id]), i, j));
  if (!hit) return null;
  const c = rectCenter(shift(OLD_RECTS[hit.id]));
  return { id: hit.id, dx: x - c.x, dz: z - c.z };
}
