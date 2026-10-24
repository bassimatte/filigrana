import {RECORDING_SECONDS,RECORDING_FORMATS,wavHeader} from './recording-codecs.js?v=7';
const modules=new WeakMap();
export const canRecord=()=>typeof AudioWorkletNode!=='undefined'&&typeof Worker!=='undefined';
export class MixRecorder{
  constructor(context,input,{format='mp3',onComplete=()=>{},onError=()=>{},onLimit=()=>{}}={}){
    if(!Object.hasOwn(RECORDING_FORMATS,format))throw new Error('Choose MP3 or WAV.');
    Object.assign(this,{context,input,format,onComplete,onError,onLimit});this.chunks=[];this.pending=0;this.closed=false;this.stopping=false;
  }
  async start(){
    if(!canRecord()||!this.context.audioWorklet)throw new Error('Recording is unavailable in this browser.');
    if(!modules.has(this.context))modules.set(this.context,this.context.audioWorklet.addModule(new URL('./recording-capture.js?v=7',import.meta.url).href).catch(error=>{modules.delete(this.context);throw error;}));
    await modules.get(this.context);if(this.closed)throw new Error('Recording cancelled.');
    this.worker=new Worker(new URL('./recording-worker.js?v=7',import.meta.url));
    await new Promise((resolve,reject)=>{
      this.rejectStart=reject;const readyTimer=setTimeout(()=>this.fail(new Error('The recording encoder could not start.')),15000);this.readyTimer=readyTimer;
      this.worker.onerror=event=>this.fail(new Error(event.message||'Recording encoder failed.'));
      this.worker.onmessage=event=>{
        if(this.closed)return;const data=event.data;
        if(data.type==='ready'){clearTimeout(readyTimer);this.rejectStart=null;resolve();}
        else if(data.type==='chunk')this.chunks.push(data.chunk);
        else if(data.type==='processed')this.pending--;
        else if(data.type==='error')this.fail(new Error(data.message));
        else if(data.type==='done')this.finish(data.frames);
      };
      this.worker.postMessage({type:'init',format:this.format,sampleRate:this.context.sampleRate});
    });
    if(this.closed)throw new Error('Recording cancelled.');
    this.node=new AudioWorkletNode(this.context,'filigrana-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',processorOptions:{maxFrames:Math.floor(this.context.sampleRate*RECORDING_SECONDS)}});
    this.node.onprocessorerror=()=>this.fail(new Error('Audio capture stopped unexpectedly.'));
    this.node.port.onmessage=event=>{
      if(this.closed)return;const data=event.data;
      if(data.type==='pcm'){
        if(++this.pending>128){this.fail(new Error('The recording encoder could not keep up. Try a shorter recording.'));return;}
        this.worker.postMessage(data,[data.left.buffer,data.right.buffer]);
      }else if(data.type==='flushed'){
        this.stopping=true;if(data.limit)this.onLimit();this.worker.postMessage({type:'finish'});
      }
    };
    this.node.connect(this.context.destination);this.input.connect(this.node);
  }
  stop(){if(this.closed||this.stopping)return;this.stopping=true;this.node?.port.postMessage({type:'stop'});}
  finish(frames){
    if(this.closed)return;
    if(!frames){this.fail(new Error('No audio was recorded.'));return;}
    const type=RECORDING_FORMATS[this.format],parts=this.format==='wav'?[wavHeader(frames,this.context.sampleRate),...this.chunks]:this.chunks;
    const blob=new Blob(parts,{type:type.mime});this.cleanup();this.onComplete({blob,extension:type.extension,sampleRate:this.context.sampleRate,frames});
  }
  fail(error){if(this.closed)return;const reject=this.rejectStart;this.cleanup();if(reject)reject(error);else this.onError(error);}
  cancel(){if(this.closed)return;const reject=this.rejectStart;this.cleanup();if(reject)reject(new Error('Recording cancelled.'));}
  cleanup(){
    this.closed=true;clearTimeout(this.readyTimer);this.worker?.terminate();if(this.node){try{this.input.disconnect(this.node);}catch{}this.node.disconnect();this.node.port.close();}this.chunks=[];
  }
}
