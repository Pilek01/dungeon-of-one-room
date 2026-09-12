(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DungeonHD2NpcCues=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  // Short procedural cues use the game's existing master/mute path. No assets,
  // random values, independent AudioContext or render-loop playback.
  const tone=(frequency,endFrequency,duration,type='sine',gain=.035,delay=0)=>Object.freeze({frequency,endFrequency,duration,type,gain,delay});
  const cues=Object.freeze({
    charge:Object.freeze([tone(180,340,.14,'triangle',.022)]),
    melee:Object.freeze([tone(130,65,.07,'triangle',.032)]),
    bolt:Object.freeze([tone(640,170,.09,'triangle',.03)]),
    heal:Object.freeze([tone(440,660,.12),tone(660,880,.16,'sine',.03,.07)]),
    buff:Object.freeze([tone(220,330,.14,'triangle'),tone(330,440,.18,'triangle',.025,.06)]),
    hex:Object.freeze([tone(360,150,.15,'sawtooth',.018),tone(190,120,.11,'sine',.03,.05)]),
    venom:Object.freeze([tone(800,260,.07,'triangle',.026),tone(460,120,.06,'triangle',.018,.04)]),
    bash:Object.freeze([tone(115,48,.13,'triangle',.055),tone(720,220,.045,'square',.012)]),
    rift:Object.freeze([tone(150,70,.2,'sawtooth',.022),tone(570,95,.18,'triangle',.03)]),
    chain:Object.freeze([tone(850,460,.035,'square',.014),tone(670,300,.055,'square',.014,.04)]),
    blink:Object.freeze([tone(700,110,.12,'sine',.03)]),
    slam:Object.freeze([tone(95,38,.2,'triangle',.055),tone(170,60,.08,'sawtooth',.017)]),
    aura:Object.freeze([tone(150,260,.15,'triangle',.025)])
  });
  const events=Object.freeze({
    npc_rift:'rift',
    npc_charge:'charge',npc_melee:'melee',npc_bolt:'bolt',npc_heal:'heal',npc_buff:'buff',npc_hex:'hex',npc_venom:'venom',npc_slam:'slam',npc_aura:'aura',
    riftweaver_rift_detonate:'rift',bulwark_shield_bash:'bash',warden_lattice_burst:'rift',warden_voidstep_vanish:'blink',warden_soul_chain_fire:'chain',blacksmith_chain_hook_fire:'chain',blacksmith_overheat_transition:'aura',vault_hoard_sentence_cast:'hex',vault_lockdown_detonate:'slam',warden_doom_sigil_explode:'rift'
  });
  function createGate(){const last=new Map();return (kind,now)=>{if(!cues[kind]||!Number.isFinite(now))return false;const previous=last.get(kind);if(previous!==undefined&&now-previous<.08)return false;last.set(kind,now);return true;};}
  return Object.freeze({cues,events,createGate});
});
