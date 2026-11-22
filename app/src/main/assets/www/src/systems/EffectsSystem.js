import * as THREE from 'three';

export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
    this.maxEffects = 80;
    this._matHit = new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, opacity: 0.9, depthWrite: false });
    this._matBlood = new THREE.MeshBasicMaterial({ color: 0x9ad08f, transparent: true, opacity: 0.8, depthWrite: false }); // non-graphic greenish hit spark
    this._geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  }

  spawnHit(pos, color = 0xffc36a, count = 6) {
    for (let i = 0; i < count; i++) {
      if (this.effects.length >= this.maxEffects) break;
      const m = new THREE.Mesh(this._geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
      m.position.copy(pos);
      m.position.y += 1.0 + Math.random() * 0.4;
      const vel = new THREE.Vector3((Math.random()-0.5)*3, 1.5+Math.random()*2.5, (Math.random()-0.5)*3);
      this.scene.add(m);
      this.effects.push({ m, vel, life: 0.45 + Math.random()*0.25, maxLife: 0.7 });
    }
  }

  spawnRing(pos, color = 0xd96b4b) {
    if (this.effects.length >= this.maxEffects) return;
    const geo = new THREE.RingGeometry(0.2, 0.35, 16);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos); m.position.y = 0.25; m.rotation.x = -Math.PI/2;
    this.scene.add(m);
    this.effects.push({ m, vel: new THREE.Vector3(0,0,0), life: 0.35, maxLife: 0.35, ring: true });
  }

  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.ring) {
        const t = 1 - Math.max(0, e.life / e.maxLife);
        const s = 1 + t * 2.2;
        e.m.scale.setScalar(s);
        e.m.material.opacity = Math.max(0, e.life / e.maxLife) * 0.8;
      } else {
        e.vel.y -= 8 * dt;
        e.m.position.addScaledVector(e.vel, dt);
        e.m.rotation.x += dt * 4;
        e.m.rotation.y += dt * 3;
        e.m.material.opacity = Math.max(0, e.life / e.maxLife);
      }
      if (e.life <= 0) {
        this.scene.remove(e.m);
        e.m.geometry?.dispose?.();
        e.m.material?.dispose?.();
        this.effects.splice(i, 1);
      }
    }
  }
}
