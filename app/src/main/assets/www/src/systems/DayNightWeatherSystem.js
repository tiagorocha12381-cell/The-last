import * as THREE from 'three';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';
import { clamp, lerp } from '../utils/MathUtils.js';

const WEATHER_TYPES = ['clear', 'cloudy', 'light_rain', 'heavy_rain', 'foggy', 'storm'];

function lerpColor(a, b, t, out) {
  out.setRGB(lerp(a.r,b.r,t), lerp(a.g,b.g,t), lerp(a.b,b.b,t));
  return out;
}
function c(hex) { return new THREE.Color(hex); }

const PHASES = [
  // key hours: 0 midnight, 5 dawn, 7 morning, 12 noon, 17 afternoon, 19 sunset, 21 night
  { h:0,  name:'Madrugada',  skyTop:0x0a1020, skyHorizon:0x141a2a, skyBottom:0x080c14, sunColor:0x445577, sunIntensity:0.0, ambient:0.18, hemiSky:0x223355, hemiGround:0x05070a, fill:0.03, rim:0.02, fogNear:18, fogFar:95, exposure:0.55, sunGlow:0.0, sunGlowOpacity:0.0, shaft:0.0, nightLights:1.0 },
  { h:5,  name:'Amanhecer',  skyTop:0x243a5a, skyHorizon:0xd39b7a, skyBottom:0x4a3a3a, sunColor:0xffa86b, sunIntensity:0.35, ambient:0.28, hemiSky:0x6a7f98, hemiGround:0x1a1512, fill:0.08, rim:0.06, fogNear:24, fogFar:120, exposure:0.72, sunGlow:0.35, sunGlowOpacity:0.5, shaft:0.02, nightLights:0.7 },
  { h:7,  name:'Manhã',      skyTop:0x4f78a8, skyHorizon:0xc8d8e6, skyBottom:0x8ea8bf, sunColor:0xffe3c2, sunIntensity:0.85, ambient:0.45, hemiSky:0x9fc0d8, hemiGround:0x3a3f36, fill:0.18, rim:0.10, fogNear:30, fogFar:150, exposure:0.95, sunGlow:0.42, sunGlowOpacity:0.8, shaft:0.03, nightLights:0.15 },
  { h:12, name:'Meio-dia',   skyTop:0x5d86b8, skyHorizon:0xcfdbe5, skyBottom:0xa0b8ca, sunColor:0xfff1dc, sunIntensity:1.15, ambient:0.55, hemiSky:0xb8d4e8, hemiGround:0x4a5045, fill:0.22, rim:0.12, fogNear:35, fogFar:170, exposure:1.08, sunGlow:0.45, sunGlowOpacity:0.9, shaft:0.035, nightLights:0.0 },
  { h:17, name:'Tarde',      skyTop:0x567aa5, skyHorizon:0xd2c8b8, skyBottom:0x95a8b5, sunColor:0xffddb8, sunIntensity:0.9, ambient:0.48, hemiSky:0xa8bfd0, hemiGround:0x45483e, fill:0.18, rim:0.10, fogNear:32, fogFar:155, exposure:1.0, sunGlow:0.42, sunGlowOpacity:0.85, shaft:0.03, nightLights:0.05 },
  { h:19, name:'Pôr do sol', skyTop:0x2f4f78, skyHorizon:0xe08a5a, skyBottom:0x5a3a35, sunColor:0xff8a4a, sunIntensity:0.45, ambient:0.32, hemiSky:0x7a8aa0, hemiGround:0x221a18, fill:0.10, rim:0.08, fogNear:26, fogFar:130, exposure:0.78, sunGlow:0.38, sunGlowOpacity:0.7, shaft:0.025, nightLights:0.55 },
  { h:21, name:'Noite',      skyTop:0x0c1428, skyHorizon:0x1a2438, skyBottom:0x0a0e18, sunColor:0x667799, sunIntensity:0.05, ambient:0.22, hemiSky:0x2a3a55, hemiGround:0x080a10, fill:0.04, rim:0.03, fogNear:20, fogFar:105, exposure:0.6, sunGlow:0.0, sunGlowOpacity:0.0, shaft:0.0, nightLights:1.0 },
  { h:24, name:'Madrugada',  skyTop:0x0a1020, skyHorizon:0x141a2a, skyBottom:0x080c14, sunColor:0x445577, sunIntensity:0.0, ambient:0.18, hemiSky:0x223355, hemiGround:0x05070a, fill:0.03, rim:0.02, fogNear:18, fogFar:95, exposure:0.55, sunGlow:0.0, sunGlowOpacity:0.0, shaft:0.0, nightLights:1.0 },
];
for (const p of PHASES) { for (const k of ['skyTop','skyHorizon','skyBottom','sunColor','hemiSky','hemiGround']) p[k+'C'] = new THREE.Color(p[k]); }

