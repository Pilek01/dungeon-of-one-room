const test = require('node:test');
const assert = require('node:assert/strict');
const {createPortalGate} = require('../render/mobile-experience.js');
const ready = {enabled:true,phase:'playing',onPortal:true,cleared:true,enemies:0,blocked:false,automated:false,location:'1:4:4'};
test('portal prompts once after arrival, stays dismissed until leaving, and rearms at another depth',()=>{
 const gate=createPortalGate();
 assert.equal(gate(ready),true);assert.equal(gate(ready),false);
 assert.equal(gate({...ready,onPortal:false}),false);assert.equal(gate(ready),true);
 assert.equal(gate({...ready,location:'2:4:4'}),true);
});
test('no popup for sealed rooms, desktop, bots, pending turns or another reward overlay',()=>{
 for(const change of [{cleared:false},{enemies:1},{enabled:false},{automated:true},{blocked:true},{phase:'relic'}]){
  const gate=createPortalGate();assert.equal(gate({...ready,...change}),false);
  assert.equal(gate(ready),true,'arrival can open once the blocking state resolves');
 }
});
test('an intervening canonical reward can finish before the portal choice is shown again',()=>{
 const gate=createPortalGate();assert.equal(gate(ready),true);
 assert.equal(gate({...ready,blocked:true}),false);assert.equal(gate(ready),true);
});
