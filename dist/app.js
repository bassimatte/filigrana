import {ThreadLights,drawThreads} from './luminous-threads.js?v=19';
import {drawAmbient} from './ambient-views.js?v=3';
import {DrawingView} from './drawing-view.js?v=12';
import {PlaybackClock} from './playback-clock.js?v=9';
import {MixRecorder,canRecord} from './recorder.js?v=7';
import {PRESETS,matchingPreset} from './presets.js?v=7';
import {inkMask,thin,graphFromSkeleton,resonance,chooseEdge,pointOnEdge} from './geometry.js';
import {Resonator} from './audio.js?v=7';
import {bellPitch,bellDecay,curvature,noteName,tunePitch,SCALES} from './music.js';
import {Traveller,defaultStarts} from './traveller.js?v=3';
import {INSTRUMENTS,instrument,isNoteVoice} from './instruments.js?v=7';
import {Conversation,pieceEnvelope} from './performance.js?v=2';
import {CONTROL_LIMITS,numericSeed,validateComposition} from './composition.js?v=12';
const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;
const $=id=>document.getElementById(id),canvas=$('drawing'),ctx=canvas.getContext('2d'),scope=$('scope'),sx=scope.getContext('2d');
const audio=new Resonator(),travellers=Array.from({length:3},(_,i)=>new Traveller(i));
let image=null,graph=null,selected=0,playing=false,recording=false,busy=false,visualMode='threads',totalTime=0,loadId=0,pathVector=null,previewGraph=null,previewPath=null,previewTimer=null,previewId=0,finished=false,lastSpeaker=null,pathFeedback='';
const view=new DrawingView(),threadLights=new ThreadLights();
const STARTER_IMAGES=[
  {name:'RP-F-2002-21-4-24.webp',sensitivity:70},
  {name:'aloe_spirale.jpg',sensitivity:80},
  {name:'adiantum_pedatum_2006.133.34.55.jpg',sensitivity:70},
  {name:'IMG_1790 2.JPG',sensitivity:55},
  {name:'IMG_1791 2.JPG',sensitivity:55},
  {name:'cacdoha_000082_access.webp',sensitivity:80},
  {name:'jazz sax.jpeg',sensitivity:80}
];
const visualNow=()=>performance.now()/1000;
let lastThreadMotion=0,hoverVoice=null;
let drawingWidth=1,drawingHeight=1,panDrag=null;
const visualModes=['threads','trace','afterimage','halos','waves','dew','mist'];
try{
  const adopted=localStorage.getItem('filigrana-threads-default')==='1',saved=localStorage.getItem('filigrana-visual-mode');
  if(adopted&&visualModes.includes(saved))visualMode=saved;
  else{localStorage.setItem('filigrana-visual-mode','threads');localStorage.setItem('filigrana-threads-default','1');}
}catch{}
$('visual-mode').value=visualMode;
function applyVisualMode(){ hoverVoice=null;$('canvas-wrap').classList.toggle('luminous',visualMode==='threads');document.documentElement.classList.toggle('luminous-mode',visualMode==='threads');paintPaths();draw(); }
applyVisualMode();
$('visual-mode').onchange=()=>{visualMode=$('visual-mode').value;try{localStorage.setItem('filigrana-visual-mode',visualMode);}catch{}applyVisualMode();};
let recorder=null,pendingRecorder=null,recordPreparing=false,recordSaving=false,recordGeneration=0,recordingStartedAt=0,recordingElapsed=0;
let videoRecorder=null,videoStream=null,videoCanvasStream=null,videoDestination=null,videoPreparing=false,videoRecording=false,videoSaving=false,videoGeneration=0,videoStartedAt=0,videoElapsed=0;
try{const saved=localStorage.getItem('filigrana-recording-format');if(['mp3','wav'].includes(saved))$('record-format').value=saved;}catch{}
function recordingInfo(){
  const rate=(Math.min($('record-format').value==='mp3'?48000:192000,audio.ctx?.sampleRate||48000)/1000).toLocaleString('en-US',{maximumFractionDigits:1});
  $('record-format-info').textContent=canRecord()?`${$('record-format').value==='wav'?'24-bit': '320 kbps'} · ${rate} kHz · stereo`:'Recording is unavailable in this browser.';
  $('record-format').disabled=recordPreparing||recordSaving||recording||videoPreparing||videoRecording||videoSaving;
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
  pathVector=pathForGraph(graph);
}
function pathForGraph(source){const path=new Path2D();for(const e of source.edges)e.points.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));return path;}
function extractGraph(sensitivity,cleanup=+$('cleanup').value){
  const source=document.createElement('canvas');source.width=drawingWidth;source.height=drawingHeight;const sourceContext=source.getContext('2d',{willReadFrequently:true});
  sourceContext.drawImage(image,0,0,drawingWidth,drawingHeight);
  const mask=thin(inkMask(sourceContext.getImageData(0,0,drawingWidth,drawingHeight).data,drawingWidth,drawingHeight,sensitivity),drawingWidth,drawingHeight);
  return graphFromSkeleton(mask,drawingWidth,drawingHeight,cleanup);
}
function clearPathPreview(){clearTimeout(previewTimer);previewTimer=null;previewId++;previewGraph=null;previewPath=null;$('analyse').textContent='Rebuild paths';$('path-preview-legend').hidden=true;}
function previewSensitivity(value){
  clearTimeout(previewTimer);const id=++previewId;previewGraph=null;previewPath=null;$('analyse').textContent='Preparing preview…';pathFeedback=`Preparing preview · sensitivity ${value} · ${$('cleanup').selectedOptions[0].textContent.toLowerCase()} cleanup`;draw();
  previewTimer=setTimeout(()=>{if(id!==previewId||!image)return;try{previewGraph=extractGraph(value,+$('cleanup').value);previewPath=pathForGraph(previewGraph);pathFeedback=previewGraph.edges.length?`Path preview · ${previewGraph.edges.length} paths · Rebuild to apply`:`Path preview · no paths found · Rebuild to apply`;$('analyse').textContent='Apply path preview';}catch(error){previewGraph=null;previewPath=null;pathFeedback=`Preview failed · ${error.message}`;$('analyse').textContent='Rebuild paths';}draw();},220);
}
function refreshPalette(){
  const styles=getComputedStyle(document.documentElement),value=key=>styles.getPropertyValue(key).trim();
  palette={paper:value('--paper'),green:value('--green')};
  for(const t of travellers)t.colour=value(`--voice-${t.id+1}`);
  paintPaths();draw();
}
document.addEventListener('filigrana-theme-change',refreshPalette);

