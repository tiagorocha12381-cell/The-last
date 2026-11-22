import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';

export class AssetLoader {
  constructor(renderer) {
    this.renderer = renderer;
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this._cache = new Map();
  }

  _anisotropy() {
    const preset = QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium;
    const cap = this.renderer.capabilities.getMaxAnisotropy?.() || 1;
    return Math.min(preset.anisotropy ?? 4, cap);
  }

  loadTexture(url, { srgb = true, repeatX = 1, repeatY = 1 } = {}) {
    const key = `tex:${url}:${srgb}:${repeatX}:${repeatY}`;
    if (this._cache.has(key)) return Promise.resolve(this._cache.get(key));
    return new Promise((resolve, reject) => {
      this.textureLoader.load(url, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this._anisotropy();
        this._cache.set(key, tex);
        resolve(tex);
      }, undefined, reject);
    });
  }

  loadGLTF(url) {
    const key = `gltf:${url}`;
    if (this._cache.has(key)) return Promise.resolve(this._cache.get(key).scene.clone(true));
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => {
        this._cache.set(key, gltf);
        resolve(gltf.scene.clone(true));
      }, undefined, reject);
    });
  }
}
