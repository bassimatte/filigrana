import {test} from 'node:test';
import assert from 'node:assert/strict';
import {thin,graphFromSkeleton,pointOnEdge,resonance,chooseEdge,inkMask} from '../dist/geometry.js';
const size=61;
function raster(paths){const m=new Uint8Array(size*size);for(const path of paths)for(const [x,y]of path)m[y*size+x]=1;return m;}
const horizontal=(x0,x1,y)=>Array.from({length:x1-x0+1},(_,i)=>[x0+i,y]);
const vertical=(x,y0,y1)=>Array.from({length:y1-y0+1},(_,i)=>[x,y0+i]);
test('a cross has one four-way junction and four measurable segments',()=>{
  const g=graphFromSkeleton(raster([horizontal(5,55,30),vertical(30,5,55)]),size,size);
  assert.equal(g.junctions.length,1);assert.equal(g.edges.length,4);assert.equal(g.activeNodes.length,5);
  assert.equal(g.junctions[0].edges.length,4);for(const e of g.edges)assert.equal(e.length,25);
});
test('a bend stays a single line, without diagonal shortcut or false junction',()=>{
  const g=graphFromSkeleton(raster([horizontal(5,30,30),vertical(30,30,55)]),size,size);
  assert.equal(g.edges.length,1);assert.equal(g.junctions.length,0);assert.equal(g.edges[0].length,50);
  assert.deepEqual(pointOnEdge(g.edges[0],25),{x:30,y:30});
});
test('a closed contour forms a traversable self-loop',()=>{
  const g=graphFromSkeleton(raster([horizontal(10,50,10),horizontal(10,50,50),vertical(10,10,50),vertical(50,10,50)]),size,size);
  assert.equal(g.edges.length,1);assert.equal(g.edges[0].a,g.edges[0].b);assert.equal(g.edges[0].length,160);
  assert.equal(chooseEdge(g,g.edges[0].a,0,'explore',null),0);
});
test('separate ink islands stay disconnected; tiny specks are removed',()=>{
  const g=graphFromSkeleton(raster([horizontal(5,55,10),horizontal(5,55,40),[[30,25]]]),size,size);
  assert.equal(g.components,2);assert.equal(g.edges.length,2);
  for(const e of g.edges)assert.equal(chooseEdge(g,e.b,e.id,'random',null),e.id);
});
test('flow goes straight at a cross; exploration prefers unvisited branches',()=>{
  const g=graphFromSkeleton(raster([horizontal(5,55,30),vertical(30,5,55)]),size,size);
  const j=g.junctions[0],left=g.edges.find(e=>e.points.some(p=>p.x===5)),right=g.edges.find(e=>e.points.some(p=>p.x===55));
  assert.equal(chooseEdge(g,j.id,left.id,'flow',{x:1,y:0}),right.id);
  right.visits=10;
  assert.notEqual(chooseEdge(g,j.id,left.id,'explore',{x:1,y:0}),right.id);
});
test('doubling line length halves resonance; resizing the full image preserves tuning',()=>{
  const g={w:600,h:800};assert.equal(resonance({length:120},g,220),220);
  assert.equal(resonance({length:240},g,220),110);
  assert.equal(resonance({length:240},{w:1200,h:1600},220),220);
  assert.equal(resonance({length:1},g,660),5000);
});
test('thick strokes thin to a connected traversable line',()=>{
  const paths=[];for(let y=28;y<=32;y++)paths.push(horizontal(5,55,y));
  const g=graphFromSkeleton(thin(raster(paths),size,size),size,size);
  assert.equal(g.edges.length,1);assert.ok(g.edges[0].length>=40);assert.equal(g.junctions.length,0);
});
test('adaptive extraction finds dark ink under a lighting gradient',()=>{
  const rgba=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,brightness=170+x;rgba[i]=rgba[i+1]=rgba[i+2]=(y>=29&&y<=31&&x>=5&&x<=55)?25:brightness;rgba[i+3]=255;}
  const g=graphFromSkeleton(thin(inkMask(rgba,size,size),size,size),size,size);
  assert.equal(g.edges.length,1);assert.ok(g.edges[0].length>40);
});
