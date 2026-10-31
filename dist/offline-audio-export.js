import {RECORDING_FORMATS,wavHeader} from './recording-codecs.js?v=7';

export function encodeOfflineAudioBuffer(buffer,format,onProgress=()=>{},signal=null){
  if(!Object.hasOwn(RECORDING_FORMATS,format))return Promise.reject(new Error('Choose MP3 or WAV.'));
  if(buffer.numberOfChannels<2)return Promise.reject(new Error('Offline audio must be stereo.'));
  if(signal?.aborted)return Promise.reject(new DOMException('Render cancelled.','AbortError'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./recording-worker.js?v=7',import.meta.url));
    const chunks=[],left=buffer.getChannelData(0),right=buffer.getChannelData(1),chunkFrames=4096,maxPending=24;
    let next=0,inFlight=0,processed=0,ready=false,finishing=false,closed=false;
    const cleanup=()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',abort);worker.terminate();};
    const fail=error=>{cleanup();reject(error);};
    const abort=()=>fail(new DOMException('Render cancelled.','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    worker.onerror=event=>fail(new Error(event.message||'The audio encoder failed.'));
    worker.onmessage=event=>{
      const data=event.data;
      if(data.type==='ready'){ready=true;pump();}
      else if(data.type==='chunk')chunks.push(data.chunk);
      else if(data.type==='processed'){inFlight--;processed+=Math.min(chunkFrames,buffer.length-processed);onProgress(Math.min(1,processed/buffer.length));pump();}
      else if(data.type==='error')fail(new Error(data.message||'The audio encoder failed.'));
      else if(data.type==='done'){
        try{const parts=format==='wav'?[wavHeader(data.frames,buffer.sampleRate),...chunks]:chunks;const blob=new Blob(parts,{type:RECORDING_FORMATS[format].mime});cleanup();resolve({blob,extension:RECORDING_FORMATS[format].extension});}
        catch(error){fail(error);}
      }
    };
    function pump(){
      if(closed||!ready||signal?.aborted)return;
      while(next<buffer.length&&inFlight<maxPending){
        const end=Math.min(buffer.length,next+chunkFrames),l=left.slice(next,end),r=right.slice(next,end);
        next=end;inFlight++;worker.postMessage({type:'pcm',left:l,right:r},[l.buffer,r.buffer]);
      }
      if(next>=buffer.length&&inFlight===0&&!finishing){finishing=true;worker.postMessage({type:'finish'});}
    }
    worker.postMessage({type:'init',format,sampleRate:buffer.sampleRate});
  });
}
