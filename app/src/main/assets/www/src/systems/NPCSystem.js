import * as THREE from 'three';
import { NPC_DEFS, SHELTER } from '../data/npcs.js';
import { clamp } from '../utils/MathUtils.js';

function makeHumanoid(defOrColor = 0x6b8fb3) {
  const def = (typeof defOrColor === 'object' && defOrColor) ? defOrColor : { color: defOrColor, id: 'npc', role: '' };
  const g = new THREE.Group();
  const mat = (color, rough=0.88, metal=0.04) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const skinTones = [0xc9a07a, 0xb98b6a, 0xa77858, 0xd2b08c];
  const skin = mat(skinTones[(def.id?.length || 0) % skinTones.length], 0.85, 0.02);
  const skinDark = mat(0x9f785a, 0.9, 0.02);
  const cloth = mat(def.color ?? 0x6b8fb3, 0.9, 0.03);
  const clothDark = mat(new THREE.Color(def.color ?? 0x6b8fb3).multiplyScalar(0.72).getHex(), 0.92, 0.03);
  const pants = mat(0x4a4f55, 0.95, 0.02);
  const boots = mat(0x2f2c2a, 0.78, 0.08);
  const hairColors = { npc_maya:0x3b2a22, npc_leo:0x5a4633, npc_rina:0x2a2020 };
  const hair = mat(hairColors[def.id] ?? 0x3b3028, 0.95, 0.01);
  const accent = mat(def.id === 'npc_rina' ? 0xd8d2cc : def.id === 'npc_leo' ? 0x556b4a : 0x6f6558, 0.85, 0.05);

  const add = (geo, material, x,y,z, sx=1,sy=1,sz=1, rx=0,ry=0,rz=0, parent=g) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // Torso
  add(new THREE.BoxGeometry(0.50, 0.54, 0.28), cloth, 0, 1.10, 0);
  add(new THREE.BoxGeometry(0.52, 0.14, 0.30), clothDark, 0, 1.34, 0);
  add(new THREE.BoxGeometry(0.44, 0.08, 0.29), accent, 0, 0.86, 0); // belt/hem
  if (def.id === 'npc_maya') {
    add(new THREE.BoxGeometry(0.54, 0.28, 0.32), clothDark, 0, 1.22, 0); // jacket layer
    add(new THREE.BoxGeometry(0.10,0.08,0.04), mat(0xb0b6bc,0.4,0.7), 0,1.18,0.17); // zipper
  }
  if (def.id === 'npc_leo') {
    add(new THREE.BoxGeometry(0.56, 0.22, 0.34), mat(0x5a654f,0.92,0.03), 0, 1.26, 0); // vest
    add(new THREE.BoxGeometry(0.12,0.10,0.08), mat(0x4a4036,0.9,0.03), 0.20,1.0,0.12);
  }
  if (def.id === 'npc_rina') {
    add(new THREE.BoxGeometry(0.54, 0.40, 0.31), mat(0xcfc8be,0.92,0.02), 0, 1.14, 0); // coat
    add(new THREE.BoxGeometry(0.14,0.04,0.02), mat(0xb44a4a,0.5,0.1), 0.12,1.22,0.16); // cross patch
  }

  // Head group (animated part reference must rotate)
  const headGrp = new THREE.Group();
  headGrp.position.set(0, 1.62, 0);
  g.add(headGrp);
  add(new THREE.SphereGeometry(0.16, 14, 12), skin, 0,0.01,0,1,1.02,0.95,0,0,0,headGrp);
  add(new THREE.SphereGeometry(0.11, 12, 10), skinDark, 0,-0.11,0.03,1,0.65,1,0,0,0,headGrp);
  add(new THREE.BoxGeometry(0.32,0.11,0.32), hair, 0,0.18,0,1,1,1,0,0,0,headGrp);
  add(new THREE.BoxGeometry(0.33,0.18,0.10), hair, 0,0.06,-0.12,1,1,1,0,0,0,headGrp);
  // face
  const eyeW = mat(0xd8d2cc,0.35,0), eyeP = mat(0x2a2522,0.3,0);
  for (const sx of [-0.065,0.065]) { add(new THREE.BoxGeometry(0.045,0.025,0.015), eyeW, sx,0.03,0.145,1,1,1,0,0,0,headGrp); add(new THREE.BoxGeometry(0.02,0.02,0.01), eyeP, sx,0.03,0.152,1,1,1,0,0,0,headGrp); }
  add(new THREE.BoxGeometry(0.05,0.02,0.03), skinDark, 0,-0.015,0.15,1,1,1,0,0,0,headGrp);
  add(new THREE.BoxGeometry(0.07,0.012,0.015), mat(0x6b4f45,0.7,0), 0,-0.065,0.145,1,1,1,0,0,0,headGrp);

  // Limbs as groups for animation compatibility
  const legL = new THREE.Group(); legL.position.set(-0.13, 0.78, 0); g.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.78, 0); g.add(legR);
  for (const leg of [legL, legR]) {
    add(new THREE.CapsuleGeometry(0.095,0.20,4,8), pants, 0,-0.19,0,1,1,1,0,0,0,leg);
    add(new THREE.CapsuleGeometry(0.085,0.18,4,8), pants, 0,-0.52,0,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(0.20,0.12,0.28), boots, 0,-0.74,0.03,1,1,1,0,0,0,leg);
  }

  const armL = new THREE.Group(); armL.position.set(-0.34, 1.30, 0); g.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.34, 1.30, 0); g.add(armR);
  for (const arm of [armL, armR]) {
    add(new THREE.CapsuleGeometry(0.075,0.18,4,8), cloth, 0,-0.16,0,1,1,1,0,0,0,arm);
    add(new THREE.CapsuleGeometry(0.065,0.16,4,8), clothDark, 0,-0.44,0,1,1,1,0,0,0,arm);
    add(new THREE.BoxGeometry(0.11,0.09,0.13), skinDark, 0,-0.63,0,1,1,1,0,0,0,arm);
  }

  // Backpack / role accessory
  if (def.id !== 'npc_rina') add(new THREE.BoxGeometry(0.28, 0.34, 0.14), mat(0x5a4a3a,0.9,0.03), 0, 1.12, -0.21);
  if (def.id === 'npc_leo') add(new THREE.BoxGeometry(0.18,0.12,0.06), mat(0x30363d,0.6,0.2), 0.18,1.34,0.12); // radio
  if (def.id === 'npc_rina') add(new THREE.BoxGeometry(0.22,0.16,0.12), mat(0xb44a4a,0.7,0.05), -0.22,1.0,0.12); // med bag

  return { group: g, parts: { legL, legR, armL, armR, head: headGrp } };
}

