export const SCALES={
  pentatonic:{label:'Major pentatonic',steps:[0,2,4,7,9]},
  minorPentatonic:{label:'Minor pentatonic',steps:[0,3,5,7,10]},
  major:{label:'Major',steps:[0,2,4,5,7,9,11]},
  minor:{label:'Natural minor',steps:[0,2,3,5,7,8,10]},
  chromatic:{label:'Chromatic',steps:[0,1,2,3,4,5,6,7,8,9,10,11]},
  free:{label:'Free · no scale',steps:null}
};
export const midiFrequency=midi=>440*2**((midi-69)/12);
export const frequencyMidi=hz=>69+12*Math.log2(Math.max(1,hz)/440);
export function noteName(hz){const m=Math.round(frequencyMidi(hz));return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][(m%12+12)%12]+(Math.floor(m/12)-1);}
export const bellDecay=ring=>3+ring/65*10;
export function tunePitch(hz,reference,scale='pentatonic',octave=0,minMidi=48,maxMidi=79){
  const target=Math.max(minMidi,Math.min(maxMidi,frequencyMidi(hz)));
  const steps=(SCALES[scale]||SCALES.pentatonic).steps;
  if(!steps)return midiFrequency(target)*2**octave;
  const root=Math.round(frequencyMidi(reference));let best=root,error=Infinity;
  for(let m=Math.ceil(minMidi);m<=Math.floor(maxMidi);m++){
    if(!steps.includes(((m-root)%12+12)%12))continue;
    const d=Math.abs(m-target);if(d<error){error=d;best=m;}
  }
  return midiFrequency(best)*2**octave;
}
export function bellPitch(length,graph,reference,scale='pentatonic',octave=0){
  const root=scale==='free'?frequencyMidi(reference):Math.round(frequencyMidi(reference));
  const raw=reference*.12*Math.hypot(graph.w,graph.h)/Math.max(length,1);
  // Compress the geometric range before snapping. Length remains monotonic:
  // long paths settle into the lower register, fine hatching cannot scream.
  const target=Math.max(root-12,Math.min(root+12,root+12*Math.log2(raw/reference)*.45));
  return tunePitch(midiFrequency(target),reference,scale,octave);
}
export function curvature(edge,distance=0){
  const p=edge.points;if(p.length<3)return 0;
  let i=1;while(i<edge.lengths.length-2&&edge.lengths[i]<distance)i++;
  const a=p[Math.max(0,i-7)],b=p[i],c=p[Math.min(p.length-1,i+7)];
  const ax=b.x-a.x,ay=b.y-a.y,bx=c.x-b.x,by=c.y-b.y,mag=Math.hypot(ax,ay)*Math.hypot(bx,by);
  return mag?Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/mag)))/Math.PI:0;
}
export class BellPhrasing {
  constructor(){this.reset();}
  reset(){this.length=0;this.next=-Infinity;this.lastPitch=null;}
  visit(edge,time,graph,reference,spacing,scale='pentatonic',octave=0){
    this.length+=edge.length;
    if(time+1e-8<this.next)return null;
    // Musically merge tiny segments while preserving every visible ink edge.
    if(this.lastPitch!==null&&this.length<Math.hypot(graph.w,graph.h)*.012)return null;
    const hz=bellPitch(this.length,graph,reference,scale,octave);
    this.length=0;this.lastPitch=hz;
    this.next=time+Math.max(.8,spacing);
    return hz;
  }
}
