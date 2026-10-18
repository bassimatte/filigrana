import {inkMask,thin,graphFromSkeleton,resonance,chooseEdge,pointOnEdge} from './geometry.js';
import {Resonator} from './audio.js';
import {bellPitch,bellDecay,curvature,noteName,tunePitch,SCALES} from './music.js';
import {Traveller,defaultStarts} from './traveller.js';
import {INSTRUMENTS,instrument,isNoteVoice} from './instruments.js';
import {Conversation,pieceEnvelope} from './performance.js';
import {CONTROL_LIMITS,validateComposition} from './composition.js';
const $=id=>document.getElementById(id),canvas=$('drawing'),ctx=canvas.getContext('2d'),scope=$('scope'),sx=scope.getContext('2d');
const audio=new Resonator(),travellers=Array.from({length:3},(_,i)=>new Traveller(i));
let image=null,graph=null,selected=0,playing=false,recording=false,busy=false,photo=true,paths=true,lastTime=0,totalTime=0,loadId=0,maskLayer=null,downloadURL=null,finished=false,lastSpeaker=null;
const conversation=new Conversation();
let palette={paper:'#f4f1e9',green:'#527153',photoPath:'#527153'};
const photoColours=['#a94c2c','#276b86','#79518d'];
function paintPaths(){
  if(!maskLayer||!graph)return;
  const mctx=maskLayer.getContext('2d');mctx.clearRect(0,0,maskLayer.width,maskLayer.height);
  mctx.strokeStyle=photo?palette.photoPath:palette.green;mctx.lineWidth=1.1;
  for(const e of graph.edges){mctx.beginPath();e.points.forEach((p,i)=>i?mctx.lineTo(p.x,p.y):mctx.moveTo(p.x,p.y));mctx.stroke();}
}
function refreshPalette(){
  const styles=getComputedStyle(document.documentElement),value=key=>styles.getPropertyValue(key).trim();
  palette={paper:value('--paper'),green:value('--green'),photoPath:value('--photo-path')};
  for(const t of travellers)t.colour=value(`--voice-${t.id+1}`);
  paintPaths();draw();
}
document.addEventListener('filigrana-theme-change',refreshPalette);

