import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollisionWorld, collidersFrom } from '../src/world/navigation.js';
import { bayAt, WATCH, useBruchSpot } from '../src/data/hemland/bruchwacht.js';
import { normalizeSave } from '../src/systems/saveState.js';

globalThis.ImageData ??= class { constructor(data,width,height){Object.assign(this,{data,width,height});} };
globalThis.document ??= {
  createElement:()=>({getContext:()=>({putImageData(){}})}),
  createElementNS:()=>({addEventListener(){},removeEventListener(){}}),
};
const root=new THREE.Group(), actions=[], floors=[];
const collision=createCollisionWorld({bounds:{minX:-410,maxX:-250,minZ:110,maxZ:190}});
const {buildBruchwacht}=await import('../src/world/sites/bruchwacht.js');
const vault=buildBruchwacht({root,heightAt:()=>19,registerFloor:f=>floors.push(f),
  action:a=>actions.push(a),addCollider:c=>collision.add(c),marker(){}});
for(const c of collidersFrom(root)) collision.add(c);
const support=(x,z)=>floors.reduce((y,f)=>Math.abs(x-f.x)<f.halfWidth+.45 && Math.abs(z-f.z)<f.halfDepth+.45 ? Math.max(y,f.y) : y,19);

// Walk the built room, not just its floor plan. The search can also go around the entire
// outside shell: a gap in a rear wall would let it reach the pay chest before either dial.
function explore() {
  const points=[[-305,150]], seen=new Set(['-305,150']);
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i], oldY=support(x,z);
    for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
      const nx=x+dx,nz=z+dz,key=nx+','+nz;
      if(nx < -405 || nx > -303 || nz < 124 || nz > 178 || seen.has(key)) continue;
      const y=support(nx,nz);
      if(Math.abs(oldY-y)>.46 || collision.blocked(nx,nz,.43,y,2.65)) continue;
      seen.add(key);points.push([nx,nz]);
    }
  }
  return p=>points.some(([x,z])=>Math.hypot(x-p.x,z-p.z)<1.1);
}

test('the paved entrance, both wings, stores and back latch are reachable; the treasury is sealed',()=>{
  vault.sync({});
  const reach=explore();
  for(const a of actions) assert.equal(reach(a),a.id!=='pay',a.id);
  for(const e of WATCH) for(const [x,z] of [e.day,e.night])
    assert.equal(collision.blocked(x,z,.43,support(x,z),2.65),false,e.personName);
  const door=bayAt(6,8);
  assert.equal(collision.blocked(door.x,door.z+2.4,.43,20.22,2.65),true);
  vault.sync({bruch_vault:true,bruch_postern:true},true);
  vault.update(.1);
  assert.equal(collision.blocked(door.x,door.z+2.4,.43,20.22,2.65),true);
  vault.update(2);
  assert.equal(collision.blocked(door.x,door.z+2.4,.43,20.22,2.65),false);
  assert.ok(explore()(actions.find(a=>a.id==='pay')));
});

test('toll settings, full packs and one-time loot survive a save',()=>{
  let flags={}, paid=0;
  useBruchSpot('scale',flags); assert.ok(!flags.bruch_vault);
  for(const id of ['iron','grain','iron','scale','postern']) useBruchSpot(id,flags);
  assert.equal(flags.bruch_vault,true);
  useBruchSpot('pay',flags,()=>false); assert.ok(!flags.bruch_pay);
  useBruchSpot('pay',flags,loot=>{paid+=loot.gold;return true;});
  const save={version:7,position:[-397,19.12,150],flags,enemies:Array.from({length:12},()=>({hp:0,dead:true}))};
  const loaded=normalizeSave(save);
  flags=loaded.flags;
  useBruchSpot('pay',flags,()=>{throw Error('Already collected');});
  assert.equal(paid,38);assert.equal(flags.bruch_postern,true);
  assert.equal(loaded.enemies.length,5+WATCH.length);
  assert.equal(normalizeSave({...save,version:6}).enemies.length,5,'old road encounters must not overwrite new residents');
});
