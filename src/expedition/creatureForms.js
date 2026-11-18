/**
 * 魚の体形。h: 体高/全長、w: 体幅/全長、head: 頭の丸み（小さいほど吻が尖る）、
 * ped: 尾の付け根の太さ（体高比）、hump: 頭の上のこぶ、
 * dorsal / anal: [開始, 終了, 高さ（体高比）, 後方の伸び]、tail: 尾びれの形、tailH: 尾びれの大きさ、pect: 胸びれの大きさ
 */
export const FORMS = {
  perch: { h: 0.3, w: 0.14, head: 0.62, ped: 0.26, dorsal: [0.26, 0.76, 0.34, 0.2], anal: [0.6, 0.8, 0.26, 0.2], tail: 'fork', tailH: 0.9, pect: 0.5 },
  grouper: { h: 0.32, w: 0.22, head: 0.8, ped: 0.32, dorsal: [0.2, 0.82, 0.32, 0], anal: [0.62, 0.82, 0.26, 0], tail: 'round', tailH: 0.8, pect: 0.7 },
  cod: { h: 0.24, w: 0.17, head: 0.72, ped: 0.2, dorsal: [0.26, 0.86, 0.3, 0], anal: [0.46, 0.86, 0.26, 0], tail: 'cut', tailH: 0.95, pect: 0.5 },
  clown: { h: 0.42, w: 0.2, head: 0.85, ped: 0.42, dorsal: [0.26, 0.82, 0.3, 0], anal: [0.62, 0.82, 0.28, 0], tail: 'round', tailH: 0.72, pect: 0.65 },
  tang: { h: 0.62, w: 0.13, head: 0.7, ped: 0.2, dorsal: [0.2, 0.86, 0.14, 0], anal: [0.46, 0.86, 0.14, 0], tail: 'cut', tailH: 0.62, pect: 0.34 },
  disc: { h: 0.76, w: 0.12, head: 0.52, ped: 0.22, dorsal: [0.26, 0.84, 0.2, 0.1], anal: [0.5, 0.84, 0.2, 0.1], tail: 'cut', tailH: 0.5, pect: 0.3 },
  moorish: { h: 0.8, w: 0.11, head: 0.46, ped: 0.16, dorsal: [0.3, 0.72, 0.9, 0.5], anal: [0.54, 0.8, 0.3, 0.1], tail: 'cut', tailH: 0.45, pect: 0.26 },
  bat: { h: 0.95, w: 0.1, head: 0.76, ped: 0.16, dorsal: [0.36, 0.76, 0.62, 0.3], anal: [0.42, 0.76, 0.62, 0.3], tail: 'cut', tailH: 0.34, pect: 0.2 },
  box: { h: 0.46, w: 0.42, head: 0.95, ped: 0.26, dorsal: [0.66, 0.76, 0.24, 0], anal: [0.68, 0.78, 0.22, 0], tail: 'round', tailH: 0.62, pect: 0.34, boxy: true },
  lump: { h: 0.82, w: 0.72, head: 1, ped: 0.2, dorsal: [0.7, 0.8, 0.1, 0], anal: [0.72, 0.8, 0.1, 0], tail: 'round', tailH: 0.42, pect: 0.3 },
  tuna: { h: 0.25, w: 0.14, head: 0.5, ped: 0.1, dorsal: [0.3, 0.5, 0.42, 0.2], anal: [0.62, 0.76, 0.3, 0.2], tail: 'lunate', tailH: 1.2, pect: 0.6 },
  needle: { h: 0.1, w: 0.06, head: 0.3, ped: 0.26, dorsal: [0.66, 0.76, 0.5, 0], anal: [0.68, 0.78, 0.5, 0], tail: 'fork', tailH: 1.5, pect: 0.7 },
  dolphin: { h: 0.24, w: 0.1, head: 1, ped: 0.14, dorsal: [0.08, 0.9, 0.44, 0], anal: [0.54, 0.9, 0.3, 0], tail: 'lunate', tailH: 1.3, pect: 0.5, hump: 0.3 },
  lancet: { h: 0.1, w: 0.06, head: 0.3, ped: 0.3, dorsal: [0.24, 0.46, 2.6, 0.2], anal: [0.66, 0.82, 0.6, 0], tail: 'fork', tailH: 1.6, pect: 0.9 },
  ribbon: { h: 0.075, w: 0.014, head: 0.6, ped: 0.1, dorsal: [0.02, 0.98, 0.5, 0], tail: 'none', crest: true, pect: 0.5, wave: 2.6 },
  eel: { h: 0.14, w: 0.11, head: 0.95, ped: 0.24, dorsal: [0.16, 0.97, 0.4, 0], anal: [0.5, 0.97, 0.34, 0], tail: 'round', tailH: 0.7, pect: 0.7, wave: 1.8 },
  mola: { h: 0.86, w: 0.2, head: 0.9, ped: 0.8, dorsal: [0.68, 0.8, 0.72, 0.1], anal: [0.68, 0.8, 0.72, 0.1], tail: 'clavus', tailH: 0.8, pect: 0.14, cut: 0.86 },
  hump: { h: 0.4, w: 0.2, head: 0.8, ped: 0.32, dorsal: [0.3, 0.82, 0.22, 0.2], anal: [0.62, 0.82, 0.22, 0.2], tail: 'round', tailH: 0.72, pect: 0.5, hump: 0.42 },
  shark: { h: 0.17, w: 0.15, head: 0.36, ped: 0.18, dorsal: [0.36, 0.5, 0.95, 0.35], anal: [0.74, 0.8, 0.3, 0.2], tail: 'hetero', tailH: 1.5, pect: 1.7, gills: true },
  hammer: { h: 0.15, w: 0.13, head: 0.36, ped: 0.18, dorsal: [0.34, 0.48, 1.3, 0.3], anal: [0.74, 0.8, 0.3, 0.2], tail: 'hetero', tailH: 1.6, pect: 1.6, gills: true, hammer: true },
  coelacanth: { h: 0.26, w: 0.16, head: 0.8, ped: 0.34, dorsal: [0.34, 0.44, 0.5, 0.1], anal: [0.72, 0.8, 0.4, 0], tail: 'lobed', tailH: 1, pect: 1.1 },
  barreleye: { h: 0.24, w: 0.16, head: 0.5, ped: 0.22, dorsal: [0.52, 0.62, 0.3, 0], anal: [0.7, 0.8, 0.24, 0], tail: 'fork', tailH: 0.8, pect: 0.7, dome: true },
};
