import { NET_GEAR } from './gearNets.js';
import { LINE_GEAR } from './gearLines.js';

export { BED } from './gearKit.js';

/** 漁法 id → 動きを作る関数 */
export const GEAR = { ...NET_GEAR, ...LINE_GEAR };
