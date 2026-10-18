import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bellPitch,BellPhrasing,frequencyMidi,curvature} from '../dist/music.js';
const graph={w:600,h:800},root=196;
test('bell pitches stay in the pentatonic scale and a warm register',()=>{
  for(const reference of [55,147,196,440,660])for(const length of [1,5,20,80,240,1000,5000]){
    const m=Math.round(frequencyMidi(bellPitch(length,graph,reference))),r=Math.round(frequencyMidi(reference));
    assert.ok([0,2,4,7,9].includes(((m-r)%12+12)%12));assert.ok(m>=48&&m<=79);
  }
});
test('longer lines never rise in pitch; tiny lines cannot create piercing fundamentals',()=>{
  let previous=Infinity;for(let length=1;length<4000;length++){
    const hz=bellPitch(length,graph,root);assert.ok(hz<=previous);previous=hz;assert.ok(hz<800);
  }
});
test('bell tuning is independent of uploaded image resolution',()=>{
  assert.equal(bellPitch(120,graph,root),bellPitch(240,{w:1200,h:1600},root));
});
test('dense junctions combine into one pitch and cannot bypass the strike interval',()=>{
  const p=new BellPhrasing(),edge={length:20};assert.ok(p.visit(edge,0,graph,root,2.8));
  assert.equal(p.visit(edge,.5,graph,root,2.8),null);assert.equal(p.visit(edge,2,graph,root,2.8),null);
  assert.equal(p.visit(edge,2.8,graph,root,2.8),bellPitch(60,graph,root));
  assert.equal(p.visit(edge,3,graph,root,2.8),null);
});
test('tiny paths wait for enough travelled ink even after the time gate opens',()=>{
  const p=new BellPhrasing();p.visit({length:20},0,graph,root,1);
  assert.equal(p.visit({length:3},2,graph,root,1),null);
  assert.equal(p.visit({length:3},3,graph,root,1),null);
  assert.equal(p.visit({length:3},4,graph,root,1),null);
  assert.ok(p.visit({length:3},5,graph,root,1));
  p.reset();assert.ok(p.visit({length:20},0,graph,root,1));
});
test('bends add brightness while straight ink stays soft',()=>{
  const straight={points:Array.from({length:21},(_,i)=>({x:i,y:0})),lengths:Array.from({length:21},(_,i)=>i)};
  const bend={points:[{x:0,y:0},{x:10,y:0},{x:10,y:10}],lengths:[0,10,20]};
  assert.equal(curvature(straight,10),0);assert.equal(curvature(bend,10),.5);
});
