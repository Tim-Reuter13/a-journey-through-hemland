import * as THREE from 'three';
import { createCombatEffects } from './combatEffects.js';
import { ACTIONS,crossedImpact,inAttackArc } from './combatRules.js';
import { createSpellFx,traceSpellSurface } from './spellFx.js';
import { createNavGrid,PENDING } from './navGrid.js';
import { createArchery, BOW } from './archery.js';
import { reflex, onEvent } from './ai/brain.js';
import { AI } from './ai/config.js';

/** How long an enemy archer takes to draw and aim before the arrow leaves (also the draw animation). */
export const ARCHER_DRAW=1.1;

/** onImpact(point, direction, radius): optional synchronous physics impulse hook (radius 2.5).
 * getCastOrigin(out): optional hand world position; return out. Both vectors are borrowed.
 * prey: optional { targets(radius), hit(animal, amount, magic) } — game animals that can be struck but do not fight.
 * bow: optional { ammo, damage(power), aim(origin, direction), arrowModel() } for the hunting bow (systems/archery.js).
 * ai: optional HUMANITY AI manager (systems/ai/manager.js). Enemies with a brain (enemy.ai) are driven by
 * its intents; the rest keep the simple tactics below. Combat tells it about noise, wounds, arrows and fire. */
export function createCombat({scene,camera,player,enemies,world,onHit,onHurt,onHeal,weaponDamage,magicDamage,toast,onImpact,getCastOrigin,prey,bow,ai=null,motion=null}) {
  // motion (HUMANITY MOTION): impact(enemy, info) for forces on bodies, playerHit(enemy, info), grapple(enemy, 'grab'|'shove'), handles(enemy).
  let strikeKind=null;
  const effects=createCombatEffects(scene,world),projectiles=[];
  const spellFx=createSpellFx(scene,world,{onImpact,sound:effects.sound,onBurnDamage(enemy,amount){
    onHit(enemy,amount,true);effects.burnDamage(enemy,amount);
    if(enemy.dead){enemy.deathTime=0;enemy.model.visible=true;effects.groundStain(enemy.model.position,1.1);}
  }});
  let action=null,guard=false,guardStart=0,time=0,combo=0,lastAttack=-10,queued=false,hitPause=0;
  const before=new THREE.Vector3(),next=new THREE.Vector3(),center=new THREE.Vector3(),segment=new THREE.Vector3(),offset=new THREE.Vector3();
  const hand=new THREE.Vector3(),surface={point:new THREE.Vector3(),normal:new THREE.Vector3()},normal=new THREE.Vector3();
  const propRay=new THREE.Raycaster(),propHits=[];
  const vector=(x,y,z)=>new THREE.Vector3(x,y,z);
  const eye=()=>player.position.clone().add(vector(0,2.05,0));
  // Aim height and hit radius: animals carry their own, wolves are low, people are tall.
  const aimY=e=>e.aim??(e.kind==='wolf'?.9:1.6),reachR=e=>e.radius??(e.kind==='wolf'?.7:.75);
  const targets=()=>prey?[...enemies,...prey.targets()]:enemies;
  function strike(target,amount,magic,from){
    if(!target.prey){hit(target,amount,magic,from);return;}
    prey.hit(target,amount,magic);effects.hit(target,from,amount,magic);hitPause=.04;
  }
  const archery=bow?createArchery({scene,world,player,toast,sound:effects.sound,spray:effects.spray,ammo:bow.ammo,damage:bow.damage,aim:bow.aim,arrowModel:bow.arrowModel,drawTime:bow.drawTime,steady:bow.steady,scored:bow.scored,
    targets:()=>prey?[...enemies,...prey.targets(100)]:enemies,strike:(target,amount,from)=>{strikeKind='arrow';strike(target,amount,false,from);strikeKind=null;},
    nearMiss:(e,point,dir)=>ai?.nearMiss(e,point,dir),noise:(kind,point,opts)=>ai?.noise(kind,point,opts),
    shielded:e=>{if(e.ai){e.ai.emotion.confidence=Math.min(1,e.ai.emotion.confidence+.04);ai?.say(e.ai,'taunt',10);}},
    alert:e=>{e.engaged=true;e.alertUntil=time+12;},
    // An enemy's arrow: a raised guard turns it aside if it comes from the front.
    hurtPlayer:(amount,from)=>{
      const dx=from.x-player.position.x,dz=from.z-player.position.z;
      if(guard&&inAttackArc(dx,dz,player.yaw,999,.3)&&player.stamina>=8){player.stamina-=8;effects.sound('parry');effects.spray(eye().add(vector(0,-.3,0)),vector(0,1,0),'ember',8);onHurt(Math.round(amount*.15));return;}
      onHurt(amount);effects.sound('arrowFlesh');effects.spray(player.position.clone().add(vector(0,1.5,0)),vector(-dx,0,-dz).normalize(),'blood',12);
    }}):null;
  // Enemy archers loose at the wanderer's chest, leading a moving target and allowing for the drop;
  // they miss more the further they shoot, and not at all through walls.
  function shootArrow(e){
    const p=e.model.position,origin=p.clone().add(vector(0,1.6*(e.model.scale?.y||1),0)),target=player.position.clone().add(vector(0,1.4,0));
    if(!archery||world.segmentBlocked(origin,target))return;
    const speed=46,range=origin.distanceTo(target);
    if(player.velocity)target.addScaledVector(player.velocity,range/speed*.8);
    const spread=.25+range*.018;
    target.x+=(Math.random()-.5)*spread;target.y+=(Math.random()-.5)*spread*.6;target.z+=(Math.random()-.5)*spread;
    const d=target.sub(origin),t=Math.max(.01,Math.hypot(d.x,d.z)/speed),v=vector(d.x/t,d.y/t+.5*BOW.gravity*t,d.z/t);
    origin.addScaledVector(v.clone().normalize(),.4-BOW.length);
    archery.launch(origin,v,{damage:e.storyId?20:14});
  }
  // Archers keep their distance (backing off when pressed), circle, and draw when they can see you.
  function archerThink(e,dt,distance,dx,dz){
    const p=e.model.position,nx=dx/Math.max(.001,distance),nz=dz/Math.max(.001,distance);
    e.orbit??=(Math.random()<.5?-1:1);
    let mx,mz,speed=2.4;
    if(distance<7){mx=-nx;mz=-nz;speed=3.2;}
    else{const radial=(distance-12)*.5;mx=nx*radial-nz*e.orbit*.7;mz=nz*radial+nx*e.orbit*.7;if(Math.random()<dt*.3)e.orbit*=-1;}
    if(e.cooldown<=0&&distance>4&&distance<34&&!world.segmentBlocked(p.clone().add(vector(0,1.6,0)),eye())){e.windup=ARCHER_DRAW;return;}
    const len=Math.hypot(mx,mz);if(len>.01){const k=Math.min(1,len)*speed/len;moveEnemy(e,mx*k*dt,mz*k*dt);}
  }
  function begin(kind){
    const spec=ACTIONS[kind];
    if(action){if(kind==='sword'&&action.kind==='sword'&&action.t>.38)queued=true;return false;}
    if(player.stamina<spec.cost){toast('ZU WENIG AUSDAUER',1300);return false;}
    player.stamina-=spec.cost;guard=false;
    combo=time-lastAttack<1.15?(combo+1)%3:0;lastAttack=time;
    action={kind,t:0,duration:spec.duration,combo,progress:0};player.attack=spec.duration;
    effects.sound(kind==='sword'?'swing':kind==='cast'?'cast':'drink');
    if(kind!=='drink')ai?.noise(kind==='sword'?'swing':'spell',player.position,{source:'player'});return true;
  }
  function attack(){if(player.tool===3)return !action&&!!archery?.draw();if(player.tool===2)return drink();return begin(player.tool===1?'cast':'sword');}
  function drink(){if(player.potions<1){toast('KEINE HEILTRÄNKE');return false;}if(player.hp>=player.maxHp){toast('LEBEN BEREITS VOLLSTÄNDIG');return false;}return begin('drink');}
  function setGuard(value){if(value&&!guard)guardStart=time;guard=!!value&&!action&&player.tool===0&&player.stamina>2;}
  function hit(enemy,amount,magic,from=eye()){
    if(enemy.dead)return;
    // A raised shield turns blows from the front (the shield bearer's stamina pays for it).
    // A raised shield turns blows from the front (about ±70°), paid in stamina. The heavy third blow, or a
    // blow on an exhausted arm, breaks the guard: the shield is flung aside and the body is open.
    if(!magic&&enemy.ai?.personality.shield&&enemy.shieldUp&&(enemy.shieldRaise??1)>.6&&!(enemy.guardBroken>0)&&!enemy.ai.disarmed&&inAttackArc(player.position.x-enemy.model.position.x,player.position.z-enemy.model.position.z,enemy.model.rotation.y,9,.35)){
      const heavy=strikeKind!=='arrow'&&combo===2;
      if(heavy||enemy.ai.stamina<10){enemy.guardBroken=1.3;enemy.shieldUp=false;enemy.stagger=.55;enemy.ai.stamina=Math.max(0,enemy.ai.stamina-10);effects.sound('parry');
        effects.spray(enemy.model.position.clone().add(vector(0,1.4,0)),vector(0,1,0),'splinter',12);hitPause=.06;toast('DECKUNG DURCHBROCHEN',1100);
        motion?.impact(enemy,{shield:true,force:2.4,from});motion?.impact(enemy,{kind:'sword',from,combo:1,amount:0});ai?.noise('fight',enemy.model.position);return;}
      enemy.ai.stamina-=strikeKind==='arrow'?2:9;effects.sound('arrowWood');effects.spray(enemy.model.position.clone().add(vector(0,1.5,0)),vector(0,1,0),'splinter',8);hitPause=.03;ai?.noise('fight',enemy.model.position);
      motion?.impact(enemy,{shield:true,force:strikeKind==='arrow'?.35:combo===2?1.4:.8,from});return;}
    if(!magic&&enemy.blocking>0){enemy.blocking=0;enemy.stagger=.25;effects.sound('parry');effects.spray(enemy.model.position.clone().add(vector(0,1.5,0)),vector(0,1,0),'ember',10);amount*=.2;hitPause=.03;
      if(amount<4){onHit(enemy,amount,magic);return;}}
    ai?.hurt(enemy,amount,from);ai?.noise('fight',enemy.model.position);
    onHit(enemy,amount,magic);effects.hit(enemy,from,amount,magic);enemy.stagger=magic?.32:.43;enemy.windup=0;
    // Bodies with HUMANITY MOTION take the force themselves (steps, falls); the rest slide back.
    if(motion?.handles?.(enemy))motion.impact(enemy,{kind:strikeKind||(magic?'spell':'sword'),from,combo,amount,magic});
    else enemy.knock=enemy.model.position.clone().sub(player.position).setY(0).normalize().multiplyScalar(combo===2?3.2:1.8);
    hitPause=.055;
    if(enemy.dead){enemy.deathTime=0;enemy.model.visible=true;effects.groundStain(enemy.model.position,1.1);}
  }
  function resolveSword(){
    effects.slash(player.position,player.yaw,combo);
    let target=null,nearest=3.2;
    for(const e of targets()){if(e.dead)continue;const p=e.model.position;
      if(Math.abs(p.y-player.position.y)>2.4||!inAttackArc(p.x-player.position.x,p.z-player.position.z,player.yaw))continue;
      if(world.segmentBlocked(eye(),p.clone().add(vector(0,aimY(e),0))))continue;
      const d=p.distanceTo(player.position);if(d<nearest){target=e;nearest=d;}}
    if(target)strike(target,weaponDamage()*(combo===2?1.18:1),false,eye());
  }
  function launchSpell(){
    const origin=castOrigin(hand),direction=vector(-Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch));
    let candidate=null,best=21;
    for(const e of targets()){if(e.dead)continue;const d=e.model.position.distanceTo(player.position);
      if(d<best&&inAttackArc(e.model.position.x-player.position.x,e.model.position.z-player.position.z,player.yaw,22,.975)){candidate=e;best=d;}}
    if(candidate)direction.copy(candidate.model.position).add(vector(0,aimY(candidate),0)).sub(origin).normalize();
    // An outstretched hand must not spawn the projectile through a nearby wall.
    before.copy(player.position);before.y+=2.05;
    const contact=traceSpellSurface(world,before,origin,surface);
    if(contact){spellFx.impact(contact.point,direction,contact.normal);spellFx.setCharge(hand,null,0);return;}
    const ball=spellFx.startBall(origin);if(ball)projectiles.push({ball,root:ball.root,direction,life:1.35});
    spellFx.setCharge(hand,null,0);
  }
  function castOrigin(out){
    if(getCastOrigin)return getCastOrigin(out)||out;
    // Left palm, following the same forward/left basis in both camera modes.
    return out.copy(player.position).add(offset.set(-Math.cos(player.yaw)*.34-Math.sin(player.yaw)*.7,
      1.73+Math.sin(player.pitch)*.7,Math.sin(player.yaw)*.34-Math.cos(player.yaw)*.7));
  }
  function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];
      before.copy(p.root.position);const step=Math.min(dt,p.life);p.life-=dt;next.copy(before).addScaledVector(p.direction,step*24);
      segment.subVectors(next,before);const length=segment.length(),lengthSq=length*length;
      const contact=traceSpellSurface(world,before,next,surface);let fraction=contact?contact.t:Infinity,target=null,object=null;
      normal.copy(contact?contact.normal:p.direction).multiplyScalar(contact?1:-1);
      // Loose props are not in the static navigation world. Raycast only that small list.
      if(length>0&&world.loose?.length){
        propRay.set(before,p.direction);propRay.far=Math.min(length,length*fraction);propHits.length=0;
        propRay.intersectObjects(world.loose,true,propHits);
        let prop=null;
        for(const h of propHits)if(h.face&&h.object.visible&&h.object.name!=='Charred pixel scorch'){prop=h;break;}
        if(prop&&prop.distance/length<fraction){fraction=prop.distance/length;object=prop.object;
          normal.copy(prop.face.normal).transformDirection(prop.object.matrixWorld);if(normal.dot(p.direction)>0)normal.negate();}
      }
      for(const e of targets()){if(e.dead||!lengthSq)continue;
        center.copy(e.model.position);center.y+=e.aim??(e.kind==='wolf'?.9:1.5);offset.subVectors(before,center);
        const radius=reachR(e),b=offset.dot(segment),c=offset.lengthSq()-radius*radius,disc=b*b-lengthSq*c;
        if(disc<0)continue;
        const t=c<=0?0:(-b-Math.sqrt(disc))/lengthSq;
        if(t>=0&&t<=1&&t<fraction){fraction=t;target=e;object=null;normal.copy(p.direction).negate();}
      }
      if(fraction<=1){
        p.root.position.copy(before).addScaledVector(segment,fraction);
        if(target){const damage=magicDamage();strike(target,damage,true,before);if(!target.prey)spellFx.ignite(target,Math.max(4,Math.round(damage*.3/4)*4));}
        else if(contact&&!object)p.root.position.copy(contact.point);
        spellFx.impact(p.root.position,p.direction,normal,{enemy:!!target,object});
        ai?.fireAt(p.root.position,2.6);ai?.noise('fireImpact',p.root.position,{source:'player'});
        spellFx.releaseBall(p.ball);projectiles.splice(i,1);
      }else if(p.life<=0){spellFx.releaseBall(p.ball);projectiles.splice(i,1);}
      else {p.root.position.copy(next);spellFx.updateBall(p.ball,dt);}
    }
  }
  function moveEnemy(e,dx,dz){const p=e.model.position;
    // Inside a crate or a tent (a spawn or a schedule spot put them there): walk out to the nearest free spot.
    if(world.blocked(p.x,p.z,.45,p.y)){const out=reachable(p,p.y);if(out!==p){const ox=out.x-p.x,oz=out.z-p.z,od=Math.hypot(ox,oz)||1,step=Math.min(od,Math.max(.04,Math.hypot(dx,dz)));
      p.x+=ox/od*step;p.z+=oz/od*step;p.y=Math.max(world.heightAt(p.x,p.z),world.supportAt?world.supportAt(p.x,p.z,.3,p.y):-Infinity);return;}}
    // Blocked straight ahead (a tent, a wall, a cart): try veering left and right before giving up.
    if(world.blocked(p.x+dx,p.z+dz,.45,p.y)){
      for(const a of [.6,-.6,1.2,-1.2,1.9,-1.9]){const c=Math.cos(a),s=Math.sin(a),rx=dx*c-dz*s,rz=dx*s+dz*c;
        if(!world.blocked(p.x+rx,p.z+rz,.45,p.y)){dx=rx;dz=rz;break;}}
    }
    if(!world.blocked(p.x+dx,p.z,.45,p.y))p.x+=dx;
    if(!world.blocked(p.x,p.z+dz,.45,p.y))p.z+=dz;
    // The same ground rule as the wanderer: terrain, floors and anything solid a step above the feet.
    p.y=Math.max(world.heightAt(p.x,p.z),world.supportAt?world.supportAt(p.x,p.z,.3,p.y):-Infinity);
  }
  // Cut off by tents, crates or a fence: walk a grid path round them instead of pressing on
  // (systems/navGrid.js, searched within a small per-frame budget).
  const nav=createNavGrid({blocked:world.navBlocked||((x,z,r,y)=>world.blocked(x,z,r,y)),heightAt:world.heightAt,radius:.45});
  let navUntil=0;
  const free=(p,x,z,d)=>!world.blocked(p.x+x*d,p.z+z*d,.45,p.y);
  // A clear straight line (sampled every 0.5 m up to the goal or 7 m) needs no path.
  function lineFree(p,goal){const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.min(7,Math.hypot(dx,dz));if(d<.05)return true;
    for(let k=.5;k<=d;k+=.5)if(world.blocked(p.x+dx/Math.hypot(dx,dz)*k,p.z+dz/Math.hypot(dx,dz)*k,.42,p.y))return false;return true;}
  // A goal inside a crate, a tent or a wall becomes the nearest free spot beside it.
  const freeGoal=new THREE.Vector3();
  function reachable(goal,y){
    if(!world.blocked(goal.x,goal.z,.45,y))return goal;
    for(let r=.6;r<=3;r+=.6)for(let k=0;k<10;k++){const a=k/10*Math.PI*2,x=goal.x+Math.cos(a)*r,z=goal.z+Math.sin(a)*r;if(!world.blocked(x,z,.45,y))return freeGoal.set(x,goal.y,z);}
    return goal;
  }
  function detour(e,dt,nx,nz,goal=player.position){
    const p=e.model.position;e.pathAge=(e.pathAge??9)+dt;
    if(lineFree(p,goal)&&!e.stuck){e.path=null;return null;}
    if(!e.path||e.pathAge>1.5||e.pathGoal?.distanceToSquared(goal)>4){const found=nav.find(p,goal,{until:navUntil});e.pathGoal=(e.pathGoal??new THREE.Vector3()).copy(goal);
      if(found!==PENDING){e.path=found?.length?found:null;e.pathAge=0;}}
    if(!e.path)return null;
    let q=e.path[0];while(q&&Math.hypot(q.x-p.x,q.z-p.z)<.45){e.path.shift();q=e.path[0];}
    // String pulling: head for the farthest waypoint in plain sight, not zig-zag along grid cells.
    while(e.path.length>1&&lineFree(p,e.path[1])){e.path.shift();q=e.path[0];}
    if(!q){e.path=null;return null;}
    const d=Math.hypot(q.x-p.x,q.z-p.z)||1;return [(q.x-p.x)/d,(q.z-p.z)/d];
  }
  // Enemy tactics. Bandits keep fighting distance and circle; one at a time steps in to strike
  // (sometimes twice), then backs off. They block or sidestep when you swing, and run when nearly
  // dead (not the captain). Wolves circle wide, work round to your back, dart in and out.
  const TACTICS={bandit:{ring:3.4,speed:2.6,circle:1.5,reach:2.9,windup:.62,damage:16,block:.32,dodge:.18},
    wolf:{ring:5.2,speed:4.1,circle:2.8,reach:2.4,windup:.42,damage:10,block:0,dodge:.38}};
  function think(e,dt,distance,dx,dz,attackers){
    if(e.archer)return archerThink(e,dt,distance,dx,dz);
    const t=TACTICS[e.kind]||TACTICS.bandit,captain=!!e.storyId,p=e.model.position;
    e.plan??='circle';e.orbit??=(Math.random()<.5?-1:1);e.planTime=(e.planTime??1)-dt;
    const nx=dx/Math.max(.001,distance),nz=dz/Math.max(.001,distance);
    // React to the wanderer's swing: block (bandits) or jump aside / back (everyone, by chance).
    if(action?.kind==='sword'&&action.t<.12&&!e.reacted&&distance<t.reach+.8){e.reacted=true;
      const roll=Math.random();
      if(roll<t.block+(captain?.2:0)){e.blocking=.55;e.plan='hold';e.planTime=.5;}
      else if(roll<t.block+t.dodge){e.plan='dodge';e.planTime=.35;e.dodgeDir=Math.random()<.5?-1:1;}
    }
    if(!action)e.reacted=false;
    e.blocking=Math.max(0,(e.blocking||0)-dt);
    if(e.kind==='bandit'&&!captain&&e.hp<e.maxHp*.22&&e.plan!=='flee'){e.plan='flee';e.planTime=4+Math.random()*3;}
    let mx=0,mz=0,speed=t.speed;
    switch(e.plan){
      case 'flee':mx=-nx;mz=-nz;speed*=1.25;if(e.planTime<=0){e.plan='circle';e.hp=Math.min(e.maxHp,e.hp+8);}break;
      case 'dodge':mx=-nz*e.dodgeDir-nx*.6;mz=nx*e.dodgeDir-nz*.6;speed*=2.2;if(e.planTime<=0)e.plan='circle';break;
      case 'hold':if(e.planTime<=0)e.plan='circle';break;
      case 'retreat':mx=-nx;mz=-nz;speed*=1.1;if(e.planTime<=0||distance>t.ring)e.plan='circle';break;
      case 'approach':case 'attack':
        // Step in until in reach, then wind up.
        if(distance>t.reach-.3){mx=nx;mz=nz;speed*=e.kind==='wolf'?1.6:1.15;}
        else if(e.cooldown<=0){e.windup=t.windup*(.85+Math.random()*.3);e.plan='strike';}
        // Gave up reaching the wanderer: hand the attack on and wait a moment before trying again.
        if(e.planTime<=0&&e.plan==='approach'){e.plan='circle';e.planTime=.8+Math.random()*1.2;}
        break;
      // A strike interrupted by a hit (windup cleared) must not leave the enemy frozen.
      case 'strike':if(!(e.windup>0)){e.plan='retreat';e.planTime=.6;}break;
      default:{
        // Circle at the ring, drifting in or out to hold it; wolves try to get behind you.
        const ring=t.ring+(e.kind==='wolf'?Math.sin(time*.7+(e.seed??=Math.random()*9))*.8:0);
        const radial=(distance-ring)*.9;
        mx=nx*radial-nz*e.orbit*t.circle;mz=nz*radial+nx*e.orbit*t.circle;
        if(e.kind==='wolf'){const behind=Math.sin(player.yaw)*nx+Math.cos(player.yaw)*nz;if(behind>-.2&&Math.random()<dt*.6)e.orbit*=-1;}
        else if(Math.random()<dt*.35)e.orbit*=-1;
        if(e.planTime<=0&&e.cooldown<=0&&distance<t.ring+3&&attackers.count<attackers.max){e.plan='approach';e.planTime=2.4;attackers.count++;}
        if(e.planTime<=0)e.planTime=.6+Math.random()*1.4;
      }
    }
    if((e.plan==='approach'||e.plan==='circle')&&mx*nx+mz*nz>0&&distance>1.5){
      const way=detour(e,dt,nx,nz);if(way){const k=Math.max(1,Math.hypot(mx,mz));mx=way[0]*k;mz=way[1]*k;}}
    const len=Math.hypot(mx,mz);
    if(len>.01){
      let sx=0,sz=0;for(const other of enemies){if(other===e||other.dead)continue;const ox=p.x-other.model.position.x,oz=p.z-other.model.position.z,d=Math.hypot(ox,oz);if(d>0&&d<1.4){sx+=ox/d*(1.4-d);sz+=oz/d*(1.4-d);}}
      const k=Math.min(1,len)*speed/len;moveEnemy(e,(mx*k+sx)*dt,(mz*k+sz)*dt);
    }
  }
  // ── HUMANITY AI execution (layer F): the brain says where to go, what to face, when to strike or
  // guard; here that becomes movement round obstacles, turning at a human rate, reflexes with a
  // reaction time, blocks and dodges that cost stamina, and blows that only land in reach and in sight.
  const turnToward=(e,x,z,dt,rate=5)=>{if(Math.abs(x)+Math.abs(z)<1e-4)return;const turn=THREE.MathUtils.euclideanModulo(Math.atan2(-x,-z)-e.model.rotation.y+Math.PI,Math.PI*2)-Math.PI,k=dt*rate;e.model.rotation.y+=THREE.MathUtils.clamp(turn,-k,k);};
  function strikeLands(e,distance,dx,dz){
    const b=e.ai,prof=b.personality,p=e.model.position;e.strikeT=e.kind==='wolf'?.3:.4;
    const visible=!world.segmentBlocked(p.clone().add(vector(0,1.5,0)),eye());
    if(distance<prof.reach&&visible){
      const facing=inAttackArc(p.x-player.position.x,p.z-player.position.z,player.yaw,4,.25);
      if(guard&&facing&&player.stamina>=12){player.stamina-=12;onEvent(b,'blocked',{},time);
        if(time-guardStart<.24){e.stagger=1;toast('PARIERT',1000);effects.sound('parry');motion?.impact(e,{kind:'parried',from:player.position.clone(),combo:2,amount:0});}
        else {onHurt(3);effects.sound('parry');}
        effects.spray(eye().add(vector(0,-.3,0)),vector(0,1,0),'ember',13);
        motion?.playerHit?.(e,{blocked:true});
      }else{onHurt(prof.damage*(e.storyId?1.3:1));onEvent(b,'hitPlayer',{},time);effects.sound('impact');effects.spray(player.position.clone().add(vector(0,1.5,0)),vector(dx,0,dz).normalize().negate(),'blood',16);
        motion?.playerHit?.(e,{damage:prof.damage*(e.storyId?1.3:1),heavy:!!e.storyId});}
      ai?.noise('fight',p);
    }
    // A skilled fighter sometimes follows up at once; then they step back and wait for the next chance.
    if(Math.random()<prof.skill*.45&&!e.combo&&b.stamina>20){e.combo=true;e.windup=.42;b.stamina-=8;}
    else{e.combo=false;e.cooldown=(e.kind==='wolf'?1.3:1.5)+Math.random()*1.1-prof.skill*.4;}
  }
  // Hedge-witch magic: fire bolts that fly as real projectiles (walls stop them, the wanderer can step
  // aside or raise a guard), and healing for a friend.
  const bolts=[];
  function castBolt(e){
    const p=e.model.position,origin=p.clone().add(vector(0,1.7,0)).addScaledVector(vector(-Math.sin(e.model.rotation.y),0,-Math.cos(e.model.rotation.y)),.6);
    const target=player.position.clone().add(vector(0,1.3,0)),range=origin.distanceTo(target);
    if(player.velocity)target.addScaledVector(player.velocity,range/AI.magic.boltSpeed*.6);
    target.x+=(Math.random()-.5)*range*.04;target.z+=(Math.random()-.5)*range*.04;
    const ball=spellFx.startBall(origin);if(!ball)return;
    bolts.push({ball,dir:target.sub(origin).normalize(),life:3});effects.sound('cast');ai?.noise('spell',p);
  }
  function healAlly(e){
    const b=e.ai,t=e.castTarget;e.castTarget=null;if(!t||t.npc.dead)return;
    t.npc.hp=Math.min(t.npc.maxHp,t.npc.hp+AI.magic.healAmount);b.mana-=AI.magic.heal;
    t.emotion.fear=Math.max(0,t.emotion.fear-.15);t.emotion.pain=Math.max(0,t.emotion.pain-.3);
    effects.spray(t.npc.model.position.clone().add(vector(0,1.4,0)),vector(0,1,0),'heal',16);
  }
  function updateBolts(dt){
    for(let i=bolts.length-1;i>=0;i--){const bolt=bolts[i],root=bolt.ball.root;bolt.life-=dt;
      before.copy(root.position);next.copy(before).addScaledVector(bolt.dir,AI.magic.boltSpeed*dt);
      const contact=traceSpellSurface(world,before,next,surface);
      center.copy(player.position);center.y+=1.3;
      const hitsPlayer=center.distanceTo(next)<.75||center.distanceTo(before.clone().lerp(next,.5))<.75;
      if(hitsPlayer){
        const facing=inAttackArc(root.position.x-player.position.x,root.position.z-player.position.z,player.yaw,99,.3);
        if(guard&&facing&&player.stamina>=10){player.stamina-=10;onHurt(3);effects.sound('parry');}else onHurt(AI.magic.boltDamage);
        spellFx.impact(next,bolt.dir,normal.copy(bolt.dir).negate());spellFx.releaseBall(bolt.ball);bolts.splice(i,1);continue;
      }
      if(contact||bolt.life<=0){if(contact){spellFx.impact(contact.point,bolt.dir,contact.normal);ai?.fireAt(contact.point,2.4);}spellFx.releaseBall(bolt.ball);bolts.splice(i,1);continue;}
      root.position.copy(next);spellFx.updateBall(bolt.ball,dt);
    }
  }
  function driveAI(e,dt,distance,dx,dz,attackers){
    const b=e.ai,it=b.intent,prof=b.personality,p=e.model.position;
    // Hands on the wanderer: a grip or a shove (HUMANITY MOTION executes it, or refuses it).
    if((it.grab||it.shove)&&motion?.grapple){motion.grapple(e,it.grab?'grab':'shove');it.grab=it.shove=false;}
    if(e.windup>0){
      e.windup-=dt;turnToward(e,dx,dz,dt,4);
      if(e.windup<=0){
        if(e.casting){const kind=e.casting;e.casting=null;e.castRelease=.5;
          if(kind==='heal')healAlly(e);else{castBolt(e);b.mana-=AI.magic.bolt;}e.cooldown=1.8+Math.random()*1.4-prof.skill*.5;}
        else if(e.archer&&!b.meleeMode){shootArrow(e);e.cooldown=2.4+Math.random()*1.6-prof.skill*.6;b.arrows=Math.max(0,b.arrows-1);}
        else strikeLands(e,distance,dx,dz);
      }
      return;
    }
    // Wolves that can see their prey hunt as a pack (circle, dart in); everything else follows the brain.
    if(e.kind==='wolf'&&b.hostility==='hostile'&&b.sees&&['engage','pressure','desperate'].includes(it.id)){think(e,dt,distance,dx,dz,attackers);return;}
    // Reflex against the wanderer's swing, after a reaction time (too late for the slow).
    if(action?.kind==='sword'&&action.t<.1&&e.reflexFor!==action&&distance<prof.reach+1.4&&b.sees){e.reflexFor=action;const r=reflex(b,distance);if(r)e.pendingReflex={...r,at:time+r.delay};}
    if(e.pendingReflex&&time>=e.pendingReflex.at){const r=e.pendingReflex;e.pendingReflex=null;
      if(r.kind==='block'){e.blocking=r.hold;b.stamina-=6;}else{e.dodge={until:time+r.hold,dir:Math.random()<.5?-1:1};b.stamina-=12;}}
    e.blocking=Math.max(0,(e.blocking||0)-dt);
    if(it.guard&&b.stamina>8&&distance<4.6&&!b.disarmed){e.blocking=Math.max(e.blocking,.12);b.stamina-=dt*3;}
    b.meleeMode=!!e.archer&&(b.arrows<=0||distance<2.6&&b.sees||!['shoot','kite','reposition'].includes(it.id)&&b.hostility==='hostile');
    let mx=0,mz=0,speed=it.speed;
    if(e.dodge){
      if(time<e.dodge.until){const nx=dx/(distance||1),nz=dz/(distance||1);mx=-nz*e.dodge.dir-nx*.5;mz=nx*e.dodge.dir-nz*.5;speed=4.8;}else e.dodge=null;
    }else if(it.goal){
      const goal=reachable(it.goal,p.y),gx=goal.x-p.x,gz=goal.z-p.z,gd=Math.hypot(gx,gz);
      // Close enough and the last step is blocked: arrived (no shuffling on the spot against a crate).
      const there=gd<=it.tolerance||gd<1.3&&world.blocked(p.x+gx/gd*.5,p.z+gz/gd*.5,.42,p.y)||e.giveUp>0;
      if(!there){mx=gx/gd;mz=gz/gd;const way=detour(e,dt,mx,mz,goal);if(way){mx=way[0];mz=way[1];}
        if(gd<1.5)speed*=Math.max(.3,gd/1.5);}
    }
    // Stuck: wanting to walk but not getting anywhere. Plan a path, step aside, and in the end give up the spot.
    e.giveUp=Math.max(0,(e.giveUp||0)-dt);
    if(Math.hypot(mx,mz)>.01&&!e.dodge){
      e.lastPos??=p.clone();const progress=e.lastPos.distanceTo(p);e.lastPos.copy(p);
      e.stuckT=progress<speed*dt*.25?(e.stuckT||0)+dt:Math.max(0,(e.stuckT||0)-dt*2);
      if(e.stuckT>.7){e.stuck=true;e.pathAge=9;const side=(e.ai?.orbit||1),ox=mx;mx+=-mz*side*1.2;mz+=ox*side*1.2;}
      if(e.stuckT>2.6){e.giveUp=3;e.stuckT=0;e.stuck=false;e.path=null;}
    }else{e.stuckT=0;e.stuck=false;e.lastPos?.copy(p);}
    // Keep out of burning ground, and out of each other's way.
    for(const h of ai?.hazards||[]){const hx=p.x-h.point.x,hz=p.z-h.point.z,hd=Math.hypot(hx,hz);if(hd<h.radius+1.2&&hd>.01){mx+=hx/hd*1.5;mz+=hz/hd*1.5;}}
    let sx=0,sz=0;for(const other of enemies){if(other===e||other.dead)continue;const ox=p.x-other.model.position.x,oz=p.z-other.model.position.z,d=Math.hypot(ox,oz);if(d>0&&d<1.3){sx+=ox/d*(1.3-d);sz+=oz/d*(1.3-d);}}
    const len=Math.hypot(mx,mz);
    if(len>.01||sx||sz){const k=len>.01?Math.min(1,len)*speed/len:0;moveEnemy(e,(mx*k+sx)*dt,(mz*k+sz)*dt);}
    // Face what matters, else the way they walk.
    if(it.face)turnToward(e,it.face.x-p.x,it.face.z-p.z,dt,prof.beast?7:4.5);else if(len>.01)turnToward(e,mx,mz,dt,6);
    e.shieldUp=prof.shield&&!b.disarmed&&!(e.guardBroken>0)&&!(e.windup>0||e.strikeT>0)&&(it.guard||it.pose==='shieldUp'||e.blocking>0);
    if(e.shieldUp&&prof.shield&&distance<6)e.blocking=Math.max(e.blocking,.1);
    e.castRelease=Math.max(0,(e.castRelease||0)-dt);
    if(!it.attack||e.cooldown>0)return;
    if(prof.caster&&(it.id==='heal'||it.id==='shoot')){
      // A cast takes a readable moment: the ember gathers in the hand before it flies.
      const heal=it.id==='heal'&&b.healTarget&&b.mana>=AI.magic.heal,see=!world.segmentBlocked(p.clone().add(vector(0,1.6,0)),heal?b.healTarget.npc.model.position.clone().add(vector(0,1.3,0)):eye());
      if(see&&(heal||b.mana>=AI.magic.bolt)){e.casting=heal?'heal':'bolt';e.castTarget=heal?b.healTarget:null;e.windup=(heal?AI.magic.healTime:AI.magic.castTime)*(1.2-prof.skill*.3);e.windupTotal=e.windup;if(!heal)ai?.say(b,'cast',9);}
      return;
    }
    if(e.archer&&!b.meleeMode&&b.arrows>0){
      if(!world.segmentBlocked(p.clone().add(vector(0,1.6,0)),eye()))e.windup=ARCHER_DRAW*(1.25-prof.skill*.35);
    }else if(distance<=prof.reach&&b.stamina>10&&!b.disarmed&&!world.segmentBlocked(p.clone().add(vector(0,1.5,0)),eye())){
      // Novices wind up slowly (easy to read); the desperate strike in a hurry.
      e.windup=prof.windup*(1.15-prof.skill*.25)*(it.id==='desperate'?.85:1);b.stamina-=10;ai?.noise('fight',p);
    }
  }
  function updateEnemies(dt){navUntil=performance.now()+1.5;
    let winding=enemies.filter(e=>e.windup>0).length;
    const attackers={count:enemies.filter(e=>!e.dead&&['approach','strike'].includes(e.plan)).length,max:1+(enemies.filter(e=>!e.dead&&!e.calm&&e.kind==='wolf'&&e.model.position.distanceTo(player.position)<18).length>2?1:0)};
    for(const e of enemies){const p=e.model.position;
      if(e.dead){e.deathTime=Math.min(1,(e.deathTime||0)+dt*1.4);p.y=world.heightAt(p.x,p.z);continue;}
      e.cooldown-=dt;e.stagger=Math.max(0,(e.stagger||0)-dt);e.strikeT=Math.max(0,(e.strikeT||0)-dt);
      const dx=player.position.x-p.x,dz=player.position.z-p.z,distance=Math.hypot(dx,dz);
      if(e.knock){moveEnemy(e,e.knock.x*dt,e.knock.z*dt);e.knock.multiplyScalar(Math.exp(-dt*9));}
      if(e.motionLock){e.windup=0;e.casting=null;continue;}
      if(e.stagger>0)continue;
      if(e.ai){driveAI(e,dt,distance,dx,dz,attackers);continue;}
      // Once in the fight an enemy stays in it out to 32 m (a fleeing bandit comes back after a while);
      // one shot from afar comes looking for the archer from much further.
      const active=!e.calm&&distance<(e.engaged?(e.alertUntil>time?90:32):20);e.engaged=active;
      // Turn toward the player with a limited angular speed instead of snapping (away when fleeing).
      if(active){const away=e.plan==='flee'?Math.PI:0,turn=THREE.MathUtils.euclideanModulo(Math.atan2(-dx,-dz)+away-e.model.rotation.y+Math.PI,Math.PI*2)-Math.PI,rate=dt*(e.kind==='wolf'?7:5);e.model.rotation.y+=THREE.MathUtils.clamp(turn,-rate,rate);}
      if(e.windup>0){
        e.windup-=dt;
        if(e.windup<=0&&e.archer){shootArrow(e);e.cooldown=2.2+Math.random()*1.6;continue;}
        if(e.windup<=0){const t=TACTICS[e.kind]||TACTICS.bandit;e.strikeT=e.kind==='wolf'?.3:.4;
          const visible=!world.segmentBlocked(p.clone().add(vector(0,1.5,0)),eye());
          if(distance<t.reach&&visible){
            const facing=inAttackArc(p.x-player.position.x,p.z-player.position.z,player.yaw,4,.25);
            if(guard&&facing&&player.stamina>=12){player.stamina-=12;
              if(time-guardStart<.24){e.stagger=1;toast('PARIERT',1000);effects.sound('parry');}
              else {onHurt(3);effects.sound('parry');}
              effects.spray(eye().add(vector(0,-.3,0)),vector(0,1,0),'ember',13);
            }else{onHurt(t.damage*(e.storyId?1.3:1));effects.sound('impact');effects.spray(player.position.clone().add(vector(0,1.5,0)),vector(dx,0,dz).normalize().negate(),'blood',16);}}
          // Bandits sometimes follow up at once; then everyone backs off a step.
          if(e.kind==='bandit'&&Math.random()<(e.storyId?.55:.3)&&!e.combo){e.combo=true;e.windup=.45;}
          else{e.combo=false;e.cooldown=e.kind==='wolf'?1.4+Math.random():1.8+Math.random()*1.2;e.plan='retreat';e.planTime=.8+Math.random()*.6;}
        }
      }else if(active){think(e,dt,distance,dx,dz,attackers);}
    }
  }
  function update(dt){time+=dt;hitPause=Math.max(0,hitPause-dt);const actionDt=hitPause>0?dt*.18:dt;
    spellFx.update(dt);
    if(action){const previous=action.t;action.t+=actionDt;action.progress=Math.min(1,action.t/action.duration);player.attack=Math.max(0,action.duration-action.t);
      if(crossedImpact(previous,action.t,action.kind)){if(action.kind==='sword')resolveSword();else if(action.kind==='cast')launchSpell();else onHeal();}
      if(action.t>=action.duration){const chain=queued;action=null;queued=false;player.attack=0;if(chain)begin('sword');}}
    spellFx.setCharge(castOrigin(hand),action?.kind==='cast'&&action.t<ACTIONS.cast.impact?action.t/ACTIONS.cast.impact:null,dt);
    if(player.tool!==0)guard=false;
    if(guard){player.stamina=Math.max(0,player.stamina-dt*4);if(player.stamina<2)guard=false;}
    if(player.tool!==3)archery?.cancel();
    archery?.update(dt);updateProjectiles(dt);updateBolts(dt);updateEnemies(dt);
  }
  function reset(){action=null;queued=false;guard=false;hitPause=0;effects.reset();archery?.reset();for(const bolt of bolts)spellFx.releaseBall(bolt.ball);bolts.length=0;
    spellFx.reset();projectiles.length=0;
    enemies.forEach(e=>{e.stagger=0;e.windup=0;e.strikeT=0;e.deathTime=0;e.knock=null;});}
  function restore(){enemies.forEach(e=>{e.model.visible=true;
    if(e.hp<e.maxHp)effects.wound(e,e.model.position.clone().add(vector(0,1.7,-3)));
    if(e.dead){e.deathTime=1;effects.groundStain(e.model.position,1.1);}
  });}
  return {attack,drink,setGuard,update,reset,restore,effects,spellFx,archery,
    get action(){return action;},get guarding(){return guard;},
    get speedFactor(){return action?.kind==='drink'?.45:guard||archery?.drawing?.55:action?.kind==='sword'?.76:1;},
    state:()=>({action:action?{...action}:null,guard,projectiles:projectiles.length,bow:archery?.state()??null,...effects.state(),...spellFx.state(),enemies:enemies.map(e=>({hp:e.hp,dead:e.dead,windup:e.windup||0,stagger:e.stagger||0,corpseVisible:e.dead&&e.model.visible}))}),
  };
}
