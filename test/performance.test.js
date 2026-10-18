import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Conversation,pieceEnvelope,seededRandom} from '../dist/performance.js';
import {Traveller} from '../dist/traveller.js';
import {graphFromSkeleton} from '../dist/geometry.js';
import {validateComposition} from '../dist/composition.js';
test('conversation alternates ready speakers and enforces the silence between phrases',()=>{
  const c=new Conversation();for(let id=0;id<3;id++)c.offer(id,{hz:220+id});
  assert.equal(c.next(0,[0,1,2],2.4).id,0);assert.equal(c.next(2.3,[0,1,2],2.4),null);
  c.offer(0,{hz:330});assert.equal(c.next(2.4,[0,1,2],2.4).id,1);
  c.offer(1,{hz:440});assert.equal(c.next(4.8,[0,1,2],2.4).id,2);
  assert.equal(c.next(7.2,[0,1,2],2.4).id,0);
});
test('conversation skips unavailable voices and never builds an unbounded backlog',()=>{
  const c=new Conversation();for(let i=0;i<100;i++)c.offer(0,{hz:200+i});c.offer(2,{hz:440});
  assert.equal(c.pending.size,2);assert.equal(c.next(0,[0,1],1).note.hz,299);assert.equal(c.pending.size,0);
  c.offer(1,{hz:330});c.remove(1);assert.equal(c.next(10,[0,1],1),null);c.reset();assert.equal(c.last,-1);
});
test('piece envelope leaves a coda and ends in silence, while open-ended playback continues',()=>{
  assert.equal(pieceEnvelope(120,120).finished,true);assert.equal(pieceEnvelope(120,120).gain,0);
  assert.equal(pieceEnvelope(115,120).acceptNotes,false);assert.equal(pieceEnvelope(100,120).acceptNotes,true);
  let last=1;for(let t=100;t<=120;t++){const gain=pieceEnvelope(t,120).gain;assert.ok(gain<=last);last=gain;}
  assert.equal(pieceEnvelope(1e6,0).finished,false);assert.equal(pieceEnvelope(1e6,0).gain,1);
});
test('seeded journeys repeat their random choices after restart',()=>{
  const a=seededRandom('ink'),b=seededRandom('ink'),c=seededRandom('another');const first=Array.from({length:20},a);
  assert.deepEqual(first,Array.from({length:20},b));assert.notDeepEqual(first,Array.from({length:20},c));
  const w=81,m=new Uint8Array(w*w);for(let i=5;i<=75;i++){m[40*w+i]=1;m[i*w+40]=1;}const graph=graphFromSkeleton(m,w,w),t=new Traveller(0);t.setGraph(graph);t.place(0,graph.edges[0].a);
  const route=()=>{const ids=[];for(let i=0;i<30;i++)t.advance(.5,80,'random',()=>ids.push(t.walker.edge));return ids;};
  const path=route();t.restart();assert.deepEqual(route(),path);
});
test('different traveller speeds change movement independently',()=>{
  const w=201,m=new Uint8Array(w*10);for(let x=5;x<=195;x++)m[5*w+x]=1;const graph=graphFromSkeleton(m,w,10),a=new Traveller(0),b=new Traveller(1);
  for(const t of [a,b]){t.setGraph(graph);t.place(0,graph.edges[0].a);}a.speed=20;b.speed=40;
  a.advance(1,a.speed,'flow');b.advance(1,b.speed,'flow');assert.equal(b.walker.distance,a.walker.distance*2);
});
function score(){return {format:'line-resonator',version:1,image:{src:'data:image/jpeg;base64,/9j/AA==',name:'Drawing'},controls:{speed:125,interaction:'conversation',duration:300,seed:'a saved seed'},graph:{w:300,h:960,edges:40},travellers:Array.from({length:3},(_,i)=>({instrument:['bowl','piano','harp'][i],speed:20+i*10,spacing:2+i,volume:.5+i*.1,pan:(i-1)*.4,octave:i-1,scale:'free',origin:{edgeId:i,from:i,distance:10,x:.2+i*.1,y:.4}}))};}
test('compositions round-trip image, origin, expression, mode, duration and seed',()=>{
  const validated=validateComposition(JSON.parse(JSON.stringify(score())));
  assert.equal(validated.image.src,score().image.src);assert.equal(validated.controls.seed,'a saved seed');assert.equal(validated.controls.duration,300);
  assert.equal(validated.travellers[2].origin.distance,10);assert.equal(validated.travellers[1].volume,.6);assert.equal(validated.travellers[2].speed,40);assert.equal(validated.travellers[0].pan,-.4);
  assert.deepEqual(validateComposition(JSON.parse(JSON.stringify(validated))),validated);
});
test('invalid compositions are rejected and imported settings stay within control ranges',()=>{
  assert.throws(()=>validateComposition({}));const s=score();s.image.src='https://example.com/image.jpg';assert.throws(()=>validateComposition(s));
  const bad=score();bad.travellers[0].volume=100;bad.travellers[0].instrument='__proto__';bad.travellers[0].scale='constructor';bad.controls.speed=-200;
  const safe=validateComposition(bad);assert.equal(safe.travellers[0].volume,1);assert.equal(safe.controls.speed,25);assert.equal(safe.travellers[0].instrument,'bell');assert.equal(safe.travellers[0].scale,'pentatonic');
});
