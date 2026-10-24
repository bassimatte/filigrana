import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Resonator} from '../dist/audio.js';
import {INSTRUMENTS,delaySettings} from '../dist/instruments.js';
// Verify independent channel gating and voice ownership, which a topology
// test cannot catch. Browser QA separately checks the rendered output.
const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
function node(){return {gain:param(),frequency:param(),detune:param(),Q:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){},stop(){}};}
function engine(){const a=new Resonator();a.ctx={currentTime:0,sampleRate:48000,createGain:node,createBiquadFilter:node,createStereoPanner:node,createOscillator:node,createBufferSource:node};a.noise={buffer:{}};a.bells=node();a.master=node();a.channels=Array.from({length:3},()=>({lastStrike:-Infinity,excite:node(),currentVoice:null}));a.voices=[];return a;}
test('three simultaneous strikes all sound; each traveller enforces its own spacing',()=>{
  const a=engine();for(let i=0;i<3;i++)assert.equal(a.strike(220*2**(i-1),42,0,0,i),true);
  assert.equal(a.voices.length,3);assert.deepEqual(a.voices.map(v=>v.hz),[110,220,440]);
  for(let i=0;i<3;i++)assert.equal(a.strike(220,42,0,0,i),false);
  a.ctx.currentTime=.8;for(let i=0;i<3;i++)assert.equal(a.strike(220,42,0,0,i),true);
});
test('polyphony and muting are owned by each traveller',()=>{
  const a=engine();for(let time=0;time<5;time++){a.ctx.currentTime=time;for(let i=0;i<3;i++)a.strike(220,42,0,0,i);}
  for(let i=0;i<3;i++)assert.equal(a.voices.filter(v=>v.travellerId===i&&!v.released).length,4);
  a.silenceChannel(1);assert.equal(a.channels[1].currentVoice,null);
  assert.equal(a.voices.filter(v=>v.travellerId===1&&!v.released).length,0);
  assert.equal(a.voices.filter(v=>v.travellerId===0&&!v.released).length,4);
  assert.equal(a.voices.filter(v=>v.travellerId===2&&!v.released).length,4);
});
test('all note instruments create playable, releasable voices, including breath and vibrato',()=>{
  const a=engine();let time=0;
  for(const [key,profile] of Object.entries(INSTRUMENTS)){
    if(profile.continuous)continue;a.ctx.currentTime=time++;
    assert.equal(a.strike(220,42,0,.3,0,key),true);const v=a.channels[0].currentVoice;
    assert.equal(v.instrument,key);assert.ok(v.oscillators.length>=3);assert.ok(v.oscillators.every(o=>Number.isFinite(o.frequency.value)));
    if(profile.vibrato||profile.breath||profile.tremolo)assert.ok(v.modulators.length>0);
    a.colour(.5,0);a.releaseVoice(v);assert.equal(v.released,true);
  }
});
test('delay feedback is bounded and bypass stops the send as well as the wet return',()=>{
  assert.deepEqual(delaySettings(.65,.18,.28),{time:.65,mix:.18,feedback:.28,send:1});
  assert.deepEqual(delaySettings(.65,.18,.28,false),{time:.65,mix:0,feedback:0,send:0});
  const s=delaySettings(100,100,100);assert.ok(s.time<=2&&s.mix<=.5&&s.feedback<=.65);
  const invalid=delaySettings(NaN,NaN,NaN);assert.ok(Object.values(invalid).every(Number.isFinite));
});
