((root,factory)=>{const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.XiaoluNotesStore=api;})(typeof globalThis==="object"?globalThis:window,()=>{
  "use strict";
  const KEY="xiaoluXiaogNotesV1",SCHEMA_VERSION=3;
  const CATEGORIES=["科研","英语","C语言","旅行","日记","小路×小G","其他"];
  const SOURCE_MODULES=["manual","wish","footprint","memory","exercise","gift","achievement","project"];
  const DEFAULT_NOTEBOOKS=[
    {id:"default",name:"默认笔记",emoji:"📥",coverColor:"#fff0e8",builtIn:true},
    {id:"research",name:"科研",emoji:"🧪",coverColor:"#e9f3f1",builtIn:true},
    {id:"c-language",name:"C语言",emoji:"💻",coverColor:"#eaf0fa",builtIn:true},
    {id:"travel",name:"旅行",emoji:"✈️",coverColor:"#eaf5fb",builtIn:true},
    {id:"diary",name:"日记",emoji:"🌷",coverColor:"#fff0f3",builtIn:true},
    {id:"xiaolu-xiaog",name:"小路 × 小G",emoji:"❤️",coverColor:"#fff0e8",builtIn:true}
  ];
  const text=(value,max=5000)=>(typeof value==="string"||typeof value==="number"?String(value).trim().slice(0,max):"");
  const id=value=>(typeof value==="string"||typeof value==="number"?text(value,100):"")||globalThis.crypto?.randomUUID?.()||`note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const date=value=>{const raw=String(value||""),parsed=new Date(`${raw}T00:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===raw?raw:new Date().toISOString().slice(0,10)};
  const tags=value=>(Array.isArray(value)?value.filter(x=>typeof x==="string"):typeof value==="string"?value.split(/[，,]/):[]).map(x=>text(x,30)).filter(Boolean).filter((x,i,all)=>all.indexOf(x)===i).slice(0,20);
  const stringIds=value=>Array.isArray(value)?value.filter(x=>typeof x==="string"||typeof x==="number").map(x=>text(x,100)).filter(Boolean).filter((x,i,all)=>all.indexOf(x)===i).slice(0,50):[];
  const color=value=>/^#[0-9a-f]{6}$/i.test(text(value,7))?text(value,7).toLowerCase():"#fff0e8";
  function normalizeNotebook(input={}){return {id:id(input.id),name:text(input.name,80)||"未命名笔记本",emoji:text(input.emoji,8)||"📓",coverColor:color(input.coverColor),builtIn:Boolean(input.builtIn),createdAt:text(input.createdAt,40)||new Date().toISOString(),updatedAt:text(input.updatedAt,40)||new Date().toISOString()}}
  function normalizeNote(input={}){const module=SOURCE_MODULES.includes(input.source?.module)?input.source.module:"manual";return {id:id(input.id),notebookId:text(input.notebookId,100)||"default",title:text(input.title,120),body:text(input.body,10000),date:date(input.date),category:CATEGORIES.includes(input.category)?input.category:"其他",tags:tags(input.tags),source:{module,itemId:module==="manual"?"":text(input.source?.itemId,100),label:module==="manual"?"":text(input.source?.label,120)},links:{memoryIds:stringIds(input.links?.memoryIds),projectIds:stringIds(input.links?.projectIds),giftIds:stringIds(input.links?.giftIds)},createdAt:text(input.createdAt,40)||new Date().toISOString(),updatedAt:text(input.updatedAt,40)||new Date().toISOString()}}
  function normalizeState(input){
    const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{},legacy=Number(source.schemaVersion||0)<SCHEMA_VERSION,seenBooks=new Set(),seenNotes=new Set();
    let notebooks=Array.isArray(source.notebooks)?source.notebooks.filter(x=>x&&typeof x==="object").map(normalizeNotebook).filter(x=>!seenBooks.has(x.id)&&seenBooks.add(x.id)):[];
    if(legacy){
      const custom=notebooks.filter(book=>!DEFAULT_NOTEBOOKS.some(base=>base.id===book.id));
      notebooks=DEFAULT_NOTEBOOKS.map(base=>normalizeNotebook({...base,...notebooks.find(book=>book.id===base.id),name:base.name,emoji:base.emoji,builtIn:true})).concat(custom);
    }else if(!notebooks.some(book=>book.id==="default"))notebooks.unshift(normalizeNotebook(DEFAULT_NOTEBOOKS[0]));
    const validBooks=new Set(notebooks.map(book=>book.id));
    const notes=Array.isArray(source.notes)?source.notes.filter(x=>x&&typeof x==="object").map(normalizeNote).filter(x=>(x.title||x.body)&&!seenNotes.has(x.id)&&seenNotes.add(x.id)).map(note=>({...note,notebookId:legacy||!validBooks.has(note.notebookId)?"default":note.notebookId})):[];
    return {schemaVersion:SCHEMA_VERSION,notebooks,notes};
  }
  function load(storage=globalThis.localStorage){const raw=storage?.getItem(KEY);if(raw==null)return {state:normalizeState(),warning:""};try{const parsed=JSON.parse(raw);if(Number(parsed?.schemaVersion)>SCHEMA_VERSION)return {state:normalizeState(parsed),warning:"笔记数据来自更新版本，当前页面仅供查看。",locked:true};return {state:normalizeState(parsed),warning:""}}catch{return {state:normalizeState(),warning:"笔记数据格式异常，已暂停覆盖原始数据。",locked:true}}}
  function save(state,storage=globalThis.localStorage){try{storage.setItem(KEY,JSON.stringify(normalizeState(state)));return true}catch{return false}}
  function linkMemory(state,noteId,memoryId){const next=normalizeState(state),note=next.notes.find(item=>item.id===text(noteId,100)),memory=text(memoryId,100);if(note&&memory&&!note.links.memoryIds.includes(memory)){note.links.memoryIds.unshift(memory);note.updatedAt=new Date().toISOString()}return next}
  function unlinkMemory(state,memoryId){const next=normalizeState(state),memory=text(memoryId,100);next.notes.forEach(note=>{note.links.memoryIds=note.links.memoryIds.filter(id=>id!==memory)});return next}
  return {KEY,SCHEMA_VERSION,CATEGORIES,SOURCE_MODULES,DEFAULT_NOTEBOOKS,normalizeNotebook,normalizeNote,normalizeState,load,save,linkMemory,unlinkMemory};
});
