import * as THREE from 'three';
import { GAME_CONFIG, QUALITY_PRESETS } from '../config/constants.js';

function radialGradTexture() {
  const w = 256, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
  g.addColorStop(0, 'rgba(255,235,185,1)');
  g.addColorStop(0.45, 'rgba(255,235,185,0.6)');
  g.addColorStop(0.7, 'rgba(255,235,185,0.15)');
  g.addColorStop(1, 'rgba(255,235,185,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Environment {
  constructor(scene, camera = null) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'Environment';
    this.scene.add(this.group);
    this._build();
  }

  _build() {
    const cfg = GAME_CONFIG.world;
    const preset = QUALITY_PRESETS[GAME_CONFIG.quality] || QUALITY_PRESETS.medium;
    this.baseFogNear = preset.fogNear ?? cfg.fogNear;
    this.baseFogFar = preset.fogFar ?? cfg.fogFar;

    this.scene.background = new THREE.Color(cfg.skyHorizon);
    this.scene.fog = new THREE.Fog(cfg.fogColor, this.baseFogNear, this.baseFogFar);

    const skyGeo = new THREE.SphereGeometry(320, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(cfg.skyTop) },
        horizon: { value: new THREE.Color(cfg.skyHorizon) },
        bottom: { value: new THREE.Color(cfg.skyBottom) },
        sunDir: { value: new THREE.Vector3(cfg.sunPosition.x, cfg.sunPosition.y, cfg.sunPosition.z).normalize() },
        sunColor: { value: new THREE.Color(cfg.sunColor) },
        sunGlow: { value: 0.45 },
        horizonGlow: { value: 0.08 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor;
        uniform float sunGlow; uniform float horizonGlow;
        varying vec3 vPos;
        void main() {
          vec3 dir = normalize(vPos);
          float h = dir.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.62)) : mix(horizon, bottom, pow(-h, 0.7));
          float sun = max(dot(dir, normalize(sunDir)), 0.0);
          col += sunColor * pow(sun, 64.0) * sunGlow;
          col += sunColor * pow(sun, 8.0) * horizonGlow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.group.add(this.skyMesh);

    this.hemi = new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.ambientIntensity);
    this.group.add(this.hemi);

    this.sun = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    this.sun.position.set(cfg.sunPosition.x, cfg.sunPosition.y, cfg.sunPosition.z);
    this.sun.castShadow = !!preset.shadows;
    this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    const d = 58;
    this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 170;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.03;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(cfg.fillColor, cfg.fillIntensity);
    this.fill.position.set(-30, 20, -40);
    this.group.add(this.fill);

    this.rim = new THREE.DirectionalLight(0xb7c6d4, 0.18);
    this.rim.position.set(-20, 15, 50);
    this.group.add(this.rim);

    this._sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialGradTexture(),
      color: 0xffd9b0,
      opacity: 0.9,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this._sunGlow.scale.setScalar(6);
    this._sunGlow.position.copy(this.sun.position);
    this.group.add(this._sunGlow);

    this._addLightShafts();
  }

  _addLightShafts() {
    this.shaftMat = new THREE.MeshBasicMaterial({ color: 0xe6d9b0, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide });
    const dir = new THREE.Vector3(GAME_CONFIG.world.sunPosition.x, 0, GAME_CONFIG.world.sunPosition.z).normalize();
    const h = 22;
    for (const [x, z] of [[-24, 0], [16, 10], [-14, -16], [26, -8]]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.9, h, 4), this.shaftMat);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      shaft.position.set(x, 0.5, z).addScaledVector(dir, h / 2);
      this.group.add(shaft);
    }
  }

  applyAtmosphere(s) {
    if (!s) return;
    if (s.skyTop) this.skyMat.uniforms.top.value.set(s.skyTop);
    if (s.skyHorizon) this.skyMat.uniforms.horizon.value.set(s.skyHorizon);
    if (s.skyBottom) this.skyMat.uniforms.bottom.value.set(s.skyBottom);
    if (s.sunDir) this.skyMat.uniforms.sunDir.value.copy(s.sunDir).normalize();
    if (s.sunColor) { this.skyMat.uniforms.sunColor.value.set(s.sunColor); this.sun.color.set(s.sunColor); this._sunGlow.material.color.set(s.sunColor); }
    if (s.sunGlow != null) this.skyMat.uniforms.sunGlow.value = s.sunGlow;
    if (s.horizonGlow != null) this.skyMat.uniforms.horizonGlow.value = s.horizonGlow;
    if (s.sunIntensity != null) this.sun.intensity = s.sunIntensity;
    if (s.ambientIntensity != null) this.hemi.intensity = s.ambientIntensity;
    if (s.hemiSky) this.hemi.color.set(s.hemiSky);
    if (s.hemiGround) this.hemi.groundColor.set(s.hemiGround);
    if (s.fillIntensity != null) this.fill.intensity = s.fillIntensity;
    if (s.fillColor) this.fill.color.set(s.fillColor);
    if (s.rimIntensity != null) this.rim.intensity = s.rimIntensity;
    if (s.fogColor) { this.scene.fog.color.set(s.fogColor); this.scene.background.set(s.fogColor); }
    if (s.fogNear != null) this.scene.fog.near = s.fogNear;
    if (s.fogFar != null) this.scene.fog.far = s.fogFar;
    if (s.sunGlowOpacity != null) this._sunGlow.material.opacity = s.sunGlowOpacity;
    if (s.shaftOpacity != null && this.shaftMat) this.shaftMat.opacity = s.shaftOpacity;
    if (s.exposure != null && this.scene.userData.engine) this.scene.userData.engine.renderer.toneMappingExposure = s.exposure;
  }

  follow(targetPos, camera) {
    this.sun.target.position.copy(targetPos);
    // sun position is controlled by DayNightSystem; only keep target following player
    // but preserve offset from current sun.position relative to target? DayNightSystem sets world offset.
    // We'll keep follow behavior: sun.position = target + offset. Offset stored in this.sunOffset.
    const off = this.sunOffset || GAME_CONFIG.world.sunPosition;
    this.sun.position.set(targetPos.x + off.x, off.y, targetPos.z + off.z);
    if (this._sunGlow) {
      this._sunGlow.position.copy(this.sun.position);
      if (camera) this._sunGlow.quaternion.copy(camera.quaternion);
    }
  }
}
