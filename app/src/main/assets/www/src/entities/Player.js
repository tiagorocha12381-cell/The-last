import * as THREE from 'three';
import { GAME_CONFIG, DIFFICULTY_PRESETS } from '../config/constants.js';
import { clamp, damp } from '../utils/MathUtils.js';

export class Player {
  constructor(scene, collisions) {
    this.scene = scene;
    this.collisions = collisions;
    this.cfg = GAME_CONFIG.player;

    this.group = new THREE.Group();
    this.group.name = 'Player';
    this.scene.add(this.group);

    this.position = new THREE.Vector3(0, 0.18, 10);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI; // facing -Z initially
    this.onGround = false;
    this.moveSpeed = 0;
    this.animTime = 0;
    this.isMoving = false;
    this.isRunning = false;

    this.maxHp = 100;
    this.hp = 100;
    this.damageCooldown = 0;
    this.dead = false;
    this.onDamaged = null;
    this.onDeath = null;

    // Combat
    this.attackTimer = 0;
    this.attackDuration = 0.35;
    this.attackType = 'basic'; // basic | special
    this.attackHitDone = false;
    this.specialCooldown = 0;
    this.specialCooldownMax = 4.0;
    this.hitReactionTimer = 0;
    this.isAttacking = false;
    // Reload
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.reloadJustFinished = false;
    this.reloadingWeaponId = null;

    // Survival
    const sv = GAME_CONFIG.survival || {};
    this.maxHunger = sv.maxHunger ?? 100;
    this.maxThirst = sv.maxThirst ?? 100;
    this.maxEnergy = sv.maxEnergy ?? 100;
    this.maxStamina = sv.maxStamina ?? 100;
    this.baseMaxEnergy = this.maxEnergy;
    this.hunger = this.maxHunger;
    this.thirst = this.maxThirst;
    this.energy = this.maxEnergy;
    this.stamina = this.maxStamina;
    this.isResting = false;
    this.restCooldown = 0;
    this._survivalHpTimer = 0;
    this.progBonuses = {};

    // Etapa 19: animation state
    this._wasOnGround = true;
    this._landTimer = 0;
    this._prevYaw = this.yaw;
    this._turnLean = 0;
    this._animBlend = 0; // 0 idle, 1 move

    // Stealth
    this.isCrouching = false;
    this.stealthNoise = 0; // 0-1+ current noise intensity for AI
    this._noiseCooldown = 0;

    this._buildModel();
    this.group.position.copy(this.position);
  }

