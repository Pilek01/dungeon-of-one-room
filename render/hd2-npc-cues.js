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

  function createGate(){
    const last=new Map();let active=[];
    return (kind,now,sourceId='shared')=>{
      if(!cues[kind]||!Number.isFinite(now))return false;
      for(const [key,time]of last)if(now-time>1)last.delete(key);
      active=active.filter(time=>now-time<.25);
      const key=kind+':'+sourceId,previous=last.get(key);
      if(previous!==undefined&&now-previous<.08)return false;
      // Reserve two voices for magic/danger when melee crowds the room.
      if(active.length>=(kind==='melee'?4:6))return false;
      last.set(key,now);active.push(now);return true;
    };
  }
  const materialFor=(cue,actor)=>['totem','guardian'].includes(actor)?'stone':actor==='skeleton'?'bone':['bulwark','blacksmith_guardian'].includes(actor)?'metal':['venom','rift','hex'].includes(cue)?cue:cue==='chain'||cue==='bash'?'metal':cue==='slam'?'stone':null;
  function materialSamples(material,sampleRate){
    const duration=material==='rift'||material==='hex'?.16:.085,length=Math.round(sampleRate*duration),data=new Float32Array(length);
    let seed=2166136261,low=0;for(const c of material)seed=Math.imul(seed^c.charCodeAt(0),16777619);
    for(let i=0;i<length;i++){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/2147483648-1;
      low+=.18*(noise-low);const progress=i/(length-1),envelope=Math.min(1,i/(sampleRate*.004))*(1-progress)**3;
      const signal=material==='stone'?low:material==='metal'?.5*noise+.5*Math.sin(i/sampleRate*2*Math.PI*1800):material==='bone'?.75*noise:noise-low;
      data[i]=Math.max(-1,Math.min(1,signal))*.018*envelope;
    }return data;
  }
  const buses=new WeakMap(),buffers=new WeakMap();
  function getBus(ctx,master){
    if(typeof ctx.createDynamicsCompressor!=='function')return master;
    const previous=buses.get(ctx);if(previous?.master===master)return previous.node;
    if(previous)previous.node.disconnect();
    const node=ctx.createDynamicsCompressor();node.threshold.value=-19;node.knee.value=12;node.ratio.value=4;node.attack.value=.003;node.release.value=.12;node.connect(master);buses.set(ctx,{master,node});return node;
  }
  function playMaterial(ctx,out,cue,actor,at){
    const material=materialFor(cue,actor);if(!material||typeof ctx.createBufferSource!=='function')return;
    let cache=buffers.get(ctx);if(!cache){cache=new Map();buffers.set(ctx,cache);}
    let buffer=cache.get(material);if(!buffer){const data=materialSamples(material,ctx.sampleRate);buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.copyToChannel(data,0);cache.set(material,buffer);}
    const source=ctx.createBufferSource();source.buffer=buffer;source.connect(out);source.onended=()=>source.disconnect();source.start(at);source.stop(at+buffer.duration+.01);
  }
  return Object.freeze({cues,events,createGate,materialSamples,materialFor,getBus,playMaterial});
});
