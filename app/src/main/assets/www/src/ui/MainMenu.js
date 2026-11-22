import { GAME_CONFIG, DIFFICULTY_PRESETS } from '../config/constants.js';

const CHAPTERS = [
  { id:'ch1', missionId:'m1_sinal_nevoa', name:'Capítulo 1: Sinal na Névoa', desc:'Um bilhete rasgado leva a um transmissor improvisado nas ruínas de Manhattan. Envie um sinal de sobrevivência.', state:'available' },
  { id:'ch2', missionId:'m2_abrigo_seguro', name:'Capítulo 2: Abrigo Seguro', desc:'Ajude os sobreviventes do abrigo a reforçar a segurança e buscar suprimentos médicos.', state:'available' },
  { id:'ch3', missionId:null, name:'Capítulo 3: Sombras da Zona', desc:'Em desenvolvimento. Este capítulo ainda não está jogável.', state:'locked' },
  { id:'ch4', missionId:null, name:'Capítulo 4: Êxodo', desc:'Em desenvolvimento. Este capítulo ainda não está jogável.', state:'locked' },
];

export class MainMenu {
  constructor({ saveSystem, audioSystem, settingsSystem, onContinue, onNewGame, onQualityChange, getQualityLabel }) {
    this.saveSystem = saveSystem;
    this.audioSystem = audioSystem;
    this.settingsSystem = settingsSystem;
    this.onContinue = onContinue;
    this.onNewGame = onNewGame;
    this.onQualityChange = onQualityChange;
    this.getQualityLabel = getQualityLabel;

    this.el = document.getElementById('main-menu');
    this.btnContinue = document.getElementById('menu-continue');
    this.btnNew = document.getElementById('menu-newgame');
    this.btnChapters = document.getElementById('menu-chapters');
    this.btnSettings = document.getElementById('menu-settings');
    this.btnCredits = document.getElementById('menu-credits');
    this.btnExit = document.getElementById('menu-exit');
    this.panel = document.getElementById('menu-panel');
    this.panelTitle = document.getElementById('menu-panel-title');
    this.panelBody = document.getElementById('menu-panel-body');
    this.panelClose = document.getElementById('menu-panel-close');
    this.confirm = document.getElementById('menu-confirm');
    this.confirmTitle = document.getElementById('menu-confirm-title');
    this.confirmText = document.getElementById('menu-confirm-text');
    this.confirmYes = document.getElementById('menu-confirm-yes');
    this.confirmNo = document.getElementById('menu-confirm-no');
    this.statusEl = document.getElementById('menu-status');

    this.visible = false;
    this._settingsTab = 'graphics';
    this._bind();
  }

  _bind() {
    this.btnContinue?.addEventListener('click', () => { if (this.btnContinue.disabled) return; this.onContinue?.(); });
    this.btnNew?.addEventListener('click', () => this._handleNewGame());
    this.btnChapters?.addEventListener('click', () => this._openChapters());
    this.btnSettings?.addEventListener('click', () => { this._settingsTab = 'graphics'; this._openSettings(); });
    this.btnCredits?.addEventListener('click', () => this._openCredits());
    this.btnExit?.addEventListener('click', () => this._handleExit());
    this.panelClose?.addEventListener('click', () => this._closePanel());
    this.panel?.addEventListener('click', (e) => { if (e.target === this.panel) this._closePanel(); });
    this.confirm?.addEventListener('click', (e) => { if (e.target === this.confirm) this._closeConfirm(); });
    this.confirmNo?.addEventListener('click', () => this._closeConfirm());
    window.addEventListener('keydown', (e) => {
      if (!this.visible) return;
      if (e.code === 'Escape') {
        if (!this.confirm.classList.contains('hidden')) { e.preventDefault(); this._closeConfirm(); return; }
        if (!this.panel.classList.contains('hidden')) { e.preventDefault(); this._closePanel(); return; }
      }
    });
  }

  hasSave() {
    if (this.saveSystem.hasValidSave) return this.saveSystem.hasValidSave();
    const s = this.saveSystem.get();
    return !!(s && s.timestamp);
  }

  refresh() {
    const has = this.hasSave();
    const err = this.saveSystem.lastError;
    if (this.btnContinue) {
      this.btnContinue.disabled = !has;
      const sub = this.btnContinue.querySelector('.menu-btn-sub');
      if (sub) sub.textContent = has ? 'Carregar partida salva' : 'Nenhuma partida salva';
    }
    if (this.statusEl) {
      if (err) { this.statusEl.textContent = err; this.statusEl.classList.remove('hidden'); }
      else { this.statusEl.textContent = ''; this.statusEl.classList.add('hidden'); }
    }
  }

