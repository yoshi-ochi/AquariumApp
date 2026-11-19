/**
 * 水槽建造：プレイヤーが形と寸法を決めて作る水槽。
 * 定義の ID に形と寸法（cm）を埋め込むので、セーブには ID だけ残せば復元できる。
 *   例: cx_box_150_60_45（幅150・高さ60・奥行45cm） / cx_cylinder_120_150_120
 */
import { addDef, hasDef, getDef } from './tankData.js';

export const BUILD_SHAPES = {
  box: { label: '四角', limits: { w: [20, 400], h: [20, 250], d: [20, 300] } },
  cylinder: { label: '円柱', limits: { w: [30, 300], h: [30, 300] } },
};
const ID_RE = /^cx_(box|cylinder)_(\d+)_(\d+)_(\d+)$/;
const H = 3600;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

/** 寸法（cm）を範囲内に丸める。円柱は奥行＝直径 */
export function normalizeSpec({ shape, w, h, d }) {
  const s = BUILD_SHAPES[shape] ? shape : 'box';
  const L = BUILD_SHAPES[s].limits;
  const W = clamp(w, L.w);
  return { shape: s, w: W, h: clamp(h, L.h), d: s === 'cylinder' ? W : clamp(d, L.d) };
}

export const customId = (spec) => `cx_${spec.shape}_${spec.w}_${spec.h}_${spec.d}`;

export function parseCustomId(id) {
  const m = ID_RE.exec(id ?? '');
  return m ? normalizeSpec({ shape: m[1], w: +m[2], h: +m[3], d: +m[4] }) : null;
}

/** 水量（m³） */
export function volumeOf(spec) {
  const [w, h, d] = [spec.w / 100, spec.h / 100, spec.d / 100];
  return spec.shape === 'cylinder' ? Math.PI * (w / 2) ** 2 * h : w * h * d;
}

/** 特注なので既製品より2割高い。集客は水量に応じる */
export const buildPrice = (spec) => Math.round((1.2 * (3000 + 140000 * volumeOf(spec) ** 0.9)) / 100) * 100;
export const buildAppeal = (spec) => Math.max(1, Math.round(22 * volumeOf(spec) ** 0.8 * 10) / 10);

export function customDef(spec) {
  const s = normalizeSpec(spec);
  const name = s.shape === 'cylinder' ? `特注円柱 Φ${s.w}×高さ${s.h}cm` : `特注 ${s.w}×${s.d}×${s.h}cm`;
  return { id: customId(s), name, shape: s.shape, size: { w: s.w / 100, h: s.h / 100, d: s.d / 100 }, price: buildPrice(s), appeal: buildAppeal(s), custom: true };
}

let onNew = () => {};
/** 新しく定義を加えたとき（サムネイル撮影など）の処理 */
export const setCustomHandler = (fn) => (onNew = fn);

/** 定義へ登録して返す（登録済みならそのまま） */
export function registerCustom(spec) {
  const def = customDef(spec);
  if (hasDef(def.id)) return getDef(def.id);
  const d = addDef(def);
  onNew(d);
  return d;
}

/** ID 一覧のうち建造水槽を登録する（セーブの読込前に呼ぶ） */
export function registerCustomIds(ids) {
  for (const id of ids) {
    const spec = parseCustomId(id);
    if (spec) registerCustom(spec);
  }
}

/** 掃除の間隔と費用。小さい水槽は職員、大きい水槽はダイバー */
export function customCleanSpec(def) {
  const v = def.size.w * def.size.h * def.size.d * (def.shape === 'cylinder' ? Math.PI / 4 : 1);
  const crew = v < 0.1 ? 1 : v < 0.5 ? 2 : v < 2 ? 3 : 0;
  return {
    interval: Math.round((4 + 20 * Math.min(1, Math.sqrt(v / 4))) * H),
    staff: crew ? { crew, cost: Math.round((300 + 2500 * v ** 0.8) / 10) * 10, seconds: Math.round(15 + 80 * v ** 0.6) } : null,
    diver: v >= 0.2 ? { cost: Math.round((8000 + 12000 * v ** 0.8) / 100) * 100, seconds: Math.round(40 + 60 * Math.sqrt(v)) } : null,
  };
}