const settings=()=>({speed:+$('speed').value/100,tuning:+$('tuning').value,q:+$('q').value,volume:+$('volume').value/100,mode:$('branch').value,interaction:$('interaction').value,gap:+$('response-gap').value,duration:+$('duration').value,room:+$('room').value/100,delayTime:+$('delay-time').value/1000,delayMix:+$('delay-mix').value/100,delayFeedback:+$('delay-feedback').value/100,delayEnabled:$('delay-enabled').checked});
function updateEffects(){const s=settings();audio.setRoom(s.room);audio.setDelay(s.delayTime,s.delayMix,s.delayFeedback,s.delayEnabled);}
const active=()=>travellers.filter(t=>t.enabled&&t.walker);
function message(text){$('message').textContent=text;}
function pitch(t,edge){const s=settings();return isNoteVoice(t.instrument)?bellPitch(edge.length,graph,s.tuning,t.scale,t.octave):tunePitch(resonance(edge,graph,s.tuning),s.tuning,t.scale,t.octave,28,96);}
function perform(t,note){
  const s=settings();if(!t.enabled||!t.walker)return;
  if(s.interaction==='conversation'&&lastSpeaker!==null&&lastSpeaker!==t.id&&!isNoteVoice(travellers[lastSpeaker].instrument))audio.silenceChannel(lastSpeaker);
  audio.setTraveller(t.id,t.volume,t.pan);
  if(note.type==='note'){
    if(!audio.strike(note.hz,s.q,0,note.bend,t.id,t.instrument))return;
    t.strikes++;
  }else{audio.tune(note.hz,s.q,t.id);audio.exciteEdge(t.instrument,note.duration,t.id);}
  t.heardPitch=note.hz;t.pulse=1;lastSpeaker=t.id;
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
  $('play-label').textContent=playing?'Pause':finished?'Listen again':'Listen';$('play-icon').textContent=playing?'Ⅱ':'▶';
  $('state').textContent=busy?'ANALYSING':playing?`${active().length} TRAVELLING`:finished?'FINISHED':graph?.edges.length?'READY':'NO PATHS';
  $('play').disabled=busy||!active().length;$('reset').disabled=busy||!travellers.some(t=>t.origin);$('record').disabled=!playing||typeof MediaRecorder==='undefined';
  $('record').textContent=recording?'■ Save recording':'● Record';$('record').classList.toggle('recording',recording);
  $('save-score').disabled=busy||!image||!graph?.edges.length;
  for(const t of travellers){
    $(`traveller-${t.id}`).classList.toggle('selected',t.id===selected);$(`traveller-${t.id}`).classList.toggle('inactive',!t.enabled);
    $(`place-${t.id}`).setAttribute('aria-pressed',t.id===selected);$(`place-${t.id}`).disabled=busy||!graph?.edges.length;
    $(`enabled-${t.id}`).checked=t.enabled;
  }
  if(!busy&&graph?.edges.length)$('canvas-note').textContent=`Click a line to place traveller ${selected+1}`;
  audio.setActiveCount(active().length);
}
function stop(){playing=false;audio.silence();conversation.reset();lastSpeaker=null;if(recording)endRecording();uiState();}
function place(t,edgeId,from,distance=0){audio.silenceChannel(t.id);conversation.remove(t.id);t.place(edgeId,from,distance);soundEdge(t);uiState();draw();}
function syncTraveller(t){
  for(const key of ['instrument','octave','scale'])$(`${key}-${t.id}`).value=t[key];$(`enabled-${t.id}`).checked=t.enabled;
  for(const [key,value,unit]of [['speed',t.speed,' px/s'],['spacing',t.spacing,' s'],['volume',Math.round(t.volume*100),'%'],['pan',Math.round(t.pan*100),'']]){
    $(`expression-${key}-${t.id}`).value=value;$(`expression-${key}-value-${t.id}`).textContent=key==='pan'?(value===0?'Center':`${Math.abs(value)}% ${value<0?'L':'R'}`):value+unit;
  }
}
function mountTravellers(){
  for(const t of travellers){
    const card=document.createElement('section');card.className='traveller';card.id=`traveller-${t.id}`;card.style.setProperty('--traveller',`var(--voice-${t.id+1})`);card.setAttribute('aria-label',`Traveller ${t.id+1}`);
    card.innerHTML=`<div class="traveller-heading"><span><i></i>Traveller ${t.id+1}</span><label class="enable-label"><input id="enabled-${t.id}" type="checkbox" checked aria-label="Enable traveller ${t.id+1}">On</label></div>
      <button class="place-button" id="place-${t.id}" aria-pressed="${t.id===0}" aria-label="Set start for traveller ${t.id+1}">⌖ Set start</button>
      <div class="traveller-fields"><label for="instrument-${t.id}">Instrument</label><select id="instrument-${t.id}" aria-label="Instrument for traveller ${t.id+1}">${Object.entries(INSTRUMENTS).map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select>
      <label for="octave-${t.id}">Octave</label><select id="octave-${t.id}" aria-label="Octave for traveller ${t.id+1}">${[-2,-1,0,1,2].map(o=>`<option value="${o}" ${o===0?'selected':''}>${o>0?'+':''}${o}${o===0?' · original':''}</option>`).join('')}</select>
      <label for="scale-${t.id}">Tuning</label><select id="scale-${t.id}" aria-label="Tuning for traveller ${t.id+1}">${Object.entries(SCALES).map(([key,s])=>`<option value="${key}">${s.label}</option>`).join('')}</select></div>
      <p class="traveller-note" id="traveller-note-${t.id}">Waiting for ink…</p>
      <details class="traveller-expression"><summary>Expression <span>+</span></summary>${[['speed','Speed',10,240,1],['spacing','Note spacing',.8,12,.1],['volume','Volume',0,100,1],['pan','Stereo',-100,100,1]].map(([key,label,min,max,step])=>`<label for="expression-${key}-${t.id}">${label}<output id="expression-${key}-value-${t.id}"></output></label><input id="expression-${key}-${t.id}" aria-label="${label} for traveller ${t.id+1}" type="range" min="${min}" max="${max}" step="${step}">`).join('')}</details>`;
    $('travellers').append(card);
    syncTraveller(t);
    for(const key of ['speed','spacing','volume','pan'])$(`expression-${key}-${t.id}`).oninput=()=>{
      const value=+$(`expression-${key}-${t.id}`).value;t[key]=['pan','volume'].includes(key)?value/100:value;
      if(key==='spacing'){t.phrasing.next=totalTime+t.spacing*(instrument(t.instrument).spacing||1);conversation.remove(t.id);}
      audio.setTraveller(t.id,t.volume,t.pan);syncTraveller(t);
    };
    $(`place-${t.id}`).onclick=()=>{selected=t.id;uiState();updateLabels();draw();message(`Traveller ${t.id+1} selected. Click a line or junction to place its starting point.`);};
    $(`instrument-${t.id}`).onchange=()=>{
      audio.silenceChannel(t.id);conversation.remove(t.id);t.instrument=$(`instrument-${t.id}`).value;t.phrasing.reset();t.heardPitch=null;updateLabels();soundEdge(t);draw();
      message(`Traveller ${t.id+1} now plays ${instrument(t.instrument).label.toLowerCase()}.`);
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
      draw();message(`Traveller ${t.id+1}: ${SCALES[t.scale].label}, ${t.octave>0?'+':''}${t.octave} octave. Note changes apply to the next strike.`);
    };
  }
}
async function loadImage(src,name){
  const id=++loadId;stop();busy=true;uiState();message('Reading the image…');
  try{
    const img=new Image();img.src=src;await img.decode();if(id!==loadId)return;image=img;
    const scale=Math.min(1,960/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
    $('image-name').textContent=name;await analyse();
  }catch(e){busy=false;message(`Could not read this image. Try a JPEG or PNG. ${e.message}`);uiState();}
}
async function analyse(){
  if(!image)return;stop();busy=true;uiState();message('Finding ink, thinning lines, and measuring the paths…');
  await new Promise(r=>setTimeout(r,35));
  try{
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const mask=thin(inkMask(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,+$('sensitivity').value),canvas.width,canvas.height);
    graph=graphFromSkeleton(mask,canvas.width,canvas.height);totalTime=0;finished=false;for(const t of travellers){t.seed=$('seed').value;t.setGraph(graph);}
    maskLayer=document.createElement('canvas');maskLayer.width=canvas.width;maskLayer.height=canvas.height;
    paintPaths();
    $('junction-count').textContent=`${graph.junctions.length} junctions`;
    if(graph.edges.length){
      defaultStarts(graph).forEach((start,i)=>travellers[i].place(start.edgeId,start.from,start.distance));
      message(`${graph.edges.length} segments found. Three starting points are ready. Select a traveller’s Set start button, then click the ink to move just that point.`);
    }else{
      message('No usable lines found. Increase ink sensitivity, or try a clearer drawing on plain paper.');$('canvas-note').textContent='No paths detected';$('frequency').textContent='—';$('edge-length').textContent='Try another sensitivity';
    }
  }catch(e){graph=null;for(const t of travellers)t.setGraph(null);message(`Could not extract paths: ${e.message}`);}
  busy=false;uiState();draw();
}
function locateClick(event){
  if(!graph?.edges.length||busy)return;
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height,t=travellers[selected];
  let nearest=Infinity,choice=null;
  for(const node of graph.junctions){const d=Math.hypot(node.x-x,node.y-y);if(d<12&&d<nearest){nearest=d;choice={node};}}
  if(choice){const n=choice.node,id=chooseEdge(graph,n.id,null,$('branch').value,null,Math.random,t.visits);place(t,id,n.id);message(`Traveller ${selected+1} placed at a junction. The other starting points are unchanged.`);return;}
  for(const e of graph.edges)for(let i=0;i<e.points.length;i++){const p=e.points[i],d=Math.hypot(p.x-x,p.y-y);if(d<nearest){nearest=d;choice={e,i};}}
  if(!choice||nearest>35){message('Click closer to a detected line, or turn on Paths to see the network.');return;}
  place(t,choice.e.id,choice.e.a,choice.e.lengths[choice.i]);message(`Traveller ${selected+1} placed on the ink.`);
}
function draw(){
  if(!image)return;
  ctx.fillStyle=photo?'#f4f1e9':palette.paper;ctx.fillRect(0,0,canvas.width,canvas.height);
  if(photo){ctx.globalAlpha=.82;ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.globalAlpha=1;}
  if(paths&&maskLayer){ctx.globalAlpha=photo?.48:.8;ctx.drawImage(maskLayer,0,0);ctx.globalAlpha=1;}
  if(paths&&graph){ctx.fillStyle=photo?palette.photoPath:palette.green;for(const n of graph.junctions){ctx.beginPath();ctx.arc(n.x,n.y,1.8,0,Math.PI*2);ctx.fill();}}
  if(!graph)return;
  for(const t of travellers){
    if(!t.walker){$(`traveller-note-${t.id}`).textContent='No path';continue;}
    const e=graph.edges[t.walker.edge],colour=photo?photoColours[t.id]:t.colour;ctx.globalAlpha=t.enabled?1:.25;
    ctx.strokeStyle=colour;ctx.lineWidth=t.id===selected?2.7:2;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();e.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    if(t.enabled)for(let i=0;i<t.trail.length;i+=2){ctx.globalAlpha=(i/t.trail.length)*.5;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(t.trail[i].x,t.trail[i].y,1.5,0,Math.PI*2);ctx.fill();}
    const p=t.position();ctx.globalAlpha=t.enabled?.15:.06;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(p.x,p.y,10+t.pulse*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=t.enabled?1:.35;
    ctx.strokeStyle=photo?'#f4f1e9':palette.paper;ctx.fillStyle=colour;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillStyle=colour;ctx.fillText(String(t.id+1),p.x,p.y-12);ctx.globalAlpha=1;
    const hz=t.heardPitch??pitch(t,e);
    $(`traveller-note-${t.id}`).textContent=`${t.enabled?'':'Off · '}${t.scale==='free'?`${hz.toFixed(1)} Hz`:noteName(hz)} · ${isNoteVoice(t.instrument)?`${t.strikes} ${t.strikes===1?'note':'notes'}`:'resonance'}`;
  }
  const t=travellers[selected];if(!t.walker)return;const e=graph.edges[t.walker.edge],hz=t.heardPitch??pitch(t,e),note=isNoteVoice(t.instrument);
  $('frequency').textContent=t.scale==='free'?hz.toFixed(1):Math.round(hz);
  $('note-name').textContent=`Traveller ${selected+1} · ${t.scale==='free'?'free pitch':noteName(hz)}${t.heardPitch===null?' · ready':''}`;
  $('resonance-label').textContent=note?'LAST NOTE · SELECTED TRAVELLER':'RESONANCE · SELECTED TRAVELLER';$('edge-length').textContent=`${Math.round(e.length)} px · segment ${e.id+1}`;
}
function frame(now){
  const dt=Math.min(.1,(now-(lastTime||now))/1000);lastTime=now;
  if(playing){
    totalTime+=dt;const s=settings(),form=pieceEnvelope(totalTime,s.duration);audio.setVolume(s.volume*form.gain);
    for(const t of travellers){t.advance(dt,t.speed*s.speed,s.mode,soundEdge);if(t.enabled&&t.walker&&isNoteVoice(t.instrument)){const e=graph.edges[t.walker.edge];audio.colour(curvature(e,t.walker.reverse?e.length-t.walker.distance:t.walker.distance),t.id);}}
    if(form.acceptNotes)answer();else conversation.pending.clear();
    if(form.finished){finished=true;stop();message('The piece has ended with a gentle fade. Listen again to replay it from your starting points.');}
    if(!active().length)stop();draw();
  }
  const s=settings(),form=pieceEnvelope(totalTime,s.duration),status=finished?'The piece has ended.':playing&&!form.acceptNotes?'Letting the last notes fade…':s.interaction==='conversation'?(lastSpeaker===null?'Listening for the first phrase.':`Traveller ${lastSpeaker+1} is speaking; the others leave room.`):'Independent voices · each follows its own rhythm.';
  if($('performance-status').textContent!==status)$('performance-status').textContent=status;
  $('elapsed').textContent=`${String(Math.floor(totalTime/60)).padStart(2,'0')}:${String(Math.floor(totalTime%60)).padStart(2,'0')}`;
  sx.clearRect(0,0,scope.width,scope.height);sx.strokeStyle=palette.green;sx.lineWidth=1.5;sx.beginPath();
  if(audio.analyser&&playing){const data=new Uint8Array(audio.analyser.fftSize);audio.analyser.getByteTimeDomainData(data);for(let i=0;i<data.length;i++){const x=i/(data.length-1)*scope.width,y=scope.height/2+(data[i]-128)/128*scope.height*.46;i?sx.lineTo(x,y):sx.moveTo(x,y);}}
  else{sx.moveTo(0,scope.height/2);sx.lineTo(scope.width,scope.height/2);}sx.stroke();requestAnimationFrame(frame);
}
$('play').onclick=async()=>{
  if(playing){stop();return;}if(!active().length||busy)return;
  try{await audio.init();if(finished)restart();playing=true;const s=settings();conversation.reset();lastSpeaker=null;audio.setActiveCount(active().length);audio.setVolume(s.volume*pieceEnvelope(totalTime,s.duration).gain);for(const t of active()){audio.setTraveller(t.id,t.volume,t.pan);t.phrasing.reset();soundEdge(t);}answer();uiState();message('Open Expression to balance each traveller. Call-and-response lets their phrases take turns.');}
  catch(e){stop();message(`Could not start audio: ${e.message}`);}
};
function restart(){audio.silence();conversation.reset();lastSpeaker=null;totalTime=0;finished=false;for(const t of travellers){t.seed=$('seed').value;t.restart();}if(playing){audio.setVolume(settings().volume*pieceEnvelope(0,settings().duration).gain);for(const t of active())soundEdge(t);answer();}uiState();draw();}
$('reset').onclick=()=>{restart();message('All travellers returned to their own starting points and journey seed.');};
$('original').onclick=()=>{photo=!photo;$('original').setAttribute('aria-pressed',photo);paintPaths();draw();};
$('network').onclick=()=>{paths=!paths;$('network').setAttribute('aria-pressed',paths);draw();};
canvas.addEventListener('click',locateClick);canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();$('play').click();}});
function updateLabels(){
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
$('calm-trio').onclick=()=>{
  const keys=['bowl','piano','harp'],octaves=[-1,0,1],speeds=[18,28,40],spacing=[4.5,3,2],volumes=[.65,.8,.55];audio.silence();conversation.reset();lastSpeaker=null;$('interaction').value='conversation';
  for(const t of travellers){t.instrument=keys[t.id];t.octave=octaves[t.id];t.speed=speeds[t.id];t.spacing=spacing[t.id];t.volume=volumes[t.id];t.pan=(t.id-1)*.4;t.scale='pentatonic';t.phrasing.reset();t.heardPitch=null;syncTraveller(t);audio.setTraveller(t.id,t.volume,t.pan);}
  updateLabels();if(playing){audio.setVolume(settings().volume*pieceEnvelope(totalTime,settings().duration).gain);for(const t of active())soundEdge(t);answer();}draw();message('Calm trio: a slow low bowl, spacious felt piano, and lighter high harp, taking turns. Your starting points are preserved.');
};
$('analyse').onclick=analyse;
async function asDataURL(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return `data:${blob.type||'image/jpeg'};base64,${btoa(binary)}`;
}
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
    validateComposition(score);download(new Blob([JSON.stringify(score)],{type:'application/json'}),'filigrana.line-score.json');message('Composition saved with its image, starting points, expression, effects, and journey seed.');
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
    updateEffects();updateLabels();uiState();draw();message('Composition loaded. Press Listen to replay its saved starting points and journey seed.');
  }catch(error){message(`Could not load the composition: ${error.message}`);}finally{event.target.value='';uiState();}
};
function endRecording(){if(!recording)return;recording=false;audio.stopRecording();uiState();}
$('record').onclick=()=>{
  if(recording){endRecording();return;}
  try{audio.record(blob=>{
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);
    const a=document.createElement('a'),ext=blob.type.includes('ogg')?'ogg':blob.type.includes('mp4')?'m4a':'webm';a.href=downloadURL;a.download=`filigrana-${new Date().toISOString().slice(0,19).replaceAll(':','-')}.${ext}`;a.click();message('Recording saved with all instruments, reverb, and delay.');
  });recording=true;uiState();message('Recording all active travellers. Press Save recording or Pause to download your take.');}
  catch(e){message(e.message);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();message('Paused while this tab was hidden. Press Listen to continue.');}});
mountTravellers();refreshPalette();updateLabels();requestAnimationFrame(frame);loadImage('drawing.jpg','Your drawing · IMG_1790');
