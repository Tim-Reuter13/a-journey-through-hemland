import { ITEMS,CATEGORIES,EQUIPMENT_SLOTS,equipSlot,isEquipment,itemPower,sellPrice } from '../systems/items.js';
import { filterItems } from '../systems/inventory.js';
import { icon,typeIcon } from './inventoryIcons.js';
import { createItemPreview } from './itemPreview.js';
import { itemThumb } from './itemThumbs.js';
import { createPaperDoll } from './paperDoll.js';
import './inventory.css';

// The Rucksack: what the wanderer carries, seen as if looking into the pack. Left the wanderer as a little figure
// between their armour slots (head, chest, hands, feet, like a crafting game's) and their gear (blade, bow, cloak,
// charm); in the middle the pack as a grid of item pictures with tabs, search and sort; right the chosen item,
// turning in 3D, with what it would change. Drag an item onto its slot to put it on, a worn one back into the
// pack to take it off; trading and chests use the same grid. The menu hub on top leads to the other books.
const number=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarityClass=item=>({gewöhnlich:'common',ungewöhnlich:'uncommon',selten:'rare',einzigartig:'unique'}[item.rarity]||'common');
const SLOT_NAMES={head:'Kopf',armor:'Brust',hands:'Hände',feet:'Füße',weapon:'Waffe',ranged:'Bogen',cloak:'Umhang',accessory:'Schmuck'};
const LEFT=['head','armor','hands','feet'],RIGHT=['weapon','ranged','cloak','accessory'];
const SORTS=[['name','Name'],['power','Stärke'],['value','Wert'],['weight','Gewicht'],['rarity','Seltenheit'],['quantity','Anzahl']];
const POWER_LABEL=item=>item.damage!==undefined?'Schaden':item.armor!==undefined?'Rüstung':item.magic?'Magiebonus':item.carry?'Traglast':item.heal?'Heilung':item.stamina?'Ausdauer':'';

