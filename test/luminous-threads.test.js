import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphFromSkeleton} from '../dist/geometry.js';
import {ThreadLights,drawThreads} from '../dist/luminous-threads.js';
function fixture(){
  const mask=new Uint8Array(81*81);for(let i=5;i<=75;i++){mask[40*81+i]=1;mask[i*81+40]=1;}for(let y=60;y<=75;y++)mask[y*81+5]=1;
  const graph=graphFromSkeleton(mask,81,81),node=graph.junctions[0];return{graph,node,edge:graph.edges[node.edges[0]]};
}
test('a note illuminates all connected branches, with distance measured along the ink',()=>{
  const {graph,node,edge}=fixture(),lights=new ThreadLights();lights.emit(graph,0,edge.id,node.id,0,10);
  const pulse=lights.live(10)[0];assert.deepEqual(pulse.position,{x:40,y:40});assert.ok(pulse.segments.length);
  assert.ok(pulse.segments.some(s=>s.a.x<40));assert.ok(pulse.segments.some(s=>s.a.x>40));assert.ok(pulse.segments.some(s=>s.a.y<40));assert.ok(pulse.segments.some(s=>s.a.y>40));
  assert.ok(pulse.segments.every(s=>s.a.x!==5||s.a.y===40),'Disconnected ink cannot light up');
  for(const s of pulse.segments){const x=(s.a.x+s.b.x)/2,y=(s.a.y+s.b.y)/2;assert.ok(Math.abs(s.distance-Math.hypot(x-40,y-40))<1e-8);}
});
test('reversed travel emits from the same physical note position',()=>{
  const {graph,edge}=fixture(),lights=new ThreadLights();lights.emit(graph,0,edge.id,edge.a,8,10);lights.emit(graph,1,edge.id,edge.b,edge.length-8,10);
  const [a,b]=lights.live(10);assert.deepEqual(a.position,b.position);assert.deepEqual(a.segments,b.segments);
});
test('light follows a long bend instead of crossing the empty space between its ends',()=>{
  const mask=new Uint8Array(81*81);for(let x=5;x<=55;x++){mask[10*81+x]=1;mask[60*81+x]=1;}for(let y=10;y<=60;y++)mask[y*81+55]=1;
  const graph=graphFromSkeleton(mask,81,81),edge=graph.edges[0],from=graph.nodes.find(n=>n.x===5&&n.y===10).id,lights=new ThreadLights();
  lights.emit(graph,0,edge.id,from,0,10);const far=lights.live(10)[0].segments.find(s=>s.b.y===60&&s.b.x<=10);
  assert.ok(far);assert.ok(far.distance>140);assert.ok(Math.hypot(far.b.x-5,far.b.y-10)<52);
});
test('visual events expire after silence and remain bounded during dense music',()=>{
  const {graph,node,edge}=fixture(),lights=new ThreadLights();for(let i=0;i<50;i++)lights.emit(graph,i%3,edge.id,node.id,0,10+i*.01);
  assert.equal(lights.live(11).length,16);lights.clear(1);assert.ok(lights.live(11).every(p=>p.voice!==1));assert.equal(lights.live(16).length,0);
});
test('reduced motion suppresses travelling light, and voice labels appear on interaction',()=>{
  const {graph,node,edge}=fixture(),lights=new ThreadLights();lights.emit(graph,0,edge.id,node.id,0,10);
  globalThis.Path2D=class{moveTo(){}lineTo(){}};
  let strokes=0,labels=0;const ctx={stroke(){strokes++;},beginPath(){},arc(){},fill(){},fillText(){labels++;},createRadialGradient(){return{addColorStop(){}};}};
  const traveller={id:0,enabled:true,walker:{},colour:'#efab83',trail:[],position:()=>({x:40,y:40})};
  const options={graph,path:{},travellers:[traveller],scale:1,now:10.2,pulses:lights.live(10.2),lastMotion:10,playing:true,hover:null,drag:null,palette:{green:'#b3c8ac'},dark:true,reducedMotion:true};
  drawThreads(ctx,options);const reduced=strokes;assert.equal(labels,0);strokes=0;
  drawThreads(ctx,{...options,reducedMotion:false,hover:0});assert.ok(strokes>reduced);assert.equal(labels,1);assert.equal(ctx.globalAlpha,1);assert.equal(ctx.shadowBlur,0);
});
