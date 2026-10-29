import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_CHARACTER } from '../src/systems/progression.js';
import { createRPGSystems } from '../src/systems/rpgSystems.js';
import { createInventory, filterItems } from '../src/systems/inventory.js';
import { ITEMS, sellPrice } from '../src/systems/items.js';
import { encodeSave, normalizeSave } from '../src/systems/saveState.js';

function setup() {
  const player={...structuredClone(INITIAL_CHARACTER),position:new THREE.Vector3(3,0,0)};
  const rpg=createRPGSystems(),game={quest:'meet'};
  return {player,rpg,game,inventory:createInventory(player,rpg,game)};
}

test('equipment swaps preserve counts and weight, and every slot can be unequipped',()=>{
  const {player,inventory}=setup();
  for(const id of ['waechterklinge','lederwams','glutamulett']){
    inventory.add(id);inventory.mark(id,'junk');
    const counts=inventory.counts(),weight=inventory.weight();
    assert.equal(inventory.equip(id),true);
    assert.equal(player.equipment[ITEMS[id].type],id);
    assert.deepEqual(inventory.counts(),counts);
    assert.ok(Math.abs(inventory.weight()-weight)<1e-8);
    assert.equal(player.junk.includes(id),false);
    assert.equal(inventory.equip(id),false);
    assert.equal(inventory.sell(id).ok,false);
    assert.equal(inventory.unequip(id),true);
    assert.equal(player.equipment[ITEMS[id].type],null);
    assert.equal(inventory.available(id),1);
    assert.equal(inventory.unequip(id),false);
  }
  assert.equal(inventory.equip('aschenklinge'),false);
});

test('buy and sell conserve stock and gold and reject transactions atomically',()=>{
  const {player,inventory}=setup();player.gold=200;
  const totalGold=player.gold+player.merchant.gold;
  assert.equal(inventory.buy('heiltrank',2).ok,true);
  assert.equal(player.potions,5);assert.equal(player.gold,150);assert.equal(player.merchant.stock.heiltrank,4);
  assert.equal(inventory.sell('heiltrank',2).ok,true);
  assert.equal(player.potions,3);assert.equal(player.merchant.stock.heiltrank,6);
  assert.equal(player.gold,150+sellPrice('heiltrank')*2);
  assert.equal(player.gold+player.merchant.gold,totalGold);
  const before=structuredClone(player);
  for(const n of [-1,0,.5,100])assert.equal(inventory.buy('heiltrank',n).ok,false);
  assert.equal(inventory.buy('unknown').ok,false);
  assert.deepEqual(structuredClone(player),before);
  player.gold=0;assert.equal(inventory.buy('reisefladen').ok,false);
  player.merchant.gold=0;assert.equal(inventory.sell('heiltrank').ok,false);
  assert.equal(player.potions,3);
});

test('carry limit includes equipment, potions and resources; amulets increase capacity',()=>{
  const {player,rpg,inventory}=setup();
  inventory.add('holz',2);
  assert.equal(rpg.state.inventory.wood,2);
  // Starting gear: sword, hunting bow, travel clothes, bracers, boots and cloak, plus potions, satchel
  // (24 arrows among it) and wood.
  assert.ok(Math.abs(inventory.weight()-(7+4+3+1+1.5+1.5+1.5+.4+.6+.3+24*.05+2))<1e-8);
  assert.equal(inventory.capacity(),45);
  inventory.add('wandereramulett');inventory.equip('wandereramulett');
  assert.equal(inventory.capacity(),60);
  inventory.unequip('wandereramulett');assert.equal(inventory.capacity(),45);
  inventory.add('eisenerz',30);player.gold=500;
  const before=structuredClone(player),resources=structuredClone(rpg.state.inventory);
  assert.equal(inventory.buy('heiltrank').ok,false);
  player.stash.heiltrank=2;
  assert.equal(inventory.transfer('heiltrank',1,player.stash,true),false);
  assert.equal(player.stash.heiltrank,2);assert.equal(player.potions,before.potions);
  assert.equal(player.gold,before.gold);assert.deepEqual(player.merchant,before.merchant);
  assert.deepEqual(rpg.state.inventory,resources);
});

test('stash transfers use the canonical potion, resource and equipment stores',()=>{
  const {player,rpg,inventory}=setup();
  inventory.add('leder',3);inventory.add('lederwams');
  for(const [id,n] of [['heiltrank',2],['leder',3],['lederwams',1],['reisefladen',2]]){
    const before=inventory.counts()[id];
    assert.equal(inventory.transfer(id,n,player.stash),true);
    assert.equal(player.stash[id],n);
    assert.equal(inventory.counts()[id]||0,before-n);
    assert.equal(inventory.transfer(id,n+1,player.stash,true),false);
    assert.equal(inventory.transfer(id,n,player.stash,true),true);
    assert.equal(inventory.counts()[id],before);assert.equal(player.stash[id],undefined);
  }
  assert.equal(rpg.state.inventory.leather,3);assert.equal(player.potions,3);
  assert.equal(inventory.transfer('rostiges_schwert',1,player.stash),false);
});

