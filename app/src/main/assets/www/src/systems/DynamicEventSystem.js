import * as THREE from 'three';
import { ITEM_DEFS } from '../data/items.js';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];
const rnd = (a,b)=>a+Math.random()*(b-a);

function makeId(prefix='ev') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }

const EVENT_DEFS = [
  { type:'zombie_horde', title:'Horda em movimento', minTime:0, maxTime:24, weight:1.1, duration:[45,75], cooldown:180 },
  { type:'mysterious_noise', title:'Ruído misterioso', minTime:18, maxTime:6, weight:0.9, duration:[35,55], cooldown:150, nightWrap:true },
  { type:'supply_cache', title:'Cache de suprimentos', minTime:6, maxTime:20, weight:1.0, duration:[70,110], cooldown:200 },
  { type:'survivor_help', title:'Sobrevivente pedindo ajuda', minTime:7, maxTime:19, weight:0.85, duration:[80,120], cooldown:240 },
  { type:'danger_zone', title:'Zona perigosa', minTime:0, maxTime:24, weight:0.8, duration:[60,90], cooldown:220 },
  { type:'weather_shift', title:'Mudança climática repentina', minTime:0, maxTime:24, weight:0.6, duration:[50,90], cooldown:260 },
  { type:'distress_signal', title:'Pedido de socorro', minTime:0, maxTime:24, weight:0.75, duration:[90,130], cooldown:260 },
  { type:'abandoned_vehicle', title:'Veículo abandonado em situação inesperada', minTime:6, maxTime:22, weight:0.7, duration:[90,140], cooldown:280 },
  { type:'survivor_conflict', title:'Conflito entre sobreviventes e zumbis', minTime:8, maxTime:20, weight:0.75, duration:[80,120], cooldown:280 },
  { type:'shelter_supply_run', title:'Transporte de recursos entre abrigos', minTime:7, maxTime:18, weight:0.65, duration:[120,170], cooldown:320 },
];

export class DynamicEventSystem {
  constructor({ scene, player, enemyManager, interactionSystem, inventory, missionSystem, saveSystem, hud, audioSystem, dayNightWeather, dialogUI, npcSystem, tradeSystem = null, shelterSystem = null, progressionSystem = null }) {
    this.scene = scene;
    this.player = player;
    this.enemyManager = enemyManager;
    this.interactionSystem = interactionSystem;
    this.inventory = inventory;
    this.missionSystem = missionSystem;
    this.saveSystem = saveSystem;
    this.hud = hud;
    this.audioSystem = audioSystem;
    this.dayNightWeather = dayNightWeather;
    this.dialogUI = dialogUI;
    this.npcSystem = npcSystem;
    this.tradeSystem = tradeSystem;
    this.shelterSystem = shelterSystem;
    this.progressionSystem = progressionSystem;

    this.active = [];
    this.cooldowns = {}; // type -> until (game seconds timer)
    this.importantDone = {}; // id/type -> true
    this.recentTypes = [];
    this.consequences = {}; // flags/counters
    this.rewarded = {}; // eventId -> true
    this._timer = 0;
    this._nextSpawnCheck = 20;
    this._rngClock = 0;
    this._markers = new Map(); // eventId -> object3d
    this._interactIds = new Set();
    this.maxActive = 2;
    this.enabled = true;
    this._load();
  }

  _load() {
    const s = this.saveSystem.get() || {};
    const de = s.dynamicEvents || {};
    this.cooldowns = { ...(de.cooldowns || {}) };
    this.importantDone = { ...(de.importantDone || {}) };
    this.recentTypes = Array.isArray(de.recentTypes) ? de.recentTypes.slice(-6) : [];
    this.consequences = (de.consequences && typeof de.consequences === 'object') ? { ...de.consequences } : {};
    this.rewarded = (de.rewarded && typeof de.rewarded === 'object') ? { ...de.rewarded } : {};
  }

