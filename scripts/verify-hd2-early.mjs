import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchMutedBrowser } from './playwright-muted-launch.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', {paths: [
  process.env.DUNGEON_PLAYWRIGHT_NODE_MODULES || '',
  path.join(process.env.USERPROFILE || '', '.codex/skills/develop-web-game/node_modules'),
  path.resolve('node_modules')
]}));
const base = process.env.HD2_PREVIEW_URL || 'http://127.0.0.1:5182';
const out = path.resolve('output/verification/hd2');
const actors = JSON.parse(await readFile('tools/hd2-preview/actors.json','utf8'));
let sequences = 0;
await mkdir(out, {recursive:true});
const browser = await launchMutedBrowser(chromium, {headless:true});
const errors = [], missing = [], requests = [];
const context = await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(() => {
  localStorage.setItem('dungeonOneRoomPlayerName', 'HD2QA');
  localStorage.setItem('dungeonOneRoomTutorialSeen', '1');
  localStorage.setItem('dungeonOneRoomAudioMuted', '1');
});
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if(r.status() >= 400 && !r.url().endsWith('favicon.ico')) missing.push([r.status(),r.url()]); });
page.on('request', r => requests.push(r.url()));
try {
  await page.goto(`${base}/tools/hd2-preview/`);
  await page.waitForFunction(() => document.querySelector('#actor')?.options.length === 19);
  for(const descriptor of actors) {
    const actor = descriptor.id;
    await page.selectOption('#actor',actor);
    for(const clip of ['idle','move','attack','hit','death']) {
      await page.selectOption('#clip',clip);
      for(const direction of descriptor.directions) {
        if(direction !== 'base') await page.selectOption('#direction',direction);
        await page.waitForFunction(expected => document.body.dataset.loaded === expected,`${actor}:${clip}:${direction}`);
        sequences++;
      }
    }
    await page.selectOption('#clip','attack');
    if(actor !== 'totem') await page.selectOption('#direction','south');
    await page.waitForFunction(expected => document.body.dataset.loaded === expected,`${actor}:attack:${actor === 'totem' ? 'base' : 'south'}`);
    await page.locator('#rail canvas').nth(4).click();
    await page.screenshot({path:path.join(out,`${actor}-attack.png`),fullPage:true});
  }
  const start = requests.length;
  await page.goto(`${base}/output/hd2-dist/?hd2=1&scenario=enemy_roster_hd`);
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function',null,{timeout:90000});
  for(let i=0;i<60;i++) {
    const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    if(state.phase==='playing' && await page.locator('#bootScreen.hidden').count()===1) break;
    await page.keyboard.press('Enter'); await page.waitForTimeout(350);
  }
  const initial = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  assert.equal(initial.phase,'playing');
  await page.waitForFunction(()=>document.getElementById('bootScreen')?.classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>window.DungeonHDRendererLayers.earlyAnimationsEnabled),true);
  const actualAssets = requests.slice(start).filter(u=>/\/assets\/hd\/(early|all)-v2\//.test(u));
  assert.equal(new Set(actualAssets).size,2400);
  await page.screenshot({path:path.join(out,'game-hd2.png'),fullPage:true});
  for(const key of ['ArrowUp','ArrowRight','Space','ArrowDown']) {
    await page.keyboard.press(key); await page.waitForTimeout(180);
  }
  const after = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  await writeFile(path.join(out,'game-state.json'),JSON.stringify({initial,after},null,2));
  await page.screenshot({path:path.join(out,'game-after-actions.png'),fullPage:true});
  for (const scenario of ['vault_guardian_hd','blacksmith_guardian_hd','descent_warden_hd','corruption_warden_hd','abyss_warden_hd','warden_phase1_hd','warden_phase2_aegis_hd']) {
    await page.goto(`${base}/output/hd2-dist/?hd2=1&scenario=${scenario}`);
    await page.waitForFunction(()=>typeof window.render_game_to_text==='function',null,{timeout:90000});
    for(let i=0;i<60;i++) {
      if(await page.locator('#bootScreen.hidden').count()===1) break;
      await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    }
    await page.waitForFunction(()=>document.getElementById('bootScreen')?.classList.contains('hidden'));
    await page.waitForTimeout(1000);
    const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    assert.equal(state.phase,'playing');
    await page.screenshot({path:path.join(out,`${scenario}.png`),fullPage:true});
    await writeFile(path.join(out,`${scenario}.json`),JSON.stringify(state,null,2));
  }
  assert.deepEqual(errors,[]); assert.deepEqual(missing,[]);
  await writeFile(path.join(out,'summary.json'),JSON.stringify({pass:true,loadedAssets:new Set(actualAssets).size,previewSequences:sequences,errors,missing},null,2));
  console.log(`PASS: ${sequences} preview sequences, 2400 HD2 assets, game boot and action burst, no missing assets or page errors.`);
} catch(error) {
  console.error(JSON.stringify({errors,missing,selection:await page.evaluate(()=>({actor:document.querySelector('#actor')?.value,clip:document.querySelector('#clip')?.value,direction:document.querySelector('#direction')?.value,loaded:document.body.dataset.loaded,status:document.querySelector('#status')?.textContent})).catch(()=>null)}));
  throw error;
} finally { await browser.close(); }
