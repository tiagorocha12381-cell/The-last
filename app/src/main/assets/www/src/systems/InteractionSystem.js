import * as THREE from 'three';

export class InteractionSystem {
  constructor(scene) {
    this.scene = scene;
    this.interactables = [];
    this.current = null;
    this.prompt = '';
    this.onMessage = null; // (text) => void
    this.marker = this._createMarker();
    this.scene.add(this.marker);
  }

  _createMarker() {
    const geo = new THREE.RingGeometry(0.35, 0.45, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd96b4b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 10;
    return m;
  }

  register(def) {
    const entry = {
      id: def.id || `int_${this.interactables.length}_${Math.random().toString(36).slice(2,7)}`,
      type: def.type || 'generic',
      name: def.name || 'Objeto',
      description: def.description || '',
      position: def.position ? def.position.clone() : new THREE.Vector3(),
      getPosition: def.getPosition || null,
      radius: def.radius ?? 2.0,
      enabled: def.enabled !== false,
      onInteract: def.onInteract || (() => ({ message: def.description || def.name })),
      promptLabel: def.promptLabel || def.name || 'Interagir',
      data: def.data || null,
    };
    this.interactables.push(entry);
    return entry;
  }

  unregister(id) {
    const i = this.interactables.findIndex((x) => x.id === id);
    if (i >= 0) {
      if (this.current === this.interactables[i]) this.current = null;
      this.interactables.splice(i, 1);
    }
  }

  setEnabled(id, enabled) {
    const it = this.interactables.find((x) => x.id === id);
    if (it) it.enabled = enabled;
  }

  getPosition(entry) {
    return entry.getPosition ? entry.getPosition() : entry.position;
  }

  update(playerPos) {
    let best = null;
    let bestDist = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled) continue;
      const p = this.getPosition(it);
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d <= it.radius && d < bestDist) { best = it; bestDist = d; }
    }
    this.current = best;
    if (best) {
      const p = this.getPosition(best);
      this.marker.visible = true;
      this.marker.position.set(p.x, 0.22, p.z);
      this.marker.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.05);
      this.prompt = `[E] ${best.promptLabel}`;
    } else {
      this.marker.visible = false;
      this.prompt = '';
    }
    return this.current;
  }

  interact(player, context) {
    if (!this.current) return null;
    const result = this.current.onInteract(player, context, this.current) || {};
    if (result.message && !String(result.message).startsWith('__')) this.onMessage?.(result.message);
    if (result.remove) {
      this.unregister(this.current.id);
      this.current = null;
      this.marker.visible = false;
      this.prompt = '';
    }
    return result;
  }

  getPrompt() { return this.prompt; }
  clearPrompt() { this.prompt = ''; this.current = null; if (this.marker) this.marker.visible = false; }
}
