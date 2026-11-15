import * as THREE from 'three';
import { WAVE_PARAMS } from './waveBaker.js';

/**
 * 水面マテリアル（全水槽で共有）。
 * - ベイク済みの波を DataArrayTexture（フレーム = レイヤー）で持ち、時間で2フレームを補間して再生
 * - UV はワールド座標 XZ から計算するので、どの水槽・形状でもタイルが継ぎ目なく繋がり、
 *   水面ジオメトリ（矩形・円・トンネル上面…）の形でそのまま切り取られる
 * - 大きさの違う2オクターブを重ねてタイルの繰り返し感を消す
 * - フレネル反射・空のグラデーション・太陽のハイライトだけの軽量シェーダー
 */

const TILE = 0.6; // 波テクスチャ1枚が覆う一辺（m）
const LOOP_SECONDS = 6; // 1ループの長さ

function placeholderTexture() {
  // ベイク完了までは平らな水面（傾き0 = 128）
  const tex = new THREE.DataArrayTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

const uniforms = {
  uWaves: { value: placeholderTexture() },
  uFrames: { value: 1 },
  uFrame: { value: 0 },
  uTile: { value: TILE },
  uStrength: { value: 0.6 },
  uShallow: { value: new THREE.Color(0x3fb6d8) },
  uDeep: { value: new THREE.Color(0x0e5a8a) },
  uSkyTop: { value: new THREE.Color(0xdff3ff) },
  uSkyHorizon: { value: new THREE.Color(0x8fb8cc) },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.35).normalize() },
  uOpacity: { value: 0.55 },
};

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp sampler2DArray;
  uniform sampler2DArray uWaves;
  uniform float uFrames, uFrame, uTile, uStrength, uOpacity;
  uniform vec3 uShallow, uDeep, uSkyTop, uSkyHorizon, uSunDir;
  varying vec3 vWorld;

  // フレーム間を線形補間して滑らかに再生
  vec4 waveAt(vec2 uv, float frame) {
    float f0 = mod(floor(frame), uFrames);
    float f1 = mod(f0 + 1.0, uFrames);
    return mix(texture(uWaves, vec3(uv, f0)), texture(uWaves, vec3(uv, f1)), fract(frame));
  }

  void main() {
    vec2 uv = vWorld.xz / uTile;
    vec4 a = waveAt(uv, uFrame);
    vec4 b = waveAt(uv * 2.37 + vec2(0.31, 0.73), uFrame * 1.0 + uFrames * 0.5);
    vec2 slope = (a.xy - 0.5) * 2.0 + (b.xy - 0.5);
    vec3 n = normalize(vec3(-slope.x * uStrength, 1.0, -slope.y * uStrength));

    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = max(dot(n, V), 0.0);
    float fresnel = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);

    vec3 R = reflect(-V, n);
    vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y, 0.0, 1.0));
    float rd = max(dot(R, uSunDir), 0.0);
    float sun = pow(rd, 180.0) * 2.5 + pow(rd, 24.0) * 0.18; // 鋭いきらめき + 広いハイライト

    // 波の山ほど明るく（コントラストを強調）、傾きで陰影を付ける
    float h = clamp((a.z * 0.7 + b.z * 0.3 - 0.5) * 2.6 + 0.5, 0.0, 1.0);
    vec3 body = mix(uDeep, uShallow, h);
    body *= 0.72 + 0.4 * max(dot(n, uSunDir), 0.0);
    vec3 col = mix(body, sky, fresnel) + vec3(sun);
    float alpha = clamp(mix(uOpacity, 1.0, fresnel) + sun, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

export const waterSurfaceMaterial = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
waterSurfaceMaterial.userData.shared = true;

/** ベイク結果をテクスチャに設定する */
export function setWaveData(data, { size, frames } = WAVE_PARAMS) {
  const tex = new THREE.DataArrayTexture(data, size, size, frames);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  uniforms.uWaves.value.dispose();
  uniforms.uWaves.value = tex;
  uniforms.uFrames.value = frames;
}

/** 毎フレーム呼ぶ（計算は uniform の更新だけ） */
export function updateWater(elapsedSeconds) {
  const frames = uniforms.uFrames.value;
  uniforms.uFrame.value = ((elapsedSeconds / LOOP_SECONDS) * frames) % frames;
}

/** 水面メッシュ。geometry は水平（XZ 平面）に置いた任意の形 */
export function waterSurfaceMesh(geometry, renderOrder = 1.5) {
  const m = new THREE.Mesh(geometry, waterSurfaceMaterial);
  m.renderOrder = renderOrder; // 水の体積(1)の後、ガラス(2)の前
  m.name = 'waterSurface';
  return m;
}
