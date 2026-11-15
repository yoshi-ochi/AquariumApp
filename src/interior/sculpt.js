import * as THREE from 'three';

/**
 * ライブロックの局所スカルプト。
 * ブラシ中心（メッシュローカル座標）から半径内の頂点を、ブラシ法線方向へ
 * なめらかな減衰付きで押し出す（inflate）／押し込む（deflate）。
 * ジオメトリは頂点共有（mergeVertices 済み）なので面は裂けない。
 */
export const BRUSH_DEFAULTS = Object.freeze({ mode: null, radius: 0.06, strength: 0.5 });

const _v = new THREE.Vector3();

export function sculptAt(mesh, center, normal, { mode, radius, strength }) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const sign = mode === 'deflate' ? -1 : 1;
  const step = sign * strength * radius * 0.05; // 1フレームあたり
  const r2 = radius * radius;
  let touched = 0;

  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const d2 = _v.distanceToSquared(center);
    if (d2 >= r2) continue;
    const f = 1 - d2 / r2;
    const w = f * f; // 中心ほど強い滑らかな減衰
    _v.addScaledVector(normal, step * w);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
    touched++;
  }
  if (!touched) return false;

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // レイキャストは boundingSphere で早期判定するので必ず更新する
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return true;
}

/** 頂点座標を保存用に base64 化 */
export function encodePositions(geo) {
  const bytes = new Uint8Array(geo.attributes.position.array.buffer.slice(0));
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** 保存データから頂点座標を復元（頂点数が一致しない場合は無視） */
export function applyEncodedPositions(geo, b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const arr = new Float32Array(bytes.buffer);
  const pos = geo.attributes.position;
  if (arr.length !== pos.array.length) return false;
  pos.array.set(arr);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return true;
}

/** ブラシ範囲を示すリング（ワールド座標で表示） */
export function createBrushCursor() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }),
  );
  ring.renderOrder = 1000;
  ring.visible = false;
  return ring;
}
