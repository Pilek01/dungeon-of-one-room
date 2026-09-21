(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DungeonHD2Presentation=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function deathRecord(snapshot,enemy,layers){
  const boss=layers.selectBossVisual(snapshot,enemy);
  const selection=boss.diagnostic?layers.selectEnemyVisual(snapshot,enemy):boss;
  if(selection.diagnostic)return null;
  const spriteSize=boss.diagnostic?Math.round(layers.getEnemyRenderSize(selection.type)*(enemy.elite?1.2:1)):selection.renderSize;
  let offsetX=0,offsetY=0;
  if(Number.isFinite(enemy._tweenT)&&enemy._tweenT>=0&&enemy._tweenT<120&&Number.isFinite(enemy._tweenFromX)&&Number.isFinite(enemy._tweenFromY)){
   const t=enemy._tweenT/120,remaining=(1-t)*(1-t);
   offsetX=(enemy._tweenFromX/16-enemy.x)*remaining;offsetY=(enemy._tweenFromY/16-enemy.y)*remaining;
  }
  return {spriteKey:selection.key.replace(/\.[^.]+\.\d+$/,'.death.01'),spriteSize,offsetX,offsetY,sourceId:enemy.id,facing:enemy.facing,durationMs:boss.diagnostic?480:640};
 }
 function deathFrame(event,now){
  const age=now-Number(event.startedAtMs),duration=Number(event.durationMs);
  if(age<0||age>=duration||!Number.isFinite(age)||!(duration>0))return null;
  const progress=age/duration,frame=Math.min(4,1+Math.floor(progress*4));
  return {frame,key:event.spriteKey.replace(/\d+$/,String(frame).padStart(2,'0')),alpha:Math.min(1,(1-progress)/.3)};
 }
 function drawDeaths(context,snapshot,assets){
  if(!context?.save||!context?.drawImage)return;
  for(const event of snapshot.visualEvents||[]){
   if(event.kind!=='enemy_death'||!event.spriteKey)continue;
   const pose=deathFrame(event,Number(snapshot.nowMs));if(!pose)continue;
   const image=assets.get(pose.key)||assets.get(event.spriteKey)||assets.get(event.spriteKey.replace(/\.death\.\d+$/,'.idle.01'));if(!image)continue;
   const size=event.spriteSize||64;context.save();context.globalAlpha=pose.alpha;
   context.drawImage(image,(event.x+(event.offsetX||0))*64+32-size/2,(event.y+(event.offsetY||0))*64+64-size,size,size);context.restore();
  }
 }
 // Feet, not weapons or weak magical glows, establish the frame origin.
 function footAnchor(data,width,height){
  let bottom=-1;
  for(let y=height-1;y>=0&&bottom<0;y--)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=200){bottom=y;break;}
  if(bottom<0)return {x:width/2,y:height};
  let sum=0,count=0;
  for(let y=Math.max(0,bottom-Math.round(height*.12));y<=bottom;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=200){sum+=x;count++;}
  return {x:count?sum/count:width/2,y:bottom};
 }
 const anchors=new WeakMap();
 function imageAnchor(image){
  if(anchors.has(image))return anchors.get(image);
  let anchor=null;
  try {const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
   const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):typeof document==='object'?document.createElement('canvas'):null;
   if(canvas&&w&&h){canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);anchor=footAnchor(ctx.getImageData(0,0,w,h).data,w,h);anchor.width=w;anchor.height=h;}
  } catch (_) { /* Tainted or unavailable canvas leaves the authored origin intact. */ }
  anchors.set(image,anchor);return anchor;
 }
 function anchorOffset(image,reference,size){
  if(image===reference||!reference)return {x:0,y:0};
  const a=imageAnchor(image),b=imageAnchor(reference);if(!a||!b)return {x:0,y:0};
  const clamp=n=>Math.max(-size*.035,Math.min(size*.035,n));
  return {x:clamp((b.x/b.width-a.x/a.width)*size),y:clamp((b.y/b.height-a.y/a.height)*size)};
 }
 const styles=Object.freeze({npc_venom:{shape:'droplets',color:'#a5c95f'},npc_hex:{shape:'rune',color:'#d995d6'},npc_heal:{shape:'cross',color:'#b7eacb'},npc_buff:{shape:'diamond',color:'#dfc783'},npc_rift:{shape:'tear',color:'#a7a0f2'}});
 function skillCommands(snapshot){
  return (snapshot.visualEvents||[]).slice(-24).flatMap(event=>{
   const style=styles[event.kind],age=Number(snapshot.nowMs)-Number(event.startedAtMs),duration=Number(event.durationMs);
   if(!style||age<0||age>=duration)return [];
   return [{...style,kind:event.kind,x:Number.isFinite(event.targetX)?event.targetX:event.x,y:Number.isFinite(event.targetY)?event.targetY:event.y,progress:age/duration,alpha:.7*(1-age/duration)}];
  });
 }
 function drawSkills(context,snapshot){
  if(!context?.beginPath||!context?.save)return;
  for(const c of skillCommands(snapshot)){
   const x=c.x*64+32,y=c.y*64+25,r=9+c.progress*10;
   context.save();context.globalAlpha=c.alpha;context.strokeStyle=c.color;context.fillStyle=c.color;context.lineWidth=2;context.beginPath();
   if(c.shape==='cross'){context.moveTo(x-r,y);context.lineTo(x+r,y);context.moveTo(x,y-r);context.lineTo(x,y+r);}
   else if(c.shape==='rune'||c.shape==='diamond'){context.moveTo(x,y-r);context.lineTo(x+r,y);context.lineTo(x,y+r);context.lineTo(x-r,y);context.closePath();if(c.shape==='rune'){context.moveTo(x-r,y-r);context.lineTo(x+r,y+r);context.moveTo(x+r,y-r);context.lineTo(x-r,y+r);}}
   else if(c.shape==='tear'){context.moveTo(x-5,y-r);context.lineTo(x+4,y-3);context.lineTo(x-4,y+4);context.lineTo(x+5,y+r);}
   else {for(let i=0;i<3;i++){const dx=(i-1)*10;context.moveTo(x+dx,y-8+c.progress*12);context.lineTo(x+dx-3,y+c.progress*12);context.lineTo(x+dx+3,y+c.progress*12);context.closePath();}}
   context.stroke();context.restore();
  }
 }
 function actorStatuses(actor){
  if(!actor||Number(actor.hp)<=0)return [];
  const active=[],positive=key=>Number(actor[key])>0;
  if(actor.frozen===true||actor.frost===true||actor.frozenThisTurn===true||positive('frozenMoveTurns')||positive('frostFx'))active.push('freeze');
  if(actor.poisoned===true||positive('poisonTurns'))active.push('poison');
  if(actor.burn===true||positive('burnTurns'))active.push('burn');
  if(actor.bleeding===true||positive('bleedTurns'))active.push('bleed');
  if(actor.disoriented===true||positive('disorientedTurns'))active.push('disorient');
  if(actor.acolyteBuff===true||positive('acolyteBuffTurns'))active.push('buff');
  return active;
 }
 function drawActorStatuses(ctx,actor,bounds,nowMs){
  const statuses=actorStatuses(actor).slice(0,4);
  if(!statuses.length||!ctx?.save||!ctx?.beginPath)return;
  const {x,y,size:s}=bounds;
  if(![x,y,s].every(Number.isFinite)||s<=0)return;
  const cx=x+s*.5,foot=y+s*.92,time=(Number(nowMs)||0)/1000;
  const seed=String(actor.id||actor.type||'player').split('').reduce((n,c)=>n+c.charCodeAt(0),0)*.137;
  const cycle=(rate,i)=>((time*rate+i*.217+seed)%1+1)%1;
  const diamond=(px,py,w,h)=>{ctx.beginPath();ctx.moveTo(px,py-h);ctx.lineTo(px+w,py);ctx.lineTo(px,py+h);ctx.lineTo(px-w,py);ctx.closePath();};
  const droplet=(px,py,r)=>{ctx.beginPath();ctx.moveTo(px,py-r*2.4);ctx.lineTo(px+r,py);ctx.arc(px,py,r,0,Math.PI);ctx.closePath();};
  const flame=(px,py,r)=>{
   const curve=(a,b,c,d)=>typeof ctx.quadraticCurveTo==='function'?ctx.quadraticCurveTo(a,b,c,d):ctx.lineTo(c,d);
   ctx.beginPath();ctx.moveTo(px-r,py);curve(px-r*1.5,py-r*1.5,px-r*.2,py-r*2.3);curve(px+r*.6,py-r*3.4,px,py-r*4.2);curve(px+r*2,py-r*2.8,px+r*.8,py-r*1.4);curve(px+r*1.8,py-r*.2,px+r*.3,py);ctx.closePath();
  };
  ctx.save();
  try {
   ctx.lineWidth=Math.max(1,s/90);ctx.globalCompositeOperation='source-over';
   for(const status of statuses){
    if(status==='freeze'){
     ctx.globalAlpha=.15;ctx.fillStyle='#77bedb';ctx.strokeStyle='#c9f4ff';
     ctx.beginPath();ctx.moveTo(cx-s*.23,foot);ctx.lineTo(cx-s*.25,y+s*.57);ctx.lineTo(cx-s*.12,y+s*.3);ctx.lineTo(cx+s*.1,y+s*.26);ctx.lineTo(cx+s*.24,y+s*.57);ctx.lineTo(cx+s*.21,foot);ctx.closePath();ctx.fill();
     ctx.globalAlpha=.65;ctx.stroke();
     for(let i=0;i<4;i++){const dx=(i-1.5)*s*.13;diamond(cx+dx,foot-s*.07,s*.035,s*(.07+(i%2)*.04));ctx.fillStyle='#a6dbea';ctx.globalAlpha=.6;ctx.fill();ctx.stroke();}
    }else if(status==='poison'){
     for(let i=0;i<5;i++){const p=cycle(.65,i),px=cx+Math.sin(i*2.4+p*3)*s*.19,py=foot-p*s*.58;
      ctx.globalAlpha=.22+Math.sin(p*Math.PI)*.22;ctx.fillStyle='#6e9d46';ctx.strokeStyle='#b5d776';ctx.beginPath();ctx.arc(px,py,s*(.024+p*.025),0,Math.PI*2);ctx.fill();ctx.stroke();}
    }else if(status==='burn'){
     for(let i=0;i<5;i++){const p=cycle(1.15,i),px=cx+(i-2)*s*.085+Math.sin(time*7+i)*s*.014,py=foot-p*s*.38;
      ctx.globalAlpha=.72*(1-p*.65);ctx.fillStyle=i%2?'#e67c32':'#c84424';flame(px,py,s*(.055-p*.026));ctx.fill();
      ctx.fillStyle='#ffd18a';flame(px,py,s*(.022-p*.01));ctx.fill();}
     for(let i=0;i<3;i++){const p=cycle(.85,i);ctx.globalAlpha=.8*(1-p);ctx.fillStyle='#f4bc68';diamond(cx+Math.sin(i*3+time)*s*.18,foot-p*s*.65,s*.009,s*.014);ctx.fill();}
    }else if(status==='bleed'){
     for(let i=0;i<4;i++){const p=cycle(.85,i),px=cx+(i%2?1:-1)*s*(.09+.025*i),py=y+s*.4+p*s*.51;
      ctx.globalAlpha=.85*(1-p*.4);ctx.fillStyle='#a72e3b';ctx.strokeStyle='#e27673';droplet(px,py,s*.021);ctx.fill();ctx.stroke();}
    }else if(status==='disorient'){
     ctx.strokeStyle='#c5a5db';ctx.fillStyle='#ddd0ec';ctx.globalAlpha=.75;
     for(let i=0;i<3;i++){const a=time*2.6+i*Math.PI*2/3;diamond(cx+Math.cos(a)*s*.22,y+s*.17+Math.sin(a)*s*.05,s*.019,s*.028);ctx.fill();}
    }else if(status==='buff'){
     ctx.strokeStyle='#d7bd7f';ctx.globalAlpha=.48;ctx.beginPath();ctx.arc(cx,y+s*.68,s*.23,Math.PI*.15,Math.PI*.85);ctx.stroke();
     for(let i=0;i<3;i++){const p=cycle(.55,i);ctx.fillStyle='#d9c295';ctx.globalAlpha=.65*Math.sin(p*Math.PI);diamond(cx+(i-1)*s*.15,foot-p*s*.55,s*.014,s*.034);ctx.fill();}
    }
   }
  } finally {ctx.restore();}
 }

 return Object.freeze({actorStatuses,drawActorStatuses,deathRecord,deathFrame,drawDeaths,skillCommands,drawSkills,footAnchor,anchorOffset});
});
