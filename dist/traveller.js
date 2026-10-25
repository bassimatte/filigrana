import {pointOnEdge,chooseEdge} from './geometry.js';
import {BellPhrasing} from './music.js';
import {seededRandom} from './performance.js';
export const COLOURS=['#d95f36','#337b9a','#91649e'];
export class Traveller {
  constructor(id){this.id=id;this.colour=COLOURS[id];this.enabled=true;this.octave=0;this.scale='pentatonic';this.instrument='bell';this.speed=28;this.spacing=2.8;this.volume=.8;this.ring=42;this.pan=(id-1)*.35;this.seed='ink-01';this.phrasing=new BellPhrasing();this.setGraph(null);}
  setGraph(graph){this.graph=graph;this.visits=new Uint32Array(graph?.edges.length||0);this.walker=null;this.origin=null;this.clearPhrase();}
  clearPhrase(){this.phrasing.reset();this.heardPitch=null;this.pulse=0;this.trail=[];this.strikes=0;}
  start(edgeId,from,distance=0){
    const edge=this.graph.edges[edgeId];
    this.walker={edge:edgeId,from,reverse:edge.b===from&&edge.a!==from,distance:Math.max(0,Math.min(distance,edge.length))};
    this.visits[edgeId]++;
  }
  place(edgeId,from,distance=0){this.origin={edgeId,from,distance};this.restart();}
  restart(){if(!this.origin)return;this.random=seededRandom(`${this.seed}:${this.id}`);this.visits.fill(0);this.clearPhrase();this.start(this.origin.edgeId,this.origin.from,this.origin.distance);}
  position(){if(!this.walker)return null;const e=this.graph.edges[this.walker.edge];return pointOnEdge(e,this.walker.reverse?e.length-this.walker.distance:this.walker.distance);}
  advance(dt,speed,mode,onEdge=()=>{}){
    this.pulse=Math.max(0,this.pulse-dt*.8);
    if(!this.enabled||!this.walker)return;
    let remaining=speed*dt;
    while(remaining>0&&this.walker){
      const e=this.graph.edges[this.walker.edge],step=Math.min(remaining,e.length-this.walker.distance);
      this.walker.distance+=step;remaining-=step;this.trail.push(this.position());if(this.trail.length>150)this.trail.shift();
      if(this.walker.distance>=e.length-1e-6){
        const target=this.walker.reverse?e.a:e.b,back=pointOnEdge(e,this.walker.reverse?Math.min(8,e.length):Math.max(0,e.length-8));
        const end=pointOnEdge(e,this.walker.reverse?0:e.length),dx=end.x-back.x,dy=end.y-back.y,mag=Math.hypot(dx,dy)||1;
        const next=chooseEdge(this.graph,target,e.id,mode,{x:dx/mag,y:dy/mag},this.random||Math.random,this.visits);
        if(next===null){this.walker=null;return;}
        this.start(next,target);onEdge(this,{nodeId:target,edgeId:next});
      }
    }
  }
}

export function defaultStarts(graph,count=3){
  const visited=new Set();let largest=[],largestLength=0;
  for(const n of graph.activeNodes){
    if(visited.has(n.id))continue;const component=[n];visited.add(n.id);let length=0;
    for(let k=0;k<component.length;k++)for(const id of component[k].edges){
      const e=graph.edges[id];length+=e.length;const other=graph.nodes[e.a===component[k].id?e.b:e.a];
      if(!visited.has(other.id)){visited.add(other.id);component.push(other);}
    }
    if(length>largestLength){largestLength=length;largest=component;}
  }
  if(!largest.length)return [];
  if(largest.length<count){
    const edge=graph.edges[largest[0].edges[0]];
    return Array.from({length:count},(_,i)=>({edgeId:edge.id,from:edge.a,distance:edge.length*(i+.5)/count}));
  }
  const junctions=largest.filter(n=>n.edges.length>=3),candidates=junctions.length>=count?junctions:largest,used=new Set();
  const minY=Math.min(...candidates.map(n=>n.y)),maxY=Math.max(...candidates.map(n=>n.y));
  return Array.from({length:count},(_,i)=>{
    const y=minY+(maxY-minY)*(i+.5)/count;
    const node=candidates.filter(n=>!used.has(n.id)).sort((a,b)=>Math.hypot(a.x-graph.w/2,a.y-y)-Math.hypot(b.x-graph.w/2,b.y-y))[0];used.add(node.id);
    return {edgeId:node.edges.slice().sort((a,b)=>graph.edges[b].length-graph.edges[a].length)[0],from:node.id,distance:0};
  });
}
