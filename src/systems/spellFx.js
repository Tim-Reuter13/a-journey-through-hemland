import * as THREE from 'three';
import { block, boxGeometry } from '../art/blocks.js';
import { pixelMaterial, pixelTexture, registerPixelTexture, TEXTURE_NAMES } from '../art/pixelTextures.js';

export const SPELL_PARTICLES=112,SCORCH_CAP=40;
const TEXEL=1/16,UP=new THREE.Vector3(0,1,0);
if(!TEXTURE_NAMES().includes('scorch'))registerPixelTexture('scorch',p=>{
  p.clear();
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const noise=(x*17+y*31+x*y*7)%23,dx=x-7.5,dy=y-7.5;
    if(dx*dx+dy*dy<39+noise*.8&&!(noise<3&&dx*dx+dy*dy>26))
      p.set(x,y,['#161719','#202023','#29272a','#343032'][noise%4]);
  }
},{cutout:true});

/** Stable marks persist until capacity pressure; the oldest four retire over fade seconds. */
export function createDecalLedger(cap=SCORCH_CAP,fade=.8){
  const items=[];
  return {items,add(value){
    const evicted=items.length>=cap?items.shift():null;
    if(items.length>=Math.max(1,cap-Math.min(4,Math.ceil(cap*.1)))){
      const oldest=items.find(e=>e.fade===null);if(oldest)oldest.fade=fade;
    }
    const entry={value,fade:null,opacity:1};items.push(entry);return evicted?.value??null;
  },update(dt){
    for(let i=items.length-1;i>=0;i--){const e=items[i];if(e.fade===null)continue;
      e.fade=Math.max(0,e.fade-Math.max(0,dt));e.opacity=e.fade/fade;
      if(e.fade<=0)items.splice(i,1);
    }
  },reset(){items.length=0;}};
}

/** Writes a one-unit (16 pixel) decal into a reusable four-corner buffer. */
export function decalCorners(point,normal,heightAt,angle=0,out=new Float32Array(12)){
  const ground=normal.y>.55,horizontal=Math.abs(normal.y)>.999,c=Math.cos(angle),s=Math.sin(angle);
  const length=Math.hypot(normal.x,normal.z)||1;
  const ux=ground||horizontal?1:normal.z/length,uz=ground||horizontal?0:-normal.x/length;
  const vx=ground||horizontal?0:normal.y*normal.x/length,vy=ground||horizontal?0:-length,vz=ground||horizontal?1:normal.y*normal.z/length;
  for(let i=0;i<4;i++){
    const a=(i===1||i===2)?.5:-.5,b=i>=2?.5:-.5,u=a*c-b*s,v=a*s+b*c;
    const x=point.x+ux*u+vx*v,z=point.z+uz*u+vz*v;
    out[i*3]=x+normal.x*.018;out[i*3+1]=ground?heightAt(x,z)+.018:point.y+vy*v+normal.y*.018;
    out[i*3+2]=z+normal.z*.018;
  }
  return out;
}

export function createBurnState(damage=12,duration=2,interval=.5){
  return {elapsed:0,ticks:0,damage,duration,interval,done:false};
}
export function advanceBurn(burn,dt){
  if(burn.done)return 0;
  burn.elapsed=Math.min(burn.duration,burn.elapsed+Math.max(0,dt));
  const count=Math.floor((burn.elapsed+1e-9)/burn.interval),total=Math.ceil(burn.duration/burn.interval);
  const ticks=burn.elapsed>=burn.duration?total:Math.min(total,count),damage=(ticks-burn.ticks)*burn.damage/total;
  burn.ticks=ticks;burn.done=burn.elapsed>=burn.duration;return damage;
}

