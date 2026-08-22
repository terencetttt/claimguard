import { normalizeFinalizedDecision,type ClaimDecision } from "./decision-types";

export const DECISIONS_STORAGE_KEY="claimguard.decisions.v1";
export const DECISIONS_CHANGED_EVENT="claimguard:decisions-changed";
let cachedRaw:string|null|undefined; let cached:ClaimDecision[]=[];
function available(){return typeof window!=="undefined"}
function parse(value:string|null){try{return value?(JSON.parse(value) as ClaimDecision[]).map(normalizeFinalizedDecision):[]}catch{return []}}
export const decisionStorage={
  list():ClaimDecision[]{if(!available())return[];const raw=localStorage.getItem(DECISIONS_STORAGE_KEY);if(raw===cachedRaw)return cached;cached=parse(raw);const normalizedRaw=raw===null?null:JSON.stringify(cached);if(normalizedRaw!==null&&normalizedRaw!==raw)localStorage.setItem(DECISIONS_STORAGE_KEY,normalizedRaw);cachedRaw=normalizedRaw;return cached},
  save(decision:ClaimDecision){if(!available())return;const records=this.list();const normalized=normalizeFinalizedDecision(decision);localStorage.setItem(DECISIONS_STORAGE_KEY,JSON.stringify([normalized,...records.filter(item=>item.claimId!==normalized.claimId)]));cachedRaw=undefined;window.dispatchEvent(new Event(DECISIONS_CHANGED_EVENT))},
  subscribe(listener:()=>void){if(!available())return()=>undefined;const storage=(event:StorageEvent)=>{if(event.key===DECISIONS_STORAGE_KEY){cachedRaw=undefined;listener()}};window.addEventListener("storage",storage);window.addEventListener(DECISIONS_CHANGED_EVENT,listener);return()=>{window.removeEventListener("storage",storage);window.removeEventListener(DECISIONS_CHANGED_EVENT,listener)}},
};
