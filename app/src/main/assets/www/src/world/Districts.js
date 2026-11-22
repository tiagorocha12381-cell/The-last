import * as THREE from 'three';
import { TextureFactory } from '../core/TextureFactory.js';

function makeBox(w,h,d,mat){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.castShadow=true; m.receiveShadow=true; return m; }
function makePlane(w,h,mat){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat); m.rotation.x=-Math.PI/2; m.receiveShadow=true; return m; }

export class Districts {
  constructor(scene, collisions, interactionSystem, inventory) {
    this.scene = scene;
    this.collisions = collisions;
    this.interactionSystem = interactionSystem;
    this.inventory = inventory;
    this.tex = new TextureFactory();
    this.group = new THREE.Group();
    this.group.name = 'Districts';
    this.scene.add(this.group);
    this.regions = []; // {id,name,center,radius,group,colliders,discovered}
    this.pois = []; // {id,name,type,pos,radius,regionId,discovered,marker}
    this._build();
  }

  _mat(texDef, extra={}){
    const m = new THREE.MeshStandardMaterial({ map:texDef.map, roughnessMap:texDef.roughnessMap, normalMap:texDef.normalMap, roughness:extra.roughness??0.94, metalness:extra.metalness??0.03, color:extra.color??0xffffff });
    if (texDef.emissiveMap) { m.emissive=new THREE.Color(0xffe6b0); m.emissiveMap=texDef.emissiveMap; m.emissiveIntensity=extra.emissiveIntensity??0.6; }
    return m;
  }

  _addRegion(cfg){
    const g = new THREE.Group(); g.name = cfg.id; g.position.set(cfg.cx,0,cfg.cz);
    this.group.add(g);
    const region = { ...cfg, center:new THREE.Vector3(cfg.cx,0,cfg.cz), group:g, colliders:[], loaded:true };
    this.regions.push(region);
    return region;
  }

  _addCollider(region, min, max){
    const entry = this.collisions.addBox(min,max);
    region.colliders.push(entry);
    return entry;
  }

  _road(region, w,d,x,y,z, mat){
    const m = makePlane(w,d,mat); m.position.set(x,y,z); m.receiveShadow=true; region.group.add(m); return m;
  }
  _box(region,w,h,d,mat,x,y,z){
    const m=makeBox(w,h,d,mat); m.position.set(x,y,z); region.group.add(m); return m;
  }

  _building(region, cfg){
    const {x,z,w,d,h,tex,sideTex,roof=0x4a4f55,sign} = cfg;
    const yBase=0.18;
    const facade=this._mat(tex,{roughness:0.92,emissiveIntensity:0.55});
    const side=this._mat(sideTex||tex,{roughness:0.94,emissiveIntensity:0.4});
    const roofMat=new THREE.MeshStandardMaterial({color:roof,roughness:0.98,metalness:0.05});
    const baseMat=this._mat(this.tex.concrete(2,1,'#6e7075'),{roughness:0.96});
    const dark=new THREE.MeshStandardMaterial({color:0x3b4046,roughness:0.85,metalness:0.1});
    const baseH=0.7, bodyH=h-baseH-0.35;
    const base=makeBox(w+0.25,baseH,d+0.25,baseMat); base.position.set(x,yBase+baseH/2,z); region.group.add(base);
    const mats=[side,side,roofMat,baseMat,facade,side];
    const body=new THREE.Mesh(new THREE.BoxGeometry(w,bodyH,d),mats); body.position.set(x,yBase+baseH+bodyH/2,z); body.castShadow=true; body.receiveShadow=true; region.group.add(body);
    const top=makeBox(w+0.5,0.35,d+0.5,roofMat); top.position.set(x,yBase+h-0.175,z); region.group.add(top);
    const parap=makeBox(w+0.55,0.5,d+0.55,dark); parap.position.set(x,yBase+h+0.1,z); region.group.add(parap);
    // ledges
    const ledgeMat=new THREE.MeshStandardMaterial({color:0x646a72,roughness:0.82,metalness:0.12});
    const n=Math.max(2,Math.floor(bodyH/3.2));
    for(let i=1;i<=n;i++){ const ly=yBase+baseH+(i*bodyH)/(n+1); const l=makeBox(w+0.35,0.1,d+0.35,ledgeMat); l.position.set(x,ly,z); region.group.add(l); }
    if(sign) this._sign(region, x, yBase+baseH+1.2, z+d/2+0.26, sign);
    this._addCollider(region, new THREE.Vector3(region.center.x+x-w/2-0.1,0,region.center.z+z-d/2-0.1), new THREE.Vector3(region.center.x+x+w/2+0.1,h+0.6,region.center.z+z+d/2+0.1));
  }

