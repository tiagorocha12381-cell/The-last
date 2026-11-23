import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { GAME_CONFIG, DIFFICULTY_PRESETS } from '../config/constants.js';

export const ZOMBIE_STATES = {
  IDLE: 'idle',
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  SEARCH: 'search',
  ATTACK: 'attack',
  REPOSITION: 'reposition',
  RETURN: 'return',
  RECOVER: 'recover',
  DEAD: 'dead',
};

export const ZOMBIE_TYPES = {
  common:    { id:'common',    label:'Comum',      hp:60,  speed:1.15, runSpeed:2.2, damage:10, attackRange:1.35, attackCooldown:1.6, detectRange:12, fov:Math.PI*0.72, loseRange:18, scale:1.0,  color:0xffffff, aggression:1.0 },
  agile:     { id:'agile',     label:'Rápido',     hp:45,  speed:1.75, runSpeed:3.6, damage:8,  attackRange:1.25, attackCooldown:1.1, detectRange:14, fov:Math.PI*0.85, loseRange:20, scale:0.96, color:0xd7ffd9, aggression:1.1 },
  resistant: { id:'resistant', label:'Resistente', hp:115, speed:0.85, runSpeed:1.55,damage:14, attackRange:1.45, attackCooldown:2.0, detectRange:10, fov:Math.PI*0.65, loseRange:16, scale:1.08, color:0xffdddd, aggression:0.95 },
  errant:    { id:'errant',    label:'Errante',    hp:55,  speed:1.0,  runSpeed:2.0, damage:9,  attackRange:1.3,  attackCooldown:1.7, detectRange:9,  fov:Math.PI*0.60, loseRange:14, scale:1.0,  color:0xdde7ff, aggression:0.85 },
  aggressive:{ id:'aggressive',label:'Agressivo',  hp:70,  speed:1.3,  runSpeed:2.8, damage:12, attackRange:1.4,  attackCooldown:1.25,detectRange:15, fov:Math.PI*0.9,  loseRange:22, scale:1.02, color:0xffe0cc, aggression:1.35 },
};


const rand = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

function heapPush(heap, node) {
  let i = heap.length;
  heap.push(node);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].f <= node.f) break;
    heap[i] = heap[p]; i = p;
  }
  heap[i] = node;
}
function heapPop(heap) {
  const first = heap[0];
  const last = heap.pop();
  if (heap.length) {
    let i = 0;
    while (true) {
      let c = i * 2 + 1;
      if (c >= heap.length) break;
      if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
      if (heap[c].f >= last.f) break;
      heap[i] = heap[c]; i = c;
    }
    heap[i] = last;
  }
  return first;
}

