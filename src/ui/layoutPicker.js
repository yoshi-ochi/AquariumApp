import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYOUTS, BASEMENT, ZONES, setLayout } from '../building/blueprint.js';
import { buildFloorModel } from '../building/floorModel.js';
import { Exterior } from '../building/exterior.js';

const MODES = [['exterior', '外観'], ['all', '全館'], ['1', '2F'], ['0', '1F'], [String(BASEMENT), 'B1']];
const STACK_GAP = 24;

/** 間取りを立体で見比べる選択画面。選んだ間取りの id を返す */
export function pickLayout(el) {
  return new Promise((resolve) => {
    let chosen = LAYOUTS[0].id;
    let mode = 'exterior';
    el.innerHTML = `<div class="lp-box"><h2>水族館の間取りを選ぶ</h2>
      <div class="lp-stage"><canvas id="lp-canvas"></canvas>
        <div class="lp-modes">${MODES.map(([id, label]) => `<button data-mode="${id}">${label}</button>`).join('')}</div></div>
      <p class="lp-tip">ドラッグで回転、ピンチで拡大できます。選んだ間取りは後から変更できません。</p>
      <div class="lp-grid">${LAYOUTS.map((l) => `<button class="lp-card" data-id="${l.id}"><b>${l.name}</b><small>${l.summary}</small><small class="lp-from">${l.inspired}</small></button>`).join('')}</div>
      <button id="lp-ok" class="primary">この間取りで始める</button></div>`;
    el.hidden = false;

    // 3D表示に失敗しても、間取りの選択と決定は必ずできるようにする
    let preview = null;
    const mark = () => {
      el.querySelectorAll('.lp-card').forEach((c) => c.classList.toggle('active', c.dataset.id === chosen));
      el.querySelectorAll('.lp-modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    };
    const refresh = () => {
      mark();
      try {
        preview?.show(chosen, mode);
      } catch (err) {
        console.error(err);
      }
    };
    el.onclick = (e) => {
      const card = e.target.closest('.lp-card');
      const modeBtn = e.target.closest('.lp-modes button'); // body にも data-mode があるので範囲を限定する
      if (card) chosen = card.dataset.id;
      else if (modeBtn) mode = modeBtn.dataset.mode;
      if (card || modeBtn) return refresh();
      const ok = e.target.closest('#lp-ok');
      if (!ok) return;
      el.onclick = null;
      ok.disabled = true;
      ok.textContent = '準備しています…';
      // 押した表示を先に描いてから、重い後片付けと読み込みに進む
      setTimeout(() => {
        try {
          preview?.dispose();
        } catch (err) {
          console.error(err);
        }
        el.hidden = true;
        el.innerHTML = '';
        resolve(chosen);
      }, 60);
    };
    mark();
    try {
      preview = createPreview(el.querySelector('#lp-canvas'));
      preview.show(chosen, mode);
    } catch (err) {
      console.error(err);
      el.querySelector('.lp-stage').hidden = true;
      el.querySelector('.lp-tip').textContent = 'この端末では立体表示を利用できません。説明を見て間取りを選んでください。';
    }
  });
}

/** 立体プレビュー。操作があったときだけ描画して端末の負荷を抑える */
function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6b8f4e, 1.5));
  const sun = new THREE.DirectionalLight(0xfff6e5, 1.8);
  sun.position.set(-30, 50, 40);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fbf6a, roughness: 1 }));
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 600);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 15;
  controls.maxDistance = 240;
  const models = new THREE.Group();
  scene.add(models);
  const exterior = new Exterior(scene);
  let dirty = true;
  controls.addEventListener('change', () => (dirty = true));

  const clearModels = () => {
    models.traverse((o) => {
      o.geometry?.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    });
    models.clear();
  };
  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  window.addEventListener('resize', resize);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  });

  return {
    show(layoutId, mode) {
      setLayout(layoutId);
      clearModels();
      const isExterior = mode === 'exterior';
      const under = mode === String(BASEMENT);
      exterior.layoutId = null;
      exterior.show(isExterior);
      ground.visible = !under;
      ground.position.y = mode === 'all' ? -STACK_GAP - 2 : -0.1;
      scene.background.set(under ? 0x161d24 : 0xbfe6ff);
      const unlocked = new Set(ZONES.map((z) => z.id));
      const floors = mode === 'all' ? [BASEMENT, 0, 1] : isExterior ? [] : [+mode];
      for (const floor of floors) {
        const model = buildFloorModel({ floor, unlocked });
        if (mode === 'all') model.position.y = floor === BASEMENT ? -STACK_GAP : floor * STACK_GAP;
        models.add(model);
      }
      const k = Math.max(1, 1.5 / Math.max(0.6, camera.aspect));
      const pos = isExterior ? [-40, 24, 72] : mode === 'all' ? [22, 74, 78] : [0, 62, 44];
      camera.position.set(pos[0] * k, pos[1] * k, pos[2] * k);
      controls.target.set(0, isExterior ? 5 : mode === 'all' ? 4 : 0, 2);
      controls.update();
      dirty = true;
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.setAnimationLoop(null);
      clearModels();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
