import * as THREE from 'three';
import { STRUCTURE_DEFS, SHELTER_SITES } from '../data/shelters.js';
import { ITEM_DEFS } from '../data/items.js';

function clone(v){ return { x:v.x, y:v.y, z:v.z }; }

export class ShelterSystem {
  constructor(scene, interactionSystem, inventory, saveSystem, collisions, hud) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.inventory = inventory;
    this.saveSystem = saveSystem;
    this.collisions = collisions;
    this.hud = hud;
    this.group = new THREE.Group();
    this.group.name = 'Shelters';
    this.scene.add(this.group);
    this.sites = SHELTER_SITES.map(s => this._initSite(s));
    this.builtMeshes = new Map(); // key siteId:slotId -> {mesh, collision, light, interactId}
    this.previewMesh = null;
    this.onChange = null;
    this._load();
    this._rebuildAll();
    this._registerSiteInteractions();
  }

  _initSite(def) {
    return {
      def,
      id: def.id,
      claimed: !!def.preClaimed,
      slots: Object.fromEntries(def.slots.map(sl => [sl.id, {
        slotId: sl.id, type: sl.type, built: false, level: 0, hp: 0, maxHp: 0,
        open: true, // for doors
        storage: [], // [{id,qty,...}]
        storageCap: 0,
      }])),
    };
  }

  _load() {
    const s = this.saveSystem?.get?.();
    const saved = s?.shelters;
    if (!saved || typeof saved !== 'object') return;
    for (const site of this.sites) {
      const ss = saved[site.id];
      if (!ss) continue;
      site.claimed = !!ss.claimed || site.def.preClaimed;
      if (ss.slots && typeof ss.slots === 'object') {
        for (const [slotId, slotState] of Object.entries(ss.slots)) {
          const slot = site.slots[slotId];
          if (!slot || !slotState) continue;
          slot.built = !!slotState.built;
          slot.level = Math.max(0, Math.floor(slotState.level || 0));
          slot.hp = Math.max(0, Number(slotState.hp || 0));
          slot.maxHp = Math.max(0, Number(slotState.maxHp || 0));
          slot.open = slotState.open !== false;
          slot.storageCap = Math.max(0, Math.floor(slotState.storageCap || 0));
          if (Array.isArray(slotState.storage)) {
            slot.storage = slotState.storage.filter(i=>i&&i.id).map(i=>({ ...i, qty: Math.max(1, Math.floor(i.qty||1)) }));
          }
        }
      }
    }
  }

  save() {
    const payload = {};
    for (const site of this.sites) {
      payload[site.id] = {
        claimed: site.claimed,
        slots: Object.fromEntries(Object.entries(site.slots).map(([k,v]) => [k, {
          built: v.built, level: v.level, hp: v.hp, maxHp: v.maxHp, open: v.open,
          storageCap: v.storageCap, storage: v.storage.map(i=>({ ...i })),
        }])),
      };
    }
    this.saveSystem?.save?.({ shelters: payload });
    this.onChange?.();
  }

  getSite(siteId) { return this.sites.find(s => s.id === siteId) || null; }
  getSites() { return this.sites; }
  getNearestSite(pos, maxDist = 12) {
    let best=null, bestD=Infinity;
    for (const s of this.sites) {
      const d = Math.hypot(pos.x - s.def.center.x, pos.z - s.def.center.z);
      if (d < bestD && d <= maxDist) { best=s; bestD=d; }
    }
    return best;
  }

  getSlotDef(slot) { return STRUCTURE_DEFS[slot.type]; }

  canBuild(site, slotId) {
    const slot = site?.slots[slotId];
    if (!site || !slot) return { ok:false, reason:'Slot inválido.' };
    if (!site.claimed) return { ok:false, reason:'Reivindique o abrigo antes de construir.' };
    if (slot.built) return { ok:false, reason:'Estrutura já construída.' };
    const def = STRUCTURE_DEFS[slot.type];
    for (const c of def.cost) { if (this.inventory.getCount(c.id) < c.qty) return { ok:false, reason:`Faltam materiais: ${ITEM_DEFS[c.id]?.name || c.id}.` }; }
    return { ok:true };
  }

  build(siteId, slotId) {
    const site = this.getSite(siteId); const slot = site?.slots[slotId];
    const check = this.canBuild(site, slotId);
    if (!check.ok) return check;
    const def = STRUCTURE_DEFS[slot.type];
    for (const c of def.cost) this.inventory.removeItem(c.id, c.qty);
    slot.built = true; slot.level = 1; slot.maxHp = def.hp; slot.hp = def.maxHp;
    slot.open = slot.type !== 'reinforced_door' ? true : false; // doors start closed
    if (def.storageSlots) { slot.storageCap = def.storageSlots; slot.storage = slot.storage || []; }
    this._rebuildSlot(site, slot);
    this.save();
    return { ok:true, message:`${def.name} construída.` };
  }

  canUpgrade(site, slotId) {
    const slot = site?.slots[slotId];
    if (!site || !slot || !slot.built) return { ok:false, reason:'Construa a estrutura primeiro.' };
    if (slot.level >= 3) return { ok:false, reason:'Nível máximo atingido.' };
    const def = STRUCTURE_DEFS[slot.type];
    const mult = slot.level + 1; // level 2 cost = 2x base? simpler: 1.5 scaled
    const cost = def.cost.map(c => ({ id:c.id, qty: Math.max(1, Math.ceil(c.qty * (0.75 + slot.level * 0.5))) }));
    for (const c of cost) { if (this.inventory.getCount(c.id) < c.qty) return { ok:false, reason:`Faltam materiais para melhoria: ${ITEM_DEFS[c.id]?.name || c.id}.` }; }
    return { ok:true, cost };
  }

  upgrade(siteId, slotId) {
    const site = this.getSite(siteId); const slot = site?.slots[slotId];
    const check = this.canUpgrade(site, slotId);
    if (!check.ok) return check;
    for (const c of check.cost) this.inventory.removeItem(c.id, c.qty);
    slot.level += 1;
    const def = STRUCTURE_DEFS[slot.type];
    slot.maxHp = Math.round(def.hp * (1 + (slot.level-1)*0.35));
    slot.hp = slot.maxHp;
    if (def.storageSlots) slot.storageCap = def.storageSlots + (slot.level-1)*6;
    this._rebuildSlot(site, slot);
    this.save();
    return { ok:true, message:`${def.name} melhorada para nível ${slot.level}.` };
  }

  repair(siteId, slotId) {
    const site = this.getSite(siteId); const slot = site?.slots[slotId];
    if (!site || !slot || !slot.built) return { ok:false, reason:'Estrutura inválida.' };
    if (slot.hp >= slot.maxHp) return { ok:false, reason:'Estrutura já está íntegra.' };
    const def = STRUCTURE_DEFS[slot.type];
    const cost = [{ id:'scrap_metal', qty: 1 }, { id:'wood_plank', qty: 1 }].filter(c => def.cost.some(dc=>dc.id===c.id) || c.id==='scrap_metal');
    for (const c of cost) { if (this.inventory.getCount(c.id) < c.qty) return { ok:false, reason:'Faltam materiais para reparo.' }; }
    for (const c of cost) this.inventory.removeItem(c.id, c.qty);
    slot.hp = Math.min(slot.maxHp, slot.hp + Math.ceil(slot.maxHp * 0.4));
    this.save();
    return { ok:true, message:`${def.name} reparada.` };
  }

  claim(siteId) {
    const site = this.getSite(siteId);
    if (!site) return { ok:false, reason:'Abrigo inválido.' };
    if (site.claimed) return { ok:false, reason:'Abrigo já reivindicado.' };
    site.claimed = true;
    this.save();
    return { ok:true, message:`${site.def.name} reivindicado.` };
  }

  _key(site, slot){ return `${site.id}:${slot.slotId}`; }

  _clearSlot(site, slot) {
    const key = this._key(site,slot);
    const old = this.builtMeshes.get(key);
    if (old) {
      if (old.mesh) { this.group.remove(old.mesh); old.mesh.traverse(n=>{ if(n.isMesh){ n.geometry?.dispose?.(); const m=n.material; if(Array.isArray(m)) m.forEach(x=>x.dispose?.()); else m?.dispose?.(); } }); }
      if (old.collision) this.collisions.removeBox(old.collision);
      if (old.light) { this.scene.remove(old.light); old.light.dispose?.(); }
      if (old.interactId) this.interactionSystem.unregister(old.interactId);
      this.builtMeshes.delete(key);
    }
  }

  _rebuildAll() {
    for (const site of this.sites) for (const slot of Object.values(site.slots)) this._rebuildSlot(site, slot);
  }

  _rebuildSlot(site, slot) {
    this._clearSlot(site, slot);
    if (!slot.built) return;
    const def = STRUCTURE_DEFS[slot.type];
    const slotDef = site.def.slots.find(s=>s.id===slot.slotId);
    if (!slotDef) return;
    const pos = new THREE.Vector3(slotDef.pos.x, slotDef.pos.y, slotDef.pos.z);
    const ry = slotDef.ry || 0;
    const key = this._key(site, slot);
    const rec = { mesh:null, collision:null, light:null, interactId:null };

    const mesh = this._makeMesh(def.id, slot.level, slot);
    mesh.position.copy(pos);
    mesh.rotation.y = ry + (def.id === 'reinforced_door' && slot.open ? Math.PI/2.5 : 0);
    this.group.add(mesh);
    rec.mesh = mesh;

    // collisions for blocking structures
    if (['barricade','reinforced_window'].includes(def.id) || (def.id === 'reinforced_door' && !slot.open)) {
      const size = def.id === 'reinforced_door' ? {w:1.4,h:2.2,d:0.3} : def.id === 'reinforced_window' ? {w:1.2,h:1.2,d:0.2} : {w:1.8,h:1.3,d:0.4};
      const box = this._addOrientedCollision(pos, ry, size.w, size.h, size.d);
      rec.collision = box;
    }

    if (def.id === 'light') {
      const l = new THREE.PointLight(0xffe2b0, 0.8 + slot.level*0.2, 14 + slot.level*2, 2);
      l.position.set(pos.x, pos.y, pos.z);
      this.scene.add(l);
      rec.light = l;
    }

    // interactions: storage, rest, door, workbench
    if (def.id === 'storage_crate') {
      rec.interactId = `shelter_storage_${key}`;
      this.interactionSystem.register({
        id: rec.interactId, type:'storage', name:'Armazenamento do abrigo',
        getPosition: () => pos.clone().setY(0.2), radius: 2.0,
        promptLabel: 'Abrir armazenamento',
        onInteract: () => ({ message: '__OPEN_SHELTER_STORAGE__', data: { siteId: site.id, slotId: slot.slotId } }),
      });
    } else if (def.id === 'rest_area') {
      rec.interactId = `shelter_rest_${key}`;
      this.interactionSystem.register({
        id: rec.interactId, type:'rest', name:'Área de descanso',
        getPosition: () => pos.clone().setY(0.2), radius: 2.0,
        promptLabel: 'Descansar no abrigo',
        onInteract: ({ player }) => {
          if (player.dead) return { message: 'Você não pode descansar agora.' };
          if (player.isResting) { player.stopRest(); this.hud?.setStatus('EXPLORANDO'); return { message: 'Você parou de descansar.' }; }
          player.isResting = true; this.hud?.setStatus('DESCANSANDO');
          return { message: 'Descansando no abrigo. Mova-se para parar.' };
        },
      });
    } else if (def.id === 'reinforced_door') {
      rec.interactId = `shelter_door_${key}`;
      this.interactionSystem.register({
        id: rec.interactId, type:'door', name:'Porta reforçada',
        getPosition: () => pos.clone().setY(0.2), radius: 2.0,
        promptLabel: slot.open ? 'Fechar porta' : 'Abrir porta',
        onInteract: () => {
          slot.open = !slot.open;
          this._rebuildSlot(site, slot);
          this.save();
          return { message: slot.open ? 'Porta aberta.' : 'Porta fechada.' };
        },
      });
    } else if (def.id === 'workbench') {
      rec.interactId = `shelter_workbench_${key}`;
      this.interactionSystem.register({
        id: rec.interactId, type:'workbench', name:'Bancada de trabalho',
        getPosition: () => pos.clone().setY(0.2), radius: 2.0,
        promptLabel: 'Usar bancada (inventário/crafting)',
        onInteract: () => ({ message: '__OPEN_INVENTORY_CRAFT__' }),
      });
    }

    this.builtMeshes.set(key, rec);
  }

  _addOrientedCollision(pos, ry, w, h, d) {
    // approximate with axis-aligned box expanded for rotation (simple/safe)
    const cos = Math.abs(Math.cos(ry)), sin = Math.abs(Math.sin(ry));
    const ex = (w * cos + d * sin) / 2;
    const ez = (w * sin + d * cos) / 2;
    return this.collisions.addBox(new THREE.Vector3(pos.x-ex, 0, pos.z-ez), new THREE.Vector3(pos.x+ex, h, pos.z+ez));
  }

  _makeMesh(type, level, slot) {
    const g = new THREE.Group();
    const matWood = new THREE.MeshStandardMaterial({ color: 0x7a6349, roughness: 0.92, metalness: 0.03 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.55, metalness: 0.55 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x4b433b, roughness: 0.95 });
    const add = (geo, mat, x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz); m.castShadow=true; m.receiveShadow=true; g.add(m); return m; };
    if (type === 'barricade') {
      add(new THREE.BoxGeometry(1.8,1.2,0.25), matWood, 0,0.6,0);
      add(new THREE.BoxGeometry(1.9,0.12,0.3), matDark, 0,1.2,0);
      if (level>=2) add(new THREE.BoxGeometry(1.8,0.2,0.3), matMetal, 0,0.3,0);
      if (level>=3) add(new THREE.BoxGeometry(0.12,1.3,0.35), matMetal, -0.7,0.65,0);
    } else if (type === 'reinforced_door') {
      add(new THREE.BoxGeometry(1.5,2.2,0.18), matWood, 0,1.1,0);
      add(new THREE.BoxGeometry(0.08,2.2,0.22), matMetal, -0.72,1.1,0);
      add(new THREE.BoxGeometry(0.08,2.2,0.22), matMetal, 0.72,1.1,0);
      add(new THREE.BoxGeometry(0.2,0.05,0.08), matMetal, 0.45,1.1,0.12);
    } else if (type === 'reinforced_window') {
      add(new THREE.BoxGeometry(1.2,1.1,0.12), matDark, 0,0.6,0);
      add(new THREE.BoxGeometry(1.25,0.08,0.16), matWood, 0,1.15,0);
      add(new THREE.BoxGeometry(0.08,1.1,0.16), matWood, 0,0.6,0);
    } else if (type === 'storage_crate') {
      add(new THREE.BoxGeometry(1.2,0.9,1.0), matWood, 0,0.45,0);
      add(new THREE.BoxGeometry(1.24,0.08,1.04), matDark, 0,0.92,0);
      add(new THREE.BoxGeometry(0.08,0.95,1.05), matMetal, -0.58,0.48,0);
      add(new THREE.BoxGeometry(0.08,0.95,1.05), matMetal, 0.58,0.48,0);
    } else if (type === 'workbench') {
      add(new THREE.BoxGeometry(1.6,0.12,0.8), matWood, 0,0.9,0);
      for (const sx of [-0.65,0.65]) for (const sz of [-0.28,0.28]) add(new THREE.BoxGeometry(0.1,0.9,0.1), matDark, sx,0.45,sz);
      add(new THREE.BoxGeometry(0.4,0.18,0.25), matMetal, -0.35,1.02,0);
    } else if (type === 'light') {
      add(new THREE.CylinderGeometry(0.04,0.04,0.5,8), matMetal, 0,-0.25,0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10), new THREE.MeshStandardMaterial({color:0xfff0cc, emissive:0xffd27a, emissiveIntensity:0.9}));
      bulb.position.set(0,-0.55,0); g.add(bulb);
    } else if (type === 'rest_area') {
      add(new THREE.BoxGeometry(2.0,0.25,0.9), matWood, 0,0.25,0);
      add(new THREE.BoxGeometry(1.9,0.08,0.8), new THREE.MeshStandardMaterial({color:0x6b6258, roughness:0.95}), 0,0.38,0);
    }
    return g;
  }

  _registerSiteInteractions() {
    for (const site of this.sites) {
      this.interactionSystem.register({
        id: `shelter_site_${site.id}`,
        type: 'shelter',
        name: site.def.name,
        getPosition: () => new THREE.Vector3(site.def.center.x, 0.2, site.def.center.z),
        radius: 2.8,
        promptLabel: `Gerenciar ${site.def.name}`,
        onInteract: () => ({ message: '__OPEN_SHELTER__', data: { siteId: site.id } }),
      });
    }
  }

  clearPreview() {
    if (this.previewMesh) { this.group.remove(this.previewMesh); this.previewMesh.traverse(n=>{ if(n.isMesh){ n.geometry?.dispose?.(); n.material?.dispose?.(); } }); this.previewMesh = null; }
  }
  showPreview(siteId, slotId) {
    this.clearPreview();
    const site=this.getSite(siteId); const slot=site?.slots?.[slotId]; if(!site||!slot) return;
    const def=STRUCTURE_DEFS[slot.type]; const slotDef=site.def.slots.find(s=>s.id===slotId); if(!def||!slotDef) return;
    const mesh=this._makeMesh(def.id, Math.max(1,slot.level||1), { ...slot, open:false });
    mesh.traverse(n=>{ if(n.isMesh){ n.material = n.material.clone(); n.material.transparent=true; n.material.opacity=0.35; n.material.emissive?.set?.(0x44aa66); n.material.emissiveIntensity=0.25; }});
    mesh.position.set(slotDef.pos.x, slotDef.pos.y, slotDef.pos.z);
    mesh.rotation.y = slotDef.ry || 0;
    this.previewMesh = mesh;
    this.group.add(mesh);
  }

  getStorage(slot) { return slot.storage || []; }

  transferToStorage(siteId, slotId, itemId, qty=1) {
    const site=this.getSite(siteId); const slot=site?.slots[slotId];
    if (!site||!slot||!slot.built||slot.storageCap<=0) return {ok:false, message:'Armazenamento inválido.'};
    qty = Math.max(1, Math.floor(qty));
    const have = this.inventory.getCount(itemId);
    if (have < qty) return {ok:false, message:'Quantidade insuficiente no inventário.'};
    const used = slot.storage.reduce((a,i)=>a+(i.qty||0),0);
    if (used + qty > slot.storageCap) return {ok:false, message:'Armazenamento sem capacidade.'};
    const item = this.inventory.getItems().find(i=>i.id===itemId);
    if (!item) return {ok:false, message:'Item não encontrado.'};
    if (!this.inventory.removeItem(itemId, qty)) return {ok:false, message:'Falha ao remover item.'};
    const ex = slot.storage.find(i=>i.id===itemId);
    if (ex) ex.qty += qty; else slot.storage.push({ ...item, qty });
    this.save();
    return {ok:true, message:`${item.name} x${qty} armazenado.`};
  }

  transferFromStorage(siteId, slotId, itemId, qty=1) {
    const site=this.getSite(siteId); const slot=site?.slots[slotId];
    if (!site||!slot||!slot.built||slot.storageCap<=0) return {ok:false, message:'Armazenamento inválido.'};
    qty = Math.max(1, Math.floor(qty));
    const ex = slot.storage.find(i=>i.id===itemId);
    if (!ex || ex.qty < qty) return {ok:false, message:'Quantidade insuficiente no armazenamento.'};
    const def = { ...ex };
    const can = this.inventory.canAdd(def, qty);
    if (!can.ok) return {ok:false, message: can.reason==='weight' ? 'Peso máximo no inventário.' : 'Inventário cheio.'};
    const added = this.inventory.addItem(def, qty);
    if (!added.added) return {ok:false, message:'Falha ao transferir.'};
    ex.qty -= added.added;
    if (ex.qty <= 0) slot.storage = slot.storage.filter(i=>i!==ex);
    this.save();
    return {ok:true, message:`${def.name} x${added.added} retirado.`};
  }
}
