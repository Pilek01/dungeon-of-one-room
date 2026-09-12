const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const cues=require('../render/hd2-npc-cues.js');
function extract(source,name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);const open=source.indexOf('{',source.indexOf(')',start));let depth=0;for(let i=open;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(name);}
test('actual game SFX path honors mute, simulation, opt-in and same-cue rate limiting',()=>{
 const source=fs.readFileSync('game.js','utf8');const played=[];
 const state={audioMuted:false,simulation:{suppressAudio:false}};
 const audio={ctx:{currentTime:10},master:{id:'original-master'}};
 let simulation=false;
 const context={state,audio,npcCueGate:cues.createGate(),window:{DungeonHD2NpcCues:cues,DungeonHDRendererLayers:{earlyAnimationsEnabled:true}},isSimulationActive:()=>simulation,ensureAudio:()=>!state.audioMuted,playTone:(ctx,out,tone)=>{assert.equal(ctx,audio.ctx);assert.equal(out,audio.master);played.push(tone);}};
 vm.runInNewContext(extract(source,'playSfx'),context);
 state.audioMuted=true;context.playSfx('npc:heal');assert.equal(played.length,0);
 state.audioMuted=false;context.playSfx('npc:heal');assert.equal(played.length,2);
 context.playSfx('npc:heal');assert.equal(played.length,2);
 audio.ctx.currentTime+=.1;context.playSfx('npc:heal');assert.equal(played.length,4);
 simulation=true;state.simulation.suppressAudio=true;context.playSfx('npc:bash');assert.equal(played.length,4);
 simulation=false;context.window.DungeonHDRendererLayers.earlyAnimationsEnabled=false;context.playSfx('npc:bash');assert.equal(played.length,4);
 context.window.DungeonHDRendererLayers.earlyAnimationsEnabled=true;context.playSfx('npc:unknown');assert.equal(played.length,4);
});
test('NPC cue routing contains real action events and bounds tone energy/duration',()=>{
 for(const kind of Object.values(cues.events))assert.ok(cues.cues[kind]);
 for(const tones of Object.values(cues.cues))for(const t of tones){assert.ok(t.gain>0&&t.gain<=.06);assert.ok(t.duration>0&&t.duration<=.25);assert.ok(t.delay>=0&&t.delay<=.1);}
 assert.equal(cues.events.riftweaver_rift_detonate,'rift');
 assert.equal(cues.events.bulwark_shield_bash,'bash');
 assert.equal(cues.events.warden_soul_chain_fire,'chain');
 assert.equal(cues.events.warden_soul_chain_impact,undefined,'do not replay the shot sound on its impact');
});
