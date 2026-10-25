export const PRESETS={
  floating:{name:'Floating',keys:['flute','strings','bell'],octaves:[0,-1,1],speeds:[18,16,26],spacing:[5,6,4],volumes:[.65,.55,.45],room:48,ring:48,pace:85,gap:3.6},
  still:{name:'Still',keys:['bowl','piano','harp'],octaves:[-1,0,1],speeds:[18,28,40],spacing:[4.5,3,2],volumes:[.65,.8,.55],room:32,ring:42,pace:100,gap:2.4},
  flowing:{name:'Flowing',keys:['piano','harp','kalimba'],octaves:[0,0,1],speeds:[30,40,48],spacing:[1.4,1.6,1.8],volumes:[.7,.6,.5],room:24,ring:32,pace:110,gap:1.6},
  glassgarden:{name:'Glass garden',keys:['glass','harp','vibraphone'],octaves:[0,0,1],speeds:[17,28,22],spacing:[5.5,3.5,4.5],volumes:[.72,.5,.42],room:45,ring:45,pace:85,gap:3.2},
  moonwater:{name:'Moonwater',keys:['handpan','bowl','glass'],octaves:[-1,-1,1],speeds:[28,16,20],spacing:[3.2,6,5],volumes:[.72,.48,.58],room:42,ring:43,pace:90,gap:3,scale:'minorPentatonic'},
  woodland:{name:'Woodland',keys:['bassclarinet','marimba','kalimba'],octaves:[-1,0,1],speeds:[18,32,38],spacing:[5,3,3.5],volumes:[.75,.62,.46],room:22,ring:32,pace:95,gap:2.5,scale:'minorPentatonic'},
  softfocus:{name:'Soft focus',keys:['piano','vibraphone','strings'],octaves:[0,0,-1],speeds:[28,24,16],spacing:[3.5,4.5,6],volumes:[.7,.46,.5],room:36,ring:42,pace:90,gap:2.8},
  lanterns:{name:'Lanterns',keys:['handpan','harp','bell'],octaves:[-1,0,1],speeds:[30,38,24],spacing:[1.5,1.8,2.1],volumes:[.7,.52,.4],room:30,ring:37,pace:105,gap:2.4},
  dusk:{name:'Dusk',keys:['bassclarinet','glass','bowl'],octaves:[-1,0,-1],speeds:[16,18,14],spacing:[6,6.5,7],volumes:[.7,.58,.46],room:48,ring:50,pace:75,gap:4,scale:'minor'},
  crystalroom:{name:'Crystal room',keys:['glass','vibraphone','bell'],octaves:[0,0,1],speeds:[18,24,28],spacing:[5.5,4,5],volumes:[.68,.5,.38],room:38,ring:43,pace:85,gap:3.2}
};
// Compare only the settings a preset owns; routes, mute, root and output stay independent.
export function matchingPreset(voices,controls){
  return Object.keys(PRESETS).find(key=>{
    const p=PRESETS[key];
    return ['room','pace','gap'].every(field=>controls[field]===p[field])&&voices.length===3&&voices.every((v,i)=>(v.ring??controls.ring)===p.ring&&v.instrument===p.keys[i]&&v.octave===p.octaves[i]&&v.speed===p.speeds[i]&&v.spacing===p.spacing[i]&&v.volume===p.volumes[i]&&v.pan===(i-1)*.4&&(v.scale===(p.scale||'pentatonic')||(controls.ring!==undefined&&v.ring===undefined&&v.scale==='pentatonic')));
  })||'custom';
}
