((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluExerciseStore = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";
  const KEY = "xiaoluXiaogExerciseV1";
  const SCHEMA_VERSION = 2;
  const TYPES = ["臀腿", "上肢", "核心", "体态", "有氧", "拉伸", "休息"];
  const STATUSES = ["planned", "completed", "rest"];
  const text = (value, max = 500) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
  const validDate = value => { const raw=String(value||""); const parsed=new Date(`${raw}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===raw ? raw : new Date().toISOString().slice(0, 10); };
  const id = value => (typeof value==="string"||typeof value==="number"?text(value,100):"") || globalThis.crypto?.randomUUID?.() || `exercise-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const integer = (value, max = 10000) => Math.max(0, Math.min(max, Number.parseInt(value, 10) || 0));
  function normalizeRecord(input = {}) {
    const type = TYPES.includes(input.type) ? input.type : "臀腿";
    const status = type === "休息" ? "rest" : STATUSES.includes(input.status) ? input.status : "completed";
    return {
      id: id(input.id), date: validDate(input.date), type, action: text(input.action, 100),
      sets: integer(input.sets, 100), reps: integer(input.reps, 10000), durationMinutes: integer(input.durationMinutes, 1440),
      status, feeling: text(input.feeling, 40), note: text(input.note, 1000),
      posturePhotoRefs: Array.isArray(input.posturePhotoRefs) ? input.posturePhotoRefs.filter(x => typeof x === "string").map(x => text(x, 500)).filter(Boolean).slice(0, 20) : [],
      links: { memoryIds: Array.isArray(input.links?.memoryIds) ? input.links.memoryIds.map(x=>text(x,100)).filter(Boolean).slice(0,50) : [] },
      createdAt: text(input.createdAt, 40) || new Date().toISOString(), updatedAt: text(input.updatedAt, 40) || new Date().toISOString()
    };
  }
  function normalizeState(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const seen=new Set(),records=Array.isArray(source.records) ? source.records.filter(x => x && typeof x === "object").map(normalizeRecord).filter(x=>!seen.has(x.id)&&seen.add(x.id)) : [];
    return { schemaVersion: SCHEMA_VERSION, records };
  }
  function load(storage = globalThis.localStorage) {
    const raw = storage?.getItem(KEY);
    if (raw === null || raw === undefined) return { state: normalizeState(), warning: "" };
    try { const parsed = JSON.parse(raw); if (Number(parsed?.schemaVersion) > SCHEMA_VERSION) return { state: normalizeState(parsed), warning: "运动数据来自更新版本，当前页面仅供查看。", locked: true }; return { state: normalizeState(parsed), warning: "" }; }
    catch { return { state: normalizeState(), warning: "运动数据格式异常，已暂停覆盖原始数据。", locked: true }; }
  }
  function save(state, storage = globalThis.localStorage) {
    try { storage.setItem(KEY, JSON.stringify(normalizeState(state))); return true; } catch { return false; }
  }
  return { KEY, SCHEMA_VERSION, TYPES, normalizeRecord, normalizeState, load, save };
});
