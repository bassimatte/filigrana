import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notePlan,toneCutoff,limiterCurve,roomImpulse} from '../dist/synthesis.js';
import {INSTRUMENTS} from '../dist/instruments.js';
test('all voices retain ordered attack, body, and release stages across registers',()=>{
  for(const [key,profile]of Object.entries(INSTRUMENTS)){if(profile.continuous)continue;
    for(const hz of [65.4,220,880,3136])for(const ring of [3,42,65]){
      const plan=notePlan(hz,ring,key,0,22050);assert.ok(plan.partials.length>0);
      for(const p of plan.partials){assert.ok(p.frequency<22050*.42);assert.ok(p.level>0);assert.ok(plan.attack<p.bodyTime&&p.bodyTime<p.end&&p.end<=plan.tail+.001);}
    }
  }
});
test('high modes are removed rather than collapsed into a single high-frequency whistle',()=>{
  const plan=notePlan(3136,42,'marimba',0,22050);
  assert.ok(plan.partials.every(p=>p.frequency<22050*.42));assert.equal(plan.partials.length,1);
});
test('sustained instruments have a fuller body than plucked instruments',()=>{
  for(const key of ['flute','strings']){const p=notePlan(220,42,key);assert.ok(p.partials[0].bodyLevel>.65);assert.ok(p.partials[0].bodyTime>p.tail*.4);}
  for(const key of ['piano','harp','kalimba','marimba'])assert.ok(notePlan(220,42,key).partials[0].bodyLevel<.25);
});
test('note variation is reproducible, bounded, and does not shift nominal modal frequencies',()=>{
  const a=notePlan(220,42,'piano',3),b=notePlan(220,42,'piano',3),c=notePlan(220,42,'piano',4);
  assert.deepEqual(a,b);assert.notEqual(a.attack,c.attack);assert.deepEqual(a.partials.map(p=>p.frequency),c.partials.map(p=>p.frequency));
  assert.ok(Math.abs(a.attack-c.attack)<.004);assert.ok(a.partials.every(p=>Math.abs(p.detune)<=3.2));
});
test('ringing notes darken with age while curvature adds a small expressive lift',()=>{
  assert.ok(toneCutoff(220,6,5,9)<toneCutoff(220,6,0,9));assert.ok(toneCutoff(220,6,1,9,.5)>toneCutoff(220,6,1,9,0));
});
test('headroom curve preserves quiet dynamics and zero exactly; peaks stay bounded',()=>{
  const c=limiterCurve();assert.equal(c[(c.length-1)/2],0);
  const i=Math.round((.25+1)/2*(c.length-1));assert.ok(Math.abs(c[i]-.25)<1e-6);
  assert.ok(c.at(-1)<1);for(let i=1;i<c.length;i++)assert.ok(c[i]>=c[i-1]);
});
test('room reflections are stereo, deterministic, pre-delayed, and decay to silence',()=>{
  const [left,right]=roomImpulse(8000),again=roomImpulse(8000);
  assert.deepEqual(left,again[0]);assert.notDeepEqual(left,right);
  assert.ok(left.subarray(0,140).every(v=>v===0));
  const energy=data=>data.reduce((sum,v)=>sum+v*v,0);
  assert.ok(energy(left.subarray(0,8000))>energy(left.subarray(16000)));assert.ok(left.every(Number.isFinite));
});