/** First world contact, without overshooting thin walls or a rising floor. Reuses out. */
export function traceSpellSurface(world,a,b,out={point:new THREE.Vector3(),normal:new THREE.Vector3()}){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.1));
  const point=out.point;let lo=0,hi=0,ground=false,found=false;
  for(let i=1;i<=steps;i++){
    hi=i/steps;point.set(a.x+dx*hi,a.y+dy*hi,a.z+dz*hi);
    ground=point.y<=world.heightAt(point.x,point.z)+.02;
    if(ground||world.segmentBlocked(a,point,0)){found=true;break;}lo=hi;
  }
  if(!found)return null;
  for(let i=0;i<10;i++){
    const mid=(lo+hi)*.5;point.set(a.x+dx*mid,a.y+dy*mid,a.z+dz*mid);
    if(point.y<=world.heightAt(point.x,point.z)+.02||world.segmentBlocked(a,point,0))hi=mid;else lo=mid;
  }
  point.set(a.x+dx*hi,a.y+dy*hi,a.z+dz*hi);out.t=hi;
  ground=point.y<=world.heightAt(point.x,point.z)+.025;out.ground=ground;
  if(ground){
    out.normal.set(world.heightAt(point.x-.0625,point.z)-world.heightAt(point.x+.0625,point.z),.125,
      world.heightAt(point.x,point.z-.0625)-world.heightAt(point.x,point.z+.0625)).normalize();
    point.y=world.heightAt(point.x,point.z);
  }else{
    // Probe the last free position one axis at a time to identify the crossed face.
    const x=point.x,y=point.y,z=point.z;
    out.normal.set(0,0,0);
    point.set(x,a.y+dy*lo,a.z+dz*lo);
    if(world.segmentBlocked(a,point,0))out.normal.x=-Math.sign(dx);
    point.set(a.x+dx*lo,y,a.z+dz*lo);
    if(world.segmentBlocked(a,point,0))out.normal.y=-Math.sign(dy);
    point.set(a.x+dx*lo,a.y+dy*lo,z);
    if(world.segmentBlocked(a,point,0))out.normal.z=-Math.sign(dz);
    if(out.normal.lengthSq()===0){
      if(Math.abs(dx)>Math.abs(dz)&&Math.abs(dx)>Math.abs(dy))out.normal.x=-Math.sign(dx);
      else if(Math.abs(dy)>Math.abs(dz))out.normal.y=-Math.sign(dy);else out.normal.z=-Math.sign(dz)||1;
    }
    out.normal.normalize();point.set(x,y,z);
  }
  return out;
}

/** Owns pooled spell visuals. onBurnDamage(enemy, amount) applies timed damage;
 * onImpact(point, direction, radius) receives borrowed world vectors synchronously.
 * Combat drives update/setCharge/updateBall and reset; no extra main-loop wiring. */
