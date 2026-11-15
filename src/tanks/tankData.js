// オブジェクト定義（データのみ。メッシュ生成は tankBuilder.js）
// 単位はすべてメートル。size は回転0のときの幅(x)・高さ(y)・奥行(z)。

export const CATEGORY = Object.freeze({
  TANK: 'tank',
  STRUCTURE: 'structure',
  INTERIOR: 'interior',
});

export const CATEGORY_LABELS = {
  [CATEGORY.TANK]: '水槽',
  [CATEGORY.STRUCTURE]: '館内オブジェ',
  [CATEGORY.INTERIOR]: '水槽内オブジェ',
};

const withCategory = (category) => (def) => ({ requiredStage: 1, ...def, category });

export const TANK_DEFS = [
  { id: 'cube30', name: '30cmキューブ', shape: 'box', size: { w: 0.3, h: 0.3, d: 0.3 }, price: 3000, appeal: 1 },
  { id: 'tank45', name: '45cm水槽', shape: 'box', size: { w: 0.45, h: 0.3, d: 0.3 }, price: 6000, appeal: 2 },
  { id: 'tank60', name: '60cm水槽', shape: 'box', size: { w: 0.6, h: 0.36, d: 0.3 }, price: 12000, appeal: 3 },
  { id: 'tank120', name: '120cm水槽', shape: 'box', size: { w: 1.2, h: 0.45, d: 0.45 }, price: 45000, appeal: 8 },
  { id: 'tank180', name: '180cm水槽', shape: 'box', size: { w: 1.8, h: 0.6, d: 0.6 }, price: 90000, appeal: 15 },
  { id: 'round', name: '円形水槽', shape: 'cylinder', size: { w: 1.2, h: 1.2, d: 1.2 }, price: 80000, appeal: 14 },
  { id: 'tunnel', name: '大型トンネル水槽', shape: 'tunnel', size: { w: 4, h: 3, d: 5 }, price: 600000, appeal: 120, requiredStage: 2 },
  { id: 'mammal', name: '海生哺乳類用水槽', shape: 'mammal', size: { w: 5, h: 1.6, d: 4 }, landRatio: 0.35, price: 900000, appeal: 160, requiredStage: 2 },
].map(withCategory(CATEGORY.TANK));

export const STRUCTURE_DEFS = [
  { id: 'stand60', name: '水槽台 60cm', shape: 'stand', size: { w: 0.6, h: 0.7, d: 0.32 }, price: 5000, supportsTanks: true },
  { id: 'stand120', name: '水槽台 120cm', shape: 'stand', size: { w: 1.2, h: 0.7, d: 0.47 }, price: 12000, supportsTanks: true },
  { id: 'stand180', name: '水槽台 180cm', shape: 'stand', size: { w: 1.8, h: 0.7, d: 0.62 }, price: 20000, supportsTanks: true },
  { id: 'wall', name: '仕切り壁', shape: 'wall', size: { w: 3, h: 2.4, d: 0.12 }, price: 8000 },
  { id: 'staffDoor', name: '飼育員用ドア', shape: 'staffDoor', size: { w: 0.9, h: 2.05, d: 0.14 }, price: 20000, wallMount: true },
  { id: 'entrance', name: '館内入口', shape: 'entrance', size: { w: 3, h: 2.8, d: 0.6 }, price: 30000 },
].map(withCategory(CATEGORY.STRUCTURE));

// ---- 水槽内オブジェ ----------------------------------------------------------
// group: カタログのタブ。growth: ドラッグで成長できる種類（'colony' = 群体が広がる / 'driftwood' = 枝・幹）

