import {
  BufferTarget,
  AudioBufferSource,
  CanvasSource,
  MediaStreamAudioTrackSource,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
  canEncodeVideo
} from './vendor/mediabunny.min.mjs';
import {registerAacEncoder} from './vendor/mediabunny-aac-encoder.min.mjs';

const FRAME_RATE=30;
let aacRegistered=false;

async function ensureMp4Codecs(width,height,videoQuality,audioQuality){
  if(!await canEncodeVideo('avc',{width,height,frameRate:FRAME_RATE,quality:videoQuality}))throw new Error('This browser cannot encode H.264 video. Try a recent version of Chrome, Edge, or Safari.');
  if(!await canEncodeAudio('aac',{numberOfChannels:2,sampleRate:48000,quality:audioQuality})){if(!aacRegistered){registerAacEncoder();aacRegistered=true;}if(!await canEncodeAudio('aac',{numberOfChannels:2,sampleRate:48000,quality:audioQuality}))throw new Error('AAC audio encoding is unavailable in this browser.');}
}

export async function createMp4Export({canvas,audioTrack,renderFrame,width,height,onError}){
  const videoQuality=new Quality({bitrate:2_500_000}),audioQuality=new Quality({bitrate:160_000});
  await ensureMp4Codecs(width,height,videoQuality,audioQuality);

  const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:false}),target});
  const videoSource=new CanvasSource(canvas,{codec:'avc',quality:videoQuality,keyFrameInterval:2});
  const audioSource=new MediaStreamAudioTrackSource(audioTrack,{codec:'aac',quality:audioQuality});
  output.addVideoTrack(videoSource,{frameRate:FRAME_RATE});output.addAudioTrack(audioSource);
  await output.start();

  let active=true,timer=null,pending=Promise.resolve(),lastTimestamp=-1;const startedAt=performance.now();
  const capture=async()=>{
    if(!active)return;
    const started=performance.now();
    try{
      renderFrame();
      lastTimestamp=Math.max(0,(performance.now()-startedAt)/1000);
      await videoSource.add(lastTimestamp,1/FRAME_RATE);
    }catch(error){active=false;onError?.(error);return;}
    if(active)timer=setTimeout(()=>{pending=capture();},Math.max(0,1000/FRAME_RATE-(performance.now()-started)));
  };
  audioSource.errorPromise.catch(error=>{active=false;onError?.(error);});
  pending=capture();

  return {
    async stop(){
      active=false;clearTimeout(timer);await pending;renderFrame();lastTimestamp=Math.max((performance.now()-startedAt)/1000,lastTimestamp+1/FRAME_RATE);await videoSource.add(lastTimestamp,1/FRAME_RATE);audioSource.close();videoSource.close();await output.finalize();
      if(!target.buffer?.byteLength)throw new Error('The MP4 encoder returned an empty video.');
      return new Blob([target.buffer],{type:'video/mp4'});
    },
    async cancel(){active=false;clearTimeout(timer);try{await pending;}catch{}try{await output.cancel();}catch{}}
  };
}

export async function createOfflineMp4Export({canvas,width,height}){
  const videoQuality=new Quality({bitrate:2_500_000}),audioQuality=new Quality({bitrate:160_000});
  await ensureMp4Codecs(width,height,videoQuality,audioQuality);
  const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:false}),target});
  const videoSource=new CanvasSource(canvas,{codec:'avc',quality:videoQuality,keyFrameInterval:2});
  const audioSource=new AudioBufferSource({codec:'aac',quality:audioQuality});
  output.addVideoTrack(videoSource,{frameRate:FRAME_RATE});output.addAudioTrack(audioSource);
  await output.start();
  let finalized=false;
  return {
    async addFrame(timestamp,duration=1/FRAME_RATE){if(finalized)throw new Error('The MP4 render is closed.');await videoSource.add(timestamp,duration);},
    async finish(audioBuffer){
      if(finalized)throw new Error('The MP4 render is closed.');
      await audioSource.add(audioBuffer);audioSource.close();videoSource.close();await output.finalize();finalized=true;
      if(!target.buffer?.byteLength)throw new Error('The MP4 encoder returned an empty video.');
      return new Blob([target.buffer],{type:'video/mp4'});
    },
    async cancel(){if(finalized)return;finalized=true;try{await output.cancel();}catch{}}
  };
}
