import { Vector3 } from 'three';
const SETTINGS_KEY = 'ns2_audio_settings';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

function makeNoiseBuffer(ctx, seconds=1, pink=false) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i=0;i<len;i++) {
    const white = Math.random()*2-1;
    if (pink) {
      b0 = 0.99886*b0 + white*0.0555179; b1 = 0.99332*b1 + white*0.0750759; b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856; b4 = 0.55000*b4 + white*0.5329522; b5 = -0.7616*b5 - white*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6 + white*0.5362) * 0.1; b6 = white*0.115926;
    } else d[i] = white * 0.5;
  }
  return buf;
}

export class AudioSystem {
  constructor(saveSystem=null) {
    this.saveSystem = saveSystem;
    this.ctx = null;
    this.master = null;
    this.buses = {};
    this.settings = { master:0.8, music:0.55, sfx:0.8, ambient:0.65, voice:0.8, muteMaster:false, muteMusic:false, muteSfx:false, muteAmbient:false, muteVoice:false };
    this._loadSettings();
    this.started = false;
    this._noiseBuf = null;
    this._pinkBuf = null;
    this._activeSfx = 0;
    this.maxSfx = 18;
    this._music = { state:'explore', nodes:null, target:'explore', blend:1, timer:0 };
    this._ambient = { nodes:null, rainNodes:null, tension:0 };
    this._lastStep = 0;
    this._lastZombieGroan = new WeakMap();
    this._listener = { pos:[0,0,0], fwd:[0,0,-1], up:[0,1,0] };
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
    } catch(_) {}
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch(_) {}
    this._applyGains();
  }

  setSetting(key, value) {
    if (!(key in this.settings)) return;
    this.settings[key] = value;
    this.saveSettings();
  }

  getSettings() { return { ...this.settings }; }

  async ensureStarted() {
    if (this.ctx) { if (this.ctx.state === 'suspended') try { await this.ctx.resume(); } catch(_){} return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const k of ['music','sfx','ambient','voice']) {
        const g = this.ctx.createGain(); g.connect(this.master); this.buses[k] = g;
      }
      this._noiseBuf = makeNoiseBuffer(this.ctx, 2, false);
      this._pinkBuf = makeNoiseBuffer(this.ctx, 2, true);
      this._applyGains();
      this._startAmbient();
      this._startMusic();
      this.started = true;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return true;
    } catch(e) { console.warn('Audio init failed', e); return false; }
  }

  _applyGains() {
    if (!this.ctx || !this.master) return;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muteMaster ? 0 : clamp(s.master,0,1), this.ctx.currentTime, 0.05);
    for (const k of ['music','sfx','ambient','voice']) {
      const muted = s.muteMaster || s[`mute${k[0].toUpperCase()+k.slice(1)}`];
      const val = muted ? 0 : clamp(s[k] ?? 0.7, 0, 1);
      this.buses[k]?.gain.setTargetAtTime(val, this.ctx.currentTime, 0.08);
    }
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(()=>{}); }

  updateListener(camera, playerPos) {
    if (!this.ctx) return;
    const c = camera;
    const p = playerPos;
    // Three.js camera
    if (c && c.getWorldDirection) {
      const dir = new Vector3();
      c.getWorldDirection(dir);
      const up = c.up || {x:0,y:1,z:0};
      const l = this.ctx.listener;
      if (l.positionX) {
        l.positionX.value = c.position.x; l.positionY.value = c.position.y; l.positionZ.value = c.position.z;
        l.forwardX.value = dir.x; l.forwardY.value = dir.y; l.forwardZ.value = dir.z;
        l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z;
      } else if (l.setPosition) {
        l.setPosition(c.position.x,c.position.y,c.position.z);
        l.setOrientation(dir.x,dir.y,dir.z, up.x,up.y,up.z);
      }
    } else if (p) {
      const l = this.ctx.listener;
      if (l.positionX) { l.positionX.value=p.x; l.positionY.value=p.y+1.6; l.positionZ.value=p.z; }
      else if (l.setPosition) l.setPosition(p.x,p.y+1.6,p.z);
    }
  }

  _canSfx() { return this.ctx && this.started && this._activeSfx < this.maxSfx; }

  _trackSfx(node, dur) {
    this._activeSfx++;
    const done = () => { this._activeSfx = Math.max(0, this._activeSfx-1); };
    try { node.onended = done; } catch(_) {}
    setTimeout(done, Math.max(50, dur*1000+100));
  }

  playTone({ freq=220, dur=0.1, type='sine', gain=0.03, bus='sfx', slideTo=null, detune=0 }) {
    if (!this._canSfx()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; if (detune) o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.buses[bus] || this.buses.sfx);
    o.start(t); o.stop(t + dur + 0.02);
    this._trackSfx(o, dur);
  }

  playNoise({ dur=0.2, gain=0.02, bus='sfx', hp=400, lp=4000, pan=0, when=0 }) {
    if (!this._canSfx()) return;
    const t = this.ctx.currentTime + (when||0);
    const src = this.ctx.createBufferSource(); src.buffer = this._pinkBuf || this._noiseBuf;
    const g = this.ctx.createGain();
    const hpf = this.ctx.createBiquadFilter(); hpf.type='highpass'; hpf.frequency.value=hp;
    const lpf = this.ctx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=lp;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001,gain), t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.connect(hpf); hpf.connect(lpf); lpf.connect(g);
    let out = g;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan,-1,1); g.connect(p); out=p; }
    out.connect(this.buses[bus] || this.buses.sfx);
    src.start(t); src.stop(t+dur+0.02);
    this._trackSfx(src, dur);
  }

  playSpatial({ pos, freq=220, dur=0.15, type='sine', gain=0.04, bus='sfx', slideTo=null, noise=false, hp=300, lp=5000 }) {
    if (!this._canSfx() || !pos) return;
    const t = this.ctx.currentTime;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 2; panner.maxDistance = 35; panner.rolloffFactor = 1.2;
    panner.positionX ? (panner.positionX.value=pos.x, panner.positionY.value=pos.y||1, panner.positionZ.value=pos.z) : panner.setPosition(pos.x,pos.y||1,pos.z);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,gain), t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    let src;
    if (noise) {
      src = this.ctx.createBufferSource(); src.buffer = this._pinkBuf||this._noiseBuf;
      const hpf = this.ctx.createBiquadFilter(); hpf.type='highpass'; hpf.frequency.value=hp;
      const lpf = this.ctx.createBiquadFilter(); lpf.type='lowpass'; lpf.frequency.value=lp;
      src.connect(hpf); hpf.connect(lpf); lpf.connect(g);
    } else {
      src = this.ctx.createOscillator(); src.type=type; src.frequency.value=freq;
      if (slideTo) src.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo), t+dur);
      src.connect(g);
    }
    g.connect(panner); panner.connect(this.buses[bus] || this.buses.sfx);
    src.start(t); src.stop(t+dur+0.03);
    this._trackSfx(src, dur);
  }

  // ---- High level events ----
  playSfx(freq=220, dur=0.08, type='square', gain=0.03) { this.playTone({freq,dur,type,gain,bus:'sfx'}); }

  onPlayerStep(isRun=false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this._lastStep < (isRun ? 0.28 : 0.42)) return;
    this._lastStep = now;
    this.playNoise({ dur:isRun?0.05:0.07, gain:isRun?0.025:0.018, bus:'sfx', hp:120, lp:isRun?2200:1600 });
  }

  onZombieStep(pos, isRun=false) {
    if (!this.ctx || !pos) return;
    this.playSpatial({ pos, dur:isRun?0.06:0.08, gain:isRun?0.018:0.012, bus:'sfx', noise:true, hp:80, lp:1200 });
  }

  onZombieGroan(pos, kind='idle') {
    if (!this.ctx || !pos) return;
    const base = kind==='chase'? 110 : kind==='attack'? 90 : 140;
    this.playSpatial({ pos, freq:base+Math.random()*30, slideTo:base*0.7, dur:0.35+Math.random()*0.25, type:'sawtooth', gain:kind==='chase'?0.03:0.02, bus:'voice' });
  }

  onPlayerAttack(isSpecial=false) {
    if (isSpecial) { this.playTone({freq:140,dur:0.12,type:'sawtooth',gain:0.035}); this.playNoise({dur:0.12,gain:0.02,hp:300,lp:2500}); }
    else { this.playTone({freq:220,dur:0.06,type:'square',gain:0.02}); }
  }
  onHit() { this.playTone({freq:120,dur:0.08,type:'triangle',gain:0.035}); this.playNoise({dur:0.06,gain:0.015,hp:200,lp:3000}); }
  onKill(pos) { this.playTone({freq:90,dur:0.2,type:'sawtooth',gain:0.03,slideTo:50}); if(pos) this.playSpatial({pos,dur:0.25,gain:0.02,noise:true,hp:100,lp:1200,bus:'voice'}); }
  onPlayerDamage() { this.playTone({freq:180,dur:0.12,type:'square',gain:0.03,slideTo:90}); this.playNoise({dur:0.08,gain:0.02,hp:200,lp:1800}); }
  onEquip() { this.playTone({freq:420,dur:0.05,type:'triangle',gain:0.015}); this.playTone({freq:560,dur:0.06,type:'triangle',gain:0.012,when:0}); }
  onInteract() { this.playTone({freq:520,dur:0.05,type:'sine',gain:0.015}); }
  onUIClick() { this.playTone({freq:660,dur:0.03,type:'sine',gain:0.008,bus:'sfx'}); }
  onMissionComplete() { [523,659,784].forEach((f,i)=>this.playTone({freq:f,dur:0.18,type:'sine',gain:0.02,bus:'music'})); }
  onNpcDialog() { this.playTone({freq:320,dur:0.06,type:'triangle',gain:0.01,bus:'voice'}); }

  // ---- Ambient ----
  _startAmbient() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0.6; out.connect(this.buses.ambient);
    // wind
    const windSrc = ctx.createBufferSource(); windSrc.buffer = this._pinkBuf; windSrc.loop = true;
    const windLp = ctx.createBiquadFilter(); windLp.type='lowpass'; windLp.frequency.value = 900;
    const windG = ctx.createGain(); windG.gain.value = 0.22;
    windSrc.connect(windLp); windLp.connect(windG); windG.connect(out); windSrc.start();
    // low rumble
    const rum = ctx.createOscillator(); rum.type='sine'; rum.frequency.value = 45;
    const rumG = ctx.createGain(); rumG.gain.value = 0.012; rum.connect(rumG); rumG.connect(out); rum.start();
    this._ambient.nodes = { out, windSrc, windLp, windG, rum, rumG };
  }

  _startRain() {
    if (!this.ctx || this._ambient.rainNodes) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.buses.ambient);
    src.start();
    this._ambient.rainNodes = { src, hp, lp, g };
  }
  _stopRain() {
    const n = this._ambient.rainNodes; if (!n) return;
    try { n.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2); n.src.stop(this.ctx.currentTime+1); } catch(_) {}
    this._ambient.rainNodes = null;
  }

  // ---- Music ----
  _startMusic() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const mk = (freq, type, gain) => { const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq; const g=ctx.createGain(); g.gain.value=gain; o.connect(g); g.connect(this.buses.music); o.start(); return {o,g}; };
    const pad1 = mk(110, 'sine', 0.015);
    const pad2 = mk(165, 'triangle', 0.008);
    const bass = mk(55, 'sine', 0.012);
    this._music.nodes = { pad1, pad2, bass };
  }

  setMusicState(state) { // explore | tension | combat
    if (['explore','tension','combat'].includes(state)) this._music.target = state;
  }

  _updateMusic(dt, dangerLevel=0) {
    if (!this.ctx || !this._music.nodes) return;
    const t = this.ctx.currentTime;
    let target = this._music.target;
    if (dangerLevel > 0.6) target = 'combat';
    else if (dangerLevel > 0.2) target = 'tension';
    this._music.state = target;
    const n = this._music.nodes;
    if (target === 'explore') {
      n.pad1.o.frequency.setTargetAtTime(110, t, 0.5); n.pad1.g.gain.setTargetAtTime(0.015, t, 0.5);
      n.pad2.o.frequency.setTargetAtTime(165, t, 0.5); n.pad2.g.gain.setTargetAtTime(0.008, t, 0.5);
      n.bass.g.gain.setTargetAtTime(0.008, t, 0.5);
    } else if (target === 'tension') {
      n.pad1.o.frequency.setTargetAtTime(116.5, t, 0.3); n.pad1.g.gain.setTargetAtTime(0.018, t, 0.3);
      n.pad2.o.frequency.setTargetAtTime(174.6, t, 0.3); n.pad2.g.gain.setTargetAtTime(0.012, t, 0.3);
      n.bass.g.gain.setTargetAtTime(0.015, t, 0.3);
    } else {
      n.pad1.o.frequency.setTargetAtTime(130.8, t, 0.15); n.pad1.g.gain.setTargetAtTime(0.022, t, 0.15);
      n.pad2.o.frequency.setTargetAtTime(196, t, 0.15); n.pad2.g.gain.setTargetAtTime(0.015, t, 0.15);
      n.bass.g.gain.setTargetAtTime(0.02, t, 0.15);
    }
  }

  update(dt, ctx = {}) {
    if (!this.ctx || !this.started) return;
    const { camera, playerPos, weather, dangerLevel=0, inInterior=false } = ctx;
    this.updateListener(camera, playerPos);

    // ambient rain
    const isRain = weather === 'chuva' || weather === 'tempestade' || weather === 'light_rain' || weather === 'heavy_rain' || weather === 'storm';
    const isStorm = weather === 'tempestade' || weather === 'heavy_rain' || weather === 'storm';
    if (isRain) {
      this._startRain();
      const g = this._ambient.rainNodes?.g;
      if (g) g.gain.setTargetAtTime(isStorm ? 0.12 : 0.07, this.ctx.currentTime, 0.4);
    } else this._stopRain();

    // wind/tension adjustments
    if (this._ambient.nodes) {
      const windTarget = inInterior ? 0.05 : 0.22;
      this._ambient.nodes.windG.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.5);
      this._ambient.nodes.windLp.frequency.setTargetAtTime(inInterior ? 450 : 900, this.ctx.currentTime, 0.5);
      this._ambient.nodes.rumG.gain.setTargetAtTime(0.01 + dangerLevel*0.015, this.ctx.currentTime, 0.5);
    }

    this._updateMusic(dt, dangerLevel);
  }

  dispose() {
    try { this.ctx?.close(); } catch(_) {}
    this.ctx = null; this.started = false;
  }
}
