import * as THREE from 'three';

const SKY = 0xbfe6ff;

/** レンダラー・シーン・カメラ・屋外の光（太陽と空）を管理する。部屋は room/room.js */
export class SceneManager {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);

    this.scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6b8f4e, 1.1));
    const sun = new THREE.DirectionalLight(0xfff6e5, 1.5);
    // 天井が無いため、太陽の影は室内に落とさない（影は室内ライトのみ）
    sun.castShadow = false;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  /** 影のカメラ範囲を建物に合わせる */
  fitShadow(cx, cz, ext) {
    const cam = this.sun.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 0.5;
    cam.far = ext * 8;
    cam.updateProjectionMatrix();
    this.sun.position.set(cx + ext * 0.6, ext * 2.5, cz + ext * 0.9);
    this.sun.target.position.set(cx, 0, cz);
    this.scene.fog = new THREE.Fog(SKY, ext * 5, ext * 14);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
