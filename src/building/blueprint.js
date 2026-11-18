/**
 * 水族館の建物の設計図（データのみ）。地上2階建て＋屋外イルカプール。
 * rect は [x0, z0, x1, z1]（マス番号、両端を含む）。1マス = CELL_SIZE(m)。+Z が正面。
 */
export const CELL_SIZE = 0.9;
export const GRID_X = 40;
export const GRID_Z = 46;
export const FLOOR_COUNT = 2;
/** 1階分の高さ(m) */
export const STORY_H = 3.6;

export const ZONE_TYPE = Object.freeze({ HALL: 'hall', YARD: 'yard', VOID: 'void', OUTDOOR: 'outdoor' });
const { HALL, YARD, VOID, OUTDOOR } = ZONE_TYPE;

export const ZONES = [
  { id: 'entrance', name: 'エントランス', floor: 0, rect: [14, 33, 25, 45], type: HALL, stage: 1, cost: 0, text: '来館者を迎える最初のホール' },
  { id: 'yard1', name: '1Fバックヤード', floor: 0, rect: [2, 16, 37, 20], type: YARD, stage: 1, cost: 0, text: '研究室と繁殖設備を置ける職員エリア' },
  { id: 'coast', name: '近海エリア', floor: 0, rect: [2, 21, 13, 45], type: HALL, stage: 1, cost: 150000, theme: 'temperate', text: '日本近海の生き物を展示すると集客+25%' },
  { id: 'subtropical', name: '亜熱帯エリア', floor: 0, rect: [26, 21, 37, 45], type: HALL, stage: 1, cost: 300000, theme: 'tropical', text: '熱帯の生き物を展示すると集客+25%' },
  { id: 'gallery', name: '2F回廊', floor: 1, rect: [14, 33, 25, 45], type: HALL, stage: 1, cost: 500000, text: '2階の入口。お土産店やカフェに最適' },
  { id: 'yard2', name: '2Fバックヤード', floor: 1, rect: [2, 16, 37, 20], type: YARD, stage: 1, cost: 200000, requires: 'gallery', text: '2階の職員エリア' },
  { id: 'atrium', name: '大水槽ホール', floor: 0, rect: [14, 21, 25, 32], type: HALL, stage: 2, cost: 1500000, text: '2階まで吹き抜けの大水槽を備えたホール' },
  { id: 'deep', name: '深海エリア', floor: 1, rect: [2, 21, 13, 45], type: HALL, stage: 2, cost: 2000000, requires: 'gallery', theme: 'cold', text: '冷たい海の生き物を展示すると集客+25%' },
  { id: 'archive', name: '資料エリア', floor: 1, rect: [26, 21, 37, 45], type: HALL, stage: 2, cost: 1000000, requires: 'gallery', text: '研究の進み方が1.5倍になる' },
  { id: 'pool', name: '屋外イルカプール', floor: 0, rect: [2, 0, 37, 15], type: OUTDOOR, stage: 3, cost: 8000000, text: '2階建ての観客席を備えたショープール' },
];

/** 大水槽ホールを解放すると2階の同じ場所が吹き抜けになる */
export const ATRIUM_VOID = { floor: 1, rect: [14, 21, 25, 32], type: VOID, zone: 'atrium' };

export const START_ZONES = ZONES.filter((z) => z.cost === 0).map((z) => z.id);
export const getZone = (id) => ZONES.find((z) => z.id === id);
export const inRect = ([x0, z0, x1, z1], i, j) => i >= x0 && i <= x1 && j >= z0 && j <= z1;

/** ワールド座標 → マス番号 */
export const cellAt = (x, z) => [Math.floor(x / CELL_SIZE + GRID_X / 2), Math.floor(z / CELL_SIZE + GRID_Z / 2)];

/** その位置のエリア */
export function zoneAt(floor, x, z) {
  const [i, j] = cellAt(x, z);
  return ZONES.find((a) => a.floor === floor && inRect(a.rect, i, j)) ?? null;
}

/** エリアの中心（ワールド座標） */
export function zoneCenter(zone) {
  const [x0, z0, x1, z1] = zone.rect;
  return { x: ((x0 + x1 + 1) / 2 - GRID_X / 2) * CELL_SIZE, z: ((z0 + z1 + 1) / 2 - GRID_Z / 2) * CELL_SIZE };
}

/** 吹き抜けの大水槽の設置位置 */
export const ATRIUM_TANK_POS = zoneCenter(getZone('atrium'));
