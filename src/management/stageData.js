// ステージ（館の規模）定義。level は 1 始まり。
// cellsX × cellsZ のマスが床面積（形状編集でもマス数＝面積は変わらない）。
export const STAGES = [
  { level: 1, name: '10畳の一部屋', width: 4.5, depth: 3.6, cellsX: 10, cellsZ: 8, wallHeight: 2.6, maxFloors: 3, upgradeCost: 0, visitorFactor: 4 },
  { level: 2, name: '小規模水族館', width: 16, depth: 12, cellsX: 16, cellsZ: 12, wallHeight: 3.2, maxFloors: 5, upgradeCost: 500000, visitorFactor: 6 },
  { level: 3, name: '大型総合水族館', width: 40, depth: 30, cellsX: 20, cellsZ: 15, wallHeight: 4.5, maxFloors: 8, upgradeCost: 3000000, visitorFactor: 9 },
];

export const STARTING_MONEY = 300000;
/** 来館者1人あたりの毎秒の収入（円） */
export const INCOME_PER_VISITOR = 2;
/** 削除時の返金率 */
export const REFUND_RATE = 0.5;
