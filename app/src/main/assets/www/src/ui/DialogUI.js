export class DialogUI {
  constructor() {
    this.overlay = document.getElementById('dialog-overlay');
    this.nameEl = document.getElementById('dialog-name');
    this.roleEl = document.getElementById('dialog-role');
    this.textEl = document.getElementById('dialog-text');
    this.choicesEl = document.getElementById('dialog-choices');
    this.trustEl = document.getElementById('dialog-trust');
    this.closeBtn = document.getElementById('dialog-close');
    this.isOpen = false;
    this.onOpenChange = null;
    this.onChoice = null; // (choice) => void
    this._currentChoices = [];

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); }
    });
  }

  openDialog({ name, role, text, choices = [], trust }) {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.nameEl.textContent = name || 'Sobrevivente';
    this.roleEl.textContent = role || 'SOBREVIVENTE';
    this.textEl.textContent = text || '';
    this.trustEl.textContent = trust != null ? `Confiança: ${trust}` : 'Confiança: -';
    this._renderChoices(choices);
    this.onOpenChange?.(true);
  }

  _renderChoices(choices) {
    this._currentChoices = choices;
    this.choicesEl.innerHTML = '';
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dialog-choice';
      btn.innerHTML = `${choice.label}${choice.hint ? `<small>${choice.hint}</small>` : ''}`;
      btn.addEventListener('click', () => this.onChoice?.(choice));
      this.choicesEl.appendChild(btn);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.onOpenChange?.(false);
  }
}
