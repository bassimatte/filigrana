// Synthesized acoustic-inspired voices; no remote samples or audio downloads.
// Each partial is [frequency ratio, peak gain, relative decay].
export const INSTRUMENTS={
  bell:{label:'Felt bell',attack:.032,tail:1,brightness:3.8,body:.24,bodyLevel:.2,gain:.96,partials:[[1,.56,1],[2,.12,.66],[2.76,.045,.4],[4.07,.015,.24],[5.43,.005,.16]]},
  piano:{label:'Felt piano',attack:.018,tail:.72,brightness:5.5,spacing:1.1,body:.2,bodyLevel:.16,transient:.009,unison:1.6,partials:[[1,.43,1],[2,.19,.75],[3.002,.10,.56],[4.009,.055,.4],[5.02,.028,.29],[6.035,.014,.21],[7.05,.008,.16],[8.07,.004,.12]]},
  harp:{label:'Nylon harp',attack:.015,tail:.8,brightness:6.5,body:.22,bodyLevel:.18,transient:.005,partials:[[1,.47,1],[2,.20,.76],[3,.095,.56],[4,.044,.39],[5,.021,.28],[6,.01,.21],[7,.005,.16],[8,.0025,.12]]},
  kalimba:{label:'Wooden kalimba',attack:.014,tail:.38,brightness:5.8,body:.2,bodyLevel:.15,transient:.006,partials:[[1,.50,1],[2.76,.13,.5],[5.4,.035,.26],[8.93,.008,.15]]},
  marimba:{label:'Low marimba',attack:.018,tail:.32,brightness:5.5,body:.18,bodyLevel:.13,transient:.006,partials:[[1,.60,1],[3.99,.14,.35],[10.65,.018,.15],[17.92,.003,.1]]},
  bowl:{label:'Singing bowl',attack:.28,tail:1.6,brightness:6.5,spacing:2,body:.4,bodyLevel:.36,gain:.86,partials:[[1,.36,1],[1.0022,.09,.96],[2.71,.16,.77],[5.19,.05,.54],[8.21,.014,.32]]},
  flute:{label:'Breathy flute',attack:.32,tail:.78,brightness:3.7,spacing:1.4,sustain:true,body:.48,bodyLevel:.75,gain:.65,breath:.018,vibrato:3.5,partials:[[1,.45,1],[2,.10,.94],[3,.032,.86],[4,.009,.72]]},
  strings:{label:'Soft bowed strings',attack:.65,tail:1.1,brightness:4.7,spacing:1.6,sustain:true,body:.52,bodyLevel:.72,gain:.68,unison:3.2,vibrato:4.5,partials:[[1,.34,1],[2,.17,.96],[3,.085,.9],[4,.045,.83],[5,.025,.76],[6,.014,.7],[7,.008,.62],[8,.004,.55]]},
  bow:{label:'Bowed resonance',continuous:true},
  pluck:{label:'Plucked resonance',continuous:true}
};
export const instrument=key=>Object.hasOwn(INSTRUMENTS,key)?INSTRUMENTS[key]:INSTRUMENTS.bell;
export const isNoteVoice=key=>!instrument(key).continuous;
export function delaySettings(time,mix,feedback,enabled=true){
  const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
  return {time:Math.max(.08,Math.min(2,finite(time,.65))),mix:enabled?Math.max(0,Math.min(.5,finite(mix,0))):0,feedback:enabled?Math.max(0,Math.min(.65,finite(feedback,0))):0,send:enabled?1:0};
}
