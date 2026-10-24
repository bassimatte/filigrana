// An audio-thread pulse keeps musical timing independent of screen animation.
class FiligranaPlaybackClock extends AudioWorkletProcessor{
  constructor(){super();this.active=false;this.frames=0;this.token=0;
    this.port.onmessage=event=>{const data=event.data;if(data.type==='start'){this.active=true;this.frames=0;this.token=data.token;}else if(data.type==='stop'){this.active=false;this.frames=0;}};
  }
  process(inputs,outputs){
    if(this.active){
      const n=outputs[0]?.[0]?.length||128;this.frames+=n;
      if(this.frames>=sampleRate*.05){this.frames%=Math.round(sampleRate*.05);this.port.postMessage({type:'tick',time:(currentFrame+n)/sampleRate,token:this.token});}
    }
    // This tap adds no sound; the original master continues to the speakers.
    return true;
  }
}
registerProcessor('filigrana-playback-clock',FiligranaPlaybackClock);
