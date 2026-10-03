((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluTodayStore = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";

  const KEY = "xiaoluXiaogTodayV1";
  const SCHEMA_VERSION = 1;
  const MAX_RECORDS = 3660;
  const STATUSES = Object.freeze([
    { id: "good", icon: "😊", label: "今天不错" },
    { id: "ordinary", icon: "🙂", label: "普普通通" },
    { id: "tired", icon: "🥱", label: "有点累" },
    { id: "messy", icon: "😵‍💫", label: "脑袋乱乱的" },
    { id: "study", icon: "📚", label: "今天想学习" },
    { id: "play", icon: "🎮", label: "今天想玩" },
    { id: "rest", icon: "🛏️", label: "今天只想躺着" }
  ]);
  const statusIds = new Set(STATUSES.map(item => item.id));
  const blank = () => ({ schemaVersion: SCHEMA_VERSION, records: [] });
  const validDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  };
  const cleanText = value => String(value || "").trim().slice(0, 32);

  function normalize(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return blank();
    const byDate = new Map();
    (Array.isArray(raw.records) ? raw.records : []).forEach(item => {
      if (!item || !validDate(item.date) || !statusIds.has(item.statusId)) return;
      const record = { date: item.date, statusId: item.statusId, updatedAt: cleanText(item.updatedAt) };
      const previous = byDate.get(record.date);
      if (!previous || record.updatedAt >= previous.updatedAt) byDate.set(record.date, record);
    });
    return { schemaVersion: SCHEMA_VERSION, records: [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_RECORDS) };
  }

  function load(storage = globalThis.localStorage) {
    const raw = storage?.getItem(KEY);
    if (raw === null || raw === undefined) return { state: blank(), locked: false, warning: "" };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { state: blank(), locked: true, warning: "今日状态数据格式异常，已停止写入以保护原数据。" };
      if (Number(parsed.schemaVersion) > SCHEMA_VERSION) return { state: parsed, locked: true, warning: "今日状态来自更高版本，当前版本只读显示。" };
      return { state: normalize(parsed), locked: false, warning: "" };
    } catch {
      return { state: blank(), locked: true, warning: "今日状态数据无法读取，已停止写入以保护原数据。" };
    }
  }

  function forDate(state, date) {
    return (Array.isArray(state?.records) ? state.records : []).find(item => item.date === date) || null;
  }

  function setForDate(state, date, statusId, now = new Date()) {
    if (!validDate(date)) throw new Error("日期格式无效");
    const records = normalize(state).records.filter(item => item.date !== date);
    if (statusId) {
      if (!statusIds.has(statusId)) throw new Error("状态无效");
      records.push({ date, statusId, updatedAt: now.toISOString() });
    }
    return normalize({ schemaVersion: SCHEMA_VERSION, records });
  }

  function save(state, storage = globalThis.localStorage) {
    const loaded = load(storage);
    if (loaded.locked) return { ok: false, warning: loaded.warning };
    try {
      storage?.setItem(KEY, JSON.stringify(normalize(state)));
      return { ok: true, warning: "" };
    } catch {
      return { ok: false, warning: "今日状态暂时无法保存，其他学习数据没有受到影响。" };
    }
  }

  return { KEY, SCHEMA_VERSION, STATUSES, blank, normalize, load, forDate, setForDate, save };
});