export class NPCSystem {
  constructor(scene, interactionSystem, dialogUI, missionSystem, inventory, saveSystem, hud = null, collisions = null, tradeUI = null, factionSystem = null, decisionSystem = null) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.dialogUI = dialogUI;
    this.missionSystem = missionSystem;
    this.inventory = inventory;
    this.saveSystem = saveSystem;
    this.hud = hud;
    this.collisions = collisions;
    this.tradeUI = tradeUI;
    this.factionSystem = factionSystem;
    this.decisionSystem = decisionSystem;
    this.npcs = [];
    this.group = new THREE.Group();
    this.group.name = 'NPCs';
    this.scene.add(this.group);
    this.state = this._loadState();
    this._buildShelter();
    this._buildFactionBases();
    this._spawnNPCs();
    this._bindDialog();
  }

  _loadState() {
    const save = this.saveSystem.get() || {};
    return {
      trust: { ...(save.npcTrust || {}) },
      flags: { ...(save.npcFlags || {}) },
      met: { ...(save.npcMet || {}) },
    };
  }

  _saveState() {
    this.saveSystem.save({ npcTrust: this.state.trust, npcFlags: this.state.flags, npcMet: this.state.met });
  }

  getTrust(id) { return this.state.trust[id] ?? 0; }
  addTrust(id, amount = 1) { this.state.trust[id] = clamp((this.state.trust[id] ?? 0) + amount, 0, 10); this._saveState(); }
  setFlag(flag, value = true) { this.state.flags[flag] = value; this._saveState(); }
  getFlag(flag) { return !!this.state.flags[flag]; }

  _buildShelter() {
    const g = new THREE.Group();
    g.name = 'Shelter';
    const cx = SHELTER.center.x, cz = SHELTER.center.z;
    const matWall = new THREE.MeshStandardMaterial({ color: 0x666d75, roughness: 0.9, metalness: 0.05 });
    const matWood = new THREE.MeshStandardMaterial({ color: 0x6a5542, roughness: 0.95, metalness: 0.02 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x7a828b, roughness: 0.5, metalness: 0.5 });
    // floor/platform
    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.95 }));
    floor.position.set(cx, 0.12, cz); floor.receiveShadow = true; g.add(floor);
    // back wall and side walls
    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 0.25), matWall);
    wallBack.position.set(cx, 1.42, cz - 3.9); wallBack.castShadow = true; wallBack.receiveShadow = true; g.add(wallBack);
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 8), matWall);
    wallL.position.set(cx - 4.9, 1.42, cz); wallL.castShadow = true; g.add(wallL);
    const wallR = wallL.clone(); wallR.position.x = cx + 4.9; g.add(wallR);
    if (this.collisions) {
      this.collisions.addBox(new THREE.Vector3(cx-5,0,cz-4.1), new THREE.Vector3(cx+5,2.6,cz-3.7));
      this.collisions.addBox(new THREE.Vector3(cx-5.1,0,cz-4), new THREE.Vector3(cx-4.7,2.6,cz+4));
      this.collisions.addBox(new THREE.Vector3(cx+4.7,0,cz-4), new THREE.Vector3(cx+5.1,2.6,cz+4));
    }
    // roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.2, 8.6), matMetal);
    roof.position.set(cx, 2.8, cz); roof.castShadow = true; g.add(roof);
    // barricades front
    for (const ox of [-3.2, -1.0, 1.2, 3.4]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.25), matWood);
      b.position.set(cx + ox, 0.55, cz + 4.1);
      b.rotation.y = (Math.random()-0.5)*0.2;
      b.castShadow = true; b.receiveShadow = true; g.add(b);
    }
    // crate storage
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), matWood);
    crate.position.set(cx - 3.5, 0.52, cz - 2.5); crate.castShadow = true; g.add(crate);
    const crate2 = crate.clone(); crate2.position.set(cx - 2.3, 0.52, cz - 2.8); crate2.scale.setScalar(0.85); g.add(crate2);
    // rest bench/cot
    const cot = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.9), matWood);
    cot.position.set(cx + 3.2, 0.35, cz - 2.8); cot.castShadow = true; g.add(cot);
    // light
    const lamp = new THREE.PointLight(0xffd8a8, 0.9, 14, 2);
    lamp.position.set(cx, 2.4, cz); lamp.userData.nightLight = true; lamp.userData._nightBase = 0.9; g.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8), new THREE.MeshStandardMaterial({ color:0xfff0cc, emissive:0xffe0a0, emissiveIntensity:0.8 }));
    bulb.position.copy(lamp.position); bulb.userData.nightLight = true; g.add(bulb);
    this.scene.add(g);
    this.shelterGroup = g;

    // Shelter rest interaction
    this.interactionSystem.register({
      id: 'shelter_rest',
      type: 'rest',
      name: 'Cama do abrigo',
      description: 'Um lugar relativamente seguro para descansar.',
      position: new THREE.Vector3(cx + 3.2, 0.2, cz - 2.2),
      radius: 1.8,
      promptLabel: 'Descansar',
      onInteract: ({ player }) => {
        if (player.dead) return { message: 'Você não pode descansar agora.' };
        if (player.isResting) { player.stopRest(); this.hud?.setStatus('EXPLORANDO'); return { message: 'Você parou de descansar.' }; }
        player.isResting = true;
        this.hud?.setStatus('DESCANSANDO');
        return { message: 'Você está descansando no abrigo. Mova-se ou interaja novamente para parar.' };
      }
    });
  }

  _buildFactionBases() {
    const makeBase = (cfg) => {
      const g = new THREE.Group(); g.position.set(cfg.x, 0, cfg.z);
      const matWood = new THREE.MeshStandardMaterial({ color: 0x6a5542, roughness: 0.95 });
      const matMetal = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.7, metalness: 0.35 });
      const floor = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 4.5), new THREE.MeshStandardMaterial({ color: 0x575d64, roughness: 0.95 }));
      floor.position.y = 0.09; floor.receiveShadow = true; g.add(floor);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 0.2), matMetal); wall.position.set(0,0.9,-2.15); wall.castShadow=true; wall.receiveShadow=true; g.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 4.8), matMetal); roof.position.y=1.85; roof.castShadow=true; g.add(roof);
      for (const ox of [-1.8, 0, 1.8]) { const b=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.9,0.22), matWood); b.position.set(ox,0.45,2.2); b.castShadow=true; b.receiveShadow=true; g.add(b); }
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.7,0.9), matWood); crate.position.set(-1.8,0.44,-1.2); crate.castShadow=true; g.add(crate);
      const lamp = new THREE.PointLight(cfg.light || 0xffd8a8, 0.7, 10, 2); lamp.position.set(0,1.6,0); g.add(lamp);
      const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=64; const ctx=canvas.getContext('2d');
      ctx.fillStyle='#2a2f35'; ctx.fillRect(0,0,256,64); ctx.fillStyle=cfg.signColor||'#f0e2cf'; ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cfg.label,128,32);
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.55), new THREE.MeshBasicMaterial({map:tex, transparent:true}));
      sign.position.set(0,1.35,2.32); g.add(sign);
      this.scene.add(g);
      if (this.collisions) {
        this.collisions.addBox(new THREE.Vector3(cfg.x-2.8,0,cfg.z-2.3), new THREE.Vector3(cfg.x+2.8,1.9,cfg.z-2.0));
      }
    };
    makeBase({ x:-10, z:92, label:'SENTINELAS', signColor:'#ffbf66', light:0xffcc88 });
    makeBase({ x:-74, z:10, label:'CATADORES', signColor:'#9ad06b', light:0xffe0b0 });
  }

  _spawnNPCs() {
    for (const def of NPC_DEFS) {
      const model = makeHumanoid(def);
      model.group.position.set(def.position.x, def.position.y, def.position.z);
      this.group.add(model.group);
      const npc = {
        def,
        ...model,
        pos: new THREE.Vector3(def.position.x, def.position.y, def.position.z),
        yaw: 0,
        routineIndex: 0,
        routineTimer: 0,
        state: 'idle', // idle/walk/talk
        talkCooldown: 0,
        playerNear: false,
      };
      this.npcs.push(npc);
      this._registerInteraction(npc);
    }
  }

  _registerInteraction(npc) {
    this.interactionSystem.register({
      id: npc.def.id,
      type: 'npc',
      name: npc.def.name,
      description: npc.def.role,
      getPosition: () => { const v = npc.pos.clone(); v.y = 0.2; return v; },
      radius: 2.2,
      promptLabel: `Falar com ${npc.def.name}`,
      onInteract: () => { this.openDialog(npc); return { message: '' }; },
    });
  }

  _bindDialog() {
    const prevOpen = this.dialogUI.onOpenChange;
    this.dialogUI.onOpenChange = (open) => {
      if (!open) { for (const n of this.npcs) if (n.state === 'talk') n.state = 'idle'; }
      prevOpen?.(open);
    };
    this.dialogUI.onChoice = (choice) => this._handleChoice(choice);
  }

  openDialog(npc) {
    this.currentNpc = npc;
    npc.state = 'talk';
    npc.talkCooldown = 1.0;
    this.state.met[npc.def.id] = true;
    this._saveState();
    // report mission talk for m2_talk_maya
    if (npc.def.id === 'npc_maya') this.missionSystem.reportEvent({ type: 'interact', target: 'npc_maya' });
    this.currentNodeId = 'start';
    this._renderNode();
  }

  _ctx() {
    return {
      playerName: 'Sobrevivente',
      trust: this.currentNpc ? this.getTrust(this.currentNpc.def.id) : 0,
      flags: this.state.flags,
      missions: this.missionSystem,
      inventory: this.inventory,
      factions: this.factionSystem,
      decisions: this.decisionSystem,
    };
  }

  _renderNode() {
    const npc = this.currentNpc;
    if (!npc) return;
    const node = npc.def.dialogs[this.currentNodeId];
    if (!node) { this.dialogUI.close(); return; }
    const ctx = this._ctx();
    const text = typeof node.text === 'function' ? node.text(ctx) : node.text;
    const choices = typeof node.choices === 'function' ? node.choices(ctx) : (node.choices || []);
    const trust = this.getTrust(npc.def.id);
    const fId = this.factionSystem?.getFactionForNpc?.(npc.def.id);
    const f = fId ? this.factionSystem.getFaction(fId) : null;
    const trustLabel = f ? `${trust} | ${f.name}: ${f.status} (${f.rep})` : trust;
    this.dialogUI.openDialog({ name: npc.def.name, role: npc.def.role, text, choices, trust: trustLabel });
  }

  _handleChoice(choice) {
    const npc = this.currentNpc;
    if (!npc) return;
    const ctx = this._ctx();
    // actions
    if (choice.decision && this.decisionSystem) this.decisionSystem.record(choice.decision.id, choice.decision);
    if (choice.trust) this.addTrust(npc.def.id, choice.trust);
    if (choice.factionRep && this.factionSystem) this.factionSystem.addRep(choice.factionRep.faction, choice.factionRep.amount, 'dialog');
    if (choice.action === 'set_flag' && choice.flag) this.setFlag(choice.flag, true);
    if (choice.action === 'faction_rep' && this.factionSystem && choice.faction) this.factionSystem.addRep(choice.faction, choice.amount || 0, 'dialog');
    if (choice.action === 'accept_m2') {
      this.missionSystem.startMission('m2_abrigo_seguro');
      this.setFlag('m2_accepted', true);
      this.missionSystem.onToast?.('Maya confiou uma missão a você.', 2000);
    }
    if (choice.action === 'accept_m3') {
      this.missionSystem.startMission('m3_rota_segura');
      this.setFlag('m3_accepted', true);
      this.factionSystem?.addRep('sentinelas_ferrovia', 5, 'missão aceita');
      this.decisionSystem?.record('m3_accepted', { label:'Aceitou ajudar os Sentinelas da Ferrovia', consequence:'Rota segura em andamento; Sentinelas mais receptivos.', state:'active' });
      this.missionSystem.onToast?.('Jonas confiou uma missão a você.', 2000);
    }
    if (choice.action === 'accept_m4') {
      this.missionSystem.startMission('m4_pecas_criticas');
      this.setFlag('m4_accepted', true);
      this.factionSystem?.addRep('catadores', 5, 'missão aceita');
      this.decisionSystem?.record('m4_accepted', { label:'Aceitou ajudar os Catadores', consequence:'Coleta de peças em andamento; Catadores mais receptivos.', state:'active' });
      this.missionSystem.onToast?.('Tess confiou uma missão a você.', 2000);
    }
    if (choice.action === 'complete_m2') {
      if (this.inventory.hasItem('medkit')) {
        this.inventory.removeItem('medkit', 1);
        this.missionSystem.reportEvent({ type: 'interact', target: 'npc_maya_return' });
        this.addTrust('npc_maya', 1);
        this.setFlag('m2_returned', true);
        this.factionSystem?.addRep('refugio_mercado', 15, 'missão concluída');
      }
    }
    if (choice.action === 'complete_m2_paid') {
      if (this.inventory.hasItem('medkit')) {
        this.inventory.removeItem('medkit', 1);
        this.missionSystem.reportEvent({ type: 'interact', target: 'npc_maya_return' });
        this.addTrust('npc_maya', -1);
        this.setFlag('m2_returned', true);
        this.factionSystem?.addRep('refugio_mercado', 5, 'missão concluída com cobrança');
        if (this.tradeSystem) { this.tradeSystem.credits = Math.max(0, (this.tradeSystem.credits||0) + 60); this.tradeSystem.save?.(); }
        this.missionSystem.onToast?.('Você recebeu 60 CR, mas Maya não gostou.', 2400);
      }
    }
    if (choice.action === 'complete_m4') {
      const have = this.inventory.getCount?.('mechanical_parts') || 0;
      if (have >= 2) {
        this.inventory.removeItem('mechanical_parts', 2);
        this.missionSystem.reportEvent({ type: 'interact', target: 'npc_tess_return' });
        this.addTrust('npc_tess', 1);
        this.setFlag('m4_returned', true);
        this.factionSystem?.addRep('catadores', 15, 'missão concluída');
        this.decisionSystem?.record('m4_completed', { label:'Entregou peças aos Catadores', consequence:'Oficina dos Catadores fortalecida; melhores negócios.', state:'completed' });
      } else {
        this.missionSystem.onToast?.('Você precisa de 2 peças mecânicas.', 1800);
      }
    }
    if (choice.action === 'trade') {
      const npcId = npc.def.id;
      const fId = this.factionSystem?.getFactionForNpc?.(npcId);
      if (fId && !this.factionSystem.canTrade(fId)) {
        this.missionSystem.onToast?.('Esta facção está hostil. Comércio recusado.', 2000);
        this._renderNode();
        return;
      }
      this.dialogUI.close();
      this.tradeUI?.open(npcId);
      return;
    }
    if (choice.action === 'close') { this.dialogUI.close(); return; }
    if (choice.next) { this.currentNodeId = choice.next; this._renderNode(); return; }
    this.dialogUI.close();
  }

  update(dt, playerPos) {
    for (const npc of this.npcs) {
      npc.talkCooldown = Math.max(0, npc.talkCooldown - dt);
      const distToPlayer = npc.pos.distanceTo(playerPos);
      npc.playerNear = distToPlayer < 4.5;

      if (npc.state === 'talk') {
        const dx = playerPos.x - npc.pos.x, dz = playerPos.z - npc.pos.z;
        npc.yawTarget = Math.atan2(dx, dz);
        this._smoothYaw(npc, dt, 6);
        this._animate(npc, dt, false, true);
        this._sync(npc);
        continue;
      }

      const routine = npc.def.routine;
      const step = routine[npc.routineIndex % routine.length];
      if (step.type === 'idle') {
        npc.state = 'idle';
        npc.routineTimer += dt;
        if (npc.routineTimer >= step.dur) { npc.routineTimer = 0; npc.routineIndex++; }
        if (npc.playerNear) { const dx = playerPos.x - npc.pos.x, dz = playerPos.z - npc.pos.z; npc.yawTarget = Math.atan2(dx, dz); }
      } else if (step.type === 'walk') {
        npc.state = 'walk';
        const target = new THREE.Vector3(step.pos.x, npc.pos.y, step.pos.z);
        const to = target.clone().sub(npc.pos); to.y = 0;
        const dist = to.length();
        if (dist < 0.15) {
          npc.routineTimer = 0; npc.routineIndex++;
        } else {
          to.normalize();
          npc.yawTarget = Math.atan2(to.x, to.z);
          npc.pos.addScaledVector(to, Math.min(dist, dt * 1.15));
        }
      }

      if (npc.playerNear && npc.state === 'walk' && distToPlayer < 1.6) npc.state = 'idle';
      this._smoothYaw(npc, dt, npc.state === 'walk' ? 5 : 3);
      this._animate(npc, dt, npc.state === 'walk', false);
      this._sync(npc);
    }
  }

  _smoothYaw(npc, dt, speed=4) {
    if (npc.yawTarget == null) npc.yawTarget = npc.yaw;
    let dy = npc.yawTarget - npc.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    npc.yaw += dy * Math.min(1, dt * speed);
  }

  _animate(npc, dt, walking, talking=false) {
    npc.animTime = (npc.animTime || 0) + dt * (walking ? 5.8 : (talking ? 2.4 : 1.6));
    const t = npc.animTime;
    const swing = walking ? Math.sin(t) * 0.42 : Math.sin(t * 0.8) * 0.03;
    const breathe = Math.sin(t * 0.9) * 0.006;
    npc.parts.legL.rotation.x = swing;
    npc.parts.legR.rotation.x = -swing;
    const idleArm = Math.sin(t * 0.7) * 0.03;
    npc.parts.armL.rotation.x = -swing * 0.75 + (walking ? 0 : idleArm);
    npc.parts.armR.rotation.x = swing * 0.75 - (walking ? 0 : idleArm);
    if (talking) {
      npc.parts.armR.rotation.x = -0.35 + Math.sin(t * 1.6) * 0.12;
      npc.parts.armR.rotation.z = -0.15 + Math.sin(t * 1.2) * 0.05;
      npc.parts.armL.rotation.x = -0.15 + Math.sin(t * 1.1 + 1) * 0.05;
    } else {
      npc.parts.armR.rotation.z = 0;
    }
    npc.parts.head.rotation.y = Math.sin(t * 0.45) * (walking ? 0.04 : 0.07);
    npc.parts.head.rotation.x = walking ? 0.02 : Math.sin(t * 0.35) * 0.015;
    npc.parts.head.position.y = 1.62 + breathe;
  }

  _sync(npc) {
    npc.group.position.copy(npc.pos);
    npc.group.rotation.y = npc.yaw;
  }

  getNPCById(id) { return this.npcs.find(n => n.def.id === id); }
}
