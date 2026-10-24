import {instrument} from './instruments.js?v=4';
import {bellDecay} from './music.js';
import {seededRandom} from './performance.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function notePlan(hz,ring,key,sequence=0,sampleRate=48000){
  const selected=instrument(key),profile=selected.continuous?instrument('bell'):selected,random=seededRandom(`${key}:${hz.toFixed(3)}:${sequence}`),variation=random();
  const tail=clamp(bellDecay(ring)*(profile.tail||1)*clamp((220/hz)**.16,.72,1.35),.35,22);
  const attack=Math.min((profile.attack||.03)*(.94+.12*variation),tail*.2),partials=[];
  for(let i=0;i<(profile.partials||[]).length;i++){
    const [ratio,level,decay]=profile.partials[i];
    // Piano string stiffness rises with harmonic number, keeping its root exact.
    const stiffness=(profile.stiffness||0)*clamp((hz/220)**.45,.55,1.8);
    const frequency=hz*ratio*Math.sqrt((1+stiffness*ratio*ratio)/(1+stiffness));
    // Drop out-of-band modes; clamping several modes to one frequency whistles.
    if(frequency>=sampleRate*.42)continue;
    const rolloff=clamp((sampleRate*.42-frequency)/(sampleRate*.1),0,1),end=Math.max(attack+.08,tail*decay);
    const register=profile.registerGain?clamp((hz/220)**profile.registerGain,.7,1.12):1;
    const upper=profile.upperDamping?clamp((220/hz)**(profile.upperDamping*Math.min(i,6)),.35,1.15):1;
    const touch=profile.modeAttack?1+(variation-.5)*.12*Math.min(i/3,1):1;
    const peak=level*(profile.gain||1)*(.94+.1*variation)*rolloff*register*upper*touch;
    const bodyTime=Math.max(attack+.025,end*(profile.body||.22)),bodyLevel=profile.bodyLevel||.18;
    const part={frequency,level:peak,end,bodyTime:Math.min(end-.025,bodyTime),bodyLevel,attack:attack*(1-(profile.modeAttack||0)*Math.min(i/3,1)),detune:0};
    const pair=profile.pairs?.find(pair=>pair.mode===i);
    if(pair&&frequency+pair.beatHz<sampleRate*.42){
      // Quiet unequal mode pairs ring without the complete cancellations of equal pairs.
      partials.push({...part,level:peak*(1-pair.mix)},{...part,frequency:frequency+pair.beatHz,level:peak*pair.mix,end:end*.97,bodyTime:Math.min(part.bodyTime,end*.97-.025)});
    }else if(profile.unison&&i<3){
      const refined=!!profile.stiffness;
      partials.push({...part,level:peak*(refined?.66:.7),detune:-profile.unison},{...part,level:peak*(refined?.34:.42),detune:profile.unison});
    }else partials.push(part);
  }
  return {profile,tail,attack,partials,variation,vibratoRate:4.8+(random()-.5)*.55,cutoff:clamp(hz*(profile.brightness||4),300,6000)};
}
export function toneCutoff(hz,brightness,age,tail,bend=0){
  const decay=.48+.52*Math.exp(-Math.max(0,age)/Math.max(.3,tail*.28));
  return clamp(hz*(brightness+bend*1.2)*decay,Math.min(6000,Math.max(90,hz*1.35)),6000);
}
export function limiterCurve(length=8193){
  const curve=new Float32Array(length);
  for(let i=0;i<length;i++){const x=i*2/(length-1)-1,a=Math.abs(x);curve[i]=a<=.72?x:Math.sign(x)*(.72+.26*(1-Math.exp(-(a-.72)/.26)));}
  return curve;
}
export function roomImpulse(sampleRate,seconds=3.8){
  return [0,1].map(ch=>{
    const data=new Float32Array(Math.ceil(sampleRate*seconds)),random=seededRandom(`quiet-room:${ch}`);let low=0;
    for(let i=0;i<data.length;i++){
      const t=i/sampleRate,cutoff=4200*Math.exp(-t*.75)+450,alpha=1-Math.exp(-2*Math.PI*cutoff/sampleRate);
      low+=alpha*((random()*2-1)-low);
      if(t>.027)data[i]=low*.006*Math.sqrt(48000/sampleRate)*Math.exp(-t*1.95)*Math.min(1,(t-.027)/.06);
    }
    for(const [time,gain]of [[.019,.18],[.033,.13],[.049,.10],[.067,.075],[.091,.055]]){
      const index=Math.round((time+ch*.0027)*sampleRate);data[index]+=(ch?.9:1)*gain;
    }
    return data;
  });
}
