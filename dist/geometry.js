// Pixels -> single-pixel ink -> a graph of junctions and measured polylines.
// Coordinates and arc lengths use the analysis image's pixel grid.
export function inkMask(rgba, w, h, sensitivity = 55) {
  const gray = new Float32Array(w*h), integral = new Float64Array((w+1)*(h+1));
  for (let i=0;i<w*h;i++) gray[i]=.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2];
  for(let y=1;y<=h;y++) { let sum=0; for(let x=1;x<=w;x++) {sum+=gray[(y-1)*w+x-1];integral[y*(w+1)+x]=integral[(y-1)*(w+1)+x]+sum;} }
  const mask = new Uint8Array(w*h), radius=15, threshold=5+(100-sensitivity)*.32;
  for(let y=2;y<h-2;y++) for(let x=2;x<w-2;x++) {
    const x0=Math.max(0,x-radius),x1=Math.min(w,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(h,y+radius+1);
    const avg=(integral[y1*(w+1)+x1]-integral[y0*(w+1)+x1]-integral[y1*(w+1)+x0]+integral[y0*(w+1)+x0])/((x1-x0)*(y1-y0));
    const p=y*w+x;
    if(rgba[p*4+3]>128 && gray[p]<avg-threshold) mask[p]=1;
  }
  return mask;
}

export function thin(input,w,h) {
  const m=new Uint8Array(input), remove=[];
  let changed=true, iterations=0;
  while(changed && iterations++<150) {
    changed=false;
    for(let pass=0;pass<2;pass++) {
      remove.length=0;
      for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {
        const i=y*w+x;if(!m[i])continue;
        const p=[m[i-w],m[i-w+1],m[i+1],m[i+w+1],m[i+w],m[i+w-1],m[i-1],m[i-w-1]];
        const n=p.reduce((a,b)=>a+b,0);if(n<2||n>6)continue;
        let transitions=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])transitions++;
        if(transitions!==1)continue;
        if(pass===0 ? (p[0]*p[2]*p[4] || p[2]*p[4]*p[6]) : (p[0]*p[2]*p[6] || p[0]*p[4]*p[6]))continue;
        remove.push(i);
      }
      if(remove.length)changed=true;for(const i of remove)m[i]=0;
    }
  }
  return m;
}

export function graphFromSkeleton(mask,w,h,minComponent=22) {
  // Suppress a diagonal neighbour if an orthogonal pixel already connects it.
  // This avoids creating false triangles around right-angled turns.
  function neighbours(i) {
    const x=i%w,y=Math.floor(i/w), out=[];
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
      const j=i+dy*w+dx;if(!mask[j])continue;
      if(dx&&dy&&(mask[i+dx]||mask[i+dy*w]))continue;
      out.push(j);
    }
    return out;
  }
  const adjacency=new Map();for(let i=0;i<mask.length;i++)if(mask[i])adjacency.set(i,neighbours(i));
  const seen=new Set(),components=[];
  for(const start of adjacency.keys()) {
    if(seen.has(start))continue;const component=[],queue=[start];seen.add(start);
    for(let k=0;k<queue.length;k++){const p=queue[k];component.push(p);for(const n of adjacency.get(p))if(!seen.has(n)){seen.add(n);queue.push(n);}}
    if(component.length>=minComponent)components.push(component);else for(const p of component)adjacency.delete(p);
  }
  const nodes=[],nodeAt=new Map();
  function makeNode(pixels) {
    const id=nodes.length;let x=0,y=0;for(const p of pixels){nodeAt.set(p,id);x+=p%w;y+=Math.floor(p/w);}
    nodes.push({id,x:x/pixels.length,y:y/pixels.length,pixels,edges:[]});
  }
  // Consolidate clusters of branching pixels, keeping endpoints distinct.
  for(const [p,ns] of adjacency) {
    if(ns.length===2||nodeAt.has(p))continue;
    if(ns.length<=1){makeNode([p]);continue;}
    const cluster=[p],claimed=new Set([p]);
    for(let k=0;k<cluster.length;k++)for(const n of adjacency.get(cluster[k]))if(adjacency.get(n)?.length>2&&!nodeAt.has(n)&&!claimed.has(n)){claimed.add(n);cluster.push(n);}
    makeNode(cluster);
  }
  // A closed ring has no junctions: add an anchor so it is still traversable.
  for(const c of components)if(!c.some(p=>nodeAt.has(p)))makeNode([c[0]]);
  const used=new Set(),edges=[];
  const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  for(const node of nodes)for(const start of node.pixels)for(const next of adjacency.get(start)||[]) {
    if(nodeAt.get(next)===node.id||used.has(key(start,next)))continue;
    const pixels=[start];let prev=start,current=next,end;
    used.add(key(prev,current));
    for(let guard=0;guard<mask.length;guard++) {
      pixels.push(current);
      if(nodeAt.has(current)){end=nodeAt.get(current);break;}
      const ns=adjacency.get(current)||[],n=ns.find(p=>p!==prev);if(n===undefined)break;
      used.add(key(current,n));prev=current;current=n;
    }
    if(end===undefined)continue;
    const points=pixels.map(p=>({x:p%w,y:Math.floor(p/w)}));
    // Include the shared cluster centre for visually continuous joins.
    points.unshift({x:node.x,y:node.y});points.push({x:nodes[end].x,y:nodes[end].y});
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    const length=lengths.at(-1);if(length<2)continue;
    const edge={id:edges.length,a:node.id,b:end,points,lengths,length,visits:0};edges.push(edge);node.edges.push(edge.id);if(end!==node.id)nodes[end].edges.push(edge.id);
  }
  const activeNodes=nodes.filter(n=>n.edges.length);
  return {w,h,nodes,activeNodes,edges,components:components.length,junctions:activeNodes.filter(n=>n.edges.length>=3)};
}

export function pointOnEdge(edge,distance) {
  const d=Math.max(0,Math.min(edge.length,distance));let lo=1,hi=edge.lengths.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(edge.lengths[mid]<d)lo=mid+1;else hi=mid;}
  const p=edge.points[lo-1],q=edge.points[lo],span=edge.lengths[lo]-edge.lengths[lo-1],t=span?(d-edge.lengths[lo-1])/span:0;
  return {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};
}

export function resonance(edge,graph,reference) {
  // 12% of the image diagonal is the reference string length.
  return Math.max(40,Math.min(5000,reference*.12*Math.hypot(graph.w,graph.h)/Math.max(1,edge.length)));
}

export function chooseEdge(graph,nodeId,previousId,mode,incoming,rng=Math.random,visits=null) {
  const node=graph.nodes[nodeId];let choices=node.edges.filter(id=>id!==previousId);
  if(!choices.length)choices=node.edges.slice();if(!choices.length)return null;
  const score=id=>{
    const e=graph.edges[id],reverse=e.b===nodeId;
    const near=pointOnEdge(e,reverse?Math.max(0,e.length-8):Math.min(8,e.length));
    const dx=near.x-node.x,dy=near.y-node.y,mag=Math.hypot(dx,dy)||1;
    return incoming?(dx*incoming.x+dy*incoming.y)/mag:0;
  };
  if(mode==='random')return choices[Math.floor(rng()*choices.length)];
  choices.sort((a,b)=>mode==='explore' ? (visits?visits[a]-visits[b]:graph.edges[a].visits-graph.edges[b].visits)||score(b)-score(a) : score(b)-score(a));
  return choices[0];
}
