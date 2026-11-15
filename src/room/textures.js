import * as THREE from 'three';

/**
 * 部屋・屋外のプロシージャルテクスチャ。
 * 床・壁用は白〜灰の濃淡で描き、マテリアルの color で好きな色に着色する。
 * scale = テクスチャ1枚がワールドで覆う長さ(m)。UV はメートル単位なので repeat = 1/scale。
 */
const SIZE = 256;
const cache = new Map();

function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

function noise(ctx, r, base, amp, alpha = 1) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (r() - 0.5) * amp;
    img.data[i] = Math.max(0, Math.min(255, (base ?? img.data[i]) + v));
    img.data[i + 1] = Math.max(0, Math.min(255, (base ?? img.data[i + 1]) + v));
    img.data[i + 2] = Math.max(0, Math.min(255, (base ?? img.data[i + 2]) + v));
    img.data[i + 3] = 255 * alpha;
  }
  ctx.putImageData(img, 0, 0);
}

function planks(ctx, r, rows, vertical = false) {
  if (vertical) {
    ctx.translate(SIZE, 0);
    ctx.rotate(Math.PI / 2);
  }
  const h = SIZE / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * SIZE * 0.5;
    while (x < SIZE) {
      const w = SIZE * (0.35 + r() * 0.4);
      ctx.fillStyle = gray(195 + r() * 50);
      ctx.fillRect(x, row * h, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      for (let k = 0; k < 6; k++) {
        const y = row * h + r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + w * 0.3, y + (r() - 0.5) * 5, x + w * 0.7, y + (r() - 0.5) * 5, x + w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, row * h, 2, h);
      x += w;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(0, row * h, SIZE, 2);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function grid(ctx, n, fill, grout, groutW, jitter, r) {
  const s = SIZE / n;
  ctx.fillStyle = gray(grout);
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = gray(fill + (r() - 0.5) * jitter);
      ctx.fillRect(i * s + groutW / 2, j * s + groutW / 2, s - groutW, s - groutW);
    }
  }
}

const PAINTERS = {
  flooring: { scale: 1.2, paint: (ctx, r) => planks(ctx, r, 8) },
  carpet: { scale: 0.5, paint: (ctx, r) => noise(ctx, r, 220, 50) },
  mat: {
    scale: 1.0,
    paint: (ctx, r) => {
      grid(ctx, 2, 225, 175, 3, 25, r);
      // パズルマットの凹凸
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        ctx.arc(i * 128 + 64, j * 128 + 2, 10, 0, Math.PI);
        ctx.fill();
      }
      noise(ctx, r, null, 14);
    },
  },
  tile: { scale: 0.9, paint: (ctx, r) => { grid(ctx, 2, 232, 165, 5, 14, r); noise(ctx, r, null, 8); } },
  plaster: {
    scale: 1.5,
    paint: (ctx, r) => {
      ctx.fillStyle = gray(236);
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let k = 0; k < 220; k++) {
        ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.012)`;
        ctx.beginPath();
        ctx.arc(r() * SIZE, r() * SIZE, 6 + r() * 26, 0, Math.PI * 2);
        ctx.fill();
      }
      noise(ctx, r, null, 10);
    },
  },
  wood: { scale: 1.2, paint: (ctx, r) => planks(ctx, r, 6, true) },
  wallTile: { scale: 0.6, paint: (ctx, r) => { grid(ctx, 4, 238, 180, 4, 10, r); } },
  brick: {
    scale: 1.0,
    paint: (ctx, r) => {
      ctx.fillStyle = gray(200);
      ctx.fillRect(0, 0, SIZE, SIZE);
      const rows = 8;
      const h = SIZE / rows;
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? 32 : 0;
        for (let x = -64 + off; x < SIZE; x += 64) {
          ctx.fillStyle = gray(150 + r() * 70);
          ctx.fillRect(x + 2, row * h + 2, 60, h - 4);
        }
      }
      noise(ctx, r, null, 18);
    },
  },
  // バックヤード（コンクリート）
  concrete: {
    scale: 1.5,
    paint: (ctx, r) => {
      ctx.fillStyle = gray(200);
      ctx.fillRect(0, 0, SIZE, SIZE);
      noise(ctx, r, null, 22);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, SIZE, 2);
      ctx.fillRect(0, 0, 2, SIZE);
    },
  },
  // 屋外（色付き）
  grass: {
    scale: 4,
    color: true,
    paint: (ctx, r) => {
      ctx.fillStyle = '#7cc35c';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let k = 0; k < 1400; k++) {
        const x = r() * SIZE;
        const y = r() * SIZE;
        ctx.strokeStyle = r() > 0.5 ? 'rgba(70,140,50,0.55)' : 'rgba(150,215,110,0.55)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4);
        ctx.stroke();
      }
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = r() > 0.5 ? '#fff8e8' : '#ffe36b';
        ctx.beginPath();
        ctx.arc(r() * SIZE, r() * SIZE, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  dirt: {
    scale: 2,
    color: true,
    paint: (ctx, r) => {
      ctx.fillStyle = '#c9a16a';
      ctx.fillRect(0, 0, SIZE, SIZE);
      for (let k = 0; k < 600; k++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(120,85,45,0.35)' : 'rgba(235,205,150,0.4)';
        ctx.fillRect(r() * SIZE, r() * SIZE, 2 + r() * 3, 2 + r() * 2);
      }
    },
  },
};

export function getTexture(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const p = PAINTERS[kind];
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  p.paint(ctx, rng([...kind].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(1 / p.scale, 1 / p.scale);
  cache.set(kind, tex);
  return tex;
}
