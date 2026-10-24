import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {PlaybackClock} from '../dist/playback-clock.js';
function fixture(){
  let node;const ticks=[],input={connect(){},disconnect(){}},context={currentTime:0,destination:{},audioWorklet:{addModule:async()=>{}}};
  class Node{constructor(){node=this;this.port={postMessage:data=>{this.sent=data;},close(){}};}connect(){}disconnect(){}}
  const clock=new PlaybackClock(dt=>ticks.push(dt),{Node});
  return {clock,context,input,ticks,node:()=>node};
}
test('audio ticks advance without animation frames, and pause discards queued ticks',async()=>{
  const f=fixture();await f.clock.prepare(f.context,f.input);f.clock.start();const token=f.node().sent.token;
  for(const time of [.05,.1,.15])f.node().port.onmessage({data:{type:'tick',token,time}});
  assert.ok(Math.abs(f.ticks.reduce((a,b)=>a+b,0)-.15)<1e-9);
  f.clock.stop();f.node().port.onmessage({data:{type:'tick',token,time:10}});assert.equal(f.ticks.length,3);
  f.context.currentTime=10;f.clock.start();const next=f.node().sent.token;
  f.node().port.onmessage({data:{type:'tick',token,time:11}});assert.equal(f.ticks.length,3);
  f.node().port.onmessage({data:{type:'tick',token:next,time:10.05}});assert.ok(Math.abs(f.ticks.at(-1)-.05)<1e-9);
});
test('reset uses audio time and ignores stale or duplicate timestamps',async()=>{
  const f=fixture();await f.clock.prepare(f.context,f.input);f.clock.start();const token=f.node().sent.token;
  f.context.currentTime=.12;f.clock.reset();for(const time of [.1,.15,.15,NaN])f.node().port.onmessage({data:{type:'tick',token,time}});
  assert.equal(f.ticks.length,1);assert.ok(Math.abs(f.ticks[0]-.03)<1e-9);f.clock.stop();
});
test('timer fallback uses audio time, not callback frequency, and stops cleanly',async()=>{
  let pulse,cleared=0;const context={currentTime:0},ticks=[];
  const clock=new PlaybackClock(dt=>ticks.push(dt),{Node:null,setTimer:callback=>{pulse=callback;return 1;},clearTimer:()=>cleared++});
  await clock.prepare(context,{});clock.start();pulse();context.currentTime=2;pulse();assert.deepEqual(ticks,[2]);clock.stop();context.currentTime=3;pulse();assert.deepEqual(ticks,[2]);assert.equal(cleared,1);
});
test('audio worklet keeps monotonic pulses and adds no sound, stopping only on explicit pause',()=>{
  let Processor;const messages=[],scope={sampleRate:48000,currentFrame:0,AudioWorkletProcessor:class{constructor(){this.port={postMessage:data=>messages.push(data)};}},registerProcessor:(_,klass)=>{Processor=klass;}};
  vm.runInNewContext(readFileSync(new URL('../dist/playback-clock-worklet.js',import.meta.url),'utf8'),scope);
  const clock=new Processor(),output=new Float32Array(128);clock.port.onmessage({data:{type:'start',token:7}});
  for(let i=0;i<375;i++){scope.currentFrame=i*128;clock.process([],[[output]]);}
  assert.equal(messages.length,20);assert.ok(messages.every((m,i)=>m.token===7&&m.time>(messages[i-1]?.time||0)));assert.ok(output.every(v=>v===0));
  clock.port.onmessage({data:{type:'stop'}});clock.process([],[[output]]);assert.equal(messages.length,20);
});

test('an audio-clock processor failure switches to the audio-time fallback without stopping playback',async()=>{
  let pulse,node;const ticks=[],context={currentTime:0,destination:{},audioWorklet:{addModule:async()=>{}}};
  class Node{constructor(){node=this;this.port={postMessage:data=>{this.sent=data;},close(){}};}connect(){}disconnect(){}}
  const clock=new PlaybackClock(dt=>ticks.push(dt),{Node,setTimer:callback=>{pulse=callback;return 1;},clearTimer:()=>{}});
  await clock.prepare(context,{connect(){},disconnect(){}});clock.start();const token=node.sent.token;
  node.port.onmessage({data:{type:'tick',token,time:.05}});node.onprocessorerror();context.currentTime=.15;pulse();
  node.port.onmessage({data:{type:'tick',token,time:.25}});assert.equal(ticks.length,2);assert.ok(Math.abs(ticks.reduce((a,b)=>a+b,0)-.15)<1e-9);assert.equal(clock.running,true);clock.stop();
});