const WEATHER_PRESETS = {
  clear:      { fogMul:1.0, fogNearMul:1.0, sunMul:1.0, ambientMul:1.0, exposureMul:1.0, rain:0, wind:0.1, overcast:0.0, visibility:1.0 },
  cloudy:     { fogMul:0.92, fogNearMul:0.95, sunMul:0.72, ambientMul:0.92, exposureMul:0.95, rain:0, wind:0.2, overcast:0.35, visibility:0.95 },
  light_rain: { fogMul:0.78, fogNearMul:0.85, sunMul:0.55, ambientMul:0.85, exposureMul:0.9, rain:0.45, wind:0.35, overcast:0.55, visibility:0.85 },
  heavy_rain: { fogMul:0.62, fogNearMul:0.75, sunMul:0.38, ambientMul:0.78, exposureMul:0.84, rain:1.0, wind:0.55, overcast:0.75, visibility:0.72 },
  foggy:      { fogMul:0.45, fogNearMul:0.55, sunMul:0.5, ambientMul:0.82, exposureMul:0.88, rain:0.0, wind:0.08, overcast:0.45, visibility:0.55 },
  storm:      { fogMul:0.55, fogNearMul:0.7, sunMul:0.28, ambientMul:0.72, exposureMul:0.78, rain:1.0, wind:0.8, overcast:0.9, visibility:0.65 },
};

export class DayNightWeatherSystem {
  constructor(engine, world) {
    this.engine = engine;
    this.scene = engine.scene;
    this.world = world;
    this.env = world.environment;
    this.renderer = engine.renderer;
    this.config = GAME_CONFIG.dayNight || {};
    this.weatherConfig = GAME_CONFIG.weather || {};
    this.enabled = this.config.enabled !== false;
    this.time = this.config.startTime ?? 8.5; // 0-24
    this.dayLengthMinutes = this.config.dayLengthMinutes ?? 24;
    this.weather = 'clear';
    this._targetWeather = 'clear';
    this._weatherTimer = this._randWeatherDur();
    this._weatherTrans = 1; // 0..1, 1 = fully at target
    this._weatherFrom = 'clear';
    this._rainAmount = 0;
    this._wetness = 0;
    this._lightningTimer = 0;
    this._lightningFlash = 0;
    this._audio = { ctx: null, rainGain: null, rainSrc: null, windGain: null, windSrc: null };
    this._nightLights = [];
    this._nightLightMats = [];
    this._rain = null;
    this._rainGeo = null;
    this._rainMat = null;
    this._lastAppliedNight = -1;
    this._fallbackAdded = false;
    this._wetTimer = 0;
    this._wetMats = [];
    this._puddles = [];
    this._tmp = { skyTop:new THREE.Color(), skyHorizon:new THREE.Color(), skyBottom:new THREE.Color(), sunColor:new THREE.Color(), hemiSky:new THREE.Color(), hemiGround:new THREE.Color(), gray:new THREE.Color(0x7a8590), fogGray:new THREE.Color(0x9aa5b0), fogColor:new THREE.Color() };
    this._initRain();
    this._initPuddles();
    this._scanNightLights();
    this._scanWetMaterials();
    const resume = () => { try { this._audio.ctx?.resume?.(); } catch(_){} };
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('keydown', resume, { passive: true });
  }

