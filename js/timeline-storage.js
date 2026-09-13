((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluTimelineStore = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";
  const KEY = "xiaoluXiaogTimelineV1", SCHEMA_VERSION = 3;
  const SOURCE_MODULES = ["manual", "wish", "footprint", "exercise", "note", "achievement", "gift", "project"];
  const SOURCE_ALIASES = { wishlist:"wish", footprints:"footprint", notes:"note", gifts:"gift", achievements:"achievement" };
  const LINK_FIELDS = { wish:"wishIds", footprint:"footprintIds", exercise:"exerciseIds", note:"noteIds", achievement:"achievementIds", gift:"giftIds", project:"projectIds" };
  const text = (value, max = 1000) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
  const id = value => (typeof value==="string"||typeof value==="number"?text(value,100):"") || globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const date = value => { const raw=String(value||""); const parsed=new Date(`${raw}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===raw ? raw : new Date().toISOString().slice(0,10); };
  const tags = value => (Array.isArray(value) ? value.filter(x=>typeof x==="string") : typeof value==="string" ? value.split(/[，,]/) : []).map(x => text(x, 30)).filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).slice(0, 20);
  const stringIds = value => Array.isArray(value) ? value.map(x => text(x, 100)).filter(Boolean).filter((x,i,all)=>all.indexOf(x)===i).slice(0, 50) : [];
  function normalizeMemory(input = {}) {
    const requestedSource = SOURCE_ALIASES[input.source?.module] || input.source?.module;
    const sourceModule = SOURCE_MODULES.includes(requestedSource) ? requestedSource : "manual";
    const sourceItemId = sourceModule==="manual" ? "" : text(input.source?.itemId,100);
    const rawLinks = input.links && typeof input.links === "object" ? input.links : {};
    const links = { footprintIds:stringIds(rawLinks.footprintIds), wishIds:stringIds(rawLinks.wishIds), exerciseIds:stringIds(rawLinks.exerciseIds), achievementIds:stringIds(rawLinks.achievementIds), noteIds:stringIds(rawLinks.noteIds), giftIds:stringIds(rawLinks.giftIds), projectIds:stringIds(rawLinks.projectIds) };
    const sourceField=LINK_FIELDS[sourceModule];
    if(sourceField&&sourceItemId&&!links[sourceField].includes(sourceItemId))links[sourceField].unshift(sourceItemId);
    return {
      id:id(input.id), date:date(input.date), title:text(input.title,120), body:text(input.body,5000), place:text(input.place,120), tags:tags(input.tags), favorite:Boolean(input.favorite), pinned:Boolean(input.pinned),
      imageRef:/^https?:\/\//i.test(text(input.imageRef,500))?text(input.imageRef,500):"",
      source:{module:sourceModule,itemId:sourceItemId,label:sourceModule==="manual"?"":text(input.source?.label,120)}, links,
      createdAt:text(input.createdAt,40)||new Date().toISOString(), updatedAt:text(input.updatedAt,40)||new Date().toISOString()
    };
  }
  function normalizeState(input) {
    const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{},seen=new Set();
    return { schemaVersion:SCHEMA_VERSION, memories:Array.isArray(source.memories)?source.memories.filter(x=>x&&typeof x==="object").map(normalizeMemory).filter(x=>x.title&&!seen.has(x.id)&&seen.add(x.id)):[] };
  }
  function load(storage=globalThis.localStorage) {
    const raw=storage?.getItem(KEY);if(raw==null)return {state:normalizeState(),warning:""};
    try{const parsed=JSON.parse(raw);if(Number(parsed?.schemaVersion)>SCHEMA_VERSION)return {state:normalizeState(parsed),warning:"回忆数据来自更新版本，当前页面仅供查看。",locked:true};return {state:normalizeState(parsed),warning:""};}
    catch{return {state:normalizeState(),warning:"回忆数据格式异常，已暂停覆盖原始数据。",locked:true};}
  }
  function save(state,storage=globalThis.localStorage){try{storage.setItem(KEY,JSON.stringify(normalizeState(state)));return true}catch{return false}}
  return { KEY,SCHEMA_VERSION,SOURCE_MODULES,SOURCE_ALIASES,LINK_FIELDS,normalizeMemory,normalizeState,load,save };
});
