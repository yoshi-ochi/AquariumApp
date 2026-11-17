import { akabana, akayagi, umieda, xenia, junceella } from './coralTrees.js';
import { usukami, kikumeishi, shakogai, tama } from './coralModules.js';

/** パーツ編集できるサンゴ（growth: 'modular'）の種一覧。shape → 種仕様 */
export const MODULAR_SPECIES = { akabana, akayagi, umieda, xenia: xenia, junceella, usukami, kikumeishi, shakogai, tama };

/** growth.nodes が無ければ seed から初期形を作り、描画する */
function makeBuilder(spec) {
  return (g, def, { seed = 1, growth }) => {
    const nodes = growth?.nodes?.length ? growth.nodes : spec.defaults(seed);
    if (growth) growth.nodes = nodes; // 以降の編集の起点
    spec.build(g, nodes, seed);
  };
}

export const MODULAR_BUILDERS = Object.fromEntries(Object.entries(MODULAR_SPECIES).map(([k, s]) => [`mod_${k}`, makeBuilder(s)]));

export const speciesOf = (def) => MODULAR_SPECIES[def.shape.replace(/^mod_/, '')];
