export class DecisionSystem {
  constructor(saveSystem) {
    this.saveSystem = saveSystem;
    this.decisions = {}; // id -> {id,label,consequence,state,ts,meta}
    this.onChange = null;
    this._load();
  }

  _load() {
    const s = this.saveSystem?.get?.() || {};
    const raw = s.decisions;
    if (raw && typeof raw === 'object') {
      for (const [id, d] of Object.entries(raw)) {
        if (!id || !d || typeof d !== 'object') continue;
        this.decisions[id] = {
          id,
          label: String(d.label || id),
          consequence: String(d.consequence || ''),
          state: String(d.state || 'active'),
          ts: Number(d.ts) || Date.now(),
          meta: (d.meta && typeof d.meta === 'object') ? { ...d.meta } : {},
        };
      }
    }
  }

  save() {
    this.saveSystem?.save?.({ decisions: { ...this.decisions } });
    this.onChange?.(this.getAll());
  }

  has(id) { return !!this.decisions[id]; }
  get(id) { return this.decisions[id] || null; }
  getAll() { return Object.values(this.decisions).sort((a,b)=>a.ts-b.ts); }

  record(id, { label='', consequence='', state='active', meta={} } = {}) {
    if (!id) return null;
    if (this.decisions[id]) {
      // update state/consequence only if changed; avoid duplicate record
      const d = this.decisions[id];
      let changed = false;
      if (consequence && d.consequence !== consequence) { d.consequence = consequence; changed = true; }
      if (state && d.state !== state) { d.state = state; changed = true; }
      if (meta && typeof meta === 'object') { d.meta = { ...d.meta, ...meta }; changed = true; }
      if (changed) this.save();
      return d;
    }
    const d = { id, label: label || id, consequence, state, ts: Date.now(), meta: { ...(meta||{}) } };
    this.decisions[id] = d;
    this.save();
    return d;
  }

  setState(id, state, consequence) {
    const d = this.decisions[id];
    if (!d) return null;
    if (state) d.state = state;
    if (consequence) d.consequence = consequence;
    this.save();
    return d;
  }
}
