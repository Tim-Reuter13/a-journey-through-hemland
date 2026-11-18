import * as THREE from 'three';
import { block, blockOn, beam } from '../../art/blocks.js';
import { BRIDGE } from '../../data/hemland/bruchwacht.js';
import { frame, pennon, standing, pictureMaterial } from '../bruchwachtArt.js';
import { makeCart, makeLantern } from '../buildings.js';
import { placePlant, plantsLoaded } from '../props.js';
import { boulder, hunterStand, leafPile } from '../flora.js';
import * as F from '../furniture.js';

function cartTracks(ctx) {
  const material=pictureMaterial('karrenweg').clone();
  material.alphaTest=0; material.transparent=true; material.depthWrite=false;
  material.polygonOffset=true; material.polygonOffsetFactor=-2;
  material.map.wrapT=THREE.RepeatWrapping;
  // Selected stretches still see cart traffic. A strip samples the actual terrain
  // across its width, fades at the ends, and stops either side of the timber deck.
  const road=ctx.road('camp').points;
  for(const [from,to] of [[1,5],[6,8],[9,12],[13,15],[17,20]]){
    const curve=new THREE.CatmullRomCurve3(road.slice(from,to+1).map(([x,z])=>new THREE.Vector3(x,0,z)));
    const len=curve.getLength(), rows=Math.ceil(len/.6), pos=[],uv=[],rgba=[],idx=[];
    for(let i=0;i<=rows;i++){
      const u=i/rows,p=curve.getPointAt(u),t=curve.getTangentAt(u);
      for(let j=0;j<=5;j++){
        const off=(j/5-.5)*3.8,x=p.x-t.z*off,z=p.z+t.x*off;
        pos.push(x,ctx.heightAt(x,z)+.036,z); uv.push(j/5,u*len/8);
        rgba.push(1,1,1,Math.min(1,u*len/3,(1-u)*len/3));
        if(i<rows && j<5){const k=i*6+j;idx.push(k,k+1,k+6,k+1,k+7,k+6);}
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(rgba,4));
    geo.setIndex(idx);geo.computeVertexNormals();material.vertexColors=true;
    const mesh=new THREE.Mesh(geo,material);mesh.name='Wagenspuren';mesh.receiveShadow=true;ctx.root.add(mesh);
  }
}

function span(ctx) {
  const { x, z, halfSpan } = BRIDGE, left = x-halfSpan, length = halfSpan*2;
  const a = ctx.heightAt(left,z)+.12, b = ctx.heightAt(x+halfSpan,z)+.12;
  const deckY = wx => a + (b-a)*(wx-left)/length;
  for(const end of [left+.5,x+halfSpan-.5]) {
    blockOn(ctx.root,2.4,3.05,5.3,'ashlarMossy',end,deckY(end)-3.15,z,0,standing);
  }
  for(const side of [-1,1]) {
    const rz=z+side*2.15;
    beam(ctx.root,[left,a-.42,rz],[left+length,b-.42,rz],.46,'timber');
    for(let i=0;i<5;i++){
      const wx=left+i*length/4, y=deckY(wx);
      blockOn(ctx.root,.22,1.45,.22,'planksWeathered',wx,y-.2,rz,0,standing);
      if(i===4 || side===1 && i===2) continue;
      const ex=wx+length/4;
      beam(ctx.root,[wx,y+1.02,rz],[ex,deckY(ex)+1.02,rz],.15,'timber',standing);
    }
    beam(ctx.root,[x-7,deckY(x-7)-.5,rz],[x, deckY(x)-2.7,rz],.33,'timber');
    beam(ctx.root,[x,deckY(x)-2.7,rz],[x+7,deckY(x+7)-.5,rz],.33,'timber');
  }
  for(let i=0;i<32;i++){
    const w=length/32, wx=left+(i+.5)*w, y=deckY(wx);
    blockOn(ctx.root,w-.025,.18,4.52+ctx.random()*.26,i%7===2?'darkPlanks':'planksWeathered',wx,y-.18,z);
    ctx.registerFloor({x:wx,z,halfWidth:w/2,halfDepth:2.28,y});
  }
}

export function buildWestRoad(ctx) {
  const {root,heightAt,random}=ctx, ground=(x,z,ry=0)=>frame(root,x,heightAt(x,z),z,ry);
  cartTracks(ctx);
  const roadside=(id,label,x,z)=>ctx.action({id,label,x,z,y:heightAt(x,z)});
  // The first bend, still tended by the village: a memorial bound up in strips of clothing.
  const stone=ground(-101,41,.3);
  blockOn(stone,2.4,.45,1.85,'cobbleMossy',0,-.15,0,0,standing);
  block(stone,1.4,2.45,.92,'ashlarMossy',0,1.35,0,.04,.08,-.12,standing);
  for(let i=0;i<5;i++){
    const y=1.65+i*.11;
    block(stone,1.48,.09,1.04,i%3?'clothLinen':'clothRed',0,y,0,.03,.08,-.12);
    block(stone,.1,.45+i*.055,.07,i%3?'clothLinen':'clothRed',-.51+i*.23,y-.2,.56,0,0,.14-i*.05);
  }
  F.candle(stone,-.75,.33,.74,0,{light:false});
  roadside('memorial','Die Bänder am Stein ansehen',-101,42.4);
  ctx.marker({id:'baenderstein',kind:'shrine',label:'Bänderstein',x:-101,z:41,discover:true,radius:9,xp:10});

  // A broken axle, a trail of spilled grain and the cargo the escort tried to hide.
  const cart=makeCart(root,heightAt,-153,88,-.28); cart.rotation.z=.18;
  const cargo=ground(-155,89.6);
  F.grainSack(cargo,0,0,0); F.barrel(cargo,1.1,0,.2); F.book(cargo,1.1,1.12,.2,.15);
  roadside('cart','Den Frachtzettel umdrehen',-154,89.8);
  const cache=ground(-156,91.4,-.22);
  F.crate(cache,0,0,0); block(cache,.87,.055,.83,'clothBlue',0,.81,0);
  roadside('roadcache','Unter dem Wachstuch nachsehen',-156,91.4);
  span(ctx);
  for(const [x,z] of [[-164,80],[-185,86]]) makeLantern(root,heightAt,x,z);

  // A surviving bow stand above the hairpin can be seen between the trees.
  hunterStand(root,-273,heightAt(-273,134),134,.65,random);
  pennon(root,-268,heightAt(-268,132),132,.45,.8);
  F.firewoodStack(root,-276,heightAt(-276,134),134,.32);
  ctx.marker({id:'kraehenkanzel',kind:'tower',label:'Krähenkanzel',x:-273,z:134,discover:true,radius:12,xp:12});

  // Different silhouettes along the road: small field markers, a rock cutting,
  // then fragments of the old causeway, with patches of growth tucked into their lee.
  const clusters=[[-59,25,'meadow'],[-85,37,'leaves'],[-104,39,'meadow'],[-127,78,'rock'],
    [-148,76,'leaves'],[-186,90,'rock'],[-207,99,'rock'],[-225,108,'rock'],[-245,124,'leaves'],
    [-263,120,'rock'],[-277,142,'leaves'],[-294,162,'rock'],[-302,145,'leaves']];
  for(const [cx,cz,kind] of clusters){
    for(let i=0;i<9;i++){
      const x=cx+(random()-.5)*7,z=cz+(random()-.5)*5, y=heightAt(x,z);
      if(ctx.roadAt(x,z).distance<3.1) continue;
      if(kind==='rock' && i<4) boulder(root,x,y,z,.55+random()*1.45,random,true);
      else if(kind==='leaves' && i<3) leafPile(root,x,y,z,.8+random(),random);
      else if(plantsLoaded()) placePlant(root,kind==='meadow'?'heather_2':i%3?'fern_big_1':'mushroom_brown_1',x,y,z,.75+random()*.48,random,heightAt);
    }
  }
  for(const [x,z,h] of [[-47,24,1.25],[-116,52,.85],[-193,89,.65],[-240,114,1.22],[-294,151,.9]]){
    const g=ground(x,z,.42);
    blockOn(g,.8,h,.66,'ashlarMossy',0,-.08,0,0,standing);
    blockOn(g,.92,.17,.78,'sandstone',0,h-.1,0);
    blockOn(g,.32,.31,.035,'clothRed',0,h-.53,.34);
  }
}
