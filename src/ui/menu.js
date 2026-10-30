export const SETTINGS_KEY='hemland-settings-v1';
export const DEFAULT_SETTINGS=Object.freeze({graphicsQuality:'medium',masterVolume:1,musicVolume:.6,effectsVolume:.8,mouseSensitivity:1,fov:75,invertY:false,subtitles:true,pixelFilter:true,colorGrade:'standard',touchControls:'auto'});
const ranges={masterVolume:[0,1],musicVolume:[0,1],effectsVolume:[0,1],mouseSensitivity:[.3,2],fov:[60,90]};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function normalizeSettings(values={}){
  const input=values&&typeof values==='object'&&!Array.isArray(values)?values:{},result={...DEFAULT_SETTINGS};
  if(['low','medium','high'].includes(input.graphicsQuality))result.graphicsQuality=input.graphicsQuality;
  if(['standard','dark'].includes(input.colorGrade))result.colorGrade=input.colorGrade;
  if(['auto','on','off'].includes(input.touchControls))result.touchControls=input.touchControls;
  for(const [key,[min,max]] of Object.entries(ranges))if(typeof input[key]==='number'&&Number.isFinite(input[key]))result[key]=clamp(input[key],min,max);
  for(const key of ['invertY','subtitles','pixelFilter'])if(typeof input[key]==='boolean')result[key]=input[key];
  return result;
}

export function loadSettings(storage){
  try{return normalizeSettings(JSON.parse((storage??globalThis.localStorage)?.getItem(SETTINGS_KEY)));}catch{return {...DEFAULT_SETTINGS};}
}

export function saveSettings(values,storage){
  const result=normalizeSettings(values);
  try{(storage??globalThis.localStorage)?.setItem(SETTINGS_KEY,JSON.stringify(result));}catch{}
  return result;
}

/** Roving focus wraps; -1 means that nothing has been selected yet. */
export function menuIndex(current,length,key){
  if(!Number.isInteger(length)||length<=0)return -1;
  const index=Number.isInteger(current)&&current>=0&&current<length?current:-1;
  if(key==='Home')return 0;if(key==='End')return length-1;
  if(key==='ArrowDown')return index<0?0:(index+1)%length;
  if(key==='ArrowUp')return index<0?length-1:(index+length-1)%length;
  return index;
}

/** A full bar lingers after a change; depleted bars remain visible. Time is ms. */
export function resourceBarState(value,max,previous=null,now=0){
  if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return {value:0,max:0,until:0,visible:false};
  value=clamp(value,0,max);
  const changed=previous&&previous.max>0&&(value!==previous.value||max!==previous.max);
  const until=changed?now+2400:previous?.until??0;
  return {value,max,until,visible:value<max||now<until};
}

const barStates=new Map();
export function setBarVisibility(hp,maxHp,stamina,maxStamina,magicka,maxMagicka){
  const now=globalThis.performance?.now()??Date.now();
  for(const [id,value,max] of [['health',hp,maxHp],['stamina',stamina,maxStamina],['magicka',magicka,maxMagicka]]){
    const state=resourceBarState(value,max,barStates.get(id),now);barStates.set(id,state);
    const fill=globalThis.document?.getElementById(id+'-fill'),bar=fill?.closest('.resource');
    bar?.classList.toggle('bar-visible',state.visible);
    if(id==='magicka'&&fill){fill.style.width=(state.max?100*state.value/state.max:0)+'%';const text=document.getElementById('magicka-text');if(text)text.textContent=`${Math.ceil(state.value)} / ${state.max}`;}
  }
}

