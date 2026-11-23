import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';

export class Props {
  constructor(scene, collisions, assetLoader = null, world = null) {
    this.scene = scene;
    this.collisions = collisions;
    this.assetLoader = assetLoader;
    this.world = world;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'Props';
    this.scene.add(this.group);
    this.trees = [];
    this.lampPositions = []; // usado pelos detalhes cinematográficos (poços de luz)
    this.vehicles = [];
    this._time = 0;
    this.veg = Math.max(0.2, QUALITY_PRESETS[GAME_CONFIG.quality]?.vegetation ?? 1);
    this._build();
  }

  _inFootprint(x, z, margin = 1.6) {
    return (this.world?.buildings?.footprints || []).some(
      (f) => x > f.x - f.w / 2 - margin && x < f.x + f.w / 2 + margin &&
             z > f.z - f.d / 2 - margin && z < f.z + f.d / 2 + margin
    );
  }

  async load(onProgress) {
    if (!this.assetLoader) return;
    const vehicles = [
      // Original vehicles (kept)
      { id:'veh_sedan', name:'Sedã abandonado', file: 'assets/models/vehicles/sedan.glb', x: -4.5, y: 0.18, z: -2.5, ry: Math.PI * 0.08, scale: 1.15, box: [1.3, 1.5, 2.5], drivable: true },
      { id:'veh_taxi', name:'Táxi', file: 'assets/models/vehicles/taxi.glb', x: 5.2, y: 0.18, z: 8.5, ry: -Math.PI * 0.5, scale: 1.15, box: [1.3, 1.5, 2.5], drivable: true },
      { id:'veh_police', name:'Viatura policial', file: 'assets/models/vehicles/police.glb', x: -6.8, y: 0.18, z: 14.5, ry: Math.PI * 0.02, scale: 1.15, box: [1.3, 1.6, 2.6], drivable: true },
      { file: 'assets/models/vehicles/ambulance.glb', x: 6.5, y: 0.18, z: -18, ry: Math.PI * 0.5, scale: 1.1, box: [1.4, 2.0, 2.8] },
      { file: 'assets/models/vehicles/truck.glb', x: -5.5, y: 0.18, z: -24, ry: -0.08, scale: 1.1, box: [1.4, 1.8, 3.0] },
      { file: 'assets/models/vehicles/delivery.glb', x: 7.2, y: 0.18, z: 22, ry: Math.PI * 0.45, scale: 1.1, box: [1.4, 2.0, 3.0] },
      // Abandoned urban vehicles (damaged states: dirt, broken doors, flipped).
      // Reuses downloaded models: ambulance, sedan, taxi, truck, police, delivery.
      { file: 'assets/models/vehicles/ambulance.glb', x: 33, y: 0.18, z: 0, ry: -0.15, scale: 1.1, box: [1.4, 2.0, 2.8], abandoned: true, dirt: true, brokenDoors: true },
      { file: 'assets/models/vehicles/sedan.glb', x: 31, y: 0.18, z: 20, ry: 0.35, scale: 1.15, box: [1.3, 1.5, 2.5], abandoned: true, dirt: true },
      { file: 'assets/models/vehicles/taxi.glb', x: 14, y: 0.18, z: -8, ry: -0.55, scale: 1.15, box: [1.3, 1.5, 2.5], abandoned: true, flipped: true, dirt: true },
      { file: 'assets/models/vehicles/truck.glb', x: -14, y: 0.18, z: -36, ry: 0.8, scale: 1.1, box: [1.4, 1.8, 3.0], abandoned: true, flipped: true, dirt: true },
      { file: 'assets/models/vehicles/police.glb', x: -22, y: 0.18, z: 30, ry: 0.9, scale: 1.15, box: [1.3, 1.6, 2.6], dirt: true },
      { file: 'assets/models/vehicles/delivery.glb', x: -30, y: 0.18, z: -22, ry: 0.9, scale: 1.1, box: [1.4, 2.0, 3.0], dirt: true },
    ];
    let done = 0;
    for (const v of vehicles) {
      try {
        const obj = await this.assetLoader.loadGLTF(v.file);
        this._placeGLBVehicle(obj, v);
      } catch (e) {
        console.warn('Vehicle load failed, using fallback:', v.file, e);
        this._car(v.x, v.y, v.z, v.ry, 0x6b6b6b);
      }
      done++;
      onProgress?.((done / vehicles.length) * 100, `Carregando veículos (${done}/${vehicles.length})`);
    }
    // Keep procedural vegetation: the bundled nature GLBs were invalid 404 placeholders.
  }


