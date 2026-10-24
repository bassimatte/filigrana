import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,matchingPreset} from '../dist/presets.js';
import {INSTRUMENTS} from '../dist/instruments.js';
import {validateComposition} from '../dist/composition.js';
const voicesFor=p=>p.keys.map((instrument,i)=>({instrument,octave:p.octaves[i],speed:p.speeds[i],spacing:p.spacing[i],volume:p.volumes[i],pan:(i-1)*.4,scale:'pentatonic'}));
const controlsFor=p=>({room:p.room,ring:p.ring,pace:p.pace,gap:p.gap});
test('all presets form valid, distinct trios using every new instrument',()=>{
  assert.equal(Object.keys(PRESETS).length,10);const heard=new Set();
  for(const [key,p]of Object.entries(PRESETS)){
    const voices=voicesFor(p);assert.equal(new Set(p.keys).size,3);assert.equal(matchingPreset(voices,controlsFor(p)),key);
    for(const v of voices){assert.ok(Object.hasOwn(INSTRUMENTS,v.instrument));heard.add(v.instrument);assert.ok(v.volume>0&&v.volume<=1);assert.ok(v.spacing>=.8&&v.spacing<=12);assert.ok(v.speed>=10&&v.speed<=240);}
  }
  for(const key of ['glass','handpan','bassclarinet','vibraphone'])assert.ok(heard.has(key));
});
test('preset matching ignores origin, mute, routing, and output while detecting custom voices',()=>{
  const p=PRESETS.glassgarden,voices=voicesFor(p),controls=controlsFor(p);
  voices[0].enabled=false;voices[0].origin={edgeId:42,distance:13};controls.branch='random';controls.interaction='independent';controls.volume=12;
  assert.equal(matchingPreset(voices,controls),'glassgarden');voices[1].instrument='piano';assert.equal(matchingPreset(voices,controls),'custom');
});
test('compositions retain all new instruments without changing their format',()=>{
  for(const key of ['glass','handpan','bassclarinet','vibraphone']){
    const voices=voicesFor(PRESETS.floating);voices[0].instrument=key;
    const score=validateComposition({format:'line-resonator',version:1,image:{src:'data:image/jpeg;base64,/9j/AA=='},controls:{interaction:'independent',branch:'random'},travellers:voices});
    assert.equal(score.travellers[0].instrument,key);assert.deepEqual(validateComposition(JSON.parse(JSON.stringify(score))),score);
  }
});
