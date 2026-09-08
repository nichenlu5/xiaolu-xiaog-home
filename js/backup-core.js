((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluBackupCore = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";
  const BACKUP_SCHEMA_VERSION = 1;
  const APP_ID = "xiaolu-xiaog-home";
  const APP_VERSION = "2.3";
  const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
  const specs = [
    ["english", "英语学习", "xiaoluXiaogVocabularyV2", "object", "version"],
    ["wishlist", "愿望", "xiaoluXiaogWishlistV1", "array", ""],
    ["wishlist", "愿望迁移标记", "xiaoluXiaogWishlistMigrationVersion", "text", ""],
    ["footprints", "旅行足迹", "xiaoluXiaogTravelV1", "object", "schemaVersion"],
    ["footprints", "交通图鉴", "xiaoluXiaogTransportV1", "object", "schemaVersion"],
    ["exercise", "一起运动", "xiaoluXiaogExerciseV1", "object", "schemaVersion"],
    ["timeline", "回忆时间线", "xiaoluXiaogTimelineV1", "object", "schemaVersion"],
    ["notes", "笔记 / 小纸条", "xiaoluXiaogNotesV1", "object", "schemaVersion"],
    ["achievements", "跨模块成就", "xiaoluXiaogAchievementsV2", "object", "schemaVersion"],
    ["games", "游戏厅总记录", "xiaoluXiaogArcadeV1", "object", ""],
    ["games", "知识擂台错题", "xiaoluQuizWrongQuestionsV1", "object", ""],
    ["games", "知识擂台战绩", "xiaoluQuizBattleHistoryV1", "array", ""],
    ["games", "知识擂台统计", "xiaoluQuizStatsV15", "object", ""],
    ["games", "圆周率记录", "xiaoluXiaogPiMemoryV1", "object", ""],
    ["games", "限时快答记录", "xiaoluXiaogSpeedQuizV1", "object", ""]
  ].map(([module, label, key, kind, versionField]) => ({ module, label, key, kind, versionField }));
  const moduleNames = Object.fromEntries(specs.map(x => [x.module, x.module === "games" ? "游戏长期数据" : x.label]));
  const isObject = value => value && typeof value === "object" && !Array.isArray(value);
  const kindMatches = (value, kind) => kind === "array" ? Array.isArray(value) : kind === "object" ? isObject(value) : typeof value === "string";
  const schemaOf = (value, field) => field && isObject(value) && Number.isFinite(Number(value[field])) ? Number(value[field]) : null;

  function createBackup(storage = globalThis.localStorage, now = new Date()) {
    const modules = {};
    specs.forEach(spec => {
      const raw = storage?.getItem(spec.key);
      if (raw === null || raw === undefined) return;
      const module = modules[spec.module] ||= { label: moduleNames[spec.module], entries: {} };
      if (spec.kind === "text") module.entries[spec.key] = { format: "text", value: raw };
      else {
        try { module.entries[spec.key] = { format: "json", value: JSON.parse(raw) }; }
        catch { module.entries[spec.key] = { format: "raw", value: raw, warning: "invalid-json-preserved-for-manual-recovery" }; }
      }
    });
    return { backupSchemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), app: { id: APP_ID, version: APP_VERSION }, modules };
  }

  function inspectBackup(payload, storage = globalThis.localStorage) {
    const result = { valid: false, restorable: [], skipped: [], warnings: [] };
    if (!isObject(payload)) { result.warnings.push("备份根结构不是对象。"); return result; }
    if (payload.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) { result.warnings.push(Number(payload.backupSchemaVersion) > BACKUP_SCHEMA_VERSION ? "备份来自更高版本，当前页面不会强制降级恢复。" : "不支持此备份版本。"); return result; }
    if (payload.app?.id !== APP_ID || !isObject(payload.modules)) { result.warnings.push("这不是 xiaolu-xiaog-home 的有效备份。"); return result; }
    specs.forEach(spec => {
      const envelope = payload.modules?.[spec.module]?.entries?.[spec.key];
      if (envelope === undefined) return;
      if (!isObject(envelope) || !["json", "text", "raw"].includes(envelope.format)) { result.skipped.push({ ...spec, reason: "条目结构无效" }); return; }
      if (envelope.format === "raw") { result.skipped.push({ ...spec, reason: "原数据不是有效 JSON，仅保留在备份中，未自动恢复" }); return; }
      if (envelope.format !== (spec.kind === "text" ? "text" : "json") || !kindMatches(envelope.value, spec.kind)) { result.skipped.push({ ...spec, reason: "数据类型与模块不匹配" }); return; }
      if (spec.versionField) {
        let current;
        try { current = JSON.parse(storage?.getItem(spec.key) || "null"); } catch { current = null; }
        const currentSchema = schemaOf(current, spec.versionField), incomingSchema = schemaOf(envelope.value, spec.versionField);
        if (currentSchema !== null && incomingSchema !== null && currentSchema > incomingSchema) { result.skipped.push({ ...spec, reason: `本地 schema ${currentSchema} 高于备份 ${incomingSchema}，已避免降级覆盖` }); return; }
      }
      result.restorable.push({ ...spec, value: envelope.value, serialized: spec.kind === "text" ? envelope.value : JSON.stringify(envelope.value) });
    });
    result.valid = true;
    if (!result.restorable.length) result.warnings.push("备份中没有可安全恢复的已知数据。");
    return result;
  }

  function restoreBackup(payload, storage = globalThis.localStorage) {
    const inspection = inspectBackup(payload, storage);
    if (!inspection.valid || !inspection.restorable.length) return { ...inspection, restored: [], rolledBack: false };
    const originals = new Map(inspection.restorable.map(item => [item.key, storage.getItem(item.key)]));
    const restored = [];
    try {
      inspection.restorable.forEach(item => { storage.setItem(item.key, item.serialized); restored.push(item.key); });
      return { ...inspection, restored, rolledBack: false };
    } catch (error) {
      restored.forEach(key => { const old = originals.get(key); try { if (old === null) storage.removeItem(key); else storage.setItem(key, old); } catch {} });
      return { ...inspection, restored: [], rolledBack: true, warnings: inspection.warnings.concat("恢复写入失败，已尝试回滚本轮写入。") };
    }
  }
  return { BACKUP_SCHEMA_VERSION, APP_ID, APP_VERSION, MAX_IMPORT_BYTES, specs, createBackup, inspectBackup, restoreBackup };
});