  _sign(region,x,y,z,text){
    const c=document.createElement('canvas'); c.width=256; c.height=64; const ctx=c.getContext('2d');
    ctx.fillStyle='#2a2f35'; ctx.fillRect(0,0,256,64); ctx.fillStyle='#f0e2cf'; ctx.font='bold 28px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,32);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.55), new THREE.MeshBasicMaterial({map:t,transparent:true}));
    m.position.set(x,y,z); region.group.add(m);
  }

  _poi(region, cfg){
    const poi = { ...cfg, regionId:region.id, discovered:false };
    this.pois.push(poi);
    // Simple discoverable content: a supply crate/document interactable near POI
    const px = cfg.pos.x - region.center.x, pz = cfg.pos.z - region.center.z;
    const crate = makeBox(0.7,0.45,0.5, new THREE.MeshStandardMaterial({color:0x6b5842,roughness:0.9,metalness:0.05}));
    crate.position.set(px,0.405,pz);
    region.group.add(crate);
    this.interactionSystem?.register({
      id: 'poi_loot_' + cfg.id,
      name: cfg.name,
      type: 'container',
      description: `Você encontrou recursos em ${cfg.name}.`,
      position: new THREE.Vector3(cfg.pos.x, 0.4, cfg.pos.z),
      radius: 2.2,
      promptLabel: `Vasculhar ${cfg.name}`,
      onInteract: ({ inventory }) => {
        if (crate.userData.looted) return { message: `${cfg.name} já foi vasculhado.` };
        crate.userData.looted = true;
        crate.material = new THREE.MeshStandardMaterial({color:0x4a4035,roughness:0.95});
        const loot = cfg.loot || { id:'scrap_metal', name:'Sucata metálica', description:'Peças de metal úteis para reparos e crafting.', type:'material', icon:'⚙️' };
        inventory.addItem(loot, cfg.lootQty || 1);
        return { message: `Você encontrou ${loot.name} x${cfg.lootQty||1} em ${cfg.name}.` };
      }
    });
  }

  _build(){
    const asphalt=this._mat(this.tex.asphalt(2,8),{roughness:0.96});
    const asphalt2=this._mat(this.tex.asphalt(8,2),{roughness:0.96});
    const sidewalk=this._mat(this.tex.sidewalk(4,4),{roughness:0.98});
    this._buildNorth(asphalt,asphalt2,sidewalk);
    this._buildSouth(asphalt,asphalt2,sidewalk);
    this._buildEast(asphalt,asphalt2,sidewalk);
    this._buildWest(asphalt,asphalt2,sidewalk);
  }

  _buildNorth(asphalt,asphalt2,sidewalk){
    const r=this._addRegion({id:'north',name:'North Medical District',cx:0,cz:-80,radius:55});
    // road extension north
    this._road(r,18,60,0,0.01,0,asphalt);
    this._road(r,60,14,0,0.011,-20,asphalt2);
    // sidewalks
    for(const [x,z,w,d] of [[-24,-28,28,20], [10,-28,28,20], [-24,-10,28,38], [10,-10,28,38]]){ const m=makeBox(w,0.18,d,sidewalk); m.position.set(x+w/2,0.09,z+d/2); m.receiveShadow=true; r.group.add(m); }
    // buildings
    const fb=this.tex.facade(1,2,{base:'#7a7d82',windowColor:'#2a3440',litChance:0.06,cols:5,rows:8,accent:'#666a70',damage:0.18}); const fs=this.tex.facade(1,1,{base:'#6f7378',windowColor:'#28333d',litChance:0.04,cols:4,rows:6,accent:'#5f646a',damage:0.12});
    this._building(r,{x:-17,z:-18,w:12,d:10,h:14,tex:fb,sideTex:fs,sign:'FARMÁCIA'});
    this._building(r,{x:17,z:-18,w:12,d:10,h:18,tex:fb,sideTex:fs,roof:0x555b63,sign:'CLÍNICA'});
    this._building(r,{x:-17,z:10,w:11,d:12,h:12,tex:fb,sideTex:fs});
    this._building(r,{x:17,z:10,w:11,d:12,h:15,tex:fb,sideTex:fs,sign:'ABRIGO'});
    this._poi(r,{id:'poi_pharmacy',name:'Farmácia Abandonada',type:'farmacia',pos:new THREE.Vector3(-17,0.18,-98),radius:12,icon:'💊',loot:{id:'bandage',name:'Bandagem',description:'Bandagem limpa para primeiros socorros. Recupera vida.',type:'material',icon:'🩹',consumable:true,effects:{hp:18}},lootQty:2});
    this._poi(r,{id:'poi_shelter_n',name:'Abrigo Norte',type:'abrigo',pos:new THREE.Vector3(17,0.18,-70),radius:12,icon:'🏠',loot:{id:'canned_food',name:'Comida enlatada',description:'Lata de feijão preservada. Recupera fome e um pouco de energia.',type:'comida',icon:'🥫',consumable:true,effects:{hunger:28,energy:6}},lootQty:2});
  }

