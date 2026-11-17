import * as THREE from 'three';
import { getDef } from '../tanks/tankData.js';
import { speciesOf } from '../tanks/coralModular.js';
import { removeSubtree, subtree } from '../tanks/coralParts.js';

/**
 * パーツ編集サンゴの操作（growMode: 'add' 追加 / 'extend' 伸縮 / 'remove' 削減）。
 * ctx は InteriorInteraction（raycaster, sceneMgr, _setPointer, toast を使う）。
 */

const cloneNodes = (nodes) => nodes.map((n) => ({ a: [...n.a], b: [...n.b], r: n.r, p: n.p }));

/** タップした三角形が属するノード */
const hitNode = (hit) => hit.object.userData.faceNode?.[hit.faceIndex] ?? 0;

export function startCoralEdit(ctx, item, hit) {
  const def = getDef(item.userData.defId);
  const spec = speciesOf(def);
  let nodes = cloneNodes(item.userData.growth.nodes);
  const idx = hitNode(hit);

  if (ctx.growMode === 'remove') {
    // 枝状：その枝から先をまとめて削る / 個体型：その個体だけ削り、子は親へ付け替え
    const gone = spec.tree ? subtree(nodes, idx).size : 1;
    if (gone >= nodes.length) {
      ctx.toast('これ以上は削減できません', { error: true });
      return null;
    }
    if (!spec.tree) {
      const up = nodes[idx].p;
      nodes.forEach((n) => n.p === idx && (n.p = up));
    }
    nodes = removeSubtree(nodes, idx);
    return { nodes, done: true };
  }

  const hitLocal = item.worldToLocal(hit.point.clone());
  const camDir = ctx.sceneMgr.camera.getWorldDirection(new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, hit.point);
  const edit = { nodes, plane, hitLocal, item };

  if (ctx.growMode === 'add') {
    // 触った点から新しいパーツを生やす（ドラッグで向きと長さ。タップのみなら面の法線方向へ既定長）
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const p2 = item.worldToLocal(hit.point.clone().add(n));
    const nLocal = p2.sub(hitLocal).normalize();
    if (nLocal.y < 0.2) nLocal.y = 0.2;
    nLocal.normalize();
    const par = nodes[idx];
    const tip = hitLocal.clone().addScaledVector(nLocal, spec.addLen);
    nodes.push({ a: hitLocal.toArray(), b: tip.toArray(), r: spec.addR(par), p: idx });
    edit.idx = nodes.length - 1;
    edit.startB = tip.toArray();
    edit.fresh = true;
  } else {
    edit.idx = idx;
    edit.startB = [...nodes[idx].b];
    edit.startSub = !spec.tree ? [] : [...subtree(nodes, idx)].filter((i) => i !== idx).map((i) => ({ i, a: [...nodes[i].a], b: [...nodes[i].b] }));
  }
  return edit;
}

/** ドラッグ：パーツの先端を動かす（伸ばすときは子孫も一緒に移動） */
export function moveCoralEdit(ctx, edit, e) {
  if (!edit || edit.done) return false;
  ctx._setPointer(e);
  const p = ctx.raycaster.ray.intersectPlane(edit.plane, new THREE.Vector3());
  if (!p) return false;
  const d = edit.item.worldToLocal(p).sub(edit.hitLocal);
  if (edit.fresh && d.length() < 0.004) return false; // タップ扱い
  const node = edit.nodes[edit.idx];
  if (edit.fresh) {
    // 新規パーツ：付け根からポインタ位置まで
    const b = edit.hitLocal.clone().add(d);
    if (b.distanceTo(edit.hitLocal) < 0.006) return false;
    node.b = b.toArray();
    return true;
  }
  const nb = new THREE.Vector3(...edit.startB).add(d);
  const a = new THREE.Vector3(...node.a);
  if (nb.distanceTo(a) < 0.005) return false; // 縮めすぎ防止
  node.b = nb.toArray();
  for (const s of edit.startSub) {
    edit.nodes[s.i].a = new THREE.Vector3(...s.a).add(d).toArray();
    edit.nodes[s.i].b = new THREE.Vector3(...s.b).add(d).toArray();
  }
  return true;
}
