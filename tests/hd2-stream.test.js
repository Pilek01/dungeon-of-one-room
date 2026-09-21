const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStream}=require('../render/hd2-actor-stream.js');
const entry=(actor,clip,frame)=>({key:'enemy.'+actor+'.south.'+clip+'.'+frame,src:'assets/hd/all-v2/'+actor+'/south-'+clip+'-'+frame+'.png',critical:true,group:'enemies'});
test('bootstrap preserves critical assets and idle fallback; loads only requested actors and evicts unused clips',async()=>{
 const manifest=[{key:'floor',src:'floor.png',critical:true,group:'world'},...['slime','totem','brute'].flatMap(a=>[entry(a,'idle','01'),entry(a,'death','01'),entry(a,'move','02')])];
 let calls=0; const loader={loadAssets:async entries=>{calls++;return {ready:true,failures:[],loaded:new Map(entries.map(e=>[e.key,{}]))};}};
 const stream=createStream(manifest,loader,{},0);assert.equal(stream.bootstrap.length,4);
 const assets=new Map(stream.bootstrap.map(e=>[e.key,{}]));
 await Promise.all([stream.ensure(['enemy.slime.south.move.02'],assets),stream.ensure(['enemy.slime.south.death.01'],assets)]);
 assert.equal(calls,1);assert(assets.has('enemy.slime.south.death.01'));assert(!assets.has('enemy.brute.south.move.02'));
 await stream.ensure(['enemy.brute.south.move.02'],assets);
 assert(!assets.has('enemy.slime.south.death.01'));assert(assets.has('enemy.slime.south.idle.01'));assert(assets.has('floor'));
});
test('failed actor load keeps fallback and does not retry on every render',async()=>{
 let calls=0;const stream=createStream([entry('slime','idle','01'),entry('slime','death','01')],{loadAssets:async()=>{calls++;throw Error('offline');}},{});
 const assets=new Map([[entry('slime','idle','01').key,{}]]);
 await stream.ensure(['enemy.slime.south.death.01'],assets);await stream.ensure(['enemy.slime.south.death.01'],assets);
 assert.equal(calls,1);assert.equal(assets.size,1);
});
