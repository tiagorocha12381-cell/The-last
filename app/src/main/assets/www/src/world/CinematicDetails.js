import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';

/**
 * DETALHES CINEMATOGRÁFICOS DO PRIMEIRO QUARTEIRÃO
 * ------------------------------------------------
 * Complementa (sem substituir) Prédios, Ruas e Props:
 *  - poços de luz reais nos postes + volume luminoso + cintilação
 *  - vinhas com folhagem alfa escalonada nas fachadas reais
 *  - janelas embarradas/quebradas com tábuas de madeira
 *  - rachaduras no asfalto e folhagem morta nas calçadas
 *  - partículas de poeira suspensa (1 draw call)
 *  - placa de quarentena inclinada junto à barricada
 *
 * Tudo em InstancedMesh sempre que repetido. Texturas são geradas
 * por código (CanvasTexture), sem assets externos ou pagos.
 */

function canvas2d(w, h) {
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx || !ctx.getImageData) return null;
    return { c, ctx };
  } catch (e) { return null; }
}

function texFrom(c, srgb = true) {
  if (!c) return null;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function radialTexture() {
  const u = canvas2d(128, 128);
  if (!u) return null;
  const { c, ctx } = u;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return texFrom(c);
}

function leafTexture(palette) {
  const u = canvas2d(128, 128);
  if (!u) return null;
  const { c, ctx } = u;
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const len = 9 + Math.random() * 16;
    const a = Math.random() * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.42, len, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(28,34,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, len); ctx.stroke();
    ctx.restore();
  }
  return texFrom(c);
}

function crackTexture() {
  const u = canvas2d(128, 128);
  if (!u) return null;
  const { c, ctx } = u;
  ctx.clearRect(0, 0, 128, 128);
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    let x = 20 + Math.random() * 88, y = 20 + Math.random() * 88;
    let a = Math.random() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0, n = 4 + ((Math.random() * 4) | 0); s < n; s++) {
      a += (Math.random() - 0.5) * 1.1;
      x += Math.cos(a) * (8 + Math.random() * 12);
      y += Math.sin(a) * (8 + Math.random() * 12);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(8,10,12,0.9)';
    ctx.lineWidth = 1 + Math.random() * 2.2;
    ctx.stroke();
  }
  return texFrom(c);
}

