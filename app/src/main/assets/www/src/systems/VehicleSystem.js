import * as THREE from 'three';
import { clamp, damp } from '../utils/MathUtils.js';

export class VehicleSystem {
  constructor(scene, collisions, interactionSystem, input, hud, saveSystem) {
    this.scene = scene;
    this.collisions = collisions;
    this.interactionSystem = interactionSystem;
    this.input = input;
    this.hud = hud;
    this.saveSystem = saveSystem;
    this.vehicles = [];
    this.active = null; // vehicle player is driving
    this._saved = this.saveSystem.get()?.vehicles || {};
  }

  registerFromProps(propVehicles = []) {
    for (const pv of propVehicles) {
      if (!pv.drivable || !pv.mesh) continue;
      const v = {
        id: pv.id || `veh_${this.vehicles.length}`,
        name: pv.name || 'Veículo',
        mesh: pv.mesh,
        collision: pv.collision, // static AABB in CollisionSystem
        hw: pv.hw || 1.3, hh: pv.hh || 1.5, hd: pv.hd || 2.5,
        pos: pv.mesh.position.clone(),
        yaw: pv.mesh.rotation.y || 0,
        speed: 0,
        steer: 0,
        maxSpeed: 10.5,
        maxReverse: 4.5,
        accel: 7.5,
        brake: 10,
        friction: 2.2,
        steerRate: 1.8,
        radius: Math.max(pv.hw, pv.hd) * 0.8,
        fuel: 100,
        maxFuel: 100,
        damage: 0,
        usable: true,
      };
      // restore saved state
      const sv = this._saved[v.id];
      if (sv) {
        if (Number.isFinite(sv.x)) v.pos.x = sv.x;
        if (Number.isFinite(sv.z)) v.pos.z = sv.z;
        if (Number.isFinite(sv.yaw)) v.yaw = sv.yaw;
        if (Number.isFinite(sv.fuel)) v.fuel = clamp(sv.fuel, 0, v.maxFuel);
        if (Number.isFinite(sv.damage)) v.damage = clamp(sv.damage, 0, 100);
        v.speed = 0;
        v.mesh.position.x = v.pos.x; v.mesh.position.z = v.pos.z; v.mesh.rotation.y = v.yaw;
        this._updateStaticCollision(v);
      }
      this.vehicles.push(v);
      this._registerInteraction(v);
    }
  }

  _registerInteraction(v) {
    this.interactionSystem.register({
      id: `enter_${v.id}`,
      type: 'vehicle',
      name: v.name,
      description: 'Veículo utilizável. Entre para dirigir.',
      getPosition: () => { const p = v.pos.clone(); p.y = 0.2; return p; },
      radius: 2.8,
      promptLabel: `Entrar: ${v.name}`,
      onInteract: (player, context) => this._enter(v, player, context),
    });
  }

  _updateStaticCollision(v) {
    if (!v.collision) return;
    const cos = Math.cos(v.yaw), sin = Math.sin(v.yaw);
    const corners = [[-v.hw,-v.hd],[v.hw,-v.hd],[v.hw,v.hd],[-v.hw,v.hd]].map(([cx,cz]) => [v.pos.x + cx*cos - cz*sin, v.pos.z + cx*sin + cz*cos]);
    const xs = corners.map(c=>c[0]), zs = corners.map(c=>c[1]);
    v.collision.min.set(Math.min(...xs), 0, Math.min(...zs));
    v.collision.max.set(Math.max(...xs), v.hh, Math.max(...zs));
  }

  _enter(v, player, context) {
    if (this.active) return { message: 'Você já está em um veículo.' };
    if (!v.usable) return { message: 'Este veículo não está utilizável.' };
    if (v.damage >= 100) {
      // simple repair with scrap metal
      const inv = context?.inventory;
      if (inv?.hasItem('scrap_metal')) {
        inv.removeItem('scrap_metal', 1);
        v.damage = Math.max(0, v.damage - 35);
        v.usable = true;
        this._save();
        return { message: `${v.name} reparado parcialmente com sucata (-35% dano).` };
      }
      return { message: 'Este veículo está muito danificado. Use sucata metálica para reparar.' };
    }
    if (v.fuel <= 0) return { message: 'Sem combustível. Este veículo não pode ser ligado.' };
    this.active = v;
    v.speed = 0;
    // disable static collision while driving (we'll resolve by circle)
    this.collisions.setBoxEnabled(v.collision, false);
    player.group.visible = false;
    player.velocity.set(0,0,0);
    player.isResting = false;
    this.hud.setStatus('DIRIGINDO');
    this.hud.showToast(`Você entrou em: ${v.name}`, 1400);
    return { message: '' };
  }

