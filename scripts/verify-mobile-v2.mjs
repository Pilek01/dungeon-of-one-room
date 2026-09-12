import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startMobilePreviewServer} from './mobile-v1-lan-preview.mjs';
import {launchMutedBrowser} from './playwright-muted-launch.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(require.resolve('playwright', {paths:[path.join(process.env.USERPROFILE,'.codex/skills/develop-web-game/node_modules'),path.resolve('node_modules')]}));
const out = path.resolve(process.argv.find(arg=>arg.startsWith('--out='))?.slice(6) || 'output/verification/mobile-v2');
await mkdir(out,{recursive:true});
const server = await startMobilePreviewServer();
const browser = await launchMutedBrowser(chromium,{headless:true});
const errors=[], missing=[], results=[];
const polish = process.argv.includes('--visual-polish');
async function boot(width,height,touch=true) {
 const page=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch,...(touch?{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/145.0.0.0 Mobile Safari/537.36'}:{})});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await page.addInitScript(()=>{localStorage.setItem('dungeonOneRoomPlayerName','MobileQA');localStorage.setItem('dungeonOneRoomAudioMuted','1');for(const key of ['Run','Camp','Portal'])localStorage.setItem('dungeonOneRoomTutorial'+key+'Seen','1');});
 // Test-only access in an intercepted response. No hooks are shipped in game.js.
 await page.route('**/game.js',async route=>{const r=await route.fetch();let s=await r.text();const end=s.lastIndexOf('})();');assert.ok(end>0);s=s.slice(0,end)+'window.__mobileQA={state,tryMove,updateUi,markUiDirty,mobileExperience};\n'+s.slice(end);await route.fulfill({response:r,body:s});});
 await page.goto(server.url+'?scenario=enemy_roster_hd');
 await page.waitForFunction(()=>window.__mobileQA,null,{timeout:90000});
 for(let i=0;i<90;i++){if(await page.locator('#bootScreen.hidden').count())break;await page.keyboard.press('Enter');await page.waitForTimeout(250);}
 await page.waitForFunction(()=>document.getElementById('bootScreen').classList.contains('hidden'));
 assert.equal(await page.evaluate(()=>JSON.parse(render_game_to_text()).phase),'playing');
 return page;
}
async function metrics(page) {
 return page.evaluate(()=>{const box=q=>{const e=document.querySelector(q),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,radius:parseFloat(s.borderTopLeftRadius),shown:s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}};
 return {headers:['#mobileCommandDeck','#mobileMenuButton','#mobileFullscreenButton'].map(box),canvas:box('#game'),hp:box('#hpRail'),protection:box('#protectionRail'),dpad:box('.mobile-dpad'),extract:box('#mbtnQ'),interact:box('#mbtnE'),buttons:['#mbtnUp','#mbtnDown','#mbtnLeft','#mbtnRight','#mbtnZ','#mbtnX','#mbtnC','#mbtnF','#mbtnG'].map(box),overflow:document.documentElement.scrollWidth>innerWidth,css:document.body.className};});
}
function checkLayout(m,width,height) {
 assert.ok(!m.overflow,'no horizontal page overflow');
 assert.ok(Math.abs(m.canvas.w-m.canvas.h)<1,'square board');
 assert.ok(m.hp.shown&&m.protection.shown,'both PC-style rails visible');
 assert.ok(m.hp.x+m.hp.w<=m.canvas.x && m.protection.x>=m.canvas.x+m.canvas.w-1,'rails flank board');
 assert.ok(m.hp.h>=m.canvas.h*.95,'HP spans board height');
 assert.ok(m.canvas.y>=0 && m.canvas.y+m.canvas.h<=height,'whole board visible');
 const rightCenter=width>height?(m.protection.x+m.protection.w+width)/2:width*.75;
 assert.ok(Math.abs(m.dpad.x+m.dpad.w/2-rightCenter)<2,'D-pad centred in the right panel');
 assert.equal(m.extract.shown,false,'no permanent extract button');
 for(const b of m.buttons)assert.ok(b.shown&&b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,'reachable 44px target '+JSON.stringify(b));
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(const b of m.buttons) {
  assert.equal(overlap(b,m.canvas),false,'controls never cover board');
  for(const header of m.headers)assert.ok(!header.shown||!overlap(b,header),'controls never overlap the header');
 }
 for(let i=0;i<m.buttons.length;i++)for(let j=i+1;j<m.buttons.length;j++)assert.equal(overlap(m.buttons[i],m.buttons[j]),false,'touch targets remain separated');
 const skills=m.buttons.slice(4,7),items=m.buttons.slice(7);
 const leftCenter=width>height?m.hp.x/2:width*.25;
 assert.ok(Math.abs(skills.reduce((sum,b)=>sum+b.x+b.w/2,0)/3-leftCenter)<2,'skills centred in the left panel');
 for(const b of [...skills,...items])assert.ok(Math.abs(b.w-b.h)<1&&b.radius>=49,'round action buttons');
 for(const b of items)assert.ok(b.y+b.h+8<=m.dpad.y,'consumables above the D-pad with a gap');
 assert.ok(Math.abs(items.reduce((sum,b)=>sum+b.x+b.w/2,0)/2-rightCenter)<2,'consumables share the D-pad centre');
 if(width===360&&height===640)for(const b of items)assert.ok(b.w>=72,'larger consumables also fit small portrait');
 if(width===915&&height===412) {for(const b of skills)assert.ok(b.w>=84,'enlarged skills');for(const b of items)assert.ok(b.w>=80,'enlarged consumables');}
}
async function setupPortal(page,{on=false,cleared=true}={}) {
 await page.evaluate(({on,cleared})=>{
  const q=__mobileQA,s=q.state;q.mobileExperience.close();s.phase='playing';s.tutorialModalOpen=false;s.tutorialPortalSeen=true;s.tutorialCampSeen=true;s.tutorialRunSeen=true;s.tutorialCampAutoPending=false;
  s.turnInProgress=false;s.enemyTurnInProgress=false;s.dashAimActive=false;s.extractConfirm=null;s.extractRelicPrompt=null;s.forgePrompt=null;s.pactPrompt=null;s.merchantMenuOpen=false;
  s.enemies=cleared?[]:[{id:'remote',type:'slime',name:'Slime',x:7,y:7,hp:10,maxHp:10,attack:1}];s.roomCleared=cleared;s.roomType='combat';s.pits=[];s.chests=[];s.spikes=[];s.mines=[];s.portal={x:4,y:4};s.player.x=on?4:3;s.player.y=4;s.player.hp=s.player.maxHp=100;s.player.gold=125;s.player.frozenMoveTurns=0;s.player.bleedOutOfCombatTick=false;s.relics=[];s.observerBot.enabled=false;
  q.markUiDirty();q.updateUi();
 },{on,cleared});
}
try {
 for(const [name,w,h] of [['landscape',915,412],['browser-chrome',844,288],['small-landscape',667,375],['portrait',390,844],['small-portrait',360,640],['tablet',1024,768]]) {
  const p=await boot(w,h);const m=await metrics(p);checkLayout(m,w,h);
  if(name==='landscape')assert.ok(m.canvas.w>=390,'landscape board is larger than the audited 341px');
  if(polish) {
   assert.ok(await p.locator('#mbtnZ strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=11),'legible action names');
   assert.ok(await p.locator('.mobile-hud-gold > span').evaluate(e=>getComputedStyle(e).display!=='none'),'gold always has a label');
   if(name==='landscape')assert.ok(await p.locator('#mbtnZ img').evaluate(e=>e.getBoundingClientRect().width>=32),'large skill icon');
  }
  await p.screenshot({path:path.join(out,'final-'+name+'.png')});results.push({name,...m});await p.close();
 }
 const rotation=await boot(390,844);await rotation.setViewportSize({width:844,height:390});await rotation.waitForTimeout(200);checkLayout(await metrics(rotation),844,390);await rotation.setViewportSize({width:390,height:844});await rotation.waitForTimeout(200);checkLayout(await metrics(rotation),390,844);await rotation.close();
 const p=await boot(915,412);
 await p.locator('#mobileFullscreenButton').tap();await p.waitForFunction(()=>Boolean(document.fullscreenElement));
 await p.locator('#mobileFullscreenButton').tap();await p.waitForFunction(()=>!document.fullscreenElement);
 await p.setViewportSize({width:915,height:412});
 // Low HP and nonzero protections must remain legible, independent of tiny deck meters.
 await p.evaluate(()=>{const q=__mobileQA;q.state.player.hp=18;q.state.player.skillShield=30;q.state.player.hpShield=20;q.markUiDirty();q.updateUi();});
 assert.ok(await p.locator('#hpRail.is-low').count());assert.equal(await p.locator('#hpRailValue').textContent(),'18/100');
 assert.equal(await p.locator('#shieldRailTrack').getAttribute('aria-valuenow'),'30');assert.equal(await p.locator('#barrierRailTrack').getAttribute('aria-valuenow'),'20');
 // Capture the settled meter, not the first frame of its 150ms transition.
 await p.waitForFunction(()=>['hpRailTrack','shieldRailTrack','barrierRailTrack'].every(id=>{
  const track=document.getElementById(id),fill=track.querySelector('.room-vital-fill');
  const ratio=Number(track.getAttribute('aria-valuenow'))/Number(track.getAttribute('aria-valuemax'));
  return Math.abs(fill.getBoundingClientRect().height-Math.max(0,track.clientHeight*ratio-2))<2;
 }));
 await p.screenshot({path:path.join(out,'final-low-health.png')});
 const potionBefore=await p.evaluate(()=>__mobileQA.state.player.potions);
 await p.locator('#mbtnF').tap();await p.waitForFunction(n=>__mobileQA.state.player.potions===n-1,potionBefore);
 assert.ok(await p.evaluate(()=>__mobileQA.state.player.hp>18),'right-side potion heals via the existing action');
 await p.waitForFunction(()=>!__mobileQA.state.turnInProgress&&!__mobileQA.state.enemyTurnInProgress);
 const emptyElixirTurn=await p.evaluate(()=>__mobileQA.state.turn);
 // A real touch may land on an aria-disabled control; Playwright's locator.tap intentionally refuses it.
 const emptyElixir=await p.locator('#mbtnG').boundingBox();await p.touchscreen.tap(emptyElixir.x+emptyElixir.width/2,emptyElixir.y+emptyElixir.height/2);
 assert.equal(await p.evaluate(()=>__mobileQA.state.turn),emptyElixirTurn,'empty elixir does not spend a turn');
 await p.evaluate(()=>{const q=__mobileQA;q.state.elixirLoadout={type:DungeonElixirData.ELIXIRS[0].id,charges:2};q.state.player.lastElixirUseTurn=-1;q.markUiDirty();q.updateUi();});
 const usedBefore=await p.evaluate(()=>__mobileQA.state.elixirsUsedThisGame||0);
 await p.locator('#mbtnG').tap();await p.waitForFunction(()=>__mobileQA.state.elixirLoadout.charges===1);
 assert.equal(await p.evaluate(()=>__mobileQA.state.elixirsUsedThisGame),usedBefore+1,'right-side elixir uses the equipped item exactly once');
 await p.screenshot({path:path.join(out,'final-consumable-used.png')});
 await setupPortal(p);
 await p.evaluate(()=>{const overlay=document.createElement('section');overlay.id='qa-canonical-overlay';overlay.className='ranked-v3-overlay';overlay.hidden=false;document.body.append(overlay);});
 // Simulate a previously accepted turn settling under a canonical overlay.
 await p.evaluate(()=>{__mobileQA.tryMove(1,0);__mobileQA.updateUi();});await p.waitForTimeout(150);
 assert.equal(await p.locator('#mobileJourneyDialog').evaluate(e=>e.open),false,'canonical overlay owns pending choice');
 await p.evaluate(()=>{document.getElementById('qa-canonical-overlay').hidden=true;});
 await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 await p.locator('[data-journey=close]').tap();await p.evaluate(()=>document.getElementById('qa-canonical-overlay').remove());
 await setupPortal(p);
 await p.locator('#mbtnRight').tap();await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 await p.screenshot({path:path.join(out,'final-portal.png')});
 const before=await p.evaluate(()=>({x:__mobileQA.state.player.x,turn:__mobileQA.state.turn,depth:__mobileQA.state.depth}));
 await p.keyboard.press('ArrowRight');await p.keyboard.press('z');
 assert.deepEqual(await p.evaluate(()=>({x:__mobileQA.state.player.x,turn:__mobileQA.state.turn,depth:__mobileQA.state.depth})),before,'dialog blocks global gameplay keys');
 await p.locator('[data-journey=close]').tap();await p.waitForTimeout(100);assert.equal(await p.locator('#mobileJourneyDialog').evaluate(e=>e.open),false);
 const context=await metrics(p);assert.ok(context.interact.shown&&context.interact.w>=44,'contextual centre target visible');
 assert.ok(Math.abs(context.interact.x+context.interact.w/2-context.dpad.x-context.dpad.w/2)<1,'interaction centred horizontally');
 assert.ok(Math.abs(context.interact.y+context.interact.h/2-context.dpad.y-context.dpad.h/2)<1,'interaction centred vertically');
 await p.screenshot({path:path.join(out,'final-context-action.png')});
 await p.locator('#mbtnE').tap();await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 assert.equal(await p.evaluate(()=>__mobileQA.state.depth),before.depth,'centre action opens choices without automatic descent');
 await p.locator('[data-journey=close]').tap();
 await p.locator('#mbtnLeft').tap();await p.waitForTimeout(160);await p.locator('#mbtnRight').tap();await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 await p.locator('[data-journey=descend]').tap();await p.waitForFunction(d=>__mobileQA.state.depth===d,before.depth+1);
 // Camp dispatch follows existing extraction semantics, with no new gold arithmetic.
 await setupPortal(p);await p.locator('#mbtnRight').tap();await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 await p.locator('[data-journey=camp]').tap();await p.waitForFunction(()=>__mobileQA.state.phase==='camp');await p.waitForTimeout(700);await p.screenshot({path:path.join(out,'final-camp.png')});
 await setupPortal(p,{cleared:false});
 await p.locator('#mobileMenuButton').tap();await p.waitForFunction(()=>document.querySelector('#mobileJourneyDialog').open);
 assert.equal(await p.locator('#mobileMenuButton').getAttribute('aria-expanded'),'true');
 assert.equal(await p.locator('#mobileMenuButton').getAttribute('aria-controls'),'mobileJourneyDialog');
 if(polish)assert.ok(await p.locator('#mobileJourneyDialog').evaluate(d=>[...d.querySelectorAll('button')].every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})),'all run-menu choices fit without scrolling at 915x412');
 await p.screenshot({path:path.join(out,'final-run-menu.png')});
 await p.locator('[data-journey=retreat]').tap();await p.waitForFunction(()=>Boolean(__mobileQA.state.extractConfirm));
 assert.equal(await p.evaluate(()=>__mobileQA.state.player.gold),125,'emergency prompt never charges gold');
 await p.screenshot({path:path.join(out,'final-emergency.png')});await p.keyboard.press('Escape');
 assert.equal(await p.evaluate(()=>__mobileQA.state.extractConfirm),null);assert.equal(await p.evaluate(()=>__mobileQA.state.player.gold),125);
 await setupPortal(p);
 await p.locator('#mbtnZ').tap();assert.equal(await p.evaluate(()=>__mobileQA.state.dashAimActive),true);await p.screenshot({path:path.join(out,'final-dash-armed.png')});await p.locator('#mbtnZ').tap();assert.equal(await p.evaluate(()=>__mobileQA.state.dashAimActive),false);
 await p.locator('#mobileMenuButton').tap();await p.locator('[data-journey=stats]').tap();assert.ok(await p.locator('body.mobile-details-open').count());await p.waitForTimeout(200);if(polish)assert.ok(await p.locator('.mobile-command-location').evaluate(e=>getComputedStyle(e).visibility==='hidden'||getComputedStyle(e).display==='none'),'details never share their text area with the gameplay header');
 await p.screenshot({path:path.join(out,'final-details.png')});await p.locator('#mobileDetailsButton').tap();
 // Unsupported/fullscreen denial is recoverable; no forced permission or retry loop.
 await p.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('denied'));});
 await p.locator('#mobileFullscreenButton').tap();await p.waitForFunction(()=>document.querySelector('.journey-feedback')?.textContent.includes('unavailable'));
 await p.locator('[data-journey=close]').tap();
 await p.locator('#mobileMenuButton').tap();await p.locator('[data-journey=menu]').tap();await p.waitForTimeout(700);await p.screenshot({path:path.join(out,'final-game-menu.png')});await p.close();
 const desktop=await boot(1440,900,false);assert.equal(await desktop.locator('body.mobile-touch').count(),0);await setupPortal(desktop,{on:true});assert.equal(await desktop.locator('#mobileJourneyDialog').evaluate(e=>e.open),false);await desktop.screenshot({path:path.join(out,'final-desktop.png')});await desktop.close();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 await writeFile(path.join(out,'result.json'),JSON.stringify({pass:true,viewports:results,journey:['entry','cancel','reentry','descend','camp','emergency-cancel','input-block','dash-toggle','details','canonical-overlay-priority','meter-fill-values','fullscreen-toggle','fullscreen-denied','desktop-unchanged'],errors,missing},null,2));
 console.log('PASS: six mobile sizes, side rails, 44px targets, centred D-pad, round split controls, rotation, potion and contextual interaction, portal/descent/camp, emergency cancel, menu input lock, skills, fullscreen fallback and desktop.');
} catch(error) { console.error(JSON.stringify({errors,missing}));throw error; }
finally { await browser.close();await new Promise(resolve=>server.server.close(resolve)); }
