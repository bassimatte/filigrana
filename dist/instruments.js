// Synthesized acoustic-inspired voices; no remote samples or audio downloads.
// Each partial is [frequency ratio, peak gain, relative decay].
export const INSTRUMENTS={
  bell:{label:'Felt bell',attack:.026,tail:1.04,brightness:5.8,body:.19,bodyLevel:.19,gain:1.1,registerGain:.12,upperDamping:.14,modeAttack:.28,lowCut:42,transient:.007,transientTime:.045,transientFrequency:1250,transientQ:.65,pairs:[{mode:2,beatHz:.65,mix:.14}],partials:[[1,.52,1],[2.012,.085,.68],[2.756,.067,.48],[4.07,.025,.29],[5.43,.012,.2],[7.98,.0035,.13]]},
  piano:{label:'Felt piano',attack:.012,tail:.82,brightness:7.2,spacing:1.1,body:.16,bodyLevel:.19,gain:1.02,registerGain:.1,upperDamping:.2,modeAttack:.18,stiffness:.00012,lowCut:38,transient:.023,transientTime:.055,transientFrequency:880,transientQ:.7,unison:1.25,partials:[[1,.43,1],[2,.21,.8],[3,.13,.64],[4,.075,.49],[5,.043,.38],[6,.025,.3],[7,.014,.24],[8,.008,.19],[9,.0045,.16],[10,.0025,.13],[11,.0014,.11],[12,.0008,.09]]},
  harp:{label:'Nylon harp',attack:.015,tail:.8,brightness:6.5,body:.22,bodyLevel:.18,transient:.005,partials:[[1,.47,1],[2,.20,.76],[3,.095,.56],[4,.044,.39],[5,.021,.28],[6,.01,.21],[7,.005,.16],[8,.0025,.12]]},
  kalimba:{label:'Wooden kalimba',attack:.014,tail:.38,brightness:5.8,body:.2,bodyLevel:.15,transient:.006,partials:[[1,.50,1],[2.76,.13,.5],[5.4,.035,.26],[8.93,.008,.15]]},
  marimba:{label:'Low marimba',attack:.018,tail:.32,brightness:5.5,body:.18,bodyLevel:.13,transient:.006,partials:[[1,.60,1],[3.99,.14,.35],[10.65,.018,.15],[17.92,.003,.1]]},
  bowl:{label:'Singing bowl',attack:.095,tail:1.5,brightness:7,spacing:2,body:.34,bodyLevel:.4,gain:1.15,registerGain:.22,upperDamping:.1,modeAttack:.55,lowCut:48,transient:.004,transientTime:.075,transientFrequency:700,transientQ:.7,pairs:[{mode:0,beatHz:.28,mix:.22},{mode:1,beatHz:.63,mix:.3},{mode:2,beatHz:1.07,mix:.24},{mode:3,beatHz:1.58,mix:.18}],partials:[[1,.33,1],[2.71,.19,.84],[5.19,.065,.62],[8.21,.022,.43],[11.3,.006,.28]]},
  flute:{label:'Breathy flute',attack:.32,tail:.78,brightness:3.7,spacing:1.4,sustain:true,body:.48,bodyLevel:.75,gain:.65,breath:.018,vibrato:3.5,partials:[[1,.45,1],[2,.10,.94],[3,.032,.86],[4,.009,.72]]},
  strings:{label:'Soft bowed strings',attack:.65,tail:1.1,brightness:4.7,spacing:1.6,sustain:true,body:.52,bodyLevel:.72,gain:.68,unison:3.2,vibrato:4.5,partials:[[1,.34,1],[2,.17,.96],[3,.085,.9],[4,.045,.83],[5,.025,.76],[6,.014,.7],[7,.008,.62],[8,.004,.55]]},
  glass:{label:'Glass harmonica',attack:.48,tail:1.3,brightness:4.7,spacing:1.7,sustain:true,body:.53,bodyLevel:.7,gain:.72,registerGain:.08,upperDamping:.16,lowCut:36,vibrato:1.2,tremolo:{rate:.36,depth:.08},pairs:[{mode:1,beatHz:.43,mix:.18}],partials:[[1,.43,1],[2.002,.12,.9],[3.01,.048,.76],[4.025,.018,.6],[5.08,.007,.45],[6.13,.002,.32]]},
  handpan:{label:'Handpan',attack:.018,tail:.72,brightness:6.8,spacing:1.25,body:.19,bodyLevel:.22,gain:1.04,registerGain:.14,upperDamping:.16,modeAttack:.3,lowCut:40,transient:.014,transientTime:.07,transientFrequency:540,transientQ:.75,pairs:[{mode:1,beatHz:.8,mix:.13}],partials:[[1,.46,1],[2,.16,.75],[3,.11,.57],[4.98,.026,.34],[6.8,.009,.22],[8.4,.003,.14]]},
  bassclarinet:{label:'Bass clarinet',attack:.18,tail:.9,brightness:6.7,spacing:1.6,sustain:true,body:.48,bodyLevel:.72,gain:.68,registerGain:.1,upperDamping:.15,lowCut:32,breath:.014,vibrato:2.3,partials:[[1,.43,1],[2,.018,.85],[3,.22,.9],[4,.012,.7],[5,.075,.77],[7,.035,.64],[9,.015,.5],[11,.005,.35]]},
  vibraphone:{label:'Muted vibraphone',attack:.022,tail:.8,brightness:5.8,spacing:1.2,body:.21,bodyLevel:.24,gain:1.04,registerGain:.1,upperDamping:.18,modeAttack:.25,lowCut:40,tremolo:{rate:4.4,depth:.17},transient:.005,transientTime:.04,transientFrequency:1000,transientQ:.7,partials:[[1,.52,1],[3.99,.11,.54],[9.97,.015,.24],[14.35,.003,.12]]},
  bow:{label:'Bowed resonance',continuous:true},
  pluck:{label:'Plucked resonance',continuous:true}
};
export const instrument=key=>Object.hasOwn(INSTRUMENTS,key)?INSTRUMENTS[key]:INSTRUMENTS.bell;
export const isNoteVoice=key=>!instrument(key).continuous;
export function delaySettings(time,mix,feedback,enabled=true){
  const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
  return {time:Math.max(.08,Math.min(2,finite(time,.65))),mix:enabled?Math.max(0,Math.min(.5,finite(mix,0))):0,feedback:enabled?Math.max(0,Math.min(.9,finite(feedback,0))):0,send:enabled?1:0};
}
