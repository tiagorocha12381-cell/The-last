export class MissionUI {
  constructor(missionSystem, decisionSystem = null) {
    this.missionSystem = missionSystem;
    this.decisionSystem = decisionSystem;
    this.overlay = document.getElementById('mission-overlay');
    this.list = document.getElementById('mission-list');
    this.detail = document.getElementById('mission-detail');
    this.closeBtn = document.getElementById('mission-close');
    this.isOpen = false;
    this.selectedId = null;
    this.onOpenChange = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); }
    });

    this.missionSystem.onChange = (missions, active) => {
      if (this.isOpen) this.render();
      this._updateHudObjective(active);
    };
  }

  _updateHudObjective(active) {
    const el = document.getElementById('objective-hud');
    if (!el) return;
    if (!active) { el.classList.add('hidden'); el.textContent = ''; return; }
    const obj = active.objectives.find(o => !o.completed);
    if (!obj) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.textContent = `${active.name}: ${obj.text}`;
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.setAttribute('aria-hidden', 'false');
    const active = this.missionSystem.getActiveMission();
    if (!this.selectedId && active) this.selectedId = active.id;
    this.render();
    this.onOpenChange?.(true);
  }
  close() {
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.onOpenChange?.(false);
  }

  render() {
    const missions = this.missionSystem.getMissions();
    this.list.innerHTML = '';
    for (const m of missions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mission-item' + (this.selectedId === m.id ? ' selected' : '');
      const stateLabel = m.state === 'completed' ? 'CONCLUÍDA' : m.state === 'active' ? 'ATIVA' : 'DISPONÍVEL';
      btn.innerHTML = `<div class="mission-item-name">${m.name}</div><div class="mission-item-state ${m.state}">${stateLabel}</div>`;
      btn.addEventListener('click', () => { this.selectedId = m.id; this.render(); });
      this.list.appendChild(btn);
    }
    if (this.decisionSystem) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mission-item' + (this.selectedId === '__decisions__' ? ' selected' : '');
      btn.innerHTML = `<div class="mission-item-name">Decisões da Campanha</div><div class="mission-item-state active">REGISTRO</div>`;
      btn.addEventListener('click', () => { this.selectedId = '__decisions__'; this.render(); });
      this.list.appendChild(btn);
    }
    if (this.selectedId === '__decisions__') this._renderDecisions();
    else this._renderDetail(missions.find(m => m.id === this.selectedId) || null);
  }

  _renderDecisions() {
    const list = this.decisionSystem?.getAll?.() || [];
    if (!list.length) { this.detail.innerHTML = '<div class="detail-name">Decisões da Campanha</div><div class="detail-desc">Nenhuma decisão importante registrada ainda.</div>'; return; }
    const rows = list.map(d => `<li class="${d.state==='completed'?'obj-done':''}"><strong>${d.label}</strong><br><span class="obj-progress">${d.consequence || ''}</span><br><span class="obj-progress">Estado: ${d.state}</span></li>`).join('');
    this.detail.innerHTML = `
      <div class="detail-name">Decisões da Campanha</div>
      <div class="detail-desc">Registro interno das escolhas importantes e suas consequências.</div>
      <div class="mission-section-title">Decisões registradas</div>
      <ul class="mission-obj-list">${rows}</ul>
    `;
  }

  _renderDetail(m) {
    if (!m) { this.detail.innerHTML = '<div class="detail-empty">Selecione uma missão.</div>'; return; }
    const objs = m.objectives.map(o => {
      const done = !!o.completed;
      return `<li class="${done ? 'obj-done' : ''}">${done ? '☑' : '☐'} ${o.text} <span class="obj-progress">(${Math.min(o.current, o.required)}/${o.required})</span></li>`;
    }).join('');
    const rewards = (m.rewards || []).map(r => {
      if (r.kind === 'item') return `<li>${r.item?.icon || '•'} ${r.item?.name || 'Item'} x${r.qty || 1}</li>`;
      if (r.kind === 'info') return `<li>📝 Informação</li>`;
      return `<li>• Recompensa</li>`;
    }).join('');
    this.detail.innerHTML = `
      <div class="detail-name">${m.name}</div>
      <div class="detail-type">${m.type === 'main' ? 'Principal' : 'Missão'} · ${m.state === 'completed' ? 'Concluída' : m.state === 'active' ? 'Ativa' : 'Disponível'}</div>
      <div class="detail-desc">${m.description}</div>
      <div class="mission-section-title">Objetivos</div>
      <ul class="mission-obj-list">${objs}</ul>
      <div class="mission-section-title">Recompensas</div>
      <ul class="mission-obj-list">${rewards || '<li>-</li>'}</ul>
    `;
  }
}
