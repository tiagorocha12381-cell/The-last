import * as THREE from 'three';
import { EQUIPMENT_DEFS } from './InventorySystem.js';
import { ITEM_DEFS, rollLootMany } from '../data/items.js';
import { GAME_CONFIG, DIFFICULTY_PRESETS } from '../config/constants.js';
import { EXPLORATION_SITES } from '../data/exploration.js';

export class WorldInteractables {
  constructor(scene, interactionSystem, inventory, world, missionSystem = null, saveSystem = null) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.inventory = inventory;
    this.world = world;
    this.missionSystem = missionSystem;
    this.saveSystem = saveSystem;
    this.discoverySystem = null;
    this.dialogUI = null;
    this.hud = null;
    this.onCollect = null; // (def, qty) => void
    this.lootBonus = 0;
    this.group = new THREE.Group();
    this.group.name = 'Interactables';
    this.scene.add(this.group);
    this.animated = [];
    this.containerStates = {}; // id -> { open, looted, read }
    this._loadState();
    this._spawnAll();
  }

  _diff() { return DIFFICULTY_PRESETS[GAME_CONFIG.difficulty] || DIFFICULTY_PRESETS.normal; }
  _lootQty(def, baseQty=1) {
    const mult = this._diff().lootMult ?? 1;
    if (!mult || mult === 1) return baseQty;
    const type = (def?.type || '').toLowerCase();
    if (type === 'arma' || type === 'equipamento') return baseQty;
    const scaled = baseQty * mult;
    if (mult > 1) return Math.max(1, Math.round(scaled + (Math.random() < (scaled % 1) ? 1 : 0)));
    return Math.max(1, Math.floor(scaled + (Math.random() < scaled % 1 ? 1 : 0)));
  }

  _loadState() {
    const s = this.saveSystem?.get?.();
    if (s?.lootState && typeof s.lootState === 'object') {
      this.containerStates = { ...s.lootState };
    }
  }

  _saveState() {
    this.saveSystem?.save?.({ lootState: { ...this.containerStates } });
  }

  _spawnAll() {
    this._spawnCollectibles();
    this._spawnContainers();
  }

  setExplorationDeps({ discoverySystem, dialogUI, hud } = {}) {
    if (discoverySystem) this.discoverySystem = discoverySystem;
    if (dialogUI) this.dialogUI = dialogUI;
    if (hud) this.hud = hud;
    if (!this._explorationSpawned) {
      this._explorationSpawned = true;
      this._spawnExplorationSites();
    }
  }

  _spawnCollectibles() {
    const items = [
      { id:'col_canned_1', def: ITEM_DEFS.canned_food, pos: [-11.2, 0.18, -6.8], qty: 1 },
      { id:'col_water_1', def: ITEM_DEFS.water_bottle, pos: [10.8, 0.18, 6.2], qty: 2 },
      { id:'col_scrap_1', def: ITEM_DEFS.scrap_metal, pos: [3.2, 0.18, 3.0], qty: 2 },
      { id:'col_bandage_1', def: ITEM_DEFS.bandage, pos: [-12.8, 0.18, 4.0], qty: 1 },
      { id:'col_wood_1', def: ITEM_DEFS.wood_plank, pos: [13.0, 0.18, -2.4], qty: 3 },
      { id:'col_elec_1', def: ITEM_DEFS.electronic_parts, pos: [-3.5, 0.18, -16.0], qty: 1 },
      { id:'col_water_2', def: ITEM_DEFS.water_bottle, pos: [-6.5, 0.18, 14.0], qty: 1 },
      { id:'col_canned_2', def: ITEM_DEFS.canned_food, pos: [6.0, 0.18, -18.5], qty: 2 },
      { id:'col_battery_1', def: ITEM_DEFS.battery, pos: [12.2, 0.18, 18.0], qty: 1 },
      { id:'col_scrap_2', def: ITEM_DEFS.scrap_metal, pos: [-22.5, 0.18, -22.0], qty: 2 },
      { id:'col_map_1', def: ITEM_DEFS.map_fragment, pos: [19.5, 0.18, -10.5], qty: 1 },
      { id:'col_canned_3', def: ITEM_DEFS.canned_food, pos: [-31.0, 0.18, 1.5], qty: 1 },
      { id:'col_energy_1', def: ITEM_DEFS.energy_bar, pos: [4.5, 0.18, 12.0], qty: 2 },
      { id:'col_medkit_1', def: ITEM_DEFS.medkit, pos: [-14.0, 0.18, -14.0], qty: 1 },
      { id:'col_water_3', def: ITEM_DEFS.water_bottle, pos: [20.0, 0.18, 5.0], qty: 1 },
      { id:'col_energy_2', def: ITEM_DEFS.energy_bar, pos: [-25.0, 0.18, 20.0], qty: 1 },
      { id:'col_bat_1', def: EQUIPMENT_DEFS.bat, pos: [-18.5, 0.18, -6.0], qty: 1 },
      { id:'col_machete_1', def: EQUIPMENT_DEFS.machete, pos: [22.0, 0.18, 15.0], qty: 1 },
      { id:'col_shock_1', def: EQUIPMENT_DEFS.shockrod, pos: [-34.0, 0.18, -28.0], qty: 1 },
      { id:'col_fabric_1', def: ITEM_DEFS.fabric, pos: [8.0, 0.18, -5.0], qty: 2 },
      { id:'col_mech_1', def: ITEM_DEFS.mechanical_parts, pos: [-8.0, 0.18, -20.0], qty: 1 },
      { id:'col_fabric_2', def: ITEM_DEFS.fabric, pos: [26.0, 0.18, 24.0], qty: 1 },
    ];
    for (const it of items) this._createCollectible(it.def, new THREE.Vector3(...it.pos), it.qty, it.id);
  }

  _createCollectible(def, pos, qty, stableId) {
    if (this.containerStates[stableId]?.looted) return;
    const mesh = this._buildItemMesh(def);
    mesh.position.copy(pos);
    mesh.position.y = 0.18;
    this.group.add(mesh);
    const baseY = mesh.position.y;
    const anim = { mesh, baseY, t: Math.random() * Math.PI * 2 };
    this.animated.push(anim);

    this.interactionSystem.register({
      id: stableId,
      type: 'item',
      name: def.name,
      description: def.description,
      getPosition: () => { const v = new THREE.Vector3(); mesh.getWorldPosition(v); v.y = 0.2; return v; },
      radius: 1.8,
      promptLabel: `Coletar ${def.name}`,
      onInteract: () => {
        const giveQty = this._lootQty(def, qty);
        const res = this.inventory.addItem(def, giveQty);
        if (res.full) return { message: res.reason === 'weight' ? 'Peso máximo atingido. Descarte algo para coletar.' : 'Inventário cheio. Libere espaço para coletar.' };
        this.missionSystem?.reportEvent({ type: 'collect', target: def.id, amount: giveQty });
        this.onCollect?.(def, giveQty);
        this.containerStates[stableId] = { looted: true };
        this._saveState();
        this.group.remove(mesh);
        const ai = this.animated.indexOf(anim);
        if (ai >= 0) this.animated.splice(ai, 1);
        mesh.traverse((n) => { if (n.isMesh) { n.geometry?.dispose?.(); if (Array.isArray(n.material)) n.material.forEach(m=>m.dispose?.()); else n.material?.dispose?.(); } });
        return { message: `Coletado: ${def.name} x${giveQty}.`, remove: true };
      },
    });
  }

  _buildItemMesh(def) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.30, 20),
      new THREE.MeshBasicMaterial({ color: 0xd96b4b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);

    let body;
    if (def.type === 'comida') {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.6, metalness: 0.3 }));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xb0b7bf, roughness: 0.4, metalness: 0.7 }));
      lid.position.y = 0.155; body.add(lid);
    } else if (def.type === 'água') {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0x6ca7c9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x2f6f95, roughness: 0.5 }));
      cap.position.y = 0.195; body.add(cap);
    } else if (def.type === 'missão') {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.38), new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 0.5, metalness: 0.4 }));
    } else if (def.type === 'peça') {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: 0x66707a, roughness: 0.55, metalness: 0.65 }));
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.24), new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.85, metalness: 0.1 }));
    }
    body.position.y = 0.22;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    return g;
  }

  _spawnContainers() {
    const containers = [
      { id:'cont_cabinet_1', type: 'cabinet', name: 'Armário', pos: [-16.2, 0.18, -13.5], ry: Math.PI/2, lootTable: 'food', rolls: 2 },
      { id:'cont_drawer_1', type: 'drawer', name: 'Gaveta', pos: [19.0, 0.18, -13.2], ry: -Math.PI/2, lootTable: 'mechanical', rolls: 2 },
      { id:'cont_crate_1', type: 'crate', name: 'Caixa', pos: [-12.0, 0.18, 5.0], ry: 0.2, lootTable: 'common', rolls: 2 },
      { id:'cont_cabinet_2', type: 'cabinet', name: 'Armário', pos: [-12.5, 0.18, 18.5], ry: Math.PI/2, lootTable: 'medical', rolls: 2 },
      { id:'cont_crate_2', type: 'crate', name: 'Caixa de suprimentos', pos: [11.5, 0.18, -11.5], ry: -0.3, lootTable: 'food', rolls: 2 },
      { id:'cont_drawer_2', type: 'drawer', name: 'Gaveta de escrivaninha', pos: [-30.5, 0.18, -2.0], ry: Math.PI/2, fixedLoot: [ITEM_DEFS.mission_key] },
      { id:'cont_crate_3', type: 'crate', name: 'Recipiente', pos: [2.5, 0.18, -28.0], ry: 0.5, lootTable: 'common', rolls: 2 },
      { id:'cont_cabinet_3', type: 'cabinet', name: 'Armário metálico', pos: [32.0, 0.18, 4.0], ry: -Math.PI/2, lootTable: 'mechanical', rolls: 2 },
      { id:'cont_backpack_1', type: 'backpack', name: 'Mochila abandonada', pos: [5.5, 0.18, 26.0], ry: 0.4, lootTable: 'food', rolls: 2 },
      { id:'cont_backpack_2', type: 'backpack', name: 'Mochila de sobrevivente', pos: [-24.0, 0.18, 12.0], ry: -0.7, lootTable: 'medical', rolls: 1 },
      { id:'cont_crate_4', type: 'crate', name: 'Caixa de peças', pos: [28.0, 0.18, -20.0], ry: 0.1, lootTable: 'mechanical', rolls: 3 },
      { id:'cont_cabinet_4', type: 'cabinet', name: 'Armário de cozinha', pos: [-18.0, 0.18, 22.0], ry: Math.PI/2, lootTable: 'food', rolls: 2 },
      { id:'cont_crate_locked_1', type: 'crate', name: 'Caixa trancada', pos: [16.0, 0.18, 30.0], ry: 0.3, lootTable: 'mechanical', rolls: 3, requiresItem: 'basic_tool', requiresMessage: 'Esta caixa está trancada. Você precisa de uma Ferramenta básica.' },
      { id:'cont_military_1', type: 'crate', name: 'Caixa Militar', pos: [-20.0, 0.18, 95.0], ry: 0.8, lootTable: 'military', rolls: 2 },
    ];
    for (const c of containers) this._createContainer(c);
  }

  _spawnExplorationSites() {
    for (const site of (EXPLORATION_SITES || [])) {
      const center = new THREE.Vector3(site.pos.x, site.pos.y || 0.18, site.pos.z);
      // Register discoverable point
      this.discoverySystem?.registerPoint({
        id: site.id, name: site.name, pos: center.clone(), radius: site.radius || 10,
        secret: !!site.secret, showOnMap: site.showOnMap !== false, type: site.type, desc: site.desc
      });
      // Visual props (lightweight)
      for (const p of (site.props || [])) this._createSimpleProp(p);
      // Interactables
      for (const it of (site.interactables || [])) {
        if (it.type === 'document') this._createDocumentInteractable(site, it);
        else if (it.type === 'stash') this._createStashInteractable(site, it);
      }
    }
  }

  _createSimpleProp(p) {
    const g = new THREE.Group();
    g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    g.rotation.y = p.ry || 0;
    const matWood = new THREE.MeshStandardMaterial({ color: 0x7a644d, roughness: 0.95, metalness: 0.02 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x666d75, roughness: 0.7, metalness: 0.35 });
    if (p.kind === 'cabinet') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.55), matMetal); body.position.y=0.9; body.castShadow=true; body.receiveShadow=true; g.add(body);
    } else if (p.kind === 'backpack') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.32), new THREE.MeshStandardMaterial({color:0x5a6a4a, roughness:0.95})); body.position.y=0.32; body.castShadow=true; body.receiveShadow=true; g.add(body);
    } else { // crate
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.95), matWood); body.position.y=0.375; body.castShadow=true; body.receiveShadow=true; g.add(body);
    }
    this.group.add(g);
  }

  _createDocumentInteractable(site, it) {
    const state = this.containerStates[it.id] || { read: false, looted: false };
    this.containerStates[it.id] = state;
    const pos = new THREE.Vector3(it.pos[0], it.pos[1] ?? 0.8, it.pos[2]);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.36), new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.9, metalness: 0.02 }));
    mesh.position.copy(pos); mesh.rotation.x = -Math.PI/2; mesh.rotation.z = Math.random()*0.5; mesh.castShadow=true; mesh.receiveShadow=true;
    this.group.add(mesh);
    this.interactionSystem.register({
      id: it.id, type: 'document', name: it.name, description: it.text?.slice(0,60) || 'Documento abandonado.',
      getPosition: () => pos.clone().setY(0.2), radius: it.radius || 1.8,
      promptLabel: it.prompt || `Ler ${it.name}`,
      onInteract: () => {
        if (!state.read) {
          state.read = true;
          // reward once
          if (!state.looted && it.reward) {
            const def = ITEM_DEFS[it.reward.id];
            if (def) {
              const res = this.inventory.addItem({ ...def }, it.reward.qty || 1);
              if (!res.full) { state.looted = true; this.missionSystem?.reportEvent({type:'collect', target:def.id, amount: it.reward.qty||1}); this.onCollect?.(def, it.reward.qty||1); }
            } else { state.looted = true; }
          } else { state.looted = true; }
          this._saveState();
        }
        const text = it.text || 'Nada legível.';
        if (this.dialogUI?.openDialog) {
          const prev = this.dialogUI.onChoice;
          this.dialogUI.openDialog({ name: it.name, role: site.name.toUpperCase(), text, choices: [{label:'Fechar', action:'close'}], trust: '-' });
          this.dialogUI.onChoice = (c) => { this.dialogUI.onChoice = prev; this.dialogUI.close(); };
        } else {
          this.hud?.showToast?.(text.slice(0,120), 3500);
        }
        return { message: state.looted ? `Você leu: ${it.name}.` : `Documento lido.` };
      }
    });
  }

  _createStashInteractable(site, it) {
    const state = this.containerStates[it.id] || { open: false, looted: false };
    this.containerStates[it.id] = state;
    const pos = new THREE.Vector3(it.pos[0], it.pos[1] ?? 0.18, it.pos[2]);
    this.interactionSystem.register({
      id: it.id, type: 'container', name: it.name, description: `Esconderijo em ${site.name}.`,
      getPosition: () => pos.clone().setY(0.2), radius: it.radius || 2.0,
      promptLabel: state.looted ? `Examinar ${it.name.toLowerCase()}` : (it.prompt || `Vasculhar ${it.name.toLowerCase()}`),
      onInteract: () => {
        if (state.looted) return { message: `${it.name} já foi vasculhado.` };
        const loot = (it.loot || []).map(l => ({ def: ITEM_DEFS[l.id] ? { ...ITEM_DEFS[l.id] } : null, qty: l.qty || 1 })).filter(l => l.def);
        const lines = [];
        let anyFull = false;
        for (const r of loot) {
          const giveQty = this._lootQty(r.def, r.qty);
          const res = this.inventory.addItem(r.def, giveQty);
          if (res.full) { anyFull = res.reason || 'slots'; continue; }
          lines.push(`${r.def.name} x${giveQty}`);
          this.missionSystem?.reportEvent({ type:'collect', target:r.def.id, amount: giveQty });
          this.onCollect?.(r.def, giveQty);
        }
        if (lines.length > 0) {
          state.looted = true; state.open = true; this._saveState();
          const fullMsg = anyFull ? (anyFull === 'weight' ? ' Peso máximo para o resto.' : ' Inventário cheio para o resto.') : '';
          return { message: `${it.name}: você encontrou ${lines.join(', ')}.${fullMsg}` };
        }
        this._saveState();
        return { message: `${it.name}: sem espaço/peso suficiente no inventário.` };
      }
    });
  }

  registerVehicleLoot(vehicle) {
    if (!vehicle?.mesh || vehicle.drivable) return;
    const px = Math.round(vehicle.mesh.position.x * 10);
    const pz = Math.round(vehicle.mesh.position.z * 10);
    const id = vehicle.id ? `cont_vehicle_${vehicle.id}` : `cont_vehicle_${px}_${pz}`;
    if (this.interactionSystem.interactables?.some(i => i.id === id)) return;
    const state = this.containerStates[id] || { open: false, looted: false };
    this.containerStates[id] = state;
    this.interactionSystem.register({
      id,
      type: 'container',
      name: 'Veículo abandonado',
      description: 'Pode conter peças ou suprimentos.',
      getPosition: () => { const v = vehicle.mesh.position.clone(); v.y = 0.2; return v; },
      radius: 2.4,
      promptLabel: state.looted ? 'Examinar veículo abandonado' : 'Saquear veículo abandonado',
      onInteract: () => {
        if (state.looted) return { message: 'Este veículo já foi saqueado.' };
        const extra = this.lootBonus > 0 && Math.random() < this.lootBonus ? 1 : 0;
        const loot = rollLootMany('vehicle', 2 + extra);
        const lines = [];
        let anyFull = false;
        for (const r of loot) {
          const giveQty = this._lootQty(r.def, r.qty);
          const res = this.inventory.addItem(r.def, giveQty);
          if (res.full) { anyFull = res.reason || 'slots'; continue; }
          lines.push(`${r.def.name} x${giveQty}`);
          this.missionSystem?.reportEvent({ type: 'collect', target: r.def.id, amount: giveQty });
          this.onCollect?.(r.def, giveQty);
        }
        if (lines.length > 0) {
          state.looted = true; state.open = true;
          this._saveState();
          const fullMsg = anyFull === 'weight' ? ' Peso máximo para o resto.' : ' Inventário cheio para o resto.';
          return { message: `Você vasculhou o veículo e encontrou: ${lines.join(', ')}.${anyFull ? fullMsg : ''}` };
        }
        this._saveState();
        return { message: 'Veículo vasculhado, mas não há espaço/peso suficiente no inventário.' };
      }
    });
  }

  _createContainer(cfg) {
    const g = new THREE.Group();
    g.position.copy(new THREE.Vector3(...cfg.pos));
    g.rotation.y = cfg.ry || 0;
    this.group.add(g);

    let doorMesh = null;
    let doorPivot = null;
    if (cfg.type === 'cabinet') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.6), new THREE.MeshStandardMaterial({ color: 0x666d75, roughness: 0.7, metalness: 0.35 }));
      body.position.y = 1.0; body.castShadow = true; body.receiveShadow = true; g.add(body);
      doorPivot = new THREE.Group(); doorPivot.position.set(-0.55, 1.0, 0.31);
      doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.95, 0.05), new THREE.MeshStandardMaterial({ color: 0x737b84, roughness: 0.65, metalness: 0.4 }));
      doorMesh.position.set(0.54, 0, 0); doorMesh.castShadow = true; doorPivot.add(doorMesh);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.3, metalness: 0.8 }));
      handle.position.set(0.96, 0, 0.04); doorPivot.add(handle);
      g.add(doorPivot);
    } else if (cfg.type === 'drawer') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x6b5545, roughness: 0.85, metalness: 0.05 }));
      body.position.y = 0.45; body.castShadow = true; body.receiveShadow = true; g.add(body);
      doorPivot = new THREE.Group(); doorPivot.position.set(0, 0.55, 0.35);
      doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0x7a624f, roughness: 0.8, metalness: 0.05 }));
      doorMesh.castShadow = true; doorPivot.add(doorMesh);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.12,8), new THREE.MeshStandardMaterial({ color: 0xb0b7bf, roughness: 0.35, metalness: 0.8 }));
      handle.rotation.z = Math.PI/2; handle.position.set(0, 0, 0.06); doorPivot.add(handle);
      g.add(doorPivot);
    } else if (cfg.type === 'backpack') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), new THREE.MeshStandardMaterial({ color: 0x5a6a4a, roughness: 0.95, metalness: 0.02 }));
      body.position.y = 0.35; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.08), new THREE.MeshStandardMaterial({ color: 0x4e5c40, roughness: 0.95 }));
      pocket.position.set(0, 0.25, 0.2); g.add(pocket);
      doorPivot = null;
    } else { // crate
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x7a644d, roughness: 0.95, metalness: 0.02 }));
      body.position.y = 0.4; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.08, 1.04), new THREE.MeshStandardMaterial({ color: 0x6d5843, roughness: 0.95 }));
      lid.position.y = 0.84; lid.castShadow = true; g.add(lid);
      doorPivot = lid;
    }

    const state = this.containerStates[cfg.id] || { open: false, looted: false };
    this.containerStates[cfg.id] = state;
    // restore visual open state if looted/open
    if (state.open) {
      if (doorPivot && cfg.type !== 'crate' && cfg.type !== 'backpack') doorPivot.rotation.y = cfg.type === 'drawer' ? 0 : -Math.PI * 0.65;
      if (cfg.type === 'crate' && doorPivot) { doorPivot.rotation.x = -Math.PI * 0.45; doorPivot.position.z = -0.35; doorPivot.position.y = 0.95; }
    }
    const worldPos = new THREE.Vector3();
    this.interactionSystem.register({
      id: cfg.id,
      type: 'container',
      name: cfg.name,
      description: `${cfg.name} abandonado(a). Pode conter suprimentos.`,
      getPosition: () => { g.getWorldPosition(worldPos); worldPos.y = 0.2; return worldPos; },
      radius: 2.0,
      promptLabel: state.looted ? `Examinar ${cfg.name.toLowerCase()}` : `Saquear ${cfg.name.toLowerCase()}`,
      onInteract: () => {
        if (!state.open) {
          if (!state.looted && cfg.requiresItem && !this.inventory.hasItem(cfg.requiresItem)) {
            return { message: cfg.requiresMessage || `Você precisa de um item específico para abrir ${cfg.name.toLowerCase()}.` };
          }
          state.open = true;
          if (doorPivot && cfg.type !== 'crate' && cfg.type !== 'backpack') doorPivot.rotation.y = cfg.type === 'drawer' ? 0 : -Math.PI * 0.65;
          if (cfg.type === 'crate' && doorPivot) { doorPivot.rotation.x = -Math.PI * 0.45; doorPivot.position.z = -0.35; doorPivot.position.y = 0.95; }
          if (!state.looted) {
            const extra = (!cfg.fixedLoot && this.lootBonus > 0 && Math.random() < this.lootBonus) ? 1 : 0;
            const loot = cfg.fixedLoot ? cfg.fixedLoot.map(d => ({ def: { ...d }, qty: 1 })) : rollLootMany(cfg.lootTable || 'common', (cfg.rolls ?? 2) + extra);
            if (loot.length === 0) {
              state.looted = true; this._saveState();
              return { message: `${cfg.name} aberto(a), mas estava vazio(a).` };
            }
            const lines = [];
            let anyFull = false;
            for (const r of loot) {
              const giveQty = this._lootQty(r.def, r.qty);
              const res = this.inventory.addItem(r.def, giveQty);
              if (res.full) { anyFull = res.reason || 'slots'; continue; }
              lines.push(`${r.def.name} x${giveQty}`);
              this.missionSystem?.reportEvent({ type: 'collect', target: r.def.id, amount: giveQty });
              this.onCollect?.(r.def, giveQty);
            }
            if (lines.length > 0) {
              state.looted = true;
              this._saveState();
              if (anyFull) return { message: `${cfg.name}: você pegou ${lines.join(', ')}. ${anyFull === 'weight' ? 'Peso máximo' : 'Inventário cheio'} para o resto.` };
              return { message: `${cfg.name} aberto(a): você encontrou ${lines.join(', ')}.` };
            }
            this._saveState();
            return { message: `${cfg.name} aberto(a), mas não há espaço/peso suficiente no inventário.` };
          }
          this._saveState();
          return { message: `${cfg.name} aberto(a). Já foi saqueado(a).` };
        } else {
          state.open = false;
          if (doorPivot && cfg.type !== 'crate' && cfg.type !== 'backpack') doorPivot.rotation.y = 0;
          if (cfg.type === 'crate' && doorPivot) { doorPivot.rotation.x = 0; doorPivot.position.z = 0; doorPivot.position.y = 0.84; }
          this._saveState();
          return { message: `${cfg.name} fechado(a).` };
        }
      },
    });
  }

  update(dt) {
    for (const a of this.animated) {
      a.t += dt;
      a.mesh.position.y = a.baseY + Math.sin(a.t * 2.2) * 0.06;
      a.mesh.rotation.y += dt * 0.8;
    }
  }
}
