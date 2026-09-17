import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const Core = require("./js/study-core.js");
const backup = require("./js/backup-core.js");
const manifest = JSON.parse(await readFile(new URL("./data/wordbooks/manifest.json", import.meta.url), "utf8"));
const catalogs = {};
for (const meta of manifest) {
  catalogs[meta.bookId] = JSON.parse(await readFile(new URL(meta.file, import.meta.url), "utf8")).words;
}
class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const at = "2026-09-08T00:00:00.000Z";
const v3 = {
  version: 3,
  selectedBookId: "kaoyan-required",
  books: {
    "kaoyan-required": {
      currentPosition: 51,
      learned: { "kaoyan-required-00001": { lastSeenAt: "2026-09-07T00:00:00.000Z" } },
      wrong: { "kaoyan-required-00002": { lastWrongAt: "2026-09-08T00:00:00.000Z" } },
      skipped: { "kaoyan-required-00003": { at: "2026-09-06T00:00:00.000Z", word: "state" } },
      history: [{ date: at, mode: "daily", words: 50, correct: 90, wrong: 10, skipped: 1 }],
      session: { mode: "daily", queue: ["kaoyan-required-00004", null, "bad-id"], round: 1, index: -2 }
    },
    cet6: { currentPosition: 12, learned: {}, skipped: {}, wrong: {}, history: [] }
  }
};

const migrated = Core.migrateV3(v3, manifest, catalogs, at);
assert.equal(migrated.version, 4);
assert.equal(migrated.selectedBookId, "kaoyan-complete", "removed selection should move to active kaoyan book");
assert.equal(migrated.mastery.government.status, "known");
assert.equal(migrated.mastery.system.status, "unknown");
assert.equal(migrated.mastery.state.status, "simple");
assert.equal(migrated.legacyBooks["kaoyan-required"].currentPosition, 51, "retired book progress must be preserved");
assert.equal(migrated.books.cet6.currentPosition, 12, "active book cursor must remain independent");
assert.deepEqual(migrated.legacyBooks["kaoyan-required"].session.queue, ["kaoyan-required-00004"], "invalid session IDs must be filtered");

let mastery = Core.rateMastery(null, "adapt", "known", "en-zh", at);
mastery = Core.rateMastery(mastery, "adapt", "unknown", "zh-en", at);
assert.equal(mastery.status, "unknown", "shared word status should use the weaker direction");
assert.equal(mastery.directions["en-zh"].status, "known");
assert.equal(mastery.directions["zh-en"].status, "unknown");
assert.equal(Core.isDue(mastery, Date.parse("2026-09-09T00:00:01.000Z")), true);
mastery = Core.rateMastery(mastery, "adapt", "simple", "en-zh", at);
assert.equal(mastery.status, "simple");
assert.equal(mastery.nextReviewAt, null);

const meaning = Core.parseMeaning("n. 状态, 情形, 国家, 政府；vt. 说明, 陈述, 规定；[计] 状态");
assert.equal(meaning.core.text, "状态");
assert.deepEqual(meaning.common.slice(0, 2).map(item => item.text), ["情形", "国家"]);
assert.ok(meaning.extra.some(item => item.text === "规定"));

const dirty = Core.sanitizeV4({
  version: 4,
  selectedBookId: "cet4",
  mastery: { "": { status: "known" }, BAD: { status: "hacked" }, Adapt: mastery },
  books: { cet6: { currentPosition: 999999, history: [{ date: "bad" }], session: { mode: "evil", queue: [] } } },
  preferences: { dailyGoal: 999 }
}, manifest);
assert.equal(dirty.selectedBookId, "kaoyan-complete");
assert.equal(dirty.preferences.dailyGoal, 100);
assert.equal(dirty.books.cet6.currentPosition, 5371);
assert.equal(dirty.books.cet6.history.length, 0);
assert.equal(dirty.books.cet6.session, null);
assert.equal(Object.keys(dirty.mastery).length, 1);

const kaoyan = manifest.find(item => item.bookId === "kaoyan-complete");
const sessionQueue = catalogs[kaoyan.bookId].slice(0, 50).map(word => word.id);
const sessionBook = Core.sanitizeBook({
  currentPosition: 0,
  session: { mode: "daily", queue: sessionQueue, round: 0, index: 20, ratings: { known: 20 }, startedAt: at }
}, kaoyan, new Set(sessionQueue));
assert.deepEqual(sessionBook.session.queue, sessionQueue, "unfinished session must keep its fixed 50-word queue");
assert.equal(sessionBook.session.index, 20, "unfinished session must resume after the first 20 words");
assert.equal(sessionBook.session.queue[sessionBook.session.index], sessionQueue[20], "the next word must be word 21");
for (const resumeIndex of [1, 49]) {
  const boundary = Core.sanitizeBook({ session: { ...sessionBook.session, index: resumeIndex } }, kaoyan, new Set(sessionQueue));
  assert.equal(boundary.session.index, resumeIndex, `${resumeIndex}/50 breakpoint must be preserved`);
  assert.equal(boundary.session.queue[boundary.session.index], sessionQueue[resumeIndex], `${resumeIndex}/50 must continue at the next word`);
}

const changedIds = new Set(sessionQueue.filter(id => id !== sessionQueue[4] && id !== sessionQueue[24]));
const changedBook = Core.sanitizeBook(sessionBook, kaoyan, changedIds);
assert.equal(changedBook.session.queue.length, 48, "removed catalog entries must be dropped safely");
assert.equal(changedBook.session.index, 19, "catalog changes must preserve the completed-prefix position");
assert.equal(changedBook.session.queue[changedBook.session.index], sessionQueue[20], "catalog changes must still resume at the first unfinished word");

const sessionState = Core.sanitizeV4({
  version: Core.VERSION,
  selectedBookId: kaoyan.bookId,
  books: { [kaoyan.bookId]: sessionBook }
}, manifest, catalogs);
const source = new MemoryStorage({ xiaoluXiaogVocabularyV2: JSON.stringify(sessionState) });
const payload = backup.createBackup(source, new Date(at));
assert.equal(payload.modules.english.entries.xiaoluXiaogVocabularyV2.value.books[kaoyan.bookId].session.index, 20);
const restoredStorage = new MemoryStorage();
assert.ok(backup.restoreBackup(payload, restoredStorage).restored.includes("xiaoluXiaogVocabularyV2"));
const restored = Core.sanitizeV4(JSON.parse(restoredStorage.getItem("xiaoluXiaogVocabularyV2")), manifest, catalogs);
assert.deepEqual(restored.books[kaoyan.bookId].session.queue, sessionQueue, "backup restore must preserve the unfinished queue");
assert.equal(restored.books[kaoyan.bookId].session.index, 20, "backup restore must preserve the resume index");

const summary = Core.report({ ...migrated, mastery: { ...migrated.mastery, adapt: mastery } }, manifest, Date.parse("2026-09-10T00:00:00.000Z"));
assert.equal(summary.counts.simple, 2);
assert.deepEqual(summary.books.map(book => book.bookId), ["kaoyan-complete", "cet6", "academic-priority"]);

console.log("PASS v2.7.1 study core: migration, shared mastery, SRS, 20/50 resume, catalog defense, backup restore and report");
