import { SKILL_TREE, flattenSkills } from '../data/skills.js';

export class ProgressionSystem {
  constructor(saveSystem) {
    this.saveSystem = saveSystem;
    this.level = 1;
    this.xp = 0;
    this.skillPoints = 0;
    this.skills = {}; // id -> rank
    this.onLevelUp = null; // (level, points) => void
    this.onChange = null; // () => void
    this._load();
  }

  _load() {
    const s = this.saveSystem.get() || {};
    const p = s.progression;
    if (!p) return;
    if (Number.isFinite(p.level)) this.level = Math.max(1, Math.floor(p.level));
    if (Number.isFinite(p.xp)) this.xp = Math.max(0, Math.floor(p.xp));
    if (Number.isFinite(p.skillPoints)) this.skillPoints = Math.max(0, Math.floor(p.skillPoints));
    if (p.skills && typeof p.skills === 'object') this.skills = { ...p.skills };
  }

  save() {
    this.saveSystem.save({ progression: { level: this.level, xp: this.xp, skillPoints: this.skillPoints, skills: { ...this.skills } } });
  }

  xpToNext(level = this.level) {
    return Math.floor(100 * Math.pow(1.35, Math.max(1, level) - 1));
  }

  addXP(amount, reason = '') {
    const n = Math.floor(Number(amount) || 0);
    if (n <= 0) return { leveled: false, levels: 0 };
    this.xp += n;
    let levels = 0;
    while (this.xp >= this.xpToNext(this.level)) {
      this.xp -= this.xpToNext(this.level);
      this.level++;
      this.skillPoints++;
      levels++;
    }
    if (levels > 0) this.onLevelUp?.(this.level, this.skillPoints, levels);
    this.save();
    this.onChange?.();
    return { leveled: levels > 0, levels, reason };
  }

  getSkillRank(id) { return Math.max(0, Math.floor(this.skills[id] || 0)); }

  canUnlock(id) {
    const def = flattenSkills().find(s => s.id === id);
    if (!def) return { ok: false, reason: 'Habilidade inválida.' };
    const rank = this.getSkillRank(id);
    if (rank >= def.maxRank) return { ok: false, reason: 'Nível máximo atingido.' };
    if (this.skillPoints < (def.cost || 1)) return { ok: false, reason: 'Pontos insuficientes.' };
    const reqs = def.requires || {};
    for (const [reqId, reqRank] of Object.entries(reqs)) {
      if (this.getSkillRank(reqId) < reqRank) return { ok: false, reason: 'Requisito não atendido.' };
    }
    return { ok: true };
  }

  unlock(id) {
    const check = this.canUnlock(id);
    if (!check.ok) return check;
    const def = flattenSkills().find(s => s.id === id);
    this.skillPoints -= (def.cost || 1);
    this.skills[id] = this.getSkillRank(id) + 1;
    this.save();
    this.onChange?.();
    return { ok: true, rank: this.skills[id] };
  }

  getBonuses() {
    const b = {
      maxEnergy: 0, consumableBonus: 0, survivalDecayMult: 0, restBonus: 0,
      lootBonus: 0, inventorySlots: 0, discoveryRadius: 0, craftSaveChance: 0,
      damageMult: 0, attackCooldownMult: 0, specialDamageMult: 0, damageTakenMult: 0,
    };
    for (const def of flattenSkills()) {
      const rank = this.getSkillRank(def.id);
      if (!rank) continue;
      for (const ef of (def.effects || [])) {
        if (ef.stat in b) b[ef.stat] += ef.perRank * rank;
      }
    }
    return b;
  }

  getState() {
    return { level: this.level, xp: this.xp, xpToNext: this.xpToNext(), skillPoints: this.skillPoints, skills: { ...this.skills } };
  }
}
