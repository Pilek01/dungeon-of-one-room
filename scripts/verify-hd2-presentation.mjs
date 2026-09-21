import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {launchMutedBrowser} from './playwright-muted-launch.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.codex/skills/develop-web-game/node_modules'),path.resolve('node_modules')]}));
const out=path.resolve('output/verification/hd2-presentation');await mkdir(out,{recursive:true});
const browser=await launchMutedBrowser(chromium,{headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
const base='http://127.0.0.1:5182';

try {
 await page.route('**/game.js',async route=>{const response=await route.fetch();let source=await response.text();const end=source.lastIndexOf('})();');source=source.slice(0,end)+'window.__hd2QA={state,killEnemy,renderVisualFrame,graphicsController};\n'+source.slice(end);await route.fulfill({response,body:source});});
 await page.addInitScript(()=>{localStorage.setItem('dungeonOneRoomPlayerName','HD2QA');localStorage.setItem('dungeonOneRoomTutorialSeen','1');localStorage.setItem('dungeonOneRoomAudioMuted','1');});
 await page.goto(base+'/output/hd2-dist/?hd2=1&scenario=enemy_roster_hd');
 await page.waitForFunction(()=>window.__hd2QA,null,{timeout:90000});
 for(let i=0;i<90;i++){if(await page.locator('#bootScreen.hidden').count())break;await page.keyboard.press('Enter');await page.waitForTimeout(250);}
 await page.waitForFunction(()=>document.querySelector('#bootScreen.hidden'));
 await page.waitForFunction(()=>window.__hd2QA.graphicsController.getStreamingStats().pending.length===0,null,{timeout:60000});
 const death=await page.evaluate(()=>{
  const q=window.__hd2QA,s=q.state;const enemy=s.enemies.find(e=>e.type==='slime');const before=s.totalKills;enemy.hp=0;q.killEnemy(enemy,'attack');
  const event=s.visualEvents.find(e=>e.kind==='enemy_death'&&e.sourceId===String(enemy.id));
  const ctx=document.querySelector('#game').getContext('2d'),original=ctx.drawImage,drawn=[];ctx.drawImage=function(image,...args){if(image.src?.includes('-death-'))drawn.push(image.src);return original.call(this,image,...args);};
  q.renderVisualFrame(event.startedAtMs+150);ctx.drawImage=original;
  return {removed:!s.enemies.includes(enemy),rewarded:s.totalKills===before+1,event,drawn,stream:q.graphicsController.getStreamingStats()};
 });
 assert(death.removed&&death.rewarded);assert(death.drawn.some(src=>src.includes('slime/'+death.event.facing+'-death-02.png')),JSON.stringify(death));
 await page.screenshot({path:path.join(out,'death-in-room.png'),fullPage:true});
 const mix=await page.evaluate(async()=>{
  const ctx=new OfflineAudioContext(1,44100,44100),api=window.DungeonHD2NpcCues,bus=api.getBus(ctx,ctx.destination);
  for(const [i,material]of ['totem','skeleton','bulwark','totem','skeleton','bulwark'].entries()){
   api.playMaterial(ctx,bus,'melee',material,.01+i*.006);
   for(const t of api.cues.melee){const o=ctx.createOscillator(),g=ctx.createGain();o.type=t.type;o.frequency.setValueAtTime(t.frequency,.01);o.frequency.linearRampToValueAtTime(t.endFrequency,.01+t.duration);g.gain.setValueAtTime(.0001,.01);g.gain.linearRampToValueAtTime(t.gain,.02);g.gain.exponentialRampToValueAtTime(.0001,.01+t.duration);o.connect(g);g.connect(bus);o.start(.01);o.stop(.03+t.duration);}
  }
  const rendered=await ctx.startRendering(),samples=rendered.getChannelData(0),bytes=new Uint8Array(44+samples.length*2),v=new DataView(bytes.buffer);
  const str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,44100,true);v.setUint32(28,88200,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);let peak=0;
  for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);}
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return {peak,finite:samples.every(Number.isFinite),wav:btoa(binary)};
 });
 assert(mix.finite&&mix.peak>0&&mix.peak<.8);
 await writeFile(path.join(out,'npc-material-mix.wav'),Buffer.from(mix.wav,'base64'));delete mix.wav;
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,death,mix,errors,missing},null,2));
 console.log(JSON.stringify({pass:true,deathFrame:2,immediateRemoval:death.removed,mixPeak:mix.peak,stream:death.stream}));
} finally {await browser.close();}
