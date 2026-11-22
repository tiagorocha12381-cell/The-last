import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';

export class RoadNetwork {
  constructor(scene, collisions, world = null) {
    this.scene = scene;
    this.collisions = collisions;
    this.world = world;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'RoadNetwork';
    this.scene.add(this.group);
    this.sidewalkBlocks = [];
    this._build();
  }

  _matFromTex(t, extra = {}) {
    return new THREE.MeshStandardMaterial({
      map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap,
      roughness: extra.roughness ?? 1, metalness: extra.metalness ?? (t.metalness ?? 0.0),
      color: extra.color ?? 0xffffff,
    });
  }

  _addPlane(w, h, mat, x, y, z, rx = -Math.PI / 2, rz = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = rx; m.rotation.z = rz; m.position.set(x, y, z);
    m.receiveShadow = true; this.group.add(m); return m;
  }

  _addBox(w, h, d, mat, x, y, z, cast = true, recv = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv;
    this.group.add(m); return m;
  }

  _build() {
    const asphalt = this._matFromTex(this.tex.asphalt(2, 8), { roughness: 0.96 });
    const asphalt2 = this._matFromTex(this.tex.asphalt(8, 2), { roughness: 0.96 });
    const sidewalk = this._matFromTex(this.tex.sidewalk(4, 4), { roughness: 0.98 });
    const curbMat = this._matFromTex(this.tex.concrete(2, 1, '#7f8387'), { roughness: 0.95 });

    this._addPlane(18, 80, asphalt, 0, 0.01, 0);
    this._addPlane(80, 14, asphalt2, 0, 0.011, -6);

    // Centerline dashes (road A along Z at x=0, road B along X at z=-6)
    this._centerLine();

    // Markings
    const markMat = new THREE.MeshStandardMaterial({ color: 0xcfc7ad, roughness: 0.65, metalness: 0 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xb89a45, roughness: 0.7, metalness: 0 });
    for (let z = -38; z <= 38; z += 6) {
      if (z > -14 && z < 2) continue;
      this._addPlane(0.28, 2.8, markMat, 0, 0.012, z);
    }
    for (let x = -38; x <= 38; x += 6) {
      if (x > -10 && x < 10) continue;
      this._addPlane(2.8, 0.28, markMat, x, 0.0125, -6);
    }
    // center yellow hints
    this._addPlane(0.12, 20, yellow, -0.22, 0.0122, 24);
    this._addPlane(0.12, 20, yellow, 0.22, 0.0122, 24);

    // Crosswalks with zebra texture
    const cwMat = new THREE.MeshStandardMaterial({ map: this.tex.crosswalkHatch().map, roughness: 0.7, metalness: 0.05, transparent: true, opacity: 0.92 });
    for (let i = -3; i <= 3; i++) {
      this._addPlane(1.2, 0.45, cwMat, i * 1.8, 0.013, 1.8);
      this._addPlane(1.2, 0.45, cwMat, i * 1.8, 0.013, -13.8);
      this._addPlane(0.45, 1.2, cwMat, 9.8, 0.013, -6 + i * 1.4);
      this._addPlane(0.45, 1.2, cwMat, -9.8, 0.013, -6 + i * 1.4);
    }

    // Manholes / drains
    this._manhole(2.8, 0.013, 6.5);
    this._manhole(-3.2, 0.013, -20);
    this._drain(8.7, 0.013, -12.7);
    this._drain(-8.7, 0.013, 1.7);

    // Tire marks / oil stains
    this._decal(2.2, 7, -2.5, 0.014, -8.5, 0x1d1f22, 0.18);
    this._decal(1.2, 5, 2.5, 0.014, 18, 0x202225, 0.14);
    this._decal(8, 1.6, 20, 0.014, -4.8, 0x222428, 0.12);
    this._decal(5.5, 1.4, -20, 0.014, -7.5, 0x25272a, 0.1);

    // Puddles (darker, slightly reflective)
    this._puddle(-2.5, 0.014, 5.5, 2.4, 1.4);
    this._puddle(4.2, 0.014, -15.5, 1.8, 1.1);

    // More tire marks on road strips
    this._tireMarks();

    // Etapa 18: extra urban decay
    for (const [x,z,w,d,c,a] of [[-5,10,1.8,3.2,0x202326,0.16],[6,-22,2.2,4.0,0x1e2124,0.14],[14,-4,1.4,2.0,0x24272a,0.12],[-12,6,2.0,1.2,0x232628,0.13],[-2,20,1.6,2.4,0x1f2225,0.15]]) this._decal(w,d,x,0.014,z,c,a);
    this._puddle(2.8,0.014,-8.5,1.6,1.0); this._puddle(-3.5,0.014,-28,2.0,1.2); this._puddle(5.5,0.014,18,1.4,0.9);
    this._manhole(-2.2,0.013,-30); this._drain(8.6,0.013,5.5);

    const swH = 0.18;
    this._sidewalkBlock(-24, -28, 28, 28, swH, sidewalk, curbMat);
    this._sidewalkBlock(10, -28, 28, 28, swH, sidewalk, curbMat);
    this._sidewalkBlock(-24, 2, 28, 36, swH, sidewalk, curbMat);
    this._sidewalkBlock(10, 2, 28, 36, swH, sidewalk, curbMat);
  }