  _buildSouth(asphalt,asphalt2,sidewalk){
    const r=this._addRegion({id:'south',name:'South Transit District',cx:0,cz:80,radius:55});
    this._road(r,18,60,0,0.01,0,asphalt);
    this._road(r,60,14,0,0.011,20,asphalt2);
    for(const [x,z,w,d] of [[-24,-28,28,38], [10,-28,28,38], [-24,10,28,20], [10,10,28,20]]){ const m=makeBox(w,0.18,d,sidewalk); m.position.set(x+w/2,0.09,z+d/2); m.receiveShadow=true; r.group.add(m); }
    const fb=this.tex.facade(1,2,{base:'#7a7d82',windowColor:'#2a3440',litChance:0.06,cols:5,rows:8,accent:'#666a70',damage:0.18}); const fs=this.tex.facade(1,1,{base:'#6f7378',windowColor:'#28333d',litChance:0.04,cols:4,rows:6,accent:'#5f646a',damage:0.12});
    this._building(r,{x:-17,z:-10,w:12,d:12,h:13,tex:fb,sideTex:fs,sign:'MERCADO'});
    this._building(r,{x:17,z:-10,w:12,d:12,h:16,tex:fb,sideTex:fs});
    this._building(r,{x:-17,z:18,w:11,d:10,h:11,tex:fb,sideTex:fs,sign:'METRÔ'});
    this._building(r,{x:17,z:18,w:11,d:10,h:14,tex:fb,sideTex:fs,sign:'LOJA'});
    this._poi(r,{id:'poi_metro',name:'Estação de Metrô',type:'metro',pos:new THREE.Vector3(-17,0.18,98),radius:12,icon:'🚇',loot:{id:'battery',name:'Bateria',description:'Bateria portátil com carga residual.',type:'peça',icon:'🔋'},lootQty:1});
    this._poi(r,{id:'poi_market',name:'Mercado Abandonado',type:'loja',pos:new THREE.Vector3(-17,0.18,70),radius:12,icon:'🛒',loot:{id:'water_bottle',name:'Água potável',description:'Garrafa de água filtrada. Recupera sede.',type:'água',icon:'💧',consumable:true,effects:{thirst:32}},lootQty:2});
  }

  _buildEast(asphalt,asphalt2,sidewalk){
    const r=this._addRegion({id:'east',name:'East Residential Block',cx:80,cz:0,radius:55});
    this._road(r,60,14,0,0.011,0,asphalt2);
    this._road(r,14,60,20,0.01,0,asphalt);
    for(const [x,z,w,d] of [[-28,-28,38,28], [10,-28,20,28], [-28,10,38,20], [10,10,20,20]]){ const m=makeBox(w,0.18,d,sidewalk); m.position.set(x+w/2,0.09,z+d/2); m.receiveShadow=true; r.group.add(m); }
    const fb=this.tex.facade(1,2,{base:'#7a7d82',windowColor:'#2a3440',litChance:0.06,cols:5,rows:8,accent:'#666a70',damage:0.18}); const fs=this.tex.facade(1,1,{base:'#6f7378',windowColor:'#28333d',litChance:0.04,cols:4,rows:6,accent:'#5f646a',damage:0.12});
    this._building(r,{x:-10,z:-17,w:14,d:11,h:15,tex:fb,sideTex:fs,sign:'RESID.'});
    this._building(r,{x:-10,z:18,w:14,d:10,h:12,tex:fb,sideTex:fs});
    this._building(r,{x:18,z:-17,w:10,d:11,h:11,tex:fb,sideTex:fs,sign:'CAFÉ'});
    this._building(r,{x:18,z:18,w:10,d:10,h:13,tex:fb,sideTex:fs});
    this._poi(r,{id:'poi_cafe',name:'Café Esquecido',type:'restaurante',pos:new THREE.Vector3(98,0,-17),radius:12,icon:'☕',loot:{id:'canned_food',name:'Comida enlatada',description:'Lata de feijão preservada. Recupera fome e um pouco de energia.',type:'comida',icon:'🥫',consumable:true,effects:{hunger:28,energy:6}},lootQty:1});
    this._poi(r,{id:'poi_residential',name:'Bloco Residencial',type:'residencial',pos:new THREE.Vector3(70,0,-17),radius:12,icon:'🏢',loot:{id:'wood_plank',name:'Tábua de madeira',description:'Madeira reaproveitável para barricadas e reparos.',type:'material',icon:'🪵'},lootQty:2});
  }

