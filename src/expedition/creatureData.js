// 展示生物と採取先の定義（データのみ）。len は全長(m)、slots は水槽の収容枠の消費量。
export const RARITY = { 1: 'コモン', 2: 'レア', 3: '激レア' };
export const RARITY_WEIGHT = { 1: 60, 2: 30, 3: 10 };

const c = (id, name, shape, len, rarity, slots, appeal, colors, extra = {}) => ({ id, name, shape, len, rarity, slots, appeal, colors, ...extra });

export const CREATURES = [
  // 磯
  c('mejina', 'メジナ', 'fish', 0.14, 1, 1, 0.4, { body: 0x3f5560, belly: 0x8fa3a8, fin: 0x2c3d46 }),
  c('kasago', 'カサゴ', 'fish', 0.12, 1, 1, 0.5, { body: 0xa8452f, belly: 0xe2b08c, fin: 0x7c2f22 }, { bands: 3, band: 0x6e2c20 }),
  c('hakofugu', 'ハコフグ', 'disc', 0.09, 2, 1, 1.2, { body: 0xe3c23f, belly: 0xf3e6a0, fin: 0xc99a2e }),
  c('ishidai', 'イシダイ', 'disc', 0.18, 3, 2, 3, { body: 0xd6d8cf, belly: 0xeeeee6, fin: 0x2d3338 }, { bands: 4, band: 0x23282d }),
  // サンゴ礁
  c('kakure', 'カクレクマノミ', 'fish', 0.07, 1, 1, 0.8, { body: 0xef7a1f, belly: 0xf59a42, fin: 0xd9601a }, { bands: 3, band: 0xffffff }),
  c('nanyouhagi', 'ナンヨウハギ', 'disc', 0.1, 1, 1, 0.9, { body: 0x1f55c9, belly: 0x2f6fe0, fin: 0xf2d33c }),
  c('chocho', 'チョウチョウウオ', 'disc', 0.11, 2, 1, 1.6, { body: 0xf3d54a, belly: 0xfaf0b4, fin: 0xe0a92c }, { bands: 2, band: 0x2a2a2e }),
  c('tsunodashi', 'ツノダシ', 'disc', 0.13, 3, 2, 3.5, { body: 0xf5efd8, belly: 0xffffff, fin: 0xf0cf3e }, { bands: 3, band: 0x1f2226 }),
  // 外洋
  c('maaji', 'マアジ', 'fish', 0.2, 1, 2, 1.2, { body: 0x8fa9b8, belly: 0xe6edf0, fin: 0x6f8795 }),
  c('mizukurage', 'ミズクラゲ', 'jelly', 0.16, 1, 2, 1.6, { body: 0xdbe8f5, belly: 0xf5d9e6, fin: 0xeaf2fa }),
  c('shiira', 'シイラ', 'long', 0.6, 2, 8, 6, { body: 0x2fa58c, belly: 0xe8d34e, fin: 0x2467b0 }),
  c('manta', 'オニイトマキエイ', 'ray', 1.2, 3, 24, 30, { body: 0x27323d, belly: 0xe9edf0, fin: 0x1d262f }),
  // 深海
  c('kinmedai', 'キンメダイ', 'fish', 0.3, 1, 3, 3, { body: 0xd83a2e, belly: 0xf0a08a, fin: 0xb32a22 }),
  c('mizuuo', 'ミズウオ', 'long', 0.7, 1, 6, 4, { body: 0x6c7b86, belly: 0xb9c4cb, fin: 0x3f4a53 }),
  c('mendako', 'メンダコ', 'jelly', 0.15, 2, 2, 8, { body: 0xd9674a, belly: 0xeb9a7e, fin: 0xc55238 }),
  c('ryugu', 'リュウグウノツカイ', 'long', 1.6, 3, 30, 45, { body: 0xdfe5ea, belly: 0xf4f6f8, fin: 0xd8323f }),
];

export const getCreature = (id) => CREATURES.find((x) => x.id === id);

export const DESTINATIONS = [
  { id: 'iso', name: '近くの磯', text: '小さな魚が多い、はじめての採取地', stage: 1, cost: 3000, seconds: 60, pool: ['mejina', 'kasago', 'hakofugu', 'ishidai'] },
  { id: 'reef', name: 'サンゴ礁', text: '色あざやかな熱帯魚が暮らす海', stage: 1, cost: 12000, seconds: 180, pool: ['kakure', 'nanyouhagi', 'chocho', 'tsunodashi'] },
  { id: 'ocean', name: '外洋', text: '大型の回遊魚に出会える沖合', stage: 2, cost: 60000, seconds: 600, pool: ['maaji', 'mizukurage', 'shiira', 'manta'] },
  { id: 'deep', name: '深海', text: '光の届かない海の珍しい生き物', stage: 3, cost: 300000, seconds: 1800, pool: ['kinmedai', 'mizuuo', 'mendako', 'ryugu'] },
];

export const getDestination = (id) => DESTINATIONS.find((d) => d.id === id);
