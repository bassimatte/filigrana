export function seededRandom(seed){
  let state=2166136261;for(const c of String(seed)){state^=c.charCodeAt(0);state=Math.imul(state,16777619);}
  return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export class Conversation {
  constructor(){this.reset();}
  reset(){this.pending=new Map();this.last=-1;this.nextTime=0;}
  offer(id,note){this.pending.set(id,note);}
  remove(id){this.pending.delete(id);}
  next(time,eligible,gap){
    const ids=[...eligible].sort((a,b)=>a-b);for(const id of this.pending.keys())if(!ids.includes(id))this.pending.delete(id);
    if(time<this.nextTime||!ids.length)return null;
    const order=[...ids.filter(id=>id>this.last),...ids.filter(id=>id<=this.last)];
    const id=order.find(id=>this.pending.has(id));if(id===undefined)return null;
    const note=this.pending.get(id);this.pending.delete(id);this.last=id;this.nextTime=time+Math.max(.8,gap);
    return {id,note};
  }
}
export function pieceEnvelope(time,duration=0){
  const entrance=.4+.6*Math.min(1,Math.max(0,time)/6);
  if(!duration)return {gain:entrance,acceptNotes:true,finished:false};
  const remaining=duration-time,fade=Math.min(20,duration*.2),progress=Math.max(0,Math.min(1,remaining/fade));
  return {gain:entrance*(.5-.5*Math.cos(Math.PI*progress)),acceptNotes:remaining>Math.min(8,duration*.08),finished:remaining<=0};
}
