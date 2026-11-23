import * as THREE from 'three';
import { GAME_CONFIG, QUALITY_PRESETS } from './config/constants.js';
import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { AssetLoader } from './core/AssetLoader.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { World } from './world/World.js';
import { Player } from './entities/Player.js';
import { ThirdPersonCamera } from './entities/ThirdPersonCamera.js';
import { TouchControls } from './ui/TouchControls.js';
import { HUD } from './ui/HUD.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { InventorySystem } from './systems/InventorySystem.js';
import { WorldInteractables } from './systems/WorldInteractables.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { EnemyManager } from './systems/EnemyManager.js?v=etapa14';
import { EffectsSystem } from './systems/EffectsSystem.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { MissionSystem } from './systems/MissionSystem.js';
import { MissionUI } from './ui/MissionUI.js';
import { DiscoverySystem } from './systems/DiscoverySystem.js';
import { MapUI } from './ui/MapUI.js';
import { DayNightWeatherSystem } from './systems/DayNightWeatherSystem.js';
import { DialogUI } from './ui/DialogUI.js';
import { NPCSystem } from './systems/NPCSystem.js';
import { VehicleSystem } from './systems/VehicleSystem.js';
import { ProgressionSystem } from './systems/ProgressionSystem.js';
import { CharacterUI } from './ui/CharacterUI.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { DynamicEventSystem } from './systems/DynamicEventSystem.js';
import { TradeSystem } from './systems/TradeSystem.js';
import { TradeUI } from './ui/TradeUI.js';
import { ShelterSystem } from './systems/ShelterSystem.js';
import { ShelterUI } from './ui/ShelterUI.js';
import { FactionSystem } from './systems/FactionSystem.js';
import { DecisionSystem } from './systems/DecisionSystem.js';
import { MainMenu } from './ui/MainMenu.js';
import { SettingsSystem } from './systems/SettingsSystem.js';

const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingFill = document.getElementById('loading-fill');
const loadingMeta = document.getElementById('loading-meta');
const errorScreen = document.getElementById('error-screen');
const errorText = document.getElementById('error-text');

function setLoading(progress, text) {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  loadingFill.style.width = `${p}%`;
  loadingMeta.textContent = `${p}%`;
  if (text) loadingText.textContent = text;
}

function showError(err) {
  console.error(err);
  try {
    errorScreen.classList.remove('hidden');
    errorText.textContent = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  } catch (_) {}
}
window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason || e));

