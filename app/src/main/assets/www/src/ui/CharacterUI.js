import { SKILL_TREE } from '../data/skills.js';

export class CharacterUI {
  constructor(progression) {
    this.progression = progression;
    this.overlay = document.getElementById('char-overlay');
    this.summary = document.getElementById('char-summary');
    this.body = document.getElementById('char-body');
    this.points = document.getElementById('char-points');
    this.closeBtn = document.getElementById('char-close');
    this.isOpen = false;
    this.onOpenChange = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    const prev = this.progression.onChange;
    this.progression.onChange = () => { prev?.(); if (this.isOpen) this.render(); };
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() { this.isOpen = true; this.overlay.classList.remove('hidden'); this.overlay.setAttribute('aria-hidden','false'); this.render(); this.onOpenChange?.(true); }
  close() { this.isOpen = false; this.overlay.classList.add('hidden'); this.overlay.setAttribute('aria-hidden','true'); this.onOpenChange?.(false); }

  render() {
    const p = this.progression.getState();
    const pct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));
    this.summary.innerHTML = `
      <div class="char-reference-card">
        <div class="char-reference-copy">
          <strong>SOBREVIVENTE PRINCIPAL</strong>
          <span>Referência visual oficial do protagonista. O modelo 3D em jogo continua sendo independente desta arte.</span>
          <div class="char-level">Nível ${p.level}</div>
          <div class="char-xp-bar"><div class="char-xp-fill" style="width:${pct}%"></div></div>
          <div class="char-xp-text">XP: ${p.xp} / ${p.xpToNext}</div>
        </div>
        <img src="./assets/images/protagonist-portrait.webp" alt="Referência visual do protagonista">
      </div>
    `;
    this.points.textContent = `Pontos: ${p.skillPoints}`;
    this.body.innerHTML = '';
    for (const cat of SKILL_TREE) {
      const catEl = document.createElement('div');
      catEl.className = 'char-cat';
      catEl.innerHTML = `<div class="char-cat-title">${cat.name}</div>`;
      for (const s of cat.skills) {
        const rank = this.progression.getSkillRank(s.id);
        const check = this.progression.canUnlock(s.id);
        const reqText = s.requires ? Object.entries(s.requires).map(([id,r])=>`${this._skillName(id)} Nv.${r}`).join(', ') : '';
        const btn = document.createElement('div');
        btn.className = 'char-skill';
        btn.innerHTML = `
          <div class="char-skill-main">
            <div class="char-skill-name">${s.name} <span class="char-rank">${rank}/${s.maxRank}</span></div>
            <div class="char-skill-desc">${s.desc}</div>
            ${reqText ? `<div class="char-skill-req">Req: ${reqText}</div>` : ''}
          </div>
          <button class="inv-action char-unlock" type="button" ${check.ok ? '' : 'disabled'}>${rank>=s.maxRank ? 'MAX' : (check.ok ? 'Desbloquear' : 'Bloqueado')}</button>
        `;
        btn.querySelector('.char-unlock')?.addEventListener('click', () => {
          const res = this.progression.unlock(s.id);
          if (!res.ok) return;
          this.render();
        });
        catEl.appendChild(btn);
      }
      this.body.appendChild(catEl);
    }
  }

  _skillName(id) {
    for (const cat of SKILL_TREE) for (const s of cat.skills) if (s.id === id) return s.name;
    return id;
  }
}