const ROCK_SIZES = [
  { cm: 10, size: { w: 0.1, h: 0.08, d: 0.1 }, price: 500, appeal: 0.2 },
  { cm: 30, size: { w: 0.3, h: 0.22, d: 0.3 }, price: 2000, appeal: 0.6 },
  { cm: 50, size: { w: 0.5, h: 0.35, d: 0.5 }, price: 5000, appeal: 1.2 },
  { cm: 100, size: { w: 1, h: 0.6, d: 1 }, price: 15000, appeal: 3 },
];
// coralline は従来の ID（rock10 など）を維持
const ROCK_PALETTES = [
  { id: 'coralline', label: '石灰藻', suffix: '' },
  { id: 'dark', label: '黒め', suffix: '_dark' },
  { id: 'brown', label: '茶色め', suffix: '_brown' },
  { id: 'gray', label: 'グレー', suffix: '_gray' },
];
const ROCK_DEFS = ROCK_PALETTES.flatMap((p) =>
  ROCK_SIZES.map((r) => ({
    id: `rock${r.cm}${p.suffix}`,
    name: `ライブロック${r.cm === 100 ? '1m' : `${r.cm}cm`}・${p.label}`,
    shape: 'liveRock',
    palette: p.id,
    size: r.size,
    price: r.price,
    appeal: r.appeal,
    group: 'rock',
  })),
);

const CORAL_DEFS = [
  { id: 'acropora', name: 'ミドリイシ', shape: 'acropora', size: { w: 0.16, h: 0.1, d: 0.16 }, price: 6000, appeal: 2 },
  { id: 'tosaka', name: 'トサカ', shape: 'tosaka', size: { w: 0.12, h: 0.12, d: 0.12 }, price: 4500, appeal: 1.6 },
  { id: 'brain', name: 'ノウサンゴ', shape: 'brain', size: { w: 0.12, h: 0.06, d: 0.12 }, price: 5000, appeal: 1.6 },
  { id: 'euphyllia', name: 'ナガレハナサンゴ', shape: 'euphyllia', size: { w: 0.12, h: 0.09, d: 0.12 }, price: 5500, appeal: 1.8 },
  { id: 'gsp', name: 'スターポリプ', shape: 'gsp', size: { w: 0.14, h: 0.02, d: 0.14 }, price: 2500, appeal: 1 },
  { id: 'xenia', name: 'ウミアザミ', shape: 'xenia', size: { w: 0.1, h: 0.07, d: 0.1 }, price: 3000, appeal: 1.2 },
].map((d) => ({ ...d, group: 'coral', growth: 'colony' }));

const DECOR_DEFS = [
  { id: 'driftwood', name: '流木', shape: 'driftwood', size: { w: 0.4, h: 0.25, d: 0.15 }, price: 3000, appeal: 0.8, growth: 'driftwood' },
  { id: 'aeration', name: 'エアレーション', shape: 'airstone', size: { w: 0.05, h: 0.03, d: 0.05 }, price: 1500, appeal: 0.3, bubbles: true },
  { id: 'plants', name: '海藻・水草', shape: 'plants', size: { w: 0.3, h: 0.25, d: 0.2 }, price: 2500, appeal: 0.8, growth: 'colony' },
].map((d) => ({ ...d, group: 'decor' }));

export const INTERIOR_DEFS = [...ROCK_DEFS, ...CORAL_DEFS, ...DECOR_DEFS].map(withCategory(CATEGORY.INTERIOR));

/** カタログのタブ */
export const GROUP_LABELS = {
  tank: '水槽',
  structure: '館内オブジェ',
  rock: 'ライブロック',
  coral: 'サンゴ',
  decor: '流木・海藻',
};
export const groupOf = (def) => def.group ?? def.category;

/** 館内モードで配置できる定義 */
export const HALL_DEFS = [...TANK_DEFS, ...STRUCTURE_DEFS];
export const ALL_DEFS = [...HALL_DEFS, ...INTERIOR_DEFS];

const defMap = new Map(ALL_DEFS.map((d) => [d.id, d]));

export function getDef(id) {
  const def = defMap.get(id);
  if (!def) throw new Error(`Unknown object definition: ${id}`);
  return def;
}

export function hasDef(id) {
  return defMap.has(id);
}
