const colourParts=colour=>{
  const hex=String(colour||'#527153').replace('#','');
  return [parseInt(hex.slice(0,2),16)||82,parseInt(hex.slice(2,4),16)||113,parseInt(hex.slice(4,6),16)||83];
};
function glow(ctx,p,radius,colour,alpha){
  const [r,g,b]=colourParts(colour),wash=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
  wash.addColorStop(0,`rgba(${r},${g},${b},${alpha})`);wash.addColorStop(.38,`rgba(${r},${g},${b},${alpha*.42})`);wash.addColorStop(1,`rgba(${r},${g},${b},0)`);
  ctx.fillStyle=wash;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
}
function base(ctx,path,scale,colour,alpha){
  if(!path)return;ctx.globalAlpha=alpha;ctx.strokeStyle=colour;ctx.lineWidth=.85/scale;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(path);ctx.globalAlpha=1;
}
function head(ctx,t,p,scale,fade=1){
  glow(ctx,p,18/scale,t.colour,.18*fade);ctx.globalAlpha=fade;ctx.fillStyle=t.colour;ctx.beginPath();ctx.arc(p.x,p.y,2.1/scale,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
function fading(now,lastMotion,playing){return playing?1:Math.max(0,1-(now-lastMotion)/4);}
function drawAfterimage(ctx,{travellers,scale,lastMotion,now,playing,drag}){
  const fade=fading(now,lastMotion,playing);
  for(const t of travellers){
    if(!t.walker)continue;const points=t.trail,p=drag?.id===t.id?drag.position:t.position();
    if(t.enabled&&fade&&points.length>1){
      const bands=Array.from({length:4},()=>new Path2D()),used=[false,false,false,false];
      for(let i=1;i<points.length;i++){const band=Math.min(3,Math.floor(i/points.length*4));bands[band].moveTo(points[i-1].x,points[i-1].y);bands[band].lineTo(points[i].x,points[i].y);used[band]=true;}
      ctx.strokeStyle=t.colour;ctx.lineWidth=1.8/scale;ctx.shadowColor=t.colour;ctx.shadowBlur=5/scale;
      for(let i=0;i<4;i++)if(used[i]){ctx.globalAlpha=fade*(i+1)*.12;ctx.stroke(bands[i]);}ctx.shadowBlur=0;
    }
    head(ctx,t,p,scale,t.enabled?1:.28);
  }
}
function drawHalos(ctx,{travellers,pulses,scale,now,reducedMotion}){
  for(const pulse of pulses){
    const t=travellers[pulse.voice];if(!t?.enabled)continue;const age=Math.max(0,now-pulse.time),fade=Math.exp(-age*.72),p=pulse.position;
    glow(ctx,p,(reducedMotion?34:28+age*34)/scale,t.colour,fade*.24);
    ctx.strokeStyle=t.colour;ctx.lineWidth=1/scale;ctx.globalAlpha=fade*.36;ctx.beginPath();
    for(let ring=0;ring<3;ring++){
      const radius=(reducedMotion?10+ring*11:age*30+ring*15)/scale;
      if(reducedMotion&&ring>0&&age>.9)continue;
      ctx.moveTo(p.x+radius,p.y);ctx.arc(p.x,p.y,radius,0,Math.PI*2);
    }
    ctx.stroke();ctx.globalAlpha=1;
  }
}
function drawWaves(ctx,{travellers,pulses,scale,now,reducedMotion}){
  for(const pulse of pulses){
    const t=travellers[pulse.voice];if(!t?.enabled)continue;const age=Math.max(0,now-pulse.time),front=reducedMotion?0:age*58,fade=Math.exp(-age*.4),bands=Array.from({length:4},()=>new Path2D()),used=[false,false,false,false];
    for(const segment of pulse.segments){
      const strength=Math.exp(-Math.pow((segment.distance-front)/(reducedMotion?24:16),2))*fade;if(strength<.035)continue;
      const band=Math.min(3,Math.floor(strength*4));bands[band].moveTo(segment.a.x,segment.a.y);bands[band].lineTo(segment.b.x,segment.b.y);used[band]=true;
    }
    ctx.strokeStyle=t.colour;ctx.lineCap='round';ctx.lineWidth=1.45/scale;ctx.shadowColor=t.colour;ctx.shadowBlur=7/scale;
    for(let i=0;i<4;i++)if(used[i]){ctx.globalAlpha=(i+1)*.17;ctx.stroke(bands[i]);}ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
}
function drawDew(ctx,{travellers,scale,lastMotion,now,playing,drag,reducedMotion}){
  const fade=fading(now,lastMotion,playing);
  for(const t of travellers){
    if(!t.walker)continue;const points=t.trail,p=drag?.id===t.id?drag.position:t.position(),alpha=(t.enabled?1:.25)*fade;
    if(t.enabled&&points.length>1){
      ctx.strokeStyle=t.colour;ctx.lineWidth=.65/scale;ctx.globalAlpha=.12*alpha;ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();
      for(let base=5;base<points.length-1;base+=10){const at=Math.min(points.length-1,base+(reducedMotion?0:(now*3)%10)),i=Math.floor(at),mix=at-i,a=points[i],b=points[Math.min(i+1,points.length-1)],q={x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix},size=(1+Math.sin(base*.37+now*1.2)*.25)/scale;glow(ctx,q,5/scale,t.colour,.17*alpha);ctx.globalAlpha=.62*alpha;ctx.fillStyle=t.colour;ctx.beginPath();ctx.arc(q.x,q.y,size,0,Math.PI*2);ctx.fill();}
    }
    head(ctx,t,p,scale,alpha);
  }
}
function drawMist(ctx,{travellers,pulses,scale,now,lastMotion,playing,drag}){
  const fade=fading(now,lastMotion,playing);
  for(const t of travellers){
    if(!t.walker)continue;const points=t.trail,p=drag?.id===t.id?drag.position:t.position(),alpha=(t.enabled?1:.25)*fade;
    if(t.enabled&&points.length>1){
      ctx.beginPath();points.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle=t.colour;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.globalAlpha=.11*alpha;ctx.lineWidth=13/scale;ctx.shadowColor=t.colour;ctx.shadowBlur=20/scale;ctx.stroke();
      ctx.globalAlpha=.22*alpha;ctx.lineWidth=2/scale;ctx.shadowBlur=8/scale;ctx.stroke();ctx.shadowBlur=0;
    }
    glow(ctx,p,34/scale,t.colour,.16*alpha);
  }
  for(const pulse of pulses){const t=travellers[pulse.voice];if(!t?.enabled)continue;const age=Math.max(0,now-pulse.time);glow(ctx,pulse.position,(30+age*20)/scale,t.colour,Math.exp(-age*.48)*.22);}
  ctx.globalAlpha=1;ctx.shadowBlur=0;
}
function drawDewNodes(ctx,{graph,scale,now,colour,reducedMotion}){
  for(const node of graph.junctions){const pulse=reducedMotion ? .82 : .65+.35*Math.sin(now*1.5+node.id);ctx.globalAlpha=.2*pulse;ctx.fillStyle=colour;ctx.beginPath();ctx.arc(node.x,node.y,2/scale,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
}

export function drawAmbient(ctx,{mode,graph,path,travellers,scale,now,pulses,lastMotion,playing,hover,drag,palette,reducedMotion}){
  if(!graph)return;
  base(ctx,path,scale,palette.green,mode==='dew'?.12:.09);
  if(mode==='afterimage')drawAfterimage(ctx,{travellers,scale,lastMotion,now,playing,drag});
  else if(mode==='halos')drawHalos(ctx,{travellers,pulses,scale,now,reducedMotion});
  else if(mode==='waves')drawWaves(ctx,{travellers,pulses,scale,now,reducedMotion});
  else if(mode==='dew'){drawDew(ctx,{travellers,scale,lastMotion,now,playing,drag,reducedMotion});drawDewNodes(ctx,{graph,scale,now,colour:palette.green,reducedMotion});}
  else if(mode==='mist')drawMist(ctx,{travellers,pulses,scale,now,lastMotion,playing,drag});
  if(hover!==null){const t=travellers[hover],p=t&&t.position();if(p){ctx.globalAlpha=1;ctx.fillStyle=t.colour;ctx.font=`500 ${10/scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(String(hover+1),p.x,p.y-14/scale);}}
  ctx.globalAlpha=1;ctx.shadowBlur=0;
}
