import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDecalLedger,decalCorners,createBurnState,advanceBurn,traceSpellSurface,createSpellFx,SPELL_PARTICLES,SCORCH_CAP } from '../src/systems/spellFx.js';
import { createCombat } from '../src/systems/combat.js';

const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const point=(x,y,z)=>new THREE.Vector3(x,y,z);
const ground={heightAt:()=>0,segmentBlocked:()=>false};

test('scorches persist without capacity pressure',()=>{
  const ledger=createDecalLedger();ledger.add('first');ledger.update(10000);
  assert.equal(ledger.items.length,1);assert.equal(ledger.items[0].opacity,1);
});
test('capacity retires the oldest scorch with a visible fade',()=>{
  const ledger=createDecalLedger();for(let i=0;i<37;i++)ledger.add(i);
  ledger.update(.4);near(ledger.items[0].opacity,.5);
  assert.equal(ledger.items.at(-1).opacity,1);
  ledger.update(.4);assert.equal(ledger.items[0].value,1);
});
test('a burst of impacts never exceeds forty decals and evicts oldest first',()=>{
  const ledger=createDecalLedger();let evicted=null;
  for(let i=0;i<100;i++){evicted=ledger.add(i);assert.ok(ledger.items.length<=SCORCH_CAP);}
  assert.equal(evicted,59);assert.equal(ledger.items[0].value,60);
  ledger.reset();assert.equal(ledger.items.length,0);
});
test('ground decal samples all four rotated corners at sixteen texels per unit',()=>{
  const heightAt=(x,z)=>x*.2+z*.3,center=point(3,0,5),buffer=new Float32Array(12);
  assert.equal(decalCorners(center,point(0,1,0),heightAt,.14,buffer),buffer);
  for(let i=0;i<4;i++)near(buffer[i*3+1],heightAt(buffer[i*3],buffer[i*3+2])+.018);
  near(Math.hypot(buffer[3]-buffer[0],buffer[5]-buffer[2]),1);
});
test('wall decal lies in the hit plane, offset toward its visible side',()=>{
  const buffer=decalCorners(point(2,4,8),point(-1,0,0),()=>99,.12);
  for(let i=0;i<4;i++)near(buffer[i*3],2-.018);
  near(Math.hypot(buffer[4]-buffer[1],buffer[5]-buffer[2]),1);
});
test('rotated wall and ceiling decals retain area and face the hit normal',()=>{
  for(const normal of [point(.6,0,.8),point(0,-1,0)]){
    const origin=point(2,3,4),buffer=decalCorners(origin,normal,()=>0,.1);
    const corners=[0,1,2,3].map(i=>point(...buffer.slice(i*3,i*3+3)));
    for(const corner of corners)near(corner.clone().sub(origin).dot(normal),.018);
    near(corners[1].clone().sub(corners[0]).cross(corners[3].clone().sub(corners[0])).length(),1);
  }
});
test('surface trace finds a thin wall before the end of a long frame',()=>{
  const world={...ground,segmentBlocked:(a,b)=>b.x>=2&&a.x<2};
  const hit=traceSpellSurface(world,point(0,2,0),point(8,2,0));
  near(hit.point.x,2,.001);near(hit.t,.25,.001);
  assert.deepEqual(hit.normal.toArray(),[-1,0,0]);assert.equal(hit.ground,false);
});
test('surface trace identifies a ceiling and a wall crossed on z',()=>{
  const ceiling={...ground,segmentBlocked:(a,b)=>a.y<3&&b.y>=3};
  assert.deepEqual(traceSpellSurface(ceiling,point(0,1,0),point(0,5,0)).normal.toArray(),[0,-1,0]);
  const wall={...ground,segmentBlocked:(a,b)=>a.z> -2&&b.z<= -2};
  assert.deepEqual(traceSpellSurface(wall,point(0,2,0),point(0,2,-4)).normal.toArray(),[0,0,1]);
});
test('surface trace catches terrain and returns a slope normal',()=>{
  const world={...ground,heightAt:x=>x*.25};
  const hit=traceSpellSurface(world,point(0,2,0),point(4,-1,0));
  near(hit.point.y,world.heightAt(hit.point.x));assert.equal(hit.ground,true);
  near(hit.normal.x/hit.normal.y,-.25);
});
test('unobstructed travel and a zero step return no contact',()=>{
  assert.equal(traceSpellSurface(ground,point(0,2,0),point(4,2,0)),null);
  assert.equal(traceSpellSurface(ground,point(0,2,0),point(0,2,0)),null);
});
test('burn applies four ticks over two seconds, once each',()=>{
  const burn=createBurnState(12);
  assert.equal(advanceBurn(burn,.49),0);assert.equal(advanceBurn(burn,.01),3);
  assert.equal(advanceBurn(burn,.5),3);assert.equal(advanceBurn(burn,.5),3);
  assert.equal(advanceBurn(burn,.5),3);assert.equal(burn.done,true);
  assert.equal(advanceBurn(burn,10),0);
});
test('burn damage is frame-rate independent and clamps a long final frame',()=>{
  const fine=createBurnState(16),coarse=createBurnState(16);let total=0;
  for(let i=0;i<240;i++)total+=advanceBurn(fine,1/120);
  assert.equal(total,16);assert.equal(advanceBurn(coarse,10),16);
  assert.equal(advanceBurn(coarse,1),0);
});
test('negative time cannot heal or rewind burn damage',()=>{
  const burn=createBurnState();advanceBurn(burn,.5);
  assert.equal(advanceBurn(burn,-2),0);assert.equal(burn.elapsed,.5);
});

