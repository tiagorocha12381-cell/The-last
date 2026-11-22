import { CRAFTING_RECIPES, ITEM_DEFS } from '../data/items.js';
import { normalizeCategory } from '../systems/InventorySystem.js';

const CATS = ['Todos','Armas','Munições','Alimentos','Bebidas','Materiais','Medicamentos','Ferramentas','Itens de missão','Outros'];

export class InventoryUI {
  constructor(inventory, opts = {}) {
    this.inventory = inventory;
    this.onUseItem = opts.onUseItem || null;
    this.onCraft = opts.onCraft || null;
    this.craftSaveChance = 0;
    this.overlay = document.getElementById('inventory-overlay');
    this.grid = document.getElementById('inventory-grid');
    this.detail = document.getElementById('inventory-detail');
    this.count = document.getElementById('inventory-count');
    this.weightEl = document.getElementById('inventory-weight');
    this.closeBtn = document.getElementById('inv-close');
    this.tabItems = document.getElementById('inv-tab-items');
    this.tabCraft = document.getElementById('inv-tab-craft');
    this.bodyItems = document.getElementById('inventory-body-items');
    this.bodyCraft = document.getElementById('inventory-body-craft');
    this.craftList = document.getElementById('craft-list');
    this.craftDetail = document.getElementById('craft-detail');
    this.equipRow = document.getElementById('inv-equip-row');
    this.catsEl = document.getElementById('inv-cats');
    this.quickSlotsEl = document.getElementById('inv-quickslots');
    this.isOpen = false;
    this.selectedSlot = null; // slot index
    this.moveFrom = null;
    this.selectedRecipeId = null;
    this.tab = 'items';
    this.cat = 'Todos';
    this.onOpenChange = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    this.tabItems?.addEventListener('click', () => this.setTab('items'));
    this.tabCraft?.addEventListener('click', () => this.setTab('craft'));
    this.inventory.onChange = () => { if (this.isOpen) this.render(); };
  }

