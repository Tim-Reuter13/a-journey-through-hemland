import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS,SETTINGS_KEY,normalizeSettings,loadSettings,saveSettings,menuIndex,resourceBarState } from '../src/ui/menu.js';
import { createPreviewModel } from '../src/ui/itemPreview.js';
import { ITEMS } from '../src/systems/items.js';
import { icon,typeIcon } from '../src/ui/inventoryIcons.js';
import { MeshLambertMaterial } from 'three';

test('settings sanitize untrusted storage and clamp every adjustable range',()=>{
  assert.deepEqual(normalizeSettings(null),DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings([]),DEFAULT_SETTINGS);
  const values=normalizeSettings({graphicsQuality:'ultra',masterVolume:4,musicVolume:-1,effectsVolume:NaN,mouseSensitivity:.1,fov:200,invertY:'false',subtitles:false,unknown:9});
  assert.deepEqual(values,{...DEFAULT_SETTINGS,masterVolume:1,musicVolume:0,mouseSensitivity:.3,fov:90,subtitles:false});
  assert.equal(normalizeSettings({fov:45}).fov,60);
  assert.equal(normalizeSettings({mouseSensitivity:9}).mouseSensitivity,2);
  assert.equal(normalizeSettings({effectsVolume:.25,invertY:true}).effectsVolume,.25);
  assert.equal(normalizeSettings({effectsVolume:.25,invertY:true}).invertY,true);
});

test('settings round trip under the Hemland key and survive unavailable storage',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(loadSettings(storage),DEFAULT_SETTINGS);
  const settings=saveSettings({...DEFAULT_SETTINGS,graphicsQuality:'high',subtitles:false,fov:83},storage);
  assert.ok(data.has(SETTINGS_KEY));assert.deepEqual(loadSettings(storage),settings);
  data.set(SETTINGS_KEY,'{broken');assert.deepEqual(loadSettings(storage),DEFAULT_SETTINGS);
  data.set(SETTINGS_KEY,'"invalid"');assert.deepEqual(loadSettings(storage),DEFAULT_SETTINGS);
  const blocked={getItem(){throw Error('denied');},setItem(){throw Error('full');}};
  assert.deepEqual(loadSettings(blocked),DEFAULT_SETTINGS);
  assert.equal(saveSettings({masterVolume:.2},blocked).masterVolume,.2);
  const first=loadSettings(blocked);first.fov=90;assert.equal(loadSettings(blocked).fov,75);
});

test('keyboard navigation selects, wraps, and handles absent choices',()=>{
  assert.equal(menuIndex(-1,3,'ArrowDown'),0);assert.equal(menuIndex(-1,3,'ArrowUp'),2);
  assert.equal(menuIndex(2,3,'ArrowDown'),0);assert.equal(menuIndex(0,3,'ArrowUp'),2);
  assert.equal(menuIndex(2,3,'Home'),0);assert.equal(menuIndex(0,3,'End'),2);
  assert.equal(menuIndex(1,3,'Enter'),1);assert.equal(menuIndex(8,3,'ArrowDown'),0);
  assert.equal(menuIndex(0,1,'ArrowDown'),0);assert.equal(menuIndex(0,0,'ArrowDown'),-1);
});

test('resource bars stay while depleted and linger after recovery or maximum changes',()=>{
  const full=resourceBarState(100,100,null,0);assert.equal(full.visible,false);
  const hurt=resourceBarState(75,100,full,100);assert.equal(hurt.visible,true);
  const held=resourceBarState(75,100,hurt,10000);assert.equal(held.visible,true);
  const recovered=resourceBarState(100,100,held,11000);assert.equal(recovered.visible,true);
  assert.equal(resourceBarState(100,100,recovered,13399).visible,true);
  assert.equal(resourceBarState(100,100,recovered,13400).visible,false);
  assert.equal(resourceBarState(120,120,recovered,14000).visible,true);
  assert.equal(resourceBarState(100,0,full,100).visible,false);
  assert.equal(resourceBarState(undefined,undefined,full,100).visible,false);
  assert.equal(resourceBarState(-10,100,null,0).value,0);
  assert.equal(resourceBarState(200,100,null,0).visible,false);
});

test('every inventory item builds finite box geometry without a DOM or shared disposal',()=>{
  const shared=new MeshLambertMaterial();let disposed=false;shared.addEventListener('dispose',()=>{disposed=true;});
  for(const [id,definition] of Object.entries(ITEMS)){
    const group=createPreviewModel({id,...definition},()=>shared);assert.ok(group.children.length>0,id);
    group.traverse(mesh=>{
      if(!mesh.isMesh)return;
      assert.equal(mesh.geometry.type,'BoxGeometry',id);assert.equal(mesh.material,shared);
      assert.ok([...mesh.position,...mesh.quaternion,...mesh.scale].every(Number.isFinite),id);
      assert.ok([...mesh.geometry.attributes.uv.array].every(Number.isFinite),id);
    });
    group.clear();assert.equal(disposed,false);
  }
  assert.equal(createPreviewModel(null).children.length,0);
});

test('equipment icons use crisp integer-grid SVGs for all eight slots',()=>{
  for(const slot of ['weapon','ranged','armor','head','hands','feet','cloak','accessory','ammo']){
    const svg=icon(typeIcon(slot));assert.match(svg,/viewBox="0 0 12 12"/);assert.match(svg,/shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg,/stroke-linecap/);
    assert.doesNotMatch(svg.match(/ d="([^"]+)"/)[1],/[CQASTcqast]/);
    if(!['weapon','armor','accessory'].includes(slot))assert.notEqual(typeIcon(slot),'misc');
  }
  assert.equal(icon('<script>'),icon('misc'));
});
