export class TradeUI {
  constructor(tradeSystem, inventory) {
    this.trade = tradeSystem;
    this.inventory = inventory;
    this.overlay = document.getElementById('trade-overlay');
    this.title = document.getElementById('trade-title');
    this.subtitle = document.getElementById('trade-subtitle');
    this.balance = document.getElementById('trade-balance');
    this.list = document.getElementById('trade-list');
    this.detail = document.getElementById('trade-detail');
    this.msg = document.getElementById('trade-msg');
    this.closeBtn = document.getElementById('trade-close');
    this.tabBuy = document.getElementById('trade-tab-buy');
    this.tabSell = document.getElementById('trade-tab-sell');
    this.tabHistory = document.getElementById('trade-tab-history');
    this.merchantId = null;
    this.tab = 'buy';
    this.selectedId = null;
    this.isOpen = false;
    this.onOpenChange = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    this.tabBuy?.addEventListener('click', () => { this.tab='buy'; this.selectedId=null; this.render(); });
    this.tabSell?.addEventListener('click', () => { this.tab='sell'; this.selectedId=null; this.render(); });
    this.tabHistory?.addEventListener('click', () => { this.tab='history'; this.selectedId=null; this.render(); });
    this.trade.onChange = () => { if (this.isOpen) this.render(); };
    const oldInv = this.inventory.onChange;
    this.inventory.onChange = (items) => { oldInv?.(items); if (this.isOpen) this.render(); };
  }

  open(merchantId) {
    const m = this.trade.getMerchantDef(merchantId);
    if (!m) return;
    this.merchantId = merchantId;
    this.tab = 'buy';
    this.selectedId = null;
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.setAttribute('aria-hidden', 'false');
    if (this.msg) this.msg.textContent = '';
    this.render();
    this.onOpenChange?.(true);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.onOpenChange?.(false);
  }

  render() {
    const m = this.trade.getMerchantDef(this.merchantId);
    if (!m) return;
    this.title.textContent = `Comércio — ${m.name}`;
    this.subtitle.textContent = m.title || 'Comerciante';
    this.balance.textContent = `Saldo: ${this.trade.getCredits()} CR`;
    this.tabBuy.classList.toggle('active', this.tab==='buy');
    this.tabSell.classList.toggle('active', this.tab==='sell');
    this.tabHistory?.classList.toggle('active', this.tab==='history');
    if (this.tab === 'history') { this._renderHistory(); return; }
    const items = this.tab === 'buy' ? this._buyItems() : this._sellItems();
    if (!items.find(i=>i.id===this.selectedId)) this.selectedId = items[0]?.id || null;
    this.list.innerHTML = '';
    for (const it of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trade-item' + (this.selectedId===it.id ? ' selected' : '');
      btn.innerHTML = `
        <div class="trade-item-main"><span class="trade-icon">${it.def.icon||'📦'}</span><div><div class="trade-name">${it.def.name}</div><div class="trade-meta">${it.category} · ${it.def.rarity||'comum'}</div></div></div>
        <div class="trade-item-right"><div class="trade-price">${it.price} CR</div><div class="trade-qty">${this.tab==='buy' ? `Estoque: ${it.qty}` : `Você: ${it.qty}`}</div></div>`;
      btn.addEventListener('click', () => { this.selectedId = it.id; this.render(); });
      this.list.appendChild(btn);
    }
    if (items.length === 0) this.list.innerHTML = `<div class="detail-empty">${this.tab==='buy' ? 'Sem produtos disponíveis.' : 'Você não tem itens que este comerciante compra.'}</div>`;
    this._renderDetail(items.find(i=>i.id===this.selectedId) || null);
  }

  _buyItems() {
    return this.trade.getMerchantCatalog(this.merchantId).map(i => ({ ...i, price: i.buyPrice }));
  }

  _sellItems() {
    const catalog = this.trade.getMerchantCatalog(this.merchantId);
    const byId = new Map(catalog.map(c=>[c.id,c]));
    const out = [];
    for (const slot of (this.inventory.getSlots?.() || [])) {
      if (!slot) continue;
      const cat = byId.get(slot.id);
      if (!cat) continue;
      if (slot.type === 'missão' || slot.type === 'missao') continue;
      if (slot.type === 'equipamento') continue;
      const existing = out.find(o=>o.id===slot.id);
      if (existing) { existing.qty += (slot.qty||1); continue; }
      out.push({ id: slot.id, def: cat.def, qty: slot.qty||1, price: cat.sellPrice, category: cat.category });
    }
    return out;
  }

