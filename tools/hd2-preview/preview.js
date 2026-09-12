'use strict';
const $ = id => document.getElementById(id);
const counts = { idle: 8, move: 8, attack: 8, cast: 8, awaken: 8, hit: 4, death: 4 };
const durations = { idle: 1000, move: 120, attack: 240, hit: 120, death: 360 };
let frames = [], originals = [], paused = false, time = 0, previous = 0, selected = 0, revision = 0;
let actors = [], activeActor;
const contexts = ['before', 'after', 'zoom'].map(id => $(id).getContext('2d'));
async function getImage(src) {
  const image = new Image(); image.src = src; await image.decode(); return image;
}
async function loadFrames() {
  const current = ++revision;
  delete document.body.dataset.loaded;
  const actor = $('actor').value;
  activeActor = actors.find(a => a.id === actor);
  if (!activeActor) return;
  const selection = $('clip').value;
  const clip = actor === 'totem' && selection === 'move' ? 'awaken' : selection === 'attack' ? activeActor.action : selection;
  const direction = actor === 'totem' ? 'base' : $('direction').value;
  $('direction').disabled = actor === 'totem';
  const oldCount = counts[clip] / 2;
  const oldRoot = activeActor.folder;
  const suffix = n => String(n + 1).padStart(2, '0');
  try {
    const results = await Promise.all([
      Promise.all(Array.from({length: counts[clip]}, (_, n) => getImage(`../../assets/hd/${activeActor.root}/${direction}-${clip}-${suffix(n)}.png`))),
      Promise.all(Array.from({length: oldCount}, (_, n) => getImage(`../../assets/hd/${oldRoot}/frames/${direction}-${clip}-${suffix(n)}.png`)))
    ]);
    if (revision !== current) return;
    [frames, originals] = results; time = 0; selected = 0;
    document.body.dataset.loaded = `${actor}:${selection}:${direction}`;
    $('rail').replaceChildren(...frames.map((image, n) => {
      const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 180;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 26, 24, 128, 128);
      ctx.fillStyle = '#aba38e'; ctx.font = '14px system-ui'; ctx.fillText(String(n+1).padStart(2,'0'), 10, 170);
      canvas.onclick = () => { paused = true; selected = n; $('pause').textContent = 'Odtwórz'; };
      return canvas;
    }));
    $('note').textContent = selection === 'attack' && actor === 'skeleton'
      ? 'Podgląd pełnego gestu łucznika. W grze skeleton trzyma naciągnięty łuk podczas celowania; puszczenie cięciwy jest powiązane z rzeczywistym strzałem.'
      : clip === 'death' && actor !== 'player'
      ? 'Podgląd przygotowanych klatek śmierci. Gra usuwa pokonanych przeciwników od razu; ta sekwencja nie wydłuża ich obecności ani nie blokuje pola.'
      : actor === 'skitter'
      ? 'Skitter 2.0: czytelniejszy chitynowy pancerz, wyraźniejsza głowa i przegubowe odnóża. Jego reguły ruchu i walki pozostają takie same.'
      : actor === 'totem'
      ? 'Totem pozostaje nieruchomy. Opcja Ruch pokazuje przygotowaną sekwencję przebudzenia; Atak pokazuje rzucanie zaklęcia.'
      : 'Ta sama skala planszy i czas tur. Slow motion służy wyłącznie oglądaniu klatek. Przy celowaniu gra zatrzymuje pozę przygotowania do chwili rzeczywistego ataku.';
  } catch (error) { $('status').textContent = `Nie udało się wczytać klatek: ${error.message}`; }
}
function draw(ctx, image, zoom) {
  ctx.clearRect(0, 0, 720, 540);
  ctx.fillStyle = '#1b1d18'; ctx.fillRect(0, 0, 720, 540);
  const tile = 128;
  for (let y=0;y<5;y++) for(let x=0;x<6;x++) {
    ctx.fillStyle = (x+y)%2 ? '#262820' : '#23251e'; ctx.fillRect(x*tile+1,y*tile+1,tile-2,tile-2);
  }
  const base = activeActor.renderSize;
  const size = zoom ? Math.min(base * 6, 450) : base * 2;
  const floor = zoom ? 472 : Math.max(320, size + 24);
  ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(360,floor-7,size*.26,size*.045,0,0,Math.PI*2);ctx.fill();
  ctx.imageSmoothingEnabled = image.width > 64;
  ctx.drawImage(image, 360-size/2, floor-size, size, size);
  ctx.fillStyle = '#928c7a';ctx.font='22px system-ui';ctx.fillText(zoom?'Powiększenie detalu':'Skala gry',24,505);
}
function tick(now) {
  const delta = previous ? Math.min(80, now-previous) : 0; previous=now;
  if (frames.length) {
    const clip=$('clip').value, duration=clip==='attack'?activeActor.actionDuration:durations[clip];
    if (!paused) {
      time += delta * Number($('speed').value);
      // Let short actions return to rest before repeating; idle loops continuously.
      const cycle = clip === 'idle' ? duration : duration + 450;
      selected = Math.min(frames.length-1, Math.floor((time%cycle)/duration*frames.length));
    }
    draw(contexts[0],originals[Math.floor(selected/2)],false);
    draw(contexts[1],frames[selected],false);draw(contexts[2],frames[selected],true);
    [...$('rail').children].forEach((el,n)=>el.classList.toggle('active',n===selected));
    $('status').textContent = `${selected+1} / ${frames.length} klatek · ${duration} ms · ${paused?'pauza':'odtwarzanie'}`;
  }
  requestAnimationFrame(tick);
}
for(const id of ['actor','clip','direction']) $(id).onchange=loadFrames;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Odtwórz':'Pauza';};
fetch('actors.json').then(response=>response.json()).then(value=>{
  actors=value;
  $('actor').replaceChildren(...actors.map(a=>new Option(a.label,a.id)));
  loadFrames();
}).catch(error=>{$('status').textContent=error.message;});
requestAnimationFrame(tick);
