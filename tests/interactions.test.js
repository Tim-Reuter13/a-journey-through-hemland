import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleTerrain, createCollisionWorld, routePoints, nearTrail } from '../src/world/navigation.js';
import { createSlosh } from '../src/systems/slosh.js';
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
test('liquid reacts to impulses, stays bounded and settles',()=>{
 const slosh=createSlosh();slosh.impulse(3,-2);slosh.update(.03);
 assert.ok(Math.abs(slosh.state.x)>0);
 for(let i=0;i<2000;i++){slosh.update(i%5===0?.1:1/60);assert.ok(Number.isFinite(slosh.state.x));assert.ok(Math.abs(slosh.state.x)<=.5);}
 assert.ok(Math.hypot(slosh.state.x,slosh.state.z)<.0001);
 slosh.impulse(100,100);slosh.update(50);assert.ok(Number.isFinite(slosh.state.vx));
 slosh.reset();assert.equal(slosh.state.x,0);
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
