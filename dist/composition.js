import {INSTRUMENTS} from './instruments.js?v=7';
import {SCALES} from './music.js';
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function numericSeed(value){const text=String(value??'1');if(/^\d+$/.test(text))return Math.min(2147483647,Number(text));let hash=2166136261;for(const c of text){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)%2147483648;}
export const CONTROL_LIMITS={speed:[25,200,100],tuning:[55,660,196],q:[3,65,42],volume:[0,100,80],sensitivity:[10,95,55],cleanup:[0,55,22],room:[0,70,32],'delay-time':[100,1800,650],'delay-feedback':[0,90,28],'delay-mix':[0,50,18],'response-gap':[.8,6,2.4]};
export function validateComposition(input){
  if(!input||input.format!=='line-resonator'||input.version!==1)throw new Error('Choose a Filigrana composition file.');
  if(typeof input.image?.src!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(input.image.src)||input.image.src.length>35e6)throw new Error('The composition needs an embedded JPEG, PNG, or WebP image.');
  if(!Array.isArray(input.travellers)||input.travellers.length!==3)throw new Error('The composition must contain three travellers.');
  const controls={};for(const [key,[min,max,fallback]]of Object.entries(CONTROL_LIMITS))controls[key]=number(input.controls?.[key],min,max,fallback);
  controls.branch=['flow','explore','random'].includes(input.controls?.branch)?input.controls.branch:'flow';
  controls.interaction=input.controls?.interaction==='conversation'?'conversation':'independent';
  controls.duration=[0,120,300,600].includes(input.controls?.duration)?input.controls.duration:0;
  controls['delay-enabled']=input.controls?.['delay-enabled']!==false;
  controls.seed=typeof input.controls?.seed==='string'?input.controls.seed.slice(0,80):'ink-01';
  return {format:'line-resonator',version:1,image:{src:input.image.src,name:String(input.image.name||'Saved drawing').slice(0,160)},controls,
    travellers:input.travellers.map((t,i)=>({instrument:Object.hasOwn(INSTRUMENTS,t?.instrument)?t.instrument:'bell',scale:Object.hasOwn(SCALES,t?.scale)?t.scale:'pentatonic',enabled:t?.enabled!==false,octave:Math.round(number(t?.octave,-2,2,0)),speed:number(t?.speed,10,240,28),spacing:number(t?.spacing,.8,12,2.8),volume:number(t?.volume,0,1,.8),ring:number(t?.ring,3,65,controls.q),pan:number(t?.pan,-1,1,(i-1)*.35),
      origin:t?.origin?{edgeId:Math.floor(number(t.origin.edgeId,0,1e6,0)),from:Math.floor(number(t.origin.from,0,1e6,0)),distance:number(t.origin.distance,0,1e6,0),x:number(t.origin.x,0,1,.5),y:number(t.origin.y,0,1,.5)}:null})),
    graph:{w:number(input.graph?.w,1,960,1),h:number(input.graph?.h,1,960,1),edges:number(input.graph?.edges,0,1e6,0)}};
}
