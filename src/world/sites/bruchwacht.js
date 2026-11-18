import { block, blockOn, beam } from '../../art/blocks.js';
import * as THREE from 'three';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { VAULT_PLAN, BAY, bayAt, openBay, dial } from '../../data/hemland/bruchwacht.js';
import { arch, curtain, frame, painting, pennon, ruinTower, standing } from '../bruchwachtArt.js';
import { makeLantern } from '../buildings.js';
import * as F from '../furniture.js';

const HALF = BAY / 2, PI = Math.PI;

function court(ctx) {
  const { root, heightAt }=ctx, y=heightAt(-330,150);
  const wall=(ax,az,bx,bz,heights)=>curtain(root,ax,az,bx,bz,heights,y);
  wall(-312,133,-312,146,[5,4.7,5.2,5.8]);
  wall(-312,154,-312,168,[6.2,4.6,3.4,3.1,2.8]);
  wall(-312,133,-348,130,[5.6,4.8,3.3,2.1,1.8,2.2,3.8,4.6,5.3]);
  wall(-312,168,-348,170,[3.1,3.6,2.5,.8,.55,1.1,3.1,4.7,4.1]);
  // Rubble ends the curtain against the old toll house. Its cart door faces the fire.
  wall(-348,130,-348,146.6,[3.6,2.3,1.3,1.3,2.4,3.6]);
  wall(-348,153.4,-348,170,[3.6,3.4,2.2,1.7,2.1,4]);
  ruinTower(root,-312,y,142.7,11.7,[0,.5,1.4,2.3,2.4,1.5,0,0]);
  ruinTower(root,-311.8,y,157.5,8.2,[1,2.9,3.4,3.7,2.2,.6,0,0]);
  ruinTower(root,-343,y,132.2,13.6,[0,0,1.4,2.7,4.8,4.4,3,1.1]);
  arch(root,-311.8,y,150,PI/2,6.3,3.65);
  // A roofed hoarding spans the two towers. The defenders have replaced its
  // missing eastern bays with ship timber, shutters and patched toll cloth.
  const gallery=frame(root,-311.8,y,150,PI/2);
  blockOn(gallery,10.6,.48,2.45,'darkPlanks',0,6.92,0,0,standing);
  for(const x of [-4.5,-2.3,0,2.3,4.5]){
    blockOn(gallery,.19,2.05,.19,'timber',x,7.37,.99);
    blockOn(gallery,.19,2.05,.19,'timber',x,7.37,-.99);
    beam(gallery,[x,6.95,1.08],[x,6.15,.05],.22,'timber');
  }
  for(const x of [-3.45,-1.15,1.15,3.45]){
    blockOn(gallery,2.15,.75,.15,'planksWeathered',x,7.38,1.02);
    blockOn(gallery,2.15,.75,.15,'darkPlanks',x,7.38,-1.02);
    beam(gallery,[x-.96,8.16,1.01],[x+.96,9.12,1.01],.12,'timber');
  }
  block(gallery,7.8,.17,1.94,'woodShingle',-.9,9.37,.78,.28);
  block(gallery,9.95,.17,1.94,'slate',0,9.37,-.78,-.28);
  for(const x of [-4.1,3.75]) painting(gallery,'brueckenbanner',1.62,3.24,x,6.43,1.19);
  // Warm plank floors cut off the old arrow slits; each storey reads from the road.
  for(const [x,z,h] of [[-312,142.7,8.1],[-311.8,157.5,5.1],[-343,132.2,8.7]]) {
    blockOn(root,6.4,.38,6.4,'darkPlanks',x,y+h,z);
  }
  pennon(root,-309.9,y,145.65,PI/2,1.26);
  pennon(root,-309.9,y,154.3,PI/2,.97);
  makeLantern(root,heightAt,-315.3,147.2);
  // The wall is a windbreak for drying laundry, patching leather and cooking.
  const yard=frame(root,-333,y,163);
  for(const x of [-4,4]) blockOn(yard,.18,3,.18,'timber',x,0,0,0,standing);
  for(const side of [-1,1]) beam(yard,[0,2.4,0],[side*4,2.85,0],.055,'bark');
  for(let i=0;i<6;i++){
    const x=-3.2+i*1.22,h=[.89,1.2,.7,.65,1,.82][i];
    block(yard,.63+(i%2)*.22,h,.05,['clothLinen','clothRed','clothBlue'][i%3],x,2.42+Math.abs(x)*.1-h*.5,0,.065,i*.08);
  }
  F.workbench(yard,3.5,0,-1.6,-.4); F.bucket(yard,-2.3,0,.4);
  F.loom(yard,-3.2,0,1.35); F.firewoodStack(yard,1.3,0,1);
  const cook=frame(root,-321,y,136,.14);
  F.cauldron(cook,0,0,0); F.grainSack(cook,1,0,.6); F.table(cook,-2.3,0,0);
  F.bread(cook,-2.65,1.1,0); F.bowl(cook,-1.96,1.1,.17);
  F.weaponRack(root,-321,y,162,.25); F.armourStand(root,-318,y,162.7,-.22);
  ctx.marker({id:'bruchwacht',kind:'tower',label:'Bruchwacht · Westlager',x:-320,z:150,discover:true,radius:23,xp:25});
}

