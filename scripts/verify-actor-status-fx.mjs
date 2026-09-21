import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launchMutedBrowser} from './playwright-muted-launch.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.codex/skills/develop-web-game/node_modules'),path.resolve('node_modules')]}));
const out=path.resolve('output/verification/actor-status-fx');await mkdir(out,{recursive:true});
const browser=await launchMutedBrowser(chromium,{headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
const base='http://127.0.0.1:5182';

try {
 await page.route('**/game.js',async route=>{const response=await route.fetch();let source=await response.text();const end=source.lastIndexOf('})();');source=source.slice(0,end)+'window.__statusQA={state,renderVisualFrame,graphicsController};\n'+source.slice(end);await route.fulfill({response,body:source});});
 await page.addInitScript(()=>{localStorage.setItem('dungeonOneRoomPlayerName','StatusQA');localStorage.setItem('dungeonOneRoomTutorialSeen','1');localStorage.setItem('dungeonOneRoomAudioMuted','1');});
 const results=[];
 for(const hd2 of [1,0]){
  await page.goto(base+'/output/hd2-dist/?hd2='+hd2+'&scenario=enemy_roster_hd');
  await page.waitForFunction(()=>window.__statusQA,null,{timeout:90000});
  for(let i=0;i<90;i++){if(await page.locator('#bootScreen.hidden').count())break;await page.keyboard.press('Enter');await page.waitForTimeout(250);}
  await page.waitForFunction(()=>document.querySelector('#bootScreen.hidden'));
  await page.waitForFunction(()=>window.__statusQA.graphicsController.getStreamingStats().pending.length===0,null,{timeout:60000});
  const result=await page.evaluate(()=>{
   const q=window.__statusQA,s=q.state,p=window.DungeonHD2Presentation;s.roomIntroTimer=0;
   Object.assign(s.player,{poisonTurns:9,bleedTurns:9,frozenMoveTurns:0});
   const skeleton=s.enemies.find(e=>e.type==='skeleton'),brute=s.enemies.find(e=>e.type==='brute');Object.assign(skeleton,{frozenThisTurn:true,frostFx:3000});brute.burnTurns=9;
   const snapshot=window.DungeonVisualSnapshot.createVisualSnapshot(s,1000);
   const before={player:p.actorStatuses(snapshot.player),skeleton:p.actorStatuses(snapshot.enemies.find(e=>e.id===skeleton.id)),brute:p.actorStatuses(snapshot.enemies.find(e=>e.id===brute.id))};
   q.renderVisualFrame(performance.now());
   const canvas=document.querySelector('#game'),withStatus=canvas.toDataURL();
   Object.assign(s.player,{poisonTurns:0,bleedTurns:0});Object.assign(skeleton,{frozenThisTurn:false,frostFx:0});brute.burnTurns=0;
   const cleared=window.DungeonVisualSnapshot.createVisualSnapshot(s,1000);
   const expired=p.actorStatuses(cleared.player).length+p.actorStatuses(cleared.enemies.find(e=>e.id===skeleton.id)).length+p.actorStatuses(cleared.enemies.find(e=>e.id===brute.id)).length;
   Object.assign(s.player,{poisonTurns:9,bleedTurns:9});Object.assign(skeleton,{frozenThisTurn:true,frostFx:3000});brute.burnTurns=9;q.renderVisualFrame(performance.now());
   return {before,expired,pixels:withStatus.length};
  });
  assert.deepEqual(result.before.player,['poison','bleed']);assert(result.before.skeleton.includes('freeze'));assert(result.before.brute.includes('burn'));assert.equal(result.expired,0);assert(result.pixels>10000);results.push({hd2,...result});
  await page.screenshot({path:path.join(out,'in-game-hd'+(hd2?'2':'1')+'.png'),fullPage:true});
  if(hd2){
   await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.id='status-gallery';canvas.width=960;canvas.height=540;canvas.style.cssText='position:fixed;inset:0;z-index:99999;width:960px;height:540px';document.body.appendChild(canvas);const c=canvas.getContext('2d');c.fillStyle='#111414';c.fillRect(0,0,960,540);
    const cases=[['FROZEN','enemy.skeleton.south.idle.01',{frozenThisTurn:true}],['POISON','actor.player.south.idle.01',{poisoned:true}],['BURN','enemy.brute.south.idle.01',{burnTurns:2}],['BLEED','actor.player.south.idle.01',{bleeding:true}],['DISORIENT','enemy.acolyte.south.idle.01',{disorientedTurns:2}],['EMPOWERED','enemy.slime.south.idle.01',{acolyteBuffTurns:2}]];
    for(let i=0;i<cases.length;i++){const [label,key,flags]=cases[i],entry=window.DungeonHDAssetManifest.entries.find(e=>e.key===key),image=new Image();image.src=entry.src;await image.decode();const x=(i%3)*320+72,y=Math.floor(i/3)*270+25;c.fillStyle='#c9c0af';c.font='18px Georgia';c.textAlign='center';c.fillText(label,x+88,y+212);c.drawImage(image,x,y,176,176);window.DungeonHD2Presentation.drawActorStatuses(c,{hp:10,...flags},{x,y,size:176},1000);}
   });
   await page.locator('#status-gallery').screenshot({path:path.join(out,'status-gallery.png')});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,results,errors,missing},null,2));console.log('PASS: HD1/HD2 actual player poison+bleed, enemy freeze+burn, expiry and visual gallery.');
}finally{await browser.close();}