  setTab(tab) {
    this.tab = tab;
    this.tabItems?.classList.toggle('active', tab === 'items');
    this.tabCraft?.classList.toggle('active', tab === 'craft');
    this.bodyItems?.classList.toggle('hidden', tab !== 'items');
    this.bodyCraft?.classList.toggle('hidden', tab !== 'craft');
    this.render();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() { this.isOpen = true; this.overlay.classList.remove('hidden'); this.overlay.setAttribute('aria-hidden', 'false'); this.render(); this.onOpenChange?.(true); }
  close() { this.isOpen = false; this.moveFrom = null; this.overlay.classList.add('hidden'); this.overlay.setAttribute('aria-hidden', 'true'); this.onOpenChange?.(false); }

  render() {
    const wi = this.inventory.getWeightInfo?.() || { current: 0, max: 0 };
    this.count.textContent = `${this.inventory.getItems().length}/${this.inventory.maxSlots} slots`;
    if (this.weightEl) this.weightEl.textContent = `Peso: ${wi.current.toFixed(1)}/${wi.max.toFixed(1)}kg`;
    if (this.tab === 'craft') this._renderCraft();
    else this._renderItems();
  }

  _renderItems() {
    const slots = this.inventory.getSlots?.() || [];
    const eqId = this.inventory.equippedPrimaryId || this.inventory.equippedId;
    // equip row
    if (this.equipRow) {
      const primary = this.inventory.getPrimary?.() || this.inventory.getEquipped?.();
      this.equipRow.innerHTML = `
        <div class="inv-equip-card"><div class="inv-equip-label">ARMA PRINCIPAL</div><div class="inv-equip-item">${primary ? `<span class="inv-equip-icon">${primary.icon||'🔧'}</span><div><div class="inv-equip-name">${primary.name}</div><div class="inv-equip-sub">${primary.rarity||'comum'} · ${primary.category||''}</div></div>` : '<span class="inv-equip-empty">Vazio</span>'}</div></div>
        <div class="inv-equip-card"><div class="inv-equip-label">SECUNDÁRIA</div><div class="inv-equip-item"><span class="inv-equip-empty">Não disponível</span></div></div>
      `;
    }
    // categories
    if (this.catsEl) {
      const counts = {};
      for (const s of slots) { if (!s) continue; const c=normalizeCategory(s); counts[c]=(counts[c]||0)+1; }
      this.catsEl.innerHTML = CATS.map(c => `<button type="button" class="inv-cat ${this.cat===c?'active':''}" data-cat="${c}">${c}${c!=='Todos' && counts[c]?` <small>${counts[c]}</small>`:''}</button>`).join('');
      this.catsEl.querySelectorAll('.inv-cat').forEach(b=>b.addEventListener('click',()=>{ this.cat=b.dataset.cat; this.render(); }));
    }
    // grid
    this.grid.innerHTML = '';
    slots.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const visible = !item || this.cat === 'Todos' || normalizeCategory(item) === this.cat;
      const selected = this.selectedSlot === idx;
      const equipped = item && item.id === eqId;
      const moving = this.moveFrom === idx;
      const rarity = (item?.rarity || '').toLower();
      btn.className = `inv-item inv-slot ${selected?'selected':''} ${equipped?'equipped':''} ${moving?'moving':''} ${!item?'empty':''} ${rarity?`rarity-${rarity}`:''} ${!visible?'dimmed':''}`;
      if (item) {
        btn.innerHTML = `<div class="inv-item-icon">${item.icon||'📦'}</div><div class="inv-item-name">${item.name}${equipped?' <small>(E)</small>':''}</div><div class="inv-item-qty">${item.type==='equipamento' ? (item.rarity||'') : 'x'+item.qty}</div>`;
      } else {
        btn.innerHTML = `<div class="inv-item-icon inv-empty-icon">+</div><div class="inv-item-name">Vazio</div><div class="inv-item-qty">slot</div>`;
      }
      btn.addEventListener('click', () => this._onSlotClick(idx));
      this.grid.appendChild(btn);
    });
    // quick slots
    if (this.quickSlotsEl) {
      const qs = this.inventory.getQuickSlots?.() || [null,null,null,null];
      this.quickSlotsEl.innerHTML = `<div class="inv-quick-title">ACESSO RÁPIDO</div><div class="inv-quick-row">${qs.map((it,i)=>`<button type="button" class="inv-quick-btn ${it?'has':''}" data-q="${i}"><span class="inv-quick-key">${i+1}</span><span class="inv-quick-icon">${it?.icon||'—'}</span><span class="inv-quick-name">${it?it.name:'Vazio'}</span></button>`).join('')}</div>`;
      this.quickSlotsEl.querySelectorAll('.inv-quick-btn').forEach(b=>b.addEventListener('click',()=>{
        const qi=Number(b.dataset.q);
        const sel = this.selectedSlot!=null ? slots[this.selectedSlot] : null;
        if (sel) { this.inventory.setQuickSlot(qi, sel.id); this.render(); }
      }));
    }
    this._renderDetail(slots[this.selectedSlot] || null, eqId, this.selectedSlot);
  }

  _onSlotClick(idx) {
    const slots = this.inventory.getSlots?.() || [];
    const item = slots[idx];
    if (this.moveFrom != null) {
      if (this.moveFrom !== idx) this.inventory.moveSlot(this.moveFrom, idx);
      this.selectedSlot = idx;
      this.moveFrom = null;
      this.render();
      return;
    }
    this.selectedSlot = idx;
    this.render();
  }

  _renderDetail(item, eqId, slotIndex) {
    if (!item) { this.detail.innerHTML = '<div class="detail-empty">Selecione um item. Use "Mover" e toque em outro slot para trocar.</div>'; return; }
    const isEquip = item.type === 'equipamento';
    const equipped = eqId === item.id;
    const stats = item.stats ? `<div class="detail-stats">Dano: ${item.stats.damage} · Alcance: ${item.stats.range} · CD: ${item.stats.cooldown}s<br>Especial: ${item.stats.specialDamage} · CD Esp.: ${item.stats.specialCooldown}s</div>` : '';
    const eff = item.effects ? Object.entries(item.effects).map(([k,v])=>{ const labels={hunger:'Fome',thirst:'Sede',energy:'Energia',hp:'Vida',stamina:'Resistência',vehicleRepair:'Reparo veículo'}; return `${labels[k]||k} +${v}`; }).join(' · ') : '';
    const effectsHtml = eff ? `<div class="detail-stats">Efeito: ${eff}</div>` : '';
    const cat = normalizeCategory(item);
    const canUse = !!item.consumable && !!item.effects && typeof this.onUseItem === 'function';
    const canSplit = !isEquip && (item.qty||0) > 1;
    const qsIdx = (this.inventory.quickSlots||[]).indexOf(item.id);
    this.detail.innerHTML = `
      <div class="detail-icon">${item.icon||'📦'}</div>
      <div class="detail-name">${item.name}</div>
      <div class="detail-type">${cat}${item.rarity ? ' · '+item.rarity : ''}${equipped?' · EQUIPADO':''}</div>
      <div class="detail-desc">${item.description||''}</div>
      ${stats}${effectsHtml}
      <div class="detail-qty">${isEquip ? (equipped?'Equipado':'Não equipado') : `Quantidade: ${item.qty}`} · Peso: ${(Number(item.weight||0.5)*(item.qty||1)).toFixed(1)}kg</div>
      <div class="detail-actions detail-actions-wrap">
        ${canUse ? '<button class="inv-action" id="inv-use" type="button">Usar</button>' : ''}
        ${isEquip && !equipped ? '<button class="inv-action" id="inv-equip" type="button">Equipar</button>' : ''}
        <button class="inv-action secondary" id="inv-move" type="button">${this.moveFrom===slotIndex?'Cancelar mover':'Mover'}</button>
        ${canSplit ? '<button class="inv-action secondary" id="inv-split" type="button">Dividir</button>' : ''}
        <button class="inv-action secondary" id="inv-quick" type="button">${qsIdx>=0?`Remover atalho ${qsIdx+1}`:'Atalho 1-4'}</button>
        <button class="inv-action danger" id="inv-discard" type="button">Descartar</button>
      </div>
      <div class="detail-stats">Toque em um slot vazio/outro item após "Mover" para trocar. Para atalho, selecione item e clique no slot 1-4.</div>
    `;
    this.detail.querySelector('#inv-use')?.addEventListener('click', () => {
      const res = this.onUseItem?.(item);
      if (res?.ok) { this.inventory.removeItem(item.id, 1); if (!this.inventory.getItems().find(i=>i.id===item.id)) this.selectedSlot=null; }
      this.render();
    });
    this.detail.querySelector('#inv-equip')?.addEventListener('click', () => { this.inventory.equip(item.id); this.render(); });
    this.detail.querySelector('#inv-move')?.addEventListener('click', () => { this.moveFrom = this.moveFrom===slotIndex ? null : slotIndex; this.render(); });
    this.detail.querySelector('#inv-split')?.addEventListener('click', () => {
      const max = (item.qty||1)-1;
      const v = prompt(`Dividir "${item.name}" (1-${max}):`, String(Math.floor(item.qty/2)));
      if (v==null) return;
      const n = Math.max(1, Math.min(max, Math.floor(Number(v)||0)));
      const res = this.inventory.splitStack(slotIndex, n);
      if (!res.ok) alert(res.reason==='slots' ? 'Sem espaço para dividir.' : 'Não foi possível dividir.');
      this.render();
    });
    this.detail.querySelector('#inv-quick')?.addEventListener('click', () => {
      if (qsIdx>=0) { this.inventory.setQuickSlot(qsIdx, null); this.render(); return; }
      const v = prompt('Atribuir a qual atalho? (1-4)', '1');
      if (v==null) return;
      const n = Math.floor(Number(v));
      if (n>=1 && n<=4) { this.inventory.setQuickSlot(n-1, item.id); this.render(); }
    });
    this.detail.querySelector('#inv-discard')?.addEventListener('click', () => {
      const qty = item.type==='equipamento' ? 1 : Math.max(1, Math.min(item.qty||1, Math.floor(Number(prompt(`Descartar quantas unidades de "${item.name}"? (1-${item.qty||1})`, '1'))||0)));
      if (!qty) return;
      if (!confirm(`Descartar ${qty}x ${item.name}? Esta ação não pode ser desfeita.`)) return;
      this.inventory.removeItem(item.id, qty);
      if (!this.inventory.getSlots()[slotIndex]) this.selectedSlot = null;
      this.render();
    });
  }

  _renderCraft() {
    const items = this.inventory.getItems();
    this.count.textContent = `${items.length}/${this.inventory.maxSlots} slots`;
    this.craftList.innerHTML = '';
    for (const r of CRAFTING_RECIPES) {
      const can = this._canCraft(r);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-item' + (this.selectedRecipeId === r.id ? ' selected' : '');
      btn.innerHTML = `<div class="craft-name">${r.name}</div><div class="craft-meta ${can ? 'craft-ok' : 'craft-missing'}">${can ? 'Pronto para fabricar' : 'Faltam materiais'}</div>`;
      btn.addEventListener('click', () => { this.selectedRecipeId = r.id; this.render(); });
      this.craftList.appendChild(btn);
    }
    this._renderCraftDetail(CRAFTING_RECIPES.find(r => r.id === this.selectedRecipeId) || null);
  }

  _canCraft(recipe) { return recipe.ingredients.every(ing => this.inventory.getCount(ing.itemId) >= ing.qty); }

  _renderCraftDetail(recipe) {
    if (!recipe) { this.craftDetail.innerHTML = '<div class="detail-empty">Selecione uma receita para ver detalhes.</div>'; return; }
    const resultDef = ITEM_DEFS[recipe.result.itemId] || { name: recipe.result.itemId, icon: '📦', description: '' };
    const can = this._canCraft(recipe);
    const ings = recipe.ingredients.map(ing => {
      const def = ITEM_DEFS[ing.itemId] || { name: ing.itemId, icon: '📦' };
      const have = this.inventory.getCount(ing.itemId);
      const ok = have >= ing.qty;
      return `<div class="craft-ingredient"><span>${def.icon || '📦'} ${def.name}</span><span class="${ok ? 'craft-ok' : 'craft-missing'}">${have}/${ing.qty}</span></div>`;
    }).join('');
    this.craftDetail.innerHTML = `
      <div class="detail-icon">${resultDef.icon || '📦'}</div>
      <div class="detail-name">${recipe.name}</div>
      <div class="detail-type">Receita de fabricação</div>
      <div class="detail-desc">${recipe.description || resultDef.description || ''}</div>
      <div class="craft-ingredients"><strong>Materiais necessários:</strong>${ings}</div>
      <div class="detail-qty">Resultado: ${resultDef.name} x${recipe.result.qty}</div>
      <div class="detail-actions"><button class="inv-action" id="craft-do" type="button" ${can ? '' : 'disabled'}>${can ? 'Fabricar' : 'Materiais insuficientes'}</button></div>
      ${!can ? '<div class="detail-stats craft-missing">Faltam materiais para fabricar este item.</div>' : ''}
    `;
    this.craftDetail.querySelector('#craft-do')?.addEventListener('click', () => {
      if (!this._canCraft(recipe)) return;
      const resDef = ITEM_DEFS[recipe.result.itemId];
      if (!resDef) return;
      const check = this.inventory.canAdd(resDef, recipe.result.qty);
      // canAdd is conservative; craft may free slots. Try anyway after remove.
      const saved = [];
      for (const ing of recipe.ingredients) {
        let take = ing.qty;
        if (this.craftSaveChance > 0 && take > 0 && Math.random() < this.craftSaveChance) { take = Math.max(0, take - 1); saved.push(ing.itemId); }
        if (take > 0) this.inventory.removeItem(ing.itemId, take);
      }
      const added = this.inventory.addItem({ ...resDef }, recipe.result.qty);
      if (added.full || added.added === 0) {
        for (const ing of recipe.ingredients) {
          let take = ing.qty; if (saved.includes(ing.itemId)) take = Math.max(0,take-1);
          if (take>0) this.inventory.addItem(ITEM_DEFS[ing.itemId] || { id: ing.itemId, name: ing.itemId, type: 'material', icon:'📦' }, take);
        }
        this.render(); return;
      }
      this.onCraft?.(recipe, resDef, saved.length ? { saved } : undefined);
      this.render();
    });
  }
}
