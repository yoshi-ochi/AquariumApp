/**
 * 水面モーションの事前計算（ベイク）。
 *
 * 波数ベクトル (kx, ky) を整数に、時間周波数も整数にとった正弦波の和で高さ場を作るので、
 * 結果は「空間方向にタイル状に継ぎ目なく繋がり」「時間方向にループする」。
 * これを SIZE×SIZE の画像 × FRAMES 枚にして保存し、描画時は読み出すだけにする（スマホ向け）。
 *
 * 1テクセル = RGBA8: R,G = x/z 方向の傾き（0.5 中心）, B = 高さ（0..1）, A = 255
 */
export const WAVE_PARAMS = Object.freeze({ size: 128, frames: 32, waves: 28, seed: 7 });

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 風向きに偏った波のスペクトル（短い波ほど小さく、時間周波数は分散関係 ω∝√k を近似） */
function makeWaves({ waves, frames, seed }) {
  const rand = mulberry32(seed);
  const list = [];
  const wind = 0.6; // 風向き（rad）
  while (list.length < waves) {
    const kx = Math.round((rand() - 0.5) * 16);
    const ky = Math.round((rand() - 0.5) * 16);
    const k = Math.hypot(kx, ky);
    if (k < 1) continue;
    const align = Math.cos(Math.atan2(ky, kx) - wind);
    if (align < -0.2) continue; // 風に逆らう波は少なく
    const amp = (0.4 + 0.6 * Math.max(0, align)) / Math.pow(k, 1.4);
    // ループ内で整数回まわる時間周波数（最低1）
    const omega = Math.max(1, Math.round(Math.sqrt(k) * 1.6)) * (rand() < 0.5 ? 1 : 2);
    list.push({ kx, ky, amp, omega: Math.min(omega, frames / 2), phase: rand() * Math.PI * 2 });
  }
  return list;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * @returns {Promise<Uint8Array>} 長さ size*size*4*frames（フレームごとに連続）
 */
export async function bakeWaves({ size, frames, waves, seed } = WAVE_PARAMS, onProgress) {
  const list = makeWaves({ waves, frames, seed });
  const N = size * size;
  const TAU = Math.PI * 2;

  // 空間位相の sin/cos を先に求めておけば、各フレームは加算と乗算だけで済む
  //   sin(p - ωt) = sin p cos ωt - cos p sin ωt
  const sinP = list.map(() => new Float32Array(N));
  const cosP = list.map(() => new Float32Array(N));
  list.forEach((w, i) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = TAU * ((w.kx * x) / size + (w.ky * y) / size) + w.phase;
        sinP[i][y * size + x] = Math.sin(p);
        cosP[i][y * size + x] = Math.cos(p);
      }
    }
  });

  const height = new Float32Array(N * frames);
  const sx = new Float32Array(N * frames);
  const sz = new Float32Array(N * frames);
  let maxH = 1e-6;
  let maxS = 1e-6;

  for (let f = 0; f < frames; f++) {
    const off = f * N;
    list.forEach((w, i) => {
      const wt = (TAU * w.omega * f) / frames;
      const cw = Math.cos(wt);
      const sw = Math.sin(wt);
      const gx = TAU * w.kx * w.amp; // d/dx の係数
      const gy = TAU * w.ky * w.amp;
      const sp = sinP[i];
      const cp = cosP[i];
      for (let j = 0; j < N; j++) {
        const s = sp[j] * cw - cp[j] * sw; // sin(p - ωt)
        const c = cp[j] * cw + sp[j] * sw; // cos(p - ωt)
        height[off + j] += w.amp * s;
        sx[off + j] += gx * c;
        sz[off + j] += gy * c;
      }
    });
    for (let j = 0; j < N; j++) {
      maxH = Math.max(maxH, Math.abs(height[off + j]));
      maxS = Math.max(maxS, Math.abs(sx[off + j]), Math.abs(sz[off + j]));
    }
    onProgress?.((f + 1) / frames);
    if (f % 4 === 3) await nextFrame(); // スプラッシュのアニメーションを止めない
  }

  const out = new Uint8Array(N * frames * 4);
  for (let j = 0; j < N * frames; j++) {
    out[j * 4] = Math.round(127.5 + (sx[j] / maxS) * 127.5);
    out[j * 4 + 1] = Math.round(127.5 + (sz[j] / maxS) * 127.5);
    out[j * 4 + 2] = Math.round(127.5 + (height[j] / maxH) * 127.5);
    out[j * 4 + 3] = 255;
  }
  return out;
}

export function waveCacheKey({ size, frames, waves, seed } = WAVE_PARAMS) {
  return `waves-v1-${size}x${frames}-w${waves}-s${seed}`;
}
