import { ITEMS,CATEGORIES,EQUIPMENT_SLOTS,equipSlot,isEquipment,itemPower,sellPrice } from '../systems/items.js';
import { filterItems } from '../systems/inventory.js';
import { icon,typeIcon } from './inventoryIcons.js';
import { createItemPreview } from './itemPreview.js';
import './inventory.css';

const number=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarityClass=item=>({gewöhnlich:'common',ungewöhnlich:'uncommon',selten:'rare',einzigartig:'unique'}[item.rarity]);

export function createInventoryUI({root,player,inventory,onChange,onClose,onHeal,onPerks}){
  root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Inventar und Ausrüstung');
  root.innerHTML=`<div class="inventory-shell">
    <header class="inventory-heading"><div><span class="inv-eyebrow" id="inventory-context">DEIN ABENTEUER</span><h2 id="inventory-title">Inventar</h2></div><div id="inventory-modes" class="inventory-modes"></div><button id="inventory-close" class="inv-icon-button" aria-label="Inventar schließen">${icon('close')}</button></header>
    <div class="inventory-layout">
      <aside class="inventory-sidebar"><div class="inv-section-label">KATEGORIEN</div><nav id="inventory-categories" aria-label="Inventarkategorien"></nav><div class="inv-equipment-label">AUSGERÜSTET</div><div id="inventory-equipment"></div></aside>
      <section class="inventory-list-panel" aria-label="Gegenstandsliste"><div class="inventory-toolbar"><label class="inventory-search">${icon('search')}<input id="inventory-search" type="search" placeholder="Gegenstände suchen …" aria-label="Gegenstände suchen" autocomplete="off" spellcheck="false"><kbd>/</kbd></label><select id="inventory-filter" aria-label="Bestand filtern"><option value="all">Alles anzeigen</option><option value="favorites">Favoriten</option><option value="equipped">Ausgerüstet</option><option value="junk">Plunder</option></select></div>
      <div class="inventory-list-caption"><span id="inventory-count"></span><button id="sell-junk" class="hidden">Plunder verkaufen</button></div>
      <div class="inventory-table-scroll"><table class="inventory-table" aria-label="Gegenstände"><thead><tr><th scope="col"><button data-sort="name">GEGENSTAND</button></th><th scope="col"><button data-sort="quantity">ANZ.</button></th><th scope="col"><button data-sort="power">STÄRKE</button></th><th scope="col"><button data-sort="weight">GEW.</button></th><th scope="col"><button data-sort="value">WERT</button></th></tr></thead><tbody id="inventory-rows"></tbody></table><div id="inventory-empty" class="hidden"><span>Keine Gegenstände gefunden.</span><button id="inventory-clear">Filter zurücksetzen</button></div></div>
      <div id="inventory-perks" class="inventory-perks"></div><div class="inventory-list-bottom"><span id="inventory-list-total"></span><span>Gewicht & Wert pro Stück</span></div></section>
      <aside class="inventory-detail" aria-label="Gegenstandsdetails"><div class="inventory-preview"><div id="item-preview"></div><div class="preview-corners"></div><span class="preview-hint">ZIEHEN ZUM DREHEN</span><span id="item-badges"></span></div><div id="inventory-detail-body"></div></aside>
    </div>
    <div id="inventory-message" role="status" aria-live="polite"></div>
    <footer class="inventory-footer"><div class="inventory-footer-stats" id="inventory-stats"></div><div class="inventory-carry"><div><span>TRAGLAST</span><b id="inventory-weight"></b></div><div class="carry-track"><i id="inventory-weight-fill"></i></div></div><div class="inventory-gold">${icon('coin')}<div><span>GOLD</span><b id="inventory-gold"></b></div></div></footer>
    <div class="inventory-key-hints"><span><kbd>↑ ↓</kbd> Auswählen</span><span><kbd>← →</kbd> Kategorie</span><span><kbd>E</kbd> Aktion</span><span><kbd>F</kbd> Favorit</span><span><kbd>J</kbd> Plunder</span><span><kbd>R</kbd> Ablegen</span><span><kbd>/</kbd> Suche</span><span><kbd>I / ESC</kbd> Schließen</span></div>
    <dialog id="item-reader"><button id="reader-close" class="inv-icon-button" aria-label="Buch schließen">${icon('close')}</button><span class="inv-eyebrow">AUFZEICHNUNGEN</span><h2 id="reader-title"></h2><p id="reader-text"></p></dialog>
  </div>`;
  const $=id=>root.querySelector('#'+id),preview=createItemPreview($('item-preview'));
  let view={category:'all',query:'',filter:'all',sort:'name',direction:1},selected=null,visible=[],context={kind:'inventory'},side='own';
  try{const saved=JSON.parse(localStorage.getItem('ashen-inventory-view-v1'));if(saved){if(CATEGORIES.some(c=>c[0]===saved.category))view.category=saved.category;if(['name','quantity','power','weight','value'].includes(saved.sort))view.sort=saved.sort;view.direction=saved.direction===-1?-1:1;}}catch{}
  const remember=()=>{try{localStorage.setItem('ashen-inventory-view-v1',JSON.stringify(view));}catch{}};
  const source=()=>side==='buy'?player.merchant.stock:side==='take'?context.items:undefined;
  const own=()=>side==='own'||side==='sell'||side==='store';
  const selectedItem=()=>visible.find(item=>item.id===selected);
  const status=(message,error=false)=>{$('inventory-message').textContent=message;$('inventory-message').classList.toggle('error',error);};
  const quantity=()=>Math.max(1,Math.min(maxQuantity(),Math.floor(Number($('item-quantity')?.value)||1)));
  function maxQuantity(){const item=selectedItem();if(!item)return 1;return Math.max(1,own()?inventory.available(item.id):item.quantity);}
  function changed(message){onChange();render();status(message);}
  function action(){
    const item=selectedItem();if(!item)return;const n=quantity();let result;
    if(side==='buy'){result=inventory.buy(item.id,n);if(result.ok)changed(`${n} × ${item.name} gekauft.`);}
    else if(side==='sell'){result=inventory.sell(item.id,n);if(result.ok)changed(`${n} × ${item.name} verkauft.`);}
    else if(side==='take'||side==='store'){result={ok:inventory.transfer(item.id,n,context.items,side==='take'),message:side==='take'?'Nicht genug Platz im Gepäck.':'Ausgerüstete Gegenstände zuerst ablegen.'};if(result.ok)changed(`${n} × ${item.name} ${side==='take'?'genommen':'eingelagert'}.`);}
    else if(isEquipment(item)){const ok=item.equipped?inventory.unequip(item.id):inventory.equip(item.id);result={ok};if(ok)changed(item.name+(item.equipped?' abgelegt.':' ausgerüstet.'));}
    else if(item.id==='heiltrank'){result=onHeal();if(result.ok)changed(result.message);}
    else if(item.type==='food'||item.type==='consumable'){result=inventory.consume(item.id);if(result.ok)changed(result.message);}
    else if(item.type==='book'){$('reader-title').textContent=item.name;$('reader-text').textContent=item.body;$('item-reader').showModal();return;}
    if(result&&!result.ok)status(result.message||'Diese Aktion ist gerade nicht möglich.',true);
  }
  function mark(kind){if(own()&&selected&&inventory.mark(selected,kind))changed(kind==='favorites'?'Favoriten aktualisiert.':'Plundermarkierung aktualisiert.');}
  function drop(){if(!own()||!selected)return;const result=inventory.drop(selected,quantity());if(result.ok)changed('In einem Beutel zu deinen Füßen abgelegt. Mit E wieder aufnehmen.');else status(result.message,true);}
  function detail(){
    const item=selectedItem();preview.show(item);
    $('inventory-detail-body').innerHTML='';$('item-badges').textContent='';
    if(!item){$('inventory-detail-body').innerHTML='<p class="item-description">Wähle einen Gegenstand aus, um ihn genauer zu betrachten.</p>';return;}
    $('item-badges').innerHTML=`${item.locked?'<span>QUESTGEGENSTAND</span>':''}${own()&&item.equipped?'<span>ANGELEGT</span>':''}${item.favorite&&own()?'<span>★ FAVORIT</span>':''}`;
    const powerLabel=item.damage!==undefined?'SCHADEN':item.armor!==undefined?'RÜSTUNG':item.magic?'MAGIEBONUS':item.carry?'TRAGLAST':item.heal?'HEILUNG':item.stamina?'AUSDAUER':'',power=itemPower(item);
    const powerKey=['damage','armor','magic','carry'].find(key=>item[key]!==undefined);
    const old=ITEMS[player.equipment[equipSlot(item)]],difference=power-(old?.[powerKey]||0);
    const compare=isEquipment(item)?`<div class="item-comparison ${difference>0?'positive':difference<0?'negative':''}">${item.equipped&&own()?'Aktuell ausgerüstet':`${difference>0?'+':''}${number(difference)} ${powerLabel.toLowerCase()} ${old?'gegenüber '+escape(old.name):'gegenüber leerem Platz'}`}</div>`:'';
    const disabled=item.locked||(own()&&!inventory.available(item.id)&&side!=='own')||(side==='own'&&!isEquipment(item)&&!['consumable','food','book'].includes(item.type));
    const label=side==='buy'?'Kaufen':side==='sell'?'Verkaufen':side==='take'?'Nehmen':side==='store'?'Einlagern':isEquipment(item)?item.equipped?'Ausrüstung ablegen':'Ausrüsten':item.type==='book'?'Lesen':item.type==='food'?'Essen':item.type==='consumable'?'Trinken':item.locked?'Questgegenstand':'Material';
    const rowPrice=side==='sell'?sellPrice(item.id):item.value;
    $('inventory-detail-body').innerHTML=`<div class="item-class ${rarityClass(item)}">${escape(item.subtype)} <span>· ${escape(item.rarity)}</span></div><h3>${escape(item.name)}</h3><div class="item-measures">${powerLabel?`<div><span>${powerLabel}</span><b>${number(power)}</b></div>`:''}<div><span>GEWICHT</span><b>${number(item.weight)}</b></div><div><span>${side==='sell'?'VERKAUFSPREIS':side==='buy'?'PREIS':'WERT'}</span><b>${number(rowPrice)}</b></div></div>${compare}<p class="item-description">${escape(item.description)}</p><div class="item-stack">${item.quantity} im Bestand · ${number(item.quantity*item.weight)} Gesamtgewicht${side==='buy'?` · Du besitzt ${inventory.counts()[item.id]||0}`:''}</div>
      <div class="item-actions"><div class="item-primary-row"><button id="item-primary" ${disabled?'disabled':''}>${label}${side==='buy'||side==='sell'?` <span id="item-total">· ${rowPrice} G</span>`:''}</button><label class="item-quantity-label" ${maxQuantity()<=1?'hidden':''}><span>MENGE</span><input id="item-quantity" aria-label="Menge" type="number" min="1" max="${maxQuantity()}" value="1"></label></div>${own()?`<div class="item-secondary-row"><button id="item-favorite" aria-pressed="${item.favorite}" ${item.locked?'disabled':''}>${item.favorite?'★':'☆'} Favorit</button><button id="item-junk" aria-pressed="${item.junk}" ${item.locked||item.equipped?'disabled':''}>${item.junk?'✓ ':''}Plunder</button><button id="item-drop" ${item.locked||!inventory.available(item.id)?'disabled':''}>Ablegen</button></div>`:''}</div>`;
    $('item-primary').onclick=action;
    $('item-quantity')?.addEventListener('input',()=>{if($('item-total'))$('item-total').textContent='· '+number(rowPrice*quantity())+' G';});
    if(own()){$('item-favorite').onclick=()=>mark('favorites');$('item-junk').onclick=()=>mark('junk');$('item-drop').onclick=drop;}
  }
  function render(){
    const rows=inventory.rows(source()).map(item=>({...item,equipped:own()&&item.equipped,favorite:own()&&item.favorite,junk:own()&&item.junk}));
    visible=filterItems(rows,view);if(!visible.some(item=>item.id===selected))selected=visible[0]?.id??null;
    $('inventory-context').textContent=context.kind==='merchant'?'HANDEL IN DÄMMERWALD':['container','take'].includes(context.kind)?'AUFBEWAHRUNG':'DEIN ABENTEUER';
    $('inventory-title').textContent=context.name||'Inventar';
    const modes=context.kind==='merchant'?[['buy','Kaufen'],['sell','Verkaufen']]:context.kind==='container'?[['take','Nehmen'],['store','Einlagern']]:[];
    $('inventory-modes').innerHTML=modes.map(([id,label])=>`<button data-side="${id}" aria-pressed="${side===id}">${label}</button>`).join('');
    $('inventory-categories').innerHTML=CATEGORIES.map(([id,name,glyph])=>`<button data-category="${id}" aria-pressed="${view.category===id}">${icon(glyph)}<span>${name}</span><small>${rows.filter(r=>id==='all'||r.type===id).reduce((s,r)=>s+r.quantity,0)}</small></button>`).join('');
    $('inventory-equipment').innerHTML=EQUIPMENT_SLOTS.map(slot=>{const item=ITEMS[player.equipment[slot]];return `<button data-equipment="${player.equipment[slot]||''}" ${!item?'disabled':''}>${icon(typeIcon(slot))}<span><small>${{weapon:'WAFFE',ranged:'FERNKAMPF',armor:'RÜSTUNG',head:'KOPF',hands:'HÄNDE',feet:'FÜSSE',cloak:'UMHANG',accessory:'SCHMUCK'}[slot]}</small>${item?escape(item.name):'Nicht belegt'}</span></button>`;}).join('');
    const scroll=root.querySelector('.inventory-table-scroll').scrollTop;
    $('inventory-rows').innerHTML=visible.map(item=>`<tr data-item="${item.id}" tabindex="${selected===item.id?0:-1}" aria-selected="${selected===item.id}"><td><span class="inventory-item-icon ${rarityClass(item)}">${icon(typeIcon(item.slot||item.type))}</span><span class="inventory-item-name">${escape(item.name)}<small>${escape(item.subtype)}</small></span><span class="inventory-row-tags">${item.equipped?'<i title="Ausgerüstet">◆</i>':''}${item.favorite?'<i title="Favorit">★</i>':''}${item.junk?'<i title="Plunder">⌁</i>':''}${item.locked?'<i title="Questgegenstand">◇</i>':''}</span></td><td>${item.quantity}</td><td>${['weapon','armor','accessory','food','consumable'].includes(item.type)?number(itemPower(item)):'—'}</td><td>${number(item.weight)}</td><td>${number(side==='sell'?sellPrice(item.id):item.value)}</td></tr>`).join('');
    root.querySelector('.inventory-table-scroll').scrollTop=scroll;
    $('inventory-empty').classList.toggle('hidden',visible.length>0);
    $('inventory-count').textContent=`${visible.length} ${visible.length===1?'Eintrag':'Einträge'}${view.query?' · Suchergebnis':''}`;
    $('inventory-list-total').textContent=context.kind==='merchant'?`Bryn besitzt ${number(player.merchant.gold)} Gold`:`${rows.reduce((sum,r)=>sum+r.quantity,0)} Gegenstände im Bestand`;
    $('sell-junk').classList.toggle('hidden',side!=='sell');
    root.querySelectorAll('[data-sort]').forEach(button=>{const active=button.dataset.sort===view.sort;button.classList.toggle('active',active);button.parentElement.setAttribute('aria-sort',active?(view.direction===1?'ascending':'descending'):'none');button.dataset.direction=active?(view.direction===1?'↑':'↓'):'';});
    const armor=EQUIPMENT_SLOTS.reduce((sum,slot)=>sum+(ITEMS[player.equipment[slot]]?.armor||0),0);
    $('inventory-stats').innerHTML=`<span>STUFE <b>${player.level}</b></span><span>LEBEN <b>${Math.ceil(player.hp)} / ${player.maxHp}</b></span><span>SCHADEN <b>${(ITEMS[player.equipment.weapon]?.damage||0)+player.attributes.strength*3+(player.perks.includes('schwertmeister')?12:0)}</b></span><span>RÜSTUNG <b>${armor}</b></span>`;
    const weight=inventory.weight(),limit=inventory.capacity();$('inventory-weight').textContent=number(weight)+' / '+number(limit);$('inventory-weight-fill').style.width=Math.min(100,weight/limit*100)+'%';root.classList.toggle('overburdened',weight>limit);
    root.querySelector('.inventory-carry').title='Kaufen und Entnehmen nur bis zur Traglast. Ausrüstung zählt zum Gewicht.';
    $('inventory-gold').textContent=number(player.gold);
    $('inventory-perks').innerHTML='';onPerks?.($('inventory-perks'));
    detail();remember();
  }
  function select(id,focus=false){selected=id;root.querySelectorAll('[data-item]').forEach(row=>{const active=row.dataset.item===id;row.setAttribute('aria-selected',String(active));row.tabIndex=active?0:-1;if(active&&focus){row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}});detail();}
  $('inventory-close').onclick=onClose;$('reader-close').onclick=()=>$('item-reader').close();
  $('inventory-search').addEventListener('input',e=>{view.query=e.target.value;render();});
  $('inventory-filter').onchange=e=>{view.filter=e.target.value;render();};
  $('inventory-clear').onclick=()=>{view.query='';view.category='all';view.filter='all';$('inventory-search').value='';$('inventory-filter').value='all';render();};
  root.addEventListener('click',event=>{
    const item=event.target.closest('[data-item]');if(item)select(item.dataset.item);
    const category=event.target.closest('[data-category]');if(category){view.category=category.dataset.category;render();}
    const sort=event.target.closest('[data-sort]');if(sort){view.direction=view.sort===sort.dataset.sort?-view.direction:sort.dataset.sort==='name'?1:-1;view.sort=sort.dataset.sort;render();}
    const mode=event.target.closest('[data-side]');if(mode){side=mode.dataset.side;view.filter='all';$('inventory-filter').value='all';render();}
    const equipment=event.target.closest('[data-equipment]');if(equipment?.dataset.equipment&&context.kind!=='take'){side=context.kind==='merchant'?'sell':context.kind==='container'?'store':'own';view.category='all';view.query='';view.filter='all';$('inventory-search').value='';$('inventory-filter').value='all';selected=equipment.dataset.equipment;render();}
  });
  $('inventory-rows').addEventListener('dblclick',event=>{if(event.target.closest('[data-item]'))action();});
  $('sell-junk').onclick=()=>{const sold=inventory.sellJunk();if(sold)changed(`${sold} Gegenstände als Plunder verkauft.`);else status('Kein verkaufbarer Plunder oder nicht genug Händlergold.',true);};
  function handleKey(event){
    event.stopPropagation();
    if($('item-reader').open){if(event.code==='KeyI'){event.preventDefault();onClose();return;}if(event.code==='Escape'){event.preventDefault();event.stopPropagation();$('item-reader').close();}return;}
    if(event.code==='Escape'){event.preventDefault();if(!event.repeat)onClose();return;}
    if(event.code==='Tab'){
      const focusable=[...root.querySelectorAll('button:not(:disabled):not([hidden]),input:not([hidden]),select,[data-item][tabindex="0"]')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      return;
    }
    if(event.target.matches?.('#inventory-search'))return;
    if(event.target.matches?.('#item-quantity')&&event.code==='Enter'){event.preventDefault();action();return;}
    if(['KeyI','Escape'].includes(event.code)){event.preventDefault();event.stopPropagation();if(!event.repeat)onClose();return;}
    if(event.target.matches?.('input,select'))return;
    if(event.key==='/'){event.preventDefault();$('inventory-search').focus();return;}
    if(['ArrowLeft','ArrowRight'].includes(event.code)){
      event.preventDefault();const i=CATEGORIES.findIndex(c=>c[0]===view.category);
      view.category=CATEGORIES[Math.max(0,Math.min(CATEGORIES.length-1,i+(event.code==='ArrowRight'?1:-1)))][0];render();return;
    }
    if(['ArrowDown','ArrowUp','KeyE','KeyF','KeyJ','KeyR','Slash'].includes(event.code)){event.preventDefault();event.stopPropagation();if(event.repeat&&!event.code.startsWith('Arrow'))return;
      if(event.code==='Slash')$('inventory-search').focus();
      else if(event.code==='KeyE')action();else if(event.code==='KeyF')mark('favorites');else if(event.code==='KeyJ')mark('junk');else if(event.code==='KeyR')drop();
      else{const i=visible.findIndex(r=>r.id===selected);select(visible[Math.max(0,Math.min(visible.length-1,i+(event.code==='ArrowDown'?1:-1)))]?.id,true);}
    }
  }
  root.addEventListener('keydown',handleKey);
  return {render,handleKey,update:preview.update,
    open(next={kind:'inventory'}){
      if(next.kind!==context.kind)view.category='all';
      context=next;side=next.kind==='merchant'?'buy':['container','take'].includes(next.kind)?'take':'own';
      status('');view.filter='all';view.query='';$('inventory-filter').value='all';$('inventory-search').value='';render();
      requestAnimationFrame(()=>{if(!root.classList.contains('hidden'))(root.querySelector('[data-item][tabindex="0"]')||root).focus({preventScroll:true});});
    },
    close(){$('item-reader').close();},
    state:()=>({context:context.kind,side,selected,view:{...view},visible:visible.map(r=>r.id),weight:inventory.weight(),capacity:inventory.capacity()}),
  };
}
