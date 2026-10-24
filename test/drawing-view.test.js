import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DrawingView} from '../dist/drawing-view.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
function fixture(){const view=new DrawingView();view.setDrawing(300,960);view.resize(1000,600);return view;}

test('portrait drawing fits without changing the width of its viewport',()=>{
  const view=fixture(),top=view.toScreen(0,0),bottom=view.toScreen(300,960);
  near(top.y,24);near(bottom.y,576);near((top.x+bottom.x)/2,500);
  view.zoomAt(5);assert.equal(view.width,1000);
  assert.ok(view.toScreen(0,0).x<100);assert.ok(view.toScreen(300,960).x>900);
});
test('wheel zoom keeps the drawing point under the cursor and preserves hit coordinates',()=>{
  const view=fixture(),anchor=view.toDrawing(560,240);view.zoomAt(3,560,240);
  const screen=view.toScreen(anchor.x,anchor.y);near(screen.x,560);near(screen.y,240);
  view.panBy(84,-27);const moved=view.toDrawing(screen.x+84,screen.y-27);
  near(moved.x,anchor.x);near(moved.y,anchor.y);
});
test('resizing a zoomed viewport preserves its drawing center',()=>{
  const view=fixture();view.zoomAt(4,560,240);view.panBy(100,20);
  const center=view.toDrawing(500,300);view.resize(640,480);
  const next=view.toDrawing(320,240);near(next.x,center.x);near(next.y,center.y);
});
test('reset and a new drawing restore a centered fit',()=>{
  const view=fixture();view.zoomAt(100);assert.equal(view.zoom,6);view.panBy(200,-100);
  view.zoomAt(1);near(view.toScreen(150,480).x,500);near(view.toScreen(150,480).y,300);
  view.zoomAt(3);view.setDrawing(960,300);assert.equal(view.zoom,1);
  near(view.toScreen(480,150).x,500);near(view.toScreen(480,150).y,300);
});
