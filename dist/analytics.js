const HOST='bassimatte.github.io';
const APP_PATH='/filigrana';
const WEBSITE_ID='b2300e0b-bc69-49d7-ad05-06f980b5ed38';
const SCRIPT_URL='https://cloud.umami.is/script.js';
const EVENT_PREFIX='filigrana_';
const SCHEMA=Object.freeze({
  listen_requested:{source:['listen','audio_export','video_recording']},
  audio_started:{source:['listen','audio_export','video_recording']},
  audio_failed:{reason:['start_error','unsupported']},
  listen_milestone:{duration:['30s','2m','5m'],source:['listen','audio_export','video_recording']},
  drawing_loaded:{source:['starter','upload','composition']},
  paths_analyzed:{outcome:['found','none','failed']},
  preset_selected:{preset:['floating','still','flowing','glassgarden','moonwater','woodland','softfocus','lanterns','dusk','crystalroom']},
  instrument_selected:{instrument:['bell','piano','harp','kalimba','marimba','bowl','flute','strings','glass','handpan','bassclarinet','vibraphone','bow','pluck']},
  scale_selected:{scale:['pentatonic','minorPentatonic','major','minor','chromatic','free'],scope:['voice','all']},
  visualization_selected:{mode:['threads','trace','afterimage','halos','waves','dew','mist']},
  audio_export_completed:{format:['mp3','wav'],duration:['short','medium','long']},
  video_recording_completed:{duration:['short','medium','long']},
  render_started:{duration:['short','medium','long'],format:['mp3','wav','mp4']},
  render_completed:{duration:['short','medium','long'],format:['mp3','wav','mp4']},
  render_failed:{reason:['unsupported','encoding','unknown'],duration:['short','medium','long'],format:['mp3','wav','mp4']},
  composition_action:{action:['saved','loaded']}
});
const pending=[];
const configured=()=>location.hostname===HOST&&
  (location.pathname===APP_PATH||location.pathname.startsWith(`${APP_PATH}/`))&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(WEBSITE_ID);

function send(name,properties){
  if(typeof window.umami?.track!=='function')return false;
  try{window.umami.track(`${EVENT_PREFIX}${name}`,properties);return true;}catch{return false;}
}

export function trackFiligranaEvent(name,properties={}){
  if(!configured())return false;
  const schema=SCHEMA[name];if(!schema)return false;
  const safe={};for(const [key,allowed]of Object.entries(schema)){const value=String(properties[key]??'');if(allowed.includes(value))safe[key]=value;}
  if(!send(name,safe)&&pending.length<50)pending.push({name,properties:safe});
  return true;
}

function init(){
  if(!configured()||document.querySelector('script[data-filigrana-analytics]'))return;
  const script=document.createElement('script');script.defer=true;script.src=SCRIPT_URL;
  script.dataset.websiteId=WEBSITE_ID;script.dataset.tag='filigrana';script.dataset.domains=HOST;
  script.dataset.excludeSearch='true';script.dataset.excludeHash='true';script.dataset.doNotTrack='true';
  script.dataset.filigranaAnalytics='umami';
  script.addEventListener('load',()=>pending.splice(0).forEach(({name,properties})=>send(name,properties)));
  document.head.appendChild(script);
}

init();
