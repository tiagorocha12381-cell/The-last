export class MapUI {
  constructor(discoverySystem, missionSystem) {
    this.discoverySystem = discoverySystem;
    this.missionSystem = missionSystem;
    this.overlay = document.getElementById('map-overlay');
    this.canvas = document.getElementById('map-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.closeBtn = document.getElementById('map-close');
    this.isOpen = false;
    this.onOpenChange = null;
    this.playerPos = { x: 0, z: 0 };
    this.zoom = 1;
    this.panX = 0; this.panY = 0;
    this._drag = null;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    this._bindCanvas();
  }

  _bindCanvas() {
    const c = this.canvas;
    if (!c) return;
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.5, Math.min(3, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); this.render(); }, { passive:false });
    c.addEventListener('pointerdown', (e) => { this._drag = { x: e.clientX, y: e.clientY, panX: this.panX, panY: this.panY }; c.setPointerCapture?.(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (!this._drag) return; this.panX = this._drag.panX + (e.clientX - this._drag.x); this.panY = this._drag.panY + (e.clientY - this._drag.y); this.render(); });
    const end = () => { this._drag = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end); c.addEventListener('pointerleave', end);
  }

  toggle() { this.isOpen ? this.close() : this.open(); }
  open() { this.isOpen = true; this.overlay.classList.remove('hidden'); this.overlay.setAttribute('aria-hidden','false'); this.render(); this.onOpenChange?.(true); }
  close() { this.isOpen = false; this.overlay.classList.add('hidden'); this.overlay.setAttribute('aria-hidden','true'); this.onOpenChange?.(false); }

  setPlayerPos(pos) { this.playerPos = { x: pos.x, z: pos.z }; if (this.isOpen) this.render(); }

  _worldToMap(x,z,w,h){
    const scale = 1.6 * this.zoom;
    return [w/2 + (x - this.playerPos.x) * scale + this.panX, h/2 + (z - this.playerPos.z) * scale + this.panY];
  }

  render() {
    const ctx = this.ctx, c = this.canvas;
    if (!ctx || !c) return;
    const w = c.width = c.clientWidth * devicePixelRatio;
    const h = c.height = c.clientHeight * devicePixelRatio;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#12161b'; ctx.fillRect(0,0,w,h);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    const grid=50; const scale=1.6*this.zoom;
    const ox = (w/2 + this.panX) % (grid*scale);
    const oy = (h/2 + this.panY) % (grid*scale);
    for(let x=ox-grid*scale; x<w+grid*scale; x+=grid*scale){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for(let y=oy-grid*scale; y<h+grid*scale; y+=grid*scale){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

    // regions
    for (const r of this.discoverySystem.districts.getRegions()) {
      const [rx,ry] = this._worldToMap(r.center.x, r.center.z, w, h);
      ctx.fillStyle = r.discovered ? 'rgba(217,107,75,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = r.discovered ? 'rgba(217,107,75,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx,ry,(r.radius||55)*scale,0,Math.PI*2); ctx.fill(); ctx.stroke();
      if (r.discovered) {
        ctx.fillStyle = 'rgba(240,226,207,0.7)'; ctx.font = `${12*devicePixelRatio}px sans-serif`; ctx.textAlign='center';
        ctx.fillText(r.name, rx, ry - (r.radius||55)*scale - 6*devicePixelRatio);
      }
    }

    // POIs
    const allPois = [...this.discoverySystem.districts.getPOIs(), ...(this.discoverySystem.getCustomPoints?.()||[])];
    for (const p of allPois) {
      if (!p.discovered) continue;
      if (p.showOnMap === false) continue;
      const [px,py] = this._worldToMap(p.pos.x, p.pos.z, w, h);
      ctx.fillStyle = p.secret ? '#b68cff' : '#ffbf8a';
      ctx.beginPath(); ctx.arc(px,py,5*devicePixelRatio,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e2cf'; ctx.font = `${11*devicePixelRatio}px sans-serif`; ctx.textAlign='left';
      ctx.fillText(p.name, px+8*devicePixelRatio, py+4*devicePixelRatio);
    }

    // mission objective
    const obj = this.missionSystem?.getActiveObjective?.();
    const target = obj ? this.missionSystem.getObjectiveTargetPosition?.(obj.target) : null;
    if (target) {
      const [mx,my] = this._worldToMap(target.pos.x, target.pos.z, w, h);
      ctx.strokeStyle = '#66ff88'; ctx.lineWidth = 2*devicePixelRatio;
      ctx.beginPath(); ctx.arc(mx,my,8*devicePixelRatio,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#66ff88'; ctx.font = `${11*devicePixelRatio}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('OBJETIVO', mx, my-12*devicePixelRatio);
    }

    // player
    const [cx,cy] = this._worldToMap(this.playerPos.x, this.playerPos.z, w, h);
    ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(cx,cy,6*devicePixelRatio,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2*devicePixelRatio; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font=`${11*devicePixelRatio}px sans-serif`; ctx.textAlign='center'; ctx.fillText('VOCÊ', cx, cy-12*devicePixelRatio);
  }
}
