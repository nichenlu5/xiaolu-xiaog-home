import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Core = require("./js/study-core.js");
const Backup = require("./js/backup-core.js");
const manifest = JSON.parse(await readFile(new URL("./data/wordbooks/manifest.json", import.meta.url), "utf8"));
const payload = JSON.parse(await readFile(new URL("./data/academic-vocabulary.json", import.meta.url), "utf8"));
const academicMeta = manifest.find(item => item.kind === "academic");
const serviceWorker = await readFile(new URL("./sw.js", import.meta.url), "utf8");
assert.equal(payload.schemaVersion, 2);
assert.equal(payload.catalogVersion, 2);
assert.equal(payload.bookId, academicMeta.bookId);
assert.equal(payload.complete, true);
assert.equal(payload.sourceEntryCount, 466);
assert.equal(payload.uniqueWordCount, 465);
assert.equal(payload.sections.length, 10);
assert.equal(payload.sections.reduce((sum, item) => sum + item.entryCount, 0), 466);
assert.equal(academicMeta.totalWords, payload.words.length);
assert.equal(academicMeta.catalogVersion, payload.catalogVersion);
assert.equal(new Set(payload.words.map(item => item.id)).size, 465);
assert.equal(new Set(payload.words.map(item => Core.normalizeWord(item.word))).size, 465);
assert.deepEqual(payload.words.filter(item => item.top100Rank).map(item => item.top100Rank).sort((a, b) => a - b), Array.from({ length: 100 }, (_, index) => index + 1));
assert.deepEqual(payload.words.slice(0, 100).map(item => item.top100Rank), Array.from({ length: 100 }, (_, index) => index + 1), "the handbook Top 100 must lead Academic Priority in source order");
for (const asset of ["./study.html", "./js/study-core.js", "./js/study.js", "./data/academic-vocabulary.json"]) assert.ok(serviceWorker.includes(asset), `${asset} must be available to the PWA shell`);
for (const word of payload.words) {
  assert.equal(word.source, "academic");
  assert.ok(word.phonetic && word.partOfSpeech && word.academicMeaning && word.frequency >= 1 && word.frequency <= 3);
  assert.ok(Array.isArray(word.collocations) && word.collocations.length && word.collocations.every(item => item.text && item.translation));
  assert.ok(word.example && word.translation && Array.isArray(word.examples) && word.examples.length && Array.isArray(word.senses) && word.senses.length);
  assert.ok(word.sectionId && word.section && Array.isArray(word.tags));
  assert.equal(word.masteryStatus, null, "catalog defaults must not replace shared browser mastery");
}
assert.equal(payload.words.find(item => item.word === "frequency").senses.length, 2, "the two handbook meanings of frequency must be preserved after deduplication");
assert.equal(payload.words.find(item => item.word === "threshold").id, "academic-priority-00001", "seed IDs must remain stable");
assert.equal(payload.words.find(item => item.word === "exposure").id, "academic-priority-00002", "seed IDs must remain stable");
assert.equal(Core.sanitizeAcademicWord({ id: "bad", word: "x", academicMeaning: "y" }), null);
assert.equal(Core.sanitizeAcademicWord({ ...payload.words[0], frequency: 99, tags: ["ok", 4] }).frequency, 5);

const general = Array.from({ length: 80 }, (_, index) => ({ id: `general-${index + 1}`, word: `general${index + 1}`, source: "general" }));
const academic = payload.words;
let plan = Core.buildDailyPlan(general, academic, {}, 0, 0, 50, 30);
assert.equal(plan.ids.length, 50);
assert.equal(plan.academicIds.length, 30);
assert.equal(plan.generalIds.length, 20);
assert.deepEqual(plan.ids.slice(0, 30), plan.academicIds, "Academic Priority must lead the daily queue");
plan = Core.buildDailyPlan(general, academic.slice(0, 4), {}, 0, 0, 50, 30);
assert.equal(plan.academicIds.length, 4);
assert.equal(plan.generalIds.length, 46, "general words must safely fill an incomplete academic catalog");
plan = Core.buildDailyPlan([{ id: "general-duplicate", word: academic[0].word, source: "general" }, ...general], academic, {}, 0, 0, 50, 30);
assert.ok(!plan.ids.includes("general-duplicate"), "the same word must not appear twice across sources");

const now = "2026-09-15T00:00:00.000Z";
const due = Object.fromEntries(["plain", "paper"].map(word => [word, Core.rateMastery(null, word, "fuzzy", "en-zh", "2026-09-10T00:00:00.000Z")]));
for (const entry of Object.values(due)) entry.nextReviewAt = "2026-09-14T00:00:00.000Z";
const ordered = Core.prioritizeDueWords([
  { id: "plain", word: "plain", source: "general" },
  { id: "paper", word: "paper", source: "academic" }
], due, Date.parse(now));
assert.equal(ordered[0].source, "academic", "academic words must win within the same mastery status");

assert.equal(Core.academicQuestion(payload.words[0], 0, 0).type, "academic-meaning");
assert.equal(Core.academicQuestion(payload.words[0], 1, 0).type, "collocation");
assert.equal(Core.academicQuestion(payload.words[0], 2, 0).type, "example");
assert.equal(Core.academicQuestion(payload.words[7], 7, 0).type, "confusable");
assert.equal(Core.academicQuestion(payload.words[0], 0, 1).direction, "zh-en", "paper mode must keep bidirectional active recall");

const catalogs = { "kaoyan-complete": general, cet6: general, "academic-priority": payload.words };
const restored = Core.sanitizeV4({
  version: 4,
  selectedBookId: "kaoyan-complete",
  mastery: {},
  preferences: { dailyGoal: 50 },
  books: { "kaoyan-complete": { session: { mode: "daily", queue: [payload.words[0].id, general[0].id], index: 1, generalScanCursor: 1, academicScanCursor: 1 } } }
}, manifest, catalogs);
assert.equal(restored.version, 4);
assert.equal(restored.preferences.academicDailyGoal, 30);
assert.deepEqual(restored.books["kaoyan-complete"].session.queue, [payload.words[0].id, general[0].id]);
assert.ok(restored.books["academic-priority"], "old v4 state must gain a safe academic progress bucket");

const seedUpgrade = Core.sanitizeV4({
  version: 4,
  selectedBookId: "kaoyan-complete",
  mastery: { threshold: Core.rateMastery(null, "threshold", "known", "en-zh", now) },
  books: {
    "academic-priority": { catalogVersion: 1, currentPosition: 4, history: [] },
    "kaoyan-complete": { session: { mode: "daily", queue: ["academic-priority-00001", general[0].id], academicScanCursor: 4, generalScanCursor: 1 } }
  }
}, manifest, catalogs);
assert.equal(seedUpgrade.books["academic-priority"].catalogVersion, 2);
assert.equal(seedUpgrade.books["academic-priority"].currentPosition, 0, "seed cursor must reset so newly inserted handbook words are not skipped");
assert.equal(seedUpgrade.books["kaoyan-complete"].session.academicScanCursor, 0);
assert.equal(seedUpgrade.mastery.threshold.status, "known", "seed mastery must survive the catalog upgrade");
assert.deepEqual(seedUpgrade.migration.academicCatalog.fromVersion, 1);

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const studyKey = "xiaoluXiaogVocabularyV2";
restored.books["academic-priority"].currentPosition = 2;
restored.preferences.lastAcademicWord = "exposure";
const source = new MemoryStorage({ [studyKey]: JSON.stringify(restored) });
const backup = Backup.createBackup(source, new Date("2026-09-15T00:00:00.000Z"));
assert.equal(backup.backupSchemaVersion, 1);
assert.equal(backup.modules.english.entries[studyKey].value.books["academic-priority"].currentPosition, 2);
const target = new MemoryStorage();
assert.equal(Backup.restoreBackup(backup, target).restored.includes(studyKey), true);
assert.equal(JSON.parse(target.getItem(studyKey)).preferences.lastAcademicWord, "exposure");
const oldV4 = structuredClone(restored);
delete oldV4.books["academic-priority"];
delete oldV4.preferences.academicDailyGoal;
assert.ok(Core.sanitizeV4(oldV4, manifest, catalogs).books["academic-priority"], "v2.5 English data without academic fields must still import safely");

const todayIso = new Date().toISOString();
const homeElements = new Map(["#home-date", "#home-greeting", "#today-study", "#recent-study"].map(selector => [selector, { textContent: "" }]));
const homeStudy = { books: { cet6: { history: [{ date: todayIso, mode: "daily", words: 12, academicWords: 4 }] } } };
const homeContext = {
  document: { querySelector: selector => homeElements.get(selector) || null },
  localStorage: { getItem: key => key === studyKey ? JSON.stringify(homeStudy) : null },
  window: {}
};
vm.runInNewContext(await readFile(new URL("./js/home.js", import.meta.url), "utf8"), homeContext);
assert.equal(homeElements.get("#today-study").textContent, "今日 12 / 50 · 学术 4 / 30");
assert.equal(homeElements.get("#recent-study").textContent, "今日 12 / 50 · 学术 4 / 30");

console.log("PASS v2.6 academic: 466 handbook entries / 465 deduped words, complete fields, stable seed IDs, 30+20 priority, due sorting, paper questions, catalog migration, shared mastery, backup restore, home summary");