  _save() {
    this.saveSystem.save({
      dynamicEvents: {
        cooldowns: { ...this.cooldowns },
        importantDone: { ...this.importantDone },
        recentTypes: this.recentTypes.slice(-6),
        consequences: { ...this.consequences },
        rewarded: { ...this.rewarded },
        activeIds: this.active.map(e => e.id),
      }
    });
  }

  _isNightWrap(def, hour) {
    if (!def.nightWrap) return hour >= def.minTime && hour < def.maxTime;
    // range wraps midnight e.g. 18..6
    return hour >= def.minTime || hour < def.maxTime;
  }

  _canSpawnDef(def, hour) {
    const now = this._timer;
    if ((this.cooldowns[def.type] || 0) > now) return false;
    if (this.active.some(e => e.type === def.type)) return false;
    if (!this._isNightWrap(def, hour)) return false;
    if (def.type === 'shelter_supply_run') {
      const sites = this.shelterSystem?.getSites?.() || [];
      if (!sites.some(s => s.claimed)) return false;
    }
    return true;
  }

  _pickDef(hour) {
    let candidates = EVENT_DEFS.filter(d => this._canSpawnDef(d, hour));
    if (!candidates.length) return null;
    const recent = this.recentTypes.slice(-2);
    const filtered = candidates.filter(d => !recent.includes(d.type));
    if (filtered.length) candidates = filtered;
    const total = candidates.reduce((s,d)=>s+d.weight,0);
    let r = Math.random()*total;
    for (const d of candidates) { r -= d.weight; if (r <= 0) return d; }
    return candidates[candidates.length-1];
  }

  _findLocation(minDist=18, maxDist=45) {
    const p = this.player.position;
    for (let i=0;i<20;i++) {
      const a = rnd(0, Math.PI*2);
      const d = rnd(minDist, maxDist);
      const x = clamp(p.x + Math.cos(a)*d, -45, 45);
      const z = clamp(p.z + Math.sin(a)*d, -45, 45);
      const pos = new THREE.Vector3(x, 0.18, z);
      // avoid inside collision boxes
      let bad = false;
      for (const b of (this.enemyManager.collisions?.boxes || [])) {
        if (b.enabled === false) continue;
        if (x > b.min.x-1 && x < b.max.x+1 && z > b.min.z-1 && z < b.max.z+1) { bad = true; break; }
      }
      if (!bad) return pos;
    }
    return null;
  }