export function createSpellFx(scene,world,{onImpact,onBurnDamage,sound=()=>{}}={}){
  const group=new THREE.Group();group.name='Funken effects';scene.add(group);
  const ember=pixelMaterial('ember',{emissive:1}),shellMaterial=pixelMaterial('ember',{tint:0xff713b,emissive:1});
  const emberMap=pixelTexture('ember'),smokeMap=pixelTexture('stone');
  const particles=Array.from({length:SPELL_PARTICLES},()=>{
    const material=new THREE.MeshBasicMaterial({map:pixelTexture('ember'),color:0xffad54,transparent:true,depthWrite:false});
    const mesh=new THREE.Mesh(boxGeometry(TEXEL,TEXEL,TEXEL),material);mesh.visible=false;group.add(mesh);
    return {mesh,material,velocity:new THREE.Vector3(),life:0,duration:0,type:'',bounce:false,size:1};
  });
  function fireball(){
    const root=new THREE.Group();root.visible=false;group.add(root);
    const shell=block(root,.3125,.1875,.1875,shellMaterial,0,0,0,0,Math.PI/4,0,{shadow:false});
    block(root,.1875,.3125,.1875,ember,0,0,0,0,0,0,{shadow:false});
    const core=block(root,.125,.125,.375,pixelMaterial('ember',{tint:0xfff0bd,emissive:2}),0,0,0,0,0,0,{shadow:false});
    return {root,shell,core,active:false,release:null,trail:0,age:0};
  }
  const balls=Array.from({length:8},fireball),charge=fireball();
  const flashes=Array.from({length:8},()=>{const root=new THREE.Object3D();group.add(root);return {root,life:0,release:null};});
  const ledger=createDecalLedger(),decals=Array.from({length:SCORCH_CAP},()=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,2,1,0,3,2]);
    const material=new THREE.MeshBasicMaterial({map:pixelTexture('scorch'),transparent:true,alphaTest:.05,depthWrite:false,
      side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.name='Charred pixel scorch';group.add(mesh);return mesh;
  });
  const patches=Array.from({length:12},()=>({point:new THREE.Vector3(),life:0,emit:0})),burns=new Map();
  const emitPoint=new THREE.Vector3(),emitDirection=new THREE.Vector3(),local=new THREE.Vector3();
  let time=0,chargeEmit=0;
  // Fire (HUMANITY polish): flames are glowing blocks that rise on their own heat, swirl, swell and burn
  // down from white-yellow through orange to a dull red; sparks shoot out and arc down; smoke rolls up grey.
  const FLAME=[[1,0xfff3c8],[.78,0xffd060],[.55,0xff8a24],[.32,0xe0451a],[0,0x5a1608]],flameColor=new THREE.Color(),flameNext=new THREE.Color();
  function rampColor(f){for(let i=1;i<FLAME.length;i++)if(f>=FLAME[i][0]){const [a,ca]=FLAME[i-1],[b,cb]=FLAME[i];return flameColor.setHex(cb).lerp(flameNext.setHex(ca),(f-b)/(a-b));}return flameColor.setHex(FLAME.at(-1)[1]);}
  function emit(point,direction,type,count,burst=false,scale=1){
    // Reserve forty slots for a readable impact even after a long flight.
    const limit=burst?particles.length:particles.length-40;
    for(let i=0;i<limit&&count>0;i++){
      const p=particles[i];
      if(p.life>0)continue;count--;
      const smoke=type==='smoke',fire=type==='fire';p.type=type;p.bounce=false;
      p.duration=p.life=smoke?1.2+Math.random()*.9:fire?.3+Math.random()*.28:.35+Math.random()*.45;
      p.size=(smoke?3+Math.random()*2.5:fire?1.6+Math.random()*1.8:1)*scale;
      p.mesh.visible=true;p.mesh.position.copy(point);p.mesh.scale.setScalar(p.size);
      p.mesh.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
      p.material.map=smoke?smokeMap:null;p.material.blending=smoke?THREE.NormalBlending:THREE.AdditiveBlending;p.material.needsUpdate=true;
      p.material.color.setHex(smoke?0x4a4648:fire?0xfff3c8:0xffc860);
      p.material.opacity=smoke?.4:1;
      if(fire){p.velocity.copy(direction).multiplyScalar(.6*scale);p.velocity.x+=(Math.random()-.5)*.9*scale;p.velocity.z+=(Math.random()-.5)*.9*scale;p.velocity.y+=1+Math.random()*1.2*scale;}
      else if(smoke){p.velocity.copy(direction).multiplyScalar(.3);p.velocity.x+=(Math.random()-.5)*.5;p.velocity.z+=(Math.random()-.5)*.5;p.velocity.y+=.5;}
      else{p.velocity.copy(direction).multiplyScalar(1.5+Math.random()*2);p.velocity.x+=(Math.random()-.5)*3.2;p.velocity.z+=(Math.random()-.5)*3.2;p.velocity.y+=1.2+Math.random()*2.2;}
      p.swirl=Math.random()*6.28;
    }
  }
  /** A flame held in a hand (third person): small flames and sparks at a steady rate, a warm light. */
  let handTimer=0,handLight=null;const handPoint=new THREE.Object3D();group.add(handPoint);
  function handFlame(point,dt){
    if(!point){handLight?.();handLight=null;return;}
    handPoint.position.copy(point);handLight??=world.lights?.follow(handPoint,{color:0xff8a3a,intensity:1.4,distance:3.2});
    handTimer+=dt;while(handTimer>.03){handTimer-=.03;emit(point,UP,'fire',1);if(Math.random()<.15)emit(point,UP,'ember',1);}
  }
  function releaseBall(ball){ball.release?.();ball.release=null;ball.active=false;ball.root.visible=false;}
  function startBall(point){
    const ball=balls.find(b=>!b.active);if(!ball)return null;
    ball.active=true;ball.root.visible=true;ball.root.position.copy(point);ball.root.scale.setScalar(1);ball.age=ball.trail=0;
    ball.release=world.lights?.follow(ball.root,{color:0xff8b35,intensity:4,distance:5});return ball;
  }
  function updateBall(ball,dt){
    ball.age+=dt;ball.trail+=dt;ball.shell.rotation.y+=dt*7;ball.shell.rotation.z=Math.sin(ball.age*13)*.35;
    ball.core.scale.setScalar(1+Math.sin(ball.age*77)*.2);
    if(ball.trail>=.03){ball.trail%=.03;emitDirection.set(0,.1,0);emit(ball.root.position,emitDirection,'fire',3);if(Math.random()<.5)emit(ball.root.position,emitDirection,'ember',1);if(Math.random()<.4)emit(ball.root.position,emitDirection,'smoke',1);}
  }
  function setCharge(point,progress,dt){
    if(progress===null){releaseBall(charge);chargeEmit=0;return;}
    if(!charge.active){charge.active=true;charge.root.visible=true;charge.release=world.lights?.follow(charge.root,{color:0xff9c45,intensity:1.6,distance:3});}
    charge.root.position.copy(point);charge.root.scale.setScalar(.3+progress*.65);charge.core.scale.setScalar(1+Math.sin(time*85)*.2);
    charge.shell.rotation.set(time*4,time*9,0);chargeEmit+=dt;
    if(chargeEmit>.065){chargeEmit%=.065;emitDirection.set(0,.4,0);emit(point,emitDirection,'ember',2);sound('crackle');}
  }
  function scorch(point,normal,object=null){
    let mesh=decals.find(m=>!ledger.items.some(e=>e.value===m));if(!mesh)mesh=ledger.items[0].value;
    mesh.removeFromParent();group.add(mesh);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);
    const attribute=mesh.geometry.attributes.position;
    const heightAt=object?(x,z)=>point.y-(normal.x*(x-point.x)+normal.z*(z-point.z))/normal.y:(x,z)=>world.heightAt(x,z);
    decalCorners(point,normal,heightAt,(Math.random()-.5)*.3,attribute.array);
    if(object){
      object.updateWorldMatrix(true,false);
      for(let i=0;i<4;i++){local.fromBufferAttribute(attribute,i);object.worldToLocal(local);attribute.setXYZ(i,local.x,local.y,local.z);}
      object.add(mesh);
    }
    attribute.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.material.opacity=1;mesh.visible=true;ledger.add(mesh);
  }
  function impact(point,direction,normal=UP,{enemy=false,object=null}={}){
    emitDirection.copy(normal).multiplyScalar(.7).addScaledVector(direction,-.2);
    emit(point,emitDirection,'fire',30,true,2.6);emit(point,emitDirection,'ember',20,true);emit(point,normal,'smoke',9,true,1.6);
    let flash=flashes.find(f=>f.life<=0);if(!flash)flash=flashes[0];flash.release?.();flash.root.position.copy(point).addScaledVector(normal,.22);flash.life=.13;
    flash.release=world.lights?.follow(flash.root,{color:0xffbd6b,intensity:12,distance:7});
    if(enemy){emitPoint.set(point.x,world.heightAt(point.x,point.z),point.z);scorch(emitPoint,UP);}
    else scorch(point,normal,object);
    if(!object&&(enemy||normal.y>.55)){
      const patch=patches.find(p=>p.life<=0)||patches[0];patch.point.set(point.x,world.heightAt(point.x,point.z)+.04,point.z);patch.life=3.6;patch.emit=0;
    }
    sound('fireImpact');onImpact?.(point,direction,2.5);
  }
  function ignite(enemy,damage=12){
    if(enemy.dead)return;
    const previous=burns.get(enemy);
    // Repeated hits refresh duration, without stacking separate damage streams.
    if(previous){previous.burn=createBurnState(damage);return;}
    burns.set(enemy,{enemy,burn:createBurnState(damage),emit:0});
  }
  function update(dt){
    time+=dt;
    for(const p of particles){if(p.life<=0)continue;
      p.life=Math.max(0,p.life-dt);if(p.life<=0){p.mesh.visible=false;continue;}
      const smoke=p.type==='smoke',fire=p.type==='fire',fade=p.life/p.duration;
      if(fire){p.velocity.y+=dt*3.2;p.velocity.multiplyScalar(Math.exp(-dt*2.2));p.swirl+=dt*9;p.velocity.x+=Math.cos(p.swirl)*dt*1.4;p.velocity.z+=Math.sin(p.swirl)*dt*1.4;}
      else p.velocity.y+=dt*(smoke?.45:-6);
      p.mesh.position.addScaledVector(p.velocity,dt);
      p.mesh.rotation.x+=dt*2;p.mesh.rotation.z+=dt*3;
      const ground=world.heightAt(p.mesh.position.x,p.mesh.position.z)+TEXEL/2;
      if(!smoke&&!fire&&p.mesh.position.y<ground){
        p.mesh.position.y=ground;
        if(!p.bounce&&p.type==='ember'){p.bounce=true;p.velocity.y=Math.abs(p.velocity.y)*.36;p.velocity.x*=.55;p.velocity.z*=.55;}
        else {p.life=0;p.mesh.visible=false;continue;}
      }
      if(fire){p.material.color.copy(rampColor(fade));p.material.opacity=Math.min(1,fade*2.2);p.mesh.scale.setScalar(p.size*(fade>.7?.7+(1-fade)*1.6:Math.max(.25,fade*1.5)));}
      else{p.material.opacity=smoke?fade*.4:Math.min(1,fade*3);if(!smoke)p.material.color.setHex(fade>.5?0xffe39a:0xff7a2a);
        p.mesh.scale.setScalar(p.size*(smoke?1+(1-fade)*1.8:Math.max(.2,fade)));}
    }
    for(const f of flashes)if(f.life>0){f.life-=dt;if(f.life<=0){f.release?.();f.release=null;}}
    for(const p of patches)if(p.life>0){
      p.life-=dt;p.emit+=dt;if(p.emit>.14){p.emit%=.14;emitPoint.copy(p.point);emitPoint.x+=(Math.random()-.5)*.65;emitPoint.z+=(Math.random()-.5)*.65;
        emitDirection.set(0,.15,0);emit(emitPoint,emitDirection,'fire',3);emit(emitPoint,emitDirection,'ember',1);emit(emitPoint,UP,'smoke',1);}
    }
    for(const state of burns.values()){
      const enemy=state.enemy;
      if(enemy.dead){burns.delete(enemy);continue;}
      const damage=advanceBurn(state.burn,dt);if(damage>0)onBurnDamage?.(enemy,damage);
      if(enemy.dead||state.burn.done){burns.delete(enemy);continue;}
      state.emit+=dt;if(state.emit>.09){state.emit%=.09;emitPoint.copy(enemy.model.position);
        emitPoint.x+=(Math.random()-.5)*.55;emitPoint.z+=(Math.random()-.5)*.5;emitPoint.y+=(enemy.kind==='wolf'?.6:1)+Math.random()*.8;
        emit(emitPoint,UP,'fire',3);if(Math.random()<.5)emit(emitPoint,UP,'ember',1);emit(emitPoint,UP,'smoke',1);}
    }
    ledger.update(dt);for(const mesh of decals)mesh.visible=false;
    for(const entry of ledger.items){entry.value.visible=true;entry.value.material.opacity=entry.opacity;}
  }
  function reset(){
    for(const ball of balls)releaseBall(ball);releaseBall(charge);chargeEmit=0;
    for(const f of flashes){f.release?.();f.release=null;f.life=0;}
    for(const p of particles){p.life=0;p.mesh.visible=false;}
    for(const p of patches)p.life=0;burns.clear();ledger.reset();
    for(const mesh of decals){mesh.visible=false;mesh.removeFromParent();group.add(mesh);}
  }
  return {startBall,updateBall,releaseBall,setCharge,impact,ignite,update,reset,handFlame,
    state:()=>({spellParticles:particles.reduce((n,p)=>n+(p.life>0),0),scorches:ledger.items.length,burning:burns.size,smoulders:patches.filter(p=>p.life>0).length}),
    dispose(){reset();group.removeFromParent();for(const p of particles)p.material.dispose();for(const m of decals){m.geometry.dispose();m.material.dispose();}},
  };
}
