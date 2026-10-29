import { ITEMS, isEquipment, itemPower, RARITY, sellPrice, equipSlot } from './items.js';

export function createInventory(player,rpg,game){
  const equipped=id=>Object.values(player.equipment).includes(id);
  function counts(){
    const all={...player.satchel};
    const add=(id,n=1)=>{if(ITEMS[id]&&n>0)all[id]=(all[id]||0)+n;};
    Object.values(player.equipment).forEach(id=>add(id));player.loot.forEach(id=>add(id));add('heiltrank',player.potions);
    for(const [id,item] of Object.entries(ITEMS))if(item.resource)add(id,rpg.state.inventory[item.resource]);
    if(game.quest==='complete')all.glutstein=1;
    return all;
  }
  function available(id){return Math.max(0,(counts()[id]||0)-(equipped(id)?1:0));}
  function add(id,quantity=1){
    if(!ITEMS[id]||ITEMS[id].locked||!Number.isInteger(quantity)||quantity<1)return false;
    if(id==='heiltrank')player.potions+=quantity;
    else if(ITEMS[id].resource)rpg.addResource(ITEMS[id].resource,quantity);
    else if(isEquipment(ITEMS[id]))for(let n=0;n<quantity;n++)player.loot.push(id);
    else player.satchel[id]=(player.satchel[id]||0)+quantity;
    return true;
  }
  function remove(id,quantity=1){
    if(!ITEMS[id]||ITEMS[id].locked||!Number.isInteger(quantity)||quantity<1||available(id)<quantity)return false;
    if(id==='heiltrank')player.potions-=quantity;
    else if(ITEMS[id].resource)rpg.addResource(ITEMS[id].resource,-quantity);
    else if(isEquipment(ITEMS[id]))for(let n=0;n<quantity;n++)player.loot.splice(player.loot.indexOf(id),1);
    else {player.satchel[id]-=quantity;if(!player.satchel[id])delete player.satchel[id];}
    return true;
  }
  function rows(source=counts()){
    return Object.entries(source).filter(([id,n])=>ITEMS[id]&&n>0).map(([id,quantity])=>({id,...ITEMS[id],quantity,equipped:equipped(id),favorite:player.favorites.includes(id),junk:player.junk.includes(id)}));
  }
  const weight=()=>rows().reduce((sum,item)=>sum+item.weight*item.quantity,0);
  const capacity=()=>40+player.attributes.strength*2+player.attributes.endurance*3+(ITEMS[player.equipment.accessory]?.carry||0);
  function equip(id){
    const item=ITEMS[id];if(!isEquipment(item)||equipped(id)||!remove(id))return false;
    const slot=equipSlot(item),previous=player.equipment[slot];player.equipment[slot]=id;if(previous)add(previous);
    player.junk=player.junk.filter(value=>value!==id);return true;
  }
  function unequip(id){
    const item=ITEMS[id];if(!isEquipment(item)||!equipped(id))return false;
    player.equipment[equipSlot(item)]=null;add(id);return true;
  }
  function mark(id,kind){
    if(!(counts()[id]>0)||!['favorites','junk'].includes(kind)||ITEMS[id].locked)return false;
    if(kind==='junk'&&equipped(id))return false;
    const list=player[kind],index=list.indexOf(id);
    if(index>=0)list.splice(index,1);else{list.push(id);player[kind==='junk'?'favorites':'junk']=player[kind==='junk'?'favorites':'junk'].filter(value=>value!==id);}
    return true;
  }
  function consume(id){
    const item=ITEMS[id];if(!item||!['food','consumable'].includes(item.type)||id==='heiltrank')return {ok:false};
    if((!item.heal||player.hp>=player.maxHp)&&(!item.stamina||player.stamina>=player.maxStamina))return {ok:false,message:'Bereits vollständig erholt.'};
    if(!remove(id))return {ok:false};
    const hp=player.hp,stamina=player.stamina;
    player.hp=Math.min(player.maxHp,player.hp+(item.heal||0));player.stamina=Math.min(player.maxStamina,player.stamina+(item.stamina||0));
    return {ok:true,message:`${item.name} · +${Math.round(player.hp-hp)} Leben · +${Math.round(player.stamina-stamina)} Ausdauer`};
  }
  function buy(id,quantity=1){
    const item=ITEMS[id],shop=player.merchant;
    if(!item||!Number.isInteger(quantity)||quantity<1||(shop.stock[id]||0)<quantity)return {ok:false,message:'Nicht mehr vorrätig.'};
    const cost=item.value*quantity;
    if(player.gold<cost)return {ok:false,message:'Nicht genug Gold.'};
    if(weight()+item.weight*quantity>capacity()+.0001)return {ok:false,message:'Dein Gepäck ist zu schwer. Verkaufe oder lagere zuerst etwas ein.'};
    if(!add(id,quantity))return {ok:false};shop.stock[id]-=quantity;player.gold-=cost;shop.gold+=cost;return {ok:true};
  }
  function sell(id,quantity=1){
    if(!ITEMS[id]||ITEMS[id].locked||!Number.isInteger(quantity)||quantity<1)return {ok:false,message:'Dieser Gegenstand lässt sich nicht verkaufen.'};
    const price=sellPrice(id)*quantity;
    if(player.merchant.gold<price)return {ok:false,message:'Bryn hat nicht genug Gold.'};
    if(!remove(id,quantity))return {ok:false,message:'Ausgerüstete Gegenstände bleiben bei dir.'};
    player.gold+=price;player.merchant.gold-=price;player.merchant.stock[id]=(player.merchant.stock[id]||0)+quantity;return {ok:true};
  }
  function transfer(id,quantity,target,take=false){
    if(!ITEMS[id]||ITEMS[id].locked||!Number.isInteger(quantity)||quantity<1)return false;
    if(take){if((target[id]||0)<quantity||weight()+ITEMS[id].weight*quantity>capacity()+.0001||!add(id,quantity))return false;target[id]-=quantity;if(!target[id])delete target[id];}
    else {if(!remove(id,quantity))return false;target[id]=(target[id]||0)+quantity;}
    return true;
  }
  function sellJunk(){
    let sold=0;
    for(const id of [...player.junk]){
      const n=Math.min(available(id),Math.floor(player.merchant.gold/sellPrice(id)));
      if(n&&sell(id,n).ok)sold+=n;
    }
    return sold;
  }
  function drop(id,quantity=1){
    let bag=player.drops.find(b=>Math.hypot(b.x-player.position.x,b.z-player.position.z)<1.5);
    if(!bag&&player.drops.length>=30)return {ok:false,message:'Hebe zuerst einen deiner abgelegten Beutel auf.'};
    if(!bag)bag={id:Math.max(0,...player.drops.map(b=>b.id))+1,x:player.position.x,z:player.position.z,items:{}};
    if(!transfer(id,quantity,bag.items))return {ok:false,message:'Ausgerüstete und wichtige Gegenstände bleiben bei dir.'};
    if(!player.drops.includes(bag))player.drops.push(bag);return {ok:true};
  }
  return {counts,rows,available,equipped,weight,capacity,add,remove,equip,unequip,mark,consume,buy,sell,sellJunk,transfer,drop};
}

const fold=text=>text.toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
export function filterItems(rows,{category='all',query='',filter='all',sort='name',direction=1}={}){
  const words=fold(query).split(/\s+/).filter(Boolean);
  return rows.filter(row=>(category==='all'||row.type===category)&&
    (filter==='all'||filter==='favorites'&&row.favorite||filter==='equipped'&&row.equipped||filter==='junk'&&row.junk)&&
    words.every(word=>fold(`${row.name} ${row.subtype} ${row.rarity}`).includes(word)))
    .sort((a,b)=>{
      const values={name:()=>a.name.localeCompare(b.name,'de'),weight:()=>a.weight-b.weight,value:()=>a.value-b.value,quantity:()=>a.quantity-b.quantity,power:()=>itemPower(a)-itemPower(b),rarity:()=>RARITY[a.rarity]-RARITY[b.rarity]};
      return (values[sort]||values.name)()*direction||a.name.localeCompare(b.name,'de');
    });
}
