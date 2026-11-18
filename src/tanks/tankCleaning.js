import * as THREE from 'three';
import { CLEANING } from '../management/opsData.js';

/** 水槽の汚れ：進行の計算、掃除の開始と完了、水の濁りとアカポチの表示 */
const CARE = 'care';
const MAX_MURK = 0.38;
const noRaycast = () => {};

/** 水質管理設備による掃除間隔の延長倍率 */
let intervalBoost = 1;
export const setCleanIntervalBoost = (k) => (intervalBoost = k);

export const cleanSpec = (defId) => CLEANING[defId];

/** 汚れ具合。1 以上で掃除が必要 */
export function dirtLevel(tank, now = Date.now()) {
  const c = tank.userData.clean;
  if (!c) return 0;
  return (now - c.last) / (CLEANING[tank.userData.defId].interval * 1000 * intervalBoost);
}

export const isCleaning = (tank) => !!tank.userData.clean?.until;
export const needsCleaning = (tank, now = Date.now()) => !isCleaning(tank) && dirtLevel(tank, now) >= 1;

/** 集客への影響。掃除の期限を過ぎると徐々に下がり、最低5割 */
export function cleanAppealFactor(tank, now = Date.now()) {
  const d = dirtLevel(tank, now);
  return d <= 1 ? 1 : Math.max(0.5, 1 - (d - 1) * 0.5);
}

export function startCleaning(tank, seconds, crew, now = Date.now()) {
  Object.assign(tank.userData.clean, { until: now + seconds * 1000, crew });
}

/** 作業中の清掃員の人数 */
export const busyCleaners = (tanks) => tanks.reduce((s, t) => s + (t.userData.clean?.crew ?? 0), 0);

/** 終わった掃除を完了させ、完了した水槽を返す */
export function finishCleaning(tanks, now = Date.now()) {
  return tanks.filter((t) => {
    const c = t.userData.clean;
    if (!c?.until || c.until > now) return false;
    t.userData.clean = { last: c.until };
    return true;
  });
}

let dotMaterial = null;
function getDotMaterial() {
  if (dotMaterial) return dotMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(32, 32, 31, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ef3b3b';
  g.beginPath();
  g.arc(32, 32, 25, 0, Math.PI * 2);
  g.fill();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  dotMaterial = new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
  dotMaterial.userData.shared = true;
  return dotMaterial;
}

function buildCare(tank) {
  const I = tank.userData.interior;
  const group = new THREE.Group();
  group.name = CARE;
  const dot = new THREE.Sprite(getDotMaterial());
  dot.scale.setScalar(0.022);
  dot.position.y = Math.max(I.waterTop + 0.12, tank.userData.topY ?? 0);
  dot.renderOrder = 998;
  dot.raycast = noRaycast;
  dot.visible = false;
  group.add(dot);
  group.userData.dot = dot;
  // 濁り（トンネル・哺乳類用は形が複雑なので対象外）
  if (!I.tunnel && !I.swim) {
    const h = Math.max(0.02, I.waterTop - I.floorY);
    const geo = I.shape === 'cylinder' ? new THREE.CylinderGeometry(I.radius * 0.98, I.radius * 0.98, h, 24) : new THREE.BoxGeometry(I.halfW * 1.97, h, I.halfD * 1.97);
    const murk = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x70903c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    murk.position.y = I.floorY + h / 2;
    murk.renderOrder = 3;
    murk.raycast = noRaycast;
    murk.visible = false;
    group.add(murk);
    group.userData.murk = murk;
  }
  tank.add(group);
  return group;
}

/** 汚れに合わせて表示を更新する */
export function updateCareVisual(tank, now = Date.now()) {
  const group = tank.getObjectByName(CARE) ?? buildCare(tank);
  const { dot, murk } = group.userData;
  dot.visible = needsCleaning(tank, now);
  if (!murk) return;
  const k = isCleaning(tank) ? 0 : THREE.MathUtils.clamp((dirtLevel(tank, now) - 0.4) / 1.6, 0, 1);
  murk.visible = k > 0;
  murk.material.opacity = k * MAX_MURK;
}