  _centerLine() {
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.roadMarking().map, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    // Road A: vertical dashes along Z at x=0 (road spans x∈[-9,9])
    for (let z = -38; z <= 38; z += 9.5) {
      const plane = this._addPlane(0.6, 2.2, mat, 0, 0.013, z);
      plane.castShadow = false;
    }
    // Road B: horizontal dashes along X at z=-6 (road spans z∈[-13,1])
    for (let x = -38; x <= 38; x += 9.5) {
      const plane = this._addPlane(2.2, 0.6, mat, x, 0.013, -6);
      plane.castShadow = false;
    }
  }

  _tireMarks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8c3b7, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false });
    const marks = [
      [-14, -33, Math.PI * 0.35, 7],
      [14, -16, Math.PI * 0.2, 6],
      [-6, 12, Math.PI * 0.45, 5],
      [22, 18, Math.PI * 0.15, 8],
      [-22, -10, Math.PI * 0.5, 6],
    ];
    for (const [x, z, rot, len] of marks) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), mat);
      m.rotation.y = rot; m.rotation.x = Math.PI / 2;
      m.position.set(x, 0.0145, z);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  _sidewalkBlock(x, z, w, d, h, topMat, curbMat) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), topMat);
    top.position.set(x + w / 2, h / 2, z + d / 2); top.receiveShadow = true; this.group.add(top);
    const curbH = h + 0.04;
    this._addBox(w, curbH, 0.25, curbMat, x + w / 2, curbH / 2, z + 0.125, false, true);
    this._addBox(w, curbH, 0.25, curbMat, x + w / 2, curbH / 2, z + d - 0.125, false, true);
    this._addBox(0.25, curbH, d, curbMat, x + 0.125, curbH / 2, z + d / 2, false, true);
    this._addBox(0.25, curbH, d, curbMat, x + w - 0.125, curbH / 2, z + d / 2, false, true);
    void top;
    this.sidewalkBlocks?.push({ x, z, w, d, h });
  }

  _manhole(x, y, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5d636b, roughness: 0.55, metalness: 0.55 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 20), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 20), new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.5, metalness: 0.5 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.001, z); this.group.add(ring);
  }

  _drain(x, y, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x555b62, roughness: 0.6, metalness: 0.5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.45), mat);
    m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m);
  }

  _decal(w, d, x, y, z, color, alpha) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.group.add(m);
  }

  _puddle(x, y, z, w, d) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(Math.max(w,d)*0.5, 18), new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.72 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(w/(Math.max(w,d)), 1, d/(Math.max(w,d)));
    m.position.set(x, y, z); m.receiveShadow = true; this.group.add(m);
  }
}
