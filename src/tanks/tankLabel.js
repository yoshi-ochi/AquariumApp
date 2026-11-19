import { floorLabel } from '../building/blueprint.js';

/** 水槽の表示名。名前が付いていればそれ、無ければ「階 種類」 */
export const MAX_TANK_NAME = 20;
export const defaultTankLabel = (manager, tank) => `${floorLabel(tank.userData.floor)} ${manager.defOf(tank).name}`;
export const tankLabel = (manager, tank) => tank.userData.name || defaultTankLabel(manager, tank);
export const cleanTankName = (s) => String(s ?? '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, MAX_TANK_NAME);
