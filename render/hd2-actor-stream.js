(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DungeonHD2ActorStream=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const actorKey=key=>String(key).replace(/\.(north|south|east|west|base)\.[^.]+\.\d+$/,'');
 function createStream(manifest,loader,options={},inactiveLimit=2){
  const groups=new Map(), permanent=new Set(), bootstrap=[];
  for(const entry of manifest){
   const actor=/assets\/hd\/(early-v2|all-v2)\//.test(entry.src)&&/^(enemy|boss)\./.test(entry.key);
   if(actor){const id=actorKey(entry.key);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(entry);}
   if(!actor||/\.idle\.01$/.test(entry.key)){bootstrap.push(entry);permanent.add(entry.key);}
  }
  const pending=new Map(), resident=new Map(), retryAfter=new Map();let needed=new Set(),clock=0;let queue=Promise.resolve();
  function prune(assets){
   const unused=[...resident].filter(([id])=>!needed.has(id)).sort((a,b)=>a[1]-b[1]);
   while(unused.length>inactiveLimit){const [id]=unused.shift();for(const e of groups.get(id))if(!permanent.has(e.key))assets.delete(e.key);resident.delete(id);}
  }
  function ensure(keys,assets){
   needed=new Set(keys.map(actorKey).filter(id=>groups.has(id))); const jobs=[];
   for(const id of needed){
    if(resident.has(id)){resident.set(id,++clock);continue;}
    if(pending.has(id)){jobs.push(pending.get(id));continue;}
    if((retryAfter.get(id)||0)>Date.now())continue;
    const job=queue.then(()=>loader.loadAssets(groups.get(id),{...options,onProgress:undefined})).then(result=>{
     if(!result||result.ready!==true||!(result.loaded instanceof Map)||result.failures?.length)throw Error('incomplete actor');
     for(const e of groups.get(id))if(!result.loaded.has(e.key))throw Error('missing actor frame');
     for(const [key,image]of result.loaded)assets.set(key,image);
     resident.set(id,++clock);retryAfter.delete(id);prune(assets);
    }).catch(()=>{retryAfter.set(id,Date.now()+10000);}).finally(()=>pending.delete(id));
    queue=job;pending.set(id,job);jobs.push(job);
   }
   prune(assets);return Promise.all(jobs);
  }
  return Object.freeze({bootstrap,ensure,getStats:()=>({resident:[...resident.keys()],pending:[...pending.keys()],bootstrapCount:bootstrap.length})});
 }
 return Object.freeze({createStream,actorKey});
});
