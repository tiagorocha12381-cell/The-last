import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';

export class Buildings {
  constructor(scene, collisions, interactionSystem = null) {
    this.scene = scene;
    this.collisions = collisions;
    this.interactionSystem = interactionSystem;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'Buildings';
    this.scene.add(this.group);
    this.footprints = [];
    this.interactables = [];
    this._build();
  }

  _mat(texDef, extra = {}) {
    const m = new THREE.MeshStandardMaterial({
      map: texDef.map,
      roughnessMap: texDef.roughnessMap,
      normalMap: texDef.normalMap,
      roughness: extra.roughness ?? 0.95,
      metalness: extra.metalness ?? 0.02,
      color: extra.color ?? 0xffffff,
    });
    if (texDef.emissiveMap) {
      m.emissive = new THREE.Color(0xffe6b0);
      m.emissiveMap = texDef.emissiveMap;
      m.emissiveIntensity = extra.emissiveIntensity ?? 0.8;
    }
    return m;
  }

  _box(w, h, d, mat, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    this.group.add(mesh);
    return mesh;
  }

  _addBuilding(cfg) {
    const { x, z, w, d, h, facadeTex, sideTex, roofColor = 0x4a4f55, baseColor = '#6e7075', doorFace = 'south', signText, signBg, fireEscape = false, antenna = false } = cfg;
    const yBase = 0.18;
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const facadeMat = this._mat(facadeTex, { roughness: 0.92, emissiveIntensity: 0.7 });
    const sideMat = this._mat(sideTex || facadeTex, { roughness: 0.94, emissiveIntensity: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.98, metalness: 0.05 });
    const baseMat = this._mat(this.tex.concrete(2, 1, baseColor), { roughness: 0.96 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.75, metalness: 0.15 });
    const darkTrim = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.85, metalness: 0.1 });

    // Plinth
    const baseH = 0.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, baseH, d + 0.25), baseMat);
    base.position.set(0, yBase + baseH / 2, 0);
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // Main body
    const bodyH = h - baseH - 0.35;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), this._faceMaterials(doorFace, facadeMat, sideMat, roofMat, baseMat));
    body.position.set(0, yBase + baseH + bodyH / 2, 0);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // Roof parapet/cap
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), roofMat);
    roof.position.set(0, yBase + h - 0.175, 0);
    roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.5, d + 0.55), darkTrim);
    parapet.position.set(0, yBase + h + 0.1, 0);
    parapet.castShadow = true; parapet.receiveShadow = true; g.add(parapet);

    // Floor ledges and window frames for depth
    const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x646a72, roughness: 0.82, metalness: 0.12 });
    const ledgeCount = Math.max(2, Math.floor(bodyH / 3.2));
    for (let i = 1; i <= ledgeCount; i++) {
      const ly = yBase + baseH + (i * bodyH) / (ledgeCount + 1);
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.1, d + 0.35), ledgeMat);
      ledge.position.set(0, ly, 0);
      ledge.castShadow = true; ledge.receiveShadow = true; g.add(ledge);
    }

    // Vertical pilasters for facade depth
    this._addPilasters(g, doorFace, w, d, yBase + baseH, bodyH, trimMat);

    // Storefront/door
    this._addDoor(g, doorFace, w, d, yBase, baseH);
    this._addStorefront(g, doorFace, w, d, yBase, baseH, signText, signBg);

    // AC units / roof details
    this._addRoofDetails(g, w, d, h, yBase, trimMat, darkTrim, { fireEscape, antenna });

    // Vegetation invading the foundation
    this._addFoundationWeeds(g, x, z, w, d, yBase);

    // Damage decals (small planes) - subtle
    this._addDamage(g, doorFace, w, d, h, yBase);
    this._addVines(g, doorFace, w, d, h, yBase);

    this.group.add(g);

    this.footprints.push({ x, z, w, d });

    this.collisions.addBox(
      new THREE.Vector3(x - w / 2 - 0.1, 0, z - d / 2 - 0.1),
      new THREE.Vector3(x + w / 2 + 0.1, h + 0.6, z + d / 2 + 0.1)
    );
  }

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

  _addFoundationWeeds(g, x, z, w, d, yBase) {
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x4f6b3e, roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x3e552e, roughness: 1 }),
    ];
    const spots = [
      [x - w * 0.5, z - d * 0.5], [x + w * 0.5, z + d * 0.5],
      [x - w * 0.48, z + d * 0.45], [x + w * 0.45, z - d * 0.45],
      [x - w * 0.22, z - d * 0.72], [x + w * 0.22, z + d * 0.72],
      [x - w * 0.72, z + d * 0.18], [x + w * 0.72, z - d * 0.18],
    ];
    for (const [wx, wz] of spots) this._weed(g, wx, yBase + 0.3 + (Math.random() * 0.05), wz, 0.8 + Math.random() * 0.6, mats);
  }

  _addFireEscape(g, w, d, h, yBase) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.6, metalness: 0.5 });
    const g2 = new THREE.Group();
    g2.position.set(w * 0.22, yBase + h - 0.55, d * 0.18);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.3), mat);
      s.position.y = i * 0.13;
      g2.add(s);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.4), mat);
    top.position.y = 5 * 0.13 + 0.15;
    g2.add(top);
    g2.castShadow = true; g2.receiveShadow = true;
    g.add(g2);
  }

  _addAntenna(g, w, d, h, yBase) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x44464a, roughness: 0.5, metalness: 0.4 });
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 6), poleMat);
    pole.position.set(w * 0.18, yBase + h + 0.7, d * 0.2);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 8), dishMat);
    dish.position.set(w * 0.18, yBase + h + 1.35, d * 0.2);
    pole.castShadow = true; dish.castShadow = true;
    g.add(pole); g.add(dish);
  }

  _faceMaterials(doorFace, facadeMat, sideMat, roofMat, bottomMat) {
    const m = [sideMat, sideMat, roofMat, bottomMat, sideMat, sideMat];
    if (doorFace === 'east') m[0] = facadeMat;
    if (doorFace === 'west') m[1] = facadeMat;
    if (doorFace === 'south') m[4] = facadeMat;
    if (doorFace === 'north') m[5] = facadeMat;
    return m;
  }

  _addPilasters(g, face, w, d, y0, h, mat) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, 0.18), mat);
      p.castShadow = true; p.receiveShadow = true;
      if (face === 'south') { p.position.set(t * w * 0.85, y0 + h / 2, d / 2 + 0.08); }
      else if (face === 'north') { p.position.set(t * w * 0.85, y0 + h / 2, -d / 2 - 0.08); }
      else if (face === 'east') { p.position.set(w / 2 + 0.08, y0 + h / 2, t * d * 0.85); p.rotation.y = Math.PI / 2; }
      else { p.position.set(-w / 2 - 0.08, y0 + h / 2, t * d * 0.85); p.rotation.y = Math.PI / 2; }
      g.add(p);
    }
  }

  _addDoor(g, face, w, d, yBase, baseH) {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.65, metalness: 0.25 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x595e66, roughness: 0.55, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 });
    const dw = 1.6, dh = 2.5, dt = 0.1;
    const y = yBase + baseH + dh / 2;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.25, dh + 0.2, dt + 0.08), frameMat);
    frame.castShadow = true; frame.receiveShadow = true;

    const doorPivot = new THREE.Group();
    doorPivot.name = 'DoorPivot';
    const door = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dt), doorMat);
    const win = new THREE.Mesh(new THREE.BoxGeometry(dw * 0.55, dh * 0.28, dt + 0.02), glassMat);
    door.position.set(dw / 2, 0, 0);
    win.position.set(dw / 2, 0.45, 0.01);
    door.castShadow = true; door.receiveShadow = true;
    win.castShadow = true; win.receiveShadow = true;
    doorPivot.add(door);
    doorPivot.add(win);

    // Position frame and hinge per face. Hinge is at left edge of door opening.
    if (face === 'south') {
      frame.position.set(0, y, d / 2 + 0.04);
      doorPivot.position.set(-dw / 2, y, d / 2 + 0.06);
      doorPivot.rotation.y = 0;
    } else if (face === 'north') {
      frame.position.set(0, y, -d / 2 - 0.04);
      doorPivot.position.set(dw / 2, y, -d / 2 - 0.06);
      doorPivot.rotation.y = Math.PI;
    } else if (face === 'east') {
      frame.position.set(w / 2 + 0.04, y, 0);
      frame.rotation.y = Math.PI / 2;
      doorPivot.position.set(w / 2 + 0.06, y, dw / 2);
      doorPivot.rotation.y = -Math.PI / 2;
    } else { // west
      frame.position.set(-w / 2 - 0.04, y, 0);
      frame.rotation.y = Math.PI / 2;
      doorPivot.position.set(-w / 2 - 0.06, y, -dw / 2);
      doorPivot.rotation.y = Math.PI / 2;
    }

    g.add(frame);
    g.add(doorPivot);

    const doorState = { pivot: doorPivot, open: false, target: 0, current: 0, max: Math.PI * 0.58, baseRy: doorPivot.rotation.y };
    this.interactables.push(doorState);

    if (this.interactionSystem) {
      const worldPos = new THREE.Vector3();
      this.interactionSystem.register({
        type: 'door',
        name: 'Porta',
        description: 'Uma porta de prédio. Pode estar aberta ou fechada.',
        getPosition: () => { doorPivot.getWorldPosition(worldPos); worldPos.y = 0.2; return worldPos; },
        radius: 2.4,
        promptLabel: 'Abrir/Fechar porta',
        onInteract: () => {
          doorState.open = !doorState.open;
          doorState.target = doorState.open ? doorState.max : 0;
          return { message: doorState.open ? 'Porta aberta.' : 'Porta fechada.' };
        },
      });
    }
  }

  update(dt) {
    for (const d of this.interactables) {
      if (!d.pivot) continue;
      const speed = 4.5;
      d.current += (d.target - d.current) * Math.min(1, dt * speed);
      d.pivot.rotation.y = d.baseRy + d.current;
    }
  }

  _addStorefront(g, face, w, d, yBase, baseH, signText, signBg) {
    const sw = Math.min(w * 0.55, 5.5), sh = 1.8, sd = 0.08;
    const glass = new THREE.MeshStandardMaterial({ color: 0x5a7a90, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.45 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x444a52, roughness: 0.6, metalness: 0.2 });
    const y = yBase + baseH + sh / 2 + 0.2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), glass);
    const top = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.2, 0.08, 0.18), frame);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.2, 0.12, 0.18), frame);
    const off = 1.9;
    const place = (obj, ox, oy, oz, ry=0) => { obj.position.set(ox, oy, oz); obj.rotation.y = ry; obj.castShadow = true; obj.receiveShadow = true; g.add(obj); };
    let rx=0, ry=0, rz=0, px=0, pz=0;
    if (face === 'south') { pz = d/2+0.06; px = -off; }
    else if (face === 'north') { pz = -d/2-0.06; px = off; }
    else if (face === 'east') { ry=Math.PI/2; px=w/2+0.06; pz=off; }
    else { ry=Math.PI/2; px=-w/2-0.06; pz=-off; }
    place(panel,px,y,pz,ry); place(top,px,y+sh/2,pz,ry); place(bot,px,y-sh/2,pz,ry);

    // Awning
    const awMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.9, metalness: 0.0 });
    const aw = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.4, 0.08, 0.9), awMat);
    const ay = yBase + baseH + sh + 0.55;
    if (face === 'south') place(aw, px, ay, d/2 + 0.45, 0);
    else if (face === 'north') place(aw, px, ay, -d/2 - 0.45, 0);
    else if (face === 'east') place(aw, w/2+0.45, ay, pz, Math.PI/2);
    else place(aw, -w/2-0.45, ay, pz, Math.PI/2);

    // Sign
    if (signText) {
      const st = this.tex.sign(signText, signBg || '#7b2d2d', '#f2efe8');
      const sm = new THREE.MeshStandardMaterial({ map: st.map, roughness: 0.7, metalness: 0.05 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.08), sm);
      const sy = yBase + baseH + sh + 1.15;
      if (face === 'south') place(sign, px, sy, d/2 + 0.08, 0);
      else if (face === 'north') place(sign, px, sy, -d/2 - 0.08, 0);
      else if (face === 'east') place(sign, w/2 + 0.08, sy, pz, Math.PI/2);
      else place(sign, -w/2 - 0.08, sy, pz, Math.PI/2);
    }
  }

  _addRoofDetails(g, w, d, h, yBase, trimMat, darkTrim, opts = {}) {
    // AC units (fewer on short buildings)
    const acMat = new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.85, metalness: 0.2 });
    const acCount = h > 20 ? 2 : (h > 16 ? 1 : 0);
    for (let i = 0; i < acCount; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), acMat);
      ac.position.set((i - (acCount - 1) / 2) * 2.6, yBase + h + 0.5, -d * 0.15);
      ac.castShadow = true; ac.receiveShadow = true; g.add(ac);
    }
    // Antenna on a tall building
    if (opts.antenna) this._addAntenna(g, w, d, h, yBase);
    // Fire escape on a tall building
    if (opts.fireEscape) this._addFireEscape(g, w, d, h, yBase);
    // water tower for very tall buildings
    if (h > 20) {
      const wtMat = new THREE.MeshStandardMaterial({ color: 0x6b5848, roughness: 0.9, metalness: 0.15 });
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 1.8, 12), wtMat);
      wt.position.set(w * 0.15, yBase + h + 1.25, -d * 0.1);
      wt.castShadow = true; wt.receiveShadow = true; g.add(wt);
      for (const [lx, lz] of [[-0.7,-0.7],[0.7,-0.7],[-0.7,0.7],[0.7,0.7]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), trimMat);
        leg.position.set(w*0.15+lx, yBase+h+0.6, -d*0.1+lz); leg.castShadow=true; g.add(leg);
      }
    }
    // small roof vent
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), darkTrim);
    vent.position.set(-w*0.2, yBase+h+0.35, d*0.2); vent.castShadow = true; g.add(vent);
  }

  _addDamage(g, face, w, d, h, yBase) {
    const dmgMat = new THREE.MeshStandardMaterial({ color: 0x4a433c, roughness: 1, metalness: 0, transparent: true, opacity: 0.22 });
    for (let i=0;i<3;i++) {
      const dw = 0.8 + Math.random()*1.8, dh = 0.6 + Math.random()*1.5;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), dmgMat);
      const py = yBase + 1.5 + Math.random() * (h - 3);
      const px = (Math.random()-0.5) * (w*0.7);
      if (face === 'south') { p.position.set(px, py, d/2 + 0.01); }
      else if (face === 'north') { p.position.set(px, py, -d/2 - 0.01); p.rotation.y = Math.PI; }
      else if (face === 'east') { p.position.set(w/2 + 0.01, py, px); p.rotation.y = Math.PI/2; }
      else { p.position.set(-w/2 - 0.01, py, px); p.rotation.y = -Math.PI/2; }
      p.receiveShadow = true;
      g.add(p);
    }
  }

  _addVines(g, face, w, d, h, yBase) {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f5a35, roughness: 1, metalness: 0, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const darkVine = new THREE.MeshStandardMaterial({ color: 0x304628, roughness: 1, metalness: 0, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const count = 2 + Math.floor(Math.random()*2);
    for (let i=0;i<count;i++) {
      const vw = 0.6 + Math.random()*1.2;
      const vh = 2.0 + Math.random()*Math.min(6, h*0.45);
      const px = (Math.random()-0.5) * (w*0.75);
      const py = yBase + vh/2 + 0.2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), i%2?vineMat:darkVine);
      if (face === 'south') { p.position.set(px, py, d/2 + 0.015); }
      else if (face === 'north') { p.position.set(px, py, -d/2 - 0.015); p.rotation.y = Math.PI; }
      else if (face === 'east') { p.position.set(w/2 + 0.015, py, px); p.rotation.y = Math.PI/2; }
      else { p.position.set(-w/2 - 0.015, py, px); p.rotation.y = -Math.PI/2; }
      p.receiveShadow = true;
      g.add(p);
    }
  }

  _build() {
    this._addBuilding({
      x: -17, z: -19, w: 13, d: 12, h: 22,
      facadeTex: this.tex.facade(1, 2, { base: '#7a5e54', windowColor: '#2a3440', litChance: 0.06, cols: 5, rows: 8, accent:'#5f4a42', damage:0.2 }),
      sideTex: this.tex.brick(2, 3),
      roofColor: 0x454a50, baseColor: '#6e6862', doorFace: 'east', signText:'DELI', signBg:'#6b3a2a', fireEscape: true
    });
    this._addBuilding({
      x: 20, z: -20, w: 16, d: 13, h: 28,
      facadeTex: this.tex.facade(1, 2, { base: '#8e8a84', windowColor: '#304050', litChance: 0.05, cols: 6, rows: 10, accent:'#706c66', damage:0.12 }),
      sideTex: this.tex.plaster(2, 4, '#8b8780'),
      roofColor: 0x50555b, baseColor: '#74787d', doorFace: 'west', signText:'OFFICE', signBg:'#2f4a5c', antenna: true,
    });
    this._addBuilding({
      x: -16.5, z: 18, w: 14, d: 14, h: 14,
      facadeTex: this.tex.facade(1, 1, { base: '#6e6258', windowColor: '#28333d', litChance: 0.07, cols: 5, rows: 5, accent:'#5a5048', damage:0.25 }),
      sideTex: this.tex.brick(2, 2),
      roofColor: 0x4b4f54, baseColor: '#6a6660', doorFace: 'east', signText:'MARKET', signBg:'#4a5a3a',
    });
    this._addBuilding({
      x: 21, z: 20, w: 17, d: 15, h: 24,
      facadeTex: this.tex.facade(1, 2, { base: '#7d7972', windowColor: '#2c3948', litChance: 0.04, cols: 7, rows: 9, accent:'#66625c', damage:0.18 }),
      sideTex: this.tex.plaster(2, 3, '#85807a'),
      roofColor: 0x484d53, baseColor: '#6f7378', doorFace: 'west', signText:'HOTEL', signBg:'#5a3a2a', fireEscape: true,
    });
    this._addBuilding({
      x: -19, z: -5, w: 10, d: 8, h: 7,
      facadeTex: this.tex.facade(1, 1, { base: '#8a7a68', windowColor: '#354555', litChance: 0.1, cols: 4, rows: 2, accent:'#6e6052', damage:0.3 }),
      sideTex: this.tex.plaster(1, 2, '#837a70'),
      roofColor: 0x555960, baseColor: '#756f68', doorFace: 'east', signText:'CAFE', signBg:'#3f5a3f'
    });
    // Etapa 18: more central-block variety (avoid roads x[-9,9], z[-13,1] and mission note at 8,0,2)
    this._addBuilding({
      x: -38, z: -20, w: 11, d: 13, h: 18,
      facadeTex: this.tex.facade(1, 2, { base: '#6a6d72', windowColor: '#2b3542', litChance: 0.05, cols: 4, rows: 7, accent:'#575b61', damage:0.22 }),
      sideTex: this.tex.brick(2, 3, '#6b5a52'),
      roofColor: 0x43484e, baseColor: '#686c71', doorFace: 'east', signText:'DRUGS', signBg:'#5a3a3a'
    });
    this._addBuilding({
      x: 33, z: -18, w: 12, d: 14, h: 16,
      facadeTex: this.tex.facade(1, 1, { base: '#847a70', windowColor: '#314050', litChance: 0.06, cols: 5, rows: 6, accent:'#6f665d', damage:0.2 }),
      sideTex: this.tex.plaster(2, 3, '#8a8076'),
      roofColor: 0x4d5258, baseColor: '#777168', doorFace: 'west', signText:'PAWN', signBg:'#4a4a3a', fireEscape: true
    });
    this._addBuilding({
      x: -30, z: 18, w: 12, d: 12, h: 20,
      facadeTex: this.tex.facade(1, 2, { base: '#7b746c', windowColor: '#2f3d4c', litChance: 0.04, cols: 5, rows: 8, accent:'#686159', damage:0.16 }),
      sideTex: this.tex.concrete(2, 3, '#7a7670'),
      roofColor: 0x474c52, baseColor: '#72767b', doorFace: 'east', signText:'BOOKS', signBg:'#3a4a5a', antenna: true
    });
    this._addBuilding({
      x: 34, z: 20, w: 11, d: 13, h: 12,
      facadeTex: this.tex.facade(1, 1, { base: '#75685d', windowColor: '#2a3540', litChance: 0.08, cols: 4, rows: 4, accent:'#62564c', damage:0.28 }),
      sideTex: this.tex.brick(2, 2, '#6a5c50'),
      roofColor: 0x4a4f55, baseColor: '#6d6760', doorFace: 'west', signText:'DINER', signBg:'#6b4a2a'
    });
    // Small infill near edges, away from radio (-28,-18) and roads
    this._addBuilding({
      x: -19, z: -33, w: 10, d: 9, h: 10,
      facadeTex: this.tex.facade(1, 1, { base: '#8a8580', windowColor: '#334455', litChance: 0.05, cols: 4, rows: 3, accent:'#77726c', damage:0.15 }),
      sideTex: this.tex.plaster(1, 2, '#8c8782'),
      roofColor: 0x53585e, baseColor: '#767a7f', doorFace: 'south', signText:'LAUNDRY', signBg:'#3a5a5a'
    });
    this._addBuilding({
      x: 20, z: -34, w: 11, d: 9, h: 13,
      facadeTex: this.tex.facade(1, 1, { base: '#706b66', windowColor: '#2c3948', litChance: 0.05, cols: 4, rows: 5, accent:'#605b56', damage:0.2 }),
      sideTex: this.tex.brick(2, 2, '#65584e'),
      roofColor: 0x464b51, baseColor: '#6b6f74', doorFace: 'south', signText:'REPAIR', signBg:'#5a4a3a'
    });
  }
}
