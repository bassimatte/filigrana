import {delaySettings} from './instruments.js?v=6';
import {notePlan,toneCutoff,limiterCurve,roomImpulse} from './synthesis.js?v=6';
export class Resonator {
  async init(context=null) {
    if(this.ctx){if(!this.ctx.startRendering)await this.ctx.resume();return;}
    const Context=context?null:(window.AudioContext||window.webkitAudioContext);if(!context&&!Context)throw new Error('This browser does not support Web Audio.');
    const c=this.ctx=context||new Context();
    const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.noise=c.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;
    this.sum=c.createGain();this.sum.gain.value=20;
    this.channels=Array.from({length:3},()=>{
      const excite=c.createGain();excite.gain.value=0;this.noise.connect(excite);
      const level=c.createGain(),pan=c.createStereoPanner(),noteLevel=c.createGain(),notePan=c.createStereoPanner();
      level.connect(pan);pan.connect(this.sum);noteLevel.connect(notePan);
      const filters=[1,2.01,3.98].map((ratio,i)=>{
        const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=220*ratio;filter.Q.value=24;
        const g=c.createGain();g.gain.value=[1,.36,.13][i];excite.connect(filter);filter.connect(g);g.connect(level);return {filter,ratio};
      });return {excite,filters,level,pan,noteLevel,notePan,lastStrike:-Infinity,currentVoice:null};
    });
    this.bells=c.createGain();this.bells.gain.value=.65;this.voices=[];
    for(const channel of this.channels)channel.notePan.connect(this.bells);
    const highpass=c.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=28;
    this.effectInput=c.createGain();this.sum.connect(this.effectInput);this.bells.connect(this.effectInput);this.effectInput.connect(highpass);
    // Early reflections place the sound; a damped diffuse tail supplies space.
    const impulses=roomImpulse(c.sampleRate);this.room=c.createConvolver();const ir=c.createBuffer(2,impulses[0].length,c.sampleRate);
    for(let ch=0;ch<2;ch++)ir.copyToChannel(impulses[ch],ch);
    const roomHighpass=c.createBiquadFilter();roomHighpass.type='highpass';roomHighpass.frequency.value=180;
    const roomLowpass=c.createBiquadFilter();roomLowpass.type='lowpass';roomLowpass.frequency.value=4600;roomLowpass.Q.value=.5;
    this.room.buffer=ir;this.wet=c.createGain();this.wet.gain.value=.22;this.effectInput.connect(roomHighpass);roomHighpass.connect(this.room);this.room.connect(roomLowpass);roomLowpass.connect(this.wet);this.wet.connect(highpass);
    this.delay=c.createDelay(2);this.delay.delayTime.value=.65;
    this.delaySend=c.createGain();this.delaySend.gain.value=1;
    this.delayDamping=c.createBiquadFilter();this.delayDamping.type='lowpass';this.delayDamping.frequency.value=2400;this.delayDamping.Q.value=.5;
    this.delayFeedback=c.createGain();this.delayFeedback.gain.value=.28;
    const feedbackHighpass=c.createBiquadFilter();feedbackHighpass.type='highpass';feedbackHighpass.frequency.value=150;feedbackHighpass.Q.value=.5;
    this.delayWet=c.createGain();this.delayWet.gain.value=.18;
    this.effectInput.connect(this.delaySend);this.delaySend.connect(this.delay);this.delay.connect(this.delayDamping);
    this.delayDamping.connect(feedbackHighpass);feedbackHighpass.connect(this.delayFeedback);this.delayFeedback.connect(this.delay);this.delayDamping.connect(this.delayWet);this.delayWet.connect(highpass);
    this.mix=c.createGain();this.mix.gain.value=1/Math.sqrt(3);highpass.connect(this.mix);
    const warmth=c.createBiquadFilter();warmth.type='lowshelf';warmth.frequency.value=180;warmth.gain.value=1;
    const presence=c.createBiquadFilter();presence.type='peaking';presence.frequency.value=2800;presence.Q.value=.65;presence.gain.value=-1.5;
    const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=2;comp.attack.value=.025;comp.release.value=.45;this.mix.connect(warmth);warmth.connect(presence);presence.connect(comp);
    const limiter=c.createWaveShaper();limiter.curve=limiterCurve();limiter.oversample='2x';comp.connect(limiter);
    this.master=c.createGain();this.master.gain.value=0;limiter.connect(this.master);
    this.analyser=c.createAnalyser();this.analyser.fftSize=1024;this.master.connect(this.analyser);this.analyser.connect(c.destination);
    this.recordDestination=c.createMediaStreamDestination?c.createMediaStreamDestination():null;if(this.recordDestination)this.master.connect(this.recordDestination);
    this.noise.start();if(!c.startRendering)await c.resume();
  }
  setVolume(value,playing=true) {if(this.ctx)this.master.gain.setTargetAtTime(playing?value*.8:0,this.ctx.currentTime,.04);}
  setActiveCount(count){if(this.ctx)this.mix.gain.setTargetAtTime(1/Math.sqrt(Math.max(1,count)),this.ctx.currentTime,.2);}
  setTraveller(id,volume,pan){
    if(!this.ctx)return;const channel=this.channels[id],t=this.ctx.currentTime,v=Math.max(0,Math.min(1,volume)),p=Math.max(-1,Math.min(1,pan));
    for(const gain of [channel.level,channel.noteLevel])if(channel.configured)gain.gain.setTargetAtTime(v,t,.04);else gain.gain.value=v;
    for(const node of [channel.pan,channel.notePan])if(channel.configured)node.pan.setTargetAtTime(p,t,.08);else node.pan.value=p;
    channel.configured=true;
  }
  setRoom(value){if(this.ctx)this.wet.gain.setTargetAtTime(value*.75,this.ctx.currentTime,.2);}
  setDelay(time,mix,feedback,enabled=true){
    if(!this.ctx)return;const s=delaySettings(time,mix,feedback,enabled),t=this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(s.time,t,.15);this.delayWet.gain.setTargetAtTime(s.mix,t,.08);this.delayFeedback.gain.setTargetAtTime(s.feedback,t,.08);this.delaySend.gain.setTargetAtTime(s.send,t,.08);
  }
  strike(hz,ring,pan=0,bend=0,travellerId=0,instrumentKey='bell'){
    if(!this.ctx||!Number.isFinite(hz)||hz<=0)return false;const c=this.ctx,t=c.currentTime;
    const channel=this.channels[travellerId];
    // Independent gates allow three simultaneous notes, one per traveller.
    if(t-channel.lastStrike<.75)return false;channel.lastStrike=t;
    const live=this.voices.filter(v=>!v.released&&v.travellerId===travellerId);
    if(live.length>=4)this.releaseVoice(live[0],.25);
    const plan=notePlan(hz,ring,instrumentKey,channel.noteCount||0,c.sampleRate),{profile,tail,attack}=plan;channel.noteCount=(channel.noteCount||0)+1;
    const voice={oscillators:[],gains:[],modulators:[],nodes:[],released:false,travellerId,instrument:instrumentKey,brightness:profile.brightness||4,started:t,tail};
    voice.filter=c.createBiquadFilter();voice.filter.type='lowpass';voice.filter.Q.value=.55;
    voice.filter.frequency.setValueAtTime(toneCutoff(hz,voice.brightness,0,tail,bend),t);
    voice.filter.frequency.exponentialRampToValueAtTime(toneCutoff(hz,voice.brightness,tail*.75,tail,bend),t+tail*.75);
    voice.pan=c.createStereoPanner();voice.pan.pan.value=Math.max(-.35,Math.min(.35,pan));
    voice.envelope=c.createGain();voice.envelope.gain.value=1;
    let toneOutput=voice.envelope;
    if(profile.tremolo){
      // A separate positive-only gain keeps tremolo out of release/voice-stealing fades.
      const pulse=c.createGain(),lfo=c.createOscillator(),depth=c.createGain(),amount=Math.max(0,Math.min(.3,profile.tremolo.depth)),settle=t+attack+.8;
      pulse.gain.setValueAtTime(1,t);pulse.gain.linearRampToValueAtTime(1-amount,settle);
      depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(amount,settle);lfo.frequency.value=profile.tremolo.rate;
      lfo.connect(depth);depth.connect(pulse.gain);pulse.connect(voice.envelope);toneOutput=pulse;
      lfo.start(t);lfo.stop(t+tail+.1);voice.modulators.push(lfo);voice.gains.push(depth);voice.nodes.push(pulse);
    }
    if(profile.lowCut){
      const bodyCut=c.createBiquadFilter();bodyCut.type='highpass';bodyCut.frequency.value=Math.min(profile.lowCut,hz*.42);bodyCut.Q.value=.55;
      voice.filter.connect(bodyCut);bodyCut.connect(toneOutput);voice.nodes.push(bodyCut);
    }else voice.filter.connect(toneOutput);
    voice.envelope.connect(voice.pan);voice.pan.connect(channel.noteLevel||this.bells);
    let lastOscillator=null,lastEnd=0;
    for(const part of plan.partials){
      const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=part.frequency;o.detune.value=part.detune;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(part.level,t+part.attack);g.gain.exponentialRampToValueAtTime(Math.max(.000001,part.level*part.bodyLevel),t+part.bodyTime);g.gain.exponentialRampToValueAtTime(.000001,t+part.end);g.gain.linearRampToValueAtTime(0,t+part.end+.025);
      o.connect(g);g.connect(voice.filter);o.start(t);o.stop(t+part.end+.03);voice.oscillators.push(o);voice.gains.push(g);if(part.end>lastEnd){lastEnd=part.end;lastOscillator=o;}
    }
    if(profile.vibrato){
      const lfo=c.createOscillator(),depth=c.createGain();lfo.frequency.value=plan.vibratoRate;depth.gain.setValueAtTime(0,t);depth.gain.setValueAtTime(0,t+attack+.15);depth.gain.linearRampToValueAtTime(profile.vibrato,t+attack+1.1);
      lfo.connect(depth);for(const o of voice.oscillators)depth.connect(o.detune);lfo.start(t);lfo.stop(t+tail+.1);voice.modulators.push(lfo);voice.gains.push(depth);
      const drift=c.createOscillator(),amount=c.createGain();drift.frequency.value=.29+plan.variation*.08;amount.gain.value=.65;
      drift.connect(amount);for(const o of voice.oscillators)amount.connect(o.detune);drift.start(t);drift.stop(t+tail+.1);voice.modulators.push(drift);voice.gains.push(amount);
    }
    if(profile.breath||profile.transient){
      const breath=c.createBufferSource(),g=c.createGain();breath.buffer=this.noise.buffer;breath.loop=true;
      const air=c.createBiquadFilter();air.type='bandpass';air.frequency.value=profile.breath?Math.min(2600,Math.max(950,hz*4)):Math.min(1600,Math.max(250,hz*2));air.Q.value=profile.breath?.75:(profile.transientQ||1.2);
      if(!profile.breath&&profile.transientFrequency)air.frequency.value=Math.min(1900,profile.transientFrequency*(hz/220)**.18);
      const duration=profile.breath?tail:(profile.transientTime||.065),peak=profile.breath||profile.transient,rise=profile.breath?attack:.009;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+rise);
      if(profile.breath)g.gain.exponentialRampToValueAtTime(peak*.6,t+tail*.45);
      g.gain.exponentialRampToValueAtTime(.000001,t+duration);
      breath.connect(air);air.connect(g);g.connect(voice.envelope);breath.start(t,plan.variation*.7);breath.stop(t+duration+.1);voice.modulators.push(breath);voice.gains.push(g);voice.nodes.push(air);
    }
    voice.hz=hz;this.voices.push(voice);channel.currentVoice=voice;
    lastOscillator.onended=()=>{voice.released=true;for(const o of [...voice.oscillators,...voice.modulators])o.disconnect();for(const g of voice.gains)g.disconnect();for(const node of voice.nodes)node.disconnect();voice.filter.disconnect();voice.envelope.disconnect();voice.pan.disconnect();this.voices=this.voices.filter(v=>v!==voice);};
    return true;
  }
  colour(bend,travellerId=0){const v=this.channels?.[travellerId]?.currentVoice;if(this.ctx&&v&&!v.released){const t=this.ctx.currentTime;v.filter.frequency.cancelScheduledValues(t);v.filter.frequency.setTargetAtTime(toneCutoff(v.hz,v.brightness,t-v.started,v.tail,bend),t,.25);}}
  releaseVoice(voice,fade=.15){
    if(voice.released)return;voice.released=true;const t=this.ctx.currentTime,current=voice.envelope.gain.value;
    voice.envelope.gain.cancelScheduledValues(t);voice.envelope.gain.setValueAtTime(current,t);voice.envelope.gain.linearRampToValueAtTime(0,t+fade);
    for(const o of [...voice.oscillators,...voice.modulators])o.stop(t+fade);
  }
  tune(hz,q,travellerId=0) {
    if(!this.ctx)return;
    for(const {filter,ratio}of this.channels[travellerId].filters){filter.frequency.setTargetAtTime(Math.min(this.ctx.sampleRate*.42,hz*ratio),this.ctx.currentTime,.07);filter.Q.setTargetAtTime(q,this.ctx.currentTime,.05);}
  }
  exciteEdge(mode,duration,travellerId=0) {
    if(!this.ctx)return;const t=this.ctx.currentTime,g=this.channels[travellerId].excite.gain;
    const current=g.value;g.cancelScheduledValues(t);g.setValueAtTime(current,t);
    if(mode==='pluck'){g.linearRampToValueAtTime(.85,t+.014);g.exponentialRampToValueAtTime(.0001,t+Math.min(1.3,Math.max(.08,duration*.8)));}
    else g.setTargetAtTime(.42,t,.08);
  }
  silenceChannel(travellerId){
    if(!this.ctx)return;const t=this.ctx.currentTime,channel=this.channels[travellerId];
    channel.excite.gain.cancelScheduledValues(t);channel.excite.gain.setTargetAtTime(0,t,.02);
    for(const v of this.voices)if(v.travellerId===travellerId)this.releaseVoice(v);channel.currentVoice=null;
  }
  silence(){if(!this.ctx)return;for(let i=0;i<this.channels.length;i++)this.silenceChannel(i);this.setVolume(0,false);}
  record(onFinished) {
    if(typeof MediaRecorder==='undefined')throw new Error('Audio recording is unavailable in this browser.');
    const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    this.recorder=new MediaRecorder(this.recordDestination.stream,mime?{mimeType:mime}:undefined);
    const chunks=[];this.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    this.recorder.onstop=()=>onFinished(new Blob(chunks,{type:this.recorder.mimeType}));this.recorder.start();
  }
  stopRecording(){if(this.recorder?.state==='recording')this.recorder.stop();}
}
