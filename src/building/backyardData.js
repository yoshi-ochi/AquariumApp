// バックヤードの研究と繁殖の定義（データのみ）

export const RESEARCH = [
  { id: 'display', name: '展示解説', text: '1レベルごとに来館者+5%' },
  { id: 'field', name: '採取技術', text: '1レベルごとに遠征費用-10%' },
  { id: 'breeding', name: '繁殖技術', text: '1レベルごとに繁殖時間-25%。Lv2で激レアも繁殖可能' },
  { id: 'welfare', name: '労務管理', text: '1レベルごとに賃金-5%' },
];

const COSTS = [10, 30, 90];
export const MAX_RESEARCH = COSTS.length;
/** 次のレベルに必要なポイント（最大なら null） */
export const researchCost = (level) => COSTS[level] ?? null;

/** 研究員1人・研究室1室あたりの毎分ポイント */
export const POINTS_PER_MIN = 1;
export const ARCHIVE_BONUS = 1.5;

/** レア度ごとの繁殖時間（時間） */
export const BREED_HOURS = { 1: 2, 2: 6, 3: 24 };
export const breedHours = (rarity, level) => Math.round(BREED_HOURS[rarity] * (1 - level * 0.25) * 10) / 10;
