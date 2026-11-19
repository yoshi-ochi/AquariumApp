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

export function buildResearchLab(g, def) {
  const { w, h, d } = def.size;
  add(g, w, 0.82, d * 0.6, mat(0xdfe6ea), 0, 0.41, -d * 0.2);
  add(g, 0.5, 0.36, 0.04, mat(0x1d2a33), -w * 0.22, 1.05, -d * 0.3);
  add(g, 0.2, 0.34, 0.2, mat(0x3f7fa8), w * 0.22, 1, -d * 0.2);
  add(g, 0.05, 0.2, 0.05, mat(0xbcc6cc), w * 0.22, 1.27, -d * 0.2);
  add(g, w, h, 0.08, mat(0xeef2f4), 0, h / 2, -d / 2 + 0.04);
  for (let r = 0; r < 3; r++) {
    add(g, w - 0.2, 0.03, 0.14, mat(0xa9b4bb), 0, 1.3 + r * 0.22, -d / 2 + 0.14);
    for (let i = 0; i < 6; i++) add(g, 0.07, 0.15, 0.07, mat([0x57b98b, 0x3f9bd6, 0xf2c14e][(i + r) % 3]), -w / 2 + 0.3 + i * 0.24, 1.39 + r * 0.22, -d / 2 + 0.14);
  }
}

/** 水質管理設備：ろ過タンクと配管 */
export function buildWaterPlant(g, def) {
  const { w, h, d } = def.size;
  add(g, w, 0.12, d, mat(0x59636b), 0, 0.06, 0);
  for (const s of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, h - 0.5, 16), mat(0x3f7fa8, 0.35));
    tank.position.set((s * w) / 4, (h - 0.5) / 2 + 0.12, 0);
    tank.castShadow = true;
    g.add(tank);
  }
  add(g, w * 0.7, 0.1, 0.1, mat(0xc9d0d4), 0, h - 0.2, 0);
  add(g, 0.5, 0.9, 0.3, mat(0xe8ecee), 0, 0.57, d / 2 - 0.2);
  add(g, 0.1, 0.1, 0.02, mat(0x57d68d), 0, 0.85, d / 2 - 0.04);
}

/** 清掃センター：資材棚と清掃カート */
export function buildCleanCenter(g, def) {
  const { w, h, d } = def.size;
  add(g, w, h, 0.08, mat(0xdfe6ea), 0, h / 2, -d / 2 + 0.04);
  for (let r = 0; r < 3; r++) add(g, w - 0.1, 0.04, 0.32, mat(0x8d979e), 0, 0.5 + r * 0.55, -d / 2 + 0.24);
  for (let i = 0; i < 6; i++) add(g, 0.16, 0.34, 0.16, mat([0x3f9bd6, 0xf2c14e, 0x57b98b][i % 3]), -w / 2 + 0.3 + i * 0.25, 0.7 + (i % 3) * 0.55, -d / 2 + 0.24);
  add(g, 0.6, 0.5, 0.4, mat(0xf2c14e), 0, 0.4, d / 2 - 0.3);
  add(g, 0.04, 1.1, 0.04, mat(0x59636b), 0.26, 0.75, d / 2 - 0.3);
}

export function buildBreedingTank(g, def) {
  const { w, h, d } = def.size;
  add(g, w, 0.55, d, mat(0x5a6670), 0, 0.275, 0);
  const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h - 0.62, d - 0.08), new THREE.MeshStandardMaterial({ color: 0x5fb9d2, transparent: true, opacity: 0.65, roughness: 0.2, depthWrite: false }));
  water.position.y = 0.55 + (h - 0.55) / 2;
  g.add(water);
  for (const s of [-1, 1]) add(g, 0.04, h - 0.55, d, mat(0x38444d), (s * (w - 0.04)) / 2, 0.55 + (h - 0.55) / 2, 0);
  add(g, 0.04, h - 0.55, 0.04, mat(0x38444d), 0, 0.55 + (h - 0.55) / 2, 0);
  add(g, w, 0.04, 0.04, mat(0x38444d), 0, h, d / 2);
  add(g, w, 0.04, 0.04, mat(0x38444d), 0, h, -d / 2);
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

/** 餌の冷凍庫：業務用の2枚扉 */
export function buildFreezer(g, def) {
  const { w, h, d } = def.size;
  add(g, w, h, d, mat(0xe6ebee, 0.4), 0, h / 2, 0);
  add(g, 0.012, h - 0.12, 0.01, mat(0x9aa4ab), 0, h / 2, d / 2 + 0.005);
  for (const s of [-1, 1]) add(g, 0.03, 0.4, 0.04, mat(0x59636b), s * 0.08, h * 0.55, d / 2 + 0.02);
  add(g, w * 0.5, 0.1, 0.01, mat(0x3f9bd6), 0, h - 0.12, d / 2 + 0.006); // 温度表示
}

/** 活き餌の培養水槽：小さな水槽を棚に並べる */
export function buildLiveFeed(g, def) {
  const { w, h, d } = def.size;
  const water = new THREE.MeshStandardMaterial({ color: 0x9fd7a8, transparent: true, opacity: 0.7, roughness: 0.2, depthWrite: false });
  for (let r = 0; r < 3; r++) {
    const y = 0.1 + r * (h / 3);
    add(g, w, 0.04, d, mat(0x59636b), 0, y, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w / 3 - 0.06, h / 3 - 0.16, d - 0.1), water);
      m.position.set(-w / 3 + (i * w) / 3, y + (h / 3 - 0.16) / 2 + 0.02, 0);
      g.add(m);
    }
  }
  for (const s of [-1, 1]) add(g, 0.04, h, 0.04, mat(0x38444d), (s * (w - 0.04)) / 2, h / 2, d / 2 - 0.02);
}

/** 調餌室の作業台 */
export function buildFoodPrep(g, def) {
  const { w, h, d } = def.size;
  add(g, w, 0.9, d, mat(0xb7c0c6, 0.35), 0, 0.45, 0);
  add(g, w * 0.35, 0.12, d * 0.6, mat(0xdfe6ea, 0.3), -w * 0.22, 0.96, 0); // シンク
  add(g, w * 0.3, 0.08, d * 0.5, mat(0xf2f2ee), w * 0.25, 0.94, 0); // まな板
  add(g, w, h - 1.4, 0.06, mat(0xdfe6ea), 0, 1.4 + (h - 1.4) / 2, -d / 2 + 0.03); // 吊り棚
}