const panels=new WeakMap();
let settingsPanel=null,returnFocus=null,menuInstance=null;
const visible=el=>!!el&&!el.closest('.hidden,[hidden]')&&el.getClientRects().length>0;
const focusable=root=>[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(visible);
function trapTab(event,root){
  const list=focusable(root),index=list.indexOf(document.activeElement);
  if(!list.length){event.preventDefault();root.focus();return;}
  if(index<0||(!event.shiftKey&&index===list.length-1)||(event.shiftKey&&index===0)){event.preventDefault();list[event.shiftKey?list.length-1:0].focus();}
}

export function createSettingsPanel(root,{values=loadSettings(),onChange}={}){
  if(!root)throw new TypeError('A settings root is required.');
  panels.get(root)?.destroy();
  let current=normalizeSettings(values);
  root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','settings-title');
  root.innerHTML=`<div class="panel settings-panel"><div class="panel-header"><span>A Journey through Hemland</span><button id="settings-close" aria-label="Einstellungen schließen">×</button></div><h2 id="settings-title">Einstellungen</h2><div class="settings-fields">
    <label class="settings-row" for="setting-graphicsQuality"><span>Grafikqualität</span><select id="setting-graphicsQuality" name="graphicsQuality"><option value="low">Leistung</option><option value="medium">Ausgewogen</option><option value="high">Qualität</option></select></label>
    ${[['masterVolume','Gesamtlautstärke',.05],['musicVolume','Musik',.05],['effectsVolume','Effekte',.05],['mouseSensitivity','Blickempfindlichkeit',.05],['fov','Sichtfeld',1]].map(([key,label,step])=>`<label class="settings-row" for="setting-${key}"><span>${label}</span><span class="settings-range"><input id="setting-${key}" name="${key}" type="range" min="${ranges[key][0]}" max="${ranges[key][1]}" step="${step}"><output for="setting-${key}" data-output="${key}"></output></span></label>`).join('')}
    <label class="settings-row" for="setting-invertY"><span>Y-Achse umkehren</span><input id="setting-invertY" name="invertY" type="checkbox"></label>
    <label class="settings-row" for="setting-colorGrade"><span>Farbstil</span><select id="setting-colorGrade" name="colorGrade"><option value="standard">Standard</option><option value="dark">Dunkle Fantasy</option></select></label>
    <label class="settings-row" for="setting-pixelFilter"><span>Pixelfilter (Retro-Auflösung)</span><input id="setting-pixelFilter" name="pixelFilter" type="checkbox"></label>
    <label class="settings-row" for="setting-subtitles"><span>Untertitel</span><input id="setting-subtitles" name="subtitles" type="checkbox"></label>
    <label class="settings-row" for="setting-touchControls"><span>Touch-Steuerung</span><select id="setting-touchControls" name="touchControls"><option value="auto">Automatisch</option><option value="on">An</option><option value="off">Aus</option></select></label>
    </div><p class="settings-note" role="status">Änderungen werden automatisch gespeichert.</p><button id="settings-done" class="primary">Zurück</button><p class="panel-hint">ESC · Zurück</p></div>`;
  function render(){
    for(const [key,value] of Object.entries(current)){
      const field=root.querySelector('[name="'+key+'"]');if(field.type==='checkbox')field.checked=value;else field.value=String(value);
      const output=root.querySelector('[data-output="'+key+'"]');
      if(output)output.textContent=key==='fov'?Math.round(value)+'°':key==='mouseSensitivity'?value.toFixed(2).replace('.',',')+'×':Math.round(value*100)+' %';
    }
  }
  function change(event){
    const field=event.target,key=field.name;if(!(key in DEFAULT_SETTINGS))return;
    const value=field.type==='checkbox'?field.checked:field.type==='range'?Number(field.value):field.value;
    current=saveSettings({...current,[key]:value});render();
    document.body.classList.toggle('subtitles-off',!current.subtitles);
    const legacy=document.getElementById('graphics-quality');
    if(key==='graphicsQuality'&&legacy&&legacy.value!==value){legacy.value=value;legacy.dispatchEvent(new Event('change',{bubbles:true}));}
    onChange?.({...current},{key,value:current[key]});
    root.dispatchEvent(new CustomEvent('hemland:settings-change',{bubbles:true,detail:{values:{...current},key,value:current[key]}}));
  }
  function keydown(event){event.stopPropagation();if(event.code==='Escape'){event.preventDefault();closeSettings();}else if(event.key==='Tab')trapTab(event,root);}
  function close(event){if(event.target.closest('#settings-close,#settings-done')||event.target===root)closeSettings();}
  root.addEventListener('input',change);root.addEventListener('keydown',keydown);root.addEventListener('click',close);
  const controller={root,getValues:()=>({...current}),setValues(values){current=normalizeSettings(values);render();},destroy(){root.removeEventListener('input',change);root.removeEventListener('keydown',keydown);root.removeEventListener('click',close);panels.delete(root);if(settingsPanel===controller)settingsPanel=null;}};
  panels.set(root,controller);settingsPanel=controller;render();
  document.body.classList.toggle('subtitles-off',!current.subtitles);
  return controller;
}

export function openSettings(){
  const root=settingsPanel?.root??globalThis.document?.getElementById('settings');if(!root)return null;
  if(!panels.has(root))createSettingsPanel(root);
  settingsPanel=panels.get(root);
  if(root.classList.contains('hidden'))returnFocus=document.activeElement;
  root.classList.remove('hidden');root.hidden=false;
  (focusable(root)[0]||root).focus();return settingsPanel;
}

export function closeSettings(){
  const root=settingsPanel?.root??globalThis.document?.getElementById('settings');if(!root)return;
  root.classList.add('hidden');
  if(visible(returnFocus))returnFocus.focus();returnFocus=null;
}

/** Index bootstraps UI navigation. The lead can call this again to attach game settings. */
export function createMenu({onSettingsChange,values}={}){
  if(menuInstance){if(onSettingsChange||values)createSettingsPanel(document.getElementById('settings'),{values:values??loadSettings(),onChange:onSettingsChange});return menuInstance;}
  const start=document.getElementById('start-screen'),dialog=document.getElementById('dialog'),credits=document.getElementById('credits');
  const settings=createSettingsPanel(document.getElementById('settings'),{values:values??loadSettings(),onChange:onSettingsChange});
  const legacy=document.getElementById('graphics-quality');
  function qualityChange(){const next=saveSettings({...panels.get(settings.root).getValues(),graphicsQuality:legacy.value});panels.get(settings.root).setValues(next);}
  legacy?.addEventListener('change',qualityChange);
  function showCredits(show){credits.classList.toggle('hidden',!show);document.getElementById('menu-credits').setAttribute('aria-expanded',String(show));(show?document.getElementById('credits-close'):document.getElementById('menu-credits')).focus();}
  function click(event){
    if(event.target.closest('[data-open-settings]'))openSettings();
    if(event.target.closest('#menu-credits'))showCredits(true);
    if(event.target.closest('#credits-close'))showCredits(false);
  }
  function keydown(event){
    const settingsRoot=document.getElementById('settings');
    if(visible(settingsRoot)){
      event.stopPropagation();
      if(event.code==='Escape'){event.preventDefault();if(!event.repeat)closeSettings();}
      else if(event.key==='Tab')trapTab(event,settingsRoot);
      return;
    }
    if(visible(credits)){
      event.stopPropagation();if(event.code==='Escape'){event.preventDefault();showCredits(false);}else if(event.key==='Tab')trapTab(event,credits);return;
    }
    const inDialog=visible(dialog),inStart=visible(start);if(!inDialog&&!inStart)return;
    event.stopPropagation();
    const list=[...(inDialog?dialog.querySelectorAll('#dialog-options button'):start.querySelectorAll('.start-menu button'))].filter(visible);
    const index=list.indexOf(document.activeElement);
    if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();list[menuIndex(index,list.length,event.key)]?.focus();}
    else if(event.key==='Enter'){event.preventDefault();if(!event.repeat){if(inDialog&&event.target===document.getElementById('dialog-close'))event.target.click();else list[index<0?0:index]?.click();}}
    else if(inDialog&&/^[1-9]$/.test(event.key)){event.preventDefault();if(!event.repeat)list[Number(event.key)-1]?.click();}
    else if(inDialog&&event.code==='Escape'){event.preventDefault();if(!event.repeat)document.getElementById('dialog-close').click();}
    else if(event.key==='Tab')trapTab(event,inDialog?dialog:start);
  }
  const observer=new MutationObserver(()=>{
    if(visible(dialog)&&!dialog.contains(document.activeElement))(dialog.querySelector('#dialog-options button')||document.getElementById('dialog-close')).focus({preventScroll:true});
  });
  observer.observe(dialog,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  document.addEventListener('click',click);window.addEventListener('keydown',keydown,true);
  menuInstance={openSettings,closeSettings,destroy(){observer.disconnect();document.removeEventListener('click',click);window.removeEventListener('keydown',keydown,true);legacy?.removeEventListener('change',qualityChange);panels.get(settings.root)?.destroy();menuInstance=null;}};
  return menuInstance;
}
