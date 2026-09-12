import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launchMutedBrowser} from './playwright-muted-launch.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.codex/skills/develop-web-game/node_modules'),path.resolve('node_modules')]}));
const out=path.resolve('output/verification/hd2-npc-skills');await mkdir(out,{recursive:true});
const browser=await launchMutedBrowser(chromium,{headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
const base='http://127.0.0.1:5182';
try{
 await page.goto(`${base}/tools/hd2-preview/npc-skills.html`);
 for(const direction of ['south','north','east','west']){
  await page.selectOption('#direction',direction);await page.waitForFunction(d=>document.body.dataset.loaded===d,direction);
  for(const card of await page.locator('.card').all()){
   await card.locator('[data-action=prepare]').click();await page.waitForTimeout(360);assert.equal(await card.getAttribute('data-frame'),'5');
   await card.locator('[data-action=cancel]').click();await page.waitForTimeout(40);assert.equal(await card.getAttribute('data-frame'),'1');
   await card.locator('[data-action=release]').click();await page.waitForTimeout(400);assert.equal(await card.getAttribute('data-mode'),'idle');
  }
 }
 await page.selectOption('#direction','south');await page.waitForFunction(()=>document.body.dataset.loaded==='south');
 for(const b of await page.locator('[data-action=prepare]').all())await b.click();await page.waitForTimeout(360);
 await page.screenshot({path:path.join(out,'prepared-skills.png'),fullPage:true});
 const signal=await page.evaluate(async()=>{const results={};for(const [kind,tones] of Object.entries(DungeonHD2NpcCues.cues)){const ctx=new OfflineAudioContext(1,22050,44100);for(const t of tones){const o=ctx.createOscillator(),g=ctx.createGain();o.type=t.type;o.frequency.setValueAtTime(t.frequency,t.delay);o.frequency.linearRampToValueAtTime(t.endFrequency,t.delay+t.duration);g.gain.setValueAtTime(.0001,t.delay);g.gain.linearRampToValueAtTime(t.gain,t.delay+.01);g.gain.exponentialRampToValueAtTime(.0001,t.delay+t.duration);o.connect(g);g.connect(ctx.destination);o.start(t.delay);o.stop(t.delay+t.duration+.02);}const b=await ctx.startRendering();const samples=b.getChannelData(0);results[kind]={peak:Math.max(...samples.map(Math.abs)),finite:samples.every(Number.isFinite)};}return results;});
 for(const s of Object.values(signal)){assert.ok(s.finite&&s.peak>0&&s.peak<.15);}
 await page.route('**/game.js',async route=>{const response=await route.fetch();let source=await response.text();source=source.replace('function playTone(ctx, destination, options) {','function playTone(ctx, destination, options) { (window.__npcTones ||= []).push(options);');const end=source.lastIndexOf('})();');assert.ok(end>0);source=source.slice(0,end)+'window.__npcQA={state,applyAcolyteHeal,applyAcolyteBuff,startRiftweaverRift,executeRiftweaverRift,startBulwarkBash,executeBulwarkBash,castTotemPoisonBolt,renderVisualFrame};\n'+source.slice(end);await route.fulfill({response,body:source});});
 await page.addInitScript(()=>{localStorage.setItem('dungeonOneRoomPlayerName','NPCQA');localStorage.setItem('dungeonOneRoomTutorialSeen','1');});
 await page.goto(`${base}/output/hd2-dist/?hd2=1&scenario=enemy_roster_hd`);
 await page.waitForFunction(()=>window.__npcQA,null,{timeout:90000});
 for(let i=0;i<90;i++){if(await page.locator('#bootScreen.hidden').count())break;await page.keyboard.press('Enter');await page.waitForTimeout(350);}
 await page.waitForFunction(()=>document.getElementById('bootScreen').classList.contains('hidden'));
 await page.locator('#game').click();
 const outcome=await page.evaluate(()=>{
  const q=window.__npcQA,s=q.state;s.audioMuted=false;s.player.hp=s.player.maxHp=1000;s.visualEvents=[];
  const a=s.enemies.find(e=>e.type==='acolyte'),target=s.enemies.find(e=>e.type==='brute');target.hp=1;target.acolyteBuffTurns=0;a.aiming=false;a.acolyteCastType='';
  const hp=target.hp;q.applyAcolyteHeal(a,target);
  const heal=window.DungeonHDRendererLayers.selectEnemyVisual({nowMs:performance.now(),visualEvents:s.visualEvents},a);
  const healed=target.hp>hp;q.renderVisualFrame(performance.now());
  q.applyAcolyteBuff(a,target);
  const buff=window.DungeonHDRendererLayers.selectEnemyVisual({nowMs:performance.now(),visualEvents:s.visualEvents},a);
  const r={id:'qa-rift',type:'riftweaver',name:'Riftweaver',x:2,y:2,hp:10,maxHp:10,attack:2,facing:'south'};
  s.enemies.push(r);s.player.x=4;s.player.y=4;const playerHp=s.player.hp;q.startRiftweaverRift(r);
  const prepared=window.DungeonHDRendererLayers.selectEnemyVisual({nowMs:performance.now()},r).frame;
  const chargeNoDamage=s.player.hp===playerHp;s.player.x=7;s.player.y=7;q.executeRiftweaverRift(r);
  const released=window.DungeonHDRendererLayers.selectEnemyVisual({nowMs:performance.now()},r).frame;
  const missNoDamage=s.player.hp===playerHp;
  const b={id:'qa-bulwark',type:'bulwark',name:'Bulwark',x:1,y:1,hp:10,maxHp:10,attack:2,facing:'south'};s.enemies.push(b);q.startBulwarkBash(b);const bashHeld=window.DungeonHDRendererLayers.selectEnemyVisual({},b).frame;q.executeBulwarkBash(b);
  const kinds=s.visualEvents.map(e=>e.kind);const tones=(window.__npcTones||[]).length;
  s.audioMuted=true;q.applyAcolyteHeal(a,target);const muteWorks=(window.__npcTones||[]).length===tones;
  q.renderVisualFrame(performance.now());return {healKey:heal.key,buffKey:buff.key,healed,buffed:target.acolyteBuffTurns>0,prepared,released,bashHeld,chargeNoDamage,missNoDamage,kinds,tones,muteWorks};
 });
 assert.match(outcome.healKey,/\.heal\./);assert.match(outcome.buffKey,/\.buff\./);assert.ok(outcome.healed&&outcome.buffed&&outcome.chargeNoDamage&&outcome.missNoDamage&&outcome.muteWorks);assert.ok(outcome.prepared<=5&&outcome.bashHeld<=5);assert.equal(outcome.released,6);assert.ok(outcome.tones>=6);assert.ok(outcome.kinds.includes('riftweaver_rift_detonate')&&outcome.kinds.includes('bulwark_shield_bash'));
 for(const kind of ['npc_heal','npc_buff','riftweaver_rift_detonate','bulwark_shield_bash'])assert.equal(outcome.kinds.filter(k=>k===kind).length,1,kind);
 assert.equal(outcome.kinds.filter(k=>k==='npc_charge').length,2);
 await page.screenshot({path:path.join(out,'game-npc-skills.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,previewSequences:12,outcome,signal,errors,missing},null,2));
 console.log('PASS: 12 directional skill previews, actual heal/buff/rift/bash execution, missed attacks, mute, 13 rendered SFX signals.');
}catch(error){console.error(JSON.stringify({errors,missing,url:page.url()}));throw error;}finally{await browser.close();}
