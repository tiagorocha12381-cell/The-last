import { FACTIONS, repStatus } from '../data/factions.js';
import { clamp } from '../utils/MathUtils.js';

export class FactionSystem {
  constructor(saveSystem) {
    this.saveSystem = saveSystem;
    this.defs = FACTIONS;
    this.rep = {};
    this.decisions = {}; // id -> true
    this.onChange = null;
    this._load();
  }

  _load() {
    const s = this.saveSystem?.get?.() || {};
    const f = s.factions || {};
    const savedRep = f.rep || {};
    this.decisions = { ...(f.decisions || {}) };
    for (const def of this.defs) {
      const v = savedRep[def.id];
      this.rep[def.id] = Number.isFinite(v) ? clamp(v, -100, 100) : def.defaultRep;
    }
  }

  save() {
    this.saveSystem?.save?.({ factions: { rep: { ...this.rep }, decisions: { ...this.decisions } } });
    this.onChange?.(this.getAll());
  }

  getAll() { return this.defs.map(d => this.getFaction(d.id)); }
  getDef(id) { return this.defs.find(f => f.id === id) || null; }
  getRep(id) { return this.rep[id] ?? this.getDef(id)?.defaultRep ?? 0; }
  getStatus(id) { return repStatus(this.getRep(id)); }
  getFaction(id) {
    const def = this.getDef(id);
    if (!def) return null;
    const rep = this.getRep(id);
    return { ...def, rep, status: repStatus(rep) };
  }

  setDecision(id, value = true) { this.decisions[id] = !!value; this.save(); }
  hasDecision(id) { return !!this.decisions[id]; }

  addRep(id, amount = 0, reason = '') {
    if (!this.getDef(id)) return;
    this.rep[id] = clamp((this.getRep(id) || 0) + amount, -100, 100);
    this.save();
    return { id, rep: this.rep[id], status: this.getStatus(id), reason };
  }

  canTrade(id) { return this.getStatus(id) !== 'hostil'; }
  tradePriceMult(id) {
    const s = this.getStatus(id);
    if (s === 'amigável') return 0.9;
    if (s === 'hostil') return 1.25;
    return 1.0;
  }
  sellPriceMult(id) {
    const s = this.getStatus(id);
    if (s === 'amigável') return 1.1;
    if (s === 'hostil') return 0.75;
    return 1.0;
  }

  getFactionForNpc(npcId) {
    if (['npc_maya','npc_leo','npc_rina'].includes(npcId)) return 'refugio_mercado';
    if (npcId === 'npc_jonas') return 'sentinelas_ferrovia';
    if (npcId === 'npc_tess') return 'catadores';
    return null;
  }
}
