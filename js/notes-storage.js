((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluNotesStore = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";
  const KEY = "xiaoluXiaogNotesV1", SCHEMA_VERSION = 1;
  const CATEGORIES = ["科研", "英语", "C语言", "旅行", "日记", "小路×小G", "其他"];
  const text = (value, max = 5000) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
  const id = value => (typeof value==="string"||typeof value==="number"?text(value,100):"") || globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const date = value => { const raw=String(value||""); const parsed=new Date(`${raw}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===raw ? raw : new Date().toISOString().slice(0,10); };
  const tags = value => (Array.isArray(value) ? value.filter(x=>typeof x==="string") : typeof value==="string" ? value.split(/[，,]/) : []).map(x => text(x, 30)).filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).slice(0, 20);
  const stringIds=value=>Array.isArray(value)?value.filter(x=>typeof x==="string"||typeof x==="number").map(x=>text(x,100)).filter(Boolean).slice(0,50):[];
  function normalizeNote(input = {}) { return { id: id(input.id), notebookId: text(input.notebookId, 100) || "default", title: text(input.title, 120), body: text(input.body, 10000), date: date(input.date), category: CATEGORIES.includes(input.category) ? input.category : "其他", tags: tags(input.tags), links: { memoryIds:stringIds(input.links?.memoryIds),projectIds:stringIds(input.links?.projectIds) }, createdAt: text(input.createdAt, 40) || new Date().toISOString(), updatedAt: text(input.updatedAt, 40) || new Date().toISOString() }; }
  function normalizeState(input) { const source = input && typeof input === "object" && !Array.isArray(input) ? input : {},seenBooks=new Set(),seenNotes=new Set(); const notebooks = Array.isArray(source.notebooks) ? source.notebooks.filter(x => x && typeof x === "object").map(x => ({ id: id(x.id), name: text(x.name, 80) || "未命名笔记本", createdAt: text(x.createdAt, 40) || new Date().toISOString() })).filter(x=>!seenBooks.has(x.id)&&seenBooks.add(x.id)) : []; return { schemaVersion: SCHEMA_VERSION, notebooks: notebooks.length ? notebooks : [{ id: "default", name: "小路的笔记", createdAt: new Date().toISOString() }], notes: Array.isArray(source.notes) ? source.notes.filter(x => x && typeof x === "object").map(normalizeNote).filter(x => (x.title || x.body)&&!seenNotes.has(x.id)&&seenNotes.add(x.id)) : [] }; }
  function load(storage = globalThis.localStorage) { const raw = storage?.getItem(KEY); if (raw == null) return { state: normalizeState(), warning: "" }; try { const parsed=JSON.parse(raw); if(Number(parsed?.schemaVersion)>SCHEMA_VERSION)return {state:normalizeState(parsed),warning:"笔记数据来自更新版本，当前页面仅供查看。",locked:true}; return { state: normalizeState(parsed), warning: "" }; } catch { return { state: normalizeState(), warning: "笔记数据格式异常，已暂停覆盖原始数据。", locked: true }; } }
  function save(state, storage = globalThis.localStorage) { try { storage.setItem(KEY, JSON.stringify(normalizeState(state))); return true; } catch { return false; } }
  return { KEY, SCHEMA_VERSION, CATEGORIES, normalizeNote, normalizeState, load, save };
});
