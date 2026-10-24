export class PlaybackClock{
  constructor(onTick,{Node=globalThis.AudioWorkletNode,setTimer=setInterval,clearTimer=clearInterval}={}){
    Object.assign(this,{onTick,Node,setTimer,clearTimer});this.running=false;this.token=0;this.timer=null;this.node=null;
  }
  prepare(context,input){
    if(this.preparing)return this.preparing;this.context=context;
    this.preparing=(async()=>{
      if(!this.Node||!context.audioWorklet)return;
      try{
        await context.audioWorklet.addModule(new URL('./playback-clock-worklet.js?v=9',import.meta.url).href);
        this.node=new this.Node(context,'filigrana-playback-clock',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
        this.node.port.onmessage=event=>{const data=event.data;if(data.type==='tick'&&data.token===this.token)this.tick(data.time);};
        this.node.onprocessorerror=()=>{this.discardNode(input);if(this.running)this.useTimer();};
        input.connect(this.node);this.node.connect(context.destination);
      }catch{this.discardNode(input);}
    })();
    return this.preparing;
  }
  discardNode(input){
    const node=this.node;this.node=null;this.token++;
    if(node){try{input.disconnect(node);}catch{}node.disconnect();node.port.close();}
  }
  tick(time=this.context.currentTime){
    if(!this.running||!Number.isFinite(time)||time<=this.lastTime)return;
    const dt=time-this.lastTime;this.lastTime=time;this.onTick(dt);
  }
  useTimer(){if(this.timer===null)this.timer=this.setTimer(()=>this.tick(),25);}
  start(){
    this.stop();this.running=true;this.lastTime=this.context.currentTime;
    if(this.node)this.node.port.postMessage({type:'start',token:this.token});else this.useTimer();
  }
  reset(){if(this.context)this.lastTime=this.context.currentTime;}
  stop(){this.running=false;this.token++;this.node?.port.postMessage({type:'stop'});if(this.timer!==null){this.clearTimer(this.timer);this.timer=null;}}
}
