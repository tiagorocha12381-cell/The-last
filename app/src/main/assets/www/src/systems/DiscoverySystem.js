export class DiscoverySystem {
  constructor(saveSystem, districts) {
    this.saveSystem = saveSystem;
    this.districts = districts;
    this.discoveredPOIs = new Set();
    this.discoveredRegions = new Set();
    this.customPoints = []; // {id,name,pos,radius,discovered,secret,showOnMap,type,desc}
    this.discoveryRadiusMult = 1;
    this.onDiscover = null; // (poi) => void
  }

  applyProgressionBonuses(b = {}) {
    this.discoveryRadiusMult = 1 + Math.max(0, b.discoveryRadius || 0);
  }

  registerPoint(p) {
    const point = {
      id: p.id, name: p.name, pos: p.pos, radius: p.radius || 10,
      discovered: this.discoveredPOIs.has(p.id), secret: !!p.secret,
      showOnMap: p.showOnMap !== false, type: p.type || 'local', desc: p.desc || '',
    };
    this.customPoints.push(point);
    return point;
  }

  init() {
    const save = this.saveSystem.get() || {};
    (save.discoveredPOIs || []).forEach(id => this.discoveredPOIs.add(id));
    (save.discoveredRegions || []).forEach(id => this.discoveredRegions.add(id));
    for (const p of this.districts.getPOIs()) p.discovered = this.discoveredPOIs.has(p.id);
    for (const r of this.districts.getRegions()) r.discovered = this.discoveredRegions.has(r.id);
    for (const p of this.customPoints) p.discovered = this.discoveredPOIs.has(p.id);
  }

  update(playerPos) {
    if (!playerPos) return;
    let changed = false;
    for (const r of this.districts.getRegions()) {
      const dx = playerPos.x - r.center.x, dz = playerPos.z - r.center.z;
      if (Math.hypot(dx,dz) < r.radius + 20 && !this.discoveredRegions.has(r.id)) {
        this.discoveredRegions.add(r.id); r.discovered = true; changed = true;
      }
    }
    for (const p of this.districts.getPOIs()) {
      if (this.discoveredPOIs.has(p.id)) continue;
      const dx = playerPos.x - p.pos.x, dz = playerPos.z - p.pos.z;
      if (Math.hypot(dx,dz) < ((p.radius || 12) * this.discoveryRadiusMult)) {
        this.discoveredPOIs.add(p.id); p.discovered = true; changed = true;
        this.onDiscover?.(p);
      }
    }
    for (const p of this.customPoints) {
      if (this.discoveredPOIs.has(p.id)) continue;
      const dx = playerPos.x - p.pos.x, dz = playerPos.z - p.pos.z;
      if (Math.hypot(dx,dz) < ((p.radius || 10) * this.discoveryRadiusMult)) {
        this.discoveredPOIs.add(p.id); p.discovered = true; changed = true;
        this.onDiscover?.(p);
      }
    }
    if (changed) this._save();
  }

  _save() {
    this.saveSystem.save({
      discoveredPOIs: Array.from(this.discoveredPOIs),
      discoveredRegions: Array.from(this.discoveredRegions)
    });
  }

  isPOIDiscovered(id) { return this.discoveredPOIs.has(id); }
  getCustomPoints() { return this.customPoints; }
}
