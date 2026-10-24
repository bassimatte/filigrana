// Classic worker keeps the unmodified, replaceable LAME library outside the app modules.
const codecsReady=import('./recording-codecs.js?v=7');
let codecs,encoder,format,frames=0,finished=false;
function output(bytes){if(!bytes.length)return;const chunk=new Uint8Array(bytes);self.postMessage({type:'chunk',chunk},[chunk.buffer]);}
self.onmessage=event=>{
  const data=event.data;
  if(data.type==='init'){
    codecsReady.then(module=>{
      codecs=module;format=data.format;
      if(!Object.hasOwn(codecs.RECORDING_FORMATS,format))throw new Error('Unknown recording format.');
      if(format==='mp3'){importScripts('vendor/lame.min.js');encoder=new lamejs.Mp3Encoder(2,data.sampleRate,320);}
      self.postMessage({type:'ready'});
    }).catch(error=>self.postMessage({type:'error',message:error.message}));
    return;
  }
  if(finished)return;
  try{
    if(!codecs)throw new Error('The recording encoder is not ready.');
    if(data.type==='pcm'){
      const {left,right}=data;if(left.length!==right.length)throw new Error('Stereo capture mismatch.');
      frames+=left.length;
      if(format==='wav')output(codecs.pcm24Stereo(left,right));
      else{
        const l=codecs.pcm16(left),r=codecs.pcm16(right);
        for(let i=0;i<l.length;i+=1152)output(encoder.encodeBuffer(l.subarray(i,i+1152),r.subarray(i,i+1152)));
      }
      self.postMessage({type:'processed'});
    }else if(data.type==='finish'){
      if(format==='mp3')output(encoder.flush());finished=true;self.postMessage({type:'done',frames});
    }
  }catch(error){finished=true;self.postMessage({type:'error',message:error.message});}
};