  _buildWest(asphalt,asphalt2,sidewalk){
    const r=this._addRegion({id:'west',name:'West Security District',cx:-80,cz:0,radius:55});
    this._road(r,60,14,0,0.011,0,asphalt2);
    this._road(r,14,60,-20,0.01,0,asphalt);
    for(const [x,z,w,d] of [[-28,-28,20,28], [10,-28,20,28], [-28,10,20,20], [10,10,20,20]]){ const m=makeBox(w,0.18,d,sidewalk); m.position.set(x+w/2,0.09,z+d/2); m.receiveShadow=true; r.group.add(m); }
    // fill gaps simply
    const fill=makeBox(20,0.18,28,sidewalk); fill.position.set(-18,0.09,-14); fill.receiveShadow=true; r.group.add(fill);
    const fill2=makeBox(20,0.18,20,sidewalk); fill2.position.set(-18,0.09,20); fill2.receiveShadow=true; r.group.add(fill2);
    const fb=this.tex.facade(1,2,{base:'#7a7d82',windowColor:'#2a3440',litChance:0.06,cols:5,rows:8,accent:'#666a70',damage:0.18}); const fs=this.tex.facade(1,1,{base:'#6f7378',windowColor:'#28333d',litChance:0.04,cols:4,rows:6,accent:'#5f646a',damage:0.12});
    this._building(r,{x:18,z:-17,w:12,d:11,h:14,tex:fb,sideTex:fs,sign:'DELEGACIA'});
    this._building(r,{x:18,z:18,w:12,d:10,h:12,tex:fb,sideTex:fs});
    this._building(r,{x:-10,z:-17,w:10,d:11,h:16,tex:fb,sideTex:fs,sign:'GARAGEM'});
    this._building(r,{x:-10,z:18,w:10,d:10,h:11,tex:fb,sideTex:fs});
    this._poi(r,{id:'poi_police',name:'Delegacia Abandonada',type:'delegacia',pos:new THREE.Vector3(-62,0,-17),radius:12,icon:'🚔',loot:{id:'electronic_parts',name:'Peças eletrônicas',description:'Circuitos e componentes para consertar equipamentos.',type:'peça',icon:'🔌'},lootQty:1});
    this._poi(r,{id:'poi_garage',name:'Estacionamento Coberto',type:'estacionamento',pos:new THREE.Vector3(-90,0,-17),radius:12,icon:'🅿️',loot:{id:'energy_bar',name:'Barra energética',description:'Barra calórica de emergência. Recupera fome e energia.',type:'comida',icon:'🍫',consumable:true,effects:{hunger:15,energy:14}},lootQty:2});
  }

  getPOIs(){ return this.pois; }
  getRegions(){ return this.regions; }

  update(playerPos) {
    if (!playerPos) return;
    // Simple distance-based streaming: hide/show region groups and toggle colliders
    for (const r of this.regions) {
      const dx = playerPos.x - r.center.x;
      const dz = playerPos.z - r.center.z;
      const dist = Math.hypot(dx,dz);
      const shouldLoad = dist < 140;
      if (shouldLoad !== r.loaded) {
        r.loaded = shouldLoad;
        r.group.visible = shouldLoad;
        for (const c of r.colliders) this.collisions.setBoxEnabled(c, shouldLoad);
      }
    }
  }
}
