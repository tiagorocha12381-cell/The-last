import { MISSIONS } from '../data/missions.js';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export class MissionSystem {
  constructor(inventory, saveSystem) {
    this.inventory = inventory;
    this.saveSystem = saveSystem;
    this.missions = clone(MISSIONS);
    this.activeId = null;
    this.onChange = null; // (missions, activeMission) => void
    this.onToast = null; // (text, ms) => void
    this.onReward = null; // (reward) => void
    this.onXPGain = null; // (amount, reason) => void
    this._rewarded = {}; // missionId -> true
    this._listeners = [];
  }

  init() {
    const save = this.saveSystem.load();
    if (save && save.missions) {
      this._applySave(save);
    } else {
      // Auto-start Mission 1 for new game
      this.startMission('m1_sinal_nevoa', { silent: true });
    }
    this._emit();
  }

  _applySave(save) {
    // Merge saved state into mission definitions (preserves structure, restores progress/state)
    const byId = new Map(this.missions.map(m => [m.id, m]));
    for (const sm of (save.missions || [])) {
      const m = byId.get(sm.id);
      if (!m) continue;
      m.state = sm.state || m.state;
      if (Array.isArray(sm.objectives)) {
        for (const so of sm.objectives) {
          const o = m.objectives.find(x => x.id === so.id);
          if (o) { o.current = Number(so.current) || 0; o.completed = !!so.completed; }
        }
      }
    }
    const savedActive = this.missions.find(m => m.id === save.activeId);
    this.activeId = (savedActive && savedActive.state === 'active') ? savedActive.id : (this.missions.find(m => m.state === 'active')?.id || null);
    this._rewarded = save.rewarded || {};
    // If no active and mission 1 not completed, start it
    const m1 = this.getMission('m1_sinal_nevoa');
    if (m1 && m1.state === 'available' && !this.activeId) {
      this.startMission('m1_sinal_nevoa', { silent: true });
    }
  }

  getMission(id) { return this.missions.find(m => m.id === id) || null; }
  getActiveMission() {
    const byId = this.missions.find(m => m.id === this.activeId);
    if (byId && byId.state === 'active') return byId;
    return this.missions.find(m => m.state === 'active') || null;
  }
  getMissions() { return this.missions; }

  startMission(id, opts = {}) {
    const m = this.getMission(id);
    if (!m || m.state === 'completed' || m.state === 'active') return false;
    m.state = 'active';
    this.activeId = id;
    if (!opts.silent) this.onToast?.(`Missão iniciada: ${m.name}`, 2200);
    this._save();
    this._emit();
    return true;
  }

  setActive(id) {
    const m = this.getMission(id);
    if (!m || m.state !== 'active') return false;
    this.activeId = id;
    this._save();
    this._emit();
    return true;
  }

  // Event: { type: 'interact'|'visit'|'collect'|'kill', target: string, amount?: number }
  reportEvent(event) {
    let changed = false;
    for (const m of this.missions) {
      if (m.state !== 'active') continue;
      for (const obj of m.objectives) {
        if (obj.completed) continue;
        if (obj.type !== event.type) continue;
        if (obj.target !== event.target) continue;
        const amount = Number(event.amount) || 1;
        obj.current = Math.min(obj.required, (Number(obj.current) || 0) + amount);
        if (obj.current >= obj.required) {
          obj.completed = true;
          this.onToast?.(`Objetivo concluído: ${obj.text}`, 1800);
          this.onXPGain?.(25, 'objetivo');
        }
        changed = true;
      }
      if (m.objectives.every(o => o.completed)) {
        this._completeMission(m);
        changed = true;
      }
    }
    if (changed) { this._save(); this._emit(); }
  }

  _completeMission(m) {
    if (m.state === 'completed') return;
    m.state = 'completed';
    this.onToast?.(`Missão concluída: ${m.name}!`, 2800);
    this._grantRewards(m);
    this.onXPGain?.(120, 'missão');
    if (this.activeId === m.id) {
      const next = this.missions.find(x => x.state === 'active');
      this.activeId = next?.id || null;
    }
  }

  _grantRewards(m) {
    if (this._rewarded[m.id]) return;
    this._rewarded[m.id] = true;
    for (const r of (m.rewards || [])) {
      if (r.kind === 'item' && r.item) {
        const res = this.inventory.addItem(r.item, r.qty || 1);
        if (res.full) this.onToast?.(`Inventário cheio: ${r.item.name}`, 2000);
        else this.onToast?.(`Recompensa: ${r.item.name} x${r.qty || 1}`, 2000);
      } else if (r.kind === 'info' && r.text) {
        this.onToast?.(r.text, 3500);
      }
      this.onReward?.(r);
    }
  }

  getActiveObjective() {
    const m = this.getActiveMission();
    if (!m) return null;
    return m.objectives.find(o => !o.completed) || null;
  }

  getObjectiveTargetPosition(targetId) {
    // Provided by world/story registry through external lookup; MissionSystem stores no positions.
    return this._targetPositions?.get(targetId) || null;
  }

  registerTargetPositions(map) {
    this._targetPositions = map; // Map<string, {pos:THREE.Vector3, radius?:number}>
  }

  update(playerPos) {
    // Auto-complete visit objectives
    if (!this._targetPositions || !playerPos) return;
    let changed = false;
    for (const m of this.missions) {
      if (m.state !== 'active') continue;
      for (const obj of m.objectives) {
        if (obj.completed || obj.type !== 'visit') continue;
        const t = this._targetPositions.get(obj.target);
        if (!t) continue;
        const r = t.radius ?? 2.5;
        const dx = playerPos.x - t.pos.x;
        const dz = playerPos.z - t.pos.z;
        if ((dx*dx + dz*dz) <= r*r) {
          obj.current = obj.required;
          obj.completed = true;
          this.onToast?.(`Objetivo concluído: ${obj.text}`, 1800);
          this.onXPGain?.(25, 'objetivo');
          changed = true;
        }
      }
      if (changed && m.objectives.every(o => o.completed)) this._completeMission(m);
    }
    if (changed) { this._save(); this._emit(); }
  }

  _save() {
    this.saveSystem.save({
      missions: this.missions.map(m => ({
        id: m.id,
        state: m.state,
        objectives: m.objectives.map(o => ({ id: o.id, current: o.current, completed: !!o.completed }))
      })),
      activeId: this.activeId,
      rewarded: this._rewarded
    });
  }

  _emit() { this.onChange?.(this.missions, this.getActiveMission()); }

  resetProgress() {
    this.saveSystem.clear();
    this.missions = clone(MISSIONS);
    this.activeId = null;
    this._rewarded = {};
    this.startMission('m1_sinal_nevoa', { silent: true });
    this._emit();
  }
}
