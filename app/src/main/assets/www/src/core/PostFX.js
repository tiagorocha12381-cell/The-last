import * as THREE from 'three';

/**
 * Pós-processamento cinematográfico leve (sem dependências externas).
 *
 * Pipeline: cena -> HDR RT -> bright pass -> blur H/V -> composite
 * O composite aplica: bloom, aberração cromática sutil, vignette,
 * grain, saturação e color grading teal/laranja. O tone mapping ACES
 * e a conversão para sRGB são feitos pelos chunks oficiais do Three,
 * exatamente como no render direto (nada é aplicado duas vezes).
 *
 * No preset "mobile" o módulo fica DESLIGADO e o Engine renderiza
 * direto — economia real de GPU em Android.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float threshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(max(c.r, c.g), c.b);
    float k = max(l - threshold, 0.0) / max(l, 1e-4);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 dir;
  varying vec2 vUv;
  void main() {
    vec3 s = vec3(0.0);
    s += texture2D(tDiffuse, vUv + dir * -4.0).rgb * 0.051;
    s += texture2D(tDiffuse, vUv + dir * -3.0).rgb * 0.0918;
    s += texture2D(tDiffuse, vUv + dir * -2.0).rgb * 0.12245;
    s += texture2D(tDiffuse, vUv + dir * -1.0).rgb * 0.1531;
    s += texture2D(tDiffuse, vUv).rgb * 0.1633;
    s += texture2D(tDiffuse, vUv + dir *  1.0).rgb * 0.1531;
    s += texture2D(tDiffuse, vUv + dir *  2.0).rgb * 0.12245;
    s += texture2D(tDiffuse, vUv + dir *  3.0).rgb * 0.0918;
    s += texture2D(tDiffuse, vUv + dir *  4.0).rgb * 0.051;
    gl_FragColor = vec4(s, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tBase;
  uniform sampler2D tBloom;
  uniform float bloomStrength;
  uniform float vignette;
  uniform float grain;
  uniform float aberration;
  uniform float saturation;
  uniform float time;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 d = vUv - 0.5;
    float r2 = dot(d, d);

    // aberração cromática: quase zero no centro, visível nas bordas
    float ab = aberration * (0.25 + r2 * 2.2);
    vec3 col = vec3(
      texture2D(tBase, vUv + d * ab).r,
      texture2D(tBase, vUv).g,
      texture2D(tBase, vUv - d * ab).b
    );

    col += texture2D(tBloom, vUv).rgb * bloomStrength;

    // color grading teal/laranja (opera em espaço linear)
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, saturation);
    col += vec3(-0.008, 0.002, 0.012) * (1.0 - smoothstep(0.0, 0.35, l));
    col += vec3(0.014, 0.004, -0.008) * smoothstep(0.5, 1.2, l);

    // vignette + grain
    col *= 1.0 - vignette * smoothstep(0.12, 0.78, r2);
    col += (hash(vUv + fract(time) * vec2(0.137, 0.719)) - 0.5) * grain;

    gl_FragColor = vec4(max(col, 0.0), 1.0);

    // mesmos chunks usados pelo render normal do Three.js
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;
    this.time = 0;
    this.settings = {
      bloomStrength: 0.85,
      threshold: 0.82,
      vignette: 0.34,
      grain: 0.016,
      aberration: 0.0016,
      saturation: 1.05,
    };

    this._scene = new THREE.Scene();
    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._geo = new THREE.PlaneGeometry(2, 2);

    this._matBright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: this.settings.threshold } },
      vertexShader: VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false,
    });
    this._matBlur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
    });
    this._matFinal = new THREE.ShaderMaterial({
      uniforms: {
        tBase: { value: null }, tBloom: { value: null },
        bloomStrength: { value: this.settings.bloomStrength },
        vignette: { value: this.settings.vignette },
        grain: { value: this.settings.grain },
        aberration: { value: this.settings.aberration },
        saturation: { value: this.settings.saturation },
        time: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
    });

    this._quad = new THREE.Mesh(this._geo, this._matBright);
    this._quad.frustumCulled = false;
    this._scene.add(this._quad);

    this._targets = null;
    this.setSize();
  }

  _rt(w, h, depth) {
    const type = this.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    return new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type,
      depthBuffer: !!depth,
      stencilBuffer: false,
    });
  }

  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, Math.floor(size.x || window.innerWidth || 1));
    const h = Math.max(2, Math.floor(size.y || window.innerHeight || 1));
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    if (this._targets) {
      this._targets.base.dispose();
      this._targets.bright.dispose();
      this._targets.tmp.dispose();
      this._targets.blur.dispose();
    }
    this._targets = {
      base: this._rt(w, h, true),
      bright: this._rt(hw, hh, false),
      tmp: this._rt(hw, hh, false),
      blur: this._rt(hw, hh, false),
    };
  }

  setQuality(name) {
    const prev = this.enabled;
    this.enabled = (name !== 'mobile');
    const s = this.settings;
    if (name === 'high') {
      s.bloomStrength = 0.95; s.vignette = 0.36; s.grain = 0.018; s.aberration = 0.0019; s.saturation = 1.06;
    } else if (name === 'medium') {
      s.bloomStrength = 0.78; s.vignette = 0.32; s.grain = 0.012; s.aberration = 0.0012; s.saturation = 1.04;
    }
    this._matFinal.uniforms.bloomStrength.value = s.bloomStrength;
    this._matFinal.uniforms.vignette.value = s.vignette;
    this._matFinal.uniforms.grain.value = s.grain;
    this._matFinal.uniforms.aberration.value = s.aberration;
    this._matFinal.uniforms.saturation.value = s.saturation;
    this._matBright.uniforms.threshold.value = s.threshold;
    if (prev !== this.enabled) this.setSize();
  }

  _pass(material, target) {
    this._quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(this._scene, this._cam);
  }

  render(dt) {
    if (!this.enabled || !this._targets) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    try {
      this.time += dt || 0;
      const t = this._targets;

      // 1) cena em RT linear (tone mapping é aplicado só no composite)
      this.renderer.setRenderTarget(t.base);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);

      // 2) bright pass + blur separável (meia resolução)
      this._matBright.uniforms.tDiffuse.value = t.base.texture;
      this._pass(this._matBright, t.bright);

      this._matBlur.uniforms.tDiffuse.value = t.bright.texture;
      this._matBlur.uniforms.dir.value.set(1 / t.bright.width, 0);
      this._pass(this._matBlur, t.tmp);

      this._matBlur.uniforms.tDiffuse.value = t.tmp.texture;
      this._matBlur.uniforms.dir.value.set(0, 1 / t.bright.height);
      this._pass(this._matBlur, t.blur);

      // 3) composite final na tela
      this._matFinal.uniforms.tBase.value = t.base.texture;
      this._matFinal.uniforms.tBloom.value = t.blur.texture;
      this._matFinal.uniforms.time.value = this.time;
      this._quad.material = this._matFinal;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this._scene, this._cam);
    } catch (err) {
      // fallback seguro: se o pós-processamento falhar, o jogo continua
      console.warn('[PostFX] falha, voltando ao render direto:', err);
      this.enabled = false;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this._targets) {
      Object.keys(this._targets).forEach(k => this._targets[k].dispose());
      this._targets = null;
    }
    [this._matBright, this._matBlur, this._matFinal].forEach(m => m.dispose());
    this._geo.dispose();
  }
}
