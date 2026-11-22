import { ITEM_DEFS } from '../data/items.js';
import { EQUIPMENT_DEFS } from './InventorySystem.js';

export const CREDITS_ID = 'credits';

const RARITY_PRICE = { comum: 12, incomum: 24, raro: 45, épico: 80, epico: 80 };
const CATEGORY_MULT = {
  Alimentos: 1.0, Bebidas: 0.95, Medicamentos: 1.25, Materiais: 0.9,
  Ferramentas: 1.3, Armas: 2.2, 'Itens de missão': 2.5, Munições: 1.2, Outros: 1.0,
};

function normCat(def) {
  const t = String(def?.type || '').toLowerCase();
  if (t === 'comida') return 'Alimentos';
  if (t === 'água' || t === 'agua' || t === 'bebida') return 'Bebidas';
  if (t === 'medicamento') return 'Medicamentos';
  if (t === 'material' || t === 'peça' || t === 'peca') return 'Materiais';
  if (t === 'ferramenta') return 'Ferramentas';
  if (t === 'equipamento' || t === 'arma') return 'Armas';
  if (t === 'munição' || t === 'municao') return 'Munições';
  if (t === 'missão' || t === 'missao') return 'Itens de missão';
  return 'Outros';
}

export function getItemDef(id) {
  if (ITEM_DEFS[id]) return { ...ITEM_DEFS[id] };
  const eq = Object.values(EQUIPMENT_DEFS).find(e => e.id === id);
  if (eq) return { ...eq };
  return null;
}

export function getPrice(def, mode = 'buy') {
  if (!def) return 0;
  const rarity = String(def.rarity || 'comum').toLowerCase();
  const base = RARITY_PRICE[rarity] ?? 12;
  const cat = normCat(def);
  const mult = CATEGORY_MULT[cat] ?? 1;
  let price = Math.max(1, Math.round(base * mult));
  // mission items are not normally sold; keep high
  if (cat === 'Itens de missão') price = Math.max(price, 60);
  if (mode === 'sell') price = Math.max(1, Math.floor(price * 0.45));
  return price;
}

export const MERCHANT_DEFS = [
  {
    id: 'npc_maya',
    name: 'Maya',
    title: 'Líder do abrigo',
    stock: [
      { id: 'canned_food', qty: 6 }, { id: 'water_bottle', qty: 6 }, { id: 'bandage', qty: 4 },
      { id: 'medkit', qty: 2 }, { id: 'energy_bar', qty: 4 }, { id: 'fabric', qty: 3 },
    ],
  },
  {
    id: 'npc_leo',
    name: 'Leo',
    title: 'Batedor',
    stock: [
      { id: 'scrap_metal', qty: 8 }, { id: 'wood_plank', qty: 6 }, { id: 'mechanical_parts', qty: 4 },
      { id: 'electronic_parts', qty: 3 }, { id: 'basic_tool', qty: 2 }, { id: 'repair_kit', qty: 2 },
      { id: 'eq_bat', qty: 1 },
    ],
  },
  {
    id: 'npc_rina',
    name: 'Rina',
    title: 'Médica',
    stock: [
      { id: 'bandage', qty: 8 }, { id: 'medkit', qty: 3 }, { id: 'water_bottle', qty: 4 },
      { id: 'canned_food', qty: 3 }, { id: 'energy_bar', qty: 3 },
    ],
  },
  {
    id: 'npc_jonas',
    name: 'Jonas',
    title: 'Sentinela da Ferrovia',
    stock: [
      { id: 'bandage', qty: 3 }, { id: 'water_bottle', qty: 3 }, { id: 'battery', qty: 3 },
      { id: 'electronic_parts', qty: 2 }, { id: 'energy_bar', qty: 2 },
    ],
  },
  {
    id: 'npc_tess',
    name: 'Tess',
    title: 'Mecânica dos Catadores',
    stock: [
      { id: 'scrap_metal', qty: 10 }, { id: 'mechanical_parts', qty: 6 }, { id: 'basic_tool', qty: 2 },
      { id: 'repair_kit', qty: 3 }, { id: 'battery', qty: 2 }, { id: 'wood_plank', qty: 4 },
    ],
  },
];

export class TradeSystem {
  constructor(inventory, saveSystem, factionSystem = null) {
    this.inventory = inventory;
    this.saveSystem = saveSystem;
    this.factionSystem = factionSystem;
    this.credits = 120;
    this.merchantStocks = {};
    this.history = [];
    this.onChange = null;
    this._load();
  }

  _defaultStocks() {
    const out = {};
    for (const m of MERCHANT_DEFS) {
      out[m.id] = {};
      for (const s of m.stock) out[m.id][s.id] = Math.max(0, Math.floor(s.qty));
    }
    return out;
  }

  _load() {
    const save = this.saveSystem?.get?.() || {};
    if (Number.isFinite(save.credits)) this.credits = Math.max(0, Math.floor(save.credits));
    if (save.merchantStocks && typeof save.merchantStocks === 'object') {
      this.merchantStocks = this._defaultStocks();
      for (const [mid, stock] of Object.entries(save.merchantStocks)) {
        if (!this.merchantStocks[mid] || !stock || typeof stock !== 'object') continue;
        for (const [id, qty] of Object.entries(stock)) {
          if (this.merchantStocks[mid][id] == null) continue;
          this.merchantStocks[mid][id] = Math.max(0, Math.floor(Number(qty) || 0));
        }
      }
    } else {
      this.merchantStocks = this._defaultStocks();
    }
    if (Array.isArray(save.tradeHistory)) this.history = save.tradeHistory.slice(-30);
  }