const settings=()=>({speed:+$('speed').value/100,tuning:+$('tuning').value,volume:+$('volume').value/100,mode:$('branch').value,interaction:$('interaction').value,gap:+$('response-gap').value,duration:+$('duration').value,room:+$('room').value/100,delayTime:+$('delay-time').value/1000,delayMix:+$('delay-mix').value/100,delayFeedback:+$('delay-feedback').value/100,delayEnabled:$('delay-enabled').checked});
function updateEffects(){const s=settings();audio.setRoom(s.room);audio.setDelay(s.delayTime,s.delayMix,s.delayFeedback,s.delayEnabled);}
const active=()=>travellers.filter(t=>t.enabled&&t.walker);
function message(text=''){$('message').textContent=text;$('message').hidden=!text;}
function pitch(t,edge){const s=settings();return isNoteVoice(t.instrument)?bellPitch(edge.length,graph,s.tuning,t.scale,t.octave):tunePitch(resonance(edge,graph,s.tuning),s.tuning,t.scale,t.octave,28,96);}
function pathBend(edge,t){const distance=t.walker?.reverse?edge.length-t.walker.distance:t.walker?.distance||0;return Math.min(1,Math.sqrt(curvature(edge,distance))*1.25);}
function pathRing(t,edge){const relative=edge.length/Math.max(1,Math.hypot(graph.w,graph.h)),factor=.72+.56*Math.sqrt(Math.max(.1,Math.min(2,relative/.12)));return Math.max(3,Math.min(65,(bellDecay(t.ring)*factor-3)*6.5));}
function perform(t,note){
  const s=settings();if(!t.enabled||!t.walker)return;
  if(s.interaction==='conversation'&&lastSpeaker!==null&&lastSpeaker!==t.id&&!isNoteVoice(travellers[lastSpeaker].instrument))audio.silenceChannel(lastSpeaker);
  audio.setTraveller(t.id,t.volume,t.pan);
  if(note.type==='note'){
    if(!audio.strike(note.hz,note.ring??t.ring,0,note.bend,t.id,t.instrument))return;
    t.strikes++;
  }else{audio.tune(note.hz,Math.min(65,t.ring*(.8+pathBend(graph.edges[t.walker.edge],t)*.45)),t.id);audio.exciteEdge(t.instrument,note.duration,t.id);}
  t.heardPitch=note.hz;t.pulse=1;lastSpeaker=t.id;pulseVoice(t.id);
  if(visualMode!=='trace')threadLights.emit(graph,t.id,t.walker.edge,t.walker.from,t.walker.distance,visualNow());
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
    if(hz===null)return;note={type:'note',hz,bend:pathBend(e,t),ring:pathRing(t,e)};
  }else{
    note={type:'resonance',hz:pitch(t,e),duration:(e.length-t.walker.distance)/(t.speed*s.speed*pieceEnvelope(totalTime,s.duration).pace)};
  }
  if(s.interaction==='conversation')conversation.offer(t.id,note);else perform(t,note);
}
function uiState(){
  $('play-label').textContent=playing?'Pause':recordPreparing||videoPreparing?'Cancel':finished?'Listen again':'Listen';$('play-icon').innerHTML=icon(playing?'pause':recordPreparing||videoPreparing?'close':'play');
  $('state').textContent=busy?'ANALYSING':!image?'UPLOAD DRAWING':playing?`${active().length} TRAVELLING`:finished?'FINISHED':graph?.edges.length?'READY':'NO PATHS';
  $('play').disabled=busy||!active().length||videoPreparing&&!playing;$('reset').disabled=busy||videoPreparing||!travellers.some(t=>t.origin);$('reset').hidden=recording||recordSaving||videoRecording||videoSaving;$('record').disabled=recordPreparing||recordSaving||videoPreparing||videoRecording||videoSaving||busy||!active().length||!canRecord();
  $('record-label').textContent=recordPreparing?'Preparing…':recordSaving?'Saving…':recording?'Save recording':'Record';$('record-icon').innerHTML=icon(recordPreparing||recordSaving?'loader':recording?'stop':'record');$('record').setAttribute('aria-pressed',String(recording));$('record').setAttribute('aria-busy',String(recordPreparing||recordSaving));$('record-indicator').hidden=!(recording||videoRecording);$('recording-monitor').hidden=!(recording||recordSaving||videoRecording||videoSaving);recordingInfo();$('record').classList.toggle('recording',recording);$('record').classList.toggle('busy',recordPreparing||recordSaving);
  $('record-video').disabled=recordPreparing||recording||recordSaving||videoSaving||busy||!active().length||!canRecordVideo();$('video-record-label').textContent=videoPreparing?'Cancel video':videoRecording?'Stop':videoSaving?'Saving…':'Video';$('record-video').setAttribute('aria-label',videoPreparing?'Cancel video preparation':videoRecording?'Stop video recording':videoSaving?'Saving video':'Record video');$('record-video').title=canRecordVideo()?'Record the animated drawing with its sound':'Video recording is not supported in this browser';$('record-video').setAttribute('aria-pressed',String(videoRecording));$('record-video').setAttribute('aria-busy',String(videoPreparing||videoSaving));$('record-video').classList.toggle('recording',videoRecording);$('record-video').classList.toggle('busy',videoPreparing||videoSaving);
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
function stop(){playbackClock.stop();playing=false;audio.silence();conversation.reset();lastSpeaker=null;if(recordPreparing)cancelRecordingPreparation();else if(recording)endRecording();if(videoPreparing)cancelVideoPreparation();else if(videoRecording)endVideoRecording();uiState();}
function place(t,edgeId,from,distance=0){threadLights.clear(t.id);audio.silenceChannel(t.id);conversation.remove(t.id);t.place(edgeId,from,distance);soundEdge(t);uiState();draw();}
function paintRange(input){const min=+(input.getAttribute('min')||0),max=+(input.getAttribute('max')||100),value=+input.value;input.style.setProperty('--range-progress',`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`);}
function refreshRanges(){document.querySelectorAll('input[type=range]').forEach(paintRange);}
function syncScaleControl(){const scale=travellers[0]?.scale;$('global-scale').value=travellers.every(t=>t.scale===scale)?scale:'mixed';}
function syncTraveller(t){
  for(const key of ['instrument','octave','scale'])$(`${key}-${t.id}`).value=t[key];$(`enabled-${t.id}`).checked=t.enabled;
  const ringLabel=isNoteVoice(t.instrument)?'Decay':'Ring';$(`expression-ring-label-${t.id}`).textContent=ringLabel;
  const ringValue=isNoteVoice(t.instrument)?`${Math.min(22,bellDecay(t.ring)*(instrument(t.instrument).tail||1)).toFixed(1)} s`:String(t.ring);
  for(const [key,value,unit]of [['speed',t.speed,' px/s'],['spacing',t.spacing,' s'],['volume',Math.round(t.volume*100),'%'],['ring',t.ring,ringValue],['pan',Math.round(t.pan*100),'']]){
    $(`expression-${key}-${t.id}`).value=value;paintRange($(`expression-${key}-${t.id}`));$(`expression-${key}-value-${t.id}`).textContent=key==='pan'?(value===0?'Center':`${Math.abs(value)}% ${value<0?'L':'R'}`):key==='ring'?unit:value+unit;
  }
  syncScaleControl();
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
      <details class="traveller-expression" open><summary>Expression <span>${icon('plus')}</span></summary>${[['speed','Speed',10,240,1],['spacing','Note spacing',.8,12,.1],['volume','Volume',0,100,1],['ring','Decay',3,65,1],['pan','Stereo',-100,100,1]].map(([key,label,min,max,step])=>`<label for="expression-${key}-${t.id}"><span${key==='ring'?` id="expression-ring-label-${t.id}"`:''}>${label}</span><output id="expression-${key}-value-${t.id}"></output></label><input id="expression-${key}-${t.id}" aria-label="${label} for voice ${t.id+1}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}</details>`;
    $('travellers').append(card);
    const chip=document.createElement('div');chip.className='voice-chip';chip.style.setProperty('--traveller',`var(--voice-${t.id+1})`);
    chip.innerHTML=`<button type="button" class="voice-button" id="voice-${t.id}" aria-expanded="false" aria-controls="traveller-${t.id}" aria-label="Voice ${t.id+1} settings"><span class="voice-number" aria-hidden="true"><i class="voice-light" id="voice-light-${t.id}"></i></span><span class="voice-copy"><strong>Voice ${t.id+1}</strong><span id="voice-name-${t.id}"></span></span></button><button type="button" class="voice-mute" id="mute-${t.id}" aria-pressed="false" aria-label="Mute voice ${t.id+1}">On</button>`;
    $('voice-bar').append(chip);
    $(`voice-${t.id}`).onclick=()=>selectVoice(t.id,true);
    $(`mute-${t.id}`).onclick=()=>{$(`enabled-${t.id}`).checked=!t.enabled;$(`enabled-${t.id}`).onchange();};
    syncTraveller(t);
    for(const key of ['speed','spacing','volume','ring','pan'])$(`expression-${key}-${t.id}`).oninput=()=>{
      const value=+$(`expression-${key}-${t.id}`).value;t[key]=['pan','volume'].includes(key)?value/100:value;
      if(key==='spacing'){t.phrasing.next=totalTime+t.spacing*(instrument(t.instrument).spacing||1);conversation.remove(t.id);}
      if(key==='ring'&&playing&&t.enabled&&t.walker&&!isNoteVoice(t.instrument))audio.tune(pitch(t,graph.edges[t.walker.edge]),t.ring,t.id);
      audio.setTraveller(t.id,t.volume,t.pan);syncTraveller(t);
    };
    $(`place-${t.id}`).onclick=()=>{selected=t.id;openVoice=null;uiState();updateLabels();draw();canvas.focus();message('Click a line to set this voice’s start.');};
    $(`instrument-${t.id}`).onchange=()=>{
      audio.silenceChannel(t.id);conversation.remove(t.id);t.instrument=$(`instrument-${t.id}`).value;t.phrasing.reset();t.heardPitch=null;syncTraveller(t);updateLabels();soundEdge(t);voiceOverview();draw();
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
      if(kind==='scale')syncScaleControl();
      if(playing&&t.enabled&&t.walker&&!isNoteVoice(t.instrument)){const hz=pitch(t,graph.edges[t.walker.edge]);audio.tune(hz,t.ring,t.id);t.heardPitch=hz;}
      draw();message();
    };
  }
}
$('global-scale').onchange=()=>{
  const scale=$('global-scale').value;if(!Object.hasOwn(SCALES,scale))return;
  for(const t of travellers){t.scale=scale;$(`scale-${t.id}`).value=scale;conversation.remove(t.id);if(playing&&t.enabled&&t.walker&&!isNoteVoice(t.instrument)){const hz=pitch(t,graph.edges[t.walker.edge]);audio.tune(hz,t.ring,t.id);t.heardPitch=hz;}}
  syncScaleControl();customMood();draw();message();
};
async function loadImage(src,name,sensitivity=null){
  const id=++loadId;stop();clearPathPreview();pathFeedback='';$('suggest-sensitivity').hidden=true;busy=true;uiState();message('Reading the image…');
  try{
    if(Number.isFinite(sensitivity)){$('sensitivity').value=sensitivity;$('sensitivity-value').textContent=String(sensitivity);paintRange($('sensitivity'));}
    const img=new Image();img.src=src;await img.decode();if(id!==loadId)return;image=img;
    const scale=Math.min(1,960/Math.max(img.width,img.height));drawingWidth=Math.round(img.width*scale);drawingHeight=Math.round(img.height*scale);view.setDrawing(drawingWidth,drawingHeight);updateZoomControls();
    $('image-name').textContent=name;await analyse();
  }catch(e){busy=false;message(`Could not read this image. Try a JPEG or PNG. ${e.message}`);uiState();}
}
function loadStarterImage(){
  const starter=STARTER_IMAGES[Math.floor(Math.random()*STARTER_IMAGES.length)];
  loadImage(new URL(`./images/${encodeURIComponent(starter.name)}`,import.meta.url).href,starter.name,starter.sensitivity);
}
async function analyse(){
  if(!image)return;clearPathPreview();stop();threadLights.clear();pathFeedback='';$('suggest-sensitivity').hidden=true;busy=true;uiState();message('Finding ink, thinning lines, and measuring the paths…');
  await new Promise(r=>setTimeout(r,35));
  try{
    graph=extractGraph(+$('sensitivity').value,+$('cleanup').value);totalTime=0;finished=false;for(const t of travellers){t.seed=$('seed').value;t.setGraph(graph);}
    paintPaths();
    $('junction-count').textContent=`${graph.junctions.length} junctions`;
    if(graph.edges.length){
      const totalPathLength=graph.edges.reduce((sum,edge)=>sum+edge.length,0),density=totalPathLength/(drawingWidth*drawingHeight),sensitivity=+$('sensitivity').value;
      let suggestion=null;
      if(graph.edges.length<8||density<.0008)suggestion=Math.min(95,sensitivity+15);
      else if(graph.edges.length>1200||density>.18)suggestion=Math.max(10,sensitivity-10);
      $('suggest-sensitivity').hidden=suggestion===null||suggestion===sensitivity;
      if(!$('suggest-sensitivity').hidden){$('suggest-sensitivity').dataset.value=String(suggestion);$('suggest-sensitivity').textContent=`Try sensitivity ${suggestion}`;}
      pathFeedback=`${graph.edges.length} paths · ${graph.junctions.length} crossings${suggestion!==null&&suggestion!==sensitivity?` · Try ${suggestion}`:''}`;
      defaultStarts(graph).forEach((start,i)=>travellers[i].place(start.edgeId,start.from,start.distance));
      message();
    }else{
      const suggestion=Math.min(95,+$('sensitivity').value+15);pathFeedback=suggestion>+$('sensitivity').value?`No paths found · Try sensitivity ${suggestion}`:'No paths found · adjust sensitivity';
      if(suggestion>+$('sensitivity').value){$('suggest-sensitivity').dataset.value=String(suggestion);$('suggest-sensitivity').textContent=`Try sensitivity ${suggestion}`;$('suggest-sensitivity').hidden=false;}
      message('No usable lines found. Increase ink sensitivity, or try a clearer drawing on plain paper.');$('canvas-note').textContent='No paths detected';$('frequency').textContent='—';$('edge-length').textContent='Try another sensitivity';
    }
  }catch(e){graph=null;pathVector=null;pathFeedback='Path analysis failed';for(const t of travellers)t.setGraph(null);message(`Could not extract paths: ${e.message}`);}
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
  if(visualMode!=='threads'||videoPreparing||videoRecording){ctx.fillStyle=palette.paper;ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.save();ctx.setTransform(ratio*view.scale,0,0,ratio*view.scale,ratio*view.x,ratio*view.y);
  $('path-preview-legend').hidden=!previewGraph;
  if(previewGraph){
    ctx.drawImage(image,0,0,drawingWidth,drawingHeight);
    if(pathVector){ctx.globalAlpha=.34;ctx.strokeStyle=palette.green;ctx.lineWidth=1.1;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(pathVector);}
    if(previewPath){ctx.globalAlpha=.94;ctx.strokeStyle=document.documentElement.dataset.theme==='dark'?'#a6e6c4':'#087c68';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(previewPath);}
    ctx.globalAlpha=1;
    ctx.fillStyle=document.documentElement.dataset.theme==='dark'?'#a6e6c4':'#087c68';for(const n of previewGraph.junctions){ctx.beginPath();ctx.arc(n.x,n.y,2.5,0,Math.PI*2);ctx.fill();}
  }else if(visualMode==='threads'){
    drawThreads(ctx,{graph,path:pathVector,travellers,scale:view.scale,now:visualNow(),pulses:threadLights.live(visualNow()),lastMotion:lastThreadMotion,playing,hover:hoverVoice,drag,palette,dark:document.documentElement.dataset.theme==='dark',reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches});
  }else if(visualMode==='trace'){
    ctx.globalAlpha=.58;ctx.drawImage(image,0,0,drawingWidth,drawingHeight);ctx.globalAlpha=1;
    if(pathVector){ctx.globalAlpha=document.documentElement.dataset.theme==='dark'?.4:.52;ctx.strokeStyle=palette.green;ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(pathVector);ctx.globalAlpha=1;}
    if(graph){ctx.fillStyle=palette.green;ctx.globalAlpha=document.documentElement.dataset.theme==='dark'?.44:.55;for(const n of graph.junctions){ctx.beginPath();ctx.arc(n.x,n.y,2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
    if(!graph){ctx.restore();return;}
    for(const t of travellers){
      if(!t.walker){$(`traveller-note-${t.id}`).textContent='No path';continue;}
      const e=graph.edges[t.walker.edge],colour=photoColours[t.id],p=drag?.id===t.id?drag.position:t.position();ctx.globalAlpha=(t.enabled?1:.25)*.36;
      ctx.strokeStyle=colour;ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();e.points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();
      if(t.enabled)for(let i=0;i<t.trail.length;i+=2){ctx.globalAlpha=(i/t.trail.length)*.24;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(t.trail[i].x,t.trail[i].y,1.5,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=t.enabled?.09:.04;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(p.x,p.y,10+t.pulse*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=t.enabled?1:.35;
      ctx.strokeStyle=palette.paper;ctx.fillStyle=colour;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillStyle=colour;ctx.fillText(String(t.id+1),p.x,p.y-12);ctx.globalAlpha=1;
    }
  }else{
    drawAmbient(ctx,{mode:visualMode,graph,path:pathVector,travellers,scale:view.scale,now:visualNow(),pulses:threadLights.live(visualNow()),lastMotion:lastThreadMotion,playing,hover:hoverVoice,drag,palette,dark:document.documentElement.dataset.theme==='dark',reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches});
  }
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  for(const pulse of threadLights.live(visualNow()))if(pulse.kind==='junction'){
    const age=Math.max(0,visualNow()-pulse.time),fade=reducedMotion?.32:Math.exp(-age*.72)*.58,colour=travellers[pulse.voice]?.colour||palette.green,radius=(reducedMotion?15:7+age*36)/view.scale;
    ctx.globalAlpha=fade;ctx.strokeStyle=colour;ctx.lineWidth=(reducedMotion?1:1.25)/view.scale;ctx.beginPath();ctx.arc(pulse.position.x,pulse.position.y,radius,0,Math.PI*2);ctx.stroke();
    if(!reducedMotion){ctx.globalAlpha=fade*.55;ctx.beginPath();ctx.arc(pulse.position.x,pulse.position.y,Math.max(2,radius-8/view.scale),0,Math.PI*2);ctx.stroke();}
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
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
  for(const t of travellers){t.advance(dt,t.speed*s.speed*form.pace,s.mode,(voice,transition)=>{if(graph.nodes[transition.nodeId]?.edges.length>=3)threadLights.emitJunction(graph,voice.id,transition.nodeId,visualNow());soundEdge(voice);});if(t.enabled&&t.walker&&isNoteVoice(t.instrument)){const e=graph.edges[t.walker.edge];audio.colour(pathBend(e,t),t.id);}}
  if(form.acceptNotes)answer();else conversation.pending.clear();
  if(!active().length)stop();
}
function frame(){
  if(!document.hidden&&(playing||musicDirty||threadLights.live(visualNow()).length||visualNow()<lastThreadMotion+4)){draw();musicDirty=false;}
  const s=settings(),form=pieceEnvelope(totalTime,s.duration),status=finished?'Finished.':playing&&!form.acceptNotes?'Last notes…':playing&&!(previewGraph||previewTimer)?'':pathFeedback;
  if($('performance-status').textContent!==status)$('performance-status').textContent=status;
  $('performance-status').hidden=!status;
  $('elapsed').textContent=`${String(Math.floor(totalTime/60)).padStart(2,'0')}:${String(Math.floor(totalTime%60)).padStart(2,'0')}`;
  sx.clearRect(0,0,scope.width,scope.height);sx.strokeStyle=palette.green;sx.lineWidth=1.5;sx.beginPath();
  if(audio.analyser&&playing){const data=new Uint8Array(audio.analyser.fftSize);audio.analyser.getByteTimeDomainData(data);for(let i=0;i<data.length;i++){const x=i/(data.length-1)*scope.width,y=scope.height/2+(data[i]-128)/128*scope.height*.46;i?sx.lineTo(x,y):sx.moveTo(x,y);}}
  else{sx.moveTo(0,scope.height/2);sx.lineTo(scope.width,scope.height/2);}sx.stroke();requestAnimationFrame(frame);
  if(recording||recordSaving||videoRecording||videoSaving)drawRecordingMonitor();
}
function drawRecordingMonitor(){
  const canvas=$('recording-waveform'),context=canvas.getContext('2d'),width=canvas.width,height=canvas.height;context.clearRect(0,0,width,height);context.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#a94c2c';context.lineWidth=1.5;context.beginPath();
  const activeCapture=recording||videoRecording,data=new Uint8Array(audio.analyser?.fftSize||128);if(activeCapture&&audio.analyser)audio.analyser.getByteTimeDomainData(data);else data.fill(128);
  for(let i=0;i<data.length;i++){const x=i/(data.length-1)*width,y=height/2+(data[i]-128)/128*height*.42;i?context.lineTo(x,y):context.moveTo(x,y);}context.stroke();
  const elapsed=recording?recordingElapsed+(performance.now()-recordingStartedAt)/1000:videoRecording?videoElapsed+(performance.now()-videoStartedAt)/1000:recordSaving?recordingElapsed:videoElapsed,total=Math.floor(elapsed),minutes=String(Math.floor(total/60)).padStart(2,'0'),seconds=String(total%60).padStart(2,'0');$('recording-elapsed').textContent=`${minutes}:${seconds}`;
}
function startPlayback(){
  if(finished)restart();playing=true;playbackClock.start();const s=settings();conversation.reset();lastSpeaker=null;
  audio.setActiveCount(active().length);audio.setVolume(s.volume*pieceEnvelope(totalTime,s.duration).gain);
  for(const t of active()){audio.setTraveller(t.id,t.volume,t.pan);t.phrasing.reset();soundEdge(t);}answer();uiState();
}
$('play').onclick=async()=>{
  if(playing){stop();return;}
  if(recordPreparing){cancelRecordingPreparation();uiState();return;}
  if(videoPreparing){cancelVideoPreparation();uiState();return;}
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
  const s=settings();$('tuning-value').textContent=`${noteName(s.tuning)} · ${s.tuning} Hz`;
  for(const id of ['delay-time','delay-mix','delay-feedback'])$(id).disabled=!s.delayEnabled;
  $('response-gap').disabled=s.interaction!=='conversation';
}
for(const [id,unit] of [['speed','%'],['tuning',' Hz'],['volume','%'],['sensitivity',''],['response-gap',' s'],['room','%'],['delay-time',' ms'],['delay-mix','%'],['delay-feedback','%']])$(id).oninput=()=>{
  $(`${id}-value`).textContent=$(id).value+unit;const s=settings();updateLabels();updateEffects();if(playing)audio.setVolume(s.volume);
  if(id==='sensitivity'){$('suggest-sensitivity').hidden=true;previewSensitivity(+$('sensitivity').value);}
  if(id==='tuning'&&graph){for(const t of active())if(!isNoteVoice(t.instrument)){const hz=pitch(t,graph.edges[t.walker.edge]);audio.tune(hz,t.ring,t.id);t.heardPitch=playing?hz:null;}draw();}
};
$('delay-enabled').onchange=()=>{updateLabels();updateEffects();};
$('interaction').onchange=()=>{audio.silence();conversation.reset();lastSpeaker=null;updateLabels();if(playing){audio.setVolume(settings().volume*pieceEnvelope(totalTime,settings().duration).gain);for(const t of active()){t.phrasing.reset();soundEdge(t);}answer();}};
$('seed').onchange=()=>{const value=Number($('seed').value);$('seed').value=String(Number.isFinite(value)?Math.max(0,Math.min(2147483647,Math.round(value))):1);message('The new journey seed will apply when you press Restart.');};
function applyPreset(key){
  const mood=PRESETS[key];audio.silence();conversation.reset();lastSpeaker=null;
  for(const t of travellers){t.instrument=mood.keys[t.id];t.octave=mood.octaves[t.id];t.speed=mood.speeds[t.id];t.spacing=mood.spacing[t.id];t.volume=mood.volumes[t.id];t.ring=mood.ring;t.pan=(t.id-1)*.4;t.scale=mood.scale||'pentatonic';t.phrasing.reset();t.heardPitch=null;syncTraveller(t);audio.setTraveller(t.id,t.volume,t.pan);}
  for(const [id,value,unit]of [['room',mood.room,'%'],['speed',mood.pace,'%'],['response-gap',mood.gap,' s']]){$(id).value=value;$(`${id}-value`).textContent=value+unit;}
  $('preset').value=key;
  updateEffects();updateLabels();voiceOverview();
  if(playing){audio.setVolume(settings().volume*pieceEnvelope(totalTime,settings().duration).gain);for(const t of active())soundEdge(t);answer();}draw();
}
function customMood(){$('preset').value=matchingPreset(travellers,{room:+$('room').value,pace:+$('speed').value,gap:+$('response-gap').value});}
$('preset').innerHTML=Object.entries(PRESETS).map(([key,p])=>`<option value="${key}">${key==='still'?'Still · calm trio':p.name}</option>`).join('')+'<option value="custom" disabled>Custom</option>';
$('preset').onchange=()=>{if(Object.hasOwn(PRESETS,$('preset').value)){applyPreset($('preset').value);message();}};
$('load-score-trigger').onclick=()=>$('load-score').click();
document.querySelectorAll('.control-group').forEach(group=>group.addEventListener('toggle',()=>{
  if(group.open)document.querySelectorAll('.control-group[open]').forEach(other=>{if(other!==group)other.open=false;});
}));
document.addEventListener('input',event=>{if(event.target.id!=='preset'&&event.target.matches('input[type=range],select'))customMood();});
document.addEventListener('change',event=>{if(event.target.id!=='preset'&&event.target.matches('select,#delay-enabled'))customMood();});
$('analyse').onclick=analyse;
$('suggest-sensitivity').onclick=()=>{const value=Number($('suggest-sensitivity').dataset.value);if(!Number.isFinite(value))return;$('sensitivity').value=String(value);$('sensitivity-value').textContent=String(value);paintRange($('sensitivity'));analyse();};
$('cleanup').onchange=()=>previewSensitivity(+$('sensitivity').value);
const drawingSettings=$('drawing-settings');
document.addEventListener('click',event=>{if(drawingSettings.open&&!drawingSettings.contains(event.target))drawingSettings.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawingSettings.open){drawingSettings.open=false;drawingSettings.querySelector('summary').focus();}});
async function asDataURL(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type||'image/jpeg'};base64,${btoa(binary)}`;
}
async function compositionSnapshot(){
  const drawingBlob=await(await fetch(image.src)).blob(),src=image.src.startsWith('data:')?image.src:await asDataURL(drawingBlob),controls={};
  for(const key of Object.keys(CONTROL_LIMITS))if(key!=='q')controls[key]=+$(key).value;
  Object.assign(controls,{branch:$('branch').value,interaction:$('interaction').value,duration:+$('duration').value,seed:$('seed').value,'delay-enabled':$('delay-enabled').checked});
  const score={format:'line-resonator',version:1,image:{src,name:$('image-name').textContent},controls,graph:{w:graph.w,h:graph.h,edges:graph.edges.length},travellers:travellers.map(t=>{
    const {instrument,scale,enabled,octave,speed,spacing,volume,ring,pan}=t,e=graph.edges[t.origin.edgeId],reverse=e.b===t.origin.from&&e.a!==t.origin.from,p=pointOnEdge(e,reverse?e.length-t.origin.distance:t.origin.distance);
    return {instrument,scale,enabled,octave,speed,spacing,volume,ring,pan,origin:{...t.origin,x:p.x/graph.w,y:p.y/graph.h}};
  })};
  validateComposition(score);return {score,drawingBlob};
}
function drawingFilename(blob){let name=$('image-name').textContent.split(/[\\/]/).pop().replace(/[<>:\"|?*]/g,'-')||'filigrana-drawing';if(!/\.[a-z0-9]{2,5}$/i.test(name))name+=blob.type==='image/png'?'.png':blob.type==='image/webp'?'.webp':'.jpg';return name;}
document.querySelector('label[for=upload]').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('upload').click();}};
$('upload').onchange=async event=>{const file=event.target.files[0];if(!file)return;await loadImage(await asDataURL(file),file.name,55);event.target.value='';};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('save-score').onclick=async()=>{
  if(!image||!graph?.edges.length||busy)return;$('save-score').disabled=true;
  try{
    const {score,drawingBlob}=await compositionSnapshot();download(new Blob([JSON.stringify(score)],{type:'application/json'}),'filigrana.line-score.json');
    download(drawingBlob,drawingFilename(drawingBlob));message('Composition and image saved.');
  }catch(error){message(`Could not save the composition: ${error.message}`);}finally{uiState();}
};
$('load-score').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>36e6)throw new Error('Choose a composition smaller than 36 MB.');
    const score=validateComposition(JSON.parse(await file.text()));stop();
    for(const [key,value]of Object.entries(score.controls)){if(key==='delay-enabled')$(key).checked=value;else if(key==='seed')$(key).value=String(numericSeed(value));else if(key!=='q')$(key).value=value;}
    const units={speed:'%',tuning:' Hz',volume:'%',sensitivity:'',room:'%','delay-time':' ms','delay-feedback':'%','delay-mix':'%','response-gap':' s'};
    for(const [key,unit]of Object.entries(units))$(`${key}-value`).textContent=$(key).value+unit;
    for(const t of travellers){const {origin,...expression}=score.travellers[t.id];Object.assign(t,expression);t.seed=String(numericSeed(score.controls.seed));syncTraveller(t);}
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
function endRecording(){if(!recording)return;recordingElapsed+=(performance.now()-recordingStartedAt)/1000;recordingStartedAt=0;recording=false;recordSaving=true;uiState();message('Saving recording…');recorder.stop();}
function canRecordVideo(){return typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function'&&typeof MediaStream!=='undefined';}
function releaseVideoCapture(){
  if(videoDestination&&audio.master)try{audio.master.disconnect(videoDestination);}catch{}
  for(const track of videoStream?.getTracks()||[])track.stop();for(const track of videoCanvasStream?.getTracks()||[])track.stop();
  videoStream=null;videoCanvasStream=null;videoDestination=null;
}
function cancelVideoPreparation(){videoGeneration++;clearTimeout(videoLimitTimer);videoPreparing=false;videoElapsed=0;releaseVideoCapture();uiState();draw();message();}
function endVideoRecording(){
  if(!videoRecording)return;videoElapsed+=(performance.now()-videoStartedAt)/1000;videoStartedAt=0;videoRecording=false;videoSaving=true;clearTimeout(videoLimitTimer);uiState();message('Saving video…');
  if(videoRecorder?.state==='recording')videoRecorder.stop();
}
let videoLimitTimer=null;
$('record').onclick=async()=>{
  if(recording){endRecording();return;}
  if(recordPreparing||recordSaving||busy||!active().length||!canRecord())return;
  const shouldStart=!playing,generation=++recordGeneration;let session;
  recordPreparing=true;uiState();message('Preparing recording…');
  let composition;
  const reset=()=>{recorder=null;pendingRecorder=null;recordPreparing=false;recordSaving=false;recording=false;recordingStartedAt=0;recordingElapsed=0;uiState();};
  try{
    composition=await compositionSnapshot();if(generation!==recordGeneration)return;
    await audio.init();await playbackClock.prepare(audio.ctx,audio.master);if(generation!==recordGeneration)return;
    session=new MixRecorder(audio.ctx,audio.master,{
      format:$('record-format').value,
      onComplete:async({blob,extension})=>{
        if(generation!==recordGeneration)return;recording=false;recordSaving=true;uiState();
        const base=`filigrana-${new Date().toISOString().slice(0,19).replaceAll(':','-')}`;download(blob,`${base}.${extension}`);
        try{download(new Blob([JSON.stringify(composition.score)],{type:'application/json'}),`${base}.line-score.json`);reset();message('Recording and composition saved. The sidecar includes its drawing.');}
        catch(error){reset();message(`Recording saved, but its composition sidecar could not be saved: ${error.message}`);}
      },
      onError:error=>{if(generation!==recordGeneration)return;reset();message(`Could not save recording: ${error.message}`);},
      onLimit:()=>{recordingElapsed+=(performance.now()-recordingStartedAt)/1000;recordingStartedAt=0;recording=false;recordSaving=true;uiState();message('Saving recording…');}
    });
    pendingRecorder=session;await session.start();
    if(generation!==recordGeneration||busy||!active().length||(!shouldStart&&!playing)){session.cancel();if(generation===recordGeneration)reset();return;}
    pendingRecorder=null;recorder=session;recordPreparing=false;recording=true;
    recordingStartedAt=performance.now();recordingElapsed=0;
    // Capture is connected before the first new note and the musical clock start.
    if(shouldStart)startPlayback();else uiState();message('Recording…');
  }catch(error){
    session?.cancel();if(generation===recordGeneration){if(shouldStart&&playing)stop();reset();message(`Could not start recording: ${error.message}`);}
  }
};
$('record-video').onclick=async()=>{
  if(videoPreparing){cancelVideoPreparation();return;}
  if(videoRecording){endVideoRecording();return;}
  if(recordPreparing||recording||recordSaving||videoSaving||busy||!active().length||!canRecordVideo())return;
  const shouldStart=!playing,generation=++videoGeneration;let composition;
  videoPreparing=true;videoElapsed=0;uiState();message('Preparing video…');
  try{
    composition=await compositionSnapshot();if(generation!==videoGeneration)return;
    await audio.init();await playbackClock.prepare(audio.ctx,audio.master);if(generation!==videoGeneration)return;
    draw();videoCanvasStream=canvas.captureStream(30);videoDestination=audio.ctx.createMediaStreamDestination();audio.master.connect(videoDestination);
    videoStream=new MediaStream([...videoCanvasStream.getVideoTracks(),...videoDestination.stream.getAudioTracks()]);
    const mimeType=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'].find(type=>MediaRecorder.isTypeSupported?.(type));
    const options={videoBitsPerSecond:2_500_000,audioBitsPerSecond:160_000};if(mimeType)options.mimeType=mimeType;
    const capture=new MediaRecorder(videoStream,options);videoRecorder=capture;const chunks=[];let finalized=false;
    capture.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
    capture.onerror=event=>{
      if(finalized||generation!==videoGeneration)return;finalized=true;clearTimeout(videoLimitTimer);releaseVideoCapture();videoRecorder=null;videoPreparing=false;videoRecording=false;videoSaving=false;videoStartedAt=0;videoElapsed=0;uiState();draw();message(`Could not record video: ${event.error?.message||'the browser encoder failed.'}`);
    };
    capture.onstop=()=>{
      if(finalized||generation!==videoGeneration)return;finalized=true;clearTimeout(videoLimitTimer);videoRecording=false;videoPreparing=false;videoSaving=true;videoStartedAt=0;releaseVideoCapture();uiState();
      const mime=capture.mimeType||chunks[0]?.type||'video/webm',extension=mime.toLowerCase().includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type:mime});
      try{
        if(!blob.size)throw new Error('The browser returned an empty video.');
        const base=`filigrana-${new Date().toISOString().slice(0,19).replaceAll(':','-')}`;download(blob,`${base}.${extension}`);download(new Blob([JSON.stringify(composition.score)],{type:'application/json'}),`${base}.line-score.json`);
        videoRecorder=null;videoSaving=false;videoElapsed=0;uiState();draw();message(`Video and composition saved as ${extension.toUpperCase()}. The sidecar includes its drawing.`);
      }catch(error){videoRecorder=null;videoSaving=false;videoElapsed=0;uiState();draw();message(`Could not save the video: ${error.message}`);}
    };
    capture.start(1000);videoPreparing=false;videoRecording=true;videoStartedAt=performance.now();videoElapsed=0;uiState();
    videoLimitTimer=setTimeout(()=>{if(videoRecording){message('Video reached the 10 minute limit. Saving…');endVideoRecording();}},600_000);
    if(shouldStart)startPlayback();else uiState();message('Recording video…');
  }catch(error){
    clearTimeout(videoLimitTimer);releaseVideoCapture();videoRecorder=null;
    if(generation===videoGeneration){videoPreparing=false;videoRecording=false;videoSaving=false;videoStartedAt=0;videoElapsed=0;uiState();draw();message(`Could not start video recording: ${error.message}`);}
  }
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){draw();musicDirty=false;}});
mountTravellers();refreshPalette();applyPreset('floating');updateLabels();uiState();loadStarterImage();requestAnimationFrame(frame);