  _randWeatherDur() {
    const min = this.weatherConfig.minDurationSec ?? 90;
    const max = this.weatherConfig.maxDurationSec ?? 180;
    return min + Math.random() * (max - min);
  }

  _initPuddles() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f8090, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.0, depthWrite: false });
    this._puddleMat = mat;
    const positions = [[4,0.03,6],[-8,0.03,-5],[15,0.03,-12],[-20,0.03,14],[28,0.03,4],[-35,0.03,-20],[45,0.03,-8],[-55,0.03,18]];
    for (const [x,y,z] of positions) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.2 + Math.random()*0.8, 16), mat);
      m.rotation.x = -Math.PI/2;
      m.position.set(x,y,z);
      m.renderOrder = 1;
      this.scene.add(m);
      this._puddles.push(m);
    }
  }

  _scanWetMaterials() {
    this._wetMats = [];
    this.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const n = ((obj.name||'') + ' ' + (obj.parent?.name||'')).toLowerCase();
      if (!(n.includes('road') || n.includes('ground') || n.includes('asphalt') || n.includes('street') || n.includes('floor') || n.includes('sidewalk'))) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m || !('roughness' in m) || this._wetMats.includes(m)) continue;
        if (m.userData._baseRoughness == null) m.userData._baseRoughness = m.roughness;
        this._wetMats.push(m);
      }
    });
  }

  _updateWetness(dt) {
    const wp = this._currentWeatherPreset();
    const targetWet = clamp(wp.rain * 1.0, 0, 1);
    this._wetness = lerp(this._wetness, targetWet, 1 - Math.exp(-dt * (targetWet > this._wetness ? 0.25 : 0.08)));
    this._wetTimer -= dt;
    if (this._wetTimer > 0) return;
    this._wetTimer = 2.0;
    if (!this._wetMats.length) this._scanWetMaterials();
    for (const m of this._wetMats) {
      const base = m.userData._baseRoughness ?? m.roughness;
      m.roughness = lerp(base, Math.max(0.08, base * 0.35), this._wetness);
      m.needsUpdate = true;
    }
    if (this._puddleMat) this._puddleMat.opacity = this._wetness * 0.35;
  }

  _initRain() {
    const maxCount = QUALITY_PRESETS.high?.rainParticles || 1200;
    this._rainMax = (QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium).rainParticles || 500;
    const pos = new Float32Array(maxCount * 3);
    for (let i = 0; i < maxCount; i++) {
      pos[i*3] = (Math.random() - 0.5) * 80;
      pos[i*3+1] = Math.random() * 30;
      pos[i*3+2] = (Math.random() - 0.5) * 80;
    }
    this._rainGeo = new THREE.BufferGeometry();
    this._rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._rainGeo.setDrawRange(0, 0);
    this._rainMat = new THREE.PointsMaterial({ color: 0xaac0d0, size: 0.08, transparent: true, opacity: 0.0, depthWrite: false });
    this._rain = new THREE.Points(this._rainGeo, this._rainMat);
    this._rain.frustumCulled = false;
    this._rain.visible = false;
    this.scene.add(this._rain);
  }

  rescanLights() { this._nightLights = []; this._nightLightMats = []; this._lastAppliedNight = -1; this._scanNightLights(); this._ensureFallbackLights(); }

  _ensureFallbackLights() {
    if (this._fallbackAdded || this._nightLights.length >= 6) return;
    this._fallbackAdded = true;
    const positions = [[0,4,0],[20,4,0],[-20,4,0],[0,4,20],[0,4,-20],[40,4,20],[-40,4,-20],[20,4,40],[-20,4,-40]];
    for (const [x,y,z] of positions) {
      const l = new THREE.PointLight(0xffd8a8, 0.8, 18, 2);
      l.position.set(x,y,z);
      l.userData._nightBase = 0.8;
      l.userData.nightLight = true;
      this.scene.add(l);
      this._nightLights.push(l);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,4,6), new THREE.MeshStandardMaterial({color:0x555a60,roughness:0.7,metalness:0.4}));
      pole.position.set(x,2,z);
      this.scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshStandardMaterial({color:0xfff0cc,emissive:0xffe0a0,emissiveIntensity:0.8,roughness:0.4}));
      bulb.position.set(x,4,z);
      bulb.userData.nightLight = true;
      this.scene.add(bulb);
      const m = bulb.material; m.userData._nightBaseEmissive = 0.8; this._nightLightMats.push(m);
    }
  }

  _scanNightLights() {
    // Collect lights and emissive meshes that look like street/building lights
    const seenMats = new Set(this._nightLightMats);
    this.scene.traverse((obj) => {
      if (obj.isPointLight || obj.isSpotLight) {
        const n = (obj.name || '').toLowerCase();
        const p = (obj.parent?.name || '').toLowerCase();
        if (n.includes('street') || n.includes('lamp') || n.includes('neon') || p.includes('street') || p.includes('lamp') || p.includes('poste') || obj.userData.nightLight) {
          obj.userData._nightBase = obj.intensity;
          this._nightLights.push(obj);
        }
      }
      if (obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m || !m.emissive) continue;
          const n = (obj.name || '').toLowerCase();
          const p = (obj.parent?.name || '').toLowerCase();
          const isWindow = n.includes('window') || n.includes('janela') || p.includes('window') || p.includes('building') || p.includes('facade');
          const isNeon = n.includes('neon') || n.includes('sign') || p.includes('neon');
          const isLamp = n.includes('lamp') || n.includes('street') || p.includes('lamp');
          if (isWindow || isNeon || isLamp || obj.userData.nightLight) {
            if (seenMats.has(m)) continue;
            if (!m.userData) m.userData = {};
            if (m.userData._nightBaseEmissive == null) m.userData._nightBaseEmissive = m.emissiveIntensity ?? 0;
            if (m.userData._nightBaseEmissive > 0.01 || isLamp || isNeon || isWindow) {
              this._nightLightMats.push(m);
              seenMats.add(m);
            }
          }
        }
      }
    });
  }

  _phaseAt(time) {
    const t = ((time % 24) + 24) % 24;
    for (let i = 0; i < PHASES.length - 1; i++) {
      const a = PHASES[i], b = PHASES[i+1];
      if (t >= a.h && t <= b.h) {
        const f = (t - a.h) / Math.max(0.0001, b.h - a.h);
        return { a, b, f, name: f < 0.5 ? a.name : b.name };
      }
    }
    return { a: PHASES[0], b: PHASES[1], f: 0, name: PHASES[0].name };
  }

  getPhaseName() { return this._phaseAt(this.time).name; }

  getStealthVisibilityMult() {
    // 1.0 daylight, lower at night/dawn/dusk; combined with weather visibility
    const t = ((this.time % 24) + 24) % 24;
    let light = 1.0;
    if (t >= 7 && t <= 17) light = 1.0;
    else if (t > 17 && t < 20) light = 1.0 - ((t - 17) / 3) * 0.45; // dusk
    else if (t >= 20 || t < 5) light = 0.55; // night
    else if (t >= 5 && t < 7) light = 0.55 + ((t - 5) / 2) * 0.45; // dawn
    const wp = this._currentWeatherPreset();
    const weatherVis = wp.visibility ?? 1.0;
    return Math.max(0.35, Math.min(1.1, light * (0.75 + weatherVis * 0.25)));
  }

  _currentWeatherPreset() {
    const from = WEATHER_PRESETS[this._weatherFrom] || WEATHER_PRESETS.clear;
    const to = WEATHER_PRESETS[this._targetWeather] || WEATHER_PRESETS.clear;
    const t = this._weatherTrans;
    const out = {};
    for (const k of Object.keys(from)) out[k] = lerp(from[k], to[k], t);
    return out;
  }

  setWeather(type, immediate = false) {
    if (!WEATHER_TYPES.includes(type)) return;
    if (immediate) {
      this.weather = type; this._targetWeather = type; this._weatherFrom = type; this._weatherTrans = 1;
      this._weatherTimer = this._randWeatherDur();
      return;
    }
    if (type === this._targetWeather) return;
    this._weatherFrom = this._currentWeatherPreset() ? this._targetWeather : this.weather;
    // capture current blended state by starting transition from current target
    this._weatherFrom = this._targetWeather;
    this._targetWeather = type;
    this._weatherTrans = 0;
    this._weatherTimer = this._randWeatherDur();
  }

  _updateWeather(dt) {
    const transSec = this.weatherConfig.transitionSec ?? 20;
    if (this._weatherTrans < 1) {
      this._weatherTrans = Math.min(1, this._weatherTrans + dt / Math.max(1, transSec));
      if (this._weatherTrans >= 1) this.weather = this._targetWeather;
    } else {
      this._weatherTimer -= dt;
      if (this._weatherTimer <= 0) {
        const options = WEATHER_TYPES.filter(w => w !== this._targetWeather);
        this.setWeather(options[Math.floor(Math.random() * options.length)]);
      }
    }
  }

  _ensureAudio() {
    if (this._audio.ctx) return this._audio.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const rainGain = ctx.createGain(); rainGain.gain.value = 0; rainGain.connect(ctx.destination);
      const windGain = ctx.createGain(); windGain.gain.value = 0; windGain.connect(ctx.destination);
      // noise buffers
      const makeNoise = (gainNode, filterFreq, type='lowpass') => {
        const bufSize = 2 * ctx.sampleRate;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i=0;i<bufSize;i++) data[i] = Math.random()*2-1;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = filterFreq;
        src.connect(filter); filter.connect(gainNode); src.start();
        return src;
      };
      this._audio.ctx = ctx;
      this._audio.rainGain = rainGain;
      this._audio.windGain = windGain;
      this._audio.rainSrc = makeNoise(rainGain, 1200, 'lowpass');
      this._audio.windSrc = makeNoise(windGain, 500, 'lowpass');
      return ctx;
    } catch (_) { return null; }
  }

  _updateAudio(dt) {
    const preset = QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium;
    if (!preset.weatherAudio) return;
    const ctx = this._audio.ctx;
    if (!ctx) {
      // lazy init on user interaction? we'll init when raining; try anyway
      if (this._rainAmount > 0.01) this._ensureAudio();
      return;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    const rainVol = clamp(this._rainAmount * 0.08, 0, 0.08);
    const windVol = clamp((WEATHER_PRESETS[this._targetWeather]?.wind || 0.1) * 0.03, 0, 0.03);
    this._audio.rainGain.gain.linearRampToValueAtTime(rainVol, ctx.currentTime + 0.2);
    this._audio.windGain.gain.linearRampToValueAtTime(windVol, ctx.currentTime + 0.2);
  }

  _updateRain(dt, playerPos) {
    const preset = QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium;
    const max = preset.rainParticles || 500;
    const wp = this._currentWeatherPreset();
    const targetRain = wp.rain || 0;
    this._rainAmount = lerp(this._rainAmount, targetRain, 1 - Math.exp(-dt * 1.5));
    const visibleCount = Math.floor(max * clamp(this._rainAmount, 0, 1));
    this._rain.visible = visibleCount > 0;
    this._rainMat.opacity = clamp(this._rainAmount * 0.55, 0, 0.55);
    this._rainGeo.setDrawRange(0, visibleCount);
    if (!this._rain.visible) return;
    const pos = this._rainGeo.attributes.position.array;
    const wind = wp.wind || 0.1;
    for (let i = 0; i < visibleCount; i++) {
      const ix = i*3;
      pos[ix] += wind * dt * 2.0;
      pos[ix+1] -= dt * (12 + this._rainAmount * 10);
      pos[ix+2] += wind * dt * 0.6;
      if (pos[ix+1] < 0) {
        pos[ix] = playerPos.x + (Math.random() - 0.5) * 60;
        pos[ix+1] = 18 + Math.random() * 18;
        pos[ix+2] = playerPos.z + (Math.random() - 0.5) * 60;
      }
      if (Math.abs(pos[ix] - playerPos.x) > 40) pos[ix] = playerPos.x + (Math.random() - 0.5) * 60;
      if (Math.abs(pos[ix+2] - playerPos.z) > 40) pos[ix+2] = playerPos.z + (Math.random() - 0.5) * 60;
    }
    this._rainGeo.attributes.position.needsUpdate = true;
  }

  _applyNightLights(factor) {
    // factor 0 = day, 1 = night
    const q = Math.round(factor * 20) / 20;
    if (q === this._lastAppliedNight) return;
    this._lastAppliedNight = q;
    for (const l of this._nightLights) {
      const base = l.userData._nightBase ?? 1;
      l.intensity = base * factor;
      l.visible = factor > 0.02;
    }
    for (const m of this._nightLightMats) {
      const base = m.userData._nightBaseEmissive ?? 0;
      const boost = (m.emissive && m.emissive.getHex() !== 0x000000) ? 1 : 0;
      m.emissiveIntensity = base + (boost ? 0 : 0) + (base > 0 ? 0 : 0);
      // For window-like materials with no base emissive, give subtle night glow
      if (base <= 0.01) {
        m.emissiveIntensity = 0.6 * factor;
        if (m.emissive.getHex() === 0x000000) m.emissive.setHex(0xffe6b0);
      } else {
        m.emissiveIntensity = base * (0.6 + 0.8 * factor);
      }
    }
  }

  update(dt, playerPos) {
    if (!this.enabled) return;
    const speed = 24 / Math.max(1, this.dayLengthMinutes); // game hours per real minute? dayLengthMinutes=24 means 24 real min per 24 game hours
    this.time = (this.time + (dt / 60) * speed) % 24;

    this._updateWeather(dt);
    this._updateRain(dt, playerPos);
    this._updateAudio(dt);
    this._updateWetness(dt);

    const ph = this._phaseAt(this.time);
    const a = ph.a, b = ph.b, f = ph.f;
    const wp = this._currentWeatherPreset();
    const preset = QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium;

    // sun direction from time: sunrise ~5.5, sunset ~18.5
    const dayAngle = ((this.time - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(dayAngle);
    const sunX = Math.cos(dayAngle) * 0.7;
    const sunZ = 0.35;
    const sunDir = new THREE.Vector3(sunX, Math.max(0.05, sunY), sunZ).normalize();

    const fogFarBase = lerp(a.fogFar, b.fogFar, f);
    const fogNearBase = lerp(a.fogNear, b.fogNear, f);
    const fogFar = clamp(fogFarBase * wp.fogMul, 30, preset.fogFar || 150);
    const fogNear = clamp(fogNearBase * wp.fogNearMul, 8, fogFar - 10);

    const sunIntensity = lerp(a.sunIntensity, b.sunIntensity, f) * wp.sunMul;
    const ambient = lerp(a.ambient, b.ambient, f) * wp.ambientMul;
    const exposure = lerp(a.exposure, b.exposure, f) * (wp.exposureMul || 1);
    const nightFactor = lerp(a.nightLights, b.nightLights, f);

    const skyTop = lerpColor(a.skyTopC, b.skyTopC, f, this._tmp.skyTop);
    const skyHorizon = lerpColor(a.skyHorizonC, b.skyHorizonC, f, this._tmp.skyHorizon);
    const skyBottom = lerpColor(a.skyBottomC, b.skyBottomC, f, this._tmp.skyBottom);
    const sunColor = lerpColor(a.sunColorC, b.sunColorC, f, this._tmp.sunColor);
    const over = wp.overcast || 0;
    const gray = this._tmp.gray;
    skyTop.lerp(gray, over * 0.45);
    skyHorizon.lerp(gray, over * 0.35);
    skyBottom.lerp(gray, over * 0.3);

    this.env.sunOffset = { x: sunDir.x * 55, y: Math.max(10, sunDir.y * 70), z: sunDir.z * 55 };
    if (typeof this.env.applyAtmosphere === 'function') {
      this.env.applyAtmosphere({
        skyTop, skyHorizon, skyBottom, sunDir, sunColor,
        sunIntensity, ambientIntensity: ambient,
        hemiSky: lerpColor(a.hemiSkyC, b.hemiSkyC, f, this._tmp.hemiSky).lerp(gray, over*0.25),
        hemiGround: lerpColor(a.hemiGroundC, b.hemiGroundC, f, this._tmp.hemiGround),
        fillIntensity: lerp(a.fill, b.fill, f) * wp.sunMul,
        rimIntensity: lerp(a.rim, b.rim, f),
        fogNear, fogFar,
        fogColor: this._tmp.fogColor.copy(skyHorizon).lerp(this._tmp.fogGray, over * 0.2),
        sunGlow: lerp(a.sunGlow, b.sunGlow, f) * (1 - over * 0.7),
        sunGlowOpacity: lerp(a.sunGlowOpacity, b.sunGlowOpacity, f) * (1 - over * 0.8),
        shaftOpacity: lerp(a.shaft, b.shaft, f) * (1 - over),
        exposure,
      });
    } else {
      // Fallback for stale cached Environment module
      if (this.env.sun) { this.env.sun.color.copy(sunColor); this.env.sun.intensity = sunIntensity; }
      if (this.env.hemi) { this.env.hemi.intensity = ambient; }
      if (this.scene.fog) { this.scene.fog.near = fogNear; this.scene.fog.far = fogFar; this.scene.fog.color.copy(this._tmp.fogColor); }
      this.scene.background?.copy?.(this._tmp.fogColor);
    }
    this.renderer.toneMappingExposure = exposure;
    this._applyNightLights(nightFactor);

    // lightning for storm
    if (this._targetWeather === 'storm' || (this._weatherFrom === 'storm' && this._weatherTrans < 1)) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningFlash = 0.8 + Math.random() * 0.6;
        this._lightningTimer = 2 + Math.random() * 6;
      }
    }
    if (this._lightningFlash > 0) {
      this.renderer.toneMappingExposure = exposure + this._lightningFlash * 0.5;
      this._lightningFlash -= dt * 4;
    }
  }

  setQuality(name) {
    const preset = QUALITY_PRESETS[name] || QUALITY_PRESETS.medium;
    this._rainMax = preset.rainParticles || 500;
  }

  getState() {
    return { time: this.time, weather: this.weather, targetWeather: this._targetWeather, weatherTimer: this._weatherTimer };
  }

  loadState(s) {
    if (!s) return;
    if (Number.isFinite(s.time)) this.time = ((s.time % 24) + 24) % 24;
    const w = s.targetWeather || s.weather;
    if (w && WEATHER_TYPES.includes(w)) this.setWeather(w, true);
    if (Number.isFinite(s.weatherTimer)) this._weatherTimer = s.weatherTimer;
  }
}
