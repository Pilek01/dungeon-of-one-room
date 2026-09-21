const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function layers(){const ctx={window:{location:{search:'?hd2=1'}}};vm.runInNewContext(fs.readFileSync('render/hd-renderer-layers.js','utf8'),ctx);return ctx.window.DungeonHDRendererLayers;}
test('disorientation flash cannot impersonate a melee hit; actual hit starts on impact',()=>{
 const actor={id:'s',type:'skitter',hp:10,castFlash:80,disorientedTurns:0};
 assert.equal(layers().selectEnemyVisual({},actor).clip,'idle');
 const snapshot={nowMs:1000,visualEvents:[{kind:'npc_melee',sourceId:'s',startedAtMs:1000,durationMs:140}]};
 assert.equal(layers().selectEnemyVisual(snapshot,actor).frame,6);
 assert.equal(layers().selectEnemyVisual({...snapshot,nowMs:1099},actor).frame,8);
 assert.equal(layers().selectEnemyVisual({...snapshot,nowMs:1141},actor).clip,'idle');
});
test('a real lattice burst overrides remaining lattice preparation, chain miss still animates',()=>{
 for(const [type,kind,extra] of [['warden','warden_lattice_burst',{latticeAiming:true}],['blacksmith_guardian','blacksmith_chain_hook_fire',{}]]){
  const actor={id:'boss',type,hp:10,...extra};
  const snapshot={nowMs:1000,finalBossPhase:1,visualEvents:[{sourceId:'boss',kind,startedAtMs:1000,durationMs:300}]};
  const result=layers().selectBossVisual(snapshot,actor);
  assert.equal(result.frame,6);assert.notEqual(result.clip,'idle');
  assert.equal(layers().selectBossVisual({...snapshot,nowMs:1400},actor).frame,extra.latticeAiming?5:4);
 }
});
test('preparation flash never releases Riftweaver or Bulwark before execution',()=>{
 const api=layers();
 for(const [type,flag] of [['riftweaver','riftAiming'],['bulwark','bulwarkBashAiming']]){
  for(const castFlash of [320,200,1,0]){const e={type,hp:10,[flag]:true,castFlash};assert.ok(api.selectEnemyVisual({},e).frame<=5,type);}
  assert.equal(api.selectEnemyVisual({},{type,hp:10,castFlash:320}).frame,6);
 }
});
test('every special boss windup stays in the preparation half even with rests/flash',()=>{
 const api=layers();
 for(const [type,flag] of [['warden','latticeAiming'],['warden','voidStepAiming'],['warden','soulChainAiming'],['guardian','vaultLockdownAiming'],['blacksmith_guardian','blacksmithChainAiming']]){
  const result=api.selectBossVisual({finalBossPhase:1},{type,hp:10,[flag]:true,rests:true,castFlash:120});
  assert.notEqual(result.clip,'idle',flag);assert.ok(result.frame<=5,flag);
 }
});
test('healing event preserves Acolyte pose after AI clears cast type, without mutation',()=>{
 const snapshot={nowMs:1000,visualEvents:[{kind:'npc_heal',sourceId:'healer',startedAtMs:980,durationMs:120}]};
 const actor={id:'healer',type:'acolyte',hp:10,castFlash:100,acolyteCastType:'',facing:'east'};
 const before=structuredClone({snapshot,actor});
 assert.match(layers().selectEnemyVisual(snapshot,actor).key,/\.heal\./);
 assert.deepEqual({snapshot,actor},before);
});

test('totem aura stays anchored in idle; only real hex or venom releases a cast',()=>{const api=layers(),actor={id:'t',type:'totem',hp:5,castFlash:80,_tweenT:40};assert.equal(api.selectEnemyVisual({nowMs:1000},actor).clip,'idle');for(const kind of ['npc_hex','npc_venom']){const events=[{kind,sourceId:'t',startedAtMs:1000,durationMs:140}];const result=api.selectEnemyVisual({nowMs:1000,visualEvents:events},actor);assert.equal(result.clip,'cast');assert.equal(result.frame,6);assert.equal(api.selectEnemyVisual({nowMs:1141,visualEvents:events},actor).clip,'idle');}});
