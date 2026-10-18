import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Traveller,defaultStarts} from '../dist/traveller.js';
import {graphFromSkeleton} from '../dist/geometry.js';
import {SCALES,bellPitch,frequencyMidi,tunePitch} from '../dist/music.js';
function cross(){const w=81,m=new Uint8Array(w*w);for(let i=5;i<=75;i++){m[40*w+i]=1;m[i*w+40]=1;}return graphFromSkeleton(m,w,w);}
test('three starts are distinct and moving one traveller does not alter the others',()=>{
  const g=cross(),starts=defaultStarts(g),ts=starts.map((s,i)=>{const t=new Traveller(i);t.setGraph(g);t.place(s.edgeId,s.from,s.distance);return t;});
  assert.equal(new Set(ts.map(t=>JSON.stringify(t.position()))).size,3);
  const otherPositions=ts.slice(1).map(t=>t.position()),otherOrigins=ts.slice(1).map(t=>({...t.origin}));
  const e=g.edges.at(-1);ts[0].place(e.id,e.a,e.length/2);ts[0].advance(.5,20,'explore');
  assert.deepEqual(ts.slice(1).map(t=>t.position()),otherPositions);assert.deepEqual(ts.slice(1).map(t=>t.origin),otherOrigins);
});
test('all travellers advance, keep independent visits and phrase clocks, and restart at their own origins',()=>{
  const g=cross(),ts=Array.from({length:3},(_,i)=>{const t=new Traveller(i);t.setGraph(g);const e=g.edges[0];t.place(e.id,e.a);return t;});
  for(const t of ts){let transitions=0;t.advance(5,20,'explore',()=>transitions++);assert.ok(transitions>0);assert.ok(t.visits.reduce((a,b)=>a+b)>1);}
  assert.notEqual(ts[0].visits,ts[1].visits);assert.notEqual(ts[0].phrasing,ts[1].phrasing);
  ts[0].visits.fill(100);assert.ok(ts[1].visits.some(n=>n<100));
  ts[1].enabled=false;const frozen=ts[1].position();ts[1].advance(1,20,'flow');assert.deepEqual(ts[1].position(),frozen);
  for(const t of ts){t.restart();assert.equal(t.walker.distance,t.origin.distance);assert.equal(t.visits.reduce((a,b)=>a+b),1);}
});
test('even a single isolated line supports three different starting positions',()=>{
  const m=new Uint8Array(81*81);for(let i=5;i<=75;i++)m[40*81+i]=1;
  const g=graphFromSkeleton(m,81,81),starts=defaultStarts(g);
  assert.equal(starts.length,3);assert.equal(new Set(starts.map(s=>s.distance)).size,3);
});
test('each scale snaps to its own intervals, including after octave shifts',()=>{
  const graph={w:600,h:800},root=196,r=Math.round(frequencyMidi(root));
  for(const [key,scale] of Object.entries(SCALES)){if(!scale.steps)continue;
    for(const length of [8,25,57,120,330,900])for(const octave of [-2,-1,0,1,2]){
      const hz=bellPitch(length,graph,root,key,octave),m=frequencyMidi(hz);
      assert.ok(Math.abs(m-Math.round(m))<1e-8);assert.ok(scale.steps.includes(((Math.round(m)-r)%12+12)%12));
      assert.ok(Math.abs(hz/bellPitch(length,graph,root,key)-2**octave)<1e-10);
    }
  }
});
test('free tuning retains fractional pitches and exact octave ratios',()=>{
  const g={w:600,h:800},a=bellPitch(147,g,196,'free'),b=bellPitch(148,g,196,'free');
  assert.notEqual(a,b);assert.ok(Math.abs(frequencyMidi(a)-Math.round(frequencyMidi(a)))>.01);
  assert.equal(bellPitch(147,g,196,'free',1),a*2);assert.equal(bellPitch(147,g,196,'free',-2),a/4);
  assert.ok(Math.abs(tunePitch(233.7,196,'free',0,28,96)-233.7)<1e-8);
});
