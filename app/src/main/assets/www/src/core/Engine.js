import * as THREE from 'three';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';
import { PostFX } from './PostFX.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityName = GAME_CONFIG.quality || 'medium';
    this.quality = QUALITY_PRESETS[this.qualityName] || QUALITY_PRESETS.medium;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      GAME_CONFIG.camera.near,
      GAME_CONFIG.camera.far
    );
    this.camera.position.set(0, 5, 10);

    const mobilePreset = this.qualityName === 'mobile';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobilePreset,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = !!this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.quality.toneExposure ?? 1.08;

    // Pós-processamento cinematográfico (desligado no preset mobile).
    // Criado com try/catch: qualquer falha mantém o render direto.
    try {
      this.postFX = new PostFX(this.renderer, this.scene, this.camera);
      this.postFX.setQuality(this.qualityName);
    } catch (e) {
      console.warn('[Engine] pós-processamento indisponível, render direto:', e);
      this.postFX = null;
    }

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this._raf = 0;
    this._running = false;
    this._updateFn = null;
    this.fpsLimit = 0;
    this._fpsAcc = 0;

    this.onResize = this.onResize.bind(this);
    this._onOrientation = () => setTimeout(this.onResize, 50);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this._onOrientation);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onResize);
  }

  getMaxAnisotropy() {
    try { return Math.min(this.quality.anisotropy || 4, this.renderer.capabilities.getMaxAnisotropy?.() || 1); }
    catch { return 1; }
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.postFX) this.postFX.setSize();
  }

  start(updateFn) {
    this._updateFn = updateFn;
    if (this._running) return;
    this._running = true;
    this.clock.start();
    const loop = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      if (this.fpsLimit > 0) {
        this._fpsAcc += dt;
        const frame = 1 / this.fpsLimit;
        if (this._fpsAcc < frame) return;
        this._fpsAcc = Math.min(this._fpsAcc - frame, frame * 2);
      }
      this.elapsed += dt;
      this._updateFn?.(dt, this.elapsed);
      if (this.postFX && this.postFX.enabled !== false) this.postFX.render(dt);
      else this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this._onOrientation);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this.onResize);
    if (this.postFX) this.postFX.dispose();
    this.renderer.dispose();
  }
}