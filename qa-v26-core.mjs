import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url), journey = require("./js/graduate-journey-core.js"), backup = require("./js/backup-core.js");
const root = dirname(fileURLToPath(import.meta.url)), read = file => readFile(resolve(root, file), "utf8"), json = value => JSON.stringify(value);
class MemoryStorage { constructor(seed = {}) { this.values = new Map(Object.entries(seed)); this.writes = 0; } getItem(key) { return this.values.has(key) ? this.values.get(key) : null; } setItem(key, value) { this.writes++; this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }

const defaults = journey.normalizeState();
assert.deepEqual(defaults.settings, { admissionDate: "2026-09-14", admissionMonth: "2026-09", graduationMonth: "2029-06", graduationDate: "" });
assert.equal(defaults.schemaVersion, 1);
const start = journey.journeyMetrics(defaults.settings, "2026-09-14"), secondDay = journey.journeyMetrics(defaults.settings, "2026-09-15"), leapBefore = journey.journeyMetrics(defaults.settings, "2028-02-28"), leapDay = journey.journeyMetrics(defaults.settings, "2028-02-29"), finish = journey.journeyMetrics(defaults.settings, "2029-06-30");
assert.equal(start.elapsedDays, 1, "admission day must count as the first journey day");
assert.equal(secondDay.elapsedDays, 2, "the day after admission must display about two days");
assert.equal(start.phase.id, "year1");
assert.equal(journey.journeyMetrics(defaults.settings, "2026-09-13").phase.id, "before");
assert.equal(journey.journeyMetrics(defaults.settings, "2027-09-13").phase.id, "year1");
assert.equal(journey.journeyMetrics(defaults.settings, "2027-09-14").phase.id, "year2");
assert.equal(journey.journeyMetrics(defaults.settings, "2028-09-14").phase.id, "year3");
assert.equal(leapDay.elapsedDays - leapBefore.elapsedDays, 1, "leap day must count as one calendar day");
assert.equal(finish.remainingDays, 0); assert.equal(finish.progress, 100); assert.equal(finish.phase.id, "graduated");
assert.equal(start.elapsedDays + start.remainingDays, start.totalDays);
const exact = journey.journeyMetrics({ admissionMonth: "2026-09", graduationMonth: "2029-06", graduationDate: "2029-06-15" }, "2029-06-14");
assert.equal(exact.remainingDays, 1); assert.equal(exact.approximateGraduation, false); assert.equal(journey.formatTarget("2029-06-15"), "2029年6月15日");
assert.equal(journey.formatMonth("2029-06"), "2029年6月");
assert.deepEqual(journey.normalizeSettings({ admissionMonth: "bad", graduationMonth: "2020-01" }), journey.DEFAULT_SETTINGS);
assert.deepEqual(journey.normalizeSettings({ admissionMonth: "2030-09", graduationMonth: "2029-06" }), journey.DEFAULT_SETTINGS, "an inverted malformed range must fall back atomically");
assert.equal(journey.normalizeSettings({ admissionMonth: "2027-10", graduationMonth: "2030-06" }).admissionDate, "2027-10-01", "a customized legacy month must migrate without inventing a day");

let state = journey.normalizeState({ schemaVersion: 0, settings: { admissionMonth: "2026-09", graduationMonth: "2029-06" }, milestones: [{ id: "legacy", title: " 读第一篇文献 ", category: "文献", stage: "year1", targetDate: "2026-10-01", status: "doing", note: "保留旧目标" }, { id: "bad", title: "", status: "unknown" }] });
assert.equal(state.milestones.length, 1); assert.equal(state.milestones[0].title, "读第一篇文献");
state = journey.upsertMilestone(state, { id: "legacy", title: "完成文献精读", category: "文献", stage: "year1", targetDate: "2026-10-02", estimated: true, status: "done", note: "完成" });
assert.equal(state.milestones.length, 1); assert.equal(state.milestones[0].status, "done"); assert.equal(state.milestones[0].estimated, true);
state = journey.upsertMilestone(state, { title: "准备开题", category: "科研", stage: "year2", targetDate: "2027-10-01", status: "todo" });
assert.equal(state.milestones.length, 2); assert.equal(journey.nextMilestone(state, "2027-09-01").title, "准备开题");
state = journey.removeMilestone(state, "legacy"); assert.equal(state.milestones.length, 1);
assert.equal(journey.load(new MemoryStorage({ [journey.KEY]: "{bad" })).locked, true);
assert.equal(journey.load(new MemoryStorage({ [journey.KEY]: json({ schemaVersion: 2, settings: defaults.settings, milestones: [] }) })).locked, true);

const growthStorage = new MemoryStorage({
  xiaoluXiaogVocabularyV2: json({ books: { cet6: { history: [{ words: 50 }, { words: 20 }] } } }),
  xiaoluXiaogExerciseV1: json({ schemaVersion: 2, records: [{ status: "completed" }, { status: "rest" }] }),
  xiaoluXiaogTimelineV1: json({ schemaVersion: 3, memories: [{ id: "m1" }] }),
  xiaoluXiaogNotesV1: json({ schemaVersion: 3, notes: [{ id: "n1" }, { id: "n2" }] }),
  xiaoluXiaogWishlistV1: json([{ status: "done" }, { status: "doing" }])
});
const growth = journey.readGrowthStats(growthStorage);
assert.deepEqual([growth.study.value, growth.exercise.value, growth.memories.value, growth.notes.value, growth.wishes.value], [2, 1, 1, 2, 1]);
assert.equal(journey.readGrowthStats(new MemoryStorage()).study.available, false);

const journeyValue = json(state), source = new MemoryStorage({ [journey.KEY]: journeyValue }), payload = backup.createBackup(source, new Date("2026-09-14T00:00:00.000Z"));
assert.equal(backup.APP_VERSION, "2.6"); assert.equal(backup.specs.length, 17); assert.equal(payload.modules.graduateJourney.entries[journey.KEY].value.milestones.length, 1);
const oldPayload = structuredClone(payload); delete oldPayload.modules.graduateJourney; oldPayload.app.version = "2.5";
const target = new MemoryStorage({ [journey.KEY]: journeyValue, unrelated: "keep" });
assert.equal(backup.inspectBackup(oldPayload, target).valid, true); backup.restoreBackup(oldPayload, target); assert.equal(target.getItem(journey.KEY), journeyValue, "old backup must not clear current journey"); assert.equal(target.getItem("unrelated"), "keep");

const html = await read("index.html"), homeJs = await read("js/home.js"), page = await read("graduate-journey.html"), sw = await read("sw.js"), manifest = JSON.parse(await read("manifest.webmanifest"));
for (const id of ["home-journey-phase", "home-journey-remaining", "home-journey-elapsed", "home-journey-percent", "home-journey-goal", "home-journey-bar"]) assert.ok(html.includes(`id="${id}"`));
for (const id of ["journey-phase", "journey-remaining", "journey-elapsed", "journey-percent", "milestone-list", "growth-study"]) assert.ok(page.includes(`id="${id}"`));
assert.ok(sw.includes("xiaolu-home-v2.6-shell-4") && sw.includes("./graduate-journey.html") && sw.includes("./js/graduate-journey-core.js"));
assert.ok(manifest.shortcuts.some(item => item.url === "./graduate-journey.html"));
for (const file of ["graduate-journey.html", "js/graduate-journey-core.js", "js/graduate-journey.js"]) await access(resolve(root, file));

const selectors = ["#home-date", "#home-greeting", "#today-study", "#today-exercise", "#today-memory", "#today-wish", "#recent-exercise", "#recent-memory", "#recent-wish", "#recent-note", "#recent-study", "#recent-achievement", "#home-gift-summary", "#home-journey-phase", "#home-journey-remaining", "#home-journey-elapsed", "#home-journey-percent", "#home-journey-goal", "#home-journey-bar"];
const elements = new Map(selectors.map(selector => [selector, { textContent: "", style: {} }]));
const homeStorage = new MemoryStorage({ [journey.KEY]: json(journey.upsertMilestone(defaults, { id: "home-goal", title: "完成第一份组会汇报", stage: "year1", category: "科研", status: "todo", targetDate: "2026-09-30" })) });
const wrappedJourney = { ...journey, load: () => journey.load(homeStorage) };
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ["2026-09-15T12:00:00.000Z"])); } static now() { return Date.parse("2026-09-15T12:00:00.000Z"); } }
const context = { Date: FixedDate, document: { querySelector: selector => elements.get(selector) || null }, localStorage: homeStorage, window: { XiaoluGraduateJourney: wrappedJourney, XiaoluExerciseStore: { load: () => ({ state: { records: [] } }) }, XiaoluTimelineStore: { load: () => ({ state: { memories: [] } }) }, XiaoluNotesStore: { load: () => ({ state: { notes: [] } }) } } };
const writesBefore = homeStorage.writes; vm.runInNewContext(homeJs, context);
assert.match(elements.get("#home-journey-remaining").textContent, /毕业/); assert.equal(elements.get("#home-journey-elapsed").textContent, "已读研约 2 天"); assert.equal(elements.get("#home-journey-goal").textContent, "下一目标：完成第一份组会汇报"); assert.match(elements.get("#home-journey-percent").textContent, /%$/); assert.ok(elements.get("#home-journey-bar").style.width.endsWith("%")); assert.equal(homeStorage.writes, writesBefore, "home journey summary must be read-only");

console.log("PASS v2.6 core: calendar math, stages, milestone CRUD, schema protection, growth reads, backup compatibility, home summary and PWA resources");
