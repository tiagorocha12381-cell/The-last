import { STRUCTURE_DEFS } from '../data/shelters.js';
import { ITEM_DEFS } from '../data/items.js';

export class ShelterUI {
  constructor(shelterSystem, inventory) {
    this.shelter = shelterSystem;
    this.inventory = inventory;
    this.overlay = document.getElementById('shelter-overlay');
    this.title = document.getElementById('shelter-title');
    this.subtitle = document.getElementById('shelter-subtitle');
    this.status = document.getElementById('shelter-status');
    this.msg = document.getElementById('shelter-msg');
    this.list = document.getElementById('shelter-list');
    this.detail = document.getElementById('shelter-detail');
    this.closeBtn = document.getElementById('shelter-close');
    this.tabBuild = document.getElementById('shelter-tab-build');
    this.tabStorage = document.getElementById('shelter-tab-storage');
    this.isOpen = false;
    this.siteId = null;
    this.selectedSlotId = null;
    this.tab = 'build';
    this.onOpenChange = null;

    this.closeBtn?.addEventListener('click', ()=>this.close());
    this.overlay?.addEventListener('click', (e)=>{ if (e.target===this.overlay) this.close(); });
    window.addEventListener('keydown', (e)=>{ if (e.code==='Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    this.tabBuild?.addEventListener('click', ()=>{ this.tab='build'; this.render(); });
    this.tabStorage?.addEventListener('click', ()=>{ this.tab='storage'; this.render(); });
    const oldInv = this.inventory.onChange;
    this.inventory.onChange = (items)=>{ oldInv?.(items); if(this.isOpen) this.render(); };
    this.shelter.onChange = ()=>{ if(this.isOpen) this.render(); };
  }

  open(siteId, opts={}) {
    this.siteId = siteId;
    this.tab = opts.tab || 'build';
    this.selectedSlotId = opts.slotId || this.selectedSlotId;
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.setAttribute('aria-hidden','false');
    if (this.msg) { this.msg.textContent=''; this.msg.className='trade-msg'; }
    this.render();
    this.onOpenChange?.(true);
  }
  close() { if(!this.isOpen) return; this.isOpen=false; this.shelter.clearPreview?.(); this.overlay.classList.add('hidden'); this.overlay.setAttribute('aria-hidden','true'); this.onOpenChange?.(false); }

  _site() { return this.shelter.getSite(this.siteId); }

  render() {
    const site = this._site(); if (!site) return;
    this.title.textContent = site.def.name;
    this.subtitle.textContent = site.claimed ? 'ABRIGO REIVINDICADO' : 'ABRIGO DISPONÍVEL';
    this.tabBuild.classList.toggle('active', this.tab==='build');
    this.tabStorage.classList.toggle('active', this.tab==='storage');
    const builtCount = Object.values(site.slots).filter(s=>s.built).length;
    const residents = site.id === 'site_market' ? 'Moradores: Maya (Líder), Leo (Batedor), Rina (Médica)' : 'Moradores: nenhum atribuído';
    this.status.textContent = `${builtCount}/${Object.keys(site.slots).length} estruturas · ${site.claimed ? 'Ativo' : 'Não reivindicado'} · ${residents}`;
    if (this.tab === 'storage') { this.shelter.clearPreview?.(); this._renderStorage(site); }
    else { this._renderBuild(site); if (this.selectedSlotId) this.shelter.showPreview?.(site.id, this.selectedSlotId); }
  }

  _renderBuild(site) {
    this.list.innerHTML = '';
    if (!site.claimed) {
      const claim = document.createElement('div');
      claim.className = 'detail-empty';
      claim.innerHTML = `<div style="margin-bottom:10px">Este local pode ser reivindicado como abrigo.</div><button type="button" class="inv-action" id="shelter-claim">Reivindicar abrigo</button>`;
      this.list.appendChild(claim);
      claim.querySelector('#shelter-claim')?.addEventListener('click', ()=>{
        const r = this.shelter.claim(site.id);
        this._setMsg(r.message || r.reason, r.ok); this.render();
      });
      this.detail.innerHTML = '<div class="detail-empty">Reivindique o abrigo para construir estruturas.</div>';
      return;
    }
    const slots = site.def.slots.map(sd => ({ sd, slot: site.slots[sd.id], def: STRUCTURE_DEFS[sd.type] })).filter(x=>x.slot&&x.def);
    if (!slots.find(x=>x.sd.id===this.selectedSlotId)) this.selectedSlotId = slots[0]?.sd.id || null;
    for (const {sd, slot, def} of slots) {
      const btn = document.createElement('button');
      btn.type='button';
      btn.className = 'trade-item' + (this.selectedSlotId===sd.id?' selected':'');
      const state = slot.built ? `Nv ${slot.level} · HP ${Math.ceil(slot.hp)}/${slot.maxHp}` : 'Não construída';
      btn.innerHTML = `<div class="trade-item-main"><span class="trade-icon">${def.icon}</span><div><div class="trade-name">${def.name}</div><div class="trade-meta">${def.category} · ${state}</div></div></div><div class="trade-item-right"><div class="trade-price">${slot.built?'Construída':(this.shelter.canBuild(site,sd.id).ok?'Pronta':'Materiais')}</div></div>`;
      btn.addEventListener('click', ()=>{ this.selectedSlotId=sd.id; this.render(); });
      this.list.appendChild(btn);
    }
    this._renderBuildDetail(site, slots.find(x=>x.sd.id===this.selectedSlotId));
  }

  _costHtml(cost) {
    return cost.map(c => { const def=ITEM_DEFS[c.id]||{name:c.id,icon:'📦'}; const have=this.inventory.getCount(c.id); const ok=have>=c.qty; return `<div class="craft-ingredient"><span>${def.icon||'📦'} ${def.name}</span><span class="${ok?'craft-ok':'craft-missing'}">${have}/${c.qty}</span></div>`; }).join('');
  }

  _renderBuildDetail(site, entry) {
    if (!entry) { this.detail.innerHTML = '<div class="detail-empty">Selecione uma estrutura.</div>'; return; }
    const {sd, slot, def} = entry;
    const canBuild = this.shelter.canBuild(site, sd.id);
    const upg = this.shelter.canUpgrade(site, sd.id);
    const costs = !slot.built ? def.cost : (upg.cost || def.cost);
    const actionBtn = !slot.built
      ? `<button type="button" class="inv-action" id="shelter-build" ${canBuild.ok?'':'disabled'}>Construir</button>`
      : `<button type="button" class="inv-action" id="shelter-upg" ${upg.ok?'':'disabled'}>${slot.level>=3?'Nível máximo':'Melhorar'}</button> <button type="button" class="inv-action secondary" id="shelter-repair">Reparar</button>`;
    this.detail.innerHTML = `
      <div class="detail-icon">${def.icon}</div>
      <div class="detail-name">${def.name}</div>
      <div class="detail-type">${def.category} · ${slot.built ? `Nível ${slot.level}` : 'Não construída'}</div>
      <div class="detail-desc">${def.description}</div>
      ${slot.built ? `<div class="detail-stats">Integridade: ${Math.ceil(slot.hp)}/${slot.maxHp}${def.storageSlots?`<br>Capacidade armazenamento: ${slot.storageCap}`:''}${def.id==='reinforced_door'?`<br>Estado: ${slot.open?'Aberta':'Fechada'}`:''}</div>` : ''}
      <div class="craft-ingredients"><strong>${slot.built ? 'Custo de melhoria:' : 'Custo de construção:'}</strong>${this._costHtml(costs)}</div>
      <div class="detail-actions">${actionBtn}</div>
      <div class="detail-stats">${!slot.built ? 'Posição válida pré-definida no local do abrigo.' : 'Melhorias consomem recursos reais do inventário.'}</div>`;
    this.detail.querySelector('#shelter-build')?.addEventListener('click', ()=>{
      if (!confirm(`Construir ${def.name}? Materiais serão consumidos.`)) return;
      const r=this.shelter.build(site.id, sd.id); this._setMsg(r.message||r.reason, r.ok); this.render();
    });
    this.detail.querySelector('#shelter-upg')?.addEventListener('click', ()=>{
      if (!upg.ok) { this._setMsg(upg.reason,false); this.render(); return; }
      if (!confirm(`Melhorar ${def.name} para nível ${slot.level+1}?`)) return;
      const r=this.shelter.upgrade(site.id, sd.id); this._setMsg(r.message||r.reason, r.ok); this.render();
    });
    this.detail.querySelector('#shelter-repair')?.addEventListener('click', ()=>{
      const r=this.shelter.repair(site.id, sd.id); this._setMsg(r.message||r.reason, r.ok); this.render();
    });
  }

  _renderStorage(site) {
    const storages = site.def.slots.map(sd=>({sd, slot:site.slots[sd.id], def:STRUCTURE_DEFS[sd.type]})).filter(x=>x.slot?.built && x.def?.storageSlots);
    if (!storages.find(x=>x.sd.id===this.selectedSlotId)) this.selectedSlotId = storages[0]?.sd.id || null;
    this.list.innerHTML = '';
    if (!site.claimed) { this.list.innerHTML = '<div class="detail-empty">Reivindique o abrigo primeiro.</div>'; this.detail.innerHTML=''; return; }
    if (storages.length === 0) { this.list.innerHTML = '<div class="detail-empty">Construa uma Caixa de Armazenamento para usar este recurso.</div>'; this.detail.innerHTML=''; return; }
    for (const {sd,slot,def} of storages) {
      const used = slot.storage.reduce((a,i)=>a+(i.qty||0),0);
      const btn=document.createElement('button'); btn.type='button'; btn.className='trade-item'+(this.selectedSlotId===sd.id?' selected':'');
      btn.innerHTML=`<div class="trade-item-main"><span class="trade-icon">${def.icon}</span><div><div class="trade-name">${def.name}</div><div class="trade-meta">Nv ${slot.level}</div></div></div><div class="trade-item-right"><div class="trade-qty">${used}/${slot.storageCap}</div></div>`;
      btn.addEventListener('click',()=>{ this.selectedSlotId=sd.id; this.render(); });
      this.list.appendChild(btn);
    }
    const entry = storages.find(x=>x.sd.id===this.selectedSlotId);
    this._renderStorageDetail(site, entry);
  }

  _renderStorageDetail(site, entry) {
    if (!entry) { this.detail.innerHTML = '<div class="detail-empty">Selecione um armazenamento.</div>'; return; }
    const {sd, slot} = entry;
    const used = slot.storage.reduce((a,i)=>a+(i.qty||0),0);
    const invItems = this.inventory.getItems().slice(0,40);
    this.detail.innerHTML = `
      <div class="detail-name">Armazenamento</div>
      <div class="detail-type">Capacidade ${used}/${slot.storageCap}</div>
      <div class="craft-ingredients"><strong>No armazenamento:</strong>${slot.storage.length ? slot.storage.map(i=>`<div class="craft-ingredient"><span>${i.icon||'📦'} ${i.name} x${i.qty}</span><button type="button" class="inv-action secondary small" data-take="${i.id}">Retirar 1</button></div>`).join('') : '<div class="detail-stats">Vazio</div>'}</div>
      <div class="craft-ingredients" style="margin-top:10px"><strong>Seu inventário:</strong>${invItems.length ? invItems.map(i=>`<div class="craft-ingredient"><span>${i.icon||'📦'} ${i.name} x${i.qty}</span><button type="button" class="inv-action secondary small" data-put="${i.id}">Guardar 1</button></div>`).join('') : '<div class="detail-stats">Inventário vazio</div>'}</div>
      <div class="detail-stats">Transferências salvam automaticamente. Sem duplicação: item é removido da origem antes de entrar no destino.</div>`;
    this.detail.querySelectorAll('[data-take]').forEach(b=>b.addEventListener('click', ()=>{
      const r=this.shelter.transferFromStorage(site.id, sd.id, b.dataset.take, 1); this._setMsg(r.message,r.ok); this.render();
    }));
    this.detail.querySelectorAll('[data-put]').forEach(b=>b.addEventListener('click', ()=>{
      const r=this.shelter.transferToStorage(site.id, sd.id, b.dataset.put, 1); this._setMsg(r.message,r.ok); this.render();
    }));
  }

  _setMsg(text, ok) { if(!this.msg) return; this.msg.textContent=text||''; this.msg.className='trade-msg '+(ok?'ok':'err'); }
}