async function boot() {
  try {
    setLoading(5, 'Inicializando renderizador...');
    const canvas = document.getElementById('game-canvas');
    const settingsSystem = new SettingsSystem();

    // Carrega a qualidade antes de criar o motor e construir o mundo.
    const initialQuality = settingsSystem.getEffectiveQuality();
    GAME_CONFIG.quality = initialQuality.name === 'custom'
      ? 'medium'
      : initialQuality.name;

    const engine = new Engine(canvas);

    setLoading(15, 'Preparando sistemas...');
    const input = new InputManager(canvas);
    const assetLoader = new AssetLoader();
    const collisions = new CollisionSystem();
    const hud = new HUD();
    const inventory = new InventorySystem();
    const interactionSystem = new InteractionSystem(engine.scene);
    interactionSystem.onMessage = (msg) => hud.showToast(msg);

    const inventoryUI = new InventoryUI(inventory);
    inventoryUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'INVENTÁRIO' : 'EXPLORANDO');
    };
    const renderQuickbar = () => hud.renderQuickbar?.(inventory.getQuickSlots?.() || []);
    const _invOnChange = inventory.onChange;
    inventory.onChange = (items) => { _invOnChange?.(items); renderQuickbar(); saveSystem.save({ inventory: inventory.serialize() }); };

    const saveSystem = new SaveSystem();

    // Restore inventory from save (if present)
    const _saved = saveSystem.get();
    if (_saved?.inventory) inventory.loadState(_saved.inventory);
    const factionSystem = new FactionSystem(saveSystem);
    const decisionSystem = new DecisionSystem(saveSystem);
    const tradeSystem = new TradeSystem(inventory, saveSystem, factionSystem);
    const shelterSystem = new ShelterSystem(engine.scene, interactionSystem, inventory, saveSystem, collisions, hud);
    const progressionSystem = new ProgressionSystem(saveSystem);
    progressionSystem.onLevelUp = (lvl) => { hud.showToast(`Subiu de nível! Nível ${lvl}`, 2400); };
    const missionSystem = new MissionSystem(inventory, saveSystem);
    const _msToast = (text, ms) => { const t=String(text||''); const type=t.toLowerCase().includes('concluída')?'success':t.toLowerCase().includes('iniciada')?'mission':'info'; hud.notify(t, type, ms); if (t.toLowerCase().includes('missão concluída')) audioSystem.onMissionComplete(); };
    missionSystem.onToast = _msToast;
    missionSystem.onXPGain = (amount, reason) => progressionSystem.addXP(amount, reason);
    const missionUI = new MissionUI(missionSystem, decisionSystem);
    missionUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'MISSÕES' : 'EXPLORANDO');
    };
    document.getElementById('mission-btn')?.addEventListener('click', () => { if(audioUI.isOpen) audioUI.close(); missionUI.toggle(); });

    const dialogUI = new DialogUI();
    const tradeUI = new TradeUI(tradeSystem, inventory);
    tradeUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'COMÉRCIO' : 'EXPLORANDO');
    };
    const shelterUI = new ShelterUI(shelterSystem, inventory);
    shelterUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'ABRIGO' : 'EXPLORANDO');
    };
    const _dlgOpen = dialogUI.openDialog.bind(dialogUI);
    dialogUI.openDialog = (...args) => { audioSystem.onNpcDialog(); return _dlgOpen(...args); };
    dialogUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'DIÁLOGO' : 'EXPLORANDO');
    };


    const qualityOrder = ['mobile', 'medium', 'high', 'custom'];
    const qualityLabel = { mobile: 'QUALIDADE: BAIXA', medium: 'QUALIDADE: MÉDIA', high: 'QUALIDADE: ALTA', custom: 'QUALIDADE: PERSONALIZADA' };
    let dayNightWeather = null;

    const applySettings = () => {
      const s = settingsSystem.get();
      // audio sync
      if (audioSystem?.settings) {
        Object.assign(audioSystem.settings, s.audio);
        audioSystem.saveSettings?.();
      }
      // controls
      const baseLook = 0.0022;
      const baseTouch = 0.0045;
      GAME_CONFIG.camera.lookSensitivity = baseLook * (s.controls.cameraSensitivity || 1) * (s.controls.aimSensitivity || 1);
      GAME_CONFIG.camera.touchLookSensitivity = baseTouch * (s.controls.touchSensitivity || 1);
      GAME_CONFIG.camera.invertY = !!s.controls.invertY;
      // touch controls sizing
      const tc = document.getElementById('touch-controls');
      if (tc) {
        tc.style.setProperty('--touch-scale', String(s.controls.touchButtonScale || 1));
        tc.style.setProperty('--touch-opacity', String(s.controls.touchButtonOpacity || 0.45));
      }
      // accessibility
      document.documentElement.style.setProperty('--text-scale', String(s.accessibility.textScale || 1));
      document.body.classList.toggle('reduce-motion', !!s.accessibility.reduceMotion);
      document.body.classList.toggle('high-contrast', !!s.accessibility.highContrast);
      document.body.classList.toggle('large-indicators', !!s.accessibility.largeIndicators);
      // graphics
      engine.fpsLimit = Number(s.graphics.fpsLimit) || 0;
      applyQuality(s.graphics.preset);
    };

    const applyQuality = (name) => {
      const s = settingsSystem.get();
      if (name && name !== s.graphics.preset) { s.graphics.preset = name; settingsSystem.patch({ graphics: s.graphics }); }
      const eff = settingsSystem.getEffectiveQuality();
      const preset = eff.preset;
      const qName = eff.name;
      GAME_CONFIG.quality = qName === 'custom' ? 'medium' : qName;
      const prCap = Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio || 1.5);
      engine.renderer.setPixelRatio(prCap);
      engine.renderer.shadowMap.enabled = !!preset.shadows;
      if (engine.renderer.shadowMap) engine.renderer.shadowMap.needsUpdate = true;
      engine.renderer.toneMappingExposure = preset.toneExposure ?? 1.08;
      if (engine.postFX) {
        const fxOn = !!preset.postfx && !s.accessibility.reduceMotion;
        engine.postFX.enabled = fxOn;
        if (engine.postFX.setQuality) engine.postFX.setQuality(qName === 'custom' ? 'medium' : qName);
        if (engine.postFX.setSize) engine.postFX.setSize();
      }
      if (engine.scene.fog) {
        if (preset.fogNear != null) engine.scene.fog.near = preset.fogNear;
        if (preset.fogFar != null) { engine.scene.fog.far = preset.fogFar; engine.camera.far = Math.max(300, preset.fogFar + 120); engine.camera.updateProjectionMatrix(); }
      }
      if (dayNightWeather) dayNightWeather.setQuality(qName === 'custom' ? 'medium' : qName);
      const maxAniso = engine.getMaxAnisotropy?.() || 1;
      const anisoTarget = Math.min(preset.anisotropy || 4, maxAniso);
      engine.scene.traverse((obj) => {
        if (obj.isDirectionalLight && obj.shadow) {
          obj.castShadow = !!preset.shadows;
          if (obj.shadow.mapSize) obj.shadow.mapSize.set(preset.shadowMapSize || 1024, preset.shadowMapSize || 1024);
          obj.shadow.needsUpdate = true;
        }
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m) continue;
          for (const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap']) {
            const t = m[k];
            if (t && 'anisotropy' in t) { t.anisotropy = anisoTarget; t.needsUpdate = true; }
          }
          m.needsUpdate = true;
        }
      });
      hud.setQualityLabel(qualityLabel[qName] || qName.toUpperCase());
    };

    settingsSystem.onChange(() => applySettings());
    hud.onQualityToggle(() => {
      const s = settingsSystem.get();
      const order = ['mobile','medium','high'];
      const idx = order.indexOf(s.graphics.preset);
      s.graphics.preset = order[(idx + 1) % order.length];
      settingsSystem.patch({ graphics: s.graphics });
    });

    setLoading(30, 'Construindo cidade...');
    const world = new World(engine.scene, collisions, assetLoader, interactionSystem, inventory);

    setLoading(45, 'Carregando veículos...');
    await world.load((p, text) => setLoading(45 + p * 0.4, text || 'Carregando veículos...'));

    setLoading(85, 'Carregando inimigos...');
    const enemyManager = new EnemyManager(engine.scene, collisions);
    await enemyManager.load((p, text) => setLoading(85 + p * 0.07, text || 'Carregando inimigos...'));

    setLoading(93, 'Distribuindo itens e pontos de interesse...');
    const worldInteractables = new WorldInteractables(engine.scene, interactionSystem, inventory, world, missionSystem, saveSystem);
    worldInteractables.onCollect = (def, qty) => progressionSystem.addXP(8 * (qty || 1), 'coleta');

    const discoverySystem = new DiscoverySystem(saveSystem, world.districts);
    discoverySystem.onDiscover = (poi) => { hud.showToast(`Local descoberto: ${poi.name}`, 2200); progressionSystem.addXP(35, 'exploração'); };
    discoverySystem.init();
    worldInteractables.setExplorationDeps({ discoverySystem, dialogUI, hud });
    for (const f of factionSystem.getAll()) {
      discoverySystem.registerPoint({ id: `faction_base_${f.id}`, name: f.base.name, pos: new THREE.Vector3(f.base.pos.x,0.18,f.base.pos.z), radius: f.base.radius, secret:false, showOnMap:true, type:'facção', desc:f.identity });
    }
    const mapUI = new MapUI(discoverySystem, missionSystem);
    mapUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'MAPA' : 'EXPLORANDO');
    };
    document.getElementById('map-btn')?.addEventListener('click', () => { if(audioUI.isOpen) audioUI.close(); mapUI.toggle(); });

    const characterUI = new CharacterUI(progressionSystem);
    characterUI.onOpenChange = (open) => {
      if (open && document.pointerLockElement === canvas) document.exitPointerLock?.();
      hud.setStatus(open ? 'PERSONAGEM' : 'EXPLORANDO');
    };
    document.getElementById('char-btn')?.addEventListener('click', () => { if(audioUI.isOpen) audioUI.close(); characterUI.toggle(); });
    document.getElementById('btn-char')?.addEventListener('click', () => { if(audioUI.isOpen) audioUI.close(); characterUI.toggle(); });

    const audioUI = {
      overlay: document.getElementById('audio-overlay'),
      isOpen: false,
      open() { inventoryUI.close(); missionUI.close(); mapUI.close(); dialogUI.close(); characterUI.close(); this.isOpen=true; this.overlay.classList.remove('hidden'); this.overlay.setAttribute('aria-hidden','false'); syncAudioUI(); if (document.pointerLockElement===canvas) document.exitPointerLock?.(); hud.setStatus('ÁUDIO'); },
      close() { this.isOpen=false; this.overlay.classList.add('hidden'); this.overlay.setAttribute('aria-hidden','true'); hud.setStatus('EXPLORANDO'); },
      toggle() { this.isOpen ? this.close() : this.open(); }
    };
    function syncAudioUI() {
      const s = settingsSystem.get().audio;
      const map = [['aud-master','master'],['aud-music','music'],['aud-sfx','sfx'],['aud-ambient','ambient'],['aud-voice','voice']];
      for (const [id,k] of map) { const el=document.getElementById(id); if(el) el.value=String(Math.round((s[k]||0)*100)); }
      document.querySelectorAll('.audio-mute').forEach(btn=>{ const k=btn.dataset.mute; btn.classList.toggle('active', !!s[k]); btn.textContent = s[k] ? 'MUDO' : 'Mudo'; });
    }
    document.getElementById('audio-btn')?.addEventListener('click', () => { if (inventoryUI.isOpen) inventoryUI.close(); if (missionUI.isOpen) missionUI.close(); if (mapUI.isOpen) mapUI.close(); if (dialogUI.isOpen) dialogUI.close(); if (characterUI.isOpen) characterUI.close(); if (tradeUI.isOpen) tradeUI.close(); if (shelterUI.isOpen) shelterUI.close(); audioUI.toggle(); });
    document.getElementById('audio-close')?.addEventListener('click', () => audioUI.close());
    audioUI.overlay?.addEventListener('click', (e)=>{ if(e.target===audioUI.overlay) audioUI.close(); });
    [['aud-master','master'],['aud-music','music'],['aud-sfx','sfx'],['aud-ambient','ambient'],['aud-voice','voice']].forEach(([id,k])=>{
      document.getElementById(id)?.addEventListener('input', (e)=>{ settingsSystem.patch({ audio: { ...settingsSystem.get().audio, [k]: (Number(e.target.value)||0)/100 } }); syncAudioUI(); });
    });
    document.querySelectorAll('.audio-mute').forEach(btn=>btn.addEventListener('click', ()=>{ const k=btn.dataset.mute; const a=settingsSystem.get().audio; settingsSystem.patch({ audio: { ...a, [k]: !a[k] } }); syncAudioUI(); }));
    window.addEventListener('keydown', (e)=>{ if(e.code==='Escape' && audioUI.isOpen){ e.preventDefault(); audioUI.close(); } });

    const effects = new EffectsSystem(engine.scene);
    dayNightWeather = new DayNightWeatherSystem(engine, world);
    if (_saved?.worldTimeWeather) dayNightWeather.loadState(_saved.worldTimeWeather);
    setTimeout(() => { dayNightWeather.rescanLights(); dayNightWeather._scanWetMaterials(); }, 4000);

    const npcSystem = new NPCSystem(engine.scene, interactionSystem, dialogUI, missionSystem, inventory, saveSystem, hud, collisions, tradeUI, factionSystem, decisionSystem);
    npcSystem.tradeSystem = tradeSystem;
    const vehicleSystem = new VehicleSystem(engine.scene, collisions, interactionSystem, input, hud, saveSystem);
    vehicleSystem.registerFromProps(world.props?.vehicles || []);
    for (const v of (world.props?.vehicles || [])) worldInteractables.registerVehicleLoot(v);

    // Vehicle mobile controls
    const vehicleControlsEl = document.getElementById('vehicle-controls');
    const vehLeft = document.getElementById('veh-left');
    const vehRight = document.getElementById('veh-right');
    const vehAccel = document.getElementById('veh-accel');
    const vehBrake = document.getElementById('veh-brake');
    const vehExit = document.getElementById('veh-exit');
    const vehState = { left:false, right:false, accel:false, brake:false };
    const bindVehBtn = (el, key) => {
      if (!el) return;
      const on = (e) => { vehState[key] = true; el.classList.add('active'); e.preventDefault(); };
      const off = (e) => { vehState[key] = false; el.classList.remove('active'); e.preventDefault(); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    bindVehBtn(vehLeft, 'left'); bindVehBtn(vehRight, 'right');
    bindVehBtn(vehAccel, 'accel'); bindVehBtn(vehBrake, 'brake');
    vehExit?.addEventListener('pointerdown', (e) => { e.preventDefault(); if (vehicleSystem.isDriving()) { const exited = vehicleSystem.exit(player); if (exited) { cam.setVehicleMode(false); cam.resetBehind(player.position, player.yaw); } } });

    const audioSystem = new AudioSystem(saveSystem);
    const ensureAudio = () => { audioSystem.ensureStarted(); };
    window.addEventListener('pointerdown', ensureAudio, { once:false });
    window.addEventListener('keydown', ensureAudio, { once:false });
    window.addEventListener('touchstart', ensureAudio, { once:false, passive:true });
    const playSfx = (freq = 220, dur = 0.08, type = 'square', gain = 0.03) => audioSystem.playSfx(freq,dur,type,gain);


    // --- Missão 1: Sinal na Névoa (objetos de mundo) ---
    const missionTargets = new Map();
    const makeMissionMarker = (color = 0xffbf8a) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.62, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false })
      );
      beam.position.y = 1.1;
      g.add(ring, beam);
      g.visible = false;
      engine.scene.add(g);
      return g;
    };
    const objectiveMarker = makeMissionMarker(0xffbf8a);

    // Bilhete do sobrevivente
    const noteGroup = new THREE.Group();
    const noteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xd8c7a0, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide })
    );
    noteMesh.rotation.x = -Math.PI / 2;
    noteMesh.position.y = 0.02;
    noteGroup.add(noteMesh);
    noteGroup.position.set(8, 0.18, 2);
    engine.scene.add(noteGroup);
    missionTargets.set('m1_radio_note', { pos: noteGroup.position.clone(), radius: 2.0 });
    interactionSystem.register({
      id: 'm1_radio_note',
      name: 'Bilhete do sobrevivente',
      type: 'mission',
      description: 'Um bilhete rasgado com anotações sobre um transmissor.',
      position: noteGroup.position.clone(),
      radius: 2.0,
      promptLabel: 'Ler bilhete',
      onInteract: () => {
        const m = missionSystem.getMission('m1_sinal_nevoa');
        const obj = m?.objectives.find(o => o.id === 'm1_find_note');
        if (obj?.completed) return { message: 'O bilhete fala de um transmissor improvisado ao norte.' };
        missionSystem.reportEvent({ type: 'interact', target: 'm1_radio_note' });
        return { message: 'Bilhete: "Se alguém ler isso... montei um transmissor perto da barricada norte. Ative-o."' };
      }
    });

    // Zona de visita / transmissor
    const radioPos = new THREE.Vector3(-28, 0.18, -18);
    missionTargets.set('m1_radio_zone', { pos: radioPos.clone(), radius: 3.0 });
    missionTargets.set('m1_radio_device', { pos: radioPos.clone(), radius: 2.5 });

    const radioGroup = new THREE.Group();
    const radioBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.8, metalness: 0.2 }));
    radioBase.position.y = 0.175;
    const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.5, metalness: 0.6 }));
    radioAntenna.position.set(0.2, 0.9, 0);
    const radioLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5533 }));
    radioLight.position.set(-0.15, 0.38, 0.23);
    radioLight.name = 'm1RadioLight';
    radioGroup.add(radioBase, radioAntenna, radioLight);
    radioGroup.position.copy(radioPos);
    engine.scene.add(radioGroup);

    interactionSystem.register({
      id: 'm1_radio_device',
      name: 'Transmissor improvisado',
      type: 'mission',
      description: 'Um transmissor montado com peças sucateadas.',
      position: radioPos.clone(),
      radius: 2.5,
      promptLabel: 'Ativar transmissor',
      onInteract: () => {
        const m = missionSystem.getMission('m1_sinal_nevoa');
        const noteDone = m?.objectives.find(o => o.id === 'm1_find_note')?.completed;
        const reachDone = m?.objectives.find(o => o.id === 'm1_reach_radio')?.completed;
        const activeDone = m?.objectives.find(o => o.id === 'm1_activate_radio')?.completed;
        if (activeDone) return { message: 'O transmissor já enviou o sinal. Agora é esperar...' };
        if (!noteDone) return { message: 'Você precisa entender como usar isso. Procure pistas primeiro.' };
        if (!reachDone) {
          // Should be done by visit, but ensure
          missionSystem.reportEvent({ type: 'visit', target: 'm1_radio_zone' });
        }
        missionSystem.reportEvent({ type: 'interact', target: 'm1_radio_device' });
        radioLight.material.color.setHex(0x66ff88);
        return { message: 'Transmissor ativado! Um sinal curto foi enviado pelas ruínas.' };
      }
    });

    // M3 - Rota Segura (Sentinelas da Ferrovia)
    const m3Pos = new THREE.Vector3(-14, 0.18, 85);
    missionTargets.set('m3_route_zone', { pos: m3Pos.clone(), radius: 3.2 });
    missionTargets.set('m3_route_marker', { pos: m3Pos.clone(), radius: 2.2 });
    const m3Marker = new THREE.Group();
    const m3Pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.6,8), new THREE.MeshStandardMaterial({color:0x7a828b, roughness:0.6, metalness:0.5}));
    m3Pole.position.y = 0.8;
    const m3Flag = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.3,0.03), new THREE.MeshStandardMaterial({color:0xffbf66, roughness:0.7, emissive:0x332200, emissiveIntensity:0.2}));
    m3Flag.position.set(0.28,1.35,0);
    m3Marker.add(m3Pole, m3Flag); m3Marker.position.copy(m3Pos); engine.scene.add(m3Marker);
    interactionSystem.register({
      id: 'm3_route_marker', name: 'Sinalizador de rota', type: 'mission',
      description: 'Ponto usado pelos Sentinelas para marcar rotas seguras.',
      getPosition: () => m3Pos.clone(), radius: 2.2, promptLabel: 'Marcar rota segura',
      onInteract: () => {
        const m = missionSystem.getMission('m3_rota_segura');
        if (!m || m.state !== 'active') return { message: 'Este sinalizador não é necessário agora.' };
        const reachDone = m.objectives.find(o=>o.id==='m3_reach')?.completed;
        if (!reachDone) missionSystem.reportEvent({ type:'visit', target:'m3_route_zone' });
        missionSystem.reportEvent({ type:'interact', target:'m3_route_marker' });
        if (missionSystem.getMission('m3_rota_segura')?.state === 'completed') {
          factionSystem?.addRep('sentinelas_ferrovia', 15, 'missão concluída');
          decisionSystem?.record('m3_completed', { label:'Marcou rota segura para os Sentinelas', consequence:'Sentinelas confiam mais em você e rotas ficam mais seguras.', state:'completed' });
          hud.showToast('Sentinelas da Ferrovia: reputação aumentou.', 2200);
        }
        return { message: 'Rota marcada. Os Sentinelas vão reconhecer seu trabalho.' };
      }
    });

    missionSystem.registerTargetPositions(missionTargets);
    missionSystem.init();
    const startChapter = saveSystem.get()?.startChapter;
    if (startChapter) {
      const cm = missionSystem.getMission(startChapter);
      if (cm && cm.state !== 'completed') {
        missionSystem.startMission(startChapter, { silent: true });
        missionSystem.setActive(startChapter);
      }
      saveSystem.save({ startChapter: null });
    }
    // Sync mission 1 visuals after load
    const m1 = missionSystem.getMission('m1_sinal_nevoa');
    if (m1?.objectives.find(o => o.id === 'm1_activate_radio')?.completed) {
      radioLight.material.color.setHex(0x66ff88);
    }
    missionUI._updateHudObjective(missionSystem.getActiveMission());

    // Rest points (locais de descanso)
    const restPoints = [
      { id:'rest_camp_spawn', name:'Abrigo improvisado', pos:new THREE.Vector3(12,0.18,8), radius:2.2 },
      { id:'rest_bench_north', name:'Banco abandonado', pos:new THREE.Vector3(-10,0.18,-24), radius:2.0 },
      { id:'rest_camp_east', name:'Fogueira de sobreviventes', pos:new THREE.Vector3(52,0.18,16), radius:2.2 },
      { id:'rest_shelter_west', name:'Abrigo de metro', pos:new THREE.Vector3(-62,0.18,-12), radius:2.2 },
    ];
    for (const rp of restPoints) {
      const camp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.2,0.8), new THREE.MeshStandardMaterial({color:0x5a4a3a, roughness:0.95}));
      base.position.y = 0.1;
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.35,8), new THREE.MeshStandardMaterial({color:0xff7a2a, emissive:0xff5a1a, emissiveIntensity:0.8, roughness:0.6}));
      fire.position.y = 0.38;
      const glow = new THREE.PointLight(0xff7a2a, 0.6, 6);
      glow.position.set(0, 0.6, 0);
      camp.add(base, fire, glow);
      camp.position.copy(rp.pos);
      engine.scene.add(camp);
      interactionSystem.register({
        id: rp.id, name: rp.name, type:'rest', description:'Local seguro para descansar e recuperar energia.',
        position: rp.pos.clone(), radius: rp.radius, promptLabel: 'Descansar',
        onInteract: ({ player }) => {
          if (player.dead) return { message: 'Você não pode descansar agora.' };
          if (player.isResting) { player.stopRest(); hud.setStatus('EXPLORANDO'); saveSystem.save({ playerSurvival: player.getSurvivalState() }); return { message: 'Você parou de descansar.' }; }
          const danger = (enemyManager?.zombies || []).some(z => z.alive && z.position.distanceTo(player.position) < 8);
          if (danger) return { message: 'Perigo próximo! Limpe a área antes de descansar.' };
          player.isResting = true;
          hud.setStatus('DESCANSANDO');
          return { message: 'Você está descansando. Mova-se ou interaja novamente para parar.' };
        }
      });
    }

    setLoading(96, 'Preparando jogador...');
    const player = new Player(engine.scene, collisions);
    player.position.copy(world.getSpawnPoint());
    player.group.position.copy(player.position);
    const _saveData = saveSystem.get();
    if (_saveData?.playerSurvival) player.loadSurvivalState(_saveData.playerSurvival);
    hud.setHealth(player.hp, player.maxHp);
    inventoryUI.onUseItem = (item) => {
      if (player.dead) { hud.showToast('Você não pode usar itens agora.', 1200); return { ok: false }; }
      if (item?.effects?.vehicleRepair) {
        const amt = item.effects.vehicleRepair;
        let target = vehicleSystem.isDriving() ? vehicleSystem.getActive() : null;
        if (!target) {
          let best = null, bestD = Infinity;
          for (const v of vehicleSystem.vehicles) {
            const d = v.pos.distanceTo(player.position);
            if (d < 3.5 && d < bestD) { best = v; bestD = d; }
          }
          target = best;
        }
        if (!target) { hud.showToast('Aproxime-se de um veículo para usar o kit de reparo.', 1600); return { ok: false }; }
        if (target.damage <= 0) { hud.showToast('Este veículo não precisa de reparo.', 1400); return { ok: false }; }
        target.damage = Math.max(0, target.damage - amt);
        target.usable = true;
        vehicleSystem.saveState();
        hud.showToast(`${target.name} reparado (-${amt}% dano).`, 1600);
        return { ok: true };
      }
      const res = player.consumeSurvivalItem(item);
      hud.showToast(res.message, 1600);
      if (res.ok) { hud.setHealth(player.hp, player.maxHp); saveSystem.save({ playerSurvival: player.getSurvivalState() }); }
      return res;
    };
    inventoryUI.onCraft = (recipe, resDef, extra) => {
      const msg = extra?.saved?.length ? `Fabricado: ${resDef?.name || recipe.name} (material economizado!)` : `Fabricado: ${resDef?.name || recipe.name}`;
      hud.showToast(msg, 1600);
      audioSystem.onEquip();
      saveSystem.save({ inventory: inventory.serialize() });
    };
    const useQuickSlot = (idx) => {
      const uiOpenNow = inventoryUI.isOpen || missionUI.isOpen || mapUI.isOpen || dialogUI.isOpen || characterUI.isOpen || audioUI.isOpen || tradeUI.isOpen || shelterUI.isOpen;
      if (uiOpenNow || vehicleSystem.isDriving() || player.dead) return;
      const slots = inventory.getQuickSlots?.() || [];
      const it = slots[idx];
      if (!it) { hud.showToast(`Atalho ${idx+1} vazio.`, 900); return; }
      if (it.type === 'equipamento') {
        if (inventory.equip(it.id)) hud.showToast(`Equipado: ${it.name}`, 900);
        return;
      }
      if (it.consumable && inventoryUI.onUseItem) {
        const res = inventoryUI.onUseItem(it);
        if (res?.ok) inventory.removeItem(it.id, 1);
        return;
      }
      hud.showToast('Este item não pode ser usado pelo atalho.', 900);
    };
    document.getElementById('hud-quickbar')?.addEventListener('click', (e) => {
      const s = e.target.closest('.hud-quick-slot');
      if (!s) return;
      const qi = Number(s.dataset.q);
      if (Number.isFinite(qi)) useQuickSlot(qi);
    });
    renderQuickbar();
    const _origEquip = inventory.equip.bind(inventory);
    inventory.equip = (id) => { const ok = _origEquip(id); if (ok) audioSystem.onEquip(); return ok; };

    const applyProgressionBonuses = () => {
      const b = progressionSystem.getBonuses();
      progBonuses = b;
      player.applyProgressionBonuses(b);
      inventory.applyProgressionBonuses(b);
      discoverySystem.applyProgressionBonuses(b);
      worldInteractables.lootBonus = b.lootBonus || 0;
      inventoryUI.craftSaveChance = b.craftSaveChance || 0;
    };
    let progBonuses = progressionSystem.getBonuses();
    const _prevProgChange = progressionSystem.onChange;
    progressionSystem.onChange = () => { _prevProgChange?.(); applyProgressionBonuses(); };
    applyProgressionBonuses();

    const dynamicEvents = new DynamicEventSystem({ scene: engine.scene, player, enemyManager, interactionSystem, inventory, missionSystem, saveSystem, hud, audioSystem, dayNightWeather, dialogUI, npcSystem, tradeSystem, shelterSystem, progressionSystem });
    player.onDamaged = (hp, maxHp) => { hud.setHealth(hp, maxHp); hud.flashDamage(); hud.notify('Dano recebido', 'danger', 900); audioSystem.onPlayerDamage(); };
    player.onDeath = () => {
      hud.setHealth(0, player.maxHp);
      hud.showToast('Você caiu! Reiniciando...', 1800);
      setTimeout(() => {
        player.resetStats(world.getSpawnPoint());
        hud.setHealth(player.hp, player.maxHp);
        hud.setStatus('EXPLORANDO');
        saveSystem.save({ playerSurvival: player.getSurvivalState() });
      }, 1600);
    };

    setLoading(97, 'Configurando câmera e controles...');
    const cam = new ThirdPersonCamera(engine.camera, input);
    cam.resetBehind(player.position, player.yaw);
    const touch = new TouchControls(input);
    touch.show();
    hud.setTouchMode(touch.active);
    applySettings();

    window.__NEON_STRIKE__ = { engine, world, player, cam, input, collisions, inventory, interactionSystem, inventoryUI, enemyManager, effects, saveSystem, missionSystem, missionUI, discoverySystem, mapUI, dayNightWeather, dialogUI, npcSystem, vehicleSystem, progressionSystem, characterUI, audioSystem, audioUI, dynamicEvents, tradeSystem, tradeUI, shelterSystem, shelterUI, factionSystem, decisionSystem };

    setLoading(100, 'Pronto.');

    let playerAttackCooldown = 0;
    let survivalSaveTimer = 0;
    let survivalXpTimer = 0;
    let noiseTimer = 0;
    let breathTimer = 0;
    let minimapTimer = 0;
    let threatTimer = 0;
    let threatActive = false;
    let gameStarted = false;
    let menuActive = true;
    input.menuActive = true;

    const startGameplay = (isContinue = false) => {
      menuActive = false;
      gameStarted = true;
      input.menuActive = false;
      input.moveX = 0; input.moveY = 0; input.run = false;
      input.consumeLookDelta(); input.consumeJump(); input.consumeInteract();
      input.consumeAttack(); input.consumeSpecial(); input.consumeInventoryToggle();
      input.consumeMissionToggle(); input.consumeMapToggle(); input.consumeCharToggle();
      menu.hide();
      hud.show();
      hud.setStatus('EXPLORANDO');
      touch.show();
      hud.setTouchMode(touch.active);
      cam.resetBehind(player.position, player.yaw);
      saveSystem.save({ playerSurvival: player.getSurvivalState(), worldTimeWeather: dayNightWeather.getState(), progression: progressionSystem.getState(), difficulty: GAME_CONFIG.difficulty });
      vehicleSystem.saveState?.();
      hud.showToast(isContinue ? 'Progresso restaurado. Boa sorte, sobrevivente.' : 'Bem-vindo a Manhattan em quarentena. Sobreviva.', 2800);
    };

    const menu = new MainMenu({
      saveSystem,
      audioSystem,
      settingsSystem,
      onContinue: () => { if (menu.hasSave()) startGameplay(true); },
      onNewGame: () => { window.location.reload(); },
      onQualityChange: () => { const s=settingsSystem.get(); const order=['mobile','medium','high']; const idx=order.indexOf(s.graphics.preset); s.graphics.preset=order[(idx+1)%order.length]; settingsSystem.patch({graphics:s.graphics}); },
      getQualityLabel: () => { const n=settingsSystem.get().graphics.preset; return ({mobile:'BAIXA',medium:'MÉDIA',high:'ALTA',custom:'PERSONALIZADA'})[n]||n; },
    });

    // Hide touch controls until game starts
    touch.hide();
    document.getElementById('touch-controls')?.classList.add('hidden');
    hud.hud?.classList.add('hidden');

    setTimeout(() => {
      loading.classList.add('hidden');
      menu.show();
    }, 250);
    let menuCamT = 0;
    const getEquipStats = () => {
      const eq = inventory.getEquipped();
      const base = eq?.stats || { damage: 20, range: 2.1, cooldown: 0.55, specialDamage: 35, specialCooldown: 4.0 };
      const b = progBonuses || {};
      return {
        ...base,
        damage: Math.round(base.damage * (1 + (b.damageMult || 0))),
        specialDamage: Math.round((base.specialDamage || 35) * (1 + (b.specialDamageMult || 0))),
        cooldown: Math.max(0.2, (base.cooldown || 0.55) * (1 + (b.attackCooldownMult || 0))),
        specialCooldown: base.specialCooldown || 4.0,
      };
    };
    engine.start((dt) => {
      if (menuActive) {
        menuCamT += dt * 0.07;
        const r = 42 + Math.sin(menuCamT * 0.35) * 4;
        const x = Math.cos(menuCamT) * r;
        const z = Math.sin(menuCamT) * r - 8;
        const y = 16 + Math.sin(menuCamT * 0.6) * 1.8;
        engine.camera.position.set(x, y, z);
        engine.camera.lookAt(0, 6, -6);
        dayNightWeather.update(dt, engine.camera.position);
        world.update(dt, engine.camera.position, engine.camera);
        audioSystem.update(dt, { camera: engine.camera, playerPos: engine.camera.position, weather: dayNightWeather?._targetWeather || dayNightWeather?.weather, dangerLevel: 0, inInterior: false });
        return;
      }
      survivalSaveTimer += dt;
      if (survivalSaveTimer >= 10) { survivalSaveTimer = 0; saveSystem.save({ playerSurvival: player.getSurvivalState(), worldTimeWeather: dayNightWeather.getState(), progression: progressionSystem.getState(), difficulty: GAME_CONFIG.difficulty }); vehicleSystem.saveState(); }
      if (!player.dead) { survivalXpTimer += dt; if (survivalXpTimer >= 90) { survivalXpTimer = 0; progressionSystem.addXP(15, 'sobrevivência'); } }
      if (input.consumeInventoryToggle()) { if (missionUI.isOpen) missionUI.close(); if (mapUI.isOpen) mapUI.close(); if (dialogUI.isOpen) dialogUI.close(); if (characterUI.isOpen) characterUI.close(); if (audioUI.isOpen) audioUI.close(); if (tradeUI.isOpen) tradeUI.close(); if (shelterUI.isOpen) shelterUI.close(); inventoryUI.toggle(); }
      if (input.consumeMissionToggle()) { if (inventoryUI.isOpen) inventoryUI.close(); if (mapUI.isOpen) mapUI.close(); if (dialogUI.isOpen) dialogUI.close(); if (characterUI.isOpen) characterUI.close(); if (audioUI.isOpen) audioUI.close(); if (tradeUI.isOpen) tradeUI.close(); if (shelterUI.isOpen) shelterUI.close(); missionUI.toggle(); }
      if (input.consumeMapToggle()) { if (inventoryUI.isOpen) inventoryUI.close(); if (missionUI.isOpen) missionUI.close(); if (dialogUI.isOpen) dialogUI.close(); if (characterUI.isOpen) characterUI.close(); if (audioUI.isOpen) audioUI.close(); if (tradeUI.isOpen) tradeUI.close(); if (shelterUI.isOpen) shelterUI.close(); mapUI.toggle(); }
      if (input.consumeCharToggle()) { if (inventoryUI.isOpen) inventoryUI.close(); if (missionUI.isOpen) missionUI.close(); if (mapUI.isOpen) mapUI.close(); if (dialogUI.isOpen) dialogUI.close(); if (audioUI.isOpen) audioUI.close(); if (tradeUI.isOpen) tradeUI.close(); if (shelterUI.isOpen) shelterUI.close(); characterUI.toggle(); }
      if (playerAttackCooldown > 0) playerAttackCooldown -= dt;

      const eq = inventory.getEquipped();
      const eqStats = getEquipStats();
      const ammoInfo = inventory.getAmmoInfo(eq);
      let ammoText = 'CORPO A CORPO';
      let lowAmmo = false;
      if (ammoInfo.firearm) {
        if (player.isReloading) ammoText = `RECARREGANDO... ${ammoInfo.loaded}/${ammoInfo.magSize} | RES ${ammoInfo.reserve}`;
        else ammoText = `${ammoInfo.loaded}/${ammoInfo.magSize} | RES ${ammoInfo.reserve}`;
        lowAmmo = ammoInfo.loaded === 0 || (ammoInfo.loaded <= Math.max(1, Math.floor(ammoInfo.magSize*0.25)) && ammoInfo.reserve <= 0);
      }
      hud.setWeaponInfo({ name: eq ? eq.name : 'Desarmado', category: eq?.category ? (eq.category === 'corpo-a-corpo' ? 'Corpo a corpo' : eq.category === 'arma-fogo' ? 'Arma de fogo' : eq.category) : 'Corpo a corpo', ammoText, lowAmmo });
      hud.setSpecialCooldown(player.specialCooldown, eqStats.specialCooldown || player.specialCooldownMax);
      hud.setSurvival({ hunger:player.hunger, thirst:player.thirst, energy:player.energy, stamina:player.stamina, maxHunger:player.maxHunger, maxThirst:player.maxThirst, maxEnergy:player.maxEnergy, maxStamina:player.maxStamina });

      const uiOpen = inventoryUI.isOpen || missionUI.isOpen || mapUI.isOpen || dialogUI.isOpen || characterUI.isOpen || audioUI.isOpen || tradeUI.isOpen || shelterUI.isOpen;
      const driving = vehicleSystem.isDriving();
      if (cam.vehicleMode !== driving) cam.setVehicleMode(driving);
      const touchMode = (navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
      if (vehicleControlsEl) vehicleControlsEl.classList.toggle('hidden', !(driving && touchMode && !uiOpen));
      const tcEl = document.getElementById('touch-controls');
      if (tcEl) {
        tcEl.classList.toggle('hidden', !touchMode);
        tcEl.querySelector('.joystick-zone')?.classList.toggle('hidden', driving);
        tcEl.querySelector('.touch-actions')?.classList.toggle('hidden', driving);
        tcEl.querySelector('.look-zone')?.classList.toggle('hidden', false);
      }

      if (!uiOpen) {
        if (driving) {
          // Exit vehicle on interact (E / mobile button)
          if (input.consumeInteract()) {
            const exited = vehicleSystem.exit(player);
            if (exited) {
              cam.setVehicleMode(false);
              cam.resetBehind(player.position, player.yaw);
            }
          } else {
            input.consumeInteract();
          }
          input.consumeAttack();
          input.consumeSpecial();
          input.consumeQuickSlot();
          input.consumeJump(); // Space is brake in vehicle, ignore jump
          // mobile vehicle controls override
          const anyVehBtn = vehState.left || vehState.right || vehState.accel || vehState.brake;
          if (touchMode) {
            input.moveX = (vehState.right ? 1 : 0) - (vehState.left ? 1 : 0);
            input.moveY = vehState.accel ? 1 : (vehState.brake ? -1 : 0);
          } else if (anyVehBtn) {
            input.moveX = (vehState.right ? 1 : 0) - (vehState.left ? 1 : 0);
            input.moveY = vehState.accel ? 1 : (vehState.brake ? -1 : 0);
          }
          input._vehBrake = !!vehState.brake;
          vehicleSystem.drive(dt, player, cam);
          cam.update(vehicleSystem.getCameraTarget() || player.position, dt);
          interactionSystem.clearPrompt?.();
          hud.setPrompt('[E / SAIR] Sair do veículo');
          hud.setStatus('DIRIGINDO');
        } else {
          if (player.isResting) {
            const mv = input.getMovement();
            const danger = (enemyManager?.zombies || []).some(z => z.alive && z.position.distanceTo(player.position) < 8);
            if (mv.x || mv.y || input.jumpQueued || input.attackQueued || input.specialQueued || danger) {
              player.stopRest();
              hud.setStatus('EXPLORANDO');
              hud.showToast(danger ? 'Descanso interrompido: perigo próximo!' : 'Descanso interrompido.', 1000);
              saveSystem.save({ playerSurvival: player.getSurvivalState() });
            }
          }
          player.update(dt, input, cam.getYaw());
          cam.update(player.position, dt);
          if (player.landNoiseEvent > 0) enemyManager.emitNoise?.(player.position, player.landNoiseEvent, 'land');
          noiseTimer -= dt;
          if (noiseTimer <= 0 && player.isMoving && player.onGround) {
            const sprinting = !!player.isRunning;
            const crouching = !!player.isCrouching;
            const radius = crouching ? 1.8 : (sprinting ? 11 : 4.5);
            const kind = crouching ? 'footstep_crouch' : (sprinting ? 'footstep_run' : 'footstep');
            if (radius > 0) enemyManager.emitNoise?.(player.position, radius, kind);
            if (!crouching) audioSystem.onPlayerStep(sprinting);
            noiseTimer = crouching ? 0.7 : (sprinting ? 0.45 : 0.8);
          }

          interactionSystem.update(player.position);
          hud.setPrompt(interactionSystem.getPrompt());
          if (input.consumeInteract()) {
            const res = interactionSystem.interact(player, { inventory, world });
            audioSystem.onInteract();
            if (res?.message === '__OPEN_SHELTER__') { shelterUI.open(res.data?.siteId); }
            else if (res?.message === '__OPEN_SHELTER_STORAGE__') { shelterUI.open(res.data?.siteId, { tab: 'storage', slotId: res.data?.slotId }); }
            else if (res?.message === '__OPEN_INVENTORY_CRAFT__') { inventoryUI.open(); inventoryUI.setTab?.('craft'); }
          }

          const quickSlot = input.consumeQuickSlot();
          if (quickSlot != null) useQuickSlot(quickSlot);

          // reload completion
          if (player.reloadJustFinished) {
            player.reloadJustFinished = false;
            const wid = player.reloadingWeaponId;
            player.reloadingWeaponId = null;
            const eqNowR = inventory.getEquipped();
            if (wid && eqNowR?.id !== wid) {
              hud.showToast('Recarga cancelada: arma trocada.', 1200);
            } else {
              const rr = inventory.reloadEquipped();
              if (rr.ok) hud.showToast(`Recarga completa: ${rr.loaded} no pente (${rr.reserve} reserva)`, 1400);
              else if (rr.reason === 'no_reserve') hud.showToast('Recarga interrompida: sem munição reserva.', 1400);
              else if (rr.reason === 'full') hud.showToast('Carregador já cheio.', 900);
            }
          }

          const wantsCycle = input.consumeWeaponCycle();
          if (wantsCycle) {
            const eqs = inventory.getItems().filter(it => it && it.type === 'equipamento');
            if (eqs.length > 0) {
              const cur = inventory.getEquipped()?.id;
              let idx = eqs.findIndex(e => e.id === cur);
              idx = (idx + 1) % eqs.length;
              inventory.equip(eqs[idx].id);
              player.cancelReload();
              hud.showToast(`Arma: ${eqs[idx].name}`, 900);
            }
          }

          const wantsReload = input.consumeReload();
          const wantsAttack = input.consumeAttack();
          const wantsSpecial = input.consumeSpecial();
          const stats = getEquipStats();
          const eqNow = inventory.getEquipped();
          const isFirearm = inventory.isFirearmItem(eqNow);

          if (wantsReload) {
            if (isFirearm) {
              const canR = inventory.canReload(eqNow);
              if (canR.ok) {
                if (player.startReload(eqNow.weapon.reloadTime || 1.5, eqNow.id)) hud.showToast('Recarregando...', 800);
              } else if (canR.reason === 'full') hud.showToast('Carregador cheio.', 900);
              else if (canR.reason === 'no_reserve') hud.showToast('Sem munição reserva.', 1200);
            } else {
              hud.showToast('Esta arma não usa recarga.', 900);
            }
          }

          if (wantsSpecial) {
            if (isFirearm) {
              hud.showToast('Especial indisponível para arma de fogo.', 900);
            } else if (player.canSpecial() && playerAttackCooldown <= 0) {
              player.startAttack('special', stats);
              playerAttackCooldown = 0.4;
              audioSystem.onPlayerAttack(true);
              enemyManager.emitNoise?.(player.position, 14, 'gunshot');
              const res = enemyManager.playerAttack(player, { damage: stats.specialDamage, range: stats.range + 0.4, isSpecial: true });
              if (res.hit) {
                hud.showHitmarker(res.kills > 0);
                (res.hitPositions || []).forEach(p => { effects.spawnHit(p, 0xffd06a, 8); effects.spawnRing(p, 0xd96b4b); });
                audioSystem.onHit();
                if (res.kills) { progressionSystem.addXP(20 * res.kills, 'combate'); audioSystem.onKill(res.hitPositions?.[0]); }
                hud.notify(res.kills ? `Especial! ${res.kills} zumbi(s) derrotado(s)!` : `Especial conectou em ${res.hits} alvo(s)!`, 'success', 1000);
              } else {
                hud.notify('Especial no ar.', 'info', 500);
              }
            } else {
              hud.showToast(player.specialCooldown > 0 ? `Especial em recarga (${player.specialCooldown.toFixed(1)}s)` : 'Especial indisponível.', 700);
            }
          } else if (wantsAttack) {
            if (player.isReloading) {
              hud.showToast('Recarregando...', 600);
            } else if (isFirearm) {
              const ammo = inventory.getAmmoInfo(eqNow);
              if (ammo.loaded <= 0) {
                hud.showToast(ammo.reserve > 0 ? 'Sem munição no pente. Pressione R para recarregar.' : 'Sem munição.', 1400);
              } else if (player.canAttack() && playerAttackCooldown <= 0) {
                const consumed = inventory.consumeLoadedAmmo(eqNow, 1);
                if (consumed.ok) {
                  player.startAttack('basic', stats);
                  playerAttackCooldown = stats.cooldown ?? 0.55;
                  audioSystem.onPlayerAttack(true);
                  enemyManager.emitNoise?.(player.position, 16, 'gunshot');
                  const res = enemyManager.playerAttack(player, { damage: stats.damage, range: stats.range, isSpecial: false });
                  if (res.hit) {
                    hud.showHitmarker(res.kills > 0);
                    (res.hitPositions || []).forEach(p => { effects.spawnHit(p, 0xfff0a0, 6); effects.spawnRing(p, 0xffdd88); });
                    audioSystem.onHit();
                    if (res.kills) { progressionSystem.addXP(20 * res.kills, 'combate'); audioSystem.onKill(res.hitPositions?.[0]); }
                    hud.notify(res.kills ? `Alvo eliminado!` : 'Tiro acertou!', 'success', 900);
                  } else {
                    hud.notify('Tiro errou.', 'info', 450);
                  }
                }
              }
            } else if (player.canAttack() && playerAttackCooldown <= 0) {
              player.startAttack('basic', stats);
              playerAttackCooldown = stats.cooldown ?? 0.55;
              audioSystem.onPlayerAttack(false);
              enemyManager.emitNoise?.(player.position, 8, 'combat');
              const res = enemyManager.playerAttack(player, { damage: stats.damage, range: stats.range, isSpecial: false });
              if (res.hit) {
                hud.showHitmarker(res.kills > 0);
                (res.hitPositions || []).forEach(p => { effects.spawnHit(p, 0xffc36a, 5); effects.spawnRing(p, 0xffb06a); });
                audioSystem.onHit();
                if (res.kills) { progressionSystem.addXP(15 * res.kills, 'combate'); audioSystem.onKill(res.hitPositions?.[0]); }
                hud.notify(res.kills ? `Zumbi ${res.type || 'eliminado'} derrotado!` : 'Golpe conectado!', 'success', 900);
              } else {
                hud.notify('Ataque no ar.', 'info', 450);
              }
            }
          }
        }
      } else {
        if (player.isReloading) player.cancelReload();
        input.consumeLookDelta();
        input.consumeJump();
        input.consumeInteract();
        input.consumeAttack();
        input.consumeSpecial();
        input.consumeReload();
        input.consumeWeaponCycle();
        input.consumeQuickSlot();
        cam.update((driving ? (vehicleSystem.getCameraTarget() || player.position) : player.position), dt);
        interactionSystem.update(driving ? (vehicleSystem.active?.pos || player.position) : player.position);
        hud.setPrompt('');
      }
      hud.setVehicle(vehicleSystem.isDriving() ? vehicleSystem.getActive() : null);

      dayNightWeather.update(dt, player.position);
      player.envVisibilityMult = dayNightWeather.getStealthVisibilityMult?.() ?? 1;
      world.update(dt, player.position, engine.camera);
      worldInteractables.update(dt);
      enemyManager.update(dt, player, performance.now());
      // audio: danger + zombie vocalizations
      let dangerLevel = 0;
      let stealthState = 'hidden';
      const _nowAudio = performance.now();
      for (const z of enemyManager.zombies) {
        if (!z.alive) continue;
        const d = z.group.position.distanceTo(player.position);
        if (d < 15) dangerLevel = Math.max(dangerLevel, 1 - d/15);
        if (d < 25) {
          if (z.state === 'chase' || z.state === 'attack') stealthState = 'detected';
          else if (stealthState !== 'detected' && (z.state === 'investigate' || z.state === 'search')) stealthState = 'investigate';
          else if (stealthState !== 'detected' && stealthState !== 'investigate' && z.state === 'suspicious') stealthState = 'suspicious';
        }
        if (d < 20 && (z.state === 'chase' || z.state === 'attack' || z.state === 'search' || z.state === 'investigate' || z.state === 'suspicious')) {
          const last = audioSystem._lastZombieGroan.get(z) || 0;
          if (_nowAudio - last > 3500 + Math.random()*2500) { audioSystem._lastZombieGroan.set(z, _nowAudio); audioSystem.onZombieGroan(z.group.position, z.state === 'attack' ? 'attack' : 'chase'); }
        } else if (d < 18 && (z.state === 'idle' || z.state === 'patrol')) {
          const last = audioSystem._lastZombieGroan.get(z) || 0;
          if (_nowAudio - last > 8000 + Math.random()*6000) { audioSystem._lastZombieGroan.set(z, _nowAudio); audioSystem.onZombieGroan(z.group.position, 'idle'); }
        }
        if (d < 25 && (z.state === 'patrol' || z.state === 'chase' || z.state === 'search' || z.state === 'investigate' || z.state === 'return')) {
          const lastS = audioSystem._lastZombieStep?.get(z) || 0;
          const stepMs = z.state === 'chase' ? 380 : 650;
          if (_nowAudio - lastS > stepMs) { if(!audioSystem._lastZombieStep) audioSystem._lastZombieStep = new WeakMap(); audioSystem._lastZombieStep.set(z,_nowAudio); audioSystem.onZombieStep(z.group.position, z.state==='chase'); }
        }
      }
      breathTimer -= dt;
      if (breathTimer <= 0 && player.stamina < player.maxStamina * 0.25 && player.isMoving) { audioSystem.playNoise({dur:0.25,gain:0.012,bus:'voice',hp:200,lp:1200}); breathTimer = 2.5; }
      audioSystem.update(dt, { camera: engine.camera, playerPos: player.position, weather: dayNightWeather?._targetWeather || dayNightWeather?.weather, dangerLevel, inInterior: false });
      threatTimer -= dt;
      if (threatTimer <= 0) { threatTimer = 0.35; const threat = dangerLevel > 0.08; if (threat !== threatActive) { threatActive = threat; hud.setThreat(threat); } }
      const stealthLabel = stealthState === 'detected' ? '● DETECTADO'
        : stealthState === 'investigate' ? '◐ INVESTIGANDO'
        : stealthState === 'suspicious' ? '◐ SUSPEITA'
        : (player.isCrouching ? '◌ AGACHADO' : '');
      const stealthCss = stealthState === 'hidden' && player.isCrouching ? 'hidden-state' : stealthState;
      hud.setStealthState?.(stealthCss, stealthLabel);
      effects.update(dt);
      missionSystem.update(player.position);
      discoverySystem.update(player.position);
      mapUI.setPlayerPos(player.position);
      minimapTimer -= dt;
      if (minimapTimer <= 0) {
        minimapTimer = 0.4;
        const activeObj = missionSystem.getActiveObjective();
        const tpos = activeObj ? missionTargets.get(activeObj.target) : null;
        hud.updateMinimap({ playerPos: player.position, playerYaw: player.yaw || 0, pois: discoverySystem.districts.getPOIs(), discoveredRegions: discoverySystem.districts.getRegions().filter(r=>r.discovered), objective: tpos ? { x: tpos.pos.x, z: tpos.pos.z } : null });
      }
      npcSystem.update(dt, player.position);
      dynamicEvents.update(dt);

      // Objective marker
      const activeObj = missionSystem.getActiveObjective();
      const t = activeObj ? missionTargets.get(activeObj.target) : null;
      if (t) {
        objectiveMarker.visible = true;
        objectiveMarker.position.copy(t.pos);
        objectiveMarker.position.y = 0.05;
        objectiveMarker.rotation.y += dt * 0.8;
      } else {
        objectiveMarker.visible = false;
      }
    });

  } catch (err) {
    showError(err);
  }
}

boot();
