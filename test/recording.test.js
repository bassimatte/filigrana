import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {pcm16,pcm24Stereo,wavHeader} from '../dist/recording-codecs.js';
import {MixRecorder} from '../dist/recorder.js';
import {encodeRecording} from './helpers/recording-worker.js';

test('24-bit WAV uses correct stereo metadata and full-resolution little-endian samples',()=>{
  const bytes=pcm24Stereo(new Float32Array([0,-1]),new Float32Array([1,.5]));
  assert.deepEqual([...bytes],[0,0,0,255,255,127,0,0,128,0,0,64]);
  const h=new DataView(wavHeader(2,48000));assert.equal(h.getUint32(4,true),48);assert.equal(h.getUint16(20,true),1);assert.equal(h.getUint16(22,true),2);assert.equal(h.getUint32(24,true),48000);assert.equal(h.getUint32(28,true),288000);assert.equal(h.getUint16(34,true),24);assert.equal(h.getUint32(40,true),12);
  assert.throws(()=>wavHeader(1e12,48000));assert.throws(()=>pcm24Stereo(new Float32Array(2),new Float32Array(1)));
});
test('sample conversion clamps overloads and sanitizes non-finite audio',()=>{
  assert.deepEqual([...pcm16(new Float32Array([-2,-1,0,1,2,NaN,Infinity]))],[-32768,-32768,0,32767,32767,0,0]);
});
test('WAV worker preserves sample count, stereo separation and detail below 16-bit resolution',async()=>{
  const left=Float32Array.from({length:9001},(_,i)=>Math.sin(i*.03)*.123456),right=Float32Array.from(left,v=>-v*.3),result=await encodeRecording('wav',left,right);
  assert.equal(result.frames,9001);assert.equal(result.bytes.length,9001*6);assert.ok(result.bytes.some((v,i)=>i%3===0&&v!==0));
  const read=offset=>{let n=result.bytes[offset]|result.bytes[offset+1]<<8|result.bytes[offset+2]<<16;if(n&0x800000)n-=0x1000000;return n/8388608;};
  for(let i=0;i<left.length;i+=101){assert.ok(Math.abs(read(i*6)-left[i])<2/8388608);assert.ok(Math.abs(read(i*6+3)-right[i])<2/8388608);}
});
test('MP3 worker produces real MPEG Layer III stereo frames at 320 kbps / 48 kHz',async()=>{
  const left=Float32Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*440*i/48000)*.25),right=Float32Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*880*i/48000)*.2);
  const result=await encodeRecording('mp3',left,right);assert.equal(result.frames,left.length);assert.ok(result.bytes.length>15000);
  let at=-1;for(let i=0;i<result.bytes.length-4;i++)if(result.bytes[i]===255&&(result.bytes[i+1]&0xfe)===0xfa){at=i;break;}
  assert.ok(at>=0);assert.equal(result.bytes[at+2]>>4,14);assert.equal((result.bytes[at+2]>>2)&3,1);assert.notEqual(result.bytes[at+3]>>6,3);
});
function capture(maxFrames){
  const messages=[];let Processor;
  vm.runInNewContext(readFileSync(new URL('../dist/recording-capture.js',import.meta.url),'utf8'),{AudioWorkletProcessor:class{constructor(){this.port={postMessage:data=>messages.push(data)};}},sampleRate:48000,registerProcessor:(_,klass)=>{Processor=klass;}});
  return {processor:new Processor({processorOptions:{maxFrames}}),messages};
}
test('capture flushes a partial block once and keeps left/right channels separate',()=>{
  const {processor:p,messages}=capture(48000),left=new Float32Array(128).fill(.2),right=new Float32Array(128).fill(-.4);
  for(let i=0;i<3;i++)p.process([[left,right]]);p.port.onmessage({data:{type:'stop'}});p.port.onmessage({data:{type:'stop'}});
  const chunks=messages.filter(m=>m.type==='pcm');assert.equal(chunks.length,1);assert.equal(chunks[0].left.length,384);assert.equal(chunks[0].right[0],right[0]);assert.equal(messages.filter(m=>m.type==='flushed').length,1);assert.equal(p.process([[left,right]]),false);
});
test('capture limit finishes at the exact sample and handles a mono mix',()=>{
  const {processor:p,messages}=capture(1000);for(let i=0;i<9;i++)p.process([[new Float32Array(128).fill(.25)]]);
  const pcm=messages.find(m=>m.type==='pcm'),done=messages.find(m=>m.type==='flushed');assert.equal(pcm.left.length,1000);assert.deepEqual(pcm.left,pcm.right);assert.equal(done.frames,1000);assert.equal(done.limit,true);
});
function fakeCapture(t){
  const previous={Worker:globalThis.Worker,AudioWorkletNode:globalThis.AudioWorkletNode};t.after(()=>Object.assign(globalThis,previous));
  const workers=[],nodes=[];
  globalThis.Worker=class{
    frames=0;
    constructor(){workers.push(this);}
    postMessage(data){queueMicrotask(()=>{if(this.terminated)return;
      if(data.type==='init')this.onmessage({data:{type:'ready'}});
      if(data.type==='pcm'){this.frames+=data.left.length;this.onmessage({data:{type:'chunk',chunk:pcm24Stereo(data.left,data.right)}});this.onmessage({data:{type:'processed'}});}
      if(data.type==='finish')this.onmessage({data:{type:'done',frames:this.frames}});
    });}
    terminate(){this.terminated=true;}
  };
  globalThis.AudioWorkletNode=class{
    constructor(){nodes.push(this);this.port={close(){},postMessage:data=>{if(data.type==='stop'){this.port.onmessage({data:{type:'pcm',left:new Float32Array(97).fill(.2),right:new Float32Array(97).fill(-.2)}});this.port.onmessage({data:{type:'flushed',frames:97}});}}};}
    connect(){}disconnect(){this.disconnected=true;}
  };
  const input={connected:new Set(),connect(node){this.connected.add(node);},disconnect(node){this.connected.delete(node);}},context={sampleRate:48000,destination:{},audioWorklet:{addModule:async()=>{}}};
  return {workers,nodes,input,context};
}
test('recorder waits for the final capture block before saving and releases its audio connection',async t=>{
  const {input,context,workers,nodes}=fakeCapture(t);let done;
  const saved=new Promise(resolve=>{done=resolve;}),r=new MixRecorder(context,input,{format:'wav',onComplete:done});await r.start();assert.equal(input.connected.size,1);r.stop();r.stop();
  const result=await saved;assert.equal(result.frames,97);assert.equal(result.blob.type,'audio/wav');assert.equal(result.blob.size,44+97*6);assert.equal(workers[0].terminated,true);assert.equal(nodes[0].disconnected,true);assert.equal(input.connected.size,0);
});
test('cancelled preparation never connects a capture node or downloads a partial file',async t=>{
  const {input,context,workers}=fakeCapture(t);let release,completed=false;context.audioWorklet.addModule=()=>new Promise(resolve=>{release=resolve;});
  const r=new MixRecorder(context,input,{onComplete:()=>{completed=true;}}),start=r.start();r.cancel();release();await assert.rejects(start,/cancelled/);assert.equal(input.connected.size,0);assert.equal(workers.length,0);assert.equal(completed,false);
});