  _renderHistory() {
    const hist = (this.trade.history || []).slice().reverse();
    this.list.innerHTML = hist.length ? '' : '<div class="detail-empty">Nenhuma transação ainda.</div>';
    for (const h of hist) {
      const el = document.createElement('div');
      el.className = 'trade-item';
      const when = new Date(h.t || Date.now()).toLocaleString();
      const sign = h.type === 'buy' ? '-' : '+';
      el.innerHTML = `<div class="trade-item-main"><div><div class="trade-name">${h.type==='buy'?'Compra':'Venda'}: ${h.item} x${h.qty}</div><div class="trade-meta">${h.merchant} · ${when}</div></div></div><div class="trade-item-right"><div class="trade-price" style="color:${h.type==='buy'?'#ff988a':'#9ad08f'}">${sign}${h.price} CR</div></div>`;
      this.list.appendChild(el);
    }
    this.detail.innerHTML = '<div class="detail-empty">Histórico de transações recentes. As compras e vendas são salvas automaticamente.</div>';
  }

  _renderDetail(it) {
    if (!it) { this.detail.innerHTML = '<div class="detail-empty">Selecione um item.</div>'; return; }
    const max = it.qty;
    const action = this.tab === 'buy' ? 'Comprar' : 'Vender';
    const total = it.price;
    this.detail.innerHTML = `
      <div class="detail-icon">${it.def.icon||'📦'}</div>
      <div class="detail-name">${it.def.name}</div>
      <div class="detail-type">${it.category} · ${it.def.rarity||'comum'}</div>
      <div class="detail-desc">${it.def.description||''}</div>
      <div class="detail-stats">Preço unitário: ${it.price} CR<br>${this.tab==='buy' ? `Estoque do comerciante: ${it.qty}` : `Na sua mochila: ${it.qty}`}</div>
      <div class="trade-qty-row">
        <label>Qtd.</label>
        <button type="button" class="inv-action secondary" id="trade-qminus">-</button>
        <input id="trade-qinput" class="trade-qinput" type="number" min="1" max="${max}" value="1" />
        <button type="button" class="inv-action secondary" id="trade-qplus">+</button>
      </div>
      <div class="detail-qty" id="trade-total">Total: ${total} CR</div>
      <div class="detail-actions">
        <button type="button" class="inv-action" id="trade-do" ${max<=0?'disabled':''}>${action}</button>
      </div>`;
    const qinput = this.detail.querySelector('#trade-qinput');
    const totalEl = this.detail.querySelector('#trade-total');
    const clampQ = () => { let v=Math.floor(Number(qinput.value)||1); v=Math.max(1,Math.min(max, v)); qinput.value=String(v); totalEl.textContent=`Total: ${v*it.price} CR`; return v; };
    this.detail.querySelector('#trade-qminus')?.addEventListener('click', ()=>{ qinput.value=String(Math.max(1,(Math.floor(Number(qinput.value)||1)-1))); clampQ(); });
    this.detail.querySelector('#trade-qplus')?.addEventListener('click', ()=>{ qinput.value=String(Math.min(max,(Math.floor(Number(qinput.value)||1)+1))); clampQ(); });
    qinput?.addEventListener('input', clampQ);
    this.detail.querySelector('#trade-do')?.addEventListener('click', () => {
      const q = clampQ();
      const totalPrice = q * it.price;
      const verb = this.tab==='buy' ? 'Comprar' : 'Vender';
      if (!confirm(`${verb} ${q}x ${it.def.name} por ${totalPrice} CR?`)) return;
      const res = this.tab==='buy' ? this.trade.buy(this.merchantId, it.id, q) : this.trade.sell(this.merchantId, it.id, q);
      if (this.msg) { this.msg.textContent = res.message; this.msg.className = 'trade-msg ' + (res.ok ? 'ok' : 'err'); }
      this.render();
    });
  }
}
