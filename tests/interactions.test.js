import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleTerrain, createCollisionWorld, routePoints, nearTrail } from '../src/world/navigation.js';
import { createLiquid } from '../src/systems/liquid.js';
import { crossedImpact, inAttackArc } from '../src/systems/combatRules.js';

test('terrain sampling follows mesh triangles and stays continuous at cell boundaries',()=>{
 const height=(x,z)=>x*x*.03+z*z*.02+x*z*.04;
 const step=300/180,x=-150+54*step,z=-150+71*step;
 assert.ok(Math.abs(sampleTerrain(height,x,z)-height(x,z))<1e-8);
 const expected=height(x,z)*.4+height(x+step,z)*.2+height(x,z+step)*.4;
 assert.ok(Math.abs(sampleTerrain(height,x+step*.2,z+step*.4)-expected)<1e-8);
 for(let k=0;k<10;k++)assert.ok(Math.abs(sampleTerrain(height,x+step-1e-7,z+k*.1)-sampleTerrain(height,x+step+1e-7,z+k*.1))<1e-5);
});
test('all route samples belong to a connected trail surface',()=>{
 for(const points of routePoints)for(let i=1;i<points.length;i++){
  const p=points[i],a=points[i-1];assert.ok(nearTrail(p.x,p.z,.2));
  assert.ok(nearTrail((a.x+p.x)/2,(a.z+p.z)/2,.2));
  assert.ok(p.distanceTo(a)<1.5);
 }
});
test('collisions respect height and stop even very short projectile segments',()=>{
 const world=createCollisionWorld();world.add({x:1,z:0,halfWidth:.05,halfDepth:1,bottom:0,top:2});
 assert.equal(world.blocked(1,0,.1,0),true);
 assert.equal(world.blocked(1,0,.1,2.1),false);
 assert.equal(world.blocked(1,0,.1,-1,.5),false);
 assert.equal(world.segmentBlocked(new THREE.Vector3(.91,1,0),new THREE.Vector3(.98,1,0),.03),true);
 assert.equal(world.segmentBlocked(new THREE.Vector3(0,3,0),new THREE.Vector3(2,3,0)),false);
});
test('liquid tilts toward felt gravity, sloshes after a jolt and settles',()=>{
 let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const liquid=createLiquid({random}),up={x:0,y:1,z:0};
 liquid.impulse(3,-2);liquid.update(.03,{felt:up,level:.04,bottom:-.2});
 assert.ok(Math.abs(liquid.state.x)>0);
 let crossings=0,last=Math.sign(liquid.state.x);
 for(let i=0;i<4000;i++){
  liquid.update(i%5===0?.1:1/60,{felt:up,level:.04,bottom:-.2});
  const s=liquid.state;assert.ok(Number.isFinite(s.x)&&Math.abs(s.x)<=.75&&Math.abs(s.z)<=.75);
  if(i<300&&Math.sign(s.x)!==last&&Math.abs(s.x)>1e-3){crossings++;last=Math.sign(s.x);}
 }
 assert.ok(crossings>=3,'a jolt swings back and forth a few times');
 assert.ok(Math.hypot(liquid.state.x,liquid.state.z)<1e-3,'and comes to rest');
 // Felt gravity leaning sideways (an acceleration or a tilted bottle): the surface follows it.
 const lean={x:.4,y:Math.sqrt(1-.16),z:0};
 for(let i=0;i<600;i++)liquid.update(1/60,{felt:lean,level:.04,bottom:-.2});
 assert.ok(Math.abs(liquid.state.x-.4)<.02);
 liquid.impulse(100,100);liquid.update(50,{felt:up});assert.ok(Number.isFinite(liquid.state.vx));
 liquid.reset();assert.equal(liquid.state.x,0);assert.equal(liquid.bubbles.filter(b=>b.alive).length,0);
});
test('shaking churns the potion: more bubbles and foam that fade again, volume kept',()=>{
 let seed=11;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const liquid=createLiquid({random}),up={x:0,y:1,z:0},alive=()=>liquid.bubbles.filter(b=>b.alive).length;
 let calm=0;for(let i=0;i<180;i++){liquid.update(1/60,{felt:up,level:.04,bottom:-.2});calm=Math.max(calm,alive());}
 let shaken=0;
 for(let i=0;i<180;i++){const a=Math.sin(i/60*Math.PI*2*4)*40;liquid.update(1/60,{felt:up,quick:{x:a,z:a*.3},level:.04,bottom:-.2});shaken=Math.max(shaken,alive());}
 assert.ok(liquid.state.agitation>.4,'agitation builds while shaken');
 assert.ok(shaken>calm*2,`more bubbles when shaken (${calm} → ${shaken})`);
 const mean=liquid.heights.reduce((a,b)=>a+b,0)/liquid.heights.length;
 assert.ok(Math.abs(mean)<1e-4,'ripples neither add nor remove water');
 for(let i=0;i<900;i++)liquid.update(1/60,{felt:up,level:.04,bottom:-.2});
 assert.ok(liquid.state.agitation<.02,'it settles again');
 for(let i=0;i<60;i++)liquid.update(1/60,{felt:up,level:-.21,bottom:-.2});
 assert.equal(alive(),0,'an empty flask has no bubbles');
});
test('weapon, spell and drink impacts trigger once at their animation moment',()=>{
 for(const [kind,at] of [['sword',.29],['cast',.34],['drink',1.02]]){
  assert.equal(crossedImpact(0,at-.01,kind),false);
  assert.equal(crossedImpact(at-.01,at+.01,kind),true);
  assert.equal(crossedImpact(at+.01,at+.1,kind),false);
 }
});
test('melee hits require range and facing, avoiding attacks through the player',()=>{
 assert.equal(inAttackArc(0,-2,0),true);
 assert.equal(inAttackArc(0,2,0),false);
 assert.equal(inAttackArc(0,-4,0),false);
 assert.equal(inAttackArc(-2,0,Math.PI/2),true);
});

test('animator locks the gait to movement, layers attacks on the arms and topples the dead',async()=>{
 const {createAnimator}=await import('../src/characters/animator.js');
 const names=['root','hips','torso','chest','neck','head','arm_upper_right','arm_lower_right','hand_right','arm_upper_left','arm_lower_left','hand_left','leg_upper_right','leg_lower_right','foot_right','leg_upper_left','leg_lower_left','foot_left'];
 const character=new THREE.Group(),rig={};
 for(const name of names){const bone=new THREE.Group();bone.name=name;bone.userData.rest={position:bone.position.clone(),quaternion:bone.quaternion.clone()};rig[name]=bone;character.add(bone);}
 character.userData.rig=rig;character.userData.kind='wanderer';
 const animator=createAnimator(character);
 for(let i=0;i<30;i++)animator.update(1/60,{});
 assert.ok(animator.speed<.01,'standing still must not walk');
 const idleLeg=rig.leg_upper_right.rotation.x;
 for(let i=0;i<60;i++){character.position.z-=5/60;animator.update(1/60,{});}
 assert.ok(animator.speed>4,'speed follows displacement');
 assert.ok(Math.abs(rig.leg_upper_right.rotation.x-idleLeg)>.05||Math.abs(rig.leg_lower_right.rotation.x)>.05,'legs swing while moving');
 animator.update(1/60,{action:{kind:'sword',progress:.47,combo:0}});
 assert.ok(rig.arm_upper_right.rotation.x>.8,'strike raises the sword arm');
 animator.update(1/60,{dead:true,death:1});
 assert.ok(rig.root.rotation.z>1.4,'dead actors lie on their side');
});
