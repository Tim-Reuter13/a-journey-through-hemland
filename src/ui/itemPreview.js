import * as THREE from 'three';
import { block,beam } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';
import { icon,typeIcon } from './inventoryIcons.js';

/** Boxes and world-unit UVs; the caller owns the group, the art cache owns its resources. */
export function createPreviewModel(item,material=(name,tint)=>pixelMaterial(name,{tint})){
  const rig=new THREE.Group();if(!item)return rig;
  const metal=material('iron',item.color??0xffffff),gold=material('brass',0xffffff),leather=material('darkPlanks',0x99775d);
  const cloth=material('clothLinen',item.color??0xffffff),base=material('stoneLight',item.color??0xffffff);
  const box=(w,h,d,mat,x=0,y=0,z=0,rz=0)=>block(rig,w,h,d,mat,x,y,z,0,0,rz,{shadow:false});
  const slot=item.slot||item.type;
  if(slot==='ranged'){
    const wood=material('darkPlanks',0xc08a58),points=[[.24,1.08],[.06,.72],[-.06,.36],[-.09,0],[-.06,-.36],[.06,-.72],[.24,-1.08]];
    for(let i=1;i<points.length;i++)beam(rig,[...points[i-1],0],[...points[i],0],i===3||i===4?.11:.08,wood,{shadow:false});
    beam(rig,[.25,1.06,0],[.25,-1.06,0],.025,material('clothLinen',0xffffff),{shadow:false});
    box(.16,.34,.14,leather,-.09,0);for(const s of [-1,1])box(.09,.1,.09,material('clothLinen',0xd8c8a8),.24,s*1.1);
    rig.rotation.z=-.35;
  }else if(item.type==='ammo'){
    for(const k of [-1,0,1]){const o=k*.16;beam(rig,[-.75+o,-.75-o,0],[.68+o,.68-o,0],.045,material('darkPlanks',0xd0a878),{shadow:false});
      box(.16,.07,.05,metal,.74+o,.74-o,0,Math.PI/4);box(.07,.22,.04,material('clothLinen',0x9a3a2e),-.66+o,-.66-o,0,Math.PI/4);}
  }else if(item.type==='weapon'){
    box(.18,1.2,.075,metal,0,.24);box(.1,.18,.075,metal,0,.93);box(.065,.07,.075,metal,0,1.055);
    box(.56,.1,.15,gold,0,-.4);box(.1,.38,.1,leather,0,-.64);box(.17,.12,.15,gold,0,-.9);
    for(let i=0;i<4;i++)box(.12,.03,.12,gold,0,-.49-i*.08);
    rig.rotation.z=-.25;
  }else if(slot==='head'){
    box(.76,.22,.65,metal,0,.35);box(.88,.12,.75,metal,0,.2);
    for(const s of [-1,1])box(.16,.48,.65,metal,s*.36,-.02);
    box(.58,.45,.14,metal,0,-.02,-.26);box(.1,.43,.13,gold,0,-.04,.36);box(.68,.08,.12,leather,0,.09,.35);
  }else if(slot==='feet'){
    for(const s of [-1,1]){box(.3,.64,.36,leather,s*.24,.14);box(.32,.22,.62,leather,s*.24,-.26,.1);box(.34,.08,.65,metal,s*.24,-.4,.1);box(.34,.1,.4,gold,s*.24,.43);}
  }else if(slot==='hands'){
    for(const s of [-1,1]){box(.3,.58,.32,leather,s*.27,.06);box(.34,.12,.36,metal,s*.27,.34);box(.12,.25,.2,leather,s*.44,-.1,.02);box(.34,.2,.34,metal,s*.27,-.3);}
  }else if(slot==='cloak'){
    for(let i=0;i<4;i++)box(.65+i*.15,.36,.1,cloth,0,.65-i*.34,-.04-i*.035);
    for(const s of [-1,1])box(.3,.2,.38,cloth,s*.32,.73,.06);
    box(.14,.14,.12,gold,0,.72,.28);box(.09,1.25,.035,leather,-.31,-.08,.05);
  }else if(item.type==='armor'){
    const armor=item.armor>3?metal:cloth;
    box(.76,.92,.38,armor,0,.13);box(.88,.32,.45,armor,0,-.4);
    for(const s of [-1,1]){box(.34,.3,.46,armor,s*.5,.44);box(.24,.44,.3,cloth,s*.53,.13);}
    box(.8,.1,.43,leather,0,-.23);box(.15,.15,.05,gold,0,-.23,.25);
    for(const s of [-1,1])box(.055,.75,.04,gold,s*.28,.12,.22);
  }else if(item.type==='accessory'){
    const points=[[-.4,.65,0],[-.5,.3,0],[-.3,-.07,0],[0,-.22,0],[.3,-.07,0],[.5,.3,0],[.4,.65,0]];
    for(let i=1;i<points.length;i++)beam(rig,points[i-1],points[i],.055,gold,{shadow:false});
    box(.09,.2,.1,gold,0,-.26);box(.38,.42,.16,gold,0,-.58);box(.24,.28,.19,material('crystal',item.color),0,-.58,.03);
  }else if(item.type==='consumable'){
    const glass=material('crystal',0xc5e2df),fluid=material('clothLinen',item.color);
    box(.6,.63,.42,glass,0,-.13);box(.72,.38,.42,glass,0,-.17);box(.45,.13,.37,glass,0,.25);
    box(.22,.38,.22,glass,0,.48);box(.27,.14,.27,leather,0,.73);
    box(.53,.37,.06,fluid,0,-.21,.23);box(.25,.2,.07,gold,0,-.17,.27);box(.62,.07,.45,gold,0,-.49);
    box(.06,.32,.03,material('clothLinen',0xffffff),-.21,-.08,.28);
  }else if(item.type==='book'){
    box(.78,1.03,.2,material('clothLinen',0xffffff));box(.88,1.12,.06,cloth,0,0,.14);box(.88,1.12,.06,cloth,0,0,-.14);
    box(.1,1.12,.34,leather,-.4);box(.06,.94,.03,gold,-.27,0,.19);box(.06,.94,.03,gold,.27,0,.19);box(.24,.24,.04,gold,0,.06,.2);
  }else if(item.type==='food'){
    if(item.id==='waldapfel'){box(.65,.51,.55,base);box(.49,.64,.48,base);box(.08,.23,.07,leather,0,.4);box(.22,.06,.14,material('clothLinen',0x5f7945),.13,.43);}
    else{box(.94,.19,.65,base);box(.7,.28,.55,base);for(let i=-1;i<=1;i++)box(.065,.035,.42,leather,i*.21,.155);}
  }else if(item.id==='kraeuter'||item.resource==='herbs'){
    const leaf=material('clothLinen',0x67894e);
    for(let i=0;i<5;i++){const x=(i-2)*.12;box(.04,.95,.04,leather,x,0,0,(i-2)*.07);for(let j=0;j<3;j++)box(.25,.09,.15,leaf,x+(j%2?.09:-.09),-.06+j*.2,0,j%2?.3:-.3);}
    box(.65,.07,.17,gold,0,-.28);
  }else if(item.id==='holz'||item.resource==='wood'){
    for(let i=0;i<3;i++){box(.22,1.1,.22,material('bark',0xffffff),(i-1)*.21,0,i%2*.16,.18);box(.22,.035,.22,material('logTop',0xffffff),(i-1)*.21,.57,i%2*.16,.18);}
    box(.76,.075,.46,leather,0,-.16,.06);
  }else if(item.id==='leder'||item.resource==='leather'){
    for(let i=0;i<3;i++)box(.77-i*.04,.09,.62,leather,(i-1)*.06,(i-1)*.12,(i-1)*.07);
    box(.13,.41,.65,gold,0,0,.02);
  }else{
    box(.65,.7,.6,base);box(.86,.38,.47,base,-.03,-.09,.05);box(.42,.91,.39,base,.06,.02);
    const vein=item.type==='quest'?material('ember',0xffffff):metal;
    for(let i=0;i<3;i++)box(.13,.15,.06,vein,-.2+i*.18,-.15+i*.15,.32);
  }
  return rig;
}