function woodTexture() {
  const u = canvas2d(128, 64);
  if (!u) return null;
  const { c, ctx } = u;
  ctx.fillStyle = '#6b5238'; ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 64;
    ctx.strokeStyle = `rgba(${30 + Math.random() * 40},${22 + Math.random() * 28},14,${0.08 + Math.random() * 0.16})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y + (Math.random() - 0.5) * 3); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,18,14,0.5)';
  for (const x of [12, 116]) { ctx.beginPath(); ctx.arc(x, 32, 2, 0, 7); ctx.fill(); }
  return texFrom(c);
}

export class CinematicDetails {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'CinematicDetails';
    this.scene.add(this.group);
    this.veg = Math.max(0.2, QUALITY_PRESETS[GAME_CONFIG.quality]?.vegetation ?? 1);
    this._time = 0;
    this._flicker = [];
    this._build();
  }

  _inst(lista, geo, mat, nome) {
    if (!lista || !lista.length || !mat) return null;
    const m = new THREE.InstancedMesh(geo, mat, lista.length);
    const d = new THREE.Object3D();
    lista.forEach((o, i) => {
      d.position.set(o.x, o.y || 0, o.z);
      d.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
      d.scale.set(o.w ?? 1, o.h ?? 1, o.d ?? 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.computeBoundingSphere) m.computeBoundingSphere();
    m.name = 'CD_' + nome;
    this.group.add(m);
    return m;
  }

  /** face de um prédio voltada para a rua principal */
  _streetFace(f) {
    if (Math.abs(f.x) >= Math.abs(f.z)) {
      return { axis: 'x', sign: f.x < 0 ? 1 : -1, half: f.w / 2, span: f.d };
    }
    return { axis: 'z', sign: f.z < 0 ? 1 : -1, half: f.d / 2, span: f.w };
  }

  _facePos(f, face, offset, along) {
    if (face.axis === 'x') {
      return { x: f.x + face.sign * (face.half + offset), z: f.z + along, ry: face.sign > 0 ? Math.PI / 2 : -Math.PI / 2 };
    }
    return { x: f.x + along, z: f.z + face.sign * (face.half + offset), ry: face.sign > 0 ? 0 : Math.PI };
  }

  _build() {
    const geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      plane: new THREE.PlaneGeometry(1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    };
    const glow = radialTexture();
    const greenLeaf = leafTexture(['#638a43', '#4d7138', '#7a9a52', '#3e5c30']);
    const deadLeaf = leafTexture(['#8a7047', '#6d5a38', '#9a8552', '#5c4c30']);
    const crack = crackTexture();
    const wood = woodTexture();

    const mat = {
      pool: new THREE.MeshBasicMaterial({
        map: glow, color: 0xffc078, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      cone: new THREE.MeshBasicMaterial({
        color: 0xffc070, transparent: true, opacity: 0.032,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
      vine: new THREE.MeshStandardMaterial({
        map: greenLeaf, transparent: !!greenLeaf, alphaTest: greenLeaf ? 0.35 : 0,
        side: THREE.DoubleSide, roughness: 1, metalness: 0,
      }),
      litter: new THREE.MeshStandardMaterial({
        map: deadLeaf, transparent: !!deadLeaf, alphaTest: deadLeaf ? 0.3 : 0,
        side: THREE.DoubleSide, roughness: 1,
      }),
      crack: new THREE.MeshBasicMaterial({
        map: crack, color: 0x0b0d0f, transparent: true, opacity: 0.82, depthWrite: false,
      }),
      board: new THREE.MeshStandardMaterial({
        map: wood, color: 0xcbb595, roughness: 0.95, metalness: 0,
      }),
      recess: new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.3, metalness: 0.1 }),
    };
    this._mat = mat;
    this._geo = geo;

    /* ---- 1. poços de luz nos postes existentes ---------------- */
    const lamps = this.world.props?.lampPositions || [];
    lamps.forEach((p, i) => {
      const bx = p.x + 0.72, bz = p.z;
      const light = new THREE.PointLight(0xffc27a, 1.15, 13, 2);
      light.position.set(bx, 3.85, bz);
      light.castShadow = false; // barato no Android; sombra principal é o sol
      this.group.add(light);
      this._flicker.push({ light, base: 1.15, phase: i * 1.7 + Math.random(), speed: 2 + Math.random() * 2 });

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), mat.pool);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(bx, 0.022, bz);
      this.group.add(pool);

      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.35, 3.4, 12, 1, true), mat.cone);
      cone.position.set(bx, 2.2, bz);
      this.group.add(cone);
    });

    /* ---- 2. rachaduras no asfalto ----------------------------- */
    const cracks = [];
    for (let i = 0; i < 16; i++) {
      const onVerticalRoad = i % 2 === 0;
      cracks.push({
        x: onVerticalRoad ? (Math.random() - 0.5) * 13 : (Math.random() - 0.5) * 76,
        y: 0.019,
        z: onVerticalRoad ? (Math.random() - 0.5) * 76 : -6 + (Math.random() - 0.5) * 11,
        w: 1.1 + Math.random() * 2.4, h: 1.1 + Math.random() * 2.4,
        rx: -Math.PI / 2, rz: Math.random() * Math.PI,
      });
    }
    this._inst(cracks, geo.plane, mat.crack, 'rachaduras');

    /* ---- 3. folhagem morta / entulho leve ---------------------- */
    const litter = [];
    const blocks = this.world.roadNetwork?.sidewalkBlocks || [];
    const targets = blocks.length ? blocks : [{ x: -24, z: -28, w: 28, d: 28 }];
    const total = Math.max(20, Math.round(80 * this.veg));
    for (let i = 0; i < total; i++) {
      const b = targets[(Math.random() * targets.length) | 0];
      const edge = (Math.random() * 4) | 0;
      let x, z;
      if (edge === 0) { x = b.x + Math.random() * b.w; z = b.z + 0.4 + Math.random(); }
      else if (edge === 1) { x = b.x + Math.random() * b.w; z = b.z + b.d - 0.4 - Math.random(); }
      else if (edge === 2) { x = b.x + 0.4 + Math.random(); z = b.z + Math.random() * b.d; }
      else { x = b.x + b.w - 0.4 - Math.random(); z = b.z + Math.random() * b.d; }
      const s = 0.24 + Math.random() * 0.5;
      litter.push({ x, y: 0.195 + Math.random() * 0.01, z, w: s, h: s, rx: -Math.PI / 2, rz: Math.random() * Math.PI });
    }
    this._inst(litter, geo.plane, mat.litter, 'folhagem_morta');

    /* ---- 4. vinhas nas fachadas reais ------------------------- */
    const footprints = this.world.buildings?.footprints || [];
    const vines = [];
    footprints.forEach((f, fi) => {
      const face = this._streetFace(f);
      const usable = Math.max(2, Math.floor(face.span * 0.55));
      const n = Math.max(2, Math.round((fi < 2 ? 5 : 3) * this.veg));
      for (let i = 0; i < n; i++) {
        const along = (Math.random() - 0.5) * usable;
        const h = 1.8 + Math.random() * 3.4;
        const p = this._facePos(f, face, 0.06, along);
        for (let k = 0; k < 2; k++) {
          vines.push({
            x: p.x, y: 0.3 + h / 2 + Math.random() * 1.2, z: p.z,
            w: 0.55 + Math.random() * 0.55, h,
            ry: p.ry + k * Math.PI / 2,
            rz: (Math.random() - 0.5) * 0.12,
          });
        }
      }
    });
    this._inst(vines, geo.plane, mat.vine, 'vinhas_fachada');

    /* ---- 5. janelas embarradas -------------------------------- */
    const recess = [], boards = [];
    footprints.slice(0, 3).forEach((f, fi) => {
      const face = this._streetFace(f);
      const n = fi === 1 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const along = (i - (n - 1) / 2) * Math.min(2.6, face.span / (n + 1));
        const y = 2.3 + (i % 2) * 3.15 + Math.random() * 0.2;
        const p = this._facePos(f, face, 0.05, along);
        recess.push({ x: p.x, y, z: p.z, w: 1.28, h: 1.55, ry: p.ry });
        for (let b = 0; b < 2; b++) {
          const bp = this._facePos(f, face, 0.1, along);
          boards.push({
            x: bp.x, y: y - 0.3 + b * 0.62, z: bp.z,
            w: 1.75, h: 0.17, d: 0.07, ry: bp.ry,
            rz: (Math.random() - 0.5) * 0.4,
          });
        }
      }
    });
    this._inst(recess, geo.plane, mat.recess, 'janelas_embarradas');
    this._inst(boards, geo.box, mat.board, 'tahuas');

    /* ---- 6. poeira suspensa ----------------------------------- */
    const dustN = GAME_CONFIG.quality === 'mobile' ? 60 : 170;
    const pos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 56;
      pos[i * 3 + 1] = 0.35 + Math.random() * 5.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 56;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      map: glow, color: 0xdccbac, size: 0.085, transparent: true,
      opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    this._dust.name = 'CD_poeira';
    this.group.add(this._dust);

    /* ---- 7. placa de quarentena ------------------------------- */
    const signTex = this.tex.sign('QUARENTENA', '#8a3a2a', '#f0e6d2').map;
    if (signTex) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 0.86),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.9, side: THREE.DoubleSide })
      );
      sign.position.set(1.1, 1.15, -12.6);
      sign.rotation.set(-0.18, 0.42, 0.22);
      sign.castShadow = true;
      this.group.add(sign);
    }
  }

  update(dt) {
    this._time += dt || 0;
    const t = this._time;
    for (const f of this._flicker) {
      const n = Math.sin(t * f.speed + f.phase) * 0.5 + Math.sin(t * 11.3 + f.phase * 3) * 0.12;
      f.light.intensity = f.base * (0.94 + n * 0.06);
    }
    if (this._dust) {
      this._dust.visible = GAME_CONFIG.quality !== 'mobile';
      if (this._dust.visible) {
        const arr = this._dust.geometry.attributes.position.array;
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] += dt * 0.05;
          if (arr[i] > 6.2) arr[i] = 0.3;
        }
        this._dust.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
}