test('favorites and junk are exclusive, and bulk sale protects equipped and quest items',()=>{
  const {player,game,inventory}=setup();game.quest='complete';
  inventory.add('bernstein',3);
  assert.equal(inventory.mark('bernstein','favorites'),true);
  assert.equal(inventory.mark('bernstein','junk'),true);
  assert.equal(player.favorites.includes('bernstein'),false);
  assert.equal(inventory.mark('rostiges_schwert','junk'),false);
  assert.equal(inventory.mark('glutstein','junk'),false);
  assert.equal(inventory.drop('glutstein').ok,false);
  player.merchant.gold=sellPrice('bernstein')*2;
  assert.equal(inventory.sellJunk(),2);assert.equal(inventory.counts().bernstein,1);
  assert.equal(inventory.sellJunk(),0);
  assert.equal(inventory.counts().glutstein,1);
  assert.equal(player.equipment.weapon,'rostiges_schwert');
  inventory.mark('bernstein','favorites');assert.equal(player.junk.includes('bernstein'),false);
});

test('drops merge nearby stacks and can be taken back without duplication',()=>{
  const {player,inventory}=setup();
  assert.equal(inventory.drop('heiltrank',2).ok,true);
  assert.equal(inventory.drop('reisefladen').ok,true);
  assert.equal(player.drops.length,1);assert.equal(player.potions,1);
  const bag=player.drops[0];assert.deepEqual(bag.items,{heiltrank:2,reisefladen:1});
  assert.equal(inventory.transfer('heiltrank',2,bag.items,true),true);
  assert.equal(inventory.transfer('heiltrank',2,bag.items,true),false);
  assert.equal(player.potions,3);
  assert.equal(inventory.drop('rostiges_schwert').ok,false);
  player.position.x+=4;inventory.drop('reisefladen');assert.equal(player.drops.length,2);
});

test('food and stamina potions restore only up to maxima and do not waste full-health items',()=>{
  const {player,inventory}=setup();
  assert.equal(inventory.consume('reisefladen').ok,false);assert.equal(player.satchel.reisefladen,3);
  player.hp=95;assert.equal(inventory.consume('reisefladen').ok,true);assert.equal(player.hp,100);
  player.stamina=10;assert.equal(inventory.consume('ausdauertrank').ok,true);assert.equal(player.stamina,65);
  assert.equal(inventory.consume('ausdauertrank').ok,false);
  assert.equal(inventory.consume('heiltrank').ok,false);assert.equal(player.potions,3);
});

test('search, category, flags and numeric sort compose over inventory rows',()=>{
  const {inventory}=setup();inventory.add('aschenrüstung');inventory.add('lederwams');
  inventory.mark('aschenrüstung','favorites');
  assert.deepEqual(filterItems(inventory.rows(),{query:'ASCHENRUSTUNG'}).map(r=>r.id),['aschenrüstung']);
  assert.deepEqual(filterItems(inventory.rows(),{category:'armor',sort:'power',direction:-1}).map(r=>r.id),['aschenrüstung','lederwams','armschienen','reisekleidung','reiseumhang','wanderstiefel']);
  assert.deepEqual(filterItems(inventory.rows(),{category:'armor',filter:'favorites'}).map(r=>r.id),['aschenrüstung']);
});

test('the bow, its arrows, archery skill and bow perks survive a save',()=>{
  const {player,rpg,game}=setup();
  player.skills.archery=7;player.perks.push('ruhige_hand','meisterschuetze');player.satchel.pfeil=31;
  const data=normalizeSave(JSON.parse(encodeSave(player,game,[],{},12,rpg.state)));
  assert.equal(data.player.equipment.ranged,'jagdbogen');
  assert.equal(data.player.satchel.pfeil,31);
  assert.equal(data.player.skills.archery,7);
  assert.deepEqual(data.player.perks,['ruhige_hand','meisterschuetze']);
});

test('save round trip preserves empty slots, satchel, flags, stash, bags and merchant',()=>{
  const {player,rpg,game,inventory}=setup();
  inventory.unequip('rostiges_schwert');inventory.mark('rostiges_schwert','junk');
  inventory.transfer('reisefladen',2,player.stash);inventory.drop('heiltrank');
  inventory.sell('rostiges_schwert');inventory.add('kraeuter',4);
  const data=normalizeSave(JSON.parse(encodeSave(player,game,[],{},12,rpg.state)));
  for(const key of ['equipment','satchel','favorites','junk','stash','drops','merchant','potions','loot'])assert.deepEqual(data.player[key],player[key],key);
  const restoredRpg=createRPGSystems();restoredRpg.restore(data.rpg);
  assert.deepEqual(createInventory(data.player,restoredRpg,game).counts(),inventory.counts());
  for(const version of [1,2,3,4]){
    const legacy=normalizeSave({version,position:[3,0,0],equipment:{weapon:'aschenklinge'},potions:4});
    assert.equal(legacy.player.equipment.weapon,'aschenklinge');
    assert.equal(legacy.player.potions,4);assert.deepEqual(legacy.player.stash,{});
    assert.ok(createInventory(legacy.player,createRPGSystems(),game).rows().length>0);
  }
});
