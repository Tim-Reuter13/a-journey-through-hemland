import { STORY_ITEMS } from '../data/hemland/story.js';
export const ITEMS = {
  rostiges_schwert: { name:'Rostiges Schwert',type:'weapon',subtype:'Einhandschwert',damage:32,weight:7,value:12,rarity:'gewöhnlich',description:'Die Schneide hat bessere Tage gesehen. Trotzdem liegt der Griff vertraut in der Hand.',color:0x92918a },
  waechterklinge: { name:'Wächterklinge',type:'weapon',subtype:'Einhandschwert',damage:39,weight:6.5,value:95,rarity:'ungewöhnlich',description:'Bryn hat die Klinge neu ausgeschmiedet. Ein zuverlässiger Begleiter auf den Straßen der Aschmark.',color:0xb9c9cd },
  // The hunting bow sits in its own slot (hotbar 4) beside the blade; arrows are ammunition (systems/archery.js).
  jagdbogen: { name:'Jagdbogen',type:'weapon',slot:'ranged',subtype:'Bogen',damage:30,weight:4,value:70,rarity:'gewöhnlich',description:'Eibe, Hornspitzen an den Enden, Leder am Griff. Bringt einen Hirsch auf sechzig Schritt zu Fall – und einen Mann, der nicht hören will.',color:0x8e5a2e },
  pfeil: { name:'Eisenpfeil',type:'ammo',subtype:'Munition',weight:.05,value:1,rarity:'gewöhnlich',description:'Eschenschaft, eiserne Breitspitze, eine rote Leitfeder. Was im Boden steckt, lässt sich wieder aufheben.',color:0xa07c52 },
  aschenklinge: { name:'Aschenklinge',type:'weapon',subtype:'Einhandschwert',damage:46,weight:5.5,value:180,rarity:'selten',description:'Unter dem dunklen Stahl glimmt ein Rest der alten Feuer. Die Klinge ist erstaunlich leicht.',color:0x78b7c8 },
  reisekleidung: { name:'Reisekleidung',type:'armor',slot:'armor',parts:['tunic','pants','belt','vest'],tints:{tunic:'#33475a',pants:'#3d3129'},subtype:'Leichte Kleidung',armor:2,weight:3,value:8,rarity:'gewöhnlich',description:'Ein wettergegerbter Mantel und festes Leinen. Gemacht für lange Wege, weniger für scharfe Klingen.',color:0x40596d },
  lederwams: { name:'Genähtes Lederwams',type:'armor',slot:'armor',parts:['shirt','pants','leather_armor','belt'],tints:{shirt:'#5a4f40',pants:'#3d3129'},subtype:'Leichte Rüstung',armor:7,weight:6,value:65,rarity:'ungewöhnlich',description:'Mehrere Schichten gegerbtes Leder fangen Hiebe ab, ohne die Beweglichkeit zu sehr einzuschränken.',color:0x79503b },
  aschenrüstung: { name:'Aschenrüstung',type:'armor',slot:'armor',parts:['chainmail','pants','plate','tabard'],tints:{pants:'#2a2420',tabard:'#5e1e1e'},subtype:'Schwere Rüstung',armor:18,weight:13,value:240,rarity:'selten',description:'Die geschwärzten Platten tragen das Zeichen der Plünderer. Schwer, aber widerstandsfähig.',color:0x505c64 },
  // Worn clothing and armour pieces; `parts` are modular character parts (art/blockbench/parts.js).
  banditenkluft: { name:'Plündererkluft',type:'armor',slot:'armor',parts:['shirt','pants','leather_armor','belt'],tints:{shirt:'#4a4540',pants:'#33302c'},subtype:'Leichte Rüstung',armor:5,weight:5,value:30,rarity:'gewöhnlich',description:'Geflicktes Leder über einem rußigen Hemd. Riecht nach Rauch und Rost.',color:0x4a4540 },
  aeltestenrobe: { name:'Robe der Ältesten',type:'armor',slot:'armor',parts:['robe','shawl'],tints:{robe:'#5e2224',shawl:'#9a8f7a'},subtype:'Robe',armor:1,magic:4,weight:2,value:90,rarity:'ungewöhnlich',description:'Weinroter Wollstoff mit einem hellen Schal. Verstärkt Funken um 4 Schaden.',color:0x5e2224 },
  schmiedekluft: { name:'Schmiedekluft',type:'armor',slot:'armor',parts:['shirt','pants','apron'],tints:{shirt:'#5a554e',pants:'#3d3129'},subtype:'Arbeitskleidung',armor:3,weight:4,value:25,rarity:'gewöhnlich',description:'Ein angesengtes Hemd und eine schwere Lederschürze.',color:0x5a554e },
  waldlaeuferkluft: { name:'Waldläuferkluft',type:'armor',slot:'armor',parts:['tunic','pants','leather_armor','belt'],tints:{tunic:'#304334',pants:'#3a3326'},subtype:'Leichte Rüstung',armor:8,weight:5,value:110,rarity:'ungewöhnlich',description:'Grün gefärbtes Leinen unter weichem Leder. Leise im Unterholz.',color:0x304334 },
  leinenkleid: { name:'Leinenkleid',type:'armor',slot:'armor',parts:['dress','belt'],tints:{dress:'#4a5a3a'},subtype:'Kleidung',armor:0,weight:2,value:15,rarity:'gewöhnlich',description:'Ein schlichtes, gut geschnittenes Kleid.',color:0x4a5a3a },
  bauernkleidung: { name:'Bauernkleidung',type:'armor',slot:'armor',parts:['shirt','pants','belt'],tints:{shirt:'#8a7f6a',pants:'#4a3f35'},subtype:'Kleidung',armor:0,weight:2,value:6,rarity:'gewöhnlich',description:'Grobes Leinen für die Feldarbeit.',color:0x8a7f6a },
  wachpanzer: { name:'Kettenhemd der Wache',type:'armor',slot:'armor',parts:['chainmail','pants','tabard','belt'],tints:{tabard:'#2f4a6a',pants:'#2a2420'},subtype:'Mittlere Rüstung',armor:12,weight:10,value:140,rarity:'ungewöhnlich',description:'Ein Kettenhemd unter dem blauen Wappenrock der Stadtwache.',color:0x2f4a6a },
  hauptmannsplatte: { name:'Platte des Hauptmanns',type:'armor',slot:'armor',parts:['chainmail','pants','plate','tabard'],tints:{tabard:'#6a1c1e',pants:'#2a2420'},subtype:'Schwere Rüstung',armor:20,weight:15,value:300,rarity:'selten',description:'Dunkle Platten über Kettengeflecht, darüber ein blutroter Wappenrock.',color:0x6a1c1e },
  kapuze: { name:'Wollkapuze',type:'armor',slot:'head',parts:['hood'],tints:{hood:'#33452f'},subtype:'Kopf',armor:1,weight:.5,value:10,rarity:'gewöhnlich',description:'Hält Regen und neugierige Blicke ab.',color:0x33452f },
  eisenhelm: { name:'Eisenhelm',type:'armor',slot:'head',parts:['iron_helmet'],subtype:'Helm',armor:5,weight:3,value:45,rarity:'gewöhnlich',description:'Ein Nasalhelm aus grobem Eisen.',color:0x666d71 },
  topfhelm: { name:'Topfhelm des Hauptmanns',type:'armor',slot:'head',parts:['great_helm'],subtype:'Helm',armor:8,weight:4.5,value:120,rarity:'selten',description:'Durch den schmalen Sehschlitz sieht die Welt sehr klein aus.',color:0x373d42 },
  wachhelm: { name:'Eisenhut der Wache',type:'armor',slot:'head',parts:['guard_helmet'],subtype:'Helm',armor:6,weight:3,value:60,rarity:'gewöhnlich',description:'Eine breite Krempe gegen Regen und Pfeile.',color:0x666d71 },
  strohhut: { name:'Strohhut',type:'armor',slot:'head',parts:['straw_hat'],subtype:'Kopf',armor:0,weight:.3,value:4,rarity:'gewöhnlich',description:'Für lange Tage auf dem Feld.',color:0xb09358 },
  banditenmaske: { name:'Plünderertuch',type:'armor',slot:'head',parts:['mask','headband'],tints:{mask:'#3c3833',headband:'#7a2626'},subtype:'Kopf',armor:1,weight:.2,value:5,rarity:'gewöhnlich',description:'Rotes Stirnband und ein Tuch vor Mund und Nase.',color:0x7a2626 },
  goldreif: { name:'Goldreif',type:'armor',slot:'head',parts:['crown'],subtype:'Krone',armor:0,magic:5,weight:.5,value:900,rarity:'einzigartig',description:'Ein schmaler Reif mit einem Rubin. Kein Bauer würde ihn je tragen.',color:0xdfb84a },
  wanderstiefel: { name:'Wanderstiefel',type:'armor',slot:'feet',parts:['boots'],subtype:'Füße',armor:1,weight:1.5,value:12,rarity:'gewöhnlich',description:'Eingelaufen und wasserdicht.',color:0x2e231b },
  lederschuhe: { name:'Lederschuhe',type:'armor',slot:'feet',parts:['shoes'],subtype:'Füße',armor:0,weight:.8,value:6,rarity:'gewöhnlich',description:'Weiche Schuhe für Dorfwege.',color:0x5c3d2a },
  armschienen: { name:'Lederne Armschienen',type:'armor',slot:'hands',parts:['bracers'],subtype:'Arme',armor:2,weight:1,value:18,rarity:'gewöhnlich',description:'Schützen Unterarme vor Klingen und Dornen.',color:0x37261b },
  lederhandschuhe: { name:'Lederhandschuhe',type:'armor',slot:'hands',parts:['gloves'],subtype:'Hände',armor:1,weight:.5,value:10,rarity:'gewöhnlich',description:'Dicke Handschuhe, wie Schmiede sie tragen.',color:0x2c1e15 },
  reiseumhang: { name:'Reiseumhang',type:'armor',slot:'cloak',parts:['cloak'],tints:{cloak:'#2f3f52'},subtype:'Umhang',armor:1,weight:1.5,value:20,rarity:'gewöhnlich',description:'Schwere Wolle, die im Wind schlägt.',color:0x2f3f52 },
  roter_umhang: { name:'Roter Umhang',type:'armor',slot:'cloak',parts:['cloak'],tints:{cloak:'#5e1e1e'},subtype:'Umhang',armor:1,weight:1.5,value:60,rarity:'ungewöhnlich',description:'Die Farbe der Plündererhauptleute.',color:0x5e1e1e },
  wollschal: { name:'Wollschal',type:'armor',slot:'cloak',parts:['shawl'],tints:{shawl:'#9a8f7a'},subtype:'Umhang',armor:0,weight:.5,value:8,rarity:'gewöhnlich',description:'Warm und kratzig.',color:0x9a8f7a },
  glutamulett: { name:'Glutamulett',type:'accessory',subtype:'Amulett',magic:6,weight:.2,value:110,rarity:'selten',description:'Ein warmer Stein in einer Fassung aus Messing. Verstärkt Funken um 6 Schaden.',color:0xef9751 },
  wandereramulett: { name:'Zeichen des Wanderers',type:'accessory',subtype:'Amulett',carry:15,weight:.2,value:55,rarity:'ungewöhnlich',description:'Ein kleines Andenken an ungezählte Reisen. Erhöht die Traglast um 15.',color:0x7ab59a },
  heiltrank: { name:'Heiltrank',type:'consumable',subtype:'Wiederherstellung',heal:45,weight:.5,value:25,rarity:'gewöhnlich',description:'Ein roter Trank aus Waldkräutern. Stellt beim Trinken 45 Leben wieder her.',color:0xb52d45 },
  ausdauertrank: { name:'Ausdauertrank',type:'consumable',subtype:'Wiederherstellung',stamina:55,weight:.4,value:18,rarity:'gewöhnlich',description:'Herb, kühl und belebend. Stellt sofort 55 Ausdauer wieder her.',color:0x5dba89 },
  reisefladen: { name:'Reisefladen',type:'food',subtype:'Proviant',heal:12,weight:.2,value:4,rarity:'gewöhnlich',description:'Ein haltbarer Fladen mit getrockneten Kräutern. Stellt 12 Leben wieder her.',color:0xc39552 },
  waldapfel: { name:'Waldapfel',type:'food',subtype:'Proviant',heal:6,stamina:10,weight:.2,value:3,rarity:'gewöhnlich',description:'Klein, säuerlich und frisch. Stellt 6 Leben und 10 Ausdauer wieder her.',color:0x9d3f31 },
  eisenerz: { name:'Eisenerz',type:'material',subtype:'Schmiedematerial',resource:'ironOre',weight:1.5,value:9,rarity:'gewöhnlich',description:'Ein schwerer Brocken mit dunklen Eisenadern. Bryn kauft brauchbares Erz für seine Schmiede.',color:0x777a7f },
  leder: { name:'Lederstreifen',type:'material',subtype:'Handwerksmaterial',resource:'leather',weight:.3,value:7,rarity:'gewöhnlich',description:'Gegerbtes Leder für Riemen, Griffe und leichte Rüstungen.',color:0x76503c },
  // Hunting spoils (systems/wildlife.js).
  wildbret: { name:'Wildbret',type:'food',subtype:'Proviant',heal:18,weight:.6,value:9,rarity:'gewöhnlich',description:'Frisches Fleisch vom Wild, noch warm. Stellt 18 Leben wieder her.',color:0x8a3a30 },
  hirschfell: { name:'Hirschfell',type:'misc',subtype:'Jagdbeute',weight:2.5,value:24,rarity:'gewöhnlich',description:'Ein rotbraunes Fell mit hellem Bauch. Gerber und Händler zahlen ordentlich dafür.',color:0x9a6a3e },
  geweih: { name:'Hirschgeweih',type:'misc',subtype:'Jagdbeute',weight:1.5,value:18,rarity:'gewöhnlich',description:'Ein kurzes Geweih mit zwei Enden. Schnitzer machen daraus Griffe und Knöpfe.',color:0xc8b090 },
  fuchsfell: { name:'Fuchsfell',type:'misc',subtype:'Jagdbeute',weight:.8,value:30,rarity:'ungewöhnlich',description:'Dicht und rot wie Glut. In Kronwacht trägt man so etwas am Kragen.',color:0xc8662a },
  hasenfell: { name:'Hasenfell',type:'misc',subtype:'Jagdbeute',weight:.3,value:6,rarity:'gewöhnlich',description:'Weich, dünn und schnell verdorben, wenn man es nicht trocknet.',color:0x8a7458 },
  kraehenfedern: { name:'Krähenfedern',type:'misc',subtype:'Jagdbeute',weight:.05,value:2,rarity:'gewöhnlich',description:'Schwarze Schwungfedern. Pfeilmacher nehmen sie gern.',color:0x24242a },
  holz: { name:'Trockenes Holz',type:'material',subtype:'Handwerksmaterial',resource:'wood',weight:1,value:3,rarity:'gewöhnlich',description:'Gut abgelagertes Holz. Als Brennstoff und Werkstoff gefragt.',color:0x8d6846 },
  kraeuter: { name:'Waldkräuter',type:'material',subtype:'Alchemiezutat',resource:'herbs',weight:.1,value:5,rarity:'gewöhnlich',description:'Ein Bündel aromatischer Blätter. Eine häufige Zutat für Heilmittel.',color:0x7b9e64 },
  bernstein: { name:'Aschenbernstein',type:'misc',subtype:'Wertgegenstand',weight:.1,value:32,rarity:'ungewöhnlich',description:'Im goldenen Harz ist ein winziges Blatt eingeschlossen. Bei Händlern begehrt.',color:0xd39a36 },
  reisetagebuch: { name:'Notizen eines Wanderers',type:'book',subtype:'Aufzeichnungen',weight:.3,value:6,rarity:'gewöhnlich',description:'Ein dünnes Büchlein mit Hinweisen auf Dämmerwald und den östlichen Schrein.',color:0x675043,body:'Dämmerwald, am achten Morgen\n\nBei Bryn lässt sich Ausrüstung kaufen und Fundgut verkaufen. Was ich als Plunder markiere, kann ich bei ihm gesammelt abgeben.\n\nDie Reisetruhe steht südlich des Brunnens. Ausgerüstete Dinge trage ich weiter am Körper; sie zählen zum Gewicht meines Gepäcks.\n\nDer Weg nach Osten führt hinauf zum Glutschrein. Elira kennt seine Geschichte. Vielleicht sollte ich zuerst mit ihr sprechen.' },
  glutstein: { name:'Erwachter Glutstein',type:'quest',subtype:'Questgegenstand',weight:0,value:0,rarity:'einzigartig',description:'Die erste Glut brennt wieder. Dieser Stein ist ein Versprechen an Dämmerwald.',color:0x77e4ec,locked:true },
};