  _placeGLBVehicle(obj, v) {
    obj.position.set(v.x, v.y, v.z);
    obj.rotation.y = v.ry || 0;
    if (v.flipped) obj.rotation.y += Math.PI;
    obj.scale.setScalar(v.scale);
    obj.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        if (n.material) {
          n.material = n.material.clone();
          this._applyVehicleDamage(n, v);
        }
      }
    });
    this.group.add(obj);
    // collision AABB from rotated footprint
    const [hw, hh, hd] = v.box;
    const cos = Math.cos(v.ry), sin = Math.sin(v.ry);
    const corners = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([cx,cz]) => [v.x + cx*cos - cz*sin, v.z + cx*sin + cz*cos]);
    const xs = corners.map(c=>c[0]), zs = corners.map(c=>c[1]);
    const col = this.collisions.addBox(new THREE.Vector3(Math.min(...xs), 0, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), hh, Math.max(...zs)));
    const info = { ...v, mesh: obj, collision: col, hw, hh, hd };
    this.vehicles.push(info);
  }

  _applyVehicleDamage(mesh, v) {
    if (v.dirt) {
      const dirt = new THREE.Color(0.40, 0.35, 0.28);
      const c = mesh.material.color;
      if (c) c.lerp(dirt, 0.45);
    }
    mesh.material.roughness = Math.min(1, (mesh.material.roughness ?? 0.5) + 0.12);
    if (v.abandoned && (mesh.name === 'door-left' || mesh.name === 'door-right')) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0.08;
    }
  }

  update(dt) {
    this._time += dt;
    for (const t of this.trees) {
      t.group.rotation.y = Math.sin(this._time * 0.45 + t.wind.seed) * t.wind.amp * 0.8;
    }
  }

  _build() {
    // Vegetation: trees along the two main roads between buildings
    this._spawnTrees();
    // Vegetation invading sidewalks and open ground
    this._spawnWeedsAroundSidewalks();
    this._spawnStreetWeeds();
    this._spawnGrassTufts();

    // Bushes / grass patches (original props; density scales with quality)
    const bushCount = Math.round(28 * this.veg);
    for (let i = 0; i < bushCount; i++) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      if (Math.abs(x) < 9.5 && Math.abs(z) < 15) continue;
      if (this._inFootprint(x, z)) continue;
      this._bush(x, 0.18, z, 0.35 + Math.random() * 0.8);
    }
    const grassCount = Math.round(18 * this.veg);
    for (let i = 0; i < grassCount; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      if (this._inFootprint(x, z, 1.5)) continue;
      this._grassPatch(x, 0.19, z, 0.5 + Math.random()*0.8);
    }

    // Street props
    this._lampPost(-9.3, 0.18, -1.5);
    this._lampPost(9.3, 0.18, -10.5);
    this._lampPost(-9.3, 0.18, 12);
    this._lampPost(9.3, 0.18, 14);
    this._bench(-11.5, 0.18, -8, Math.PI / 2);
    this._bench(11.5, 0.18, 8, -Math.PI / 2);
    this._trashCan(-10.8, 0.18, -6.5);
    this._trashCan(10.8, 0.18, 6.5);
    this._trashCan(-8.8, 0.18, 16);
    this._dumpster(13.5, 0.18, -3, 0.2);
    this._trafficLight(8.5, 0.18, 1.2, -Math.PI/2);
    this._trafficLight(-8.5, 0.18, -13.2, Math.PI/2);
    this._signPost(-8.8, 0.18, 1.5, 0);
    this._signPost(8.8, 0.18, -13.5, Math.PI);

    // Debris / boxes
    this._debrisPile(3.5, 0.18, 3.5);
    this._debrisPile(-3.0, 0.18, -16.5);
    this._debrisPile(12, 0.18, -2);
    this._boxProp(-12.5, 0.18, 4.5, 0.5);
    this._boxProp(-12.0, 0.18, 4.8, 0.35);
    this._trashBag(6.8, 0.18, 1.8);
    this._trashBag(-7.2, 0.18, 2.4);
    this._trashBag(1.5, 0.18, 16.0);
    this._trashBag(13.2, 0.18, -2.2);

    this._hydrant(9.2, 0.18, 0.8);
    this._hydrant(-9.2, 0.18, -13.2);

    // Barriers
    this._barrier(2.2, 0.18, -12.5, 0.3);
    this._barrier(-2.0, 0.18, -12.2, -0.15);

    // Etapa 18: post-apocalyptic urban detail
    const extraDebris = [[-18,6],[18,-6],[26,8],[-26,-8],[11,26],[-11,-26],[32,14],[-32,14],[14,-30],[-14,30]];
    for (const [dx,dz] of extraDebris) { if (!this._inFootprint(dx,dz,1.5)) this._debrisPile(dx,0.18,dz); }
    const extraTrash = [[-15,4],[15,-4],[24,12],[-24,12],[10,18],[-10,18],[20,-10],[-20,10],[6,-34],[-6,34],[28,2],[-28,2]];
    for (const [tx,tz] of extraTrash) { if (!this._inFootprint(tx,tz,1.0)) this._trashBag(tx,0.18,tz); }
    const extraBoxes = [[-13,6.5,0.45],[13,-6.5,0.4],[25,5,0.5],[-25,5,0.35],[7,30,0.4],[-7,-30,0.45]];
    for (const [bx,bz,bs] of extraBoxes) { if (!this._inFootprint(bx,bz,1.0)) this._boxProp(bx,0.18,bz,bs); }
    // Burnt/abandoned street furniture
    this._bench(-26,0.18,6,Math.PI/2); this._bench(26,0.18,-6,-Math.PI/2);
    this._trashCan(-24,0.18,6.5); this._trashCan(24,0.18,-6.5); this._trashCan(11,0.18,30); this._trashCan(-11,0.18,-30);
    this._dumpster(-30,0.18,8,0.1); this._dumpster(30,0.18,-8,-0.2);
    // More barriers/barricades (keep clear of roads/mission radio -28,-18)
    this._barrier(-22,0.18,-12,0.1); this._barrier(-32,0.18,-12,-0.2);
    this._barrier(18,0.18,12,-0.3); this._barrier(-18,0.18,12,0.25);
    // Extra lamp posts for atmosphere
    this._lampPost(-24,0.18,-14); this._lampPost(24,0.18,14); this._lampPost(-24,0.18,14); this._lampPost(24,0.18,-14);
  }

  // --- Vegetation spawning (density scaled by quality) ---

  _spawnTrees() {
    const spots = [
      // Along Road B (Pista B, z≈0) and Road A (Pista A, x≈0)
      [-38, 0, 1.0], [-30, -6, 1.2], [-24, 4, 1.0], [-16, -5, 1.1], [-8, 6, 0.9],
      [2, 5, 1.1], [12, -4, 1.2], [20, 4, 1.0], [28, -6, 0.9],
      [6, -32, 1.1], [-5, -30, 1.0], [3, -22, 1.2], [-2, 20, 1.0], [8, 12, 0.9],
      [-8, -18, 1.1], [5, 24, 1.0], [-4, 14, 0.8],
      // Building edges facing roads
      [-9.5, 18, 0.9], [22.5, 10, 1.0], [-21.5, -10, 1.1],
    ];
    for (const [x, z, s] of spots) {
      if (this._inFootprint(x, z)) continue;
      if (Math.random() > this.veg) continue; // scale tree density by quality preset
      this._tree(x, 0.18, z, s);
    }
  }

  _spawnWeedsAroundSidewalks() {
    const blocks = this.world?.roadNetwork?.sidewalkBlocks || [];
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x4f6b3e, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x3e552e, roughness: 1 }),
    ];
    for (const b of blocks) {
      const n = Math.floor(4 * this.veg);
      for (let i = 0; i < n; i++) {
        const edge = i % 4;
        // Place weeds just inside the sidewalk edges (they root on the walkway).
        let x, z;
        if (edge === 0) { x = b.x + (Math.random() * b.w) - b.w / 2; z = b.z - b.d / 2 + 0.5; }
        else if (edge === 1) { x = b.x - b.w / 2 + 0.5; z = b.z + (Math.random() * b.d) - b.d / 2; }
        else if (edge === 2) { x = b.x + (Math.random() * b.w) - b.w / 2; z = b.z + b.d / 2 - 0.5; }
        else { x = b.x + b.w / 2 - 0.5; z = b.z + (Math.random() * b.d) - b.d / 2; }
        if (this._inFootprint(x, z, 1.0)) continue;
        this._weed(this.group, x, 0.18, z, 0.8 + Math.random() * 0.6, mats);
      }
    }
  }

  _spawnStreetWeeds() {
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x4f6b3e, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x3e552e, roughness: 1 }),
    ];
    const spots = [
      // Road A (x∈[-9,9])
      [7, -12, 1.0], [5, -20, 1.1], [-4, -14, 0.9], [1, 12, 1.0], [-6, 8, 1.1],
      // Road B (z∈[-7,7])
      [-30, -6, 1.2], [-22, 3, 0.9], [-12, -4, 1.1], [-4, 6, 1.0], [2, -6, 0.8],
      [14, 0, 1.1], [22, -5, 0.9],
    ];
    for (const [x, _z, s] of spots) {
      if (this._inFootprint(x, _z)) continue;
      this._weed(this.group, x, -0.02, _z, s, mats);
    }
  }

  _spawnGrassTufts() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a9a60, roughness: 1 });
    const spots = [
      [0, -12], [7, 10], [-8, -16], [3, 20], [-9, 15], [9, -8], [-2, 0], [12, -2],
      [-12, 8], [5, -26], [-7, 26], [15, 22], [-18, -20], [16, -16],
    ];
    for (const [x, z] of spots) {
      if (this._inFootprint(x, z, 2.0)) continue;
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15 * (0.8 + Math.random() * 0.8), 0.7), mat
        );
        blade.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.z = (Math.random() - 0.5) * 0.15;
        blade.castShadow = true;
        this.group.add(blade);
      }
    }
  }

  // --- weed / tree helpers ---

  _weed(g, x, y, z, s = 1, mats) {
    const [mat1, mat2] = mats;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), mat1);
    trunk.position.set(x, y, z);
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), mat2);
    l1.position.set(x, y + 0.35, z);
    const l2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mat1);
    l2.position.set(x + 0.32 * s, y + 0.42, z + 0.14 * s);
    const l3 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mat2);
    l3.position.set(x - 0.28 * s, y + 0.38, z - 0.16 * s);
    for (const m of [trunk, l1, l2, l3]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  }

  _tree(x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.scale.setScalar(s);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4637, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6a3f, roughness: 0.95 });
    const leafDark = new THREE.MeshStandardMaterial({ color: 0x3e5532, roughness: 0.98 });
    // trunk with bumps (realistic, not a single cylinder)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 8), trunkMat);
    trunk.position.y = 1.0;
    const trunk2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 6), trunkMat);
    trunk2.position.y = 1.0 + 0.55;
    trunk.castShadow = true; trunk.receiveShadow = true;
    trunk2.castShadow = true; trunk2.receiveShadow = true;
    g.add(trunk); g.add(trunk2);
    // canopy blobs of varying size (more natural than a single cone)
    const blobs = [
      [0, 2.2, 0, 0.9, leafMat], [0.4, 2.6, 0.25, 0.65, leafDark],
      [-0.35, 2.9, -0.2, 0.6, leafMat], [0.1, 3.3, 0.05, 0.5, leafDark],
      [0.3, 3.7, 0.15, 0.3, leafMat], [-0.2, 3.55, -0.3, 0.4, leafDark],
    ];
    for (const [bx, by, bz, r, mat] of blobs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), mat);
      m.position.set(bx, by, bz); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    g.userData.animated = true; // o batcher estático não deve fundir esta árvore
    this.group.add(g);
    this.trees.push({ group: g, wind: { seed: Math.random() * Math.PI * 2, amp: (0.06 + Math.random() * 0.12) * s } });
  }

  _grassPatch(x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x,y,z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x617a46, roughness: 1, side: THREE.DoubleSide });
    for (let i=0;i<5;i++) {
      const h = (0.15 + Math.random()*0.2) * s;
      const w = 0.04 * s;
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      blade.position.set((Math.random()-0.5)*0.4*s, h/2, (Math.random()-0.5)*0.4*s);
      blade.rotation.y = Math.random()*Math.PI;
      g.add(blade);
    }
    this.group.add(g);
  }

  _lampPost(x, y, z) {
    this.lampPositions.push({ x, y, z });
    const g = new THREE.Group(); g.position.set(x,y,z);
    const metal = new THREE.MeshStandardMaterial({ color: 0x4f555d, roughness: 0.6, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,4.2,8), metal);
    pole.position.y = 2.1; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.06,0.06), metal);
    arm.position.set(0.35, 4.1, 0); arm.castShadow = true; g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.12,0.18), new THREE.MeshStandardMaterial({ color: 0x8f949a, roughness: 0.4, metalness: 0.5 }));
    lamp.position.set(0.72, 4.05, 0); lamp.castShadow = true; g.add(lamp);
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.25,0.1), new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffe6b0, emissiveIntensity: 0.4, roughness: 0.2 }));
    bulb.position.set(0.72, 3.98, 0); bulb.rotation.x = Math.PI/2; g.add(bulb);
    this.group.add(g);
  }

  _bench(x, y, z, ry=0) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a523f, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x4a5057, roughness: 0.6, metalness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.08,0.55), wood);
    seat.position.y = 0.52; seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.55,0.08), wood);
    back.position.set(0,0.82,-0.22); back.castShadow = true; g.add(back);
    for (const sx of [-0.65,0.65]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.52,0.45), metal);
      leg.position.set(sx,0.26,0); leg.castShadow = true; g.add(leg);
    }
    this.group.add(g);
    const hw=0.85, hd=0.35, cos=Math.cos(ry), sin=Math.sin(ry);
    const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([cx,cz])=>[x+cx*cos-cz*sin,z+cx*sin+cz*cos]);
    const xs=corners.map(c=>c[0]), zs=corners.map(c=>c[1]);
    this.collisions.addBox(new THREE.Vector3(Math.min(...xs),0,Math.min(...zs)), new THREE.Vector3(Math.max(...xs),1.0,Math.max(...zs)));
  }

  _trashCan(x, y, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a4a, roughness: 0.85, metalness: 0.15 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.24,0.75,10), mat);
    body.position.set(x, y+0.375, z); body.castShadow = true; body.receiveShadow = true; this.group.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,10), mat);
    lid.position.set(x, y+0.78, z); lid.castShadow = true; this.group.add(lid);
  }

  _dumpster(x, y, z, ry=0) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.9, metalness: 0.12 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.2,1.2), mat);
    body.position.y = 0.6; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.25,0.08,1.25), new THREE.MeshStandardMaterial({ color: 0x2f2f32, roughness: 0.95 }));
    lid.position.y = 1.24; lid.castShadow = true; g.add(lid);
    this.group.add(g);
    const hw=1.15, hd=0.65, cos=Math.cos(ry), sin=Math.sin(ry);
    const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([cx,cz])=>[x+cx*cos-cz*sin,z+cx*sin+cz*cos]);
    const xs=corners.map(c=>c[0]), zs=corners.map(c=>c[1]);
    this.collisions.addBox(new THREE.Vector3(Math.min(...xs),0,Math.min(...zs)), new THREE.Vector3(Math.max(...xs),1.3,Math.max(...zs)));
  }

  _trafficLight(x, y, z, ry=0) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry;
    const metal = new THREE.MeshStandardMaterial({ color: 0x454b52, roughness: 0.6, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,3.4,8), metal);
    pole.position.y=1.7; pole.castShadow=true; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.9,0.28), new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.8 }));
    box.position.set(0,3.1,0.15); box.castShadow=true; g.add(box);
    const cols=[0x4a1a1a,0x4a3a1a,0x1a3a1a];
    cols.forEach((c,i)=>{ const l=new THREE.Mesh(new THREE.CircleGeometry(0.08,10), new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.15 })); l.position.set(0,3.35-i*0.25,0.295); g.add(l); });
    this.group.add(g);
  }

  _signPost(x, y, z, ry=0) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry;
    const metal = new THREE.MeshStandardMaterial({ color: 0x707780, roughness: 0.6, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.4,8), metal);
    pole.position.y=1.2; pole.castShadow=true; g.add(pole);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.04), new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: 0.7, metalness: 0.2 }));
    sign.position.y=2.2; sign.castShadow=true; g.add(sign);
    this.group.add(g);
  }

  _debrisPile(x, y, z) {
    const g = new THREE.Group(); g.position.set(x,y,z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a645d, roughness: 0.95 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x514b45, roughness: 1 });
    for (let i=0;i<6;i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2+Math.random()*0.5, 0.08+Math.random()*0.25, 0.2+Math.random()*0.5), i%2?mat:mat2);
      b.position.set((Math.random()-0.5)*0.9, b.geometry.parameters.height/2, (Math.random()-0.5)*0.9);
      b.rotation.y = Math.random()*Math.PI; b.rotation.z = (Math.random()-0.5)*0.4;
      b.castShadow = true; b.receiveShadow = true; g.add(b);
    }
    this.group.add(g);
  }

  _boxProp(x, y, z, s=0.4) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s,s,s), new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.95 }));
    m.position.set(x, y+s/2, z); m.rotation.y = Math.random()*0.5; m.castShadow=true; m.receiveShadow=true; this.group.add(m);
  }

  _trashBag(x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.85, metalness: 0.05 }));
    m.scale.set(1,0.85,1); m.position.set(x,y+0.22,z); m.castShadow=true; m.receiveShadow=true; this.group.add(m);
  }

  _hydrant(x, y, z) {
    const g = new THREE.Group(); g.position.set(x,y,z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa74434, roughness: 0.55, metalness: 0.15 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,0.7,10), mat);
    body.position.y=0.35; body.castShadow=true; body.receiveShadow=true; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8), mat); top.position.y=0.72; top.castShadow=true; g.add(top);
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.28,8), mat);
    side.rotation.z=Math.PI/2; side.position.y=0.45; g.add(side);
    this.group.add(g);
  }

  _barrier(x, y, z, rotY = 0) {
    const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=rotY;
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.55, metalness: 0.45 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xc89b3c, roughness: 0.7, metalness: 0.1 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.8, metalness: 0.2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.25,0.15), metal); bar.position.y=0.85; bar.castShadow=true; bar.receiveShadow=true; g.add(bar);
    for (let i=-2;i<=2;i++){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.26,0.16),stripe); s.position.set(i*0.45,0.85,0); g.add(s); }
    for (const sx of [-0.9,0.9]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.85,0.12),legMat); leg.position.set(sx,0.425,0); leg.castShadow=true; g.add(leg); const foot=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,0.35),legMat); foot.position.set(sx,0.03,0); foot.receiveShadow=true; g.add(foot); }
    this.group.add(g);
    const hw=1.3, hd=0.5, cos=Math.cos(rotY), sin=Math.sin(rotY);
    const corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([cx,cz])=>[x+cx*cos-cz*sin,z+cx*sin+cz*cos]);
    const xs=corners.map(c=>c[0]), zs=corners.map(c=>c[1]);
    this.collisions.addBox(new THREE.Vector3(Math.min(...xs),0,Math.min(...zs)), new THREE.Vector3(Math.max(...xs),1.1,Math.max(...zs)));
  }

  _bush(x, y, z, s = 1) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x556f43, roughness: 1 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x465c36, roughness: 1 });
    const g = new THREE.Group(); g.position.set(x,y,z);
    for (let i=0;i<4;i++) {
      const r = (0.2 + Math.random()*0.25) * s;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), i%2?mat:mat2);
      m.position.set((Math.random()-0.5)*0.6*s, r*0.7, (Math.random()-0.5)*0.6*s);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    this.group.add(g);
  }
}