  show() { this.visible = true; this.refresh(); this.el.classList.remove('hidden'); this.el.setAttribute('aria-hidden','false'); }
  hide() { this.visible = false; this._closePanel(); this._closeConfirm(); this.el.classList.add('hidden'); this.el.setAttribute('aria-hidden','true'); }
  _closePanel() { this.panel.classList.add('hidden'); this.panel.setAttribute('aria-hidden','true'); }
  _closeConfirm() { this.confirm.classList.add('hidden'); this.confirm.setAttribute('aria-hidden','true'); }

  _confirmAction(title, text, onYes) {
    this.confirmTitle.textContent = title;
    this.confirmText.textContent = text;
    this.confirmYes.onclick = () => { this._closeConfirm(); onYes?.(); };
    this.confirm.classList.remove('hidden');
    this.confirm.setAttribute('aria-hidden', 'false');
  }

  _handleNewGame() {
    const startFresh = () => {
      try { this.saveSystem.clear(); } catch(_) {}
      this.saveSystem.save({ difficulty: GAME_CONFIG.difficulty });
      this.onNewGame?.();
    };
    if (this.hasSave()) {
      this._confirmAction('Novo Jogo', `Existe uma partida salva. Iniciar um novo jogo vai substituir o progresso salvo atual. Dificuldade: ${DIFFICULTY_PRESETS[GAME_CONFIG.difficulty]?.label || GAME_CONFIG.difficulty}. Deseja continuar?`, startFresh);
    } else {
      startFresh();
    }
  }

  _getChapterStatus(ch) {
    if (ch.state === 'locked' || !ch.missionId) return { label:'Indisponível', cls:'locked', playable:false };
    const save = this.saveSystem.get();
    const ms = save?.missions || [];
    const m = ms.find(x => x.id === ch.missionId);
    if (m?.state === 'completed') return { label:'Concluído', cls:'done', playable:true };
    if (m?.state === 'active') return { label:'Em progresso', cls:'active', playable:true };
    return { label:'Disponível', cls:'available', playable:true };
  }

