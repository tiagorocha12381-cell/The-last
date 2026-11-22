import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  return { c, ctx };
}

function noise(ctx, w, h, alpha = 0.08, mono = true) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    else { d[i] += (Math.random() - 0.5) * 255 * alpha; d[i+1] += (Math.random() - 0.5) * 255 * alpha; d[i+2] += (Math.random() - 0.5) * 255 * alpha; }
  }
  ctx.putImageData(img, 0, 0);
}

function canvasToTexture(c, { srgb = true, repeatX = 1, repeatY = 1 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function canvasToDataTexture(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function stain(ctx, w, h, count = 10, alpha = 0.08) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 15 + Math.random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(35,32,28,${alpha})`);
    g.addColorStop(1, 'rgba(35,32,28,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

export class TextureFactory {
  constructor() { this.cache = new Map(); }
  get(key, builder) { if (!this.cache.has(key)) this.cache.set(key, builder()); return this.cache.get(key); }

  asphalt(repeatX = 1, repeatY = 1) {
    return this.get(`asphalt:${repeatX}:${repeatY}`, () => {
      const w = 512, h = 512;
      const { c, ctx } = makeCanvas(w, h);
      ctx.fillStyle = '#272c34'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const g = 32 + Math.random() * 40;
        ctx.fillStyle = `rgba(${g},${g+2},${g+4},${0.05 + Math.random() * 0.07})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 1 + Math.random()*3, 1 + Math.random()*3);
      }
      stain(ctx, w, h, 10, 0.14);
      // cracks
      ctx.strokeStyle = 'rgba(18,18,20,0.28)'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        let x = Math.random()*w, y = Math.random()*h; ctx.moveTo(x,y);
        for (let j=0;j<8;j++){ x += (Math.random()-0.5)*55; y += (Math.random()-0.5)*55; ctx.lineTo(x,y); }
        ctx.stroke();
      }
      // skid marks (white-ish streaks)
      for (let i = 0; i < 16; i++) {
        const s = 200 + Math.random() * 80, a = 0.45 + Math.random() * 0.35;
        ctx.strokeStyle = `rgba(${s},${s - 12},${s - 25},${a})`;
        ctx.lineWidth = 2 + Math.random() * 2.2;
        ctx.beginPath();
        let x = Math.random() * w * 0.3 + w * 0.35, y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 10; j++) {
          x += (Math.random() - 0.5) * 60;
          y += Math.random() * 12 + 0.8;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // tire marks (thin vertical streaks)
      ctx.strokeStyle = 'rgba(200,198,190,0.35)'; ctx.lineWidth = 1.1;
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // pothole patches
      for (let i = 0; i < 5; i++) {
        const x = Math.random()*w, y = Math.random()*h, r = 10+Math.random()*22;
        const g = ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(25,26,28,0.35)'); g.addColorStop(1,'rgba(25,26,28,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      noise(ctx, w, h, 0.05);

      const { c: rc, ctx: rctx } = makeCanvas(w, h);
      rctx.fillStyle = '#b2b2b2'; rctx.fillRect(0,0,w,h);
      noise(rctx,w,h,0.05);
      rctx.fillStyle = 'rgba(70,70,70,0.25)';
      for (let i=0;i<6;i++){ rctx.beginPath(); rctx.arc(Math.random()*w,Math.random()*h,10+Math.random()*20,0,Math.PI*2); rctx.fill(); }

      const { c: nc, ctx: nctx } = makeCanvas(w, h);
      nctx.fillStyle = '#8080ff'; nctx.fillRect(0,0,w,h);
      noise(nctx,w,h,0.03,false);
      for (let i=0;i<6;i++){
        const x=Math.random()*w,y=Math.random()*h,r=10+Math.random()*20;
        const g=nctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(110,110,180,0.8)'); g.addColorStop(1,'rgba(128,128,255,0)');
        nctx.fillStyle=g; nctx.beginPath(); nctx.arc(x,y,r,0,Math.PI*2); nctx.fill();
      }
      return {
        map: canvasToTexture(c, { srgb: true, repeatX, repeatY }),
        roughnessMap: canvasToDataTexture(rc, repeatX, repeatY),
        normalMap: canvasToDataTexture(nc, repeatX, repeatY),
      };
    });
  }

  concrete(repeatX = 1, repeatY = 1, tint = '#8a8d8f') {
    return this.get(`concrete:${tint}:${repeatX}:${repeatY}`, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle=tint; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.lineWidth=3;
      for(let i=1;i<4;i++){ ctx.beginPath(); ctx.moveTo(i*w/4,0); ctx.lineTo(i*w/4,h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i*h/4); ctx.lineTo(w,i*h/4); ctx.stroke(); }
      for(let i=0;i<12000;i++){ const v=Math.random()*36-18; ctx.fillStyle=`rgba(${130+v},${132+v},${134+v},0.06)`; ctx.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2); }
      stain(ctx,w,h,8,0.06);
      // cracks
      ctx.strokeStyle='rgba(40,38,36,0.14)'; ctx.lineWidth=1;
      for(let i=0;i<5;i++){ ctx.beginPath(); let x=Math.random()*w,y=Math.random()*h; ctx.moveTo(x,y); for(let j=0;j<5;j++){x+=(Math.random()-0.5)*40;y+=(Math.random()-0.5)*40;ctx.lineTo(x,y);} ctx.stroke(); }
      noise(ctx,w,h,0.04);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#989898'; rctx.fillRect(0,0,w,h); noise(rctx,w,h,0.07);
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h);
      nctx.strokeStyle='rgba(120,120,255,0.45)'; nctx.lineWidth=2;
      for(let i=1;i<4;i++){ nctx.beginPath(); nctx.moveTo(i*w/4,0); nctx.lineTo(i*w/4,h); nctx.stroke(); nctx.beginPath(); nctx.moveTo(0,i*h/4); nctx.lineTo(w,i*h/4); nctx.stroke(); }
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY) };
    });
  }

  sidewalk(repeatX = 1, repeatY = 1) {
    return this.get(`sidewalk:${repeatX}:${repeatY}`, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle='#94979a'; ctx.fillRect(0,0,w,h);
      // paver grid
      ctx.strokeStyle='rgba(0,0,0,0.13)'; ctx.lineWidth=5;
      const cols=4, rows=4;
      for(let i=0;i<=cols;i++){ ctx.beginPath(); ctx.moveTo(i*w/cols,0); ctx.lineTo(i*w/cols,h); ctx.stroke(); }
      for(let i=0;i<=rows;i++){ ctx.beginPath(); ctx.moveTo(0,i*h/rows); ctx.lineTo(w,i*h/rows); ctx.stroke(); }
      for(let i=0;i<15000;i++){ const v=Math.random()*30-15; ctx.fillStyle=`rgba(${145+v},${148+v},${150+v},0.05)`; ctx.fillRect(Math.random()*w,Math.random()*h,2,2); }
      stain(ctx,w,h,12,0.07);
      // gum/dirt spots
      for(let i=0;i<30;i++){ ctx.fillStyle=`rgba(55,50,45,${Math.random()*0.08})`; ctx.beginPath(); ctx.arc(Math.random()*w,Math.random()*h,1+Math.random()*3,0,Math.PI*2); ctx.fill(); }
      noise(ctx,w,h,0.04);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#a0a0a0'; rctx.fillRect(0,0,w,h); noise(rctx,w,h,0.07);
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h);
      nctx.strokeStyle='rgba(115,115,245,0.55)'; nctx.lineWidth=3;
      for(let i=0;i<=cols;i++){ nctx.beginPath(); nctx.moveTo(i*w/cols,0); nctx.lineTo(i*w/cols,h); nctx.stroke(); }
      for(let i=0;i<=rows;i++){ nctx.beginPath(); nctx.moveTo(0,i*h/rows); nctx.lineTo(w,i*h/rows); nctx.stroke(); }
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY) };
    });
  }

  brick(repeatX = 1, repeatY = 1) {
    return this.get(`brick:${repeatX}:${repeatY}`, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle='#756058'; ctx.fillRect(0,0,w,h);
      const brickH=32, brickW=64, mortar=4;
      for(let row=0;row<h/brickH+1;row++){
        const offset=(row%2)*(brickW/2);
        for(let col=-1;col<w/brickW+1;col++){
          const x=col*brickW+offset, y=row*brickH;
          const v=Math.floor(Math.random()*30)-15;
          const r=124+v, g=89+v*0.7, b=72+v*0.5;
          ctx.fillStyle=`rgb(${r|0},${g|0},${b|0})`;
          ctx.fillRect(x+mortar/2,y+mortar/2,brickW-mortar,brickH-mortar);
          // subtle edge darkening
          ctx.fillStyle='rgba(0,0,0,0.06)';
          ctx.fillRect(x+mortar/2,y+brickH-mortar/2-2,brickW-mortar,2);
        }
      }
      stain(ctx,w,h,6,0.06);
      noise(ctx,w,h,0.035);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#868686'; rctx.fillRect(0,0,w,h);
      rctx.fillStyle='#b8b8b8';
      for(let row=0;row<h/brickH+1;row++){ rctx.fillRect(0,row*brickH-1,w,mortar); const offset=(row%2)*(brickW/2); for(let col=-1;col<w/brickW+1;col++){ rctx.fillRect(col*brickW+offset-1,row*brickH,mortar,brickH); } }
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h);
      nctx.strokeStyle='#6d6dea'; nctx.lineWidth=2;
      for(let row=0;row<h/brickH+1;row++){ nctx.strokeRect(-10,row*brickH,w+20,brickH); }
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY) };
    });
  }

  plaster(repeatX = 1, repeatY = 1, tint = '#9d9890') {
    return this.get(`plaster:${tint}:${repeatX}:${repeatY}`, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle=tint; ctx.fillRect(0,0,w,h);
      for(let i=0;i<14000;i++){ const v=Math.random()*28-14; ctx.fillStyle=`rgba(${140+v},${135+v},${126+v},0.05)`; ctx.fillRect(Math.random()*w,Math.random()*h,2,2); }
      stain(ctx,w,h,14,0.07);
      // peeling/damage patches
      for(let i=0;i<5;i++){ const x=Math.random()*w,y=Math.random()*h,rw=20+Math.random()*50,rh=15+Math.random()*40; ctx.fillStyle='rgba(95,85,75,0.10)'; ctx.fillRect(x,y,rw,rh); }
      noise(ctx,w,h,0.04);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#a5a5a5'; rctx.fillRect(0,0,w,h); noise(rctx,w,h,0.06);
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h); noise(nctx,w,h,0.02,false);
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY) };
    });
  }

  ground(repeatX = 1, repeatY = 1) {
    return this.get(`ground:${repeatX}:${repeatY}`, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle='#596355'; ctx.fillRect(0,0,w,h);
      for(let i=0;i<22000;i++){ const g=55+Math.random()*65; const r=g*0.95,b=g*0.72; ctx.fillStyle=`rgba(${r|0},${g|0},${b|0},${0.1})`; ctx.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2); }
      for(let i=0;i<40;i++){ const x=Math.random()*w,y=Math.random()*h,rad=12+Math.random()*45; const grad=ctx.createRadialGradient(x,y,0,x,y,rad); grad.addColorStop(0,'rgba(90,76,56,0.22)'); grad.addColorStop(1,'rgba(90,76,56,0)'); ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill(); }
      noise(ctx,w,h,0.045);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#bab2a2'; rctx.fillRect(0,0,w,h); noise(rctx,w,h,0.08);
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h); noise(nctx,w,h,0.025,false);
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY) };
    });
  }

  metal(repeatX = 1, repeatY = 1, base = '#6f7680') {
    return this.get(`metal:${base}:${repeatX}:${repeatY}`, () => {
      const w=256,h=256; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle=base; ctx.fillRect(0,0,w,h);
      for(let i=0;i<2500;i++){ const v=Math.random()*40-20; ctx.fillStyle=`rgba(${120+v},${125+v},${130+v},0.1)`; ctx.fillRect(Math.random()*w,Math.random()*h,Math.random()*10+1,1); }
      // scratches
      ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
      for(let i=0;i<20;i++){ ctx.beginPath(); ctx.moveTo(Math.random()*w,Math.random()*h); ctx.lineTo(Math.random()*w,Math.random()*h); ctx.stroke(); }
      noise(ctx,w,h,0.05);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#686868'; rctx.fillRect(0,0,w,h); noise(rctx,w,h,0.08);
      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h); noise(nctx,w,h,0.02,false);
      return { map:canvasToTexture(c,{srgb:true,repeatX,repeatY}), roughnessMap:canvasToDataTexture(rc,repeatX,repeatY), normalMap:canvasToDataTexture(nc,repeatX,repeatY), metalness:0.35 };
    });
  }

  weeds(repeatX = 1, repeatY = 1) {
    return this.get(`weeds:${repeatX}:${repeatY}`, () => {
      const w = 512, h = 512;
      const { c, ctx } = makeCanvas(w, h);
      ctx.fillStyle = '#3a5a2e'; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 0.035, true);
      // weed tufts: dark trunk + 2-3 leaf balls
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = `rgba(${14 + Math.random()*8},${26 + Math.random()*8},${12 + Math.random()*6},0.95)`;
        const tw = 4 + Math.random()*6, th = 22 + Math.random()*14;
        ctx.fillRect(x - tw/2, y - th/2, tw, th);
        const colors = ['#7d9e6a', '#6f8f5e', '#8fb068'];
        for (let j = 0; j < 3; j++) {
          const r = 7 + Math.random()*8;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, colors[j]);
          g.addColorStop(1, 'rgba(30, 58, 24, 0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x + (Math.random()-0.5)*10, y - 5 + j*7 + Math.random()*3, r, 0, Math.PI*2); ctx.fill();
        }
      }
      noise(ctx, w, h, 0.04, true);
      return { map: canvasToTexture(c, { srgb: true, repeatX, repeatY }) };
    });
  }

  roadMarking() {
    return this.get('roadMarking', () => {
      const w = 512, h = 512;
      const { c, ctx } = makeCanvas(w, h);
      ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      // vertical dashes (center line of road A runs along Z)
      for (let y = 6; y < h; y += 32) {
        ctx.beginPath(); ctx.moveTo(w/2, y); ctx.lineTo(w/2, Math.min(h, y + 22)); ctx.stroke();
      }
      // horizontal dashes (center line of road B runs along X)
      for (let x = 6; x < w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, h/2); ctx.lineTo(Math.min(w, x + 22), h/2); ctx.stroke();
      }
      return { map: canvasToTexture(c, { srgb: true, repeatX: 1, repeatY: 1 }) };
    });
  }

  crosswalkHatch() {
    return this.get('crosswalkHatch', () => {
      const w = 512, h = 512;
      const { c, ctx } = makeCanvas(w, h);
      ctx.fillStyle = '#b6b0a4'; ctx.fillRect(0, 0, w, h);
      // diagonal zebra stripes
      for (let i = 0; i < 22; i++) {
        const v = 215 + Math.random()*30;
        ctx.strokeStyle = `rgba(${v},${v},${v},0.86)`;
        ctx.lineWidth = 36;
        ctx.beginPath();
        ctx.moveTo(-60, i * (h / 22)); ctx.lineTo(w + 60, i * (h / 22) + h);
        ctx.stroke();
      }
      noise(ctx, w, h, 0.05, true);
      return { map: canvasToTexture(c, { srgb: true, repeatX: 1, repeatY: 1 }) };
    });
  }

  facade(repeatX = 1, repeatY = 1, opts = {}) {
    const { base='#7a7670', windowColor='#2f3d4d', litChance=0.08, cols=6, rows=10, accent='#5a5550', damage=0.15 } = opts;
    const key = `facade:${base}:${windowColor}:${litChance}:${cols}:${rows}:${accent}:${damage}:${repeatX}:${repeatY}`;
    return this.get(key, () => {
      const w=512,h=512; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle=base; ctx.fillRect(0,0,w,h);
      for(let i=0;i<8000;i++){ const v=Math.random()*20-10; ctx.fillStyle=`rgba(${120+v},${118+v},${112+v},0.04)`; ctx.fillRect(Math.random()*w,Math.random()*h,2,2); }
      stain(ctx,w,h,10,0.08);
      // horizontal bands
      ctx.fillStyle = accent; ctx.globalAlpha = 0.12;
      for(let i=0;i<3;i++){ ctx.fillRect(0, (h*(i+1))/4 - 4, w, 8); }
      ctx.globalAlpha = 1;

      const padX=28, padY=24;
      const cellW=(w-padX*2)/cols, cellH=(h-padY*2)/rows;
      const {c:ec,ctx:ectx}=makeCanvas(w,h); ectx.fillStyle='#000'; ectx.fillRect(0,0,w,h);
      const {c:rc,ctx:rctx}=makeCanvas(w,h); rctx.fillStyle='#9a9a9a'; rctx.fillRect(0,0,w,h);

      for(let r=0;r<rows;r++){
        for(let col=0;col<cols;col++){
          const x=padX+col*cellW+cellW*0.18;
          const y=padY+r*cellH+cellH*0.12;
          const ww=cellW*0.64, wh=cellH*0.72;
          const lit = Math.random() < litChance;
          // window recess frame
          ctx.fillStyle='rgba(25,25,25,0.35)'; ctx.fillRect(x-2,y-2,ww+4,wh+4);
          ctx.fillStyle = lit ? '#c8b07a' : windowColor;
          ctx.fillRect(x,y,ww,wh);
          // glass reflection / grime
          ctx.fillStyle = lit ? 'rgba(255,245,200,0.14)' : 'rgba(170,205,255,0.10)';
          ctx.fillRect(x+2,y+2,ww*0.45,wh-4);
          ctx.fillStyle = lit ? 'rgba(255,230,170,0.08)' : 'rgba(40,50,60,0.18)';
          ctx.fillRect(x+ww*0.55,y+2,ww*0.43,wh-4);
          // window sill (dark strip at base)
          ctx.fillStyle = lit ? 'rgba(0,0,0,0.30)' : 'rgba(25,20,18,0.45)';
          ctx.fillRect(x + 2, y + wh - 3, ww - 4, 3);
          // mullion
          ctx.strokeStyle='rgba(20,20,20,0.45)'; ctx.lineWidth=2; ctx.strokeRect(x,y,ww,wh);
          ctx.beginPath(); ctx.moveTo(x+ww/2,y); ctx.lineTo(x+ww/2,y+wh); ctx.stroke();
          // blinds/damage
          if(!lit && Math.random()<0.25){ ctx.fillStyle='rgba(35,32,28,0.35)'; ctx.fillRect(x,y+wh*0.55,ww,wh*0.45); }
          if(Math.random()<damage*0.2){ ctx.fillStyle='rgba(60,55,50,0.25)'; ctx.fillRect(x-4,y+wh-2,ww+8,6); }

          // emissive for lit windows
          if(lit){ ectx.fillStyle='rgba(255,220,150,0.9)'; ectx.fillRect(x,y,ww,wh); }
          // roughness: glass smoother
          rctx.fillStyle = lit ? '#383838' : '#303030'; rctx.fillRect(x,y,ww,wh);
        }
      }
      // bottom grime
      const grd=ctx.createLinearGradient(0,h*0.65,0,h); grd.addColorStop(0,'rgba(30,28,25,0)'); grd.addColorStop(1,'rgba(30,28,25,0.28)');
      ctx.fillStyle=grd; ctx.fillRect(0,0,w,h);
      noise(ctx,w,h,0.025);

      const {c:nc,ctx:nctx}=makeCanvas(w,h); nctx.fillStyle='#8080ff'; nctx.fillRect(0,0,w,h); noise(nctx,w,h,0.015,false);
      return {
        map: canvasToTexture(c,{srgb:true,repeatX,repeatY}),
        roughnessMap: canvasToDataTexture(rc,repeatX,repeatY),
        normalMap: canvasToDataTexture(nc,repeatX,repeatY),
        emissiveMap: canvasToDataTexture(ec,repeatX,repeatY),
      };
    });
  }

  sign(text = 'SHOP', bg = '#7b2d2d', fg = '#f2efe8') {
    const key = `sign:${text}:${bg}:${fg}`;
    return this.get(key, () => {
      const w=256,h=96; const {c,ctx}=makeCanvas(w,h);
      ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=6; ctx.strokeRect(4,4,w-8,h-8);
      ctx.fillStyle=fg; ctx.font='bold 34px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(text).slice(0,12), w/2, h/2+2);
      noise(ctx,w,h,0.05);
      return { map: canvasToTexture(c,{srgb:true,repeatX:1,repeatY:1}) };
    });
  }
}
