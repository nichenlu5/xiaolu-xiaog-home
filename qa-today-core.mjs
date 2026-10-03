import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const today = require("./js/today-core.js");
const backup = require("./js/backup-core.js");

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); this.writes = []; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); this.writes.push(key); }
  removeItem(key) { this.map.delete(key); this.writes.push(key); }
}

const storage = new MemoryStorage({ legacyLearningData: "keep-me" });
let loaded = today.load(storage);
assert.equal(loaded.locked, false);
assert.deepEqual(loaded.state, { schemaVersion: 1, records: [] });
assert.deepEqual(storage.writes, [], "loading an empty Today state must not write or migrate data");

let state = today.setForDate(loaded.state, "2026-10-03", "good", new Date("2026-10-03T01:00:00Z"));
assert.equal(today.save(state, storage).ok, true);
assert.deepEqual(storage.writes, [today.KEY], "Today must only write its own namespace");
assert.equal(storage.getItem("legacyLearningData"), "keep-me");
assert.equal(today.forDate(today.load(storage).state, "2026-10-03").statusId, "good");

state = today.setForDate(today.load(storage).state, "2026-10-03", "rest", new Date("2026-10-03T02:00:00Z"));
today.save(state, storage);
assert.equal(state.records.length, 1, "modifying today's status must update rather than append");
assert.equal(today.forDate(state, "2026-10-03").statusId, "rest");
state = today.setForDate(state, "2026-10-03", "");
today.save(state, storage);
assert.equal(today.forDate(today.load(storage).state, "2026-10-03"), null, "status can be left unselected");

assert.throws(() => today.setForDate(state, "2026-10-03", "punishment"), /状态无效/);
assert.throws(() => today.setForDate(state, "2026-02-30", "good"), /日期格式无效/);
const malformed = new MemoryStorage({ [today.KEY]: "{broken", legacyLearningData: "keep-me" });
loaded = today.load(malformed);
assert.equal(loaded.locked, true);
assert.equal(today.save(today.blank(), malformed).ok, false);
assert.equal(malformed.getItem(today.KEY), "{broken", "malformed data must remain untouched");
const futureRaw = JSON.stringify({ schemaVersion: 9, records: [{ date: "2026-10-03", statusId: "good" }] });
const future = new MemoryStorage({ [today.KEY]: futureRaw });
assert.equal(today.load(future).locked, true);
assert.equal(today.save(today.blank(), future).ok, false);
assert.equal(future.getItem(today.KEY), futureRaw, "future schema must remain untouched");

const backed = new MemoryStorage({ [today.KEY]: JSON.stringify(today.setForDate(today.blank(), "2026-10-03", "play")) });
const payload = backup.createBackup(backed, new Date("2026-10-03T03:00:00Z"));
assert.equal(payload.app.version, "3.0");
assert.equal(payload.modules.today.entries[today.KEY].value.records[0].statusId, "play");
const restored = new MemoryStorage();
assert.ok(backup.restoreBackup(payload, restored).restored.includes(today.KEY));
assert.equal(today.forDate(today.load(restored).state, "2026-10-03").statusId, "play");

const oldPayload = backup.createBackup(new MemoryStorage({ xiaoluXiaogWishlistV1: "[]" }));
const existingToday = JSON.stringify(today.setForDate(today.blank(), "2026-10-03", "ordinary"));
const oldTarget = new MemoryStorage({ [today.KEY]: existingToday });
backup.restoreBackup(oldPayload, oldTarget);
assert.equal(oldTarget.getItem(today.KEY), existingToday, "an old backup without Today must not clear Today data");

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
assert.equal((html.match(/data-today-status=/g) || []).length, 7);
for (const id of ["today-arrangement", "today-study", "today-c", "today-research", "today-status-note", "interests"]) assert.ok(html.includes(`id="${id}"`), `missing Today DOM #${id}`);
assert.ok(html.includes('href="./study.html"') && html.includes('href="./graduate-journey.html"'));
assert.equal((html.match(/interest\.html\?branch=/g) || []).length, 9);

const homeJs = await readFile(new URL("./js/home.js", import.meta.url), "utf8");
assert.ok(homeJs.includes("xiaoluXiaogVocabularyV2") && homeJs.includes("c-language") && homeJs.includes("dailyRecords"));
assert.ok(!/localStorage\.(?:clear|removeItem|setItem)/.test(homeJs), "home aggregation must not directly mutate module storage");

function renderHome(uiStorage) {
  const makeButton = statusId => ({ dataset: { todayStatus: statusId }, disabled: false, attributes: {}, listeners: {}, classList: { active: false, toggle(_name, active) { this.active = active; } }, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, handler) { this.listeners[name] = handler; } });
  const buttons = today.STATUSES.map(item => makeButton(item.id));
  const clear = { hidden: true, disabled: false, listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; } };
  const elements = new Map([["#clear-today-status", clear], ["#today-status-note", { textContent: "" }], ["#home-date", { textContent: "" }], ["#home-greeting", { textContent: "" }], ["#research-day", { textContent: "" }]]);
  const uiToday = { ...today, load: () => today.load(uiStorage), save: state => today.save(state, uiStorage) };
  const context = { localStorage: uiStorage, document: { querySelector: selector => elements.get(selector) || null, querySelectorAll: selector => selector === "[data-today-status]" ? buttons : [] }, window: { XiaoluTodayStore: uiToday } };
  vm.runInNewContext(homeJs, context);
  return { buttons, clear, elements };
}
const uiStorage = new MemoryStorage({ learningSentinel: "unchanged" });
let ui = renderHome(uiStorage);
assert.deepEqual(uiStorage.writes, [], "rendering Today with no selection must not write");
ui.buttons.find(button => button.dataset.todayStatus === "good").listeners.click();
assert.deepEqual(uiStorage.writes, [today.KEY]);
ui = renderHome(uiStorage);
assert.equal(ui.buttons.find(button => button.dataset.todayStatus === "good").attributes["aria-pressed"], "true", "saved status must restore on refresh");
ui.buttons.find(button => button.dataset.todayStatus === "tired").listeners.click();
assert.equal(JSON.parse(uiStorage.getItem(today.KEY)).records.length, 1, "UI modification must retain one record for the date");
ui = renderHome(uiStorage);
ui.clear.listeners.click();
assert.equal(JSON.parse(uiStorage.getItem(today.KEY)).records.length, 0);
assert.equal(uiStorage.getItem("learningSentinel"), "unchanged", "Today UI must not change learning data");

const sw = await readFile(new URL("./sw.js", import.meta.url), "utf8");
for (const resource of ["xiaolu-home-v3.0-today-1", "./interest.html", "./js/today-core.js", "./js/interest.js"]) assert.ok(sw.includes(resource), `PWA is missing ${resource}`);

console.log("PASS v3.0 Today: isolated optional status, edit/clear/refresh, backup compatibility, reused data and offline resources");
