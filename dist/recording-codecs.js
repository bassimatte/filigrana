export const RECORDING_SECONDS=600;
export const RECORDING_FORMATS={mp3:{extension:'mp3',mime:'audio/mpeg'},wav:{extension:'wav',mime:'audio/wav'}};
const sample=v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
export function pcm16(input){
  const output=new Int16Array(input.length);
  for(let i=0;i<input.length;i++){const v=sample(input[i]);output[i]=Math.round(v*(v<0?32768:32767));}
  return output;
}
export function pcm24Stereo(left,right){
  if(left.length!==right.length)throw new Error('Stereo channels have different lengths.');
  const bytes=new Uint8Array(left.length*6);let offset=0;
  for(let i=0;i<left.length;i++)for(const channel of [left,right]){
    const v=sample(channel[i]),n=Math.round(v*(v<0?8388608:8388607));
    bytes[offset++]=n&255;bytes[offset++]=(n>>8)&255;bytes[offset++]=(n>>16)&255;
  }
  return bytes;
}
export function wavHeader(frames,sampleRate){
  const size=frames*6;
  if(!Number.isSafeInteger(frames)||frames<0||size>0xffffffff-36||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Invalid WAV size or sample rate.');
  const buffer=new ArrayBuffer(44),view=new DataView(buffer);
  const word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,36+size,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*6,true);view.setUint16(32,6,true);view.setUint16(34,24,true);word(36,'data');view.setUint32(40,size,true);
  return buffer;
}
