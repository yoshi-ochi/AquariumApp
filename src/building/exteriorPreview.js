import * as THREE from 'three';
import { LAYOUT, LAYOUTS, setLayout } from './blueprint.js';
import { Exterior } from './exterior.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** 各間取りの外観を撮影し、Map<間取りid, dataURL> を返す（間取り選択画面用） */
export async function renderExteriorPreviews({ width = 640, height = 360 } = {}) {
  const current = LAYOUT.id;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6b8f4e, 1.5));
  const sun = new THREE.DirectionalLight(0xfff6e5, 1.8);
  sun.position.set(-30, 50, 40);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fbf6a, roughness: 1 }));
  ground.position.y = -0.05;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(36, width / height, 1, 400);
  camera.position.set(-36, 26, 74);
  camera.lookAt(0, 3, 4);
  const shots = new Map();
  const exterior = new Exterior(scene);
  exterior.group.visible = true;
  try {
    for (const layout of LAYOUTS) {
      setLayout(layout.id);
      exterior.build();
      renderer.render(scene, camera);
      shots.set(layout.id, renderer.domElement.toDataURL('image/jpeg', 0.85));
      await nextFrame();
    }
  } finally {
    setLayout(current);
    exterior.layoutId = null;
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return shots;
}
