// Copy the post-effects mix in small transferable blocks; never encode on the audio thread.
class FiligranaCapture extends AudioWorkletProcessor{
  constructor(options){
    super();this.left=new Float32Array(4096);this.right=new Float32Array(4096);this.used=0;this.frames=0;this.active=true;
    this.maxFrames=options.processorOptions?.maxFrames||sampleRate*600;
    this.port.onmessage=event=>{if(event.data.type==='stop')this.finish(false);};
  }
  send(){if(!this.used)return;const left=this.left.subarray(0,this.used),right=this.right.subarray(0,this.used);this.port.postMessage({type:'pcm',left,right},[left.buffer,right.buffer]);this.left=new Float32Array(4096);this.right=new Float32Array(4096);this.used=0;}
  finish(limit){if(!this.active)return;this.active=false;this.send();this.port.postMessage({type:'flushed',frames:this.frames,limit});}
  process(inputs){
    if(!this.active)return false;
    const input=inputs[0],left=input?.[0],right=input?.[1]||left,n=left?.length||128;
    for(let i=0;i<n&&this.active;i++){
      this.left[this.used]=left?.[i]||0;this.right[this.used]=right?.[i]||0;this.used++;this.frames++;
      if(this.used===4096)this.send();if(this.frames>=this.maxFrames)this.finish(true);
    }
    // The output stays silent. The original master still goes to the speakers.
    return this.active;
  }
}
registerProcessor('filigrana-capture',FiligranaCapture);
