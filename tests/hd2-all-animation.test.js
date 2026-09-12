const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(file, enabled=true) {
  const ctx={window:{location:{search:enabled?'?hd2=1':''}}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../render/hd-expansion-art-entries.js'),'utf8'),ctx);
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../render',file),'utf8'),ctx);
  return ctx.window;
}
test('HD2 covers every mobile enemy and boss variant with a complete expanded catalog',()=>{
  const old=load('hd-asset-manifest.js',false).DungeonHDAssetManifest.entries;
  const next=load('hd-asset-manifest.js').DungeonHDAssetManifest.entries;
  const actors=next.filter(e=>/assets\/hd\/(early|all)-v2\//.test(e.src));
  assert.equal(actors.length,2400);
  assert.equal(new Set(next.map(e=>e.key)).size,next.length);
  const sourceActors=old.filter(e=>/^(actor\.player|enemy|boss)\./.test(e.key)&&/\/(?:frames)\/(?:south|north|east|west|base)-(?:idle|move|attack|cast|awaken|hit|death)-\d\d\.png$/.test(e.src));
  for(const before of sourceActors) {
    const replacement=next.find(e=>e.key===before.key);
    assert.ok(replacement && /assets\/hd\/(early|all)-v2\//.test(replacement.src),before.key);
  }
  for(const entry of actors) {
    const bytes=fs.readFileSync(path.resolve(__dirname,'..',entry.src));
    assert.equal(bytes[25],6,entry.src);
    assert.ok([128,256].includes(bytes.readUInt32BE(16)),entry.src);
    assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20),entry.src);
  }
});
test('all enemies and bosses use the existing movement clock and valid action keys',()=>{
  const layers=load('hd-renderer-layers.js').DungeonHDRendererLayers;
  const manifest=load('hd-asset-manifest.js').DungeonHDAssetManifest;
  for(const type of ['slime','skeleton','brute','acolyte','skitter','otter','riftweaver','bulwark','guardian','blacksmith_guardian','warden']) {
    const boss=['guardian','blacksmith_guardian','warden'].includes(type);
    const select=boss?layers.selectBossVisual:layers.selectEnemyVisual;
    for(let frame=1;frame<=8;frame++) {
      const actor={type,hp:100,facing:'east',_tweenT:(frame-1)*15};
      const snapshot={depth:1,nowMs:99999,finalBossPhase:1};
      const before=structuredClone({actor,snapshot});
      const result=select(snapshot,actor);
      assert.equal(result.frame,frame,type);
      assert.ok(manifest.getByKey(result.key),result.key);
      assert.deepEqual({actor,snapshot},before);
    }
  }
  for(const type of ['skeleton','acolyte','riftweaver','bulwark','guardian','blacksmith_guardian','warden']) {
    const boss=['guardian','blacksmith_guardian','warden'].includes(type);
    const actor={type,hp:100,aiming:true,riftAiming:true,bulwarkBashAiming:true,slamAiming:true,anvilAiming:true,telegraphAge:99};
    const held=(boss?layers.selectBossVisual:layers.selectEnemyVisual)({finalBossPhase:1},actor);
    assert.equal(held.frame,5,type);
    assert.ok(manifest.getByKey(held.key),held.key);
  }
});
