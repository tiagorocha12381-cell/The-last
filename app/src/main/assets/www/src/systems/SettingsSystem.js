import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';

const KEY = 'ns2_settings_v1';
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

export const DEFAULT_SETTINGS = {
  graphics: {
    preset: 'medium', // mobile|medium|high|custom
    renderScale: 1,   // 0.6-1.2 multiplier applied to devicePixelRatio cap
    shadows: true,
    renderDistance: 150,
    textureQuality: 'medium', // low|medium|high
    effects: true,
    fpsLimit: 60, // 30|45|60|0(unlimited)
  },
  audio: {
    master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.65, voice: 0.8,
    muteMaster: false, muteMusic: false, muteSfx: false, muteAmbient: false, muteVoice: false,
  },
  controls: {
    cameraSensitivity: 1.0,
    aimSensitivity: 1.0,
    touchSensitivity: 1.0,
    invertY: false,
    touchButtonScale: 1.0,
    touchButtonOpacity: 0.45,
  },
  accessibility: {
    textScale: 1.0,
    reduceMotion: false,
    highContrast: false,
    largeIndicators: false,
  },
};

function deepMerge(base, src) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!src || typeof src !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (src[k] === undefined) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], src[k]);
    else out[k] = src[k];
  }
  return out;
}

export class SettingsSystem {
  constructor() {
    this.data = this._load();
    this.listeners = new Set();
  }

  _load() {
    let parsed = null;
    try { const raw = localStorage.getItem(KEY); if (raw) parsed = JSON.parse(raw); } catch (_) {}
    const s = deepMerge(DEFAULT_SETTINGS, parsed || {});
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
    if (isAndroid && !parsed?.graphics?.preset) {
      s.graphics.preset = 'mobile';
      s.graphics.shadows = false;
      s.graphics.renderScale = 0.8;
      s.graphics.renderDistance = 92;
      s.graphics.effects = false;
      s.graphics.fpsLimit = 30;
    }
    // sanitize
    s.graphics.preset = ['mobile','medium','high','custom'].includes(s.graphics.preset) ? s.graphics.preset : 'medium';
    s.graphics.renderScale = clamp(Number(s.graphics.renderScale)||1, 0.6, 1.2);
    s.graphics.shadows = !!s.graphics.shadows;
    s.graphics.renderDistance = clamp(Number(s.graphics.renderDistance)||150, 80, 260);
    s.graphics.textureQuality = ['low','medium','high'].includes(s.graphics.textureQuality) ? s.graphics.textureQuality : 'medium';
    s.graphics.effects = !!s.graphics.effects;
    s.graphics.fpsLimit = [0,30,45,60].includes(Number(s.graphics.fpsLimit)) ? Number(s.graphics.fpsLimit) : 60;
    for (const k of ['master','music','sfx','ambient','voice']) s.audio[k] = clamp(Number(s.audio[k]) ?? 0.8, 0, 1);
    for (const k of ['muteMaster','muteMusic','muteSfx','muteAmbient','muteVoice']) s.audio[k] = !!s.audio[k];
    s.controls.cameraSensitivity = clamp(Number(s.controls.cameraSensitivity)||1, 0.4, 2.0);
    s.controls.aimSensitivity = clamp(Number(s.controls.aimSensitivity)||1, 0.4, 2.0);
    s.controls.touchSensitivity = clamp(Number(s.controls.touchSensitivity)||1, 0.4, 2.5);
    s.controls.invertY = !!s.controls.invertY;
    s.controls.touchButtonScale = clamp(Number(s.controls.touchButtonScale)||1, 0.8, 1.4);
    s.controls.touchButtonOpacity = clamp(Number(s.controls.touchButtonOpacity)||0.45, 0.25, 0.85);
    s.accessibility.textScale = clamp(Number(s.accessibility.textScale)||1, 0.9, 1.3);
    s.accessibility.reduceMotion = !!s.accessibility.reduceMotion;
    s.accessibility.highContrast = !!s.accessibility.highContrast;
    s.accessibility.largeIndicators = !!s.accessibility.largeIndicators;
    return s;
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) {}
    this.listeners.forEach(fn => { try { fn(this.data); } catch(_){} });
  }

  get() { return this.data; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  set(path, value) {
    const parts = path.split('.');
    let obj = this.data;
    for (let i=0;i<parts.length-1;i++) obj = obj[parts[i]];
    obj[parts[parts.length-1]] = value;
    this.data = this._loadMerged(this.data); // sanitize
    this.save();
  }

  _loadMerged(data) { // sanitize in-place shape
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(_) {}
    return this._load();
  }

  patch(partial) {
    this.data = deepMerge(this.data, partial);
    this.data = this._loadMerged(this.data);
    this.save();
  }

  resetDefaults() {
    try { localStorage.removeItem(KEY); } catch (_) {}
    this.data = this._load();
    this.save();
  }

  getQualityPresetName() { return this.data.graphics.preset === 'custom' ? 'custom' : this.data.graphics.preset; }

  getEffectiveQuality() {
    const g = this.data.graphics;
    const baseName = g.preset === 'custom' ? 'medium' : g.preset;
    const base = { ...(QUALITY_PRESETS[baseName] || QUALITY_PRESETS.medium) };
    if (g.preset === 'custom') {
      base.shadows = !!g.shadows;
      base.fogFar = g.renderDistance;
      base.maxPixelRatio = clamp((base.maxPixelRatio || 1.5) * g.renderScale, 0.75, 2.5);
      const anisoMap = { low: 1, medium: 4, high: 8 };
      base.anisotropy = anisoMap[g.textureQuality] || base.anisotropy || 4;
      base.postfx = !!g.effects;
    }
    return { name: g.preset, preset: base };
  }
}