test('pooled effects cap particles, refresh burning, attach prop decals and release all lights',()=>{
  const originalDocument=globalThis.document,originalImageData=globalThis.ImageData;
  globalThis.document={createElement:()=>({getContext:()=>({putImageData(){}})})};
  globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
  let lights=0,damage=0,impacts=0;
  const scene=new THREE.Scene(),world={...ground,lights:{follow(){lights++;let active=true;return ()=>{if(active){lights--;active=false;}};}}};
  let fx;
  try{
    fx=createSpellFx(scene,world,{onBurnDamage:(enemy,amount)=>{damage+=amount;},onImpact:(p,d,r)=>{assert.equal(r,2.5);impacts++;}});
    const enemy={model:new THREE.Group(),dead:false};scene.add(enemy.model);
    const prop=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));scene.add(prop);prop.position.set(2,3,4);
    const ball=fx.startBall(point(0,2,0));fx.setCharge(point(0,2,0),.5,.1);
    fx.ignite(enemy);fx.update(.25);fx.ignite(enemy);fx.update(2);
    assert.equal(damage,12);assert.equal(fx.state().burning,0);
    for(let i=0;i<60;i++)fx.impact(point(2.5,3,4),point(-1,0,0),point(1,0,0),{object:prop});
    assert.equal(impacts,60);assert.ok(fx.state().spellParticles<=SPELL_PARTICLES);assert.equal(fx.state().scorches,SCORCH_CAP);
    assert.equal(prop.children.filter(c=>c.name==='Charred pixel scorch').length,SCORCH_CAP);
    fx.releaseBall(ball);fx.reset();assert.equal(lights,0);assert.equal(prop.children.length,0);
    assert.deepEqual(fx.state(),{spellParticles:0,scorches:0,burning:0,smoulders:0});
    prop.geometry.dispose();prop.material.dispose();
  }finally{
    fx?.dispose();globalThis.document=originalDocument;globalThis.ImageData=originalImageData;
  }
});

test('prop top scorch stays on the prop instead of snapping to the floor',()=>{
  const originalDocument=globalThis.document,originalImageData=globalThis.ImageData;
  globalThis.document={createElement:()=>({getContext:()=>({putImageData(){}})})};
  globalThis.ImageData=class {};
  let fx;
  try{
    const scene=new THREE.Scene(),prop=new THREE.Group();prop.position.set(2,3,4);scene.add(prop);
    fx=createSpellFx(scene,ground);fx.impact(point(2,3.5,4),point(0,-1,0),point(0,1,0),{object:prop});
    const mark=prop.children[0];assert.ok(mark);prop.updateWorldMatrix(true,true);
    const corner=point(0,0,0).fromBufferAttribute(mark.geometry.attributes.position,0).applyMatrix4(prop.matrixWorld);
    near(corner.y,3.518);
  }finally{fx?.dispose();globalThis.document=originalDocument;globalThis.ImageData=originalImageData;}
});

test('combat resolves nearest enemy, wall and loose prop contacts and reset cancels burning',()=>{
  const originalDocument=globalThis.document,originalImageData=globalThis.ImageData;
  const node=()=>({style:{},classList:{toggle(){}},append(){},remove(){},getContext:()=>({putImageData(){},fillRect(){}})});
  globalThis.document={createElement:node,getElementById:node};globalThis.ImageData=class {};
  try{
    for(const scenario of ['enemy','wall','prop','handWall']){
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),model=new THREE.Group();scene.add(model);
      model.position.z=scenario==='enemy'?-3:-6;
      const enemy={model,hp:100,maxHp:100,kind:'bandit',stagger:100,cooldown:100,windup:0};
      const wall=scenario==='handWall'?-.3:-4,loose=[];
      if(scenario==='prop'){
        const prop=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());prop.position.set(0,1.7,-2);scene.add(prop);loose.push(prop);
      }
      scene.updateMatrixWorld(true);
      const world={...ground,blocked:()=>true,loose,segmentBlocked:(a,b)=>a.z>wall&&b.z<=wall};
      const player={position:point(0,0,0),yaw:0,pitch:0,tool:1,stamina:100,potions:1};let impact=null;
      const combat=createCombat({scene,camera,player,enemies:[enemy],world,
        onHit:(e,damage)=>{e.hp-=damage;e.dead=e.hp<=0;},onHurt(){},onHeal(){},weaponDamage:()=>20,magicDamage:()=>40,toast(){},
        onImpact:(p,d,r)=>{impact={point:p.clone(),radius:r};}});
      assert.equal(combat.attack(),true);combat.update(.2);combat.update(.14);
      for(let i=0;i<12&&!impact;i++)combat.update(.05);
      assert.ok(impact,scenario);assert.equal(impact.radius,2.5);assert.equal(combat.state().projectiles,0);
      if(scenario==='enemy'){
        assert.equal(enemy.hp,60);combat.update(.5);assert.equal(enemy.hp,57);assert.equal(combat.state().burning,1);
      }else{
        assert.equal(enemy.hp,100);
        near(impact.point.z,scenario==='prop'?-1.5:wall,.003);
      }
      combat.reset();const hp=enemy.hp;combat.update(3);assert.equal(enemy.hp,hp);assert.equal(combat.state().burning,0);
      combat.spellFx.dispose();for(const prop of loose){prop.geometry.dispose();prop.material.dispose();}
    }
  }finally{globalThis.document=originalDocument;globalThis.ImageData=originalImageData;}
});
