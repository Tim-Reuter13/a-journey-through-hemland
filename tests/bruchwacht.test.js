import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollisionWorld, collidersFrom } from '../src/world/navigation.js';
import { WATCH, useBruchSpot } from '../src/data/hemland/bruchwacht.js';
import { ZOLL_POSTERN } from '../src/data/hemland/zollkeller.js';
import { ROADS } from '../src/world/hemland.js';
import { createHeightfield } from '../src/world/heightfield.js';
import { normalizeSave } from '../src/systems/saveState.js';

globalThis.ImageData ??= class { constructor(data,width,height){Object.assign(this,{data,width,height});} };
globalThis.document ??= {
  createElement:()=>({getContext:()=>({putImageData(){}})}),
  createElementNS:()=>({addEventListener(){},removeEventListener(){}}),
};
const field=createHeightfield();
const root=new THREE.Group(), floors=[];
const collision=createCollisionWorld({bounds:{minX:-410,maxX:-250,minZ:110,maxZ:190}});
const {buildBruchwacht}=await import('../src/world/sites/bruchwacht.js');
const {buildWestRoad}=await import('../src/world/sites/westroad.js');
buildBruchwacht({root,heightAt:field.heightAt,registerFloor:f=>floors.push(f),action(){},addCollider:c=>collision.add(c),marker(){}});
for(const c of collidersFrom(root)) collision.add(c);
const ground=(x,z)=>field.heightAt(x,z);

// Walk the ward as the wanderer would: half-unit steps, no climbing higher than a stair step.
function explore(from=[-305,150]) {
  const points=[from], seen=new Set([from.join()]);
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i], oldY=ground(x,z);
    for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
      const nx=x+dx,nz=z+dz,key=nx+','+nz;
      if(nx < -370 || nx > -300 || nz < 124 || nz > 178 || seen.has(key)) continue;
      const y=ground(nx,nz);
      if(Math.abs(oldY-y)>.46 || collision.blocked(nx,nz,.43,y,2.65)) continue;
      seen.add(key);points.push([nx,nz]);
    }
  }
  return (x,z)=>points.some(([px,pz])=>Math.hypot(x-px,z-pz)<1.1);
}

test('from the gate the ward, the guardroom, the foot of the cellar stairs and the postern can be walked to',()=>{
  const reach=explore();
  assert.ok(reach(-330,150),'the middle of the ward');
  assert.ok(reach(-352.8,150),'the top of the cellar stairs');
  assert.ok(reach(-363,150),'the landing before the cellar door');
  assert.ok(reach(ZOLL_POSTERN.x,ZOLL_POSTERN.z),'the postern in the north curtain');
  for(const e of WATCH) for(const [x,z] of [e.day,e.night,...(e.round||[])]){
    assert.equal(collision.blocked(x,z,.43,ground(x,z),2.65),false,e.personName+' stands in a wall');
    if(x>-350) assert.ok(reach(x,z)||Math.hypot(x+330,z-150)>30,e.personName+' cannot reach the post');
  }
});

test('old saves keep their residents and the road caches stay one-time',()=>{
  let flags={};
  const take=()=>true;
  assert.equal(typeof useBruchSpot('roadcache',flags,take),'string'); assert.equal(flags.bruch_roadcache,true);
  assert.match(useBruchSpot('roadcache',flags,()=>{throw Error('Already collected');}),/Leer/);
  const save={version:7,position:[-330,19.12,150],flags,enemies:Array.from({length:12},()=>({hp:0,dead:true}))};
  const loaded=normalizeSave(save);
  assert.equal(loaded.flags.bruch_roadcache,true);
  assert.equal(loaded.enemies.length,5+WATCH.length);
  assert.equal(normalizeSave({...save,version:6}).enemies.length,5,'old road encounters must not overwrite new residents');
});

test('a cart can follow the west road across the wash and past the timber pile',()=>{
  const field=createHeightfield(), road=ROADS.find(r=>r.id==='camp');
  const scenery=new THREE.Group(), deck=[];
  buildWestRoad({root:scenery,heightAt:field.heightAt,road:()=>road,roadAt:field.roadAt,
    registerFloor:f=>deck.push(f),action(){},marker(){},random:()=>.45});
  const obstacles=createCollisionWorld({bounds:{minX:-410,maxX:0,minZ:0,maxZ:200}});
  for(const c of collidersFrom(scenery)) obstacles.add(c);
  for(let i=1;i<road.points.length;i++){
    const [ax,az]=road.points[i-1], [bx,bz]=road.points[i], len=Math.hypot(bx-ax,bz-az);
    for(let s=0;s<len;s+=.5){
      const x=ax+(bx-ax)*s/len,z=az+(bz-az)*s/len;
      const y=deck.reduce((h,f)=>Math.abs(x-f.x)<f.halfWidth+.45 && Math.abs(z-f.z)<f.halfDepth+.45 ? Math.max(h,f.y) : h,field.heightAt(x,z));
      assert.equal(obstacles.blocked(x,z,.65,y,2.65),false,'road blocked at '+x+','+z);
    }
  }
});
