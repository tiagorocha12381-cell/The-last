export class HUD {
  constructor() {
    this.hud = document.getElementById('hud');
    this.status = document.getElementById('status-pill');
    this.hint = document.getElementById('desktop-hint');
    this.qualityBtn = document.getElementById('quality-btn');
    this.prompt = document.getElementById('interact-prompt');
    this.toast = document.getElementById('toast');
    this.notifications = document.getElementById('hud-notifications');
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.hungerFill = document.getElementById('hunger-fill');
    this.thirstFill = document.getElementById('thirst-fill');
    this.energyFill = document.getElementById('energy-fill');
    this.staminaFill = document.getElementById('stamina-fill');
    this.hungerVal = document.getElementById('hunger-val');
    this.thirstVal = document.getElementById('thirst-val');
    this.energyVal = document.getElementById('energy-val');
    this.staminaVal = document.getElementById('stamina-val');
    this.equipPill = document.getElementById('equip-pill');
    this.weaponType = document.getElementById('weapon-type');
    this.ammoPill = document.getElementById('ammo-pill');
    this.specialPill = document.getElementById('special-pill');
    this.specialFill = document.getElementById('special-fill');
    this.vehicleHud = document.getElementById('vehicle-hud');
    this.damageVignette = document.getElementById('damage-vignette');
    this.hitmarker = document.getElementById('hitmarker');
    this.threatIndicator = document.getElementById('threat-indicator');
    this.stealthIndicator = document.getElementById('stealth-indicator');
    this.minimap = document.getElementById('hud-minimap');
    this.minimapCtx = this.minimap?.getContext('2d') || null;
    this.quickbar = document.getElementById('hud-quickbar');
    this._toastTimer = null;
    this._hitTimer = null;
    this._damageTimer = null;
    this._notifSeq = 0;
    this._lastSurvival = '';
    this._lastHealth = '';
    this._lastWeaponInfo = '';
  }

  show() { this.hud?.classList.remove('hidden'); }
  setStatus(text) { if (this.status) this.status.textContent = text; }
  setQualityLabel(text) { if (this.qualityBtn) this.qualityBtn.textContent = text; }
  onQualityToggle(fn) { this.qualityBtn?.addEventListener('click', fn); }
  setTouchMode(isTouch) {
    if (this.hint) {
      this.hint.textContent = isTouch
        ? 'Joystick mover · Arraste câmera · AGACHAR furtivo · USE interagir · ATK/SP/REL combate · INV/LOG/PERS menus'
        : 'WASD mover · Shift correr · Ctrl agachar · Mouse câmera · Espaço pular · E interagir · I inventário · M missões · N mapa · F ataque · Q especial · R recarregar · V trocar arma';
    }
  }

  setHealth(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const key = `${Math.ceil(hp)}|${Math.ceil(maxHp)}`;
    if (key === this._lastHealth) return;
    this._lastHealth = key;
    if (this.healthFill) {
      this.healthFill.style.width = pct + '%';
      this.healthFill.style.background = pct > 50 ? 'linear-gradient(90deg,#7fb07a,#a8c98a)' : pct > 25 ? 'linear-gradient(90deg,#c89b3c,#ddb35b)' : 'linear-gradient(90deg,#a8483a,#d96b4b)';
    }
    if (this.healthText) this.healthText.textContent = `${Math.ceil(hp)} HP`;
    if (this.healthFill?.parentElement) this.healthFill.parentElement.classList.toggle('critical', pct <= 25);
  }

  setEquipment(name) {
    if (this.equipPill) this.equipPill.textContent = name || 'Sem arma';
  }

  setWeaponInfo({ name, category, ammoText, lowAmmo = false } = {}) {
    const key = `${name}|${category}|${ammoText}|${lowAmmo?'1':'0'}`;
    if (key === this._lastWeaponInfo) return;
    this._lastWeaponInfo = key;
    if (name != null) this.setEquipment(name);
    if (this.weaponType) this.weaponType.textContent = category || 'Corpo a corpo';
    if (this.ammoPill) {
      this.ammoPill.textContent = ammoText || 'CORPO A CORPO';
      this.ammoPill.classList.toggle('low-ammo', !!lowAmmo);
    }
  }

  setSpecialCooldown(remain, max) {
    const r = Math.max(0, remain || 0);
    const m = Math.max(0.001, max || 1);
    const pct = Math.max(0, Math.min(100, ((m - r) / m) * 100));
    if (this.specialFill) this.specialFill.style.width = pct + '%';
    if (this.specialPill) this.specialPill.textContent = r <= 0.05 ? 'PRONTO' : `${r.toFixed(1)}s`;
    this.specialPill?.classList.toggle('ready', r <= 0.05);
  }

  setSurvival(stats) {
    const key = [stats.hunger,stats.thirst,stats.energy,stats.stamina].map(v=>Math.round(v)).join('|');
    if (key === this._lastSurvival) return;
    this._lastSurvival = key;
    const set = (fill, valEl, val, max, good, warn, bad) => {
      const pct = Math.max(0, Math.min(100, (val / max) * 100));
      if (fill) { fill.style.width = pct + '%'; fill.style.background = pct > 50 ? good : pct > 25 ? warn : bad; }
      if (valEl) valEl.textContent = String(Math.round(val));
    };
    set(this.hungerFill, this.hungerVal, stats.hunger, stats.maxHunger, '#cfa457', '#b88436', '#b44a3a');
    set(this.thirstFill, this.thirstVal, stats.thirst, stats.maxThirst, '#5caecf', '#3b86ad', '#b44a3a');
    set(this.energyFill, this.energyVal, stats.energy, stats.maxEnergy, '#7eb874', '#97a84b', '#b44a3a');
    set(this.staminaFill, this.staminaVal, stats.stamina, stats.maxStamina, '#8bc08f', '#c6b14c', '#b44a3a');
  }

  setPrompt(text) {
    if (!this.prompt) return;
    if (text) {
      this.prompt.textContent = text;
      this.prompt.classList.remove('hidden');
    } else {
      if (!this.prompt.classList.contains('hidden')) this.prompt.classList.add('hidden');
      this.prompt.textContent = '';
    }
  }

  showToast(text, ms = 2600) { this.notify(text, 'info', ms); }

  setStealthState(state, label) {
    const el = this.stealthIndicator || this.threatIndicator;
    if (!el) return;
    el.className = 'stealth-indicator ' + (state || 'hidden');
    el.textContent = label || '';
    el.classList.toggle('hidden', !label);
  }

  notify(text, type = 'info', ms = 2600) {
    if (!text) return;
    // Keep legacy toast for compatibility/visibility, but prefer notification stack
    if (this.toast) {
      this.toast.textContent = text;
      this.toast.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.toast?.classList.add('hidden'), ms);
    }
    if (!this.notifications) return;
    const el = document.createElement('div');
    el.className = `hud-notif hud-notif-${type}`;
    el.textContent = text;
    this.notifications.appendChild(el);
    // limit stack
    while (this.notifications.children.length > 4) this.notifications.firstChild?.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ms);
  }

  flashDamage() {
    if (!this.damageVignette) return;
    this.damageVignette.classList.add('active');
    clearTimeout(this._damageTimer);
    this._damageTimer = setTimeout(() => this.damageVignette?.classList.remove('active'), 280);
  }

  showHitmarker(kill = false) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.toggle('kill', !!kill);
    this.hitmarker.classList.add('active');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => this.hitmarker?.classList.remove('active'), kill ? 220 : 140);
  }

  setThreat(active) {
    if (!this.threatIndicator) return;
    this.threatIndicator.classList.toggle('hidden', !active);
  }

  setVehicle(info) {
    if (!this.vehicleHud) return;
    if (!info) { this.vehicleHud.classList.add('hidden'); this.vehicleHud.textContent = ''; return; }
    const speed = Math.round(Math.abs(info.speed) * 8);
    this.vehicleHud.classList.remove('hidden');
    this.vehicleHud.textContent = `${info.name}  •  ${speed} km/h  •  Combustível ${Math.round(info.fuel)}%  •  Dano ${Math.round(info.damage)}%`;
  }

  renderQuickbar(slots = []) {
    if (!this.quickbar) return;
    const key = slots.map((s,i)=>`${i}:${s?.id||''}:${s?.qty||0}`).join('|');
    if (key === this._lastQuickbar) return;
    this._lastQuickbar = key;
    this.quickbar.innerHTML = slots.map((it, i) => `
      <div class="hud-quick-slot ${it ? 'has' : ''}" data-q="${i}">
        <span class="hud-quick-key">${i+1}</span>
        <span class="hud-quick-icon">${it?.icon || '·'}</span>
        <span class="hud-quick-name">${it ? (it.name.length>10?it.name.slice(0,10)+'…':it.name) : 'Vazio'}</span>
        ${it && it.type !== 'equipamento' ? `<span class="hud-quick-qty">x${it.qty||1}</span>` : ''}
      </div>`).join('');
  }

  updateMinimap({ playerPos, playerYaw = 0, pois = [], objective = null, discoveredRegions = [] }) {
    const ctx = this.minimapCtx, c = this.minimap;
    if (!ctx || !c) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,14,18,0.88)';
    ctx.fillRect(0, 0, w, h);
    const scale = 0.55;
    const cx = w / 2, cy = h / 2;
    const toMap = (x, z) => [cx + (x - playerPos.x) * scale, cy + (z - playerPos.z) * scale];
    // regions
    ctx.save();
    for (const r of discoveredRegions) {
      const [rx, ry] = toMap(r.center.x, r.center.z);
      ctx.strokeStyle = 'rgba(217,107,75,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(rx, ry, (r.radius || 55) * scale, 0, Math.PI * 2); ctx.stroke();
    }
    // pois
    for (const p of pois) {
      if (!p.discovered) continue;
      const [px, py] = toMap(p.pos.x, p.pos.z);
      if (px < -4 || py < -4 || px > w+4 || py > h+4) continue;
      ctx.fillStyle = 'rgba(255,191,138,0.9)';
      ctx.fillRect(px-2, py-2, 4, 4);
    }
    // objective
    if (objective) {
      const [ox, oy] = toMap(objective.x, objective.z);
      ctx.strokeStyle = '#7ef0a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.stroke();
    }
    // player
    ctx.translate(cx, cy);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#7fd6ff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(0.5,0.5,w-1,h-1);
  }
}