  _addMarker(event, color=0xffaa55) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5,0.75,20), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.45,side:THREE.DoubleSide,depthWrite:false}));
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.05;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.0,8), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.12,depthWrite:false}));
    beam.position.y = 1.0;
    g.add(ring,beam);
    g.position.copy(event.pos); g.position.y = 0.05;
    this.scene.add(g);
    this._markers.set(event.id, g);
  }

  _removeMarker(eventId) {
    const m = this._markers.get(eventId);
    if (m) { this.scene.remove(m); m.traverse(n=>{n.geometry?.dispose?.(); n.material?.dispose?.();}); this._markers.delete(eventId); }
  }

  _registerInteract(event, opts) {
    const id = `ev_${event.id}`;
    this._interactIds.add(id);
    this.interactionSystem.register({
      id,
      type: opts.type || 'event',
      name: opts.name || event.def.title,
      description: opts.description || 'Evento dinâmico',
      getPosition: () => event.pos.clone(),
      radius: opts.radius || 2.2,
      promptLabel: opts.promptLabel || opts.name || event.def.title,
      canInteract: () => this.active.some(e=>e.id===event.id) && !event.completed,
      onInteract: opts.onInteract,
    });
    event.interactId = id;
  }

  _unregisterInteract(event) {
    if (!event.interactId) return;
    this.interactionSystem.unregister(event.interactId);
    this._interactIds.delete(event.interactId);
    event.interactId = null;
  }

  _grantReward(event, { xp=0, credits=0, items=[] } = {}) {
    if (!event || this.rewarded[event.id]) return;
    this.rewarded[event.id] = true;
    if (xp > 0) this.progressionSystem?.addXP?.(xp, 'evento dinâmico');
    if (credits > 0 && this.tradeSystem) {
      this.tradeSystem.credits = Math.max(0, Math.floor((this.tradeSystem.credits||0) + credits));
      this.tradeSystem.save?.();
    }
    for (const it of items) {
      const def = ITEM_DEFS[it.id] || it.def;
      if (!def) continue;
      this.inventory.addItem({ ...def }, it.qty || 1);
    }
    this._save();
  }

  _setConsequence(key, value=true) { this.consequences[key] = value; this._save(); }
  _getConsequence(key) { return !!this.consequences[key]; }

  _spawnEvent(def, hour) {
    const pos = this._findLocation();
    if (!pos) return null;
    const event = {
      id: makeId(def.type),
      type: def.type,
      def,
      pos,
      startedAt: this._timer,
      duration: rnd(def.duration[0], def.duration[1]),
      completed: false,
      failed: false,
      important: ['survivor_help','distress_signal','survivor_conflict','shelter_supply_run'].includes(def.type),
      data: {},
    };
    this.active.push(event);
    this.cooldowns[def.type] = this._timer + def.cooldown;
    this.recentTypes.push(def.type);
    if (this.recentTypes.length > 6) this.recentTypes = this.recentTypes.slice(-6);
    this._activate(event);
    this._save();
    return event;
  }

  _activate(event) {
    const e = event;
    switch (e.type) {
      case 'zombie_horde': return this._activateHorde(e);
      case 'mysterious_noise': return this._activateNoise(e);
      case 'supply_cache': return this._activateSupply(e);
      case 'survivor_help': return this._activateSurvivor(e);
      case 'danger_zone': return this._activateDangerZone(e);
      case 'weather_shift': return this._activateWeatherShift(e);
      case 'distress_signal': return this._activateDistressSignal(e);
      case 'abandoned_vehicle': return this._activateAbandonedVehicle(e);
      case 'survivor_conflict': return this._activateSurvivorConflict(e);
      case 'shelter_supply_run': return this._activateShelterSupplyRun(e);
    }
  }

  _activateHorde(e) {
    const count = 2 + Math.floor(Math.random()*2);
    e.data.zombies = [];
    for (let i=0;i<count;i++) {
      const off = new THREE.Vector3(rnd(-2,2),0,rnd(-2,2));
      const p = e.pos.clone().add(off);
      const type = pick(['common','agile','errant','aggressive']);
      const z = this.enemyManager.spawnEventZombie(p, type, { tag:e.id, ttl:e.duration+10, role:'roam' });
      if (z) { e.data.zombies.push(z._id); z.hearStimulus({pos:this.player.position.clone(), strength:20, kind:'event'}, performance.now()); }
    }
    this._addMarker(e, 0xff6644);
    this.hud.showToast('Evento: grupo de zumbis atravessando a área!', 2600);
    this.audioSystem?.onZombieGroan?.(e.pos, 'chase');
  }

  _activateNoise(e) {
    this._addMarker(e, 0xaab0ff);
    e.data.investigated = false;
    this._registerInteract(e, {
      name: 'Investigar ruído',
      description: 'Ruído misterioso em área abandonada',
      promptLabel: 'Investigar ruído',
      onInteract: () => {
        if (e.completed) return { message:'Nada mais aqui.' };
        e.completed = true; e.data.investigated = true;
        this.enemyManager.emitNoise(e.pos, 18, 'event');
        this.audioSystem?.playNoise?.({dur:0.4,gain:0.03,bus:'ambient',hp:150,lp:1200});
        const roll = Math.random();
        if (roll < 0.45) {
          const z = this.enemyManager.spawnEventZombie(e.pos.clone().add(new THREE.Vector3(rnd(-1,1),0,rnd(-1,1))), pick(['common','agile','aggressive']), {tag:e.id, ttl:50, role:'guard'});
          if (z) z.hearStimulus({pos:this.player.position.clone(),strength:25,kind:'event'}, performance.now());
          this.hud.showToast('Algo estava escondido! Um zumbi apareceu.', 2200);
        } else {
          const itemId = pick(['bandage','water_bottle','scrap_metal','energy_bar']);
          const def = ITEM_DEFS[itemId];
          if (def) { this.inventory.addItem({ ...def }, 1); this.hud.showToast(`Você encontrou: ${def.name}`, 2200); }
        }
        this._unregisterInteract(e);
        this._removeMarker(e.id);
        this._save();
        return { message:'Você investigou o ruído.' };
      }
    });
    this.hud.showToast('Evento: ruído misterioso nas proximidades...', 2400);
    this.audioSystem?.playNoise?.({dur:0.5,gain:0.02,bus:'ambient',hp:200,lp:900});
  }

  _activateSupply(e) {
    this._addMarker(e, 0x88ddaa);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.4,0.5), new THREE.MeshStandardMaterial({color:0x7a6a52, roughness:0.9}));
    mesh.position.copy(e.pos); mesh.position.y = 0.2; mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh); e.data.mesh = mesh;
    this._registerInteract(e, {
      name:'Cache de suprimentos',
      description:'Recursos abandonados',
      promptLabel:'Abrir cache de suprimentos',
      onInteract: () => {
        if (e.completed) return { message:'Cache vazia.' };
        e.completed = true;
        const pool = ['bandage','water_bottle','canned_food','scrap_metal','fabric','energy_bar'];
        const n = 2 + Math.floor(Math.random()*2);
        for (let i=0;i<n;i++) { const def = ITEM_DEFS[pick(pool)]; if (def) this.inventory.addItem({ ...def }, 1); }
        this.hud.showToast('Você coletou suprimentos do cache.', 2200);
        this._unregisterInteract(e);
        this._removeMarker(e.id);
        if (e.data.mesh) { this.scene.remove(e.data.mesh); e.data.mesh.geometry.dispose(); e.data.mesh.material.dispose(); e.data.mesh=null; }
        this._save();
        return { message:'Recursos coletados.' };
      }
    });
    this.hud.showToast('Evento: cache de suprimentos detectado.', 2400);
  }

  _activateSurvivor(e) {
    this._addMarker(e, 0x88c8ff);
    const body = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0x6f8193, roughness:0.85});
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.6,0.25), mat); torso.position.y=1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,12,10), new THREE.MeshStandardMaterial({color:0xc9a07a, roughness:0.9})); head.position.y=1.55;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.6,0.22), new THREE.MeshStandardMaterial({color:0x454b52, roughness:0.9})); legs.position.y=0.45;
    body.add(torso,head,legs); body.position.copy(e.pos); body.position.y=0; this.scene.add(body);
    e.data.mesh = body;
    this._registerInteract(e, {
      name:'Sobrevivente',
      description:'Parece precisar de ajuda',
      promptLabel:'Falar com sobrevivente',
      radius:2.4,
      onInteract: () => {
        if (e.completed) return { message:'O sobrevivente já seguiu caminho.' };
        const help = () => {
          const need = pick(['bandage','water_bottle','canned_food']);
          const def = ITEM_DEFS[need];
          if (def && this.inventory.hasItem(need)) {
            this.inventory.removeItem(need,1);
            this.inventory.addItem({ ...(ITEM_DEFS.scrap_metal||{id:'scrap_metal',name:'Sucata',type:'material',icon:'⚙️'}), }, 2);
            this.hud.showToast('Você ajudou o sobrevivente. Recebeu sucata.', 2600);
          } else {
            this.hud.showToast('Você não tinha o item pedido, mas o sobrevivente agradeceu a intenção.', 2600);
          }
          e.completed = true; e.important = true; this.importantDone[e.id]=true;
          this._unregisterInteract(e); this._removeMarker(e.id);
          if (e.data.mesh) { this.scene.remove(e.data.mesh); e.data.mesh.traverse(n=>{n.geometry?.dispose?.(); n.material?.dispose?.();}); e.data.mesh=null; }
          this._save();
          this.dialogUI.close?.();
        };
        if (this.dialogUI?.openDialog) {
          this.dialogUI.openDialog({
            name:'Sobrevivente', role:'Encontro aleatório',
            text:'Ei! Você tem algo para ajudar? Um curativo, água ou comida faria diferença.',
            choices:[{ label:'Ajudar (se tiver item)', action:'help' }, { label:'Agora não', action:'leave' }],
            trust:'-'
          });
          const prev = this.dialogUI.onChoice;
          this.dialogUI.onChoice = (choice) => {
            this.dialogUI.onChoice = prev;
            if (choice?.action === 'help') help(); else { this.hud.showToast('Você decidiu seguir em frente.', 1500); this.dialogUI.close(); }
          };
        } else { help(); }
        return { message:'' };
      }
    });
    this.hud.showToast('Evento: sobrevivente pedindo ajuda.', 2400);
  }

  _activateDangerZone(e) {
    this._addMarker(e, 0xff4444);
    const n = 2 + Math.floor(Math.random()*2);
    e.data.zombies = [];
    for (let i=0;i<n;i++) {
      const p = e.pos.clone().add(new THREE.Vector3(rnd(-3,3),0,rnd(-3,3)));
      const z = this.enemyManager.spawnEventZombie(p, pick(['common','resistant','aggressive']), {tag:e.id, ttl:e.duration+10, role:'guard'});
      if (z) e.data.zombies.push(z._id);
    }
    this.hud.showToast('Evento: área ficou perigosa por um tempo!', 2600);
  }

  _activateWeatherShift(e) {
    const choices = ['foggy','light_rain','heavy_rain','storm','cloudy'];
    const pickW = pick(choices);
    e.data.prev = this.dayNightWeather?._targetWeather || this.dayNightWeather?.weather || 'clear';
    e.data.to = pickW;
    this.dayNightWeather?.setWeather(pickW, false);
    this.hud.showToast(`Evento climático: mudança repentina para ${pickW.replace('_',' ')}.`, 2800);
    this.audioSystem?.playNoise?.({dur:0.8,gain:0.02,bus:'ambient',hp:100,lp:1500});
  }

  _activateDistressSignal(e) {
    this._addMarker(e, 0x66ccff);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.35,0.35), new THREE.MeshStandardMaterial({color:0x4f5963, roughness:0.7, metalness:0.4}));
    box.position.copy(e.pos); box.position.y = 0.2; box.castShadow = true;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.7,6), new THREE.MeshStandardMaterial({color:0xaab4be, metalness:0.6, roughness:0.4}));
    ant.position.y = 0.55; box.add(ant);
    this.scene.add(box); e.data.mesh = box;
    this._registerInteract(e, {
      name:'Sinal de socorro', description:'Rádio emitindo pedido de ajuda', promptLabel:'Investigar sinal de socorro',
      onInteract: () => {
        if (e.completed || e.failed) return { message:'O sinal já foi resolvido.' };
        const hasBattery = this.inventory.hasItem('battery') || this.inventory.hasItem('electronic_parts');
        if (this.dialogUI?.openDialog) {
          const prev = this.dialogUI.onChoice;
          this.dialogUI.openDialog({
            name:'Rádio de Emergência', role:'Pedido de socorro',
            text: hasBattery ? 'O sinal pede ajuda em troca de bateria/peças. Você pode responder e ajudar, ou ignorar.' : 'O sinal está fraco. Sem bateria ou componentes eletrônicos, você só consegue marcar a localização.',
            choices: [
              ...(hasBattery ? [{ label:'Ajudar (gastar 1 bateria/peça)', action:'help' }] : []),
              { label:'Marcar localização (+XP)', action:'mark' },
              { label:'Ignorar', action:'leave' }
            ], trust:'-'
          });
          this.dialogUI.onChoice = (choice) => {
            this.dialogUI.onChoice = prev;
            if (choice?.action === 'help') {
              if (this.inventory.hasItem('battery')) this.inventory.removeItem('battery',1);
              else if (this.inventory.hasItem('electronic_parts')) this.inventory.removeItem('electronic_parts',1);
              else { this.hud.showToast('Você não tem o item necessário.', 1800); this.dialogUI.close(); return; }
              e.completed = true; this.importantDone[e.id]=true; this._setConsequence('helped_distress', true);
              this._grantReward(e, { xp: 35, credits: 30, items:[{id:'medkit', qty:1}] });
              this.hud.showToast('Sinal respondido: sobreviventes vão se lembrar da ajuda.', 2800);
              this._unregisterInteract(e); this._removeMarker(e.id); this._cleanupMesh(e);
              this.dialogUI.close(); this._save();
            } else if (choice?.action === 'mark') {
              e.completed = true; this.importantDone[e.id]=true;
              this._grantReward(e, { xp: 15, credits: 10 });
              this.hud.showToast('Localização marcada. Você recebeu uma pequena recompensa.', 2400);
              this._unregisterInteract(e); this._removeMarker(e.id); this._cleanupMesh(e);
              this.dialogUI.close(); this._save();
            } else { this.dialogUI.close(); this.hud.showToast('Você ignorou o sinal por enquanto.', 1600); }
          };
        }
        return { message:'' };
      }
    });
    this.hud.showToast('Evento: pedido de socorro captado em uma frequência próxima.', 2800);
  }

  _activateAbandonedVehicle(e) {
    this._addMarker(e, 0xffcc66);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.6,0.9), new THREE.MeshStandardMaterial({color:0x55606b, roughness:0.8, metalness:0.2}));
    body.position.y = 0.45; body.castShadow=true; body.receiveShadow=true; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.45,0.8), new THREE.MeshStandardMaterial({color:0x707a84, roughness:0.7, metalness:0.2}));
    top.position.set(-0.1,0.85,0); g.add(top);
    for (const sx of [-0.6,0.6]) for (const sz of [-0.48,0.48]) { const w=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.18,10), new THREE.MeshStandardMaterial({color:0x222})); w.rotation.x=Math.PI/2; w.position.set(sx,0.22,sz); g.add(w); }
    g.position.copy(e.pos); this.scene.add(g); e.data.mesh=g;
    e.data.looted = false;
    this._registerInteract(e, {
      name:'Veículo abandonado', description:'Pode haver recursos, mas também perigo.', promptLabel:'Investigar veículo abandonado',
      radius:2.5,
      onInteract: () => {
        if (e.completed || e.failed) return { message:'Nada mais útil aqui.' };
        const trap = Math.random() < 0.45;
        if (trap && !e.data.ambushSpawned) {
          e.data.ambushSpawned = true;
          const n = 1 + Math.floor(Math.random()*2);
          for (let i=0;i<n;i++) {
            const p=e.pos.clone().add(new THREE.Vector3(rnd(-1.5,1.5),0,rnd(-1.5,1.5)));
            const z=this.enemyManager.spawnEventZombie(p, pick(['common','agile','aggressive']), {tag:e.id, ttl:60, role:'guard'});
            if (z) z.hearStimulus({pos:this.player.position.clone(),strength:25,kind:'event'}, performance.now());
          }
          this.hud.showToast('Emboscada! Zumbis estavam perto do veículo.', 2600);
          return { message:'Cuidado com a emboscada!' };
        }
        e.completed = true; this.importantDone[e.id]=true;
        const items = [pick(['scrap_metal','mechanical_parts','battery','electronic_parts']), pick(['bandage','water_bottle','canned_food'])];
        const realItems = items.filter(id => ITEM_DEFS[id]).map(id=>({id, qty:1}));
        if (realItems.length===0) realItems.push({id:'scrap_metal', qty:1});
        this._grantReward(e, { xp:25, credits:20, items: realItems });
        this.hud.showToast('Você vasculhou o veículo e encontrou recursos.', 2600);
        this._unregisterInteract(e); this._removeMarker(e.id); this._cleanupMesh(e);
        this._save();
        return { message:'Veículo vasculhado.' };
      }
    });
    this.hud.showToast('Evento: veículo abandonado avistado. Pode haver perigo.', 2600);
  }

  _activateSurvivorConflict(e) {
    this._addMarker(e, 0xff7744);
    const survivor = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0x708090, roughness:0.85});
    survivor.add(new THREE.Mesh(new THREE.BoxGeometry(0.45,0.6,0.25), mat));
    survivor.children[0].position.y=1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,12,10), new THREE.MeshStandardMaterial({color:0xc9a07a})); head.position.y=1.55; survivor.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.6,0.22), new THREE.MeshStandardMaterial({color:0x444})); legs.position.y=0.45; survivor.add(legs);
    survivor.position.copy(e.pos); this.scene.add(survivor); e.data.mesh = survivor;
    e.data.zombies = [];
    const n = 2 + Math.floor(Math.random()*2);
    for (let i=0;i<n;i++) {
      const p = e.pos.clone().add(new THREE.Vector3(rnd(-3,3),0,rnd(-3,3)));
      const z = this.enemyManager.spawnEventZombie(p, pick(['common','agile','aggressive']), {tag:e.id, ttl:e.duration+20, role:'guard'});
      if (z) { e.data.zombies.push(z._id); z.hearStimulus({pos:this.player.position.clone(),strength:18,kind:'event'}, performance.now()); }
    }
    e.data.rescued = false;
    this._registerInteract(e, {
      name:'Sobrevivente em conflito', description:'Ajude a eliminar a ameaça próxima.', promptLabel:'Ajudar sobrevivente',
      radius:2.6,
      onInteract: () => {
        if (e.completed || e.failed) return { message:'Situação já resolvida.' };
        const aliveThreat = this.enemyManager.zombies.some(z=>z.alive && z.eventTag===e.id && z.distanceTo(e.pos)<18);
        if (aliveThreat) { this.hud.showToast('Elimine os zumbis próximos antes de ajudar!', 2000); return { message:'Ainda há ameaça por perto.' }; }
        e.completed = true; e.data.rescued = true; this.importantDone[e.id]=true; this._setConsequence('rescued_conflict_survivor', true);
        this._grantReward(e, { xp:45, credits:35, items:[{id:'medkit',qty:1},{id:'canned_food',qty:1}] });
        this.hud.showToast('Sobrevivente resgatado! Ele prometeu ajudar no futuro.', 3000);
        this._unregisterInteract(e); this._removeMarker(e.id); this._cleanupMesh(e);
        this._save();
        return { message:'Resgate concluído.' };
      }
    });
    this.hud.showToast('Evento: sobrevivente cercado por zumbis!', 2800);
  }

  _activateShelterSupplyRun(e) {
    const sites = (this.shelterSystem?.getSites?.() || []).filter(s=>s.claimed);
    if (!sites.length) { e.failed=true; return; }
    const target = pick(sites);
    e.data.targetSiteId = target.id;
    e.data.delivered = false;
    e.pos.set(target.def.center.x + rnd(-2,2), 0.18, target.def.center.z + rnd(-2,2));
    this._addMarker(e, 0x88ffaa);
    this._registerInteract(e, {
      name:'Entrega de suprimentos', description:`Leve suprimentos para ${target.def.name}`, promptLabel:`Entregar suprimentos em ${target.def.name}`,
      radius:2.8,
      onInteract: () => {
        if (e.completed || e.failed) return { message:'Entrega já resolvida.' };
        const need = pick(['canned_food','water_bottle','bandage']);
        const def = ITEM_DEFS[need];
        if (!def || !this.inventory.hasItem(need)) {
          this.hud.showToast(`Você precisa de ${def?.name || 'suprimentos'} para completar a entrega.`, 2400);
          return { message:'Sem recursos para entregar.' };
        }
        this.inventory.removeItem(need,1);
        e.completed = true; e.data.delivered = true; this.importantDone[e.id]=true; this._setConsequence('supply_runs_completed', (this.consequences.supply_runs_completed||0)+1);
        this._grantReward(e, { xp:40, credits:45, items:[{id:'scrap_metal',qty:2}] });
        this.hud.showToast(`Entrega concluída em ${target.def.name}. Abrigo mais seguro.`, 3000);
        this._unregisterInteract(e); this._removeMarker(e.id);
        this._save();
        return { message:'Recursos entregues.' };
      }
    });
    this.hud.showToast(`Evento: transporte de recursos solicitado para ${target.def.name}.`, 3000);
  }

  _cleanupMesh(e) {
    if (!e.data.mesh) return;
    this.scene.remove(e.data.mesh);
    e.data.mesh.traverse?.(n=>{n.geometry?.dispose?.(); n.material?.dispose?.();});
    if (e.data.mesh.geometry) e.data.mesh.geometry.dispose?.();
    if (e.data.mesh.material) e.data.mesh.material.dispose?.();
    e.data.mesh = null;
  }

  _cleanupEvent(e) {
    this._unregisterInteract(e);
    this._removeMarker(e.id);
    this._cleanupMesh(e);
    // event zombies have ttl; we just untag them so they can be cleaned naturally
    for (const z of this.enemyManager.zombies) { if (z.eventTag === e.id) z.eventTag = null; }
  }

  _endEvent(e, reason='timeout') {
    if (e.type === 'weather_shift' && e.data.prev && this.dayNightWeather) {
      this.dayNightWeather.setWeather(e.data.prev, false);
    }
    if (!e.completed && reason === 'timeout') {
      e.failed = true;
      if (['distress_signal','survivor_help','survivor_conflict','shelter_supply_run'].includes(e.type)) {
        this.importantDone[e.id] = true;
        this._setConsequence(`${e.type}_ignored`, (this.consequences[`${e.type}_ignored`]||0)+1);
        this.hud?.showToast?.('Uma atividade dinâmica expirou. O mundo segue em frente.', 2200);
      }
    }
    this._cleanupEvent(e);
    e.ended = true; e.endReason = reason;
    this.active = this.active.filter(x=>x.id!==e.id);
    this._save();
  }

  update(dt) {
    if (!this.enabled) return;
    this._timer += dt;
    const hour = this.dayNightWeather?.time ?? 12;

    // update/end active
    for (let i=this.active.length-1; i>=0; i--) {
      const e = this.active[i];
      const age = this._timer - e.startedAt;
      if (e.completed || age >= e.duration) {
        this._endEvent(e, e.completed ? 'completed' : 'timeout');
      }
    }

    // spawn check
    this._nextSpawnCheck -= dt;
    if (this._nextSpawnCheck <= 0) {
      this._nextSpawnCheck = 18 + Math.random()*14;
      if (this.active.length < this.maxActive) {
        // avoid spawning during heavy combat/mission critical? simple heuristic
        const dangerNearby = this.enemyManager.zombies.some(z=>z.alive && z.state==='attack' && z.distanceTo(this.player.position) < 10);
        if (!dangerNearby) {
          const def = this._pickDef(hour);
          if (def) this._spawnEvent(def, hour);
        }
      }
    }
  }

  getDebugState() {
    return { active:this.active.map(e=>({id:e.id,type:e.type,age:(this._timer-e.startedAt)|0,dur:e.duration|0,completed:e.completed})), cooldowns:this.cooldowns };
  }
}