  save() {
    this.saveSystem?.save?.({ credits: this.credits, merchantStocks: this.merchantStocks, tradeHistory: this.history.slice(-30) });
    this.onChange?.();
  }

  getCredits() { return this.credits; }
  getMerchantDef(id) { return MERCHANT_DEFS.find(m => m.id === id) || null; }
  getStock(merchantId) { return { ...(this.merchantStocks[merchantId] || {}) }; }
  _factionId(merchantId) { return this.factionSystem?.getFactionForNpc?.(merchantId) || null; }
  _canTrade(merchantId) { const fid=this._factionId(merchantId); return fid ? this.factionSystem.canTrade(fid) : true; }
  _buyPrice(def, merchantId) { const base=getPrice(def,'buy'); const fid=this._factionId(merchantId); const mult=fid?this.factionSystem.tradePriceMult(fid):1; return Math.max(1, Math.round(base*mult)); }
  _sellPrice(def, merchantId) { const base=getPrice(def,'sell'); const fid=this._factionId(merchantId); const mult=fid?this.factionSystem.sellPriceMult(fid):1; return Math.max(1, Math.round(base*mult)); }

  getMerchantCatalog(merchantId) {
    const m = this.getMerchantDef(merchantId);
    if (!m) return [];
    const stock = this.merchantStocks[merchantId] || {};
    return m.stock.map(s => {
      const def = getItemDef(s.id);
      if (!def) return null;
      return {
        id: s.id,
        def,
        qty: Math.max(0, Math.floor(stock[s.id] ?? s.qty ?? 0)),
        buyPrice: this._buyPrice(def, merchantId),
        sellPrice: this._sellPrice(def, merchantId),
        category: normCat(def),
      };
    }).filter(Boolean);
  }

  canSellToMerchant(merchantId, itemId) {
    const m = this.getMerchantDef(merchantId);
    if (!m) return false;
    return m.stock.some(s => s.id === itemId);
  }

  buy(merchantId, itemId, qty = 1) {
    qty = Math.max(1, Math.floor(qty));
    const m = this.getMerchantDef(merchantId);
    if (!m) return { ok: false, message: 'Comerciante inválido.' };
    if (!this._canTrade(merchantId)) return { ok: false, message: 'Esta facção está hostil. Comércio indisponível.' };
    const def = getItemDef(itemId);
    if (!def) return { ok: false, message: 'Item inválido.' };
    const stock = this.merchantStocks[merchantId] || (this.merchantStocks[merchantId] = {});
    const available = Math.max(0, Math.floor(stock[itemId] ?? 0));
    if (available < qty) return { ok: false, message: 'Estoque insuficiente.' };
    const price = this._buyPrice(def, merchantId) * qty;
    if (this.credits < price) return { ok: false, message: 'Créditos insuficientes.' };
    const can = this.inventory.canAdd(def, qty);
    if (!can.ok) return { ok: false, message: can.reason === 'weight' ? 'Peso máximo atingido.' : 'Inventário cheio.' };
    // commit
    this.credits -= price;
    stock[itemId] = available - qty;
    const added = this.inventory.addItem({ ...def }, qty);
    if (!added.added || added.added < qty) {
      // rollback best effort
      this.credits += price;
      stock[itemId] = available;
      if (added.added) this.inventory.removeItem(itemId, added.added);
      return { ok: false, message: 'Não foi possível completar a compra.' };
    }
    this.history.push({ t: Date.now(), type: 'buy', merchant: m.name, item: def.name, qty, price });
    if (this.history.length > 30) this.history = this.history.slice(-30);
    this.save();
    return { ok: true, message: `Comprado: ${def.name} x${qty} por ${price} CR.` };
  }

  sell(merchantId, itemId, qty = 1) {
    qty = Math.max(1, Math.floor(qty));
    const m = this.getMerchantDef(merchantId);
    if (!m) return { ok: false, message: 'Comerciante inválido.' };
    if (!this._canTrade(merchantId)) return { ok: false, message: 'Esta facção está hostil. Comércio indisponível.' };
    const def = getItemDef(itemId);
    if (!def) return { ok: false, message: 'Item inválido.' };
    if (def.type === 'missão' || def.type === 'missao') return { ok: false, message: 'Itens de missão não podem ser vendidos.' };
    if (def.type === 'equipamento') return { ok: false, message: 'Armas não podem ser vendidas aqui (mantenha seu equipamento).' };
    if (!this.canSellToMerchant(merchantId, itemId)) return { ok: false, message: 'Este comerciante não compra esse item.' };
    const have = this.inventory.getCount(itemId);
    if (have < qty) return { ok: false, message: 'Você não possui quantidade suficiente.' };
    const price = this._sellPrice(def, merchantId) * qty;
    const removed = this.inventory.removeItem(itemId, qty);
    if (!removed) return { ok: false, message: 'Falha ao remover item.' };
    this.credits += price;
    const stock = this.merchantStocks[merchantId] || (this.merchantStocks[merchantId] = {});
    stock[itemId] = Math.max(0, Math.floor(stock[itemId] ?? 0)) + qty;
    this.history.push({ t: Date.now(), type: 'sell', merchant: m.name, item: def.name, qty, price });
    if (this.history.length > 30) this.history = this.history.slice(-30);
    this.save();
    return { ok: true, message: `Vendido: ${def.name} x${qty} por ${price} CR.` };
  }
}