export class Zombie {
  constructor({ scene, collisions, modelTemplate, animations, type = 'common', position = new THREE.Vector3(), spawnPos = null, role = 'roam' }) {
    this.scene = scene;
    this.collisions = collisions;
    this.typeDef = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.common;
    this.type = this.typeDef.id;

    this.group = new THREE.Group();
    this.group.name = `Zombie_${this.type}`;
    this.group.position.copy(position);
    this.group.position.y = 0.18;
    this.scene.add(this.group);

    this.model = skeletonClone(modelTemplate);
    const s = this.typeDef.scale * (0.96 + Math.random() * 0.08);
    this.model.scale.setScalar(s);
    // per-instance visual variation (no skeleton changes)
    const tint = new THREE.Color(this.typeDef.color);
    const wear = 0.85 + Math.random() * 0.25; // roughness multiplier
    const dark = 0.92 + Math.random() * 0.12;
    const typeMat = {
      common:    { rough: 0.95, metal: 0.02, tintMix: 0.10 },
      agile:     { rough: 0.9,  metal: 0.03, tintMix: 0.18 },
      resistant: { rough: 0.98, metal: 0.04, tintMix: 0.16 },
      errant:    { rough: 0.96, metal: 0.02, tintMix: 0.14 },
      aggressive:{ rough: 0.92, metal: 0.05, tintMix: 0.20 },
    }[this.type] || { rough:0.95, metal:0.03, tintMix:0.12 };
    this.model.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.frustumCulled = true;
        if (n.material) {
          n.material = n.material.clone();
          const m = n.material;
          if (m.color) {
            m.color.multiplyScalar(dark);
            if (this.typeDef.color !== 0xffffff) m.color.lerp(tint, typeMat.tintMix);
          }
          if ('roughness' in m) m.roughness = clamp((m.roughness ?? typeMat.rough) * wear, 0.55, 1);
          if ('metalness' in m) m.metalness = clamp((m.metalness ?? typeMat.metal) * 0.7, 0, 0.25);
          if ('envMapIntensity' in m) m.envMapIntensity = 0.35;
          m.needsUpdate = true;
        }
      }
    });
    this.group.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this._bindAnimations(animations);
    this.currentAction = null;
    this.currentActionName = null;

    this.state = ZOMBIE_STATES.IDLE;
    this.stateTime = 0;
    const diff = DIFFICULTY_PRESETS[GAME_CONFIG.difficulty] || DIFFICULTY_PRESETS.normal;
    this.diff = diff;
    this.hp = Math.max(1, Math.round(this.typeDef.hp * (diff.zombieHp ?? 1)));
    this.maxHp = this.hp;
    this.damage = Math.max(1, Math.round(this.typeDef.damage * (diff.zombieDamage ?? 1)));
    this.speedMult = diff.zombieSpeed ?? 1;
    this.alive = true;
    this.deadTime = 0;
    this.removeAfter = 6.0;

    // individual variation
    this.personality = rand(0.85, 1.15);
    this.reactionDelay = rand(0.05, 0.35) / (this.typeDef.aggression || 1);
    this.alertness = rand(0.9, 1.1);
    this.role = role; // 'roam' | 'guard' | 'interior'
    this.homePos = (spawnPos ? spawnPos.clone() : position.clone());
    this.spawnPos = this.homePos.clone();
    this.patrolRadius = role === 'guard' ? rand(2.5, 5.5) : rand(4, 8);

    this.yaw = Math.random() * Math.PI * 2;
    this.group.rotation.y = this.yaw;
    this.targetPos = null;
    this.patrolTarget = null;
    this.investigateTarget = null;
    this.lastKnownPlayerPos = null;
    this.lastSeenTime = -9999;
    this.attackCooldown = rand(0, 0.8);
    this.hitCooldown = 0;
    this.idleTimer = role === 'guard' ? rand(2, 6) : rand(0.5, 2.5);
    this.searchPoints = [];
    this.searchIndex = 0;
    this.repositionTimer = 0;
    this.repositionTarget = null;
    this.stimulus = null; // {pos, strength, time, kind}
    this.pendingStimulus = null;
    this.pendingStimulusAt = 0;
    this.attackToken = 0;
    this.separation = new THREE.Vector3();
    this.suspicion = 0; // 0..1
    this.suspicionTarget = null;
    // Cached local navigation: paths are rebuilt only when the target moves or the route is blocked.
    this._navPath = [];
    this._navTarget = null;
    this._navRepathAt = 0;
    this._navCellSize = 1.0;

    this.radius = 0.38 * this.typeDef.scale;
    this._tmpDir = new THREE.Vector3();
    this._tmpVec = new THREE.Vector3();
    this._losFrom = new THREE.Vector3();
    this._losTo = new THREE.Vector3();
    this._playerVel = new THREE.Vector3();

    this._play('idle', 0.2);
  }

  _bindAnimations(animations) {
    const find = (...names) => {
      for (const n of names) { const a = animations.find((c) => c.name.toLowerCase() === n.toLowerCase()); if (a) return a; }
      for (const n of names) { const a = animations.find((c) => c.name.toLowerCase().includes(n.toLowerCase())); if (a) return a; }
      return null;
    };
    const map = {
      idle: find('Idle'), walk: find('Walk', 'Walk_Carry'), run: find('Run', 'Run_Carry'),
      attack: find('Punch', 'SwordSlash', 'Attack'), hit: find('RecieveHit', 'ReceiveHit', 'Hit'), defeat: find('Defeat', 'Death'),
    };
    for (const [k, clip] of Object.entries(map)) {
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (k === 'attack' || k === 'hit' || k === 'defeat') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      this.actions[k] = action;
    }
  }

  _play(name, fade = 0.25) {
    const next = this.actions[name] || this.actions.idle;
    if (!next || this.currentActionName === name) return;
    if (this.currentAction) this.currentAction.fadeOut(fade);
    next.reset().fadeIn(fade).play();
    this.currentAction = next;
    this.currentActionName = name;
  }

  get position() { return this.group.position; }
  getPosition() { return this.group.position; }
  distanceTo(pos) { return this.group.position.distanceTo(pos); }

  canSeePlayer(playerPos, player = null) {
    const myPos = this.group.position;
    const toPlayer = this._tmpVec.copy(playerPos).sub(myPos); toPlayer.y = 0;
    const dist = toPlayer.length();
    const visMult = player?.getVisibilityMult ? player.getVisibilityMult() : 1;
    const diffDetect = this.diff?.stealthDetectMult ?? 1;
    const envVis = player?.envVisibilityMult ?? 1;
    const detectRange = this.typeDef.detectRange * this.alertness * visMult * diffDetect * envVis;
    if (dist > detectRange) return false;
    if (dist < 0.001) return true;
    toPlayer.normalize();
    const forward = this._tmpDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const dot = forward.dot(toPlayer);
    const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
    const fov = this.typeDef.fov * (this.typeDef.aggression > 1.2 ? 1.05 : 1);
    const peripheral = dist > 2.8;
    if (peripheral && angle > fov / 2) {
      // slight peripheral awareness very close/front-side
      if (angle > fov * 0.72 || dist > 4.5) return false;
    }
    // LOS check at chest height (lower target if player crouching)
    const targetY = player?.isCrouching ? 0.85 : 1.2;
    this._losFrom.set(myPos.x, 1.25, myPos.z);
    this._losTo.set(playerPos.x, targetY, playerPos.z);
    if (this.collisions.segmentBlocked(this._losFrom, this._losTo, targetY)) return false;
    return true;
  }

  hearStimulus(stim, now = performance.now()) {
    if (!stim || !this.alive) return;
    const d = this.group.position.distanceTo(stim.pos);
    const hearMult = this.diff?.stealthHearMult ?? 1;
    const strength = (stim.strength || 0) * (stim.kind === 'vehicle' ? 1.15 : 1) * (stim.kind === 'gunshot' ? 1.25 : 1) * hearMult;
    if (d > strength) return;
    // simple occlusion attenuation
    this._losFrom.set(this.group.position.x, 1.2, this.group.position.z);
    this._losTo.set(stim.pos.x, 1.2, stim.pos.z);
    const blocked = this.collisions.segmentBlocked(this._losFrom, this._losTo, 1.2);
    if (blocked && d > strength * 0.55) return;
    const next = { pos: stim.pos.clone(), strength, time: now, kind: stim.kind || 'noise' };
    const reactionMult = this.diff?.stealthReactionMult ?? 1;
    if (!this.stimulus || now - this.stimulus.time > 1200 || d < this.group.position.distanceTo(this.stimulus.pos)) {
      this.stimulus = next;
      this.pendingStimulus = next;
      this.pendingStimulusAt = now + this.reactionDelay * 1000 * reactionMult;
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    if (this.hitCooldown > 0) return false;
    this.hp -= amount;
    this.hitCooldown = 0.35;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = ZOMBIE_STATES.DEAD;
      this.stateTime = 0;
      this._play('defeat', 0.15);
      return true;
    }
    this._play('hit', 0.08);
    // aggro on hit, but keep it natural
    this.lastKnownPlayerPos = this.lastKnownPlayerPos || this.group.position.clone();
    this.lastSeenTime = performance.now();
    if (this.state !== ZOMBIE_STATES.ATTACK) {
      this._setState(ZOMBIE_STATES.CHASE);
    }
    return false;
  }

  _setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.stateTime = 0;
    if (next === ZOMBIE_STATES.SEARCH) this._buildSearchPoints();
  }

  _pickPatrolTarget() {
    const base = this.homePos || this.spawnPos || this.group.position;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(1.5, this.patrolRadius);
      const x = clamp(base.x + Math.cos(a) * r, -48, 48);
      const z = clamp(base.z + Math.sin(a) * r, -48, 48);
      const cand = new THREE.Vector3(x, 0.18, z);
      // avoid inside obstacles
      let inside = false;
      for (const b of this.collisions.boxes) {
        if (b.enabled === false) continue;
        if (x > b.min.x - 0.3 && x < b.max.x + 0.3 && z > b.min.z - 0.3 && z < b.max.z + 0.3) { inside = true; break; }
      }
      if (!inside) { this.patrolTarget = cand; return; }
    }
    this.patrolTarget = base.clone();
  }

  _buildSearchPoints() {
    this.searchPoints = [];
    this.searchIndex = 0;
    const center = this.lastKnownPlayerPos || this.investigateTarget || this.group.position;
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(1.5, 4.5);
      this.searchPoints.push(new THREE.Vector3(clamp(center.x + Math.cos(a)*r,-48,48), 0.18, clamp(center.z + Math.sin(a)*r,-48,48)));
    }
  }

  _findNavigationPath(target) {
    const start = this.group.position;
    const cell = this._navCellSize;
    const margin = 6;
    const minX = Math.max(-52, Math.floor((Math.min(start.x, target.x) - margin) / cell) * cell);
    const minZ = Math.max(-52, Math.floor((Math.min(start.z, target.z) - margin) / cell) * cell);
    const maxX = Math.min(52, Math.ceil((Math.max(start.x, target.x) + margin) / cell) * cell);
    const maxZ = Math.min(52, Math.ceil((Math.max(start.z, target.z) + margin) / cell) * cell);
    const cols = Math.max(1, Math.floor((maxX - minX) / cell) + 1);
    const rows = Math.max(1, Math.floor((maxZ - minZ) / cell) + 1);
    if (cols * rows > 2601) return [];

    const indexAt = (x, z) => {
      const c = clamp(Math.round((x - minX) / cell), 0, cols - 1);
      const r = clamp(Math.round((z - minZ) / cell), 0, rows - 1);
      return r * cols + c;
    };
    const worldAt = (i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return { x: minX + c * cell, z: minZ + r * cell };
    };
    const blocked = new Uint8Array(cols * rows);
    const boxes = this.collisions.boxes.filter(b => b.enabled !== false && 1.0 >= b.min.y && 1.0 <= b.max.y);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = minX + c * cell, z = minZ + r * cell;
        for (const b of boxes) {
          if (x >= b.min.x - this.radius - 0.12 && x <= b.max.x + this.radius + 0.12 &&
              z >= b.min.z - this.radius - 0.12 && z <= b.max.z + this.radius + 0.12) {
            blocked[r * cols + c] = 1; break;
          }
        }
      }
    }

    const nearestFree = (origin) => {
      const base = indexAt(origin.x, origin.z);
      if (!blocked[base]) return base;
      const bc = base % cols, br = Math.floor(base / cols);
      for (let radius = 1; radius <= 5; radius++) {
        let best = -1, bestD = Infinity;
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
            const c = bc + dx, r = br + dz;
            if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
            const i = r * cols + c;
            if (blocked[i]) continue;
            const d = dx * dx + dz * dz;
            if (d < bestD) { bestD = d; best = i; }
          }
        }
        if (best >= 0) return best;
      }
      return -1;
    };

    const startI = nearestFree(start), goalI = nearestFree(target);
    if (startI < 0 || goalI < 0) return [];
    if (startI === goalI) return [];

    const count = cols * rows;
    const gScore = new Float32Array(count); gScore.fill(Infinity);
    const parent = new Int32Array(count); parent.fill(-1);
    const closed = new Uint8Array(count);
    const heap = [];
    const heuristic = (i) => {
      const a = worldAt(i), b = worldAt(goalI);
      const dx = Math.abs(a.x - b.x), dz = Math.abs(a.z - b.z);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    gScore[startI] = 0;
    heapPush(heap, { i: startI, f: heuristic(startI), g: 0 });
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let found = false, visits = 0;
    while (heap.length && visits < 3200) {
      const cur = heapPop(heap);
      if (closed[cur.i] || cur.g > gScore[cur.i] + 0.0001) continue;
      if (cur.i === goalI) { found = true; break; }
      closed[cur.i] = 1; visits++;
      const c = cur.i % cols, r = Math.floor(cur.i / cols);
      for (const [dx, dz] of dirs) {
        const nc = c + dx, nr = r + dz;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (blocked[ni] || closed[ni]) continue;
        if (dx && dz && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
        const ng = cur.g + (dx && dz ? Math.SQRT2 : 1);
        if (ng >= gScore[ni]) continue;
        gScore[ni] = ng; parent[ni] = cur.i;
        heapPush(heap, { i: ni, g: ng, f: ng + heuristic(ni) });
      }
    }
    if (!found) return [];
    const indices = [];
    for (let at = goalI; at !== startI && at >= 0; at = parent[at]) {
      indices.push(at);
      if (indices.length > count) return [];
    }
    indices.reverse();
    const path = indices.map(i => {
      const p = worldAt(i);
      return new THREE.Vector3(p.x, start.y, p.z);
    });
    // Greedy smoothing: remove intermediate points when a straight segment is clear.
    const smooth = [];
    let anchor = start, i = 0;
    while (i < path.length) {
      let far = i;
      for (let j = path.length - 1; j >= i; j--) {
        if (!this.collisions.segmentBlocked(anchor, path[j], 1.0)) { far = j; break; }
      }
      smooth.push(path[far]);
      anchor = path[far];
      i = far + 1;
    }
    return smooth;
  }

  _moveToward(target, dt, speed, separation = null) {
    const pos = this.group.position;
    const directBlocked = this.collisions.segmentBlocked(pos, target, 1.0);
    let moveTarget = target;
    const now = performance.now();
    if (directBlocked) {
      const targetMoved = !this._navTarget || this._navTarget.distanceToSquared(target) > 2.25;
      const pathBlocked = this._navPath.length && this.collisions.segmentBlocked(pos, this._navPath[0], 1.0);
      if (targetMoved || pathBlocked || now >= this._navRepathAt) {
        this._navPath = this._findNavigationPath(target);
        this._navTarget = target.clone();
        this._navRepathAt = now + 1100;
      }
      while (this._navPath.length && pos.distanceTo(this._navPath[0]) < 0.72) this._navPath.shift();
      if (this._navPath.length) moveTarget = this._navPath[0];
    } else {
      this._navPath.length = 0;
      this._navTarget = null;
      this._navRepathAt = now + 600;
    }

    let dx = moveTarget.x - pos.x;
    let dz = moveTarget.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return Math.hypot(target.x - pos.x, target.z - pos.z);
    let nx = dx / dist, nz = dz / dist;
    if (separation) {
      nx += separation.x * 0.55; nz += separation.z * 0.55;
      const l = Math.hypot(nx,nz)||1; nx/=l; nz/=l;
    }
    const desiredYaw = Math.atan2(nx, nz);
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * (4.5 + this.typeDef.aggression));
    this.group.rotation.y = this.yaw;
    const step = Math.min(dist, speed * this.personality * dt);
    const beforeX = pos.x, beforeZ = pos.z;
    pos.x += Math.sin(this.yaw) * step;
    pos.z += Math.cos(this.yaw) * step;
    this.collisions.resolveCircle(pos, this.radius);
    const moved = Math.hypot(pos.x - beforeX, pos.z - beforeZ);
    if (moved < step * 0.18 && directBlocked) {
      this._navRepathAt = 0;
    }
    return Math.hypot(target.x - pos.x, target.z - pos.z);
  }

  _face(pos, dt, turnSpeed = 8) {
    const dx = pos.x - this.group.position.x; const dz = pos.z - this.group.position.z;
    const desiredYaw = Math.atan2(dx, dz);
    let dyaw = desiredYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * turnSpeed);
    this.group.rotation.y = this.yaw;
  }

  applySeparation(neighbors) {
    this.separation.set(0,0,0);
    let count = 0;
    const my = this.group.position;
    for (const o of neighbors) {
      if (o === this || !o.alive) continue;
      const dx = my.x - o.group.position.x;
      const dz = my.z - o.group.position.z;
      const d2 = dx*dx + dz*dz;
      const minD = (this.radius + o.radius + 0.35);
      if (d2 > 0.0001 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const w = (minD - d) / minD;
        this.separation.x += (dx / d) * w;
        this.separation.z += (dz / d) * w;
        count++;
      }
    }
    if (count) { this.separation.multiplyScalar(1 / count); }
    // hard resolve overlap
    if (count) {
      my.x += this.separation.x * 0.02;
      my.z += this.separation.z * 0.02;
      this.collisions.resolveCircle(my, this.radius);
    }
  }

  update(dt, player, now, context = {}) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    this.stateTime += dt;
    this.mixer.update(dt);
    // Etapa 19: sync animation speed to locomotion for less sliding
    if (this.currentAction) {
      if (this.currentActionName === 'walk') this.currentAction.timeScale = clamp((this.typeDef.speed * this.speedMult * this.personality) / 1.8, 0.7, 1.5);
      else if (this.currentActionName === 'run') this.currentAction.timeScale = clamp((this.typeDef.runSpeed * this.speedMult * this.personality) / 3.0, 0.75, 1.5);
      else if (this.currentActionName === 'idle') this.currentAction.timeScale = 0.9 + (this.personality - 1) * 0.2;
      else this.currentAction.timeScale = 1;
    }

    if (!this.alive) {
      this.deadTime += dt;
      if (this.deadTime > this.removeAfter) this.shouldRemove = true;
      if (this.deadTime > 3.5) {
        this.group.position.y -= dt * 0.15;
        this.group.traverse((n) => { if (n.isMesh && n.material) { n.material.transparent = true; n.material.opacity = Math.max(0, (n.material.opacity ?? 1) - dt * 0.4); } });
      }
      return;
    }

    if (!this.spawnPos) this.spawnPos = this.group.position.clone();
    const playerPos = player?.position || this.group.position;
    const dist = this.distanceTo(playerPos);
    const seesPlayer = this.canSeePlayer(playerPos, player);

    if (seesPlayer) {
      this.lastKnownPlayerPos = playerPos.clone();
      this.lastSeenTime = now;
      // suspicion builds on sight; close/clear sight triggers chase faster
      const close = dist < 5.5;
      const agg = this.typeDef.aggression || 1;
      const gain = (close ? 2.2 : 0.8) * agg * (this.diff?.stealthDetectMult ?? 1);
      this.suspicion = clamp((this.suspicion || 0) + gain * dt, 0, 1);
      this.suspicionTarget = playerPos.clone();
      if (this.state !== ZOMBIE_STATES.CHASE && this.state !== ZOMBIE_STATES.ATTACK) {
        if (this.suspicion >= 0.65 || close) this._setState(ZOMBIE_STATES.CHASE);
        else if (this.state !== ZOMBIE_STATES.INVESTIGATE && this.state !== ZOMBIE_STATES.SEARCH) this._setState(ZOMBIE_STATES.SUSPICIOUS);
      }
    } else {
      this.suspicion = Math.max(0, (this.suspicion || 0) - dt * 0.18);
    }

    // delayed stimulus reaction for naturalness
    if (this.pendingStimulus && now >= this.pendingStimulusAt) {
      const stim = this.pendingStimulus; this.pendingStimulus = null;
      if (stim && (now - stim.time) < 4500 && this.state !== ZOMBIE_STATES.CHASE && this.state !== ZOMBIE_STATES.ATTACK) {
        this.investigateTarget = stim.pos.clone();
        this.suspicion = Math.max(this.suspicion || 0, stim.kind === 'gunshot' ? 0.9 : 0.45);
        if (stim.kind === 'gunshot' || (stim.strength||0) > 8) this._setState(ZOMBIE_STATES.INVESTIGATE);
        else this._setState(ZOMBIE_STATES.SUSPICIOUS);
      }
    }
    if (this.stimulus && (now - this.stimulus.time) > 5000) this.stimulus = null;

    const lostPlayer = !seesPlayer && (now - this.lastSeenTime) > 2600;
    const farFromHome = this.group.position.distanceTo(this.homePos) > this.patrolRadius * 2.2;

    switch (this.state) {
      case ZOMBIE_STATES.IDLE:
        this._play('idle');
        this.idleTimer -= dt;
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (seesPlayer) { this._setState(ZOMBIE_STATES.SUSPICIOUS); break; }
        if (farFromHome && this.role !== 'errant') { this._setState(ZOMBIE_STATES.RETURN); break; }
        if (this.idleTimer <= 0) {
          const patrolChance = this.type === 'errant' ? 0.85 : (this.role === 'guard' ? 0.35 : 0.65);
          if (Math.random() < patrolChance) { this._pickPatrolTarget(); this._setState(ZOMBIE_STATES.PATROL); }
          else { this.idleTimer = rand(1.2, 3.5); }
        }
        break;

      case ZOMBIE_STATES.PATROL: {
        this._play('walk');
        if (seesPlayer && this.suspicion >= 0.65) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (!this.patrolTarget) this._pickPatrolTarget();
        const d = this._moveToward(this.patrolTarget, dt, this.typeDef.speed * this.speedMult, this.separation);
        if (d < 0.6 || this.stateTime > rand(7,11)) { this.idleTimer = rand(0.8, 2.8); this._setState(ZOMBIE_STATES.IDLE); }
        break;
      }

      case ZOMBIE_STATES.SUSPICIOUS: {
        this._play('walk');
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        const target = this.suspicionTarget || this.investigateTarget || this.lastKnownPlayerPos;
        if (target) {
          this._face(target, dt, 5);
          if (this.stateTime > 0.8) this._moveToward(target, dt, this.typeDef.speed * this.speedMult * 0.7, this.separation);
        }
        if (this.stateTime > 3.5) {
          if (target) { this.investigateTarget = target.clone(); this._setState(ZOMBIE_STATES.INVESTIGATE); }
          else { this._setState(ZOMBIE_STATES.RETURN); }
        }
        if (!seesPlayer && this.suspicion < 0.15 && this.stateTime > 2.0) { this._setState(ZOMBIE_STATES.IDLE); this.idleTimer = rand(1,2); }
        break;
      }

      case ZOMBIE_STATES.INVESTIGATE: {
        this._play('walk');
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        const target = this.investigateTarget || this.lastKnownPlayerPos;
        if (!target || this.stateTime > 7.5) { this._setState(this.lastKnownPlayerPos ? ZOMBIE_STATES.SEARCH : ZOMBIE_STATES.RETURN); break; }
        const d = this._moveToward(target, dt, this.typeDef.speed * this.speedMult * 1.08, this.separation);
        if (d < 0.9) { this._setState(this.lastKnownPlayerPos ? ZOMBIE_STATES.SEARCH : ZOMBIE_STATES.RECOVER); }
        break;
      }

      case ZOMBIE_STATES.SEARCH: {
        this._play('walk');
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (this.stateTime > 8 || this.searchIndex >= this.searchPoints.length) { this.lastKnownPlayerPos = null; this._setState(ZOMBIE_STATES.RETURN); break; }
        const target = this.searchPoints[this.searchIndex];
        const d = this._moveToward(target, dt, this.typeDef.speed * this.speedMult, this.separation);
        if (d < 0.7) { this.searchIndex++; this.idleTimer = rand(0.2, 0.7); }
        break;
      }

      case ZOMBIE_STATES.CHASE: {
        const attackRange = this.typeDef.attackRange;
        if (dist <= attackRange) { this._setState(ZOMBIE_STATES.ATTACK); break; }
        if (lostPlayer) {
          if (this.lastKnownPlayerPos) { this.investigateTarget = this.lastKnownPlayerPos.clone(); this._setState(ZOMBIE_STATES.SEARCH); }
          else this._setState(ZOMBIE_STATES.RETURN);
          break;
        }
        if (dist > this.typeDef.loseRange && (now - this.lastSeenTime) > 1800) { this._setState(ZOMBIE_STATES.SEARCH); break; }
        const target = seesPlayer ? playerPos : (this.lastKnownPlayerPos || playerPos);
        const run = dist > 4.2;
        this._play(run ? 'run' : 'walk');
        this._moveToward(target, dt, run ? this.typeDef.runSpeed * this.speedMult : this.typeDef.speed * this.speedMult * 1.25, this.separation);
        // occasional reposition when too close but not attacking (crowd control)
        if (dist < attackRange * 1.8 && context.nearbyAttackers > 2 && Math.random() < 0.01) this._setState(ZOMBIE_STATES.REPOSITION);
        break;
      }

      case ZOMBIE_STATES.ATTACK: {
        this._face(playerPos, dt, 9);
        if (dist > this.typeDef.attackRange * 1.5) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (!seesPlayer && dist > 2.8) { this._setState(ZOMBIE_STATES.SEARCH); break; }
        if (context.nearbyAttackers > 3 && this.stateTime < 0.2 && Math.random() < 0.4) { this._setState(ZOMBIE_STATES.REPOSITION); break; }
        this._play('attack');
        if (this.attackCooldown <= 0 && this.stateTime > 0.4) {
          if (context.canAttackToken ? context.canAttackToken(this) : true) {
            this.attackCooldown = this.typeDef.attackCooldown * rand(0.9, 1.2);
            if (dist <= this.typeDef.attackRange + 0.35) {
              player.takeDamage?.(this.damage, this);
            }
          } else {
            this.attackCooldown = 0.35; // wait a bit, avoid all attacking simultaneously
          }
        }
        if (this.stateTime > this.typeDef.attackCooldown + 0.5) this.stateTime = 0.4;
        break;
      }

      case ZOMBIE_STATES.REPOSITION: {
        this._play('walk');
        if (seesPlayer && dist > 5) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (!this.repositionTarget || this.stateTime > 1.8) {
          const a = Math.atan2(this.group.position.x - playerPos.x, this.group.position.z - playerPos.z) + rand(-1.2, 1.2);
          const r = rand(1.8, 3.2);
          this.repositionTarget = new THREE.Vector3(clamp(playerPos.x + Math.sin(a)*r,-48,48), 0.18, clamp(playerPos.z + Math.cos(a)*r,-48,48));
        }
        const d = this._moveToward(this.repositionTarget, dt, this.typeDef.speed * this.speedMult * 1.15, this.separation);
        if (d < 0.5 || this.stateTime > 2.2) this._setState(seesPlayer ? ZOMBIE_STATES.CHASE : ZOMBIE_STATES.SEARCH);
        break;
      }

      case ZOMBIE_STATES.RETURN: {
        this._play('walk');
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        const home = this.homePos || this.spawnPos;
        const d = this._moveToward(home, dt, this.typeDef.speed * this.speedMult, this.separation);
        if (d < 1.0 || this.stateTime > 12) { this.idleTimer = rand(1, 3); this._setState(ZOMBIE_STATES.IDLE); }
        break;
      }

      case ZOMBIE_STATES.RECOVER:
        this._play('idle');
        if (seesPlayer && (this.suspicion >= 0.65 || dist < 5.5)) { this._setState(ZOMBIE_STATES.CHASE); break; }
        if (this.stateTime > rand(1.0, 2.2)) {
          this.idleTimer = rand(0.8, 2.0);
          this._setState(this.type === 'errant' ? ZOMBIE_STATES.PATROL : ZOMBIE_STATES.IDLE);
        }
        break;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((n) => {
      if (n.isMesh) { n.geometry?.dispose?.(); if (Array.isArray(n.material)) n.material.forEach(m=>m.dispose?.()); else n.material?.dispose?.(); }
    });
  }
}