export function createItemPreview(container){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false});}
  catch{return {show(item){container.innerHTML=item?icon(typeIcon(item.slot||item.type)):'';container.setAttribute('aria-label','Gegenstandsvorschau ohne WebGL');},update(){},dispose(){container.replaceChildren();}};}
  renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  renderer.domElement.setAttribute('aria-label','Drehbare Pixelvorschau des Gegenstands');container.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.01,20);camera.position.set(0,.15,3.8);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd9e4ec,0x35312b,2));
  const light=new THREE.DirectionalLight(0xffe5b2,2.2);light.position.set(-2,3,4);scene.add(light);
  const rig=new THREE.Group();scene.add(rig);
  const materials=new Map(),textures=new Map();
  // Own clones use nearest at every scale; shared art resources are never disposed or changed.
  function material(name,tint=0xffffff){
    const key=name+':'+tint;if(materials.has(key))return materials.get(key);
    const shared=pixelMaterial(name,{tint}),copy=shared.clone();
    if(!textures.has(name)){const map=shared.map.clone();map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;textures.set(name,map);}
    copy.map=textures.get(name);materials.set(key,copy);return copy;
  }
  let current=null,last=null,dragging=false,previousX=0,disposed=false;
  function show(item){
    if(disposed||item?.id===current)return;current=item?.id??null;rig.clear();rig.rotation.set(0,-.4,0);
    if(item)rig.add(createPreviewModel(item,material));else renderer.clear();
  }
  function down(event){dragging=true;previousX=event.clientX;container.setPointerCapture(event.pointerId);}
  function move(event){if(dragging){rig.rotation.y+=(event.clientX-previousX)*.016;previousX=event.clientX;}}
  function up(){dragging=false;}
  container.addEventListener('pointerdown',down);container.addEventListener('pointermove',move);container.addEventListener('pointerup',up);container.addEventListener('pointercancel',up);container.addEventListener('lostpointercapture',up);
  function update(time){
    if(disposed)return;const dt=last===null?0:Math.max(0,Math.min(.1,(time-last)/1000));last=time;if(!current)return;
    const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;
    const w=Math.max(1,Math.floor(width/2)),h=Math.max(1,Math.floor(height/2));
    if(renderer.domElement.width!==w||renderer.domElement.height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=Math.max(3.8,2.4/camera.aspect);camera.updateProjectionMatrix();}
    if(!dragging&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)rig.rotation.y+=dt*.17;
    renderer.render(scene,camera);
  }
  function dispose(){
    if(disposed)return;disposed=true;rig.clear();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();
    container.removeEventListener('pointerdown',down);container.removeEventListener('pointermove',move);container.removeEventListener('pointerup',up);container.removeEventListener('pointercancel',up);container.removeEventListener('lostpointercapture',up);
  }
  return {show,update,dispose};
}
