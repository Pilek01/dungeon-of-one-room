const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const layers=require('../render/hd-renderer-layers.js');
const p=require('../render/hd2-presentation.js');
const {createStream}=require('../render/hd2-actor-stream.js');
const manifest=require('../render/hd-asset-manifest.js').entries;
test('default catalog stays entirely on original artwork while deferring unused enemy frames',async()=>{
 assert(!manifest.some(e=>/assets\/hd\/(early-v2|all-v2)\//.test(e.src)));
 const requested=[];const stream=createStream(manifest,{loadAssets:async entries=>{requested.push(...entries);return {ready:true,failures:[],loaded:new Map(entries.map(e=>[e.key,{}]))};}});
 assert(stream.bootstrap.length<manifest.length);
 assert(stream.bootstrap.some(e=>e.key==='enemy.slime.south.idle.01'));
 assert(!stream.bootstrap.some(e=>e.key==='enemy.slime.south.death.02'));
 const assets=new Map(stream.bootstrap.map(e=>[e.key,{}]));
 await stream.ensure(['enemy.slime.south.attack.03'],assets);
 assert(assets.has('enemy.slime.south.death.02'));
 assert(requested.every(e=>e.key.startsWith('enemy.slime.')));
});
test('HD1 death uses its two original frames then expires without changing actor',()=>{
 const actor={id:'s',type:'slime',hp:0,x:2,y:3};const original=structuredClone(actor);
 const event={...p.deathRecord({},actor,layers),startedAtMs:100};
 assert.equal(event.spriteFrameCount,2);
 assert.equal(p.deathFrame(event,100).frame,1);
 assert.equal(p.deathFrame(event,350).frame,2);
 assert.equal(p.deathFrame(event,570).frame,2);
 assert.equal(p.deathFrame(event,580),null);assert.deepEqual(actor,original);
});
test('default Totem aura is stationary; only real venom or hex produces a cast',()=>{
 const actor={id:'t',type:'totem',hp:10,castFlash:80,_tweenT:40};
 assert.equal(layers.selectEnemyVisual({nowMs:1000},actor).clip,'idle');
 for(const kind of ['npc_hex','npc_venom']){
  const snapshot={nowMs:1000,visualEvents:[{kind,sourceId:'t',startedAtMs:1000,durationMs:140}]};
  const selection=layers.selectEnemyVisual(snapshot,actor);
  assert.equal(selection.clip,'cast');assert(selection.frame>=3&&selection.frame<=4);
  assert(manifest.some(e=>e.key===selection.key));
  assert.equal(layers.selectEnemyVisual({...snapshot,nowMs:1141},actor).clip,'idle');
 }
});
test('default melee and boss action timing responds to real release, without unavailable frames',()=>{
 for(const type of ['slime','brute','skitter','otter','guardian','warden','blacksmith_guardian']){
  const actor={id:'a',type,hp:10,facing:'east'};
  const snapshot={nowMs:1000,finalBossPhase:1,visualEvents:[{kind:type==='slime'||type==='skitter'||type==='otter'?'npc_melee':'npc_slam',sourceId:'a',startedAtMs:1000,durationMs:140}]};
  const s=['guardian','warden','blacksmith_guardian'].includes(type)?layers.selectBossVisual(snapshot,actor):layers.selectEnemyVisual(snapshot,actor);
  assert(['attack','cast'].includes(s.clip),type);assert(s.frame>=3&&s.frame<=4,type);assert(manifest.some(e=>e.key===s.key),s.key);
 }
});
test('default renderer draws a retained idle fallback while streamed attack is pending',()=>{
 const fallback={};const draws=[];
 layers.drawEnemiesLayer({drawImage:(im)=>draws.push(im),save(){},restore(){},fillRect(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},closePath(){}},
 {nowMs:1000,enemies:[{id:'s',type:'slime',hp:10,x:2,y:3,facing:'south'}],visualEvents:[{kind:'npc_melee',sourceId:'s',startedAtMs:1000,durationMs:140}]},
 new Map([['enemy.slime.south.idle.01',fallback]]));
 assert(draws.includes(fallback));
});

test('death frame count survives the real immutable visual snapshot',()=>{
 const api=require('../render/visual-snapshot.js');
 const event={kind:'enemy_death',x:2,y:3,startedAtMs:100,durationMs:480,spriteKey:'enemy.slime.south.death.01',spriteFrameCount:2};
 const snapshot=api.createVisualSnapshot({visualEvents:[event]},350);
 assert.equal(snapshot.visualEvents[0].spriteFrameCount,2);
 assert.equal(p.deathFrame(snapshot.visualEvents[0],570).frame,2);
});
