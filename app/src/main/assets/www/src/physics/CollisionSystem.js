import * as THREE from 'three';

export class CollisionSystem {
  constructor() {
    this.boxes = []; // { min, max, enabled }
  }

  addBoxFromObject(obj, padding = 0) {
    const box = new THREE.Box3().setFromObject(obj);
    box.min.x -= padding; box.min.z -= padding;
    box.max.x += padding; box.max.z += padding;
    return this.addBox(box.min, box.max);
  }

  addBox(min, max) {
    const entry = { min: min.clone(), max: max.clone(), enabled: true };
    this.boxes.push(entry);
    return entry;
  }

  removeBox(entry) {
    if (!entry) return;
    const i = this.boxes.indexOf(entry);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  setBoxEnabled(entry, enabled) {
    if (entry) entry.enabled = !!enabled;
  }

  resolveCircle(pos, radius) {
    for (let iter = 0; iter < 4; iter++) {
      for (const b of this.boxes) {
        if (b.enabled === false) continue;
        const closestX = Math.max(b.min.x, Math.min(pos.x, b.max.x));
        const closestZ = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < radius * radius && distSq > 0.000001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else if (distSq <= 0.000001) {
          const left = pos.x - b.min.x;
          const right = b.max.x - pos.x;
          const back = pos.z - b.min.z;
          const front = b.max.z - pos.z;
          const minPen = Math.min(left, right, back, front);
          if (minPen === left) pos.x = b.min.x - radius;
          else if (minPen === right) pos.x = b.max.x + radius;
          else if (minPen === back) pos.z = b.min.z - radius;
          else pos.z = b.max.z + radius;
        }
      }
    }
  }

  // Simple 2D segment vs AABB test at a sample height. Returns true if blocked.
  segmentBlocked(from, to, y = 1.0) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) return false;
    for (const b of this.boxes) {
      if (b.enabled === false) continue;
      if (y < b.min.y || y > b.max.y) continue;
      // slab test in XZ
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 0.0001) { if (from.x < b.min.x || from.x > b.max.x) continue; }
      else { const inv = 1 / dx; let t1 = (b.min.x - from.x) * inv, t2 = (b.max.x - from.x) * inv; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
      if (Math.abs(dz) < 0.0001) { if (from.z < b.min.z || from.z > b.max.z) continue; }
      else { const inv = 1 / dz; let t1 = (b.min.z - from.z) * inv, t2 = (b.max.z - from.z) * inv; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
      return true;
    }
    return false;
  }
}