export function buildBruchwacht(ctx) {
  court(ctx);
  const {root}=ctx, base=ctx.heightAt(-374,150), views=[], lifts=[];
  const northStone=pixelMaterial('granite',{tint:0xa6b5b6});
  const vaultStone=pixelMaterial('bricks',{tint:0x908577});
  const underRoof=pixelMaterial('bricks',{tint:0x776e68});
  const floorRise=row=>row<6?.12:row===6?.67:1.22;
  const place=(col,row,dx=0,dz=0)=>{const p=bayAt(col,row);return {x:p.x+dx,z:p.z+dz,y:base+floorRise(row)};};
  function furnish(type,col,row,dx,dz,yaw=0,options={},lift=0) {
    const p=place(col,row,dx,dz);
    return F[type](root,p.x,p.y+lift,p.z,yaw,options);
  }
  function spot(id,label,col,row,dx=0,dz=0) {ctx.action({id,label,...place(col,row,dx,dz)});}
  function slab(x,z,w,d,top,mat,indoor=true) {
    blockOn(root,w,.23,d,mat,x,top-.23,z);
    ctx.registerFloor({x,z,halfWidth:w/2,halfDepth:d/2,y:top,indoor});
  }

  // The excavated northern records hall is cool stone. The south magazine, built later
  // over the damp floor, sits six steps higher and has a timber ceiling and sleeping loft.
  for(const [r,line] of VAULT_PLAN.entries()) for(let c=0;c<line.length;c++){
    if(!openBay(c,r)) continue;
    const {x,y,z}=place(c,r), ceiling=base+(r>=6?5.85:r<=2?5.6:5.15);
    if(r===6){
      for(let n=0;n<6;n++) slab(x,z-HALF+(n+.5)*BAY/6,BAY,BAY/6,base+.12+(n+1)*1.1/6,'planksWeathered');
    } else slab(x,z,BAY,BAY,y,r>6?'planksWeathered':r<=2?'flagstone':'cobbleMossy');
    if(c===2 && r===3){
      // A shell hit the north edge of the common room. Rafters still carry one strip
      // of slate; a narrow gap admits daylight and makes the junction legible.
      blockOn(root,BAY, .62,2.9,underRoof,x,ceiling,z+.95,0,standing);
      for(const dx of [-1.45,.25,1.76]) blockOn(root,.18,.32,BAY,'timber',x+dx,ceiling+.1,z);
    } else blockOn(root,BAY+.01,.62,BAY+.01,r>=6?'darkPlanks':underRoof,x,ceiling,z,0,standing);
    if((c+r)%2===0) blockOn(root,.23,.3,BAY,r>=6?'timber':'ashlar',x,ceiling-.28,z);
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(openBay(c+dc,r+dr) || c===0&&r===4&&dc===-1 || c===6&&r===8&&dr===1) continue;
      const side=dc!==0, wx=x-dc*HALF,wz=z+dr*HALF, h=ceiling-base+.14;
      blockOn(root,side?.52:BAY+.04,h,side?BAY+.04:.52,r<=2?northStone:vaultStone,wx,base-.1,wz,0,standing);
      blockOn(root,side?.68:BAY,.22,side?BAY:.68,'ashlarMossy',wx,y+.26,wz);
      // Old springers protrude beneath the vaults; their stone rhythm survives the repairs.
      blockOn(root,side?.86:.62,.47,side?.62:.86,'ashlar',wx,ceiling-.64,wz);
      if((c+2*r)%4===0) blockOn(root,side?.82:.52,1.03,side?.52:.82,'fieldstone',wx,ceiling+.46,wz);
    }
  }
  const entry=place(0,4,HALF,0);
  arch(root,entry.x,base,entry.z,PI/2,3.5,2.65);
  // The entrance fascia is tall enough to read from across the ward.
  blockOn(root,1.2,1.1,5.65,'ashlarMossy',entry.x,base+4.63,entry.z,0,standing);
  pennon(root,entry.x+.7,base,entry.z-2.6,PI/2,.82);
  for(const c of [1,3,6]) {
    const p=place(c,4);
    arch(root,p.x,base,p.z,PI/2,3.5,2.52);
  }
  // Faded fresco over the clerk's lectern. An abbreviated tariff hangs in the mess.
  const mural=place(5,0,0,-HALF+.29);
  painting(root,'zollfresko',10,4,mural.x,base+2.85,mural.z);
  // Shallow elliptical vault ribs cross the records room at its full width.
  for(const r of [0,1,2]){
    const p=place(5,r), rib=frame(root,p.x,base,p.z+.65);
    const point=i=>[6.88*Math.cos(i*PI/12),3.5+1.98*Math.sin(i*PI/12),0];
    for(let i=0;i<12;i++) beam(rib,point(i),point(i+1),.32,i===5||i===6?'sandstone':'ashlarMossy');
  }
  furnish('table',5,0,.4,-.9); furnish('book',5,0,.35,-.91,-.17,{},1.1);
  furnish('candle',5,0,-.22,-.84,0,{},1.1);
  furnish('stool',5,0,1.1,-.1,-.27);
  furnish('barrel',4,1,1.6,.9); furnish('grainSack',4,1,1.2,.1);
  spot('tally','Den alten Zolltarif lesen',5,0,.4,-.55);
  const board=place(1,3,0,-HALF+.29);
  painting(root,'zollfresko',3.5,1.4,board.x,base+2.2,board.z);
  spot('tally','Den Zolltarif entziffern',1,3,0,-1.3);

  // Mess, dead-end wine store, record stacks and sleeping quarters each have their own silhouette.
  furnish('fireplace',3,3,-1.15,-1.65,0,{pot:true,light:true});
  furnish('hangingHerbs',3,3,-.05,-1.95,0,{mountHeight:2.9});
  furnish('table',2,5,.1,.5,.03,{variant:'long'});
  furnish('bench',2,5,0,-.55); furnish('bowl',2,5,.65,.53,0,{},1.1);
  furnish('bread',2,5,-.8,.5,.1,{},1.1); furnish('cup',2,5,.05,.5,0,{},1.1);
  furnish('kegRack',0,1,0,-1.35); furnish('barrel',0,1,1.3,.9);
  spot('cask','Die Ritzschrift im Fass lesen',0,1,1,.45);
  furnish('bookshelf',4,0,1.6,.1,-PI/2); furnish('shelf',6,1,-1.7,.1,PI/2);
  furnish('crate',6,2,-1.3,.9); furnish('grainSack',6,2,-1.5,-.1);
  for(const c of [1,2,3]) furnish('bunk',c,8,.55,.45,0,{cloth:c===2?'clothRed':'clothLinen'});
  furnish('table',1,7,1.3,-1.3,PI/2); furnish('book',1,7,1.28,-1.3,0,{},1.1);
  spot('bunks','Das Wachbuch aufschlagen',1,7,.9,-1.18);
  furnish('chest',3,8,-1.45,1.3,-.08);
  spot('stores','Den versiegelten Köcher öffnen',3,8,-1.35,.85);
  furnish('workbench',7,7,-1.55,.6,PI/2); furnish('weaponRack',7,6,-1.45,-1.2,PI/2);
  furnish('firewoodStack',7,8,-.9,1.4); furnish('bucket',6,7,.7,1.4);
  for(const [c,r,dx,dz,ry] of [[0,4,0,-2,0],[3,4,-1.75,1.8,PI],[2,1,0,-2,0],[6,0,-1.15,-1.95,0],
    [0,1,1.9,0,-PI/2],[3,7,0,-1.92,0],[6,5,-1.9,0,PI/2],[7,7,-1.9,-.8,PI/2],[8,4,0,-1.9,0],[10,4,-1.9,0,PI/2]]) {
    const torch=furnish('wallTorch',c,r,dx,dz,ry,{light:true});
    torch.traverse(o=>{if(o.isPointLight) {o.intensity=14;o.distance=10;}});
  }
  // The cargo scale has been converted into the common room's hanging lamp.
  for(const [c,r] of [[2,4],[5,1],[6,7]]){
    const p=place(c,r), g=frame(root,p.x,base,p.z);
    blockOn(g,.085,1.38,.085,'iron',0,4.05,0);
    for(const side of [-1,1]) beam(g,[side*.47,3.7,0],[0,4.22,0],.055,'iron');
    blockOn(g,1.05,.14,.46,'brass',0,3.62,0);
    for(const side of [-1,0,1]) F.candle(g,side*.35,3.76,0,0,{light:false});
    const lamp=new THREE.PointLight(0xffbb75,24,13,2);
    lamp.position.set(0,4.04,0);g.add(lamp);
  }
  const drum=(id,title,col,row,dx,dz,yaw)=>{
    const p=place(col,row,dx,dz), g=frame(root,p.x,p.y,p.z,yaw);
    blockOn(g,1.75,1.55,.56,'planksVertical',0,0,0,0,standing);
    blockOn(g,1.86,.13,.7,'brass',0,1.49,0);
    const wheel=frame(g,0,1.26,.39);
    wheel.userData.siteMoving=true;
    for(let i=0;i<6;i++){
      const a=i*PI/3;
      block(wheel,.64,.12,.16,'iron',Math.sin(a)*.55,Math.cos(a)*.55,0,0,0,-a);
      beam(wheel,[0,0,0],[Math.sin(a)*.54,Math.cos(a)*.54,0],.075,'brass');
    }
    block(wheel,.17,.17,.31,'brass',0,.55,.12);
    views.push(flags=>{wheel.rotation.z=(dial(flags,id)-1)*2*PI/3;});
    spot(id,title,col,row,dx+Math.sin(yaw)*.8,dz+Math.cos(yaw)*.8);
  };
  drum('grain','Kornrad drehen',4,2,0,1.4,PI);
  drum('iron','Eisenrad drehen',7,8,-1.6,.25,PI/2);

  function grate(id,col,row,dx,dz,yaw) {
    const p=place(col,row,dx,dz), gate=frame(root,p.x,p.y,p.z,yaw);
    gate.userData.siteMoving=true;
    for(let i=-4;i<=4;i++) blockOn(gate,.12,3.85,.14,'iron',i*.5,0,0);
    for(const h of [.52,2.65,3.66]) blockOn(gate,BAY,.18,.22,'iron',0,h,0);
    const collider={kind:'bruchGate',surface:'stone',x:p.x,z:p.z,bottom:p.y,top:p.y+4.1,halfWidth:HALF,halfDepth:.15,rotation:yaw};
    ctx.addCollider(collider);
    // In the raised position the portcullis disappears into a masonry pocket.
    blockOn(root,yaw===0?BAY+.25:.9,1.1,yaw===0?.9:BAY+.25,'ashlar',p.x,p.y+3.86,p.z,0,standing);
    let target=0, lift=0;
    function setLift(value) {
      lift=value; gate.position.y=p.y+lift;
      collider.bottom=p.y+lift; collider.top=collider.bottom+4.1;
      collider.disabled=lift>=4.1; gate.visible=!collider.disabled;
      collider.syncPhysics?.();
    }
    views.push((flags,animate)=>{target=flags['bruch_'+id]?4.1:0; if(!animate) setLift(target);});
    lifts.push(dt=>{if(lift!==target) setLift(lift<target?Math.min(target,lift+dt*3.6):Math.max(target,lift-dt*3.6));});
  }
  grate('vault',8,4,-HALF,0,PI/2);
  grate('postern',6,8,0,HALF,0);
  const lever=(id,label,col,row,dx,dz,yaw)=>{
    const p=place(col,row,dx,dz), g=frame(root,p.x,p.y,p.z,yaw);
    blockOn(g,.85,.84,.7,'granite',0,0,0,0,standing);
    const handle=frame(g,0,.84,0); handle.userData.siteMoving=true;
    blockOn(handle,.12,.85,.13,'iron',0,0,0); blockOn(handle,.56,.14,.18,'brass',0,.77,0);
    views.push(flags=>{handle.rotation.x=flags[id==='scale'?'bruch_vault':'bruch_postern']?-.63:.63;});
    spot(id,label,col,row,dx,dz);
  };
  lever('scale','Den Waagbalken ziehen',8,4,.65,-1.37,PI/2);
  lever('postern','Den Riegel der Sackpforte heben',6,8,1.5,-.25,PI/2);
  // The handle is out of arm's reach from the hillside; the stairs land beside the pack trail.
  const door=place(6,8,0,HALF);
  for(let i=0;i<6;i++) slab(door.x,door.z+(i+.5)*.72,4.4,.72,door.y-(i+1)*.19,'ashlarMossy',false);
  furnish('rug',9,4,0,0,PI/2,{cloth:'clothRed',width:2.3,depth:4.2});
  furnish('chest',10,4,-1.35,0,PI/2,{packed:true});
  furnish('candle',10,4,-1.35,.95,0,{light:true});
  furnish('armourStand',9,3,0,-1); furnish('crate',10,5,-1.1,1.1);
  spot('pay','Die Soldkassette öffnen',10,4,-.75,0);
  ctx.marker({id:'zollgewoelbe',kind:'tower',label:'Das alte Zollgewölbe',x:-357,z:150,discover:true,radius:5,xp:18});
  return {
    sync(flags,animate){for(const apply of views) apply(flags,animate);},
    update(dt){for(const move of lifts) move(dt);},
  };
}
