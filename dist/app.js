import {ThreadLights,drawThreads} from './luminous-threads.js?v=16';
import {DrawingView} from './drawing-view.js?v=12';
import {PlaybackClock} from './playback-clock.js?v=9';
import {MixRecorder,canRecord} from './recorder.js?v=7';
import {PRESETS,matchingPreset} from './presets.js?v=6';
import {inkMask,thin,graphFromSkeleton,resonance,chooseEdge,pointOnEdge} from './geometry.js';
import {Resonator} from './audio.js?v=7';
import {bellPitch,bellDecay,curvature,noteName,tunePitch,SCALES} from './music.js';
import {Traveller,defaultStarts} from './traveller.js?v=2';
import {INSTRUMENTS,instrument,isNoteVoice} from './instruments.js?v=6';
import {Conversation,pieceEnvelope} from './performance.js';
import {CONTROL_LIMITS,validateComposition} from './composition.js?v=6';
const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const $=id=>document.getElementById(id),canvas=$('drawing'),ctx=canvas.getContext('2d'),scope=$('scope'),sx=scope.getContext('2d');
const audio=new Resonator(),travellers=Array.from({length:3},(_,i)=>new Traveller(i));
let image=null,graph=null,selected=0,playing=false,recording=false,busy=false,visualMode='threads',totalTime=0,loadId=0,pathVector=null,downloadURL=null,finished=false,lastSpeaker=null;
const view=new DrawingView(),threadLights=new ThreadLights();
const visualNow=()=>performance.now()/1000;
let lastThreadMotion=0,hoverVoice=null;
let drawingWidth=1,drawingHeight=1,panDrag=null;
try{
  const adopted=localStorage.getItem('filigrana-threads-default')==='1',saved=localStorage.getItem('filigrana-visual-mode');
  if(adopted&&['threads','trace','dim'].includes(saved))visualMode=saved;
  else{localStorage.setItem('filigrana-visual-mode','threads');localStorage.setItem('filigrana-threads-default','1');}
}catch{}
$('visual-mode').value=visualMode;
function applyVisualMode(){ hoverVoice=null;$('canvas-wrap').classList.toggle('luminous',visualMode==='threads');document.documentElement.classList.toggle('luminous-mode',visualMode==='threads');paintPaths();draw(); }
applyVisualMode();
$('visual-mode').onchange=()=>{visualMode=$('visual-mode').value;try{localStorage.setItem('filigrana-visual-mode',visualMode);}catch{}applyVisualMode();};
let recorder=null,pendingRecorder=null,recordPreparing=false,recordSaving=false,recordGeneration=0;
try{const saved=localStorage.getItem('filigrana-recording-format');if(['mp3','wav'].includes(saved))$('record-format').value=saved;}catch{}
function recordingInfo(){
  const rate=(Math.min($('record-format').value==='mp3'?48000:192000,audio.ctx?.sampleRate||48000)/1000).toLocaleString('en-US',{maximumFractionDigits:1});
  $('record-format-info').textContent=canRecord()?`${$('record-format').value==='wav'?'24-bit': '320 kbps'} · ${rate} kHz · stereo`:'Recording is unavailable in this browser.';
  $('record-format').disabled=recordPreparing||recordSaving||recording;
}
$('record-format').onchange=()=>{try{localStorage.setItem('filigrana-recording-format',$('record-format').value);}catch{}recordingInfo();};
const recordingMenu=$('record-settings');
document.addEventListener('click',event=>{if(!recordingMenu.contains(event.target))recordingMenu.removeAttribute('open');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&recordingMenu.hasAttribute('open')){recordingMenu.removeAttribute('open');recordingMenu.querySelector('summary').focus();}});
const conversation=new Conversation();
const playbackClock=new PlaybackClock(advanceMusic);
let musicDirty=false;
let openVoice=null,drag=null,suppressClick=false;
function voiceOverview(){
  $('voice-editor').hidden=openVoice===null;$('mix-controls').hidden=openVoice!==null;
  for(const t of travellers){
    const button=$(`voice-${t.id}`);if(!button)continue;
    button.setAttribute('aria-expanded',String(openVoice===t.id));button.closest('.voice-chip').classList.toggle('editing',openVoice===t.id);
    button.classList.toggle('selected',selected===t.id);button.classList.toggle('muted',!t.enabled);
    if(!t.enabled)$(`voice-light-${t.id}`)?.getAnimations?.().forEach(animation=>animation.cancel());
    $(`voice-name-${t.id}`).textContent=instrument(t.instrument).label;
    $(`mute-${t.id}`).setAttribute('aria-pressed',String(!t.enabled));
    $(`mute-${t.id}`).textContent=t.enabled?'On':'Muted';
    $(`traveller-${t.id}`).hidden=openVoice!==t.id;
  }
}
function selectVoice(id,toggle=false){
  selected=id;openVoice=toggle&&openVoice===id?null:id;uiState();updateLabels();draw();
  if(toggle&&openVoice!==null&&window.matchMedia?.('(max-width:700px)')?.matches)$('voice-editor').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
$('back-to-mix').onclick=()=>{const id=openVoice;openVoice=null;voiceOverview();if(id!==null)$(`voice-${id}`).focus();};

let palette={paper:'#f4f1e9',green:'#527153'};
const photoColours=['#a94c2c','#276b86','#79518d'];
function paintPaths(){
  pathVector=null;if(!graph)return;
  pathVector=new Path2D();
  for(const e of graph.edges)e.points.forEach((p,i)=>i?pathVector.lineTo(p.x,p.y):pathVector.moveTo(p.x,p.y));
}
function refreshPalette(){
  const styles=getComputedStyle(document.documentElement),value=key=>styles.getPropertyValue(key).trim();
  palette={paper:value('--paper'),green:value('--green')};
  for(const t of travellers)t.colour=value(`--voice-${t.id+1}`);
  paintPaths();draw();
}
document.addEventListener('filigrana-theme-change',refreshPalette);

const settings=()=>({speed:+$('speed').value/100,tuning:+$('tuning').value,q:+$('q').value,volume:+$('volume').value/100,mode:$('branch').value,interaction:$('interaction').value,gap:+$('response-gap').value,duration:+$('duration').value,room:+$('room').value/100,delayTime:+$('delay-time').value/1000,delayMix:+$('delay-mix').value/100,delayFeedback:+$('delay-feedback').value/100,delayEnabled:$('delay-enabled').checked});
function updateEffects(){const s=settings();audio.setRoom(s.room);audio.setDelay(s.delayTime,s.delayMix,s.delayFeedback,s.delayEnabled);}
const active=()=>travellers.filter(t=>t.enabled&&t.walker);
function message(text=''){$('message').textContent=text;$('message').hidden=!text;}
function pitch(t,edge){const s=settings();return isNoteVoice(t.instrument)?bellPitch(edge.length,graph,s.tuning,t.scale,t.octave):tunePitch(resonance(edge,graph,s.tuning),s.tuning,t.scale,t.octave,28,96);}
function perform(t,note){
  const s=settings();if(!t.enabled||!t.walker)return;
  if(s.interaction==='conversation'&&lastSpeaker!==null&&lastSpeaker!==t.id&&!isNoteVoice(travellers[lastSpeaker].instrument))audio.silenceChannel(lastSpeaker);
  audio.setTraveller(t.id,t.volume,t.pan);
  if(note.type==='note'){
    if(!audio.strike(note.hz,s.q,0,note.bend,t.id,t.instrument))return;
    t.strikes++;
  }else{audio.tune(note.hz,s.q,t.id);audio.exciteEdge(t.instrument,note.duration,t.id);}
  t.heardPitch=note.hz;t.pulse=1;lastSpeaker=t.id;pulseVoice(t.id);
  if(visualMode==='threads')threadLights.emit(graph,t.id,t.walker.edge,t.walker.from,t.walker.distance,visualNow());
}
function pulseVoice(id){
  const light=$(`voice-light-${id}`);if(!light)return;light.getAnimations?.().forEach(animation=>animation.cancel());
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  light.animate?.(reduced?[{opacity:.55},{opacity:1},{opacity:.55}]:[{opacity:.55,filter:'brightness(1)',boxShadow:'0 0 8px 1px currentColor'},{offset:.12,opacity:1,filter:'brightness(1.5)',boxShadow:'0 0 20px 5px currentColor'},{opacity:.55,filter:'brightness(1)',boxShadow:'0 0 8px 1px currentColor'}],{duration:reduced?900:1700,easing:'ease-out'});
}
function answer(){
  const s=settings();if(s.interaction!=='conversation'||!pieceEnvelope(totalTime,s.duration).acceptNotes)return;
  const next=conversation.next(totalTime,active().map(t=>t.id),s.gap);if(next)perform(travellers[next.id],next.note);
}
function soundEdge(t){
  if(!playing||!t.enabled||!t.walker)return;const s=settings(),e=graph.edges[t.walker.edge];if(!pieceEnvelope(totalTime,s.duration).acceptNotes)return;updateEffects();
  let note;
  if(isNoteVoice(t.instrument)){
    const hz=t.phrasing.visit(e,totalTime,graph,s.tuning,t.spacing*(instrument(t.instrument).spacing||1),t.scale,t.octave);
    if(hz===null)return;note={type:'note',hz,bend:curvature(e)};
  }else{
    note={type:'resonance',hz:pitch(t,e),duration:(e.length-t.walker.distance)/(t.speed*s.speed)};
  }
  if(s.interaction==='conversation')conversation.offer(t.id,note);else perform(t,note);
}
function uiState(){
  $('play-label').textContent=playing?'Pause':recordPreparing?'Cancel':finished?'Listen again':'Listen';$('play-icon').innerHTML=icon(playing?'pause':recordPreparing?'close':'play');
  $('state').textContent=busy?'ANALYSING':!image?'UPLOAD DRAWING':playing?`${active().length} TRAVELLING`:finished?'FINISHED':graph?.edges.length?'READY':'NO PATHS';
  $('play').disabled=busy||!active().length;$('reset').disabled=busy||!travellers.some(t=>t.origin);$('record').disabled=recordPreparing||recordSaving||busy||!active().length||!canRecord();
  $('record-label').textContent=recordPreparing?'Preparing…':recordSaving?'Saving…':recording?'Save recording':'Record';$('record-icon').innerHTML=icon(recordPreparing||recordSaving?'loader':recording?'stop':'record');$('record').setAttribute('aria-pressed',String(recording));$('record').setAttribute('aria-busy',String(recordPreparing||recordSaving));$('record-indicator').hidden=!recording;recordingInfo();$('record').classList.toggle('recording',recording);$('record').classList.toggle('busy',recordPreparing||recordSaving);
  $('save-score').disabled=busy||!image||!graph?.edges.length;
  for(const t of travellers){
    $(`traveller-${t.id}`).classList.toggle('selected',t.id===selected);$(`traveller-${t.id}`).classList.toggle('inactive',!t.enabled);
    $(`place-${t.id}`).setAttribute('aria-pressed',t.id===selected);$(`place-${t.id}`).disabled=busy||!graph?.edges.length;
    $(`enabled-${t.id}`).checked=t.enabled;
  }
  $('canvas-note').parentElement.hidden=!busy&&Boolean(graph?.edges.length);
  $('canvas-note').textContent=!image?'Upload a drawing to begin':busy?'Reading drawing…':'No paths detected';
  voiceOverview();audio.setActiveCount(active().length);
}
function stop(){playbackClock.stop();playing=false;audio.silence();conversation.reset();lastSpeaker=null;if(recordPreparing)cancelRecordingPreparation();else if(recording)endRecording();uiState();}
function place(t,edgeId,from,distance=0){threadLights.clear(t.id);audio.silenceChannel(t.id);conversation.remove(t.id);t.place(edgeId,from,distance);soundEdge(t);uiState();draw();}
function paintRange(input){const min=+(input.getAttribute('min')||0),max=+(input.getAttribute('max')||100),value=+input.value;input.style.setProperty('--range-progress',`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`);}
function refreshRanges(){document.querySelectorAll('input[type=range]').forEach(paintRange);}
function syncTraveller(t){
  for(const key of ['instrument','octave','scale'])$(`${key}-${t.id}`).value=t[key];$(`enabled-${t.id}`).checked=t.enabled;
  for(const [key,value,unit]of [['speed',t.speed,' px/s'],['spacing',t.spacing,' s'],['volume',Math.round(t.volume*100),'%'],['pan',Math.round(t.pan*100),'']]){
    $(`expression-${key}-${t.id}`).value=value;paintRange($(`expression-${key}-${t.id}`));$(`expression-${key}-value-${t.id}`).textContent=key==='pan'?(value===0?'Center':`${Math.abs(value)}% ${value<0?'L':'R'}`):value+unit;
  }
}
function mountTravellers(){
  for(const t of travellers){
    const card=document.createElement('section');card.className='traveller';card.id=`traveller-${t.id}`;card.style.setProperty('--traveller',`var(--voice-${t.id+1})`);card.setAttribute('aria-label',`Voice ${t.id+1} settings`);card.hidden=true;
    card.innerHTML=`<div class="traveller-heading"><span><i></i>Voice ${t.id+1}</span><label class="enable-label"><input id="enabled-${t.id}" type="checkbox" checked aria-label="Enable voice ${t.id+1}">On</label></div>
      <button class="place-button" id="place-${t.id}" aria-pressed="${t.id===0}" aria-label="Set start for voice ${t.id+1}">${icon('pin')} Set start</button>
      <div class="traveller-fields"><label for="instrument-${t.id}">Instrument</label><select id="instrument-${t.id}" aria-label="Instrument for voice ${t.id+1}">${Object.entries(INSTRUMENTS).map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select>
      <label for="octave-${t.id}">Octave</label><select id="octave-${t.id}" aria-label="Octave for voice ${t.id+1}">${[-2,-1,0,1,2].map(o=>`<option value="${o}" ${o===0?'selected':''}>${o>0?'+':''}${o}${o===0?' · original':''}</option>`).join('')}</select>
      <label for="scale-${t.id}">Tuning</label><select id="scale-${t.id}" aria-label="Tuning for voice ${t.id+1}">${Object.entries(SCALES).map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select></div>
      <p class="traveller-note" id="traveller-note-${t.id}">Waiting for ink…</p>
      <details class="traveller-expression"><summary>Expression <span>${icon('plus')}</span></summary>${[['speed','Speed',10,240,1],['spacing','Note spacing',.8,12,.1],['volume','Volume',0,100,1],['pan','Stereo',-100,100,1]].map(([key,label,min,max,step])=>`<label for="expression-${key}-${t.id}">${label}<output id="expression-${key}-value-${t.id}"></output></label><input id="expression-${key}-${t.id}" aria-label="${label} for voice ${t.id+1}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}</details>`;
    $('travellers').append(card);
    const chip=document.createElement('div');chip.className='voice-chip';chip.style.setProperty('--traveller',`var(--voice-${t.id+1})`);
    chip.innerHTML=`<button type="button" class="voice-button" id="voice-${t.id}" aria-expanded="false" aria-controls="traveller-${t.id}" aria-label="Voice ${t.id+1} settings"><span class="voice-number" aria-hidden="true"><i class="voice-light" id="voice-light-${t.id}"></i></span><span class="voice-copy"><strong>Voice ${t.id+1}</strong><span id="voice-name-${t.id}"></span></span></button><button type="button" class="voice-mute" id="mute-${t.id}" aria-pressed="false" aria-label="Mute voice ${t.id+1}">On</button>`;
    $('voice-bar').append(chip);
    $(`voice-${t.id}`).onclick=()=>selectVoice(t.id,true);
    $(`mute-${t.id}`).onclick=()=>{$(`enabled-${t.id}`).checked=!t.enabled;$(`enabled-${t.id}`).onchange();};
    syncTraveller(t);
    for(const key of ['speed','spacing','volume','pan'])$(`expression-${key}-${t.id}`).oninput=()=>{
      const value=+$(`expression-${key}-${t.id}`).value;t[key]=['pan','volume'].includes(key)?value/100:value;
      if(key==='spacing'){t.phrasing.next=totalTime+t.spacing*(instrument(t.instrument).spacing||1);conversation.remove(t.id);}
      audio.setTraveller(t.id,t.volume,t.pan);syncTraveller(t);
    };
    $(`place-${t.id}`).onclick=()=>{selected=t.id;openVoice=null;uiState();updateLabels();draw();canvas.focus();message('Click a line to set this voice’s start.');};
    $(`instrument-${t.id}`).onchange=()=>{
      audio.silenceChannel(t.id);conversation.remove(t.id);t.instrument=$(`instrument-${t.id}`).value;t.phrasing.reset();t.heardPitch=null;updateLabels();soundEdge(t);voiceOverview();draw();
      message();
    };
    $(`enabled-${t.id}`).onchange=()=>{
      t.enabled=$(`enabled-${t.id}`).checked;
      if(t.enabled){t.phrasing.reset();soundEdge(t);}else{audio.silenceChannel(t.id);conversation.remove(t.id);}
      if(playing&&!active().length)stop();uiState();draw();
    };
    for(const kind of ['octave','scale'])$(`${kind}-${t.id}`).onchange=()=>{
      t[kind]=kind==='octave'?+$(`${kind}-${t.id}`).value:$(`${kind}-${t.id}`).value;
      conversation.remove(t.id);
      if(playing&&t.enabled&&t.walker&&!isNoteVoice(t.instrument)){const hz=pitch(t,graph.edges[t.walker.edge]);audio.tune(hz,settings().q,t.id);t.heardPitch=hz;}
      draw();message();
    };
  }
}
async function loadImage(src,name){
  const id=++loadId;stop();busy=true;uiState();message('Reading the image…');
  try{
    const img=new Image();img.src=src;await img.decode();if(id!==loadId)return;image=img;
    const scale=Math.min(1,960/Math.max(img.width,img.height));drawingWidth=Math.round(img.width*scale);drawingHeight=Math.round(img.height*scale);view.setDrawing(drawingWidth,drawingHeight);updateZoomControls();
    $('image-name').textContent=name;await analyse();
  }catch(e){busy=false;message(`Could not read this image. Try a JPEG or PNG. ${e.message}`);uiState();}
}
async function analyse(){
  if(!image)return;stop();threadLights.clear();busy=true;uiState();message('Finding ink, thinning lines, and measuring the paths…');
  await new Promise(r=>setTimeout(r,35));
  try{
    const source=document.createElement('canvas');source.width=drawingWidth;source.height=drawingHeight;const sourceContext=source.getContext('2d',{willReadFrequently:true});
    sourceContext.drawImage(image,0,0,drawingWidth,drawingHeight);
    const mask=thin(inkMask(sourceContext.getImageData(0,0,drawingWidth,drawingHeight).data,drawingWidth,drawingHeight,+$('sensitivity').value),drawingWidth,drawingHeight);
    graph=graphFromSkeleton(mask,drawingWidth,drawingHeight);totalTime=0;finished=false;for(const t of travellers){t.seed=$('seed').value;t.setGraph(graph);}
    paintPaths();
    $('junction-count').textContent=`${graph.junctions.length} junctions`;
    if(graph.edges.length){
      defaultStarts(graph).forEach((start,i)=>travellers[i].place(start.edgeId,start.from,start.distance));
      message();
    }else{
      message('No usable lines found. Increase ink sensitivity, or try a clearer drawing on plain paper.');$('canvas-note').textContent='No paths detected';$('frequency').textContent='—';$('edge-length').textContent='Try another sensitivity';
    }
  }catch(e){graph=null;pathVector=null;for(const t of travellers)t.setGraph(null);message(`Could not extract paths: ${e.message}`);}
  busy=false;uiState();draw();
}
function locateClick(event){
  if(!graph?.edges.length||busy)return;
  const {x,y}=canvasPoint(event),t=travellers[selected];
  let nearest=Infinity,choice=null;
  for(const node of graph.junctions){const d=Math.hypot(node.x-x,node.y-y);if(d<12/view.scale&&d<nearest){nearest=d;choice={node};}}
  if(choice){const n=choice.node,id=chooseEdge(graph,n.id,null,$('branch').value,null,Math.random,t.visits);place(t,id,n.id);message();return;}
  for(const e of graph.edges)for(let i=0;i<e.points.length;i++){const p=e.points[i],d=Math.hypot(p.x-x,p.y-y);if(d<nearest){nearest=d;choice={e,i};}}
  if(!choice||nearest>35/view.scale){message('Click closer to a detected line to choose its start.');return;}
  place(t,choice.e.id,choice.e.a,choice.e.lengths[choice.i]);message();
}
function draw(){
  if(!image)return;
  const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;view.resize(Math.max(1,rect.width),Math.max(1,rect.height));
  const width=Math.round(view.width*ratio),height=Math.round(view.height*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.clearRect(0,0,canvas.width,canvas.height);
  if(visualMode!=='threads'){ctx.fillStyle=palette.paper;ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.save();ctx.setTransform(ratio*view.scale,0,0,ratio*view.scale,ratio*view.x,ratio*view.y);
  if(visualMode==='threads'){
    drawThreads(ctx,{graph,path:pathVector,travellers,scale:view.scale,now:visualNow(),pulses:threadLights.live(visualNow()),lastMotion:lastThreadMotion,playing,hover:hoverVoice,drag,palette,dark:document.documentElement.dataset.theme==='dark',reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches});
  }else{
    ctx.globalAlpha=visualMode==='dim'?.52:.58;ctx.drawImage(image,0,0,drawingWidth,drawingHeight);ctx.globalAlpha=1;
    if(visualMode==='dim'){ctx.fillStyle='rgba(10,17,15,.58)';ctx.fillRect(0,0,drawingWidth,drawingHeight);}
    if(pathVector){ctx.globalAlpha=visualMode==='trace'?.23:.78;ctx.strokeStyle=visualMode==='dim'?'#c8d5c1':palette.green;ctx.lineWidth=1.1;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(pathVector);ctx.globalAlpha=1;}
    if(graph){ctx.fillStyle=visualMode==='dim'?'#d7e3d1':palette.green;ctx.globalAlpha=visualMode==='trace'?.28:.84;for(const n of graph.junctions){ctx.beginPath();ctx.arc(n.x,n.y,1.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
    if(!graph){ctx.restore();return;}
    for(const t of travellers){
      if(!t.walker){$(`traveller-note-${t.id}`).textContent='No path';continue;}
      const e=graph.edges[t.walker.edge],colour=photoColours[t.id],p=drag?.id===t.id?drag.position:t.position();ctx.globalAlpha=(t.enabled?1:.25)*(visualMode==='trace'?.36:visualMode==='dim'?.9:.68);
      ctx.strokeStyle=colour;ctx.lineWidth=visualMode==='trace'?1.6:t.id===selected?2.7:2;ctx.lineJoin='round';ctx.lineCap='round';if(visualMode==='dim'){ctx.shadowColor=colour;ctx.shadowBlur=10;}ctx.beginPath();e.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();ctx.shadowBlur=0;
      if(t.enabled)for(let i=0;i<t.trail.length;i+=2){ctx.globalAlpha=(i/t.trail.length)*(visualMode==='trace'?.24:visualMode==='dim'?.42:.32);ctx.fillStyle=colour;ctx.beginPath();ctx.arc(t.trail[i].x,t.trail[i].y,1.5,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=(t.enabled?(visualMode==='trace'?.09:visualMode==='dim'?.22:.12):.04);ctx.fillStyle=colour;ctx.beginPath();ctx.arc(p.x,p.y,10+t.pulse*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=t.enabled?1:.35;
      ctx.strokeStyle=visualMode==='dim'?'#18221e':palette.paper;ctx.fillStyle=colour;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillStyle=colour;ctx.fillText(String(t.id+1),p.x,p.y-12);ctx.globalAlpha=1;
    }
  }
  if(!graph){ctx.restore();return;}
  for(const t of travellers){if(!t.walker)continue;const hz=t.heardPitch??pitch(t,graph.edges[t.walker.edge]);$(`traveller-note-${t.id}`).textContent=`${t.enabled?'':'Off · '}${t.scale==='free'?`${hz.toFixed(1)} Hz`:noteName(hz)} · ${isNoteVoice(t.instrument)?`${t.strikes} ${t.strikes===1?'note':'notes'}`:'resonance'}`;}
  const t=travellers[selected];if(t.walker){const e=graph.edges[t.walker.edge],hz=t.heardPitch??pitch(t,e),note=isNoteVoice(t.instrument);
    $('frequency').textContent=t.scale==='free'?hz.toFixed(1):Math.round(hz);
    $('note-name').textContent=`Voice ${selected+1} · ${t.scale==='free'?'free pitch':noteName(hz)}${t.heardPitch===null?' · ready':''}`;
    $('resonance-label').textContent=note?'LAST NOTE · SELECTED TRAVELLER':'RESONANCE · SELECTED TRAVELLER';$('edge-length').textContent=`${Math.round(e.length)} px · segment ${e.id+1}`;
  }
  ctx.restore();
}
function advanceMusic(dt){
  if(!playing||dt<=0)return;
  totalTime+=dt;lastThreadMotion=visualNow();musicDirty=true;const s=settings(),form=pieceEnvelope(totalTime,s.duration);
  if(form.finished){finished=true;stop();message();return;}
  audio.setVolume(s.volume*form.gain);
  for(const t of travellers){t.advance(dt,t.speed*s.speed,s.mode,soundEdge);if(t.enabled&&t.walker&&isNoteVoice(t.instrument)){const e=graph.edges[t.walker.edge];audio.colour(curvature(e,t.walker.reverse?e.length-t.walker.distance:t.walker.distance),t.id);}}
  if(form.acceptNotes)answer();else conversation.pending.clear();
  if(!active().length)stop();
}
function frame(){
  if(!document.hidden&&(playing||musicDirty||(visualMode==='threads'&&(threadLights.live(visualNow()).length||visualNow()<lastThreadMotion+4)))){draw();musicDirty=false;}
  const s=settings(),form=pieceEnvelope(totalTime,s.duration),status=finished?'Finished.':playing&&!form.acceptNotes?'Last notes…':'';
  if($('performance-status').textContent!==status)$('performance-status').textContent=status;
  $('performance-status').hidden=!status;
  $('elapsed').textContent=`${String(Math.floor(totalTime/60)).padStart(2,'0')}:${String(Math.floor(totalTime%60)).padStart(2,'0')}`;
  sx.clearRect(0,0,scope.width,scope.height);sx.strokeStyle=palette.green;sx.lineWidth=1.5;sx.beginPath();
  if(audio.analyser&&playing){const data=new Uint8Array(audio.analyser.fftSize);audio.analyser.getByteTimeDomainData(data);for(let i=0;i<data.length;i++){const x=i/(data.length-1)*scope.width,y=scope.height/2+(data[i]-128)/128*scope.height*.46;i?sx.lineTo(x,y):sx.moveTo(x,y);}}
  else{sx.moveTo(0,scope.height/2);sx.lineTo(scope.width,scope.height/2);}sx.stroke();requestAnimationFrame(frame);
}
function startPlayback(){
  if(finished)restart();playing=true;playbackClock.start();const s=settings();conversation.reset();lastSpeaker=null;
  audio.setActiveCount(active().length);audio.setVolume(s.volume*pieceEnvelope(totalTime,s.duration).gain);
  for(const t of active()){audio.setTraveller(t.id,t.volume,t.pan);t.phrasing.reset();soundEdge(t);}answer();uiState();
}
$('play').onclick=async()=>{
  if(playing){stop();return;}
  if(recordPreparing){cancelRecordingPreparation();uiState();return;}
  if(!active().length||busy)return;
  try{await audio.init();await playbackClock.prepare(audio.ctx,audio.master);startPlayback();message();}
  catch(e){stop();message(`Could not start audio: ${e.message}`);}
};
function restart(){threadLights.clear();playbackClock.reset();audio.silence();conversation.reset();lastSpeaker=null;totalTime=0;finished=false;for(const t of travellers){t.seed=$('seed').value;t.restart();}if(playing){audio.setVolume(settings().volume*pieceEnvelope(0,settings().duration).gain);for(const t of active())soundEdge(t);answer();}uiState();draw();}
$('reset').onclick=()=>{restart();message();};

function screenPoint(event){const r=canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
function canvasPoint(event){const p=screenPoint(event);return view.toDrawing(p.x,p.y);}
function updateZoomControls(){$('zoom-value').textContent=`${Math.round(view.zoom*100)}%`;canvas.classList.toggle('zoomed',view.zoom>1);$('zoom-reset').title='Reset zoom';}
function setZoom(next,x,y){view.zoomAt(next,x,y);updateZoomControls();draw();}
$('zoom-in').onclick=()=>setZoom(view.zoom*1.25);$('zoom-out').onclick=()=>setZoom(view.zoom/1.25);$('zoom-reset').onclick=()=>setZoom(1);
canvas.addEventListener('wheel',event=>{event.preventDefault();const p=screenPoint(event);setZoom(view.zoom*Math.exp(-event.deltaY*.001),p.x,p.y);},{passive:false});
window.addEventListener('resize',draw);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe($('canvas-wrap'));
canvas.addEventListener('pointerdown',event=>{
  if(event.shiftKey||event.button===1){if(view.zoom<=1)return;event.preventDefault();panDrag={pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false,placeOnTap:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('panning');return;}
  if(busy||!graph?.edges.length||event.button!==0)return;
  const cursor=screenPoint(event);let nearest=null,distance=20;
  for(const t of travellers){const position=t.position();if(!position)continue;const p=view.toScreen(position.x,position.y),d=Math.hypot(p.x-cursor.x,p.y-cursor.y);if(d<distance){nearest=t;distance=d;}}
  if(!nearest){if(view.zoom>1){event.preventDefault();panDrag={pointer:event.pointerId,x:event.clientX,y:event.clientY,moved:false,placeOnTap:true};canvas.setPointerCapture(event.pointerId);canvas.classList.add('panning');}return;}
  event.preventDefault();selected=nearest.id;if(openVoice!==null)openVoice=nearest.id;drag={id:nearest.id,pointer:event.pointerId,position:nearest.position()};canvas.setPointerCapture(event.pointerId);uiState();draw();
});
canvas.addEventListener('pointermove',event=>{
  if(visualMode==='threads'&&!drag&&!panDrag){const cursor=screenPoint(event);let nearest=null,distance=20;for(const t of travellers){const pos=t.position();if(!pos)continue;const p=view.toScreen(pos.x,pos.y),d=Math.hypot(p.x-cursor.x,p.y-cursor.y);if(d<distance){distance=d;nearest=t.id;}}if(nearest!==hoverVoice){hoverVoice=nearest;draw();}}
  if(panDrag?.pointer===event.pointerId){if(Math.hypot(event.clientX-panDrag.x,event.clientY-panDrag.y)>2)panDrag.moved=true;view.panBy(event.clientX-panDrag.x,event.clientY-panDrag.y);panDrag.x=event.clientX;panDrag.y=event.clientY;draw();return;}
  if(!drag||event.pointerId!==drag.pointer)return;
  const p=canvasPoint(event);drag.position={x:Math.max(0,Math.min(drawingWidth,p.x)),y:Math.max(0,Math.min(drawingHeight,p.y))};draw();
});
canvas.addEventListener('pointerup',event=>{
  if(panDrag?.pointer===event.pointerId){const shouldPlace=panDrag.placeOnTap&&!panDrag.moved;panDrag=null;canvas.classList.remove('panning');suppressClick=true;canvas.releasePointerCapture(event.pointerId);if(shouldPlace)locateClick(event);draw();return;}
  if(!drag||event.pointerId!==drag.pointer)return;
  drag=null;suppressClick=true;canvas.releasePointerCapture(event.pointerId);locateClick(event);draw();
});
canvas.addEventListener('pointerleave',()=>{if(hoverVoice!==null){hoverVoice=null;draw();}});
canvas.addEventListener('pointercancel',()=>{drag=null;panDrag=null;canvas.classList.remove('panning');draw();});
canvas.addEventListener('lostpointercapture',()=>{if(drag){drag=null;draw();}if(panDrag){panDrag=null;canvas.classList.remove('panning');draw();}});
canvas.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}locateClick(event);});canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('play').click();}});
function updateLabels(){
  refreshRanges();
  const s=settings(),voice=instrument(travellers[selected].instrument),note=isNoteVoice(travellers[selected].instrument);
  $('q-label').textContent=note?'Decay · selected instrument':'Ring · selected instrument';$('q-value').textContent=note?`≈ ${Math.min(22,bellDecay(s.q)*(voice.tail||1)).toFixed(1)} s`:s.q;$('tuning-value').textContent=`${noteName(s.tuning)} · ${s.tuning} Hz`;
  for(const id of ['delay-time','delay-mix','delay-feedback'])$(id).disabled=!s.delayEnabled;
  $('response-gap').disabled=s.interaction!=='conversation';
}
for(const [id,unit] of [['speed','%'],['tuning',' Hz'],['q',''],['volume','%'],['sensitivity',''],['response-gap',' s'],['room','%'],['delay-time',' ms'],['delay-mix','%'],['delay-feedback','%']])$(id).oninput=()=>{
  $(`${id}-value`).textContent=$(id).value+unit;const s=settings();updateLabels();updateEffects();if(playing)audio.setVolume(s.volume);
  if(graph){for(const t of active())if(!isNoteVoice(t.instrument)){const hz=pitch(t,graph.edges[t.walker.edge]);audio.tune(hz,s.q,t.id);t.heardPitch=playing?hz:null;}draw();}
};
$('delay-enabled').onchange=()=>{updateLabels();updateEffects();};
$('interaction').onchange=()=>{audio.silence();conversation.reset();lastSpeaker=null;updateLabels();if(playing){audio.setVolume(settings().volume*pieceEnvelope(totalTime,settings().duration).gain);for(const t of active()){t.phrasing.reset();soundEdge(t);}answer();}};
$('seed').onchange=()=>message('The new journey seed will apply when you press Restart.');
function applyPreset(key){
  const mood=PRESETS[key];audio.silence();conversation.reset();lastSpeaker=null;
  for(const t of travellers){t.instrument=mood.keys[t.id];t.octave=mood.octaves[t.id];t.speed=mood.speeds[t.id];t.spacing=mood.spacing[t.id];t.volume=mood.volumes[t.id];t.pan=(t.id-1)*.4;t.scale='pentatonic';t.phrasing.reset();t.heardPitch=null;syncTraveller(t);audio.setTraveller(t.id,t.volume,t.pan);}
  for(const [id,value,unit]of [['room',mood.room,'%'],['q',mood.ring,''],['speed',mood.pace,'%'],['response-gap',mood.gap,' s']]){$(id).value=value;$(`${id}-value`).textContent=value+unit;}
  $('preset').value=key;
  updateEffects();updateLabels();voiceOverview();
  if(playing){audio.setVolume(settings().volume*pieceEnvelope(totalTime,settings().duration).gain);for(const t of active())soundEdge(t);answer();}draw();
}
function customMood(){$('preset').value=matchingPreset(travellers,{room:+$('room').value,ring:+$('q').value,pace:+$('speed').value,gap:+$('response-gap').value});}
$('preset').innerHTML=Object.entries(PRESETS).map(([key,p])=>`<option value="${key}">${key==='still'?'Still · calm trio':p.name}</option>`).join('')+'<option value="custom" disabled>Custom</option>';
$('preset').onchange=()=>{if(Object.hasOwn(PRESETS,$('preset').value)){applyPreset($('preset').value);message();}};
$('load-score-trigger').onclick=()=>$('load-score').click();
document.querySelectorAll('.control-group').forEach(group=>group.addEventListener('toggle',()=>{
  if(group.open)document.querySelectorAll('.control-group[open]').forEach(other=>{if(other!==group)other.open=false;});
}));
document.addEventListener('input',event=>{if(event.target.id!=='preset'&&event.target.matches('input[type=range],select'))customMood();});
document.addEventListener('change',event=>{if(event.target.id!=='preset'&&event.target.matches('select,#delay-enabled'))customMood();});
$('analyse').onclick=analyse;
const drawingSettings=$('drawing-settings');
document.addEventListener('click',event=>{if(drawingSettings.open&&!drawingSettings.contains(event.target))drawingSettings.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawingSettings.open){drawingSettings.open=false;drawingSettings.querySelector('summary').focus();}});
async function asDataURL(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type||'image/jpeg'};base64,${btoa(binary)}`;
}
document.querySelector('label[for=upload]').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('upload').click();}};
$('upload').onchange=async event=>{const file=event.target.files[0];if(!file)return;await loadImage(await asDataURL(file),file.name);event.target.value='';};
function download(blob,name){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=downloadURL;a.download=name;a.click();}
$('save-score').onclick=async()=>{
  if(!image||!graph?.edges.length||busy)return;$('save-score').disabled=true;
  try{
    const src=image.src.startsWith('data:')?image.src:await asDataURL(await (await fetch(image.src)).blob()),controls={};
    for(const key of Object.keys(CONTROL_LIMITS))controls[key]=+$(key).value;
    Object.assign(controls,{branch:$('branch').value,interaction:$('interaction').value,duration:+$('duration').value,seed:$('seed').value,'delay-enabled':$('delay-enabled').checked});
    const score={format:'line-resonator',version:1,image:{src,name:$('image-name').textContent},controls,graph:{w:graph.w,h:graph.h,edges:graph.edges.length},travellers:travellers.map(t=>{
      const {instrument,scale,enabled,octave,speed,spacing,volume,pan}=t,e=graph.edges[t.origin.edgeId],reverse=e.b===t.origin.from&&e.a!==t.origin.from,p=pointOnEdge(e,reverse?e.length-t.origin.distance:t.origin.distance);
      return {instrument,scale,enabled,octave,speed,spacing,volume,pan,origin:{...t.origin,x:p.x/graph.w,y:p.y/graph.h}};
    })};
    validateComposition(score);download(new Blob([JSON.stringify(score)],{type:'application/json'}),'filigrana.line-score.json');message('Composition saved.');
  }catch(error){message(`Could not save the composition: ${error.message}`);}finally{uiState();}
};
$('load-score').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>36e6)throw new Error('Choose a composition smaller than 36 MB.');
    const score=validateComposition(JSON.parse(await file.text()));stop();
    for(const [key,value]of Object.entries(score.controls)){if(key==='delay-enabled')$(key).checked=value;else $(key).value=value;}
    const units={speed:'%',tuning:' Hz',q:'',volume:'%',sensitivity:'',room:'%','delay-time':' ms','delay-feedback':'%','delay-mix':'%','response-gap':' s'};
    for(const [key,unit]of Object.entries(units))$(`${key}-value`).textContent=$(key).value+unit;
    for(const t of travellers){const {origin,...expression}=score.travellers[t.id];Object.assign(t,expression);t.seed=score.controls.seed;syncTraveller(t);}
    await loadImage(score.image.src,score.image.name);
    if(image?.src!==score.image.src||!graph?.edges.length)throw new Error('The saved image could not be read.');
    for(const t of travellers){
      const origin=score.travellers[t.id].origin;if(!origin)continue;const e=graph.edges[origin.edgeId];
      const matched=score.graph.w===graph.w&&score.graph.h===graph.h&&score.graph.edges===graph.edges.length&&e&&(e.a===origin.from||e.b===origin.from)&&origin.distance<=e.length;
      if(matched)t.place(origin.edgeId,origin.from,origin.distance);
      else{let nearest=Infinity,choice=null;for(const edge of graph.edges)for(let i=0;i<edge.points.length;i++){const p=edge.points[i],d=Math.hypot(p.x-origin.x*graph.w,p.y-origin.y*graph.h);if(d<nearest){nearest=d;choice={edge,i};}}if(choice)t.place(choice.edge.id,choice.edge.a,choice.edge.lengths[choice.i]);}
    }
    customMood();updateEffects();updateLabels();uiState();draw();message('Composition loaded.');
  }catch(error){message(`Could not load the composition: ${error.message}`);}finally{event.target.value='';uiState();}
};
function cancelRecordingPreparation(){recordGeneration++;pendingRecorder?.cancel();pendingRecorder=null;recordPreparing=false;message();}
function endRecording(){if(!recording)return;recording=false;recordSaving=true;uiState();message('Saving recording…');recorder.stop();}
$('record').onclick=async()=>{
  if(recording){endRecording();return;}
  if(recordPreparing||recordSaving||busy||!active().length||!canRecord())return;
  const shouldStart=!playing,generation=++recordGeneration;let session;
  recordPreparing=true;uiState();message('Preparing recording…');
  const reset=()=>{recorder=null;pendingRecorder=null;recordPreparing=false;recordSaving=false;recording=false;uiState();};
  try{
    await audio.init();await playbackClock.prepare(audio.ctx,audio.master);if(generation!==recordGeneration)return;
    session=new MixRecorder(audio.ctx,audio.master,{
      format:$('record-format').value,
      onComplete:({blob,extension})=>{
        if(generation!==recordGeneration)return;reset();
        download(blob,`filigrana-${new Date().toISOString().slice(0,19).replaceAll(':','-')}.${extension}`);message('Recording saved.');
      },
      onError:error=>{if(generation!==recordGeneration)return;reset();message(`Could not save recording: ${error.message}`);},
      onLimit:()=>{recording=false;recordSaving=true;uiState();message('Saving recording…');}
    });
    pendingRecorder=session;await session.start();
    if(generation!==recordGeneration||busy||!active().length||(!shouldStart&&!playing)){session.cancel();if(generation===recordGeneration)reset();return;}
    pendingRecorder=null;recorder=session;recordPreparing=false;recording=true;
    // Capture is connected before the first new note and the musical clock start.
    if(shouldStart)startPlayback();else uiState();message('Recording…');
  }catch(error){
    session?.cancel();if(generation===recordGeneration){if(shouldStart&&playing)stop();reset();message(`Could not start recording: ${error.message}`);}
  }
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){draw();musicDirty=false;}});
mountTravellers();refreshPalette();applyPreset('floating');updateLabels();uiState();requestAnimationFrame(frame);
