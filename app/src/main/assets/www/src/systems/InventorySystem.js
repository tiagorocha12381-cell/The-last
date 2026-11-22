export const EQUIPMENT_DEFS = {
  pipe:      { id: 'eq_pipe',      name: 'Cano de Ferro',     description: 'Ataque básico confiável. Alcance curto.', type: 'equipamento', category: 'corpo-a-corpo', rarity: 'comum', icon: '🔧', weight: 1.8, stackMax: 1, stats: { damage: 20, range: 2.1, cooldown: 0.55, specialDamage: 35, specialCooldown: 4.0 } },
  bat:       { id: 'eq_bat',       name: 'Bastão Reforçado',  description: 'Mais alcance e bom impacto.', type: 'equipamento', category: 'corpo-a-corpo', rarity: 'incomum', icon: '🏏', weight: 2.2, stackMax: 1, stats: { damage: 28, range: 2.4, cooldown: 0.7, specialDamage: 45, specialCooldown: 5.0 } },
  machete:   { id: 'eq_machete',   name: 'Facão de Sobrevivência', description: 'Rápido e leve, bom contra grupos pequenos.', type: 'equipamento', category: 'lamina', rarity: 'raro', icon: '🗡️', weight: 1.4, stackMax: 1, stats: { damage: 34, range: 2.2, cooldown: 0.5, specialDamage: 55, specialCooldown: 4.5 } },
  hammer:    { id: 'eq_hammer',    name: 'Martelo Pesado',    description: 'Lento, mas causa grande dano.', type: 'equipamento', category: 'pesado', rarity: 'raro', icon: '🔨', weight: 3.2, stackMax: 1, stats: { damage: 45, range: 2.0, cooldown: 0.95, specialDamage: 70, specialCooldown: 6.5 } },
  shockrod:  { id: 'eq_shockrod',  name: 'Bastão de Pulso',   description: 'Equipamento fictício que libera pulso de impacto.', type: 'equipamento', category: 'especial', rarity: 'épico', icon: '⚡', weight: 2.4, stackMax: 1, stats: { damage: 30, range: 2.3, cooldown: 0.6, specialDamage: 65, specialCooldown: 5.5 } },
  pistol:    { id: 'eq_pistol',    name: 'Pistola 9mm',       description: 'Arma de fogo leve. Munição escassa.', type: 'equipamento', category: 'arma-fogo', rarity: 'incomum', icon: '🔫', weight: 1.2, stackMax: 1, stats: { damage: 38, range: 18, cooldown: 0.45, specialDamage: 38, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_9mm', magSize: 10, reloadTime: 1.6 } },
  shotgun:   { id: 'eq_shotgun',   name: 'Escopeta Curta',    description: 'Alto dano em curta distância. Recarga lenta.', type: 'equipamento', category: 'arma-fogo', rarity: 'raro', icon: '💥', weight: 3.4, stackMax: 1, stats: { damage: 72, range: 8, cooldown: 0.95, specialDamage: 72, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_shell', magSize: 5, reloadTime: 2.4 } },
  rifle:     { id: 'eq_rifle',     name: 'Fuzil de Sobrevivência', description: 'Preciso e forte, mas munição rara.', type: 'equipamento', category: 'arma-fogo', rarity: 'épico', icon: '🎯', weight: 3.0, stackMax: 1, stats: { damage: 55, range: 28, cooldown: 0.75, specialDamage: 55, specialCooldown: 0 }, weapon: { kind: 'firearm', ammoType: 'ammo_rifle', magSize: 15, reloadTime: 2.0 } },
};

const DEFAULT_STACK = 10;
const DEFAULT_WEIGHT = 0.5;
const CATEGORY_MAP = {
  comida:'Alimentos', 'água':'Bebidas', agua:'Bebidas', bebida:'Bebidas',
  material:'Materiais', peça:'Materiais', peca:'Materiais',
  ferramenta:'Ferramentas', equipamento:'Armas', arma:'Armas',
  munição:'Munições', municao:'Munições', medicamento:'Medicamentos',
  'missão':'Itens de missão', missao:'Itens de missão',
};
export function normalizeCategory(item) {
  if (!item) return 'Outros';
  const t = String(item.type || '').toLowerCase();
  if (CATEGORY_MAP[t]) return CATEGORY_MAP[t];
  if (item.consumable && item.effects?.hp) return 'Medicamentos';
  if (item.consumable && (item.effects?.hunger || item.effects?.thirst || item.effects?.energy)) return item.effects?.thirst && !item.effects?.hunger ? 'Bebidas' : 'Alimentos';
  return 'Outros';
}

export class InventorySystem {
  constructor() {
    this.baseMaxSlots = 24;
    this.maxSlots = 24;
    this.baseMaxWeight = 45;
    this.maxWeight = 45;
    this.slots = Array(this.maxSlots).fill(null); // { ...item, qty }
    this.onChange = null;
    this.equippedPrimaryId = 'eq_pipe';
    this.equippedSecondaryId = null; // no secondary weapons currently
    this.quickSlots = [null, null, null, null]; // item ids
    this.weaponState = {}; // { [weaponId]: { loaded:number } }
    this._ensureDefaultEquipment();
  }

  get equippedId() { return this.equippedPrimaryId; }
  set equippedId(v) { this.equippedPrimaryId = v; }

  applyProgressionBonuses(b = {}) {
    const newMax = this.baseMaxSlots + Math.max(0, Math.floor(b.inventorySlots || 0));
    if (newMax !== this.maxSlots) {
      const old = this.slots;
      this.maxSlots = newMax;
      this.slots = Array(this.maxSlots).fill(null);
      for (let i=0;i<old.length && i<this.slots.length;i++) this.slots[i]=old[i];
      // if shrunk, try to keep overflow by dropping extras (should not happen normally)
      for (let i=this.slots.length;i<old.length;i++) { if (old[i]) this._pushOverflow(old[i]); }
    }
    this.maxWeight = this.baseMaxWeight + Math.max(0, Number(b.carryWeight || 0));
  }

  _pushOverflow(item) { // best effort: try add back
    for (let i=0;i<this.slots.length;i++) {
      if (!this.slots[i]) { this.slots[i]=item; return true; }
    }
    return false;
  }

  _itemWeight(item) { return Number(item?.weight ?? DEFAULT_WEIGHT); }
  _stackMax(item) { return Math.max(1, Number(item?.stackMax ?? (item?.type === 'equipamento' ? 1 : DEFAULT_STACK))); }

  getTotalWeight() {
    let w = 0;
    for (const s of this.slots) if (s) w += this._itemWeight(s) * (s.qty || 1);
    return w;
  }

  getWeightInfo() { return { current: this.getTotalWeight(), max: this.maxWeight }; }

  _ensureDefaultEquipment() {
    if (!this._findById('eq_pipe')) {
      this._placeInEmptySlot({ ...EQUIPMENT_DEFS.pipe, qty: 1 });
    }
    if (!this.equippedPrimaryId || !this._findById(this.equippedPrimaryId)) {
      this.equippedPrimaryId = this._findByType('equipamento')?.id || 'eq_pipe';
    }
  }

  _findById(id) { return this.slots.find(s => s && s.id === id) || null; }
  _findByType(type) { return this.slots.find(s => s && s.type === type) || null; }

  _placeInEmptySlot(item) {
    const idx = this.slots.findIndex(s => !s);
    if (idx < 0) return -1;
    this.slots[idx] = item;
    return idx;
  }

  canAdd(item, qty = 1) {
    const w = this.getTotalWeight() + this._itemWeight(item) * qty;
    if (w > this.maxWeight + 0.001) return { ok:false, reason:'weight' };
    let remaining = qty;
    const stackMax = this._stackMax(item);
    for (const s of this.slots) {
      if (s && s.id === item.id && s.qty < stackMax) remaining -= (stackMax - s.qty);
      if (remaining <= 0) return { ok:true };
    }
    for (const s of this.slots) {
      if (!s) remaining -= stackMax;
      if (remaining <= 0) return { ok:true };
    }
    return { ok:false, reason:'slots' };
  }

  addItem(item, qty = 1) {
    if (!item || !item.id) return { added: 0, full: true };
    qty = Math.max(0, Math.floor(qty));
    if (qty === 0) return { added: 0 };
    const check = this.canAdd(item, qty);
    if (!check.ok) return { added: 0, full: true, reason: check.reason };
    const stackMax = this._stackMax(item);
    let remaining = qty;
    // stack
    for (const s of this.slots) {
      if (!s || s.id !== item.id) continue;
      const space = stackMax - (s.qty || 0);
      if (space <= 0) continue;
      const take = Math.min(space, remaining);
      s.qty += take; remaining -= take;
      if (remaining <= 0) break;
    }
    // new slots
    while (remaining > 0) {
      const idx = this.slots.findIndex(s => !s);
      if (idx < 0) break;
      const take = Math.min(stackMax, remaining);
      this.slots[idx] = { ...item, qty: take };
      remaining -= take;
    }
    const added = qty - remaining;
    if (added > 0) this._changed();
    return { added, stacked: added > 0, full: remaining > 0, reason: remaining > 0 ? 'slots' : undefined };
  }

  removeItem(id, qty = 1) {
    qty = Math.max(0, Math.floor(qty));
    if (qty === 0) return false;
    let remaining = qty;
    for (let i=0;i<this.slots.length && remaining>0;i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.qty || 0, remaining);
      s.qty -= take; remaining -= take;
      if (s.qty <= 0) this.slots[i] = null;
    }
    if (remaining === qty) return false;
    if (this.equippedPrimaryId === id && !this._findById(id)) this.equippedPrimaryId = this._findByType('equipamento')?.id || null;
    if (this.equippedSecondaryId === id && !this._findById(id)) this.equippedSecondaryId = null;
    this.quickSlots = this.quickSlots.map(qid => (qid === id && !this._findById(id)) ? null : qid);
    this._ensureDefaultEquipment();
    this._changed();
    return true;
  }

  splitStack(slotIndex, amount) {
    const s = this.slots[slotIndex];
    if (!s || (s.qty || 0) <= amount || amount <= 0) return { ok:false, reason:'invalid' };
    const empty = this.slots.findIndex(x => !x);
    if (empty < 0) return { ok:false, reason:'slots' };
    s.qty -= amount;
    this.slots[empty] = { ...s, qty: amount };
    this._changed();
    return { ok:true };
  }

  moveSlot(from, to) {
    if (from === to) return false;
    if (from < 0 || to < 0 || from >= this.slots.length || to >= this.slots.length) return false;
    const a = this.slots[from], b = this.slots[to];
    if (!a) return false;
    // merge same id
    if (b && b.id === a.id) {
      const stackMax = this._stackMax(a);
      const space = stackMax - (b.qty || 0);
      if (space > 0) {
        const take = Math.min(space, a.qty);
        b.qty += take; a.qty -= take;
        if (a.qty <= 0) this.slots[from] = null;
        this._changed();
        return true;
      }
    }
    this.slots[from] = b;
    this.slots[to] = a;
    this._changed();
    return true;
  }

  equip(id) {
    const item = this._findById(id);
    if (!item || item.type !== 'equipamento') return false;
    this.equippedPrimaryId = id;
    this._changed();
    return true;
  }
  unequipPrimary() { this.equippedPrimaryId = this._findByType('equipamento')?.id || this.equippedPrimaryId; this._changed(); }
  getEquipped() { return this._findById(this.equippedPrimaryId) || this._findByType('equipamento') || null; }
  getPrimary() { return this.getEquipped(); }
  getSecondary() { return this._findById(this.equippedSecondaryId); }

  getItems() { return this.slots.filter(Boolean); }
  getSlots() { return this.slots; }
  getCount(id) { let n=0; for (const s of this.slots) if (s && s.id===id) n += (s.qty||0); return n; }
  hasItem(id, qty = 1) { return this.getCount(id) >= qty; }

  setQuickSlot(index, itemId) { if (index<0||index>3) return; this.quickSlots[index] = itemId || null; this._changed(); }
  getQuickSlots() { return this.quickSlots.map(id => id ? this._findById(id) : null); }

  clear() {
    this.slots = Array(this.maxSlots).fill(null);
    this.quickSlots = [null,null,null,null];
    this.equippedPrimaryId = 'eq_pipe';
    this.equippedSecondaryId = null;
    this.weaponState = {};
    this._ensureDefaultEquipment();
    this._changed();
  }

  // ---- Weapon/Ammo ----
  isFirearmItem(item) { return !!(item && item.type === 'equipamento' && item.weapon?.kind === 'firearm'); }
  getWeaponDef(item) { return item?.weapon || null; }
  ensureWeaponState(item) {
    if (!this.isFirearmItem(item)) return null;
    const mag = Math.max(1, Number(item.weapon.magSize || 1));
    const ws = this.weaponState[item.id] || { loaded: 0 };
    ws.loaded = Math.max(0, Math.min(mag, Math.floor(Number(ws.loaded) || 0)));
    this.weaponState[item.id] = ws;
    return ws;
  }
  _sanitizeWeaponState() {
    for (const [id, ws] of Object.entries(this.weaponState || {})) {
      const item = this._findById(id) || Object.values(EQUIPMENT_DEFS).find(d => d.id === id);
      if (!item || !this.isFirearmItem(item)) { delete this.weaponState[id]; continue; }
      const mag = Math.max(1, Number(item.weapon.magSize || 1));
      ws.loaded = Math.max(0, Math.min(mag, Math.floor(Number(ws.loaded) || 0)));
    }
  }
  getLoadedAmmo(item = this.getEquipped()) {
    if (!this.isFirearmItem(item)) return null;
    return this.ensureWeaponState(item).loaded;
  }
  getReserveAmmo(item = this.getEquipped()) {
    if (!this.isFirearmItem(item)) return null;
    return this.getCount(item.weapon.ammoType);
  }
  getAmmoInfo(item = this.getEquipped()) {
    if (!this.isFirearmItem(item)) return { firearm:false, loaded:null, reserve:null, magSize:null, ammoType:null, reloadTime:null };
    const ws = this.ensureWeaponState(item);
    return { firearm:true, loaded:ws.loaded, reserve:this.getCount(item.weapon.ammoType), magSize:item.weapon.magSize, ammoType:item.weapon.ammoType, reloadTime:item.weapon.reloadTime || 1.5 };
  }
  canReload(item = this.getEquipped()) {
    const info = this.getAmmoInfo(item);
    if (!info.firearm) return { ok:false, reason:'not_firearm' };
    if (info.loaded >= info.magSize) return { ok:false, reason:'full' };
    if (info.reserve <= 0) return { ok:false, reason:'no_reserve' };
    return { ok:true, need: info.magSize - info.loaded, reserve: info.reserve };
  }
  reloadEquipped(item = this.getEquipped()) {
    const can = this.canReload(item);
    if (!can.ok) return { ok:false, reason:can.reason };
    const ws = this.ensureWeaponState(item);
    const mag = item.weapon.magSize;
    const need = mag - ws.loaded;
    const take = Math.min(need, this.getCount(item.weapon.ammoType));
    if (take <= 0) return { ok:false, reason:'no_reserve' };
    const removed = this.removeItem(item.weapon.ammoType, take);
    if (!removed) return { ok:false, reason:'no_reserve' };
    ws.loaded = Math.min(mag, ws.loaded + take);
    this.weaponState[item.id] = ws;
    this._changed();
    return { ok:true, loaded:ws.loaded, added:take, reserve:this.getCount(item.weapon.ammoType) };
  }
  consumeLoadedAmmo(item = this.getEquipped(), amount = 1) {
    if (!this.isFirearmItem(item)) return { ok:false, reason:'not_firearm' };
    const ws = this.ensureWeaponState(item);
    const need = Math.max(1, Math.floor(amount));
    if (ws.loaded < need) return { ok:false, reason:'empty', loaded:ws.loaded };
    ws.loaded -= need;
    this.weaponState[item.id] = ws;
    this._changed();
    return { ok:true, loaded:ws.loaded };
  }

  serialize() {
    return {
      version: 2,
      maxSlots: this.maxSlots,
      slots: this.slots.map(s => s ? { ...s } : null),
      equippedId: this.equippedPrimaryId,
      equippedPrimaryId: this.equippedPrimaryId,
      equippedSecondaryId: this.equippedSecondaryId,
      quickSlots: [...this.quickSlots],
      weaponState: { ...this.weaponState },
    };
  }

  loadState(state) {
    if (!state) return false;
    const placeDirect = (item, qty) => {
      qty = Math.max(1, Math.floor(qty || 1));
      const stackMax = this._stackMax(item);
      let remaining = qty;
      for (const s of this.slots) {
        if (!s || s.id !== item.id) continue;
        const space = stackMax - (s.qty || 0);
        if (space <= 0) continue;
        const take = Math.min(space, remaining);
        s.qty += take; remaining -= take;
        if (remaining <= 0) return;
      }
      while (remaining > 0) {
        const idx = this.slots.findIndex(s => !s);
        if (idx < 0) break;
        const take = Math.min(stackMax, remaining);
        this.slots[idx] = { ...item, qty: take };
        remaining -= take;
      }
    };

    if (Array.isArray(state.slots)) {
      this.maxSlots = Math.max(24, Number(state.maxSlots) || this.maxSlots);
      this.slots = Array(this.maxSlots).fill(null);
      state.slots.slice(0, this.maxSlots).forEach((s, i) => {
        if (s && s.id) this.slots[i] = { ...s, qty: Math.max(1, Math.floor(s.qty || 1)) };
      });
      this.equippedPrimaryId = state.equippedPrimaryId || state.equippedId || null;
      this.equippedSecondaryId = state.equippedSecondaryId || null;
      if (Array.isArray(state.quickSlots)) this.quickSlots = [0,1,2,3].map(i => state.quickSlots[i] || null);
    } else if (Array.isArray(state.items)) {
      this.slots = Array(this.maxSlots).fill(null);
      for (const it of state.items) {
        if (it && it.id) placeDirect({ ...it }, Math.max(1, Math.floor(it.qty || 1)));
      }
      this.equippedPrimaryId = state.equippedId || null;
    } else {
      return false;
    }
    this._ensureDefaultEquipment();
    if (this.equippedPrimaryId && !this._findById(this.equippedPrimaryId)) this.equippedPrimaryId = this._findByType('equipamento')?.id || null;
    this.quickSlots = this.quickSlots.map(id => (id && this._findById(id)) ? id : null);
    // weaponState
    this.weaponState = {};
    if (state.weaponState && typeof state.weaponState === 'object') {
      for (const [wid, ws] of Object.entries(state.weaponState)) {
        if (!wid || !ws || typeof ws !== 'object') continue;
        const loaded = Math.max(0, Math.floor(Number(ws.loaded) || 0));
        this.weaponState[wid] = { loaded };
      }
    }
    this._sanitizeWeaponState();
    this._changed();
    return true;
  }

  _changed() { this.onChange?.(this.getItems()); }
}
