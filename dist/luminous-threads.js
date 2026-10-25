import {pointOnEdge} from './geometry.js';

// Light travels by distance along the ink, so disconnected lines never flash together.
export class ThreadLights {
  constructor(){this.pulses=[];this.duration=4.5;}
  clear(voice=null){this.pulses=voice===null?[]:this.pulses.filter(p=>p.voice!==voice);}
  live(now){this.pulses=this.pulses.filter(p=>now-p.time<this.duration&&now>=p.time);return this.pulses;}
  emit(graph,voice,edgeId,from,distance,now){
    const source=graph.edges[edgeId];if(!source)return;
    const offset=source.b===from&&source.a!==from?source.length-distance:distance,range=240,distances=new Map(),queue=new Map();
    const offer=(id,value)=>{if(value<=range&&value<(distances.get(id)??Infinity)){distances.set(id,value);queue.set(id,value);}};
    offer(source.a,offset);offer(source.b,source.length-offset);
    for(let visited=0;queue.size&&visited<256;visited++){
      let id,value=Infinity;for(const [node,d]of queue)if(d<value){id=node;value=d;}queue.delete(id);
      for(const next of graph.nodes[id].edges){const e=graph.edges[next];offer(e.a===id?e.b:e.a,value+e.length);}
    }
    const segments=[];
    for(const edge of graph.edges){
      const a=distances.get(edge.a)??Infinity,b=distances.get(edge.b)??Infinity;
      if(edge.id!==edgeId&&Math.min(a,b)>range)continue;
      let index=0;
      for(let i=1;i<edge.points.length;i++){
        if(i<edge.points.length-1&&edge.lengths[i]-edge.lengths[index]<5)continue;
        const along=(edge.lengths[index]+edge.lengths[i])/2,d=Math.min(a+along,b+edge.length-along,edge.id===edgeId?Math.abs(along-offset):Infinity);
        if(d<=range)segments.push({a:edge.points[index],b:edge.points[i],distance:d});index=i;
        if(segments.length>=2400)break;
      }
      if(segments.length>=2400)break;
    }
    this.live(now);this.pulses.push({voice,time:now,position:pointOnEdge(source,offset),segments});if(this.pulses.length>16)this.pulses.shift();
  }
}

function halo(ctx,p,radius,colour,alpha){
  const wash=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);wash.addColorStop(0,colour+'a0');wash.addColorStop(.3,colour+'40');wash.addColorStop(1,colour+'00');
  ctx.globalAlpha=alpha;ctx.fillStyle=wash;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
}

export function drawThreads(ctx,{graph,path,travellers,scale,now,pulses,lastMotion,playing,hover,drag,palette,dark,reducedMotion}){
  if(!graph)return;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=palette.green;ctx.lineWidth=(dark?1.05:1)/scale;ctx.globalAlpha=dark?.34:.38;if(path)ctx.stroke(path);
  for(const pulse of pulses){
    const t=travellers[pulse.voice];if(!t.enabled)continue;
    const age=now-pulse.time,colour=t.colour,fade=Math.exp(-age*.65);
    halo(ctx,pulse.position,(reducedMotion?18:14+age*12)/scale,colour,fade*.24);
    if(reducedMotion)continue;
    const bands=Array.from({length:4},()=>new Path2D()),used=[false,false,false,false];
    for(const segment of pulse.segments){
      const strength=Math.exp(-Math.pow((segment.distance-age*60)/24,2))*fade;
      if(strength<.035)continue;const bucket=Math.min(3,Math.floor(strength*4));used[bucket]=true;
      bands[bucket].moveTo(segment.a.x,segment.a.y);bands[bucket].lineTo(segment.b.x,segment.b.y);
    }
    ctx.strokeStyle=colour;ctx.shadowColor=colour;ctx.shadowBlur=dark?10:5;ctx.lineWidth=1.25/scale;
    for(let i=0;i<4;i++)if(used[i]){ctx.globalAlpha=(i+1)*.16;ctx.stroke(bands[i]);}ctx.shadowBlur=0;
  }
  const trailFade=playing?1:Math.max(0,1-(now-lastMotion)/4);
  for(const t of travellers){
    if(!t.walker)continue;const colour=t.colour,p=drag?.id===t.id?drag.position:t.position();
    if(t.enabled&&trailFade>0){
      const trails=Array.from({length:4},()=>new Path2D());
      for(let i=1;i<t.trail.length;i++){const band=Math.min(3,Math.floor(i/t.trail.length*4)),a=t.trail[i-1],b=t.trail[i];trails[band].moveTo(a.x,a.y);trails[band].lineTo(b.x,b.y);}
      ctx.strokeStyle=colour;ctx.lineWidth=1.3/scale;ctx.shadowColor=colour;ctx.shadowBlur=dark?7:3;
      for(let i=0;i<4;i++){ctx.globalAlpha=(i+1)*.12*trailFade;ctx.stroke(trails[i]);}ctx.shadowBlur=0;
    }
    const latest=pulses.filter(pulse=>pulse.voice===t.id).at(-1),bloom=latest?Math.exp(-(now-latest.time)*1.5):0;
    halo(ctx,p,(11+bloom*9)/scale,colour,t.enabled?.48:.1);ctx.globalAlpha=t.enabled?1:.25;
    ctx.fillStyle=colour;ctx.beginPath();ctx.arc(p.x,p.y,(2.8+bloom*.8)/scale,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=dark?'#fff5e5':'#fffdf4';ctx.globalAlpha=t.enabled?.9:.2;ctx.beginPath();ctx.arc(p.x,p.y,1.1/scale,0,Math.PI*2);ctx.fill();
    if(hover===t.id||drag?.id===t.id){ctx.globalAlpha=1;ctx.fillStyle=colour;ctx.font=`500 ${10/scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(t.id+1),p.x,p.y-14/scale);}
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
}