  exit(player) {
    const v = this.active;
    if (!v) return false;
    // find exit point on left side
    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const exitPos = v.pos.clone().addScaledVector(side, 1.8);
    exitPos.y = 0.18;
    // simple clearance check
    const test = exitPos.clone();
    this.collisions.resolveCircle(test, player.cfg.radius);
    if (test.distanceTo(exitPos) > 0.5) {
      // try right side
      const exitPos2 = v.pos.clone().addScaledVector(side, -1.8); exitPos2.y = 0.18;
      const test2 = exitPos2.clone(); this.collisions.resolveCircle(test2, player.cfg.radius);
      if (test2.distanceTo(exitPos2) > 0.5) {
        this.hud.showToast('Não há espaço seguro para sair.', 1400);
        return false;
      }
      exitPos.copy(test2);
    } else {
      exitPos.copy(test);
    }
    player.position.copy(exitPos);
    player.group.position.copy(player.position);
    player.group.visible = true;
    player.velocity.set(0,0,0);
    v.speed = 0;
    this._updateStaticCollision(v);
    this.collisions.setBoxEnabled(v.collision, true);
    this.active = null;
    this.hud.setStatus('EXPLORANDO');
    this.hud.showToast('Você saiu do veículo.', 1200);
    this._save();
    return true;
  }

  isDriving() { return !!this.active; }
  getActive() { return this.active; }

  update(dt, player, cam) {
    const v = this.active;
    if (!v) return;
    // controls: W/S or up/down = accel/brake, A/D = steer
    const move = this.input.getMovement();
    const throttle = move.y; // 1 forward, -1 back
    const steerInput = move.x;
    const wantsExit = this.input.consumeInteract() || this.input.consumeJump(); // jump or interact to exit? better interact/E
    // We used consumeInteract in main for interaction; here we need exit. We'll check a flag.
    // Better: handle exit via input.consumeVehicleExit() or use interact. We'll manage in main.
  }

  handleExitInput(player) {
    if (this.active) return this.exit(player);
    return false;
  }

  drive(dt, player, cam) {
    const v = this.active;
    if (!v) return;
    const move = this.input.getMovement();
    const throttle = move.y;
    const steerInput = move.x;
    const braking = this.input.keys.has('Space') || this.input.keys.has('KeyS') || this.input.keys.has('ArrowDown') ? (throttle < 0 ? -1 : (this.input.keys.has('Space') ? 1 : 0)) : 0;

    if (throttle > 0.1) {
      v.speed += v.accel * throttle * dt;
    } else if (throttle < -0.1) {
      // reverse or brake
      if (v.speed > 0.5) v.speed -= v.brake * Math.abs(throttle) * dt;
      else v.speed -= v.accel * 0.6 * Math.abs(throttle) * dt;
    } else {
      // friction
      if (Math.abs(v.speed) < 0.2) v.speed = 0;
      else v.speed -= Math.sign(v.speed) * v.friction * dt;
    }
    if (this.input.keys.has('Space') || this.input._vehBrake) {
      if (v.speed > 0) v.speed = Math.max(0, v.speed - v.brake * 1.2 * dt);
      else if (v.speed < 0) v.speed = Math.min(0, v.speed + v.brake * 1.2 * dt);
    }

    // fuel consumption / empty
    if (Math.abs(v.speed) > 0.3) v.fuel = clamp(v.fuel - dt * 0.35, 0, v.maxFuel);
    if (v.fuel <= 0) {
      v.speed *= Math.exp(-2.5 * dt);
      if (Math.abs(v.speed) < 0.15) v.speed = 0;
    }
    v.speed = clamp(v.speed, -v.maxReverse, v.maxSpeed);

    // steering - stronger at low/medium speed, less at very high
    const steerFactor = clamp(Math.abs(v.speed) / 3, 0, 1);
    if (Math.abs(steerInput) > 0.01 && Math.abs(v.speed) > 0.2) {
      const dir = v.speed >= 0 ? 1 : -1;
      v.yaw -= steerInput * v.steerRate * steerFactor * dt * dir;
    }

    // move
    const forward = new THREE.Vector3(Math.sin(v.yaw), 0, Math.cos(v.yaw));
    v.pos.addScaledVector(forward, v.speed * dt);
    v.pos.y = 0.18;

    // world bounds simple clamp
    v.pos.x = clamp(v.pos.x, -140, 140);
    v.pos.z = clamp(v.pos.z, -140, 140);

    // collision with world (circle approximation)
    const before = v.pos.clone();
    this.collisions.resolveCircle(v.pos, v.radius);
    if (v.pos.distanceTo(before) > 0.01) {
      // hit something - reduce speed
      v.speed *= -0.2;
      v.damage = clamp(v.damage + Math.abs(v.speed) * 0.5, 0, 100);
    }

    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    player.position.copy(v.pos);
    player.group.position.copy(v.pos);
  }

  getCameraTarget() {
    const v = this.active;
    if (!v) return null;
    const t = v.pos.clone();
    t.y += 0.8;
    return t;
  }

  _save() {
    const data = {};
    for (const v of this.vehicles) data[v.id] = { x: v.pos.x, z: v.pos.z, yaw: v.yaw, fuel: v.fuel, damage: v.damage };
    this.saveSystem.save({ vehicles: data });
  }

  saveState() { this._save(); }
}