  _mat(color, rough = 0.85, metal = 0.05) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  }

  _buildModel() {
    // Post-apocalyptic survivor - procedural but detailed (PBR materials, no cubes-as-final-look)
    this.model = new THREE.Group();
    this.model.name = 'PlayerModel';

    const skin = this._mat(0x9c7a62, 0.82, 0.02);
    const skinShadow = this._mat(0x876654, 0.88, 0.02);
    const jacket = this._mat(0x4a5a4a, 0.92, 0.03);
    const jacketDark = this._mat(0x3e4b3e, 0.95, 0.02);
    const shirt = this._mat(0x6b6a63, 0.95, 0.01);
    const pants = this._mat(0x4b4f56, 0.96, 0.02);
    const pantsDark = this._mat(0x3f434a, 0.96, 0.02);
    const boots = this._mat(0x2f2d2b, 0.78, 0.08);
    const bootSole = this._mat(0x242220, 0.95, 0.02);
    const hair = this._mat(0x3b3028, 0.95, 0.01);
    const backpackMat = this._mat(0x5a5245, 0.9, 0.03);
    const metal = this._mat(0x8a8f96, 0.45, 0.75);
    const leather = this._mat(0x5a4638, 0.86, 0.04);
    const clothRed = this._mat(0x7a4a3a, 0.92, 0.02);

    const add = (geo, mat, x,y,z, sx=1,sy=1,sz=1, rx=0,ry=0,rz=0, parent=this.model) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };

    // Torso / jacket
    add(new THREE.BoxGeometry(0.54, 0.58, 0.30), jacket, 0, 1.10, 0);
    add(new THREE.BoxGeometry(0.56, 0.16, 0.32), jacketDark, 0, 1.35, 0); // shoulders
    add(new THREE.BoxGeometry(0.46, 0.10, 0.31), shirt, 0, 1.42, 0.01); // collar
    add(new THREE.BoxGeometry(0.18, 0.42, 0.02), jacketDark, 0, 1.08, 0.155); // front seam
    add(new THREE.BoxGeometry(0.10, 0.10, 0.03), metal, 0, 1.18, 0.16); // zipper
    add(new THREE.BoxGeometry(0.60, 0.08, 0.34), leather, 0, 0.86, 0); // belt
    add(new THREE.BoxGeometry(0.08, 0.06, 0.04), metal, 0, 0.86, 0.17); // buckle

    // Pouches
    add(new THREE.BoxGeometry(0.12, 0.10, 0.08), leather, 0.20, 0.90, 0.14);
    add(new THREE.BoxGeometry(0.10, 0.12, 0.07), leather, -0.22, 0.92, 0.12);

    // Head
    const headGrp = new THREE.Group(); headGrp.position.y = 1.66; this.model.add(headGrp);
    this.head = headGrp;
    add(new THREE.SphereGeometry(0.17, 16, 14), skin, 0,0.02,0,1,1.05,0.95,0,0,0,headGrp);
    add(new THREE.SphereGeometry(0.12, 12, 10), skinShadow, 0,-0.11,0.03,1,0.7,1,0,0,0,headGrp); // jaw
    add(new THREE.BoxGeometry(0.34, 0.12, 0.34), hair, 0,0.20,0,1,1,1,0,0,0,headGrp);
    add(new THREE.BoxGeometry(0.34, 0.16, 0.10), hair, 0,0.08,-0.13,1,1,1,0,0,0,headGrp); // back hair
    // Eyes
    const eyeWhite = this._mat(0xd8d2cc, 0.4, 0);
    const eyePupil = this._mat(0x2a2522, 0.3, 0);
    for (const sx of [-0.07, 0.07]) {
      add(new THREE.BoxGeometry(0.05,0.03,0.02), eyeWhite, sx,0.03,0.155,1,1,1,0,0,0,headGrp);
      add(new THREE.BoxGeometry(0.025,0.025,0.01), eyePupil, sx,0.03,0.165,1,1,1,0,0,0,headGrp);
    }
    add(new THREE.BoxGeometry(0.06,0.02,0.03), skinShadow, 0,-0.02,0.16,1,1,1,0,0,0,headGrp); // nose
    add(new THREE.BoxGeometry(0.08,0.015,0.02), this._mat(0x6b4f45,0.7,0), 0,-0.07,0.155,1,1,1,0,0,0,headGrp); // mouth
    // Scarf/bandana
    add(new THREE.BoxGeometry(0.36,0.08,0.34), clothRed, 0,1.46,0,1,1,1,0,0,0,this.model);

    // Arms
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]]) {
      add(new THREE.CapsuleGeometry(0.085, 0.20, 4, 8), jacket, 0, -0.17, 0,1,1,1,0,0,0,arm); // upper
      add(new THREE.BoxGeometry(0.15, 0.10, 0.20), jacketDark, 0, -0.35, 0,1,1,1,0,0,0,arm); // elbow pad
      add(new THREE.CapsuleGeometry(0.072, 0.18, 4, 8), shirt, 0, -0.46, 0,1,1,1,0,0,0,arm); // lower
      add(new THREE.BoxGeometry(0.13, 0.08, 0.15), leather, 0, -0.62, 0,1,1,1,0,0,0,arm); // glove cuff
      add(new THREE.BoxGeometry(0.12, 0.10, 0.14), this._mat(0x3a3632,0.75,0.05), 0, -0.70, 0,1,1,1,0,0,0,arm); // glove
      arm.position.set(side * 0.36, 1.34, 0);
      this.model.add(arm);
    }

    // Legs
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    for (const [leg, side] of [[this.leftLeg, -1], [this.rightLeg, 1]]) {
      add(new THREE.CapsuleGeometry(0.105, 0.22, 4, 8), pants, 0, -0.20, 0,1,1,1,0,0,0,leg); // upper
      add(new THREE.BoxGeometry(0.18, 0.12, 0.24), pantsDark, 0, -0.40, 0.01,1,1,1,0,0,0,leg); // knee pad
      add(new THREE.CapsuleGeometry(0.095, 0.20, 4, 8), pants, 0, -0.56, 0,1,1,1,0,0,0,leg); // lower
      add(new THREE.BoxGeometry(0.21, 0.14, 0.30), boots, 0, -0.82, 0.03,1,1,1,0,0,0,leg); // boot
      add(new THREE.BoxGeometry(0.22, 0.05, 0.32), bootSole, 0, -0.90, 0.04,1,1,1,0,0,0,leg); // sole
      leg.position.set(side * 0.14, 0.78, 0);
      this.model.add(leg);
    }

    // Backpack
    add(new THREE.BoxGeometry(0.36, 0.44, 0.20), backpackMat, 0, 1.08, -0.24);
    add(new THREE.BoxGeometry(0.24, 0.20, 0.07), this._mat(0x50493d,0.92,0.03), 0, 0.98, -0.36);
    add(new THREE.BoxGeometry(0.05, 0.45, 0.03), leather, 0.14, 1.12, -0.14); // strap
    add(new THREE.BoxGeometry(0.05, 0.45, 0.03), leather, -0.14, 1.12, -0.14);
    add(new THREE.BoxGeometry(0.12, 0.08, 0.10), this._mat(0x6a6258,0.9,0.03), 0.22, 1.18, -0.20); // side pouch

    // Hood and layered survival clothing details, matching the supplied protagonist reference.
    const hood = add(new THREE.SphereGeometry(0.205, 14, 12), jacketDark, 0, 1.56, -0.115, 1.08, 0.88, 0.82);
    hood.rotation.x = -0.12;
    add(new THREE.TorusGeometry(0.175, 0.035, 8, 18), jacket, 0, 1.49, -0.015, 1, 1, 0.82, Math.PI / 2, 0, 0);
    // Jacket front panels and worn seams.
    add(new THREE.BoxGeometry(0.018, 0.42, 0.018), leather, -0.12, 1.10, 0.166);
    add(new THREE.BoxGeometry(0.018, 0.42, 0.018), leather, 0.12, 1.10, 0.166);
    // Utility pockets and stitched-looking flap details.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.14, 0.16, 0.055), jacketDark, side * 0.19, 0.99, 0.17);
      add(new THREE.BoxGeometry(0.15, 0.035, 0.06), leather, side * 0.19, 1.075, 0.176);
      add(new THREE.BoxGeometry(0.045, 0.30, 0.035), leather, side * 0.19, 1.28, -0.17);
    }
    // Backpack straps over the shoulders.
    for (const side of [-1, 1]) {
      const strap = add(new THREE.BoxGeometry(0.075, 0.48, 0.045), leather, side * 0.245, 1.25, 0.125);
      strap.rotation.z = side * -0.10;
      add(new THREE.BoxGeometry(0.085, 0.055, 0.052), metal, side * 0.245, 1.10, 0.153);
    }

    this.group.add(this.model);
  }

  setSpawn(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  takeDamage(amount, source) {
    if (this.dead) return;
    if (this.damageCooldown > 0) return;
    const mult = Math.max(0.5, 1 + (this.progBonuses?.damageTakenMult || 0));
    this.hp = Math.max(0, this.hp - (amount * mult));
    this.damageCooldown = 0.8;
    this.hitReactionTimer = 0.35;
    this.onDamaged?.(this.hp, this.maxHp, amount, source);
    if (this.hp <= 0) {
      this.dead = true;
      this.onDeath?.();
    }
  }

  canAttack() { return !this.dead && !this.isAttacking && this.attackTimer <= 0 && !this.isReloading; }
  canSpecial() { return !this.dead && this.specialCooldown <= 0 && !this.isAttacking && !this.isReloading; }
  canReload() { return !this.dead && !this.isReloading && !this.isAttacking; }
  startReload(duration=1.5, weaponId=null) {
    if (!this.canReload()) return false;
    this.isReloading = true;
    this.reloadDuration = Math.max(0.2, duration);
    this.reloadTimer = this.reloadDuration;
    this.reloadingWeaponId = weaponId;
    return true;
  }
  cancelReload() { this.isReloading = false; this.reloadTimer = 0; this.reloadDuration = 0; this.reloadingWeaponId = null; }

  startAttack(type = 'basic', stats = null) {
    if (!this.canAttack()) return false;
    if (type === 'special' && !this.canSpecial()) return false;
    this.attackType = type;
    this.isAttacking = true;
    this.attackHitDone = false;
    this.attackDuration = type === 'special' ? 0.55 : 0.38;
    this.attackTimer = this.attackDuration;
    if (type === 'special') this.specialCooldown = stats?.specialCooldown ?? this.specialCooldownMax;
    return true;
  }

  resetStats(spawnPos) {
    this.hp = this.maxHp;
    this.dead = false;
    this.damageCooldown = 0;
    this.velocity.set(0,0,0);
    this.moveSpeed = 0;
    this.hunger = this.maxHunger;
    this.thirst = this.maxThirst;
    this.energy = this.maxEnergy;
    this.stamina = this.maxStamina;
    this.isResting = false;
    this._survivalHpTimer = 0;
    if (spawnPos) { this.position.copy(spawnPos); this.group.position.copy(this.position); }
  }

  getSurvivalState() {
    return {
      hp:this.hp, hunger:this.hunger, thirst:this.thirst, energy:this.energy, stamina:this.stamina,
      x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw
    };
  }
  loadSurvivalState(s) {
    if (!s) return;
    if (Number.isFinite(s.hp)) this.hp = clamp(s.hp, 0, this.maxHp);
    if (Number.isFinite(s.hunger)) this.hunger = clamp(s.hunger, 0, this.maxHunger);
    if (Number.isFinite(s.thirst)) this.thirst = clamp(s.thirst, 0, this.maxThirst);
    if (Number.isFinite(s.energy)) this.energy = clamp(s.energy, 0, this.maxEnergy);
    if (Number.isFinite(s.stamina)) this.stamina = clamp(s.stamina, 0, this.maxStamina);
    if (Number.isFinite(s.x) && Number.isFinite(s.z)) {
      this.position.x = clamp(s.x, -200, 200);
      this.position.z = clamp(s.z, -200, 200);
      this.position.y = Number.isFinite(s.y) ? clamp(s.y, 0.18, 50) : 0.18;
      if (Number.isFinite(s.yaw)) this.yaw = s.yaw;
      this.group.position.copy(this.position);
      this.velocity.set(0,0,0);
    }
    this.dead = this.hp <= 0;
    if (this.dead) { this.hp = Math.max(20, this.maxHp * 0.2); this.dead = false; }
  }

  applyProgressionBonuses(b = {}) {
    this.progBonuses = { ...b };
    const oldMaxEnergy = this.maxEnergy;
    this.maxEnergy = (this.baseMaxEnergy || 100) + (b.maxEnergy || 0);
    if (this.maxEnergy !== oldMaxEnergy) this.energy = clamp(this.energy + (this.maxEnergy - oldMaxEnergy), 0, this.maxEnergy);
    this.energy = clamp(this.energy, 0, this.maxEnergy);
  }

  consumeSurvivalItem(item) {
    if (!item) return { ok:false, message:'Item inválido.' };
    const effects = item.effects || {};
    const checks = [
      ['hunger','fome',this.hunger,this.maxHunger],
      ['thirst','sede',this.thirst,this.maxThirst],
      ['energy','energia',this.energy,this.maxEnergy],
      ['hp','vida',this.hp,this.maxHp],
      ['stamina','resistência',this.stamina,this.maxStamina],
    ];
    const hasEffect = checks.some(([k]) => Number.isFinite(effects[k]) && effects[k] !== 0);
    if (!hasEffect) return { ok:false, message:'Este item não pode ser consumido.' };
    const wouldChange = checks.some(([k,,val,max]) => effects[k] > 0 && val < max);
    if (!wouldChange) return { ok:false, message:'Você já está no máximo para esse item.' };
    const parts = [];
    const bonus = 1 + (this.progBonuses?.consumableBonus || 0);
    for (const [k,label,,max] of checks) {
      let v = effects[k];
      if (!Number.isFinite(v) || v === 0) continue;
      if (v > 0) v = v * bonus;
      const before = this[k];
      this[k] = clamp(this[k] + v, 0, max);
      const gained = Math.round((this[k] - before) * 10) / 10;
      if (gained !== 0) parts.push(`${label} +${Math.round(gained)}`);
    }
    if (this.dead && this.hp > 0) this.dead = false;
    return { ok:true, message:`Você usou ${item.name}: ${parts.join(', ')}.` };
  }

  canSprint() {
    const sv = GAME_CONFIG.survival || {};
    return !this.dead && !this.isResting && this.stamina > (sv.staminaMinToRun ?? 12) && this.energy > 5;
  }

  applyRest(dt) {
    const sv = GAME_CONFIG.survival || {};
    this.isResting = true;
    const rb = 1 + (this.progBonuses?.restBonus || 0);
    this.energy = clamp(this.energy + (sv.restEnergyPerSec ?? 8) * rb * dt, 0, this.maxEnergy);
    this.stamina = clamp(this.stamina + (sv.staminaRegenPerSec ?? 12) * 1.5 * rb * dt, 0, this.maxStamina);
    this.hp = clamp(this.hp + 1.5 * rb * dt, 0, this.maxHp);
  }

  stopRest() { this.isResting = false; }

  updateSurvival(dt, tryingToRun) {
    if (this.dead) return;
    const sv = GAME_CONFIG.survival || {};
    const diff = DIFFICULTY_PRESETS[GAME_CONFIG.difficulty] || DIFFICULTY_PRESETS.normal;
    const min = dt / 60;
    if (!this.isResting) {
      const decayMult = Math.max(0.3, (1 + (this.progBonuses?.survivalDecayMult || 0)) * (diff.survivalDecayMult ?? 1));
      this.hunger = clamp(this.hunger - (sv.hungerDecayPerMin ?? 2.5) * min * decayMult, 0, this.maxHunger);
      this.thirst = clamp(this.thirst - (sv.thirstDecayPerMin ?? 3.5) * min * decayMult, 0, this.maxThirst);
      this.energy = clamp(this.energy - (sv.energyDecayPerMin ?? 1.5) * min * (tryingToRun ? 1.8 : 1) * decayMult, 0, this.maxEnergy);
    }
    // stamina
    if (tryingToRun && this.isMoving && this.onGround && !this.isResting) {
      this.stamina = clamp(this.stamina - (sv.staminaDrainRunPerSec ?? 18) * dt * (diff.survivalDrainMult ?? 1), 0, this.maxStamina);
    } else {
      const regenMult = this.isResting ? 1.5 : 1;
      this.stamina = clamp(this.stamina + (sv.staminaRegenPerSec ?? 12) * regenMult * dt, 0, this.maxStamina);
    }

    // mild penalties for low needs
    const low = sv.lowNeedThreshold ?? 20;
    const crit = sv.criticalNeedThreshold ?? 8;
    let hpDrainPerMin = 0;
    const needs = [this.hunger, this.thirst, this.energy];
    for (const n of needs) {
      if (n <= crit) hpDrainPerMin += (sv.criticalNeedHpDrainPerMin ?? 5);
      else if (n <= low) hpDrainPerMin += (sv.lowNeedHpDrainPerMin ?? 2);
    }
    hpDrainPerMin *= (diff.survivalDrainMult ?? 1);
    if (hpDrainPerMin > 0) {
      this._survivalHpTimer += dt;
      while (this._survivalHpTimer >= 6) { // apply every 6s, not every frame
        this._survivalHpTimer -= 6;
        const dmg = (hpDrainPerMin / 60) * 6;
        this.hp = clamp(this.hp - dmg, 0, this.maxHp);
        if (this.hp <= 0) { this.dead = true; this.onDeath?.(); break; }
      }
    } else {
      this._survivalHpTimer = 0;
    }
  }

  update(dt, input, cameraYaw) {
    if (this.damageCooldown > 0) this.damageCooldown -= dt;
    if (this.hitReactionTimer > 0) this.hitReactionTimer -= dt;
    if (this.specialCooldown > 0) this.specialCooldown -= dt;
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) { this.attackTimer = 0; this.isAttacking = false; }
    }
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloadTimer = 0; this.isReloading = false; this.reloadJustFinished = true; }
    }
    if (this.dead) {
      this._animate(dt);
      return;
    }
    if (this.isResting) {
      this.isMoving = false;
      this.isRunning = false;
      this.moveSpeed = damp(this.moveSpeed, 0, this.cfg.deceleration, dt);
      this.velocity.x = 0; this.velocity.z = 0;
      this.velocity.y -= this.cfg.gravity * dt;
      this.position.y += this.velocity.y * dt;
      if (this.position.y <= 0.18) { this.position.y = 0.18; this.velocity.y = 0; this.onGround = true; }
      this.collisions.resolveCircle(this.position, this.cfg.radius);
      this.group.position.copy(this.position);
      this.model.rotation.y = this.yaw;
      this.applyRest(dt);
      this._animate(dt);
      return;
    }
    const move = input.getMovement();

    // Stealth crouch
    if (this.onGround && !this.dead) {
      this.isCrouching = !!move.crouch;
    } else if (this.dead) this.isCrouching = false;

    const targetDir = new THREE.Vector3(move.x, 0, -move.y); // input y is forward
    const hasInput = targetDir.lengthSq() > 0.001;
    this.isMoving = hasInput;
    const wantsRun = hasInput && move.run && !this.isCrouching;
    this.isRunning = wantsRun && this.canSprint();

    if (hasInput) {
      targetDir.normalize();
      // rotate input by camera yaw
      targetDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      const targetYaw = Math.atan2(targetDir.x, targetDir.z);
      // smooth turn
      let dyaw = targetYaw - this.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      this.yaw += dyaw * Math.min(1, this.cfg.turnSpeed * dt);
    }

    const stealthCfg = GAME_CONFIG.stealth || {};
    const crouchMult = stealthCfg.crouchSpeedMult ?? 0.48;
    const baseMax = this.isRunning ? this.cfg.runSpeed : this.cfg.walkSpeed;
    const maxSpeed = this.isCrouching ? (this.cfg.walkSpeed * crouchMult) : baseMax;
    const targetSpeed = hasInput ? maxSpeed : 0;
    const accel = hasInput ? this.cfg.acceleration : this.cfg.deceleration;
    this.moveSpeed = damp(this.moveSpeed, targetSpeed, accel, dt);

    // horizontal velocity
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    this.velocity.x = forwardX * this.moveSpeed;
    this.velocity.z = forwardZ * this.moveSpeed;

    // jump/gravity
    if (this.onGround && input.consumeJump()) {
      const sv = GAME_CONFIG.survival || {};
      if (this.stamina >= 8) {
        this.isCrouching = false;
        this.velocity.y = this.cfg.jumpSpeed;
        this.onGround = false;
        this.stamina = clamp(this.stamina - (sv.staminaDrainJump ?? 10), 0, this.maxStamina);
      }
    }
    this.velocity.y -= this.cfg.gravity * dt;

    // integrate
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // ground
    if (this.position.y <= 0.18) {
      if (!this.onGround && this.velocity.y < -3) {
        this._pendingLandNoise = Math.min(1, Math.abs(this.velocity.y) / 10);
      }
      this.position.y = 0.18;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // collisions in XZ
    this.collisions.resolveCircle(this.position, this.cfg.radius);

    this.group.position.copy(this.position);
    this.model.rotation.y = this.yaw;

    this.updateSurvival(dt, this.isRunning);
    this._updateStealthNoise(dt);
    this._animate(dt);
  }

  _updateStealthNoise(dt) {
    const st = GAME_CONFIG.stealth || {};
    this._noiseCooldown = Math.max(0, (this._noiseCooldown || 0) - dt);
    let level = 0;
    if (this.onGround && this.isMoving) {
      if (this.isCrouching) level = st.crouchMoveNoise ?? 1.8;
      else if (this.isRunning) level = st.runNoise ?? 11.0;
      else level = st.walkNoise ?? 4.5;
    }
    this.landNoiseEvent = 0;
    if (this._pendingLandNoise) {
      const ln = (st.jumpLandNoise ?? 7.0) * this._pendingLandNoise;
      level = Math.max(level, ln);
      this.landNoiseEvent = ln;
      this._pendingLandNoise = 0;
    }
    // slight noise when attacking
    if (this.isAttacking) level = Math.max(level, st.attackNoise ?? 6.5);
    this.stealthNoise = level;
  }

  getNoiseRadius() { return this.stealthNoise || 0; }
  getVisibilityMult() {
    const st = GAME_CONFIG.stealth || {};
    let m = 1;
    if (this.isCrouching) m *= (st.crouchVisibilityMult ?? 0.45);
    if (this.isRunning) m *= 1.25;
    else if (this.isMoving) m *= 1.0;
    else m *= 0.75; // still/idle harder to see
    return m;
  }

  _animate(dt) {
    const speedFactor = clamp(this.moveSpeed / this.cfg.runSpeed, 0, 1);
    const moving = this.isMoving && this.onGround;
    const runFactor = clamp((speedFactor - 0.45) / 0.55, 0, 1);
    // Blend toward move/idle for smoother transitions
    const targetBlend = moving ? speedFactor : 0;
    this._animBlend += (targetBlend - this._animBlend) * Math.min(1, dt * 8);
    const b = this._animBlend;

    // Step rate synced to speed (avoids sliding feel)
    const stepRate = moving ? (3.2 + speedFactor * 7.5) : 1.1;
    this.animTime += dt * stepRate;

    // Landing detection
    if (this.onGround && !this._wasOnGround) this._landTimer = 0.18;
    this._wasOnGround = this.onGround;
    if (this._landTimer > 0) this._landTimer = Math.max(0, this._landTimer - dt);
    const landT = this._landTimer > 0 ? (this._landTimer / 0.18) : 0;

    // Turn lean
    let dyaw = this.yaw - (this._prevYaw || this.yaw);
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this._prevYaw = this.yaw;
    const targetLean = clamp(-dyaw * 2.2 * b, -0.08, 0.08);
    this._turnLean += (targetLean - this._turnLean) * Math.min(1, dt * 6);

    const swing = Math.sin(this.animTime) * (0.15 + 0.55 * b);
    const armSwing = swing * (0.75 + 0.25 * runFactor);
    // Base pose
    this.leftArm.rotation.x = armSwing;
    this.rightArm.rotation.x = -armSwing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    this.leftArm.rotation.z = 0.03 * b;
    this.rightArm.rotation.z = -0.03 * b;

    // Crouch blend
    this._crouchBlend = damp(this._crouchBlend || 0, this.isCrouching ? 1 : 0, 10, dt);
    const cb = this._crouchBlend;

    // Body bob synced to steps
    const bob = moving ? Math.abs(Math.sin(this.animTime)) * (0.015 + 0.025 * b) * (1 - cb*0.5) : Math.sin(this.animTime * 0.7) * 0.003;
    this.model.position.y = bob - landT * 0.04 - cb * 0.28;
    this.model.rotation.z = this._turnLean + (moving ? Math.sin(this.animTime) * 0.008 * b : 0);
    this.model.rotation.x = (moving ? (0.03 + 0.05 * runFactor) : 0) + cb * 0.18;
    this.model.scale.y = (1 - landT * 0.03) * (1 - cb * 0.08);

    // Idle breathing / look
    if (this.head) {
      const breathe = Math.sin(this.animTime * 0.7) * 0.006;
      this.head.rotation.y = moving ? Math.sin(this.animTime * 0.45) * 0.03 : Math.sin(this.animTime * 0.35) * 0.04;
      this.head.rotation.x = moving ? -0.03 * b : breathe;
      this.head.position.y = 1.66 + breathe + (moving ? Math.sin(this.animTime * 2) * 0.004 * b : 0);
    }

    // In-air pose
    if (!this.onGround && !this.dead) {
      const air = clamp(this.velocity.y / 8, -1, 1);
      this.leftLeg.rotation.x = -0.25 + air * 0.15;
      this.rightLeg.rotation.x = 0.15 - air * 0.1;
      this.leftArm.rotation.x = -0.35 - air * 0.1;
      this.rightArm.rotation.x = -0.35 - air * 0.1;
      this.model.rotation.x = -air * 0.04;
    }

    // Crouch pose overlay
    if (cb > 0.001) {
      this.leftLeg.rotation.x += -0.75 * cb;
      this.rightLeg.rotation.x += -0.75 * cb;
      this.leftLeg.rotation.z += 0.06 * cb;
      this.rightLeg.rotation.z += -0.06 * cb;
      this.leftArm.rotation.x += 0.35 * cb;
      this.rightArm.rotation.x += 0.35 * cb;
      if (this.head) this.head.position.y += -0.06 * cb;
    }

    // Hit reaction
    if (this.hitReactionTimer > 0) {
      const t = this.hitReactionTimer / 0.35;
      this.model.rotation.x += -0.08 * t;
      this.leftArm.rotation.x += 0.4 * t;
      this.rightArm.rotation.x += 0.4 * t;
    }

    // Attack animation
    if (this.isAttacking && this.attackDuration > 0) {
      const p = 1 - (this.attackTimer / this.attackDuration); // 0..1
      const swingPhase = p < 0.45 ? (p / 0.45) : (1 - (p - 0.45) / 0.55);
      const power = this.attackType === 'special' ? 1.4 : 1.0;
      this.rightArm.rotation.x = -1.6 * swingPhase * power;
      this.rightArm.rotation.z = -0.25 * swingPhase;
      this.leftArm.rotation.x = 0.35 * swingPhase;
      this.model.position.y += 0.01 * swingPhase;
      this.model.rotation.x += 0.04 * swingPhase;
      if (this.attackType === 'special') {
        this.model.rotation.z += -0.05 * swingPhase;
        this.leftLeg.rotation.x = -0.25 * swingPhase;
        this.rightLeg.rotation.x = 0.15 * swingPhase;
      }
    }

    if (this.dead) {
      this.model.rotation.x = -0.5;
      this.model.position.y = -0.2;
      this.model.scale.y = 1;
    }
  }
}
