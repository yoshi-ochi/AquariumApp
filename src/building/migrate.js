import { TankManager } from '../tanks/tankManager.js';
import { CATEGORY } from '../tanks/tankData.js';
import { FloorPlan, CELL } from '../room/floorPlan.js';
import { ZONES, START_ZONES, FLOOR_COUNT, zoneCenter, getZone } from './blueprint.js';

/** 旧ステージで既に使えていた広さに相当するエリア */
export function zonesForLegacyStage(level) {
  return ZONES.filter((z) => z.cost === 0 || (level >= 2 && z.stage === 1) || (level >= 3 && z.stage <= 3)).map((z) => z.id);
}

const halfOf = (manager, o) => TankManager.footprintHalf(manager.defOf(o), o.rotation.y);
const overlaps = (a, b) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz;

/** 空いている場所を探す。見つからなければ null */
function findSpot(plans, placed, hx, hz, wantYard) {
  for (const plan of plans) {
    const b = plan.bounds();
    for (let z = b.z1 - hz; z >= b.z0 + hz; z -= 0.45) for (let x = b.x0 + hx; x <= b.x1 - hx; x += 0.45) {
      if (!plan.containsRect(x, z, hx, hz) || (plan.typeAt(x, z) === CELL.YARD) !== wantYard) continue;
      const box = { x, z, hx: hx + 0.3, hz: hz + 0.3, floor: plan.floor };
      if (!placed.some((p) => p.floor === plan.floor && overlaps(p, box))) return box;
    }
  }
  return null;
}

/**
 * 自由な床形状だった旧レイアウトを新しい建物へ移す。水槽の中身は保ったまま、
 * 入りきらない物だけ在庫へ戻す。戻り値は解放済みエリアの一覧。
 */
export function migrateLegacyLayout({ manager, level, inventory, expeditions, economy }) {
  const unlocked = new Set([...START_ZONES, ...zonesForLegacyStage(level)]);
  const plans = Array.from({ length: FLOOR_COUNT }, (_, f) => new FloorPlan(f, unlocked));
  const entrance = zoneCenter(getZone('entrance'));
  const all = [...manager.objects.values()];
  // 水槽台に載った水槽は台と一緒に動かす
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  const placed = [];

  for (const o of all) {
    if (carried.has(o)) continue;
    const def = manager.defOf(o);
    if (def.wallMount) {
      manager.remove(o);
      economy.earn(def.price);
      continue;
    }
    delete o.userData.embed;
    const { hx, hz } = halfOf(manager, o);
    const home = { x: o.position.x + entrance.x, z: o.position.z + entrance.z, hx, hz, floor: 0 };
    const keep = plans[0].containsRect(home.x, home.z, hx, hz) && !placed.some((p) => p.floor === 0 && overlaps(p, home));
    const spot = keep ? home : findSpot(plans, placed, hx, hz, false);
    if (!spot) {
      for (const item of [o, ...riders.get(o)]) stow(item, { manager, inventory, expeditions, economy });
      continue;
    }
    const dx = spot.x - o.position.x;
    const dz = spot.z - o.position.z;
    for (const item of [o, ...riders.get(o)]) {
      item.position.x += dx;
      item.position.z += dz;
      item.userData.floor = spot.floor;
      delete item.userData.embed;
    }
    placed.push({ ...spot, hx, hz });
  }
  for (let f = 0; f < FLOOR_COUNT; f++) manager.refreshElevations(f);
  return [...unlocked];
}

/** 置けない物を在庫とお金に戻す */
function stow(o, { manager, inventory, expeditions, economy }) {
  const def = manager.defOf(o);
  for (const [id, n] of Object.entries(o.userData.creatures ?? {})) expeditions.give(id, n);
  if (o.userData.clip) economy.earn(manager.contentsValue(o));
  if (def.category === CATEGORY.TANK) inventory.add(def.id);
  else economy.earn(def.price);
  manager.remove(o);
}
