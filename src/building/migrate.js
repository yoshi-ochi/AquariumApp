import { TankManager } from '../tanks/tankManager.js';
import { CATEGORY } from '../tanks/tankData.js';
import { FloorPlan, CELL } from '../room/floorPlan.js';
import { ZONES, FLOOR_COUNT, BASEMENT, PLAN_FLOORS, ATRIUM_TANK_POS, getZone, oldZoneOffset, zoneCenter } from './blueprint.js';

/** 自由な床形状の時代に使えていた広さに相当するエリア */
export function zonesForLegacyStage(level) {
  return ZONES.filter((z) => z.cost === 0 || (level >= 2 && z.stage === 1) || (level >= 3 && z.stage <= 3)).map((z) => z.id);
}

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

/** 元のエリアに対応する、新しい間取りでの位置 */
function preferred(o, wasBuilding) {
  const { x, z } = o.position;
  const old = wasBuilding ? oldZoneOffset(o.userData.floor, x, z) : null;
  const zone = getZone(old?.id ?? 'entrance');
  const c = zoneCenter(zone);
  return { x: c.x + (old?.dx ?? x), z: c.z + (old?.dz ?? z), floor: zone.floor };
}

/**
 * 間取りを選ぶ前のレイアウトを、選んだ間取りへ移す。水槽の中身は保ったまま、
 * 入りきらない物だけ在庫へ戻す。
 */
export function migrateToLayout({ manager, unlocked, wasBuilding, inventory, expeditions, economy }) {
  const plans = Array.from({ length: FLOOR_COUNT }, (_, f) => new FloorPlan(f, unlocked));
  const all = [...manager.objects.values()];
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  const placed = [];

  for (const o of all) {
    if (carried.has(o)) continue;
    const def = manager.defOf(o);
    if (def.atrium) {
      Object.assign(o.position, { x: ATRIUM_TANK_POS.x, z: ATRIUM_TANK_POS.z });
      continue;
    }
    if (def.wallMount) {
      manager.remove(o);
      economy.earn(def.price);
      continue;
    }
    delete o.userData.embed;
    const { hx, hz } = TankManager.footprintHalf(def, o.rotation.y);
    const home = { ...preferred(o, wasBuilding), hx, hz };
    const plan = plans[home.floor];
    const keep = plan.containsRect(home.x, home.z, hx, hz) && !placed.some((p) => p.floor === home.floor && overlaps(p, home));
    const spot = keep ? home : findSpot(plans, placed, hx, hz, !!def.yardOnly);
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
}

/** 間取りの変更で置けなくなった物だけを、空いている場所へ移す */
export function relocateInvalid({ manager, unlocked, inventory, expeditions, economy }) {
  const plans = new Map(PLAN_FLOORS.map((f) => [f, new FloorPlan(f, unlocked)]));
  const all = [...manager.objects.values()];
  const riders = new Map(all.map((o) => [o, manager.getRiders(o)]));
  const carried = new Set([...riders.values()].flat());
  const roots = all.filter((o) => !carried.has(o) && !o.userData.embed && !manager.defOf(o).atrium);
  const box = (o) => ({ x: o.position.x, z: o.position.z, floor: o.userData.floor, ...TankManager.footprintHalf(manager.defOf(o), o.rotation.y) });
  const fits = (o) => plans.get(o.userData.floor).containsRect(o.position.x, o.position.z, box(o).hx, box(o).hz);
  const placed = roots.filter(fits).map(box);
  for (const o of roots.filter((r) => !fits(r))) {
    const { hx, hz } = box(o);
    const spot = findSpot([...plans.values()].filter((p) => p.floor !== BASEMENT), placed, hx, hz, !!manager.defOf(o).yardOnly);
    if (!spot) {
      for (const item of [o, ...riders.get(o)]) stow(item, { manager, inventory, expeditions, economy });
      continue;
    }
    const [dx, dz] = [spot.x - o.position.x, spot.z - o.position.z];
    for (const item of [o, ...riders.get(o)]) {
      item.position.x += dx;
      item.position.z += dz;
      item.userData.floor = spot.floor;
    }
    placed.push({ ...spot, hx, hz });
  }
  for (const f of PLAN_FLOORS) manager.refreshElevations(f);
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
