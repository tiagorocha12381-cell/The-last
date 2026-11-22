import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Zombie, ZOMBIE_TYPES } from '../enemies/Zombie.js?v=etapa14';

export class EnemyManager {
  constructor(scene, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.loader = new GLTFLoader();
    this.templates = [];
    this.zombies = [];
    this.maxActive = 8;
    this.spawnRadius = 55;
    this.despawnRadius = 75;
    this.minPlayerSpawnDist = 18;
    this.spawnPoints = this._buildSpawnPoints();
    this.spawnCooldown = 0;
    this.enabled = true;
    this.onPlayerDamage = null;
    this._attackTokens = new Map(); // zombieId -> time
    this._frame = 0;
  }

  async load(onProgress) {
    const files = [
      { file: 'assets/models/enemies/Zombie_Male.glb', name: 'male' },
      { file: 'assets/models/enemies/Zombie_Female.glb', name: 'female' },
    ];
    let done = 0;
    for (const f of files) {
      try {
        const gltf = await this._loadGLTF(f.file);
        this.templates.push({ scene: gltf.scene, animations: gltf.animations || [], name: f.name });
      } catch (e) {
        console.warn('Falha ao carregar modelo de zumbi:', f.file, e);
      }
      done++;
      onProgress?.((done / files.length) * 100, `Carregando inimigos (${done}/${files.length})`);
    }
  }

