import * as THREE from 'three';
import { buildCreature } from '../expedition/creatureBuilder.js';
import { CELL_SIZE, GRID_Z, STORY_H } from './blueprint.js';

/** 屋外イルカプール：楕円のプールと、2階建ての高さまで段になった半円形の観客席 */
const CENTER_Z = (4 - GRID_Z / 2) * CELL_SIZE;
const TIERS = 12;
const SEAT_TOP = STORY_H * 2;
const DOLPHIN = { id: 'show-dolphin', form: 'shark', len: 2.4, colors: { body: 0x7f929f, belly: 0xe6ecef, fin: 0x6a7c88 } };

export class DolphinPool {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'dolphin-pool';
    this.group.position.z = CENTER_Z;
    this.group.visible = false;
    scene.add(this.group);
    this._buildPool();
    this._buildSeats();
    this.dolphins = [0, 1, 2].map((i) => {
      const d = buildCreature(DOLPHIN);
      this.group.add(d);
      return { obj: d, phase: (i / 3) * Math.PI * 2 };
    });
  }

  _buildPool() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd9dcd8, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 48), concrete);
    deck.scale.set(10, 1, 5.6);
    deck.position.y = 0.25;
    deck.receiveShadow = true;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x2f9fc8, roughness: 0.25, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.scale.set(9, 4.8, 1);
    water.position.y = 0.52;
    const stage = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 1.6), new THREE.MeshStandardMaterial({ color: 0x2b6f96, roughness: 0.7 }));
    stage.position.set(0, 0.55, -5.6);
    stage.castShadow = true;
    this.group.add(deck, water, stage);
  }

  /** 客席は南（建物側）へ向かって高くなる */
  _buildSeats() {
    const colors = [0x2f7fb5, 0xeef2f3];
    const mats = colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    for (let k = TIERS - 1; k >= 0; k--) {
      const r = 5.7 + k * 0.45;
      const h = ((k + 1) / TIERS) * SEAT_TOP;
      // 楕円のプールを囲むよう X 方向へ広げた半円
      const low = (k / TIERS) * SEAT_TOP;
      const outline = [[r, low], [r, h], [r + 0.45, h], [r + 0.45, 0]].map(([x, y]) => new THREE.Vector2(x, y));
      const seat = new THREE.Mesh(new THREE.LatheGeometry(outline, 40, -Math.PI / 2, Math.PI), mats[k % 2]);
      seat.scale.x = 1.55;
      seat.castShadow = seat.receiveShadow = true;
      this.group.add(seat);
    }
    // 最上段の屋根
    const roof = new THREE.Mesh(new THREE.TorusGeometry(10.7, 0.16, 6, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0x38505f }));
    roof.rotation.x = Math.PI / 2;
    roof.rotation.z = Math.PI;
    roof.scale.x = 1.55;
    roof.position.y = SEAT_TOP + 1.3;
    this.group.add(roof);
  }

  setUnlocked(v) {
    this.group.visible = v;
  }

  /** プールの中を周回し、順番にジャンプする */
  update(time) {
    if (!this.group.visible) return;
    for (const d of this.dolphins) {
      const a = time * 0.45 + d.phase;
      const jump = Math.max(0, Math.sin(a * 2.5));
      const y = 0.45 + Math.pow(jump, 3) * 2.8;
      d.obj.position.set(Math.cos(a) * 6.8, y, Math.sin(a) * 3.1);
      d.obj.rotation.y = -a - Math.PI / 2 + Math.PI;
      d.obj.rotation.z = Math.cos(a * 2.5) * jump * 0.8;
      d.obj.userData.uni.uTime.value = time * 1.4;
    }
  }
}