  _openChapters() {
    this.panelTitle.textContent = 'Capítulos e Dificuldade';
    const curDiff = GAME_CONFIG.difficulty || 'normal';
    const diffBtns = ['easy','normal','hard'].map(k => {
      const d = DIFFICULTY_PRESETS[k];
      return `<button type="button" class="diff-btn ${k===curDiff?'active':''}" data-diff="${k}"><strong>${d.label}</strong><span>${d.desc}</span></button>`;
    }).join('');
    const cards = CHAPTERS.map(ch => {
      const st = this._getChapterStatus(ch);
      const disabled = !st.playable ? 'disabled' : '';
      return `<div class="chapter-card ${st.cls}"><div class="chapter-meta"><span class="chapter-state ${st.cls}">${st.label}</span></div><h3>${ch.name}</h3><p>${ch.desc}</p><button type="button" class="inv-action chapter-start" data-ch="${ch.id}" ${disabled}>${st.playable ? 'Iniciar capítulo' : 'Indisponível'}</button></div>`;
    }).join('');
    this.panelBody.innerHTML = `<div class="menu-setting"><div><label>Dificuldade</label><span class="menu-setting-sub">Afeta recursos, resistência de zumbis e sobrevivência. Salva na partida.</span></div></div><div class="difficulty-row" id="difficulty-row">${diffBtns}</div><div class="chapters-grid">${cards}</div><p class="menu-setting-sub" style="margin-top:10px">Capítulos não implementados aparecem como indisponíveis. Selecionar capítulo inicia novo jogo (com confirmação se houver save).</p>`;
    this.panelBody.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.diff;
        if (!DIFFICULTY_PRESETS[d]) return;
        GAME_CONFIG.difficulty = d;
        this.panelBody.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b===btn));
        if (this.hasSave()) this.saveSystem.save({ difficulty: d });
      });
    });
    this.panelBody.querySelectorAll('.chapter-start').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = CHAPTERS.find(c => c.id === btn.dataset.ch);
        if (!ch || ch.state === 'locked' || !ch.missionId) return;
        const start = () => { try { this.saveSystem.clear(); } catch(_) {} this.saveSystem.save({ difficulty: GAME_CONFIG.difficulty, startChapter: ch.missionId }); this.onNewGame?.(); };
        if (this.hasSave()) this._confirmAction('Iniciar capítulo', `Iniciar "${ch.name}" vai substituir o progresso salvo atual. Dificuldade: ${DIFFICULTY_PRESETS[GAME_CONFIG.difficulty]?.label || GAME_CONFIG.difficulty}. Continuar?`, start);
        else start();
      });
    });
    this.panel.classList.remove('hidden'); this.panel.setAttribute('aria-hidden', 'false');
  }

  _openSettings() {
    this.panelTitle.textContent = 'Configurações';
    const tabs = [['graphics','Gráficos'],['audio','Áudio'],['controls','Controles'],['accessibility','Acessibilidade']];
    this.panelBody.innerHTML = `
      <div class="settings-tabs">${tabs.map(([k,l])=>`<button type="button" class="settings-tab ${this._settingsTab===k?'active':''}" data-stab="${k}">${l}</button>`).join('')}</div>
      <div id="settings-content"></div>
      <div class="settings-footer"><button type="button" class="inv-action" id="settings-reset">Restaurar padrões</button><button type="button" class="inv-action" id="settings-back">Voltar</button></div>
    `;
    this.panelBody.querySelectorAll('.settings-tab').forEach(b=>b.addEventListener('click',()=>{ this._settingsTab=b.dataset.stab; this._openSettings(); }));
    this.panelBody.querySelector('#settings-back')?.addEventListener('click',()=>this._closePanel());
    this.panelBody.querySelector('#settings-reset')?.addEventListener('click',()=>{ this._confirmAction('Restaurar padrões', 'Restaurar configurações para os valores padrão? O progresso da campanha não será apagado.', ()=>{ this.settingsSystem.resetDefaults(); this._openSettings(); }); });
    this._renderSettingsTab();
    this.panel.classList.remove('hidden'); this.panel.setAttribute('aria-hidden','false');
  }

  _row(label, sub, controlHtml) {
    return `<div class="menu-setting"><div><label>${label}</label><span class="menu-setting-sub">${sub||''}</span></div><div class="setting-control">${controlHtml}</div></div>`;
  }
  _select(id, value, options) { return `<select id="${id}" class="setting-select">${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${l}</option>`).join('')}</select>`; }
  _range(id, value, min, max, step, labelId) { return `<div class="setting-range"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><span id="${labelId||id+'-val'}" class="setting-range-val"></span></div>`; }
  _toggle(id, checked, label='') { return `<label class="setting-toggle"><input id="${id}" type="checkbox" ${checked?'checked':''}><span>${label|| (checked?'Ativo':'Desativado')}</span></label>`; }

  _renderSettingsTab() {
    const s = this.settingsSystem.get();
    const el = this.panelBody.querySelector('#settings-content');
    if (!el) return;
    if (this._settingsTab === 'graphics') {
      el.innerHTML = `
        ${this._row('Qualidade predefinida','Baixa, média, alta ou personalizada.', this._select('set-g-preset', s.graphics.preset, [['mobile','Baixa'],['medium','Média'],['high','Alta'],['custom','Personalizada']]))}
        ${this._row('Escala de renderização','Reduza para ganhar desempenho em celulares.', this._range('set-g-scale', s.graphics.renderScale, 0.6, 1.2, 0.05))}
        ${this._row('Sombras','Ativa/desativa sombras dinâmicas.', this._toggle('set-g-shadows', s.graphics.shadows, s.graphics.shadows?'Ativo':'Desativado'))}
        ${this._row('Distância de renderização','Controla a névoa/alcance visual.', this._range('set-g-dist', s.graphics.renderDistance, 80, 260, 10))}
        ${this._row('Qualidade de texturas','Anisotropia/filtragem de texturas.', this._select('set-g-tex', s.graphics.textureQuality, [['low','Baixa'],['medium','Média'],['high','Alta']]))}
        ${this._row('Efeitos visuais','Pós-processamento e efeitos.', this._toggle('set-g-fx', s.graphics.effects, s.graphics.effects?'Ativo':'Desativado'))}
        ${this._row('Limite de FPS','Ajuda bateria/desempenho em mobile.', this._select('set-g-fps', s.graphics.fpsLimit, [[0,'Sem limite'],[30,'30 FPS'],[45,'45 FPS'],[60,'60 FPS']]))}
      `;
      const bind = (id, fn) => el.querySelector('#'+id)?.addEventListener('change', fn) || el.querySelector('#'+id)?.addEventListener('input', fn);
      bind('set-g-preset', e=>{ this.settingsSystem.patch({graphics:{...s.graphics,preset:e.target.value}}); this._openSettings(); });
      bind('set-g-scale', e=>{ const v=Number(e.target.value); el.querySelector('#set-g-scale-val').textContent=Math.round(v*100)+'%'; this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,renderScale:v,preset:'custom'}}); });
      bind('set-g-shadows', e=>{ this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,shadows:e.target.checked,preset:'custom'}}); e.target.nextElementSibling.textContent=e.target.checked?'Ativo':'Desativado'; });
      bind('set-g-dist', e=>{ const v=Number(e.target.value); el.querySelector('#set-g-dist-val').textContent=v+'m'; this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,renderDistance:v,preset:'custom'}}); });
      bind('set-g-tex', e=>{ this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,textureQuality:e.target.value,preset:'custom'}}); });
      bind('set-g-fx', e=>{ this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,effects:e.target.checked,preset:'custom'}}); e.target.nextElementSibling.textContent=e.target.checked?'Ativo':'Desativado'; });
      bind('set-g-fps', e=>{ this.settingsSystem.patch({graphics:{...this.settingsSystem.get().graphics,fpsLimit:Number(e.target.value)}}); });
      el.querySelector('#set-g-scale-val').textContent=Math.round(s.graphics.renderScale*100)+'%';
      el.querySelector('#set-g-dist-val').textContent=s.graphics.renderDistance+'m';
    } else if (this._settingsTab === 'audio') {
      const a = s.audio;
      const r = (k,l,sub)=>this._row(l,sub,`<div class="setting-range"><input id="set-a-${k}" type="range" min="0" max="100" step="1" value="${Math.round((a[k]||0)*100)}"><span id="set-a-${k}-val" class="setting-range-val">${Math.round((a[k]||0)*100)}%</span></div><label class="setting-toggle" style="margin-left:8px"><input id="set-a-m-${k}" type="checkbox" ${a['mute'+k[0].toUpperCase()+k.slice(1)]?'checked':''}><span>Mudo</span></label>`);
      el.innerHTML = `${r('master','Volume geral','Afeta todo o áudio.')} ${r('music','Música','Trilha e música dinâmica.')} ${r('sfx','Efeitos sonoros','Combate, interface e interações.')} ${r('ambient','Ambiente','Vento, chuva e atmosfera.')} ${r('voice','Personagens/voz','Zumbis e diálogos.')}`;
      ['master','music','sfx','ambient','voice'].forEach(k=>{
        el.querySelector(`#set-a-${k}`)?.addEventListener('input', e=>{ const v=(Number(e.target.value)||0)/100; el.querySelector(`#set-a-${k}-val`).textContent=Math.round(v*100)+'%'; this.settingsSystem.patch({audio:{...this.settingsSystem.get().audio,[k]:v}}); });
        const mk='mute'+k[0].toUpperCase()+k.slice(1);
        el.querySelector(`#set-a-m-${k}`)?.addEventListener('change', e=>{ this.settingsSystem.patch({audio:{...this.settingsSystem.get().audio,[mk]:e.target.checked}}); });
      });
    } else if (this._settingsTab === 'controls') {
      const c = s.controls;
      el.innerHTML = `
        ${this._row('Sensibilidade da câmera','Mouse/look no desktop.', this._range('set-c-cam', c.cameraSensitivity, 0.4, 2.0, 0.05))}
        ${this._row('Sensibilidade da mira','Multiplicador adicional de mira/look.', this._range('set-c-aim', c.aimSensitivity, 0.4, 2.0, 0.05))}
        ${this._row('Sensibilidade toque','Arrastar câmera no mobile.', this._range('set-c-touch', c.touchSensitivity, 0.4, 2.5, 0.05))}
        ${this._row('Inverter eixo vertical','Inverte o olhar vertical.', this._toggle('set-c-invy', c.invertY, c.invertY?'Ativo':'Desativado'))}
        ${this._row('Tamanho dos botões mobile','Escala dos botões de toque.', this._range('set-c-btn', c.touchButtonScale, 0.8, 1.4, 0.05))}
        ${this._row('Opacidade dos botões mobile','Visibilidade dos controles de toque.', this._range('set-c-btno', c.touchButtonOpacity, 0.25, 0.85, 0.05))}
        <div class="menu-setting"><div><label>Teclado e mouse</label><span class="menu-setting-sub">WASD mover, Mouse câmera, Shift correr, Espaço pular, E interagir, I inventário, M missões, N mapa, F/clique ataque, Q especial, Esc fechar.</span></div></div>
      `;
      const bindR=(id,key,fmt)=>el.querySelector('#'+id)?.addEventListener('input',e=>{ const v=Number(e.target.value); el.querySelector('#'+id+'-val').textContent=fmt(v); const cur=this.settingsSystem.get().controls; this.settingsSystem.patch({controls:{...cur,[key]:v}}); });
      bindR('set-c-cam','cameraSensitivity',v=>Math.round(v*100)+'%');
      bindR('set-c-aim','aimSensitivity',v=>Math.round(v*100)+'%');
      bindR('set-c-touch','touchSensitivity',v=>Math.round(v*100)+'%');
      bindR('set-c-btn','touchButtonScale',v=>Math.round(v*100)+'%');
      bindR('set-c-btno','touchButtonOpacity',v=>Math.round(v*100)+'%');
      el.querySelector('#set-c-invy')?.addEventListener('change',e=>{ this.settingsSystem.patch({controls:{...this.settingsSystem.get().controls,invertY:e.target.checked}}); e.target.nextElementSibling.textContent=e.target.checked?'Ativo':'Desativado'; });
      [['set-c-cam',c.cameraSensitivity],['set-c-aim',c.aimSensitivity],['set-c-touch',c.touchSensitivity],['set-c-btn',c.touchButtonScale],['set-c-btno',c.touchButtonOpacity]].forEach(([id,v])=>{ const n=el.querySelector('#'+id+'-val'); if(n) n.textContent=Math.round(v*100)+'%'; });
    } else if (this._settingsTab === 'accessibility') {
      const a = s.accessibility;
      el.innerHTML = `
        ${this._row('Tamanho do texto','Aumenta a legibilidade da interface.', this._range('set-ac-text', a.textScale, 0.9, 1.3, 0.05))}
        ${this._row('Reduzir movimentos','Reduz animações/efeitos visuais.', this._toggle('set-ac-motion', a.reduceMotion, a.reduceMotion?'Ativo':'Desativado'))}
        ${this._row('Alto contraste','Melhora legibilidade da HUD/painéis.', this._toggle('set-ac-contrast', a.highContrast, a.highContrast?'Ativo':'Desativado'))}
        ${this._row('Indicadores grandes','Aumenta destaque de indicadores visuais.', this._toggle('set-ac-ind', a.largeIndicators, a.largeIndicators?'Ativo':'Desativado'))}
      `;
      el.querySelector('#set-ac-text')?.addEventListener('input',e=>{ const v=Number(e.target.value); el.querySelector('#set-ac-text-val').textContent=Math.round(v*100)+'%'; this.settingsSystem.patch({accessibility:{...this.settingsSystem.get().accessibility,textScale:v}}); });
      el.querySelector('#set-ac-text-val').textContent=Math.round(a.textScale*100)+'%';
      [['set-ac-motion','reduceMotion'],['set-ac-contrast','highContrast'],['set-ac-ind','largeIndicators']].forEach(([id,key])=>{
        el.querySelector('#'+id)?.addEventListener('change',e=>{ this.settingsSystem.patch({accessibility:{...this.settingsSystem.get().accessibility,[key]:e.target.checked}}); e.target.nextElementSibling.textContent=e.target.checked?'Ativo':'Desativado'; });
      });
    }
  }

  _openCredits() {
    this.panelTitle.textContent = 'Créditos';
    this.panelBody.innerHTML = `<div class="menu-credits"><p><strong>NEON STRIKE 2.0</strong><br>Protótipo de sobrevivência pós-apocalíptica em Three.js.</p><h3>Desenvolvimento</h3><p>Projeto Neon Strike 2.0 — desenvolvimento iterativo no ambiente OpenCode.</p><h3>Tecnologia</h3><p>Three.js (WebGL), JavaScript ES Modules, HTML/CSS.</p><h3>Assets de terceiros</h3><p>Veículos: Kenney (CC0). Zumbis: Quaternius (CC0). Árvores/natureza: assets GLB CC0 integrados no projeto. Demais elementos visuais: gerados proceduralmente no projeto.</p><h3>Aviso</h3><p>Build em desenvolvimento. Alguns sistemas podem exigir validação adicional em navegador e Android.</p></div>`;
    this.panel.classList.remove('hidden'); this.panel.setAttribute('aria-hidden','false');
  }

  _handleExit() {
    this.panelTitle.textContent = 'Sair';
    this.panelBody.innerHTML = `<p>Em navegadores web, a página não pode ser fechada automaticamente por segurança. Você pode fechar esta aba/janela manualmente.</p>`;
    this.panel.classList.remove('hidden'); this.panel.setAttribute('aria-hidden','false');
  }
}
