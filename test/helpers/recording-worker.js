import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as codecs from '../../dist/recording-codecs.js';
const worker=readFileSync(new URL('../../dist/recording-worker.js',import.meta.url),'utf8');
const lame=readFileSync(new URL('../../dist/vendor/lame.min.js',import.meta.url),'utf8');
export async function encodeRecording(format,left,right,sampleRate=48000){
  const messages=[];let context;
  context=vm.createContext({codecExports:codecs,self:{postMessage:data=>messages.push(data)},importScripts:()=>vm.runInContext(lame,context),console});
  vm.runInContext(worker.replace("import('./recording-codecs.js?v=7')",'Promise.resolve(codecExports)'),context);
  context.self.onmessage({data:{type:'init',format,sampleRate}});await new Promise(resolve=>setImmediate(resolve));
  const error=()=>messages.find(m=>m.type==='error');if(error())throw new Error(error().message);
  if(!messages.some(m=>m.type==='ready'))throw new Error('No encoder ready response.');
  for(let i=0;i<left.length;i+=4096)context.self.onmessage({data:{type:'pcm',left:left.subarray(i,i+4096),right:right.subarray(i,i+4096)}});
  context.self.onmessage({data:{type:'finish'}});if(error())throw new Error(error().message);
  const done=messages.find(m=>m.type==='done');if(!done)throw new Error('No encoder finish response.');
  return {bytes:Buffer.concat(messages.filter(m=>m.type==='chunk').map(m=>Buffer.from(m.chunk))),frames:done.frames,messages};
}