  _loadGLTF(url) { return new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject)); }

  _buildSpawnPoints() {
    const pts = [
      // streets / open
      { pos: [-25, 0.18, -25], type: 'common', role: 'roam' },
      { pos: [25, 0.18, -28], type: 'errant', role: 'roam' },
      { pos: [-30, 0.18, 20], type: 'agile', role: 'roam' },
      { pos: [28, 0.18, 25], type: 'common', role: 'roam' },
      { pos: [-15, 0.18, 35], type: 'errant', role: 'roam' },
      { pos: [15, 0.18, 35], type: 'resistant', role: 'roam' },
      { pos: [35, 0.18, -5], type: 'aggressive', role: 'roam' },
      { pos: [-35, 0.18, -5], type: 'agile', role: 'roam' },
      { pos: [0, 0.18, -38], type: 'resistant', role: 'guard' },
      { pos: [-20, 0.18, -40], type: 'errant', role: 'roam' },
      { pos: [20, 0.18, 40], type: 'common', role: 'roam' },
      { pos: [-40, 0.18, 10], type: 'errant', role: 'guard' },
      { pos: [40, 0.18, -15], type: 'agile', role: 'roam' },
      { pos: [10, 0.18, -45], type: 'aggressive', role: 'guard' },
      // near buildings/interiors-ish spots (outside collision boxes, but feel like abandoned areas)
      { pos: [-8, 0.18, -18], type: 'common', role: 'guard' },
      { pos: [12, 0.18, -12], type: 'aggressive', role: 'guard' },
      { pos: [-18, 0.18, 8], type: 'resistant', role: 'guard' },
      { pos: [18, 0.18, 14], type: 'errant', role: 'guard' },
    ];
    return pts.map((p, i) => ({ ...p, id: i, occupiedBy: null, cooldown: Math.random() * 3 }));
  }

  _pickTemplate() { return this.templates.length ? this.templates[Math.floor(Math.random() * this.templates.length)] : null; }

  _canSpawnAt(pos, playerPos) {
    if (pos.distanceTo(playerPos) < this.minPlayerSpawnDist) return false;
    for (const b of this.collisions.boxes) {
      if (b.enabled === false) continue;
      if (pos.x > b.min.x - 0.5 && pos.x < b.max.x + 0.5 && pos.z > b.min.z - 0.5 && pos.z < b.max.z + 0.5) return false;
    }
    return true;
  }

  _spawn(spawnPoint, playerPos) {
    if (this.zombies.length >= this.maxActive) return null;
    const tpl = this._pickTemplate(); if (!tpl) return null;
    const pos = new THREE.Vector3(spawnPoint.pos[0], spawnPoint.pos[1], spawnPoint.pos[2]);
    if (!this._canSpawnAt(pos, playerPos)) return null;
    const type = spawnPoint.type || 'common';
    const z = new Zombie({ scene: this.scene, collisions: this.collisions, modelTemplate: tpl.scene, animations: tpl.animations, type, position: pos, spawnPos: pos.clone(), role: spawnPoint.role || 'roam' });
    z.spawnPointId = spawnPoint.id;
    z._id = `${spawnPoint.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    z._acc = 0;
    spawnPoint.occupiedBy = z;
    this.zombies.push(z);
    return z;
  }

  spawnEventZombie(pos, type='common', opts={}) {
    if (this.zombies.length >= this.maxActive + 2) return null;
    const tpl = this._pickTemplate(); if (!tpl) return null;
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y||0.18, pos.z);
    p.y = 0.18;
    const z = new Zombie({ scene: this.scene, collisions: this.collisions, modelTemplate: tpl.scene, animations: tpl.animations, type, position: p, spawnPos: p.clone(), role: opts.role || 'roam' });
    z._id = `ev_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    z._acc = 0;
    z.eventTag = opts.tag || null;
    z.eventTtl = opts.ttl ?? 60;
    this.zombies.push(z);
    return z;
  }

  emitNoise(pos, strength = 10, kind = 'noise') {
    if (!pos) return;
    const now = performance.now();
    const p = pos.isVector3 ? pos : new THREE.Vector3(pos.x, pos.y || 0, pos.z);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (z.group.position.distanceToSquared(p) > (strength * strength * 1.2)) continue;
      z.hearStimulus({ pos: p, strength, kind }, now);
    }
  }

  update(dt, player, nowMs) {
    if (!this.enabled) return;
    const playerPos = player.position;
    const now = nowMs || performance.now();
    this._frame++;

    // attack token cleanup (limit simultaneous attackers near player)
    for (const [id, t] of this._attackTokens) { if (now - t > 900) this._attackTokens.delete(id); }

    // precompute nearby attacker counts cheaply
    const attackerCount = new Map();
    for (const z of this.zombies) {
      if (!z.alive) continue;
      if (z.state === 'attack' || z.state === 'chase') {
        const key = Math.floor(z.group.position.x/3)+','+Math.floor(z.group.position.z/3);
        attackerCount.set(key, (attackerCount.get(key)||0)+1);
      }
    }

    // separation pass (lightweight, only for alive zombies)
    for (let i = 0; i < this.zombies.length; i++) {
      const z = this.zombies[i];
      if (!z.alive) continue;
      // check only a few neighbors
      z.applySeparation(this.zombies);
    }

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const d = z.distanceTo(playerPos);
      if (z.eventTtl != null) {
        z.eventTtl -= dt;
        if (z.eventTtl <= 0 && z.state !== 'chase' && z.state !== 'attack' && z.state !== 'suspicious' && z.state !== 'investigate' && z.state !== 'search') { this._removeZombie(i); continue; }
      }
      if (!z.eventTag && d > this.despawnRadius && z.state !== 'chase' && z.state !== 'attack' && z.state !== 'search' && z.state !== 'investigate' && z.state !== 'suspicious') {
        this._removeZombie(i);
        continue;
      }

      // staggered updates for distant AI
      z._acc = (z._acc || 0) + dt;
      let step = dt;
      if (d > 40) { if (z._acc < 0.25) continue; step = Math.min(z._acc, 0.35); z._acc = 0; }
      else if (d > 25) { if (z._acc < 0.12) continue; step = Math.min(z._acc, 0.2); z._acc = 0; }
      else { step = z._acc; z._acc = 0; }

      const key = Math.floor(z.group.position.x/3)+','+Math.floor(z.group.position.z/3);
      const nearbyAttackers = attackerCount.get(key) || 0;
      const canAttackToken = (zz) => {
        // allow limited simultaneous attacks
        const active = Array.from(this._attackTokens.values()).filter(t => now - t < 900).length;
        if (active >= 2 && !this._attackTokens.has(zz._id)) return false;
        this._attackTokens.set(zz._id, now);
        return true;
      };
      z.update(step, player, now, { nearbyAttackers, canAttackToken });
      if (z.shouldRemove) this._removeZombie(i);
    }

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnCooldown = 1.5;
      this._trySpawn(playerPos);
    }
  }

  _trySpawn(playerPos) {
    if (this.zombies.length >= this.maxActive) return;
    const candidates = this.spawnPoints.filter((sp) => {
      if (sp.occupiedBy) return false;
      const p = new THREE.Vector3(sp.pos[0], sp.pos[1], sp.pos[2]);
      const d = p.distanceTo(playerPos);
      return d >= this.minPlayerSpawnDist && d <= this.spawnRadius;
    });
    if (!candidates.length) return;
    const sp = candidates[Math.floor(Math.random() * candidates.length)];
    this._spawn(sp, playerPos);
  }

  _removeZombie(index) {
    const z = this.zombies[index];
    if (z.spawnPointId != null) {
      const sp = this.spawnPoints.find((s) => s.id === z.spawnPointId);
      if (sp) { sp.occupiedBy = null; sp.cooldown = 4 + Math.random() * 6; }
    }
    if (z._id) this._attackTokens.delete(z._id);
    z.dispose();
    this.zombies.splice(index, 1);
  }

  getTargetsInFront(playerPos, yaw, maxDist = 2.2, maxAngle = Math.PI * 0.35) {
    const out = [];
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const dx = z.group.position.x - playerPos.x;
      const dz = z.group.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist) continue;
      const dot = (dx / Math.max(d,0.001)) * fx + (dz / Math.max(d,0.001)) * fz;
      const ang = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      if (ang > maxAngle) continue;
      out.push({ z, d });
    }
    out.sort((a,b)=>a.d-b.d);
    return out.map(o=>o.z);
  }

  playerAttack(player, opts = {}) {
    const damage = opts.damage ?? 25;
    const range = opts.range ?? 2.3;
    const isSpecial = !!opts.isSpecial;
    const angle = isSpecial ? Math.PI * 0.55 : Math.PI * 0.4;
    const targets = this.getTargetsInFront(player.position, player.yaw, range, angle);
    if (!targets.length) return { hit: false, kills: 0, hits: 0, hitPositions: [] };
    const hitTargets = isSpecial ? targets.slice(0, 3) : targets.slice(0, 1);
    let kills = 0;
    const hitPositions = [];
    for (const t of hitTargets) {
      const killed = t.takeDamage(damage);
      if (killed) kills++;
      const p = t.group.position.clone(); p.y += 1.0; hitPositions.push(p);
      // hit noise alerts nearby zombies
      this.emitNoise(t.group.position, 8, 'combat');
    }
    return { hit: true, kills, hits: hitTargets.length, type: hitTargets[0].typeDef.label, hitPositions };
  }

  getActiveCount() { return this.zombies.length; }
}
