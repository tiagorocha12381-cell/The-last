import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';

export class Ground {
  constructor(scene) {
    this.scene = scene;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'Ground';
    this.scene.add(this.group);
    this._build();
  }

  _build() {
    const t = this.tex.ground(18, 18);
    const mat = new THREE.MeshStandardMaterial({
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      roughness: 1,
      metalness: 0.02,
    });
    const geo = new THREE.PlaneGeometry(420, 420);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // distant backdrop blocks silhouettes for depth (low detail, far away, not interactable)
    const bgMats = [
      new THREE.MeshStandardMaterial({ color: 0x6f7882, roughness: 1, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: 0x646c75, roughness: 1, metalness: 0 }),
      new THREE.MeshStandardMaterial({ color: 0x79828b, roughness: 1, metalness: 0 }),
    ];
    for (let i = 0; i < 28; i++) {
      const w = 8 + Math.random() * 22;
      const h = 10 + Math.random() * 55;
      const d = 8 + Math.random() * 18;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bgMats[i % bgMats.length]);
      const angle = (i / 28) * Math.PI * 2;
      const rad = 155 + Math.random() * 45;
      m.position.set(Math.cos(angle) * rad, h / 2 - 0.5, Math.sin(angle) * rad);
      m.rotation.y = Math.random() * 0.4;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }
}
