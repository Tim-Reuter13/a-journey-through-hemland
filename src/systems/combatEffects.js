import * as THREE from 'three';
import { block, boxGeometry } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';
import { createBlood } from './blood.js';
import { createBladeBlood } from './bladeBlood.js';

export function createCombatEffects(scene,world) {
  const bits=[],numbers=[],arcs=[];
  const texel=1/16,geometries=[boxGeometry(texel,texel,texel),boxGeometry(texel*2,texel*2,texel*2)];
  const bloodMaterial=pixelMaterial('clothRed',{tint:0xae4550});
  const emberMaterial=pixelMaterial('ember',{emissive:.9});
  // Arrow strikes (systems/archery.js): wood splinters, stone chips, earth and dust.
  const bitMaterials={blood:bloodMaterial,ember:emberMaterial,splinter:pixelMaterial('clothLinen',{tint:0xb08a5a}),stone:pixelMaterial('clothLinen',{tint:0x9a978e}),
    earth:pixelMaterial('clothLinen',{tint:0x5e4a36}),dust:pixelMaterial('clothLinen',{tint:0xc8bfae}),heal:pixelMaterial('ember',{tint:0x7ee08a,emissive:.9})};
  // 38 combat bits + 112 spell particles keep the combined budget at 150.
  const bitPool=Array.from({length:140},()=>{
    const mesh=new THREE.Mesh(geometries[0],bloodMaterial);mesh.visible=false;scene.add(mesh);
    return {mesh,velocity:new THREE.Vector3(),spin:new THREE.Vector3(),life:0,heavy:true};
  });
  // Impact debris by kind (HUMANITY polish): sparks are bright streaks that skip off stone, chips and clods
  // arc and settle on the ground for a moment, splinters are slivers that tumble, dust is a soft puff that
  // swells and fades. Sizes in texels, speeds in m/s, gravity, bounce, how long it lies.
  const KINDS={ember:{size:[1,1,3],speed:[4,7],up:1,gravity:9,life:[.12,.28],bounce:.35,rest:0,stretch:true,glow:true},
    stone:{size:[1,1,1],speed:[1.8,3.6],up:1.6,gravity:9.5,life:[.7,1.1],bounce:.25,rest:.6},
    splinter:{size:[1,1,4],speed:[1.6,3.2],up:1.4,gravity:8,life:[.8,1.2],bounce:.2,rest:.8,spin:18},
    earth:{size:[1,1.5,1],speed:[1.2,2.6],up:2.4,gravity:9.5,life:[.6,1],bounce:0,rest:.5},
    blood:{size:[1,1,1],speed:[1,2.6],up:1,gravity:9.8,life:[.45,.8],bounce:0,rest:0},
    dust:{size:[2,2,2],speed:[.2,.6],up:.5,gravity:-.25,life:[.6,1],bounce:0,rest:0,puff:true},
    heal:{size:[1,1,1],speed:[.4,1],up:1.2,gravity:-1,life:[.6,1],bounce:0,rest:0,glow:true}};
  const sparkMaterial=new THREE.MeshBasicMaterial({color:0xffe08a,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});
  const unit=boxGeometry(texel,texel,texel),puffs=Array.from({length:24},()=>{
    const material=new THREE.MeshLambertMaterial({color:0xc8bfae,transparent:true,depthWrite:false});const mesh=new THREE.Mesh(unit,material);mesh.visible=false;scene.add(mesh);
    return {mesh,material,velocity:new THREE.Vector3(),life:0,duration:1,size:2};
  });
  const projected=new THREE.Vector3();
  let audio=null,hitTime=0,shake=0;
  function sound(kind){
    try{
      audio??=new (window.AudioContext||window.webkitAudioContext)();void audio.resume();
      if(kind.startsWith('bow')||kind.startsWith('arrow')){bowSound(kind);return;}
      const t=audio.currentTime,d=kind==='fireImpact'?.38:kind==='crackle'?.025:kind==='swing'?.18:kind==='drink'?.25:kind==='slosh'?.22:.12;
      const gain=audio.createGain();gain.gain.setValueAtTime(kind==='crackle'?.009:kind==='fireImpact'?.16:kind==='impact'?.11:kind==='slosh'?.03:.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+d);gain.connect(audio.destination);
      if(kind==='swing'||kind==='impact'||kind==='fireImpact'||kind==='crackle'||kind==='slosh'){
        const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*d),audio.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
        const source=audio.createBufferSource(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type=kind==='slosh'?'bandpass':'lowpass';filter.frequency.value=kind==='crackle'?4200:kind==='swing'?1500:kind==='fireImpact'?950:kind==='slosh'?640:520;if(kind==='slosh'){filter.Q.value=3;filter.frequency.exponentialRampToValueAtTime(260,t+d);}source.connect(filter);filter.connect(gain);source.start(t);
        if(kind==='fireImpact'){
          const bass=audio.createOscillator();bass.type='triangle';bass.frequency.setValueAtTime(110,t);bass.frequency.exponentialRampToValueAtTime(32,t+d);bass.connect(gain);bass.start(t);bass.stop(t+d);
        }
      }else{
        const oscillator=audio.createOscillator();oscillator.type='sine';oscillator.frequency.setValueAtTime(kind==='parry'?1050:kind==='cast'?360:190,t);oscillator.frequency.exponentialRampToValueAtTime(kind==='cast'?920:80,t+d);oscillator.connect(gain);oscillator.start(t);oscillator.stop(t+d);
      }
    }catch{/* Audio is optional when the browser does not permit it. */}
  }
  // Bow and arrow: a creak while drawing, a twang and a whoosh on release, a dull thud in wood or
  // earth, a wet one in a body. Noise through a filter, plus a plucked tone for the string.
  function bowSound(kind){
    const t=audio.currentTime,d={bowDraw:.55,bowRelease:.32,arrowHit:.12,arrowFlesh:.16,arrowStone:.09,arrowWood:.14,arrowPull:.18}[kind]||.15;
    const gain=audio.createGain();gain.gain.setValueAtTime({bowDraw:.018,bowRelease:.07,arrowHit:.09,arrowFlesh:.08,arrowStone:.08,arrowWood:.1,arrowPull:.04}[kind]||.05,t);gain.gain.exponentialRampToValueAtTime(.001,t+d);gain.connect(audio.destination);
    const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*d),audio.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const k=i/data.length;data[i]=(Math.random()*2-1)*(kind==='bowDraw'?Math.min(1,k*3)*(Math.sin(i*.004)>.2?1:.35):(1-k));}
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type=kind==='bowRelease'||kind==='arrowStone'?'bandpass':'lowpass';
    filter.frequency.value={bowDraw:900,bowRelease:2400,arrowFlesh:380,arrowStone:3400,arrowWood:760,arrowPull:520}[kind]||620;source.connect(filter);filter.connect(gain);source.start(t);
    if(kind==='bowRelease'||kind==='arrowHit'||kind==='arrowStone'||kind==='arrowWood'){
      const tone=audio.createOscillator();tone.type='triangle';tone.frequency.setValueAtTime({bowRelease:196,arrowStone:620,arrowWood:210}[kind]||150,t);tone.frequency.exponentialRampToValueAtTime({bowRelease:92,arrowStone:340,arrowWood:70}[kind]||55,t+d*.8);
      const toneGain=audio.createGain();toneGain.gain.setValueAtTime(kind==='bowRelease'?.09:.06,t);toneGain.gain.exponentialRampToValueAtTime(.001,t+d);tone.connect(toneGain);toneGain.connect(audio.destination);tone.start(t);tone.stop(t+d);
    }
  }
  const rand=(a,b)=>a+Math.random()*(b-a),tmpDir=new THREE.Vector3();
  // Blood is its own system (blood.js): pixel fluid on the ground, wounds painted into the characters' textures.
  const blood=createBlood(scene,world,{spark:(point,normal,count)=>spray(point,normal,'ember',count),sound:kind=>sound(kind)});
  // The blade (and the hand that holds it) takes the blood of every cut that goes into flesh; main.js keeps the slabs on whatever is held.
  const blade=createBladeBlood({drop:(point,velocity,vol)=>blood.drop(point,velocity,vol)});
  function spray(position,direction,color='blood',count=18){
    if(color==='blood'){blood.spurt(position,direction,count);return;}
    const k=KINDS[color]||KINDS.ember;
    if(k.puff){
      // Dust puffs: soft, swelling, fading, tinted by the ground they came from.
      for(const p of puffs){if(count<=0)break;if(p.life>0)continue;count--;
        p.mesh.position.copy(position).addScaledVector(direction,.05);p.mesh.visible=true;p.size=k.size[0]*rand(1,1.8);p.mesh.scale.setScalar(p.size);
        p.velocity.copy(direction).multiplyScalar(rand(...k.speed));p.velocity.x+=rand(-.3,.3);p.velocity.z+=rand(-.3,.3);p.velocity.y+=k.up*rand(.4,1);
        p.duration=p.life=rand(...k.life);p.mesh.rotation.set(0,Math.random()*6.28,0);}
      return;
    }
    for(const p of bitPool){if(count<=0)break;if(p.life>0)continue;count--;
      const m=p.mesh;m.geometry=unit;m.material=k.glow&&color==='ember'?sparkMaterial:bitMaterials[color]||emberMaterial;m.position.copy(position);m.visible=true;
      m.scale.set(k.size[0],k.size[1],k.size[2]).multiplyScalar(color==='blood'?rand(.8,1.6):1);
      // Out along the surface normal (or the blow), fanned out, with an upward kick.
      tmpDir.set(rand(-1,1),rand(-.2,1),rand(-1,1)).normalize().multiplyScalar(.75).add(direction).normalize();
      p.velocity.copy(tmpDir).multiplyScalar(rand(...k.speed));p.velocity.y+=k.up*rand(.3,1);
      const spin=k.spin||10;p.spin.set(rand(-spin,spin),rand(-spin,spin),rand(-spin,spin));
      if(k.stretch)m.lookAt(m.position.clone().add(p.velocity));else m.rotation.set(Math.random()*6.28,Math.random()*6.28,Math.random()*6.28);
      p.kind=k;p.size=m.scale.x;p.life=p.duration=rand(...k.life);p.resting=0;p.bounced=false;p.heavy=k.gravity>0;bits.push(p);
    }
  }
  /** A blot of blood on the ground; `size` is roughly its width in metres. */
  function groundStain(position,size=.55){blood.pool(position.x,position.z,size*size*55,Math.min(9,Math.max(2,size*5)));}
  /** What a blow would hit (skin, cloth, leather, mail, plate): nothing is painted. */
  function probe(enemy,from,info){return blood.strike(enemy,from,{...info,dry:true});}
  /** A blow on a corpse: it is cut, and bleeds from the new wound. */
  function corpseHit(enemy,from,combo=0,point=null){const r=blood.strike(enemy,from,{kind:'sword',combo,amount:30,point});if(r&&!r.armoured)blade.add(.18);return r;}
  /** An old wound on an enemy that was saved hurt: the cut is drawn, nothing sprays. */
  function wound(enemy,from){blood.strike(enemy,from,{kind:'sword',combo:0,amount:12,quiet:true});}
  // The player's own body takes cuts the same way (visible in third person); main.js hands over the actor.
  let playerActor=null;
  function setPlayer(actor){playerActor=actor;}
  /** An enemy's blade or arrow lands on the player from `from`. */
  function hurtPlayer(from,{kind='sword',amount=14}={}){
    if(!playerActor?.model){return null;}
    const result=blood.strike(playerActor,from,{kind,combo:(Math.random()*3)|0,amount});
    if(result?.armoured)sound('parry');
    return result;
  }
  /** The actor has fallen: a pool under the body, wounds bleed on by region. Safe to call twice. */
  function killed(enemy,quiet=false){if(enemy.bloodKilled)return;enemy.bloodKilled=true;blood.killed(enemy,quiet);}
  function damageNumber(position,amount,kind){
    const node=document.createElement('span');node.className='damage-number '+kind;node.textContent=String(Math.round(amount));document.getElementById('combat-feedback').append(node);
    numbers.push({node,position:position.clone(),life:1.1});
    if(numbers.length>18)numbers.shift().node.remove();
  }
  // info: { kind: 'sword' | 'arrow' | 'magic', combo }. The blow is raycast onto the body: what it hits (skin,
  // cloth, leather, mail, plate; head, neck, limb) decides the wound, the spray, the sound and how it bleeds.
  function hit(enemy,from,amount,magic,info={}){
    const point=enemy.model.position.clone().add(new THREE.Vector3(0,enemy.aim??(enemy.kind==='wolf'?.9:1.6),0));
    const direction=point.clone().sub(from).normalize();
    let result=null;
    if(magic)blood.spurt(point,direction,6,{speed:1.8});
    else result=blood.strike(enemy,from,{kind:info.kind||'sword',combo:info.combo??0,amount,point:info.point,armored:info.armored});
    if(enemy.hp<=0)killed(enemy);
    damageNumber(point,amount,enemy.hp<=0?'fatal':'');hitTime=.17;shake=.035;
    if(result&&!result.armoured)blade.add(.22+(result.region?.severity||1)*.1);
    if(!magic)sound(result?.armoured?'parry':'impact');
    document.getElementById('hit-marker').classList.toggle('fatal',enemy.hp<=0);
    return result;
  }
  function burnDamage(enemy,amount){
    const point=enemy.model.position.clone();point.y+=enemy.kind==='wolf'?.9:1.6;
    damageNumber(point,amount,enemy.dead?'fatal':'');
  }
  // Slash ribbons borrow a material from a fixed pool. Cloning one per swing and disposing it afterwards
  // made three.js compile a shader and throw it away again on every blow (an 80-120 ms hitch each time).
  const slashPool=Array.from({length:6},()=>{const m=pixelMaterial('iron',{tint:0xe5d3ad,emissive:.3}).clone();m.transparent=true;m.opacity=0;m.depthWrite=false;return m;});
  function slash(position,yaw,combo){
    const material=slashPool.find(m=>!m.userData.busy)||slashPool[0];material.userData.busy=true;material.opacity=.5;
    const m=new THREE.Group();
    const snap=v=>Math.round(v/texel)*texel,sign=combo%2?-1:1;
    let previous=null;
    for(let i=0;i<=12;i++){
      const angle=-1.05+i/12*1.9;
      const point=new THREE.Vector3(snap(Math.sin(angle)*2.24),snap(.2*Math.sin(angle)*sign),snap(-Math.cos(angle)*2.24));
      if(previous){
        // Two axis-aligned boxes per step make a continuous staircase ribbon.
        block(m,Math.abs(point.x-previous.x)+texel,texel,texel,material,(point.x+previous.x)/2,previous.y,previous.z);
        block(m,texel,Math.abs(point.y-previous.y)+texel,Math.abs(point.z-previous.z)+texel,material,point.x,(point.y+previous.y)/2,(point.z+previous.z)/2);
      }
      previous=point;
    }
    m.position.copy(position).y+=1.65;m.rotation.y=yaw;
    if(combo===2)m.rotation.z=Math.PI/2;
    scene.add(m);arcs.push({mesh:m,material,life:.13});
  }
  function update(dt,camera){
    blood.update(dt,camera);blade.update(dt);
    hitTime=Math.max(0,hitTime-dt);shake*=Math.exp(-dt*18);
    document.getElementById('hit-marker').classList.toggle('hidden',hitTime<=0);
    for(let i=bits.length-1;i>=0;i--){const p=bits[i],k=p.kind||KINDS.blood;p.life-=dt;
      if(p.resting>0){p.resting-=dt;p.mesh.scale.multiplyScalar(p.resting<.2?Math.max(.6,1-dt*4):1);if(p.resting<=0)p.life=0;}
      else{p.velocity.y-=dt*k.gravity;p.velocity.multiplyScalar(Math.exp(-dt*(k.stretch?1.5:.4)));p.mesh.position.addScaledVector(p.velocity,dt);
        if(k.stretch)p.mesh.lookAt(tmpDir.copy(p.mesh.position).add(p.velocity));else{p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.rotation.z+=p.spin.z*dt;}
        const ground=world.heightAt(p.mesh.position.x,p.mesh.position.z)+texel*.5;
        if(p.mesh.position.y<ground){p.mesh.position.y=ground;
          if(k.bounce&&!p.bounced&&p.velocity.y<-1){p.bounced=true;p.velocity.y*=-k.bounce;p.velocity.x*=.5;p.velocity.z*=.5;}
          else if(k.rest&&p.life>0){p.resting=k.rest*rand(.7,1.3);p.mesh.rotation.x=Math.round(p.mesh.rotation.x/1.5708)*1.5708;p.mesh.rotation.z=Math.round(p.mesh.rotation.z/1.5708)*1.5708;}
          else p.life=0;}
        if(k.stretch)p.mesh.scale.z=p.size*3*Math.max(.3,p.life/p.duration);}
      if(p.life<=0){p.mesh.visible=false;p.mesh.scale.setScalar(1);bits.splice(i,1);}}
    for(const p of puffs)if(p.life>0){p.life-=dt;const f=Math.max(0,p.life/p.duration);p.velocity.multiplyScalar(Math.exp(-dt*2.5));p.velocity.y+=dt*.25;
      p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.scale.setScalar(p.size*(1+(1-f)*1.6));p.material.opacity=.55*f;if(p.life<=0)p.mesh.visible=false;}
    for(let i=arcs.length-1;i>=0;i--){const a=arcs[i];a.life-=dt;const fade=Math.max(0,a.life/.13);a.material.opacity=fade*fade*.5;if(a.life<=0){a.mesh.removeFromParent();a.material.userData.busy=false;arcs.splice(i,1);}}
    for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.life-=dt;const p=projected.copy(n.position);p.y+=(1.1-n.life)*.8;p.project(camera);
      n.node.style.transform=`translate(-50%,-50%) translate(${(p.x*.5+.5)*innerWidth}px,${(-p.y*.5+.5)*innerHeight}px)`;n.node.style.opacity=String(Math.min(1,n.life*3));n.node.hidden=p.z>1||p.z< -1;
      if(n.life<=0){n.node.remove();numbers.splice(i,1);}}
  }
  function reset(){
    for(const p of bits){p.mesh.visible=false;p.life=0;p.mesh.scale.setScalar(1);}bits.length=0;for(const p of puffs){p.life=0;p.mesh.visible=false;}
    blood.reset();blade.reset();
    for(const n of numbers)n.node.remove();numbers.length=0;
    // Arc boxes use the shared geometry cache; the pooled materials stay alive so their program does too.
    for(const a of arcs){a.mesh.removeFromParent();a.material.userData.busy=false;}arcs.length=0;hitTime=0;shake=0;
  }
  // Shows every pooled material for one shader-compile pass (graphics.compile) so the first blow, spark or
  // pool never compiles a shader mid-fight; call warm(false) right after.
  const warmMeshes=[...new Set([...Object.values(bitMaterials),sparkMaterial,...slashPool])].map(material=>{const m=new THREE.Mesh(unit,material);m.visible=false;m.frustumCulled=false;scene.add(m);return m;});
  function warm(on){for(const m of warmMeshes)m.visible=on;for(const p of puffs)p.mesh.visible=on;blood.warm(on);}
  return {hit,probe,corpseHit,blade,wound,killed,hurtPlayer,setPlayer,spray,groundStain,slash,sound,burnDamage,update,reset,warm,blood,
    get shake(){return shake;},state:()=>({wounds:blood.state().wounds,bloodStains:blood.state().tiles,particles:bits.length,blood:blood.state()})};
}
