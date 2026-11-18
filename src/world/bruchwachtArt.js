import * as THREE from 'three';
import { block, blockOn, beam } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';

export const standing = { solid: true };
export function frame(parent, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  return g;
}

const paintings = new Map();
export function pictureMaterial(file) {
  if (!paintings.has(file)) {
    const texture = new THREE.TextureLoader().load((import.meta.env?.BASE_URL ?? './') + 'textures/bruchwacht/' + file + '.png');
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: .45, side: THREE.DoubleSide });
    material.userData.atlas = true;
    paintings.set(file, material);
  }
  return paintings.get(file);
}
export function painting(parent, file, w, h, x, y, z, yaw = 0) {
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w,h), pictureMaterial(file));
  face.position.set(x,y,z); face.rotation.y = yaw; face.receiveShadow = true; parent.add(face);
  return face;
}
export function pennon(parent, x, y, z, yaw = 0, size = 1) {
  const g = frame(parent,x,y,z,yaw);
  blockOn(g,.16,3.65*size,.16,'timber',0,0,0,0,standing);
  block(g,1.85*size,.12,.12,'darkPlanks',.68*size,3.45*size,0);
  painting(g,'brueckenbanner',1.25*size,2.5*size,.69*size,2.18*size,.01);
}

// Dressed arch stones have radial joints and a proud, pale keystone.
export function arch(parent, x, y, z, yaw, width, spring) {
  const g = frame(parent,x,y,z,yaw), radius = width/2;
  for (const side of [-1,1]) {
    blockOn(g,.62,spring,.95,'ashlarMossy',side*(radius+.27),0,0,0,standing);
    blockOn(g,.84,.24,1.12,'sandstone',side*(radius+.27),spring-.23,0);
  }
  for (let i=0;i<9;i++) {
    const a = (i+.5)*Math.PI/9;
    block(g,(radius+.26)*.36,i===4?.74:.56,i===4?1.17:.96,i===4?'sandstone':'ashlar',
      Math.cos(a)*(radius+.26),spring+Math.sin(a)*(radius+.26),0,0,0,a-Math.PI/2,standing);
  }
}
// The parapet keeps its original courses where the wall stands. Missing bays have
// slumped to different heights, with blocks of coping still hanging over the joint.
export function curtain(parent, ax, az, bx, bz, heights, base) {
  const len=Math.hypot(bx-ax,bz-az), step=len/heights.length;
  const g=frame(parent, ax,base,az,Math.atan2(az-bz,bx-ax));
  heights.forEach((h,i)=>{
    const x=(i+.5)*step;
    blockOn(g,step+.025,h+1,1.55,'fieldstone',x,-1,0,0,standing);
    blockOn(g,step+.12,.26,1.74,'ashlarMossy',x,h-.16,0);
    if(h>4.4 && i%3!==1) blockOn(g,1.15,.8,1.25,'granite',x-.24,h+.09,0,0,standing);
    if(i%3===0) blockOn(g,.72,h*.72,1.95,'ashlarMossy',x-step*.3,-.12,0,0,standing);
  });
}
export function ruinTower(root,x,y,z,height,broken) {
  const g=frame(root,x,y,z);
  const stone = pixelMaterial('granite',{tint:0xbbbdbe});
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4, h=height-(broken[i]||0), side=frame(g,Math.sin(a)*3.6,0,Math.cos(a)*3.6,a);
    blockOn(side,3.12,3.1,1.04,'ashlarMossy',0,-.6,0,0,standing);
    // Narrow embrasures break up the silhouette and catch light behind the rim.
    for(const sign of [-1,1]) blockOn(side,1.32,h-2.5,.84,stone,sign*.9,2.5,0,0,standing);
    blockOn(side,3.14,.5,1.13,'ashlar',0,h-.34,0,0,standing);
    if(i%3!==2) blockOn(side,1.04,.94,.93,'granite',-.62,h+.16,0);
    if(h>8) blockOn(side,3.1,.24,1.16,'ashlarMossy',0,5.25,0);
  }
  beam(g,[-2.2,height-2,-.8],[2,height+.8,1],.32,'timber');
}
