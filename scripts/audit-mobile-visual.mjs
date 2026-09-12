import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startMobilePreviewServer} from './mobile-v1-lan-preview.mjs';
import {launchMutedBrowser} from './playwright-muted-launch.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.codex/skills/develop-web-game/node_modules'),path.resolve('node_modules')]}));
const out=path.resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'output/verification/mobile-visual-audit/after');
await mkdir(out,{recursive:true});
const server=await startMobilePreviewServer();const browser=await launchMutedBrowser(chromium,{headless:true});const errors=[],report=[];
try {
 for(const [name,scenario,phase] of [['forge','forge','playing'],['merchant','merchant_buyback_hd','playing'],['reward','reward_choice_mobile','relic'],['defeat','death_mobile','dead'],['camp-start','camp_start_mobile','camp'],['camp','relic_exchange','camp']]) {
  if(process.argv.includes('--camp-only')&&name!=='camp')continue;
  for(const [orientation,width,height]of [['landscape',915,412],['portrait',390,844]]) {
   const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36'});
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{localStorage.setItem('dungeonOneRoomPlayerName','MobileQA');localStorage.setItem('dungeonOneRoomAudioMuted','1');for(const key of ['Run','Camp','Portal'])localStorage.setItem('dungeonOneRoomTutorial'+key+'Seen','1');});
   await page.goto(server.url+'?scenario='+scenario);
   await page.waitForFunction(p=>typeof render_game_to_text==='function'&&JSON.parse(render_game_to_text()).phase===p,phase,{timeout:90000});
   await page.waitForFunction(()=>document.getElementById('game').classList.contains('graphics-hd'));
   await page.evaluate(()=>{document.getElementById('bootScreen').classList.add('hidden');document.getElementById('gameApp').classList.remove('app-hidden');});
   await page.waitForTimeout(750);
   if(name==='camp'&&await page.getByRole('button',{name:'Close guide',exact:true}).count()) {await page.getByRole('button',{name:'Close guide',exact:true}).tap();await page.locator('.camp-revamp').waitFor({state:'visible'});await page.waitForTimeout(150);}
   if(process.argv.includes('--visual-polish')) {
    const checks=await page.evaluate(({name,orientation})=>{
     const box=s=>document.querySelector(s)?.getBoundingClientRect();const fits=r=>r&&r.top>=0&&r.bottom<=innerHeight;
     if(name==='forge')return {copy:parseFloat(getComputedStyle(document.querySelector('.forge-choice-copy p')).fontSize)>=12,card:orientation!=='portrait'||box('.forge-choice').height<=170};
     if(name==='reward')return {allChoices:[...document.querySelectorAll('.relic-draft-choice')].every(e=>fits(e.getBoundingClientRect())),skip:fits(box('.relic-draft-skip')),art:box('.relic-draft-icon').width<=70};
     if(name==='defeat')return {compact:orientation!=='portrait'||box('.death-requiem').height<600,actions:fits(box('.death-requiem-actions'))};
     if(name==='camp')return {footer:box('.camp-revamp-grid').bottom<=box('.camp-revamp-actions').top+1,action:fits(box('.camp-revamp-actions'))};
     if(name==='camp-start')return {route:fits(box('.camp-start-route-grid')),actions:fits(box('.camp-start-actions'))};
     return {names:[...document.querySelectorAll('.merchant-buyback-copy strong')].every(e=>e.scrollWidth<=e.clientWidth+1)};
    },{name,orientation});
    for(const [check,pass]of Object.entries(checks))assert.equal(pass,true,name+' '+orientation+' '+check);
   }
   const id=name+'-'+orientation;await page.screenshot({path:path.join(out,id+'.png')});
   const data=await page.evaluate(()=>{const root=document.getElementById('screenOverlay');return {html:root.innerHTML,text:root.innerText,overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...root.querySelectorAll('strong,small,h1,h2,h3,p')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:e.textContent.slice(0,80),font:getComputedStyle(e).fontSize}))};});
   assert.equal(data.overflow,false,id);assert.ok(data.text.length>20,id+' visible content');await writeFile(path.join(out,id+'.json'),JSON.stringify(data,null,2));report.push({id,text:data.text.slice(0,160),overflow:data.overflow});await page.close();
  }
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'surfaces.json'),JSON.stringify({pass:true,report,errors},null,2));console.log('PASS: '+report.length+' special-room, reward, defeat and camp captures; no horizontal overflow or page errors.');
} finally {await browser.close();await new Promise(r=>server.server.close(r));}