export function createInventoryUI({root,player,inventory,onChange,onClose,onHeal,onPerks,onNavigate,doll}){
  root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Rucksack und Ausrüstung');
  const slotButton=slot=>`<button class="inv-slot" data-slot="${slot}" aria-label="${SLOT_NAMES[slot]}"><span class="inv-slot-ghost">${icon(typeIcon(slot))}</span><img alt="" draggable="false"><span class="inv-slot-name">${SLOT_NAMES[slot]}</span></button>`;
  root.innerHTML=`<div class="inv-shell">
    <header class="inv-top">
      <nav class="inv-hub" aria-label="Menüs">
        <button data-hub="inventory" aria-current="page"><kbd>I</kbd><span>Rucksack</span></button>
        <button data-hub="spellbook"><kbd>B</kbd><span>Zauberbuch</span></button>
        <button data-hub="skills"><kbd>K</kbd><span>Pfade der Glut</span><b class="inv-hub-badge" hidden></b></button>
        <button data-hub="journal"><kbd>J</kbd><span>Chronik</span></button>
      </nav>
      <div class="inv-context"><span class="inv-eyebrow" id="inventory-context"></span><h2 id="inventory-title">Rucksack</h2></div>
      <div id="inventory-modes" class="inv-modes"></div>
      <button id="inventory-close" class="inv-close" aria-label="Rucksack schließen">${icon('close')}</button>
    </header>
    <div class="inv-body">
      <section class="inv-gear" aria-label="Ausrüstung">
        <div class="inv-gear-head"><span class="inv-eyebrow">Ausrüstung</span><b id="inv-level"></b></div>
        <div class="inv-figure">
          <div class="inv-slots">${LEFT.map(slotButton).join('')}</div>
          <div class="inv-doll" id="inv-doll"><div class="inv-doll-floor"></div><span class="inv-doll-hint">Ziehen zum Drehen</span></div>
          <div class="inv-slots">${RIGHT.map(slotButton).join('')}</div>
        </div>
        <div class="inv-stats" id="inventory-stats"></div>
        <div id="inventory-perks" class="inv-perks"></div>
      </section>
      <section class="inv-pack" aria-label="Rucksack">
        <div class="inv-tabs" id="inventory-categories" role="tablist" aria-label="Kategorien"></div>
        <div class="inv-tools">
          <label class="inv-search">${icon('search')}<input id="inventory-search" type="search" placeholder="Suchen …" aria-label="Gegenstände suchen" autocomplete="off" spellcheck="false"><kbd>/</kbd></label>
          <label class="inv-select"><span>Sortieren</span><select id="inventory-sort" aria-label="Sortieren">${SORTS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="inv-select"><span>Zeigen</span><select id="inventory-filter" aria-label="Bestand filtern"><option value="all">Alles</option><option value="favorites">Favoriten</option><option value="equipped">Angelegt</option><option value="junk">Plunder</option></select></label>
        </div>
        <div class="inv-slot-filter" id="inv-slot-filter" hidden></div>
        <div class="inv-grid-scroll" id="inv-grid-scroll"><div class="inv-grid" id="inventory-grid" role="listbox" aria-label="Gegenstände"></div>
          <div id="inventory-empty" class="inv-empty hidden"><span>Hier liegt nichts.</span><button id="inventory-clear">Filter zurücksetzen</button></div></div>
        <div class="inv-pack-foot"><span id="inventory-count"></span><button id="sell-junk" class="hidden">Plunder verkaufen</button></div>
      </section>
      <aside class="inv-detail" aria-label="Gegenstandsdetails">
        <div class="inv-preview"><div id="item-preview"></div><span class="inv-preview-hint">Ziehen zum Drehen</span></div>
        <div id="inventory-detail-body" class="inv-detail-body"></div>
      </aside>
    </div>
    <div id="inventory-message" class="inv-message" role="status" aria-live="polite"></div>
    <footer class="inv-foot">
      <div class="inv-carry"><div class="inv-carry-row"><span>Traglast</span><b id="inventory-weight"></b></div><div class="inv-carry-track"><i id="inventory-weight-fill"></i></div></div>
      <div class="inv-gold">${icon('coin')}<div><span>Gold</span><b id="inventory-gold"></b></div></div>
      <div class="inv-keys"><span><kbd>←↑↓→</kbd>Wählen</span><span><kbd>E</kbd>Benutzen</span><span><kbd>⇧ ←→</kbd>Reiter</span><span><kbd>F</kbd>Favorit</span><span><kbd>X</kbd>Plunder</span><span><kbd>R</kbd>Ablegen</span><span><kbd>/</kbd>Suche</span><span><kbd>I</kbd>Schließen</span></div>
    </footer>
    <dialog id="item-reader"><button id="reader-close" class="inv-close" aria-label="Buch schließen">${icon('close')}</button><span class="inv-eyebrow">Aufzeichnungen</span><h2 id="reader-title"></h2><p id="reader-text"></p></dialog>
  </div>`;
  const $=id=>root.querySelector('#'+id),preview=createItemPreview($('item-preview'));
  const figure=doll?createPaperDoll($('inv-doll'),doll):null;
  let view={category:'all',query:'',filter:'all',sort:'name',direction:1,slot:null},selected=null,visible=[],context={kind:'inventory'},side='own',lastEquip='';
  try{const saved=JSON.parse(localStorage.getItem('ashen-inventory-view-v2'));if(saved){if(CATEGORIES.some(c=>c[0]===saved.category))view.category=saved.category;if(SORTS.some(s=>s[0]===saved.sort))view.sort=saved.sort;view.direction=saved.direction===-1?-1:1;}}catch{}
  const remember=()=>{try{localStorage.setItem('ashen-inventory-view-v2',JSON.stringify({category:view.category,sort:view.sort,direction:view.direction}));}catch{}};
  const source=()=>side==='buy'?player.merchant.stock:side==='take'?context.items:undefined;
  const own=()=>side==='own'||side==='sell'||side==='store';
  const selectedItem=()=>visible.find(item=>item.id===selected)||(selected&&ownRow(selected));
  const ownRow=id=>{const row=inventory.rows().find(r=>r.id===id);return row&&{...row};};
  let messageTimer=0;
  const status=(message,error=false)=>{const el=$('inventory-message');el.textContent=message;el.classList.toggle('error',error);el.classList.remove('show');void el.offsetWidth;if(message)el.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>el.classList.remove('show'),2600);};
  const quantity=()=>Math.max(1,Math.min(maxQuantity(),Math.floor(Number($('item-quantity')?.value)||1)));
  function maxQuantity(){const item=selectedItem();if(!item)return 1;return Math.max(1,own()?inventory.available(item.id):item.quantity);}
  function changed(message){onChange();render();status(message);}

  // ── Actions.
  function equipToggle(id){
    const item=ITEMS[id];if(!isEquipment(item))return false;
    const on=inventory.equipped(id),ok=on?inventory.unequip(id):inventory.equip(id);
    if(ok){selected=id;changed(`${item.name} ${on?'abgelegt':'angelegt'}.`);root.querySelector(`.inv-slot[data-slot="${equipSlot(item)}"]`)?.classList.add('stamp');if(!on)figure?.refresh(true);}
    else status(on?'Dafür ist kein Platz im Rucksack.':'Das lässt sich gerade nicht anlegen.',true);
    return ok;
  }
  function action(){
    const item=selectedItem();if(!item)return;const n=quantity();let result;
    if(side==='buy'){result=inventory.buy(item.id,n);if(result.ok)changed(`${n} × ${item.name} gekauft.`);}
    else if(side==='sell'){result=inventory.sell(item.id,n);if(result.ok)changed(`${n} × ${item.name} verkauft.`);}
    else if(side==='take'||side==='store'){result={ok:inventory.transfer(item.id,n,context.items,side==='take'),message:side==='take'?'Nicht genug Platz im Rucksack.':'Angelegtes zuerst ablegen.'};if(result.ok)changed(`${n} × ${item.name} ${side==='take'?'genommen':'eingelagert'}.`);}
    else if(isEquipment(item)){equipToggle(item.id);return;}
    else if(item.id==='heiltrank'){result=onHeal();if(result.ok)changed(result.message);}
    else if(item.type==='food'||item.type==='consumable'){result=inventory.consume(item.id);if(result.ok)changed(result.message);}
    else if(item.type==='book'){$('reader-title').textContent=item.name;$('reader-text').textContent=item.body;$('item-reader').showModal();return;}
    if(result&&!result.ok)status(result.message||'Das geht gerade nicht.',true);
  }
  function mark(kind){if(own()&&selected&&inventory.mark(selected,kind))changed(kind==='favorites'?'Favoriten aktualisiert.':'Plunder aktualisiert.');}
  function drop(){if(!own()||!selected)return;const result=inventory.drop(selected,quantity());if(result.ok)changed('In einem Beutel zu deinen Füßen abgelegt. Mit E wieder aufnehmen.');else status(result.message,true);}

  // ── The chosen item.
  function detail(){
    const item=selectedItem();preview.show(item);
    const body=$('inventory-detail-body');
    if(!item){body.innerHTML='<p class="inv-desc inv-muted">Wähle etwas aus dem Rucksack, um es genauer zu betrachten.</p>';root.querySelector('.inv-detail').dataset.rarity='common';return;}
    root.querySelector('.inv-detail').dataset.rarity=rarityClass(item);
    const equipped=own()&&inventory.equipped(item.id),label=POWER_LABEL(item),power=itemPower(item);
    const powerKey=['damage','armor','magic','carry'].find(key=>item[key]!==undefined);
    const slot=equipSlot(item),old=ITEMS[player.equipment[slot]],difference=power-(old?.[powerKey]||0);
    const compare=isEquipment(item)&&!equipped?`<div class="inv-compare ${difference>0?'up':difference<0?'down':''}"><b>${difference>0?'▲ +':difference<0?'▼ ':'= '}${number(difference)}</b><span>${old?`gegenüber ${escape(old.name)}`:`${SLOT_NAMES[slot]} ist leer`}</span></div>`:equipped?'<div class="inv-compare on"><b>◆</b><span>Trägst du gerade</span></div>':'';
    const disabled=item.locked||(own()&&!inventory.available(item.id)&&side!=='own'&&!(isEquipment(item)&&equipped))||(side==='own'&&!isEquipment(item)&&!['consumable','food','book'].includes(item.type));
    const verb=side==='buy'?'Kaufen':side==='sell'?'Verkaufen':side==='take'?'Nehmen':side==='store'?'Einlagern':isEquipment(item)?equipped?'Ablegen':'Anlegen':item.type==='book'?'Lesen':item.type==='food'?'Essen':item.type==='consumable'?'Trinken':item.locked?'Questgegenstand':'Material';
    const price=side==='sell'?sellPrice(item.id):item.value,max=maxQuantity();
    body.innerHTML=`<div class="inv-chips"><span class="inv-rarity ${rarityClass(item)}">${escape(item.rarity)}</span><span>${escape(item.subtype)}</span>${item.locked?'<span class="inv-chip-quest">Quest</span>':''}${own()&&item.favorite?'<span>★ Favorit</span>':''}${own()&&item.junk?'<span>Plunder</span>':''}</div>
      <h3>${escape(item.name)}</h3>
      ${label?`<div class="inv-power"><span>${label}</span><b>${number(power)}</b>${compare}</div>`:''}
      <div class="inv-measures"><div><span>Gewicht</span><b>${number(item.weight)}</b></div><div><span>${side==='sell'?'Erlös':side==='buy'?'Preis':'Wert'}</span><b>${number(price)}</b></div><div><span>${side==='buy'?'Vorrat':'Im Rucksack'}</span><b>${item.quantity}</b></div></div>
      <p class="inv-desc">${escape(item.description)}</p>
      <div class="inv-actions">
        <div class="inv-primary-row"><button id="item-primary" class="inv-primary" ${disabled?'disabled':''}><span>${verb}</span>${side==='buy'||side==='sell'?`<small id="item-total">${number(price)} G</small>`:'<kbd>E</kbd>'}</button>
          <div class="inv-qty" ${max<=1?'hidden':''}><button data-q="-1" aria-label="Weniger">−</button><input id="item-quantity" aria-label="Menge" type="number" min="1" max="${max}" value="1"><button data-q="1" aria-label="Mehr">+</button></div></div>
        ${own()?`<div class="inv-secondary"><button id="item-favorite" aria-pressed="${!!item.favorite}" ${item.locked?'disabled':''}>${item.favorite?'★':'☆'} Favorit</button><button id="item-junk" aria-pressed="${!!item.junk}" ${item.locked||equipped?'disabled':''}>Plunder</button><button id="item-drop" ${item.locked||!inventory.available(item.id)?'disabled':''}>Ablegen</button></div>`:''}
      </div>`;
    $('item-primary').onclick=action;
    const total=()=>{if($('item-total'))$('item-total').textContent=number(price*quantity())+' G';};
    $('item-quantity')?.addEventListener('input',total);
    body.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const q=$('item-quantity');q.value=Math.max(1,Math.min(max,(+q.value||1)+(+b.dataset.q)));total();});
    if(own()){$('item-favorite').onclick=()=>mark('favorites');$('item-junk').onclick=()=>mark('junk');$('item-drop').onclick=drop;}
  }

  // ── Everything else.
  function gear(){
    for(const slot of EQUIPMENT_SLOTS){
      const el=root.querySelector(`.inv-slot[data-slot="${slot}"]`),id=player.equipment[slot],item=ITEMS[id],img=el.querySelector('img');
      el.dataset.equipment=id||'';el.classList.toggle('filled',!!item);el.classList.toggle('selected',!!id&&id===selected);
      el.className=el.className.replace(/\b(common|uncommon|rare|unique)\b/g,'').trim()+(item?' '+rarityClass(item):'');
      const url=item?itemThumb({id,...item}):null;if(url){img.src=url;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}
      el.title=item?`${SLOT_NAMES[slot]}: ${item.name}`:`${SLOT_NAMES[slot]}: leer`;
    }
    const key=JSON.stringify(player.equipment);if(key!==lastEquip){lastEquip=key;figure?.refresh();}
    const armor=EQUIPMENT_SLOTS.reduce((sum,slot)=>sum+(ITEMS[player.equipment[slot]]?.armor||0),0);
    const damage=(ITEMS[player.equipment.weapon]?.damage||0)+player.attributes.strength*3+(player.perks.includes('schwertmeister')?12:0);
    const stat=(k,label,v,cls='')=>`<div class="inv-stat ${cls}"><span>${label}</span><b>${v}</b></div>`;
    $('inventory-stats').innerHTML=stat('armor','Rüstung',armor)+stat('dmg','Schaden',damage)+stat('hp','Leben',`${Math.ceil(player.hp)}<small>/${player.maxHp}</small>`,'hp')+stat('mp','Magicka',`${Math.ceil(player.magicka??100)}<small>/${player.maxMagicka??100}</small>`,'mp');
    $('inv-level').textContent=`Stufe ${player.level} · Wanderer`;
  }
  function render(){
    const rows=inventory.rows(source()).map(item=>({...item,equipped:own()&&item.equipped,favorite:own()&&item.favorite,junk:own()&&item.junk}));
    visible=filterItems(rows,view).filter(r=>!view.slot||isEquipment(r)&&equipSlot(r)===view.slot);
    if(!visible.some(item=>item.id===selected)&&!(selected&&own()&&inventory.equipped(selected)))selected=visible[0]?.id??null;
    const merchant=context.kind==='merchant',chest=['container','take'].includes(context.kind);
    $('inventory-context').textContent=merchant?'Handel':chest?'Aufbewahrung':'Was du bei dir trägst';
    $('inventory-title').textContent=context.name||(merchant?'Bryns Waren':'Rucksack');
    root.classList.toggle('trading',merchant);root.classList.toggle('storing',chest);
    const modes=merchant?[['buy','Kaufen'],['sell','Verkaufen']]:context.kind==='container'?[['take','Nehmen'],['store','Einlagern']]:[];
    $('inventory-modes').innerHTML=modes.map(([id,label])=>`<button data-side="${id}" aria-pressed="${side===id}">${label}</button>`).join('');
    const all=inventory.rows(source());
    $('inventory-categories').innerHTML=CATEGORIES.filter(([id])=>id==='all'||all.some(r=>r.type===id)||view.category===id).map(([id,name,glyph])=>`<button role="tab" data-category="${id}" aria-selected="${view.category===id}" title="${name}">${icon(glyph)}<span>${id==='all'?'Alles':name}</span><small>${all.filter(r=>id==='all'||r.type===id).reduce((s,r)=>s+r.quantity,0)}</small></button>`).join('');
    $('inventory-sort').value=view.sort;
    const sf=$('inv-slot-filter');sf.hidden=!view.slot;if(view.slot)sf.innerHTML=`<span>Passend für <b>${SLOT_NAMES[view.slot]}</b></span><button data-clear-slot aria-label="Filter aufheben">✕</button>`;
    const scroll=$('inv-grid-scroll').scrollTop;
    $('inventory-grid').innerHTML=visible.map(item=>{const url=itemThumb(item);return `<button class="inv-cell ${rarityClass(item)}${item.equipped?' worn':''}${item.junk?' junk':''}" data-item="${item.id}" role="option" aria-selected="${selected===item.id}" tabindex="${selected===item.id?0:-1}" data-name="${escape(item.name)}" aria-label="${escape(item.name)}${item.quantity>1?`, ${item.quantity} Stück`:''}">
      ${url?`<img src="${url}" alt="" draggable="false">`:`<span class="inv-cell-icon">${icon(typeIcon(item.slot||item.type))}</span>`}
      ${item.quantity>1?`<span class="inv-qty-badge">${item.quantity>999?'999+':item.quantity}</span>`:''}${item.equipped?'<i class="inv-worn" title="Angelegt">◆</i>':''}${item.favorite?'<i class="inv-fav" title="Favorit">★</i>':''}${item.locked?'<i class="inv-quest" title="Questgegenstand">◇</i>':''}
      ${side==='buy'||side==='sell'?`<span class="inv-price">${number(side==='sell'?sellPrice(item.id):item.value)}</span>`:''}</button>`;}).join('');
    $('inv-grid-scroll').scrollTop=scroll;
    $('inventory-empty').classList.toggle('hidden',visible.length>0);
    $('inventory-count').textContent=merchant?`Bryn hat ${number(player.merchant.gold)} Gold`:`${visible.length} von ${all.length} Sorten${view.query?' · Suche':''}`;
    $('sell-junk').classList.toggle('hidden',side!=='sell');
    gear();
    const weight=inventory.weight(),limit=inventory.capacity();$('inventory-weight').textContent=`${number(weight)} / ${number(limit)}`;
    $('inventory-weight-fill').style.width=Math.min(100,weight/limit*100)+'%';root.classList.toggle('overburdened',weight>limit);
    $('inventory-gold').textContent=number(player.gold);
    const badge=root.querySelector('.inv-hub-badge');badge.hidden=!(player.perkPoints>0);badge.textContent=player.perkPoints;
    $('inventory-perks').innerHTML='';onPerks?.($('inventory-perks'));
    detail();remember();
  }
  function select(id,focus=false){
    selected=id;
    root.querySelectorAll('[data-item]').forEach(cell=>{const active=cell.dataset.item===id;cell.setAttribute('aria-selected',String(active));cell.tabIndex=active?0:-1;if(active&&focus){cell.focus({preventScroll:true});cell.scrollIntoView({block:'nearest'});}});
    root.querySelectorAll('.inv-slot').forEach(s=>s.classList.toggle('selected',!!id&&s.dataset.equipment===id));
    detail();
  }
  function category(step){const list=[...root.querySelectorAll('[data-category]')].map(b=>b.dataset.category),i=list.indexOf(view.category);view.category=list[Math.max(0,Math.min(list.length-1,i+step))];view.slot=null;render();}
  const columns=()=>Math.max(1,getComputedStyle($('inventory-grid')).gridTemplateColumns.split(' ').filter(Boolean).length);

  // ── Drag an item onto its slot (mouse and pen; on touch a tap chooses and the button or a double tap acts).
  let press=null,ghost=null;
  function startDrag(){
    const item=ITEMS[press.id];if(!item)return;
    ghost=document.createElement('div');ghost.className=`inv-ghost ${rarityClass(item)}`;const url=itemThumb({id:press.id,...item});ghost.innerHTML=url?`<img src="${url}" alt="">`:icon(typeIcon(item.slot||item.type));
    root.append(ghost);root.classList.add('dragging');
    if(press.from==='grid'&&isEquipment(item)&&own())root.querySelector(`.inv-slot[data-slot="${equipSlot(item)}"]`)?.classList.add('drop-ok');
    if(press.from==='slot')root.querySelector('.inv-pack').classList.add('drop-ok');
  }
  function endDrag(){ghost?.remove();ghost=null;root.classList.remove('dragging');root.querySelectorAll('.drop-ok,.drop-hot').forEach(el=>el.classList.remove('drop-ok','drop-hot'));}
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch')return;
    const cell=event.target.closest('[data-item]'),slot=event.target.closest('.inv-slot.filled');
    if(!cell&&!slot)return;
    press={id:cell?cell.dataset.item:slot.dataset.equipment,from:cell?'grid':'slot',x:event.clientX,y:event.clientY,dragging:false};
  });
  addEventListener('pointermove',event=>{
    if(!press)return;
    if(!press.dragging&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>7&&own()){press.dragging=true;startDrag();}
    if(!press.dragging||!ghost)return;
    ghost.style.transform=`translate(${event.clientX}px,${event.clientY}px)`;
    const over=document.elementFromPoint(event.clientX,event.clientY);
    root.querySelectorAll('.drop-hot').forEach(el=>el.classList.remove('drop-hot'));
    over?.closest('.drop-ok')?.classList.add('drop-hot');
  });
  addEventListener('pointerup',event=>{
    if(!press)return;const p=press;press=null;
    if(!p.dragging)return;
    const over=document.elementFromPoint(event.clientX,event.clientY)?.closest('.drop-ok');endDrag();
    if(!over)return;
    if(p.from==='grid'&&over.classList.contains('inv-slot')&&!inventory.equipped(p.id))equipToggle(p.id);
    else if(p.from==='slot'&&over.classList.contains('inv-pack')&&inventory.equipped(p.id))equipToggle(p.id);
  });

  $('inventory-close').onclick=onClose;$('reader-close').onclick=()=>$('item-reader').close();
  $('inventory-search').addEventListener('input',e=>{view.query=e.target.value;render();});
  $('inventory-filter').onchange=e=>{view.filter=e.target.value;render();};
  $('inventory-sort').onchange=e=>{view.sort=e.target.value;view.direction=view.sort==='name'?1:-1;render();};
  $('inventory-clear').onclick=()=>{view.query='';view.category='all';view.filter='all';view.slot=null;$('inventory-search').value='';$('inventory-filter').value='all';render();};
  root.addEventListener('click',event=>{
    const hub=event.target.closest('[data-hub]');if(hub){if(hub.dataset.hub!=='inventory')onNavigate?.(hub.dataset.hub);return;}
    const item=event.target.closest('[data-item]');if(item)select(item.dataset.item);
    const cat=event.target.closest('[data-category]');if(cat){view.category=cat.dataset.category;view.slot=null;render();}
    if(event.target.closest('[data-clear-slot]')){view.slot=null;render();}
    const mode=event.target.closest('[data-side]');if(mode){side=mode.dataset.side;view.filter='all';view.slot=null;$('inventory-filter').value='all';render();}
    const slot=event.target.closest('.inv-slot');
    if(slot&&context.kind!=='take'){
      // A worn item: show it. An empty slot: show what would fit there.
      if(slot.dataset.equipment){side=context.kind==='merchant'?'sell':context.kind==='container'?'store':'own';selected=slot.dataset.equipment;view.slot=null;render();}
      else{side=context.kind==='merchant'?'sell':context.kind==='container'?'store':'own';view.slot=slot.dataset.slot;view.category='all';render();}
    }
  });
  root.addEventListener('dblclick',event=>{if(event.target.closest('[data-item]'))action();else{const s=event.target.closest('.inv-slot.filled');if(s&&own())equipToggle(s.dataset.equipment);}});
  $('sell-junk').onclick=()=>{const sold=inventory.sellJunk();if(sold)changed(`${sold} Gegenstände als Plunder verkauft.`);else status('Kein verkaufbarer Plunder oder nicht genug Händlergold.',true);};
  function handleKey(event){
    event.stopPropagation();
    if($('item-reader').open){if(event.code==='KeyI'){event.preventDefault();onClose();return;}if(event.code==='Escape'){event.preventDefault();$('item-reader').close();}return;}
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
    if(event.code==='KeyI'){event.preventDefault();if(!event.repeat)onClose();return;}
    if(event.target.matches?.('input,select'))return;
    if(!event.repeat&&{KeyB:'spellbook',KeyK:'skills',KeyJ:'journal'}[event.code]){event.preventDefault();onNavigate?.({KeyB:'spellbook',KeyK:'skills',KeyJ:'journal'}[event.code]);return;}
    if(event.key==='/'){event.preventDefault();$('inventory-search').focus();return;}
    if(event.code==='PageUp'||event.code==='PageDown'||event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.code)){event.preventDefault();category(event.code==='PageDown'||event.code==='ArrowRight'?1:-1);return;}
    if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','KeyE','Enter','KeyF','KeyX','KeyR'].includes(event.code)){event.preventDefault();if(event.repeat&&!event.code.startsWith('Arrow'))return;
      if(event.code==='KeyE'||event.code==='Enter')action();else if(event.code==='KeyF')mark('favorites');else if(event.code==='KeyX')mark('junk');else if(event.code==='KeyR')drop();
      else{const i=Math.max(0,visible.findIndex(r=>r.id===selected)),c=columns(),step={ArrowRight:1,ArrowLeft:-1,ArrowDown:c,ArrowUp:-c}[event.code];select(visible[Math.max(0,Math.min(visible.length-1,i+step))]?.id,true);}
    }
  }
  root.addEventListener('keydown',handleKey);
  return {render,handleKey,
    update(time){preview.update(time);figure?.update(time);},
    open(next={kind:'inventory'}){
      if(next.kind!==context.kind)view.category='all';
      context=next;side=next.kind==='merchant'?'buy':['container','take'].includes(next.kind)?'take':'own';view.slot=null;
      status('');view.filter='all';view.query='';$('inventory-filter').value='all';$('inventory-search').value='';render();figure?.nudge();
      requestAnimationFrame(()=>{if(!root.classList.contains('hidden'))(root.querySelector('[data-item][tabindex="0"]')||root).focus({preventScroll:true});});
    },
    close(){$('item-reader').close();press=null;endDrag();},
    state:()=>({context:context.kind,side,selected,view:{...view},visible:visible.map(r=>r.id),weight:inventory.weight(),capacity:inventory.capacity()}),
  };
}