// Evidence and keepsakes of the Hemland story (src/data/hemland/story.js).
const STORY_TEXT={
  broken_bolt:'Aus Hannes Wagenwand gezogen. Die Spitze trägt Bryns Schlagmarke.',
  payment_order:'Severins Siegel. Für jeden Namen Silber. Hannes Name steht darauf.',
  grain_ledger:'Sorens Abschrift der Kornlisten. Jede Zeile ist ein Hof, der hungert.',
  soren_testimony:'Sorens Aussage, von Marta aufgeschrieben. Er hat seinen eigenen Namen nicht ausgelassen.',
  gate_writ:'Ivens Passierschein. Er öffnet das Tor, nicht die Türen dahinter.',
  certified_ledger:'Von Ada im Kronentempel beglaubigt. Jetzt kann niemand mehr sagen, es sei nur Papier.',
  burial_boards:'Trockene Bretter vom Holzstapel. Genug für einen Sarg.',
  seed_sack:'Gretes Saatgut. Es muss bis zum Frühjahr Korn bleiben.',
  olt_token:'Olts Holzmarke mit seinen Kerben. Keine Leiche, kein Beweis. Nur das.',
};
for(const item of STORY_ITEMS)ITEMS[item.id]??={name:item.name,type:'quest',subtype:'Questgegenstand',weight:0,value:0,rarity:'einzigartig',description:STORY_TEXT[item.id]??'Ein Beweisstück.',color:0xb9a37a};
export const CATEGORIES=[['all','Alle Gegenstände','all'],['weapon','Waffen','sword'],['ammo','Munition','arrow'],['armor','Rüstung','armor'],['accessory','Schmuck','amulet'],['consumable','Tränke','potion'],['food','Proviant','food'],['material','Materialien','material'],['book','Bücher','book'],['quest','Quest','quest'],['misc','Sonstiges','misc']];
export const RARITY={gewöhnlich:0,ungewöhnlich:1,selten:2,einzigartig:3};
export const INITIAL_SATCHEL={ausdauertrank:1,reisefladen:3,reisetagebuch:1,pfeil:24};
export const INITIAL_MERCHANT={gold:350,stock:{waechterklinge:1,jagdbogen:1,pfeil:80,lederwams:2,wandereramulett:1,glutamulett:1,heiltrank:6,ausdauertrank:4,reisefladen:8,waldapfel:6,kraeuter:6}};
export const isEquipment=item=>['weapon','armor','accessory'].includes(item?.type);
/** Equipment slot an item occupies: weapon, armor (body), head, hands, feet, cloak or accessory. */
export const equipSlot=item=>item?.slot||item?.type;
export const EQUIPMENT_SLOTS=['weapon','ranged','armor','head','hands','feet','cloak','accessory'];
/** Modular outfit (parts + tints) for a set of equipped item ids. */
export function outfitFor(equipment){
  const parts=[],tints={};
  for(const slot of EQUIPMENT_SLOTS){const item=ITEMS[equipment?.[slot]];if(!item?.parts)continue;parts.push(...item.parts);Object.assign(tints,item.tints||{});}
  if(ITEMS[equipment?.weapon]?.type==='weapon')parts.push('scabbard');
  if(ITEMS[equipment?.ranged])parts.push('quiver');
  return {parts,tints};
}
export const itemPower=item=>item.damage??item.armor??item.magic??item.carry??item.heal??item.stamina??0;
export const sellPrice=id=>Math.max(1,Math.floor(ITEMS[id].value*.45));

export function sanitizeCounts(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([id,n])=>ITEMS[id]&&!ITEMS[id].locked&&Number.isFinite(n)&&n>=1).map(([id,n])=>[id,Math.min(100000,Math.floor(n))]));
}
