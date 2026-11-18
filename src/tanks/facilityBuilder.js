import * as THREE from 'three';

/** 館内に置くお土産店とカフェ（ローポリ） */
const mat = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

function add(g, w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

/** 店名の看板 */
function sign(g, text, w, y, z, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 96);
  c.fillStyle = fg;
  c.font = '700 54px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 256, 50);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.1875), new THREE.MeshBasicMaterial({ map }));
  m.position.set(0, y, z);
  g.add(m);
}

/** 縞模様の日よけ */
function awning(g, w, d, y, z, a, b) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const s = add(g, w / n, 0.03, d, i % 2 ? a : b, -w / 2 + (w / n) * (i + 0.5), y, z);
    s.rotation.x = 0.28;
  }
}

function shell(g, def, wallColor) {
  const { w, h, d } = def.size;
  const wall = mat(wallColor);
  add(g, w, 0.06, d, mat(0xc9b596), 0, 0.03, 0);
  add(g, w, h, 0.06, wall, 0, h / 2, -d / 2 + 0.03);
  for (const s of [-1, 1]) add(g, 0.06, h, d, wall, (s * (w - 0.06)) / 2, h / 2, 0);
  add(g, w + 0.06, 0.08, d + 0.1, mat(0x4b3a2c), 0, h, 0);
}

export function buildSouvenirShop(g, def) {
  const { w, h, d } = def.size;
  shell(g, def, 0xf2e6cf);
  // 商品棚とカラフルな商品
  const colors = [0xef6f5e, 0x3f9bd6, 0xf2c14e, 0x57b98b, 0xb07ad6];
  for (let r = 0; r < 3; r++) {
    add(g, w - 0.2, 0.03, 0.22, mat(0x8a6a48), 0, 0.5 + r * 0.42, -d / 2 + 0.18);
    for (let i = 0; i < 7; i++) {
      add(g, 0.1, 0.14 + (i % 3) * 0.04, 0.1, mat(colors[(i + r) % 5]), -w / 2 + 0.24 + (i * (w - 0.48)) / 6, 0.6 + r * 0.42, -d / 2 + 0.18);
    }
  }
  // レジカウンター
  add(g, w * 0.62, 0.8, 0.28, mat(0xa97c50), 0, 0.46, d / 2 - 0.2);
  add(g, 0.2, 0.14, 0.16, mat(0x2d3a44), w * 0.18, 0.93, d / 2 - 0.2);
  awning(g, w, 0.34, h - 0.12, d / 2 + 0.12, mat(0x2b8fd6), mat(0xffffff));
  sign(g, 'お土産', w * 0.7, h + 0.2, d / 2 + 0.01, '#124a70', '#ffffff');
  add(g, w * 0.72, 0.3, 0.03, mat(0x124a70), 0, h + 0.2, d / 2 - 0.02);
}

export function buildCafe(g, def) {
  const { w, h, d } = def.size;
  shell(g, def, 0xe9d8c2);
  // カウンターとコーヒーマシン
  add(g, w - 0.16, 0.85, 0.3, mat(0x6f4a30), 0, 0.48, -d / 2 + 0.26);
  add(g, 0.26, 0.3, 0.2, mat(0xb9c2c8), -w * 0.22, 1.05, -d / 2 + 0.26);
  add(g, 0.3, 0.05, 0.2, mat(0xf4efe6), w * 0.2, 0.93, -d / 2 + 0.26);
  // 丸テーブルと椅子
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), mat(0xf4efe6));
  table.position.set(0, 0.7, d / 2 - 0.34);
  table.castShadow = true;
  g.add(table);
  add(g, 0.04, 0.68, 0.04, mat(0x3a3a3a), 0, 0.37, d / 2 - 0.34);
  for (const s of [-1, 1]) add(g, 0.2, 0.05, 0.2, mat(0xd96f4a), s * 0.4, 0.45, d / 2 - 0.34);
  for (const s of [-1, 1]) add(g, 0.03, 0.42, 0.03, mat(0x3a3a3a), s * 0.4, 0.24, d / 2 - 0.34);
  awning(g, w, 0.34, h - 0.12, d / 2 + 0.12, mat(0xc4583a), mat(0xfff4e2));
  add(g, w * 0.72, 0.3, 0.03, mat(0x4b2e1e), 0, h + 0.2, d / 2 - 0.02);
  sign(g, 'カフェ', w * 0.7, h + 0.2, d / 2 + 0.01, '#4b2e1e', '#fff4e2');
}
