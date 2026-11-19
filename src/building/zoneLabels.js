import * as THREE from 'three';
import { ZONES, getZone, zoneCenter } from './blueprint.js';

/** 未解放エリアの上に出す名札 */
function labelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const c = canvas.getContext('2d');
  c.fillStyle = 'rgba(15, 53, 80, .92)';
  c.beginPath();
  c.roundRect(4, 4, 504, 104, 26);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '700 46px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 256, 58);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export class ZoneLabels {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'zone-labels';
    scene.add(this.group);
    this.items = ZONES.map((zone) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(`未解放 ${zone.name}`), depthTest: false, depthWrite: false }));
      s.position.y = 2.4;
      s.scale.set(7.3, 1.6, 1);
      s.renderOrder = 900;
      s.raycast = () => {};
      this.group.add(s);
      return { zone, sprite: s, text: zone.name };
    });
  }

  update(floor, unlocked) {
    for (const item of this.items) {
      const { zone, sprite } = item;
      const cur = getZone(zone.id);
      if (cur.name !== item.text) {
        // エリア名を変えたら名札を描き直す
        item.text = cur.name;
        sprite.material.map.dispose();
        sprite.material.map = labelTexture(`未解放 ${cur.name}`);
      }
      const { x, z } = zoneCenter(cur);
      sprite.position.x = x;
      sprite.position.z = z;
      sprite.visible = zone.floor === floor && !unlocked.has(zone.id);
    }
  }
}
