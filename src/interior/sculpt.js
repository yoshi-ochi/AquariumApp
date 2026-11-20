import * as THREE from 'three';
import { compressOn } from '../online/saveCodec.js';

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

const toB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** 削る前の形を覚えておく（保存は元の形からの差分だけにする） */
export const rememberBase = (geo) => (geo.userData.base = geo.attributes.position.array.slice());

/** 差分の単位（0.05mm）。int16 で ±1.6m まで表せる */
const Q = 20000;
const DELTA = 'd1:';

/**
 * 頂点座標を保存用の文字列にする。
 *   d1:… 元の形から動いた頂点だけ（頂点番号 uint32 ＋ 移動量 int16×3）。岩1個で数百バイト〜
 *   それ以外 … 全頂点の座標（Float32）をそのまま base64（旧形式）
 */
export function encodePositions(geo) {
  const arr = geo.attributes.position.array;
  const base = geo.userData.base;
  if (compressOn() && base?.length === arr.length) {
    const moved = [];
    let ok = true;
    for (let i = 0; i < arr.length; i += 3) {
      const d = [0, 1, 2].map((k) => Math.round((arr[i + k] - base[i + k]) * Q));
      if (!d[0] && !d[1] && !d[2]) continue;
      if (d.some((v) => Math.abs(v) > 32767)) ok = false;
      moved.push([i / 3, d]);
    }
    if (ok) {
      const view = new DataView(new ArrayBuffer(moved.length * 10));
      moved.forEach(([n, [dx, dy, dz]], k) => {
        view.setUint32(k * 10, n, true);
        view.setInt16(k * 10 + 4, dx, true);
        view.setInt16(k * 10 + 6, dy, true);
        view.setInt16(k * 10 + 8, dz, true);
      });
      return DELTA + toB64(new Uint8Array(view.buffer));
    }
  }
  return toB64(new Uint8Array(arr.buffer.slice(0)));
}

/** 保存データから頂点座標を復元（頂点数が一致しない場合は無視）。geo は元の形のまま渡す */
export function applyEncodedPositions(geo, code) {
  const pos = geo.attributes.position;
  if (code.startsWith(DELTA)) {
    const bytes = fromB64(code.slice(DELTA.length));
    const view = new DataView(bytes.buffer);
    for (let o = 0; o + 10 <= bytes.length; o += 10) {
      const n = view.getUint32(o, true);
      if (n >= pos.count) return false;
      for (let k = 0; k < 3; k++) pos.array[n * 3 + k] += view.getInt16(o + 4 + k * 2, true) / Q;
    }
  } else {
    const arr = new Float32Array(fromB64(code).buffer);
    if (arr.length !== pos.array.length) return false;
    pos.array.set(arr);
  }
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
