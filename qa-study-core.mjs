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
assert.equal(mastery.status, "known", "compatibility status must follow recognition instead of the weaker direction");
assert.equal(mastery.directions["en-zh"].status, "known");
assert.equal(mastery.directions["zh-en"].status, "unknown");
assert.equal(Core.isDue(mastery, Date.parse("2026-09-09T00:00:01.000Z")), true);
mastery = Core.rateMastery(mastery, "adapt", "simple", "en-zh", at);
assert.equal(mastery.status, "simple");
assert.equal(mastery.directions["en-zh"].status, "simple", "recognition simple must update only recognition");
assert.equal(mastery.directions["zh-en"].status, "unknown", "recognition simple must not overwrite production");
assert.deepEqual(Core.dueDirections(mastery, Date.parse("2026-09-09T00:00:01.000Z")), ["zh-en"]);

let productionSimple = Core.rateMastery(null, "produce", "known", "en-zh", at);
productionSimple = Core.rateMastery(productionSimple, "produce", "simple", "zh-en", at);
assert.equal(productionSimple.directions["en-zh"].status, "known", "production simple must not overwrite recognition");
assert.equal(productionSimple.directions["zh-en"].status, "simple");

assert.equal(Core.checkSpelling("significant", "significant"), "correct");
assert.equal(Core.checkSpelling("Significant", "significant"), "correct");
assert.equal(Core.checkSpelling(" significant ", "significant"), "correct");
assert.equal(Core.checkSpelling("signficant", "significant"), "close", "a small typo should allow another attempt");
assert.equal(Core.checkSpelling("different", "significant"), "wrong", "unrelated words must not be accepted as close");

const firstKnown = Core.rateMastery(null, "resolution", "known", "en-zh", "2026-09-01T00:00:00.000Z");
assert.equal(firstKnown.nextReviewAt, "2026-09-08T00:00:00.000Z", "first known rating must schedule a future review");
const secondKnown = Core.rateMastery(firstKnown, "resolution", "known", "en-zh", "2026-09-08T00:00:00.000Z");
assert.equal(secondKnown.nextReviewAt, "2026-09-22T00:00:00.000Z", "consecutive known ratings must increase the interval");
const forgotten = Core.rateMastery(secondKnown, "resolution", "unknown", "en-zh", "2026-09-09T00:00:00.000Z");
assert.equal(forgotten.nextReviewAt, "2026-09-10T00:00:00.000Z", "unknown must reset a stable word to a short interval");
assert.equal(forgotten.directions["en-zh"].streak, 0);
const fuzzy = Core.rateMastery(secondKnown, "resolution", "fuzzy", "en-zh", "2026-09-09T00:00:00.000Z");
assert.equal(fuzzy.nextReviewAt, "2026-09-12T00:00:00.000Z", "fuzzy must use the short three-day interval");

const eligibilityWords = [
  { id: "new", word: "new" },
  { id: "known", word: "known" },
  { id: "due", word: "due" },
  { id: "simple", word: "simple" },
  { id: "malformed", word: "malformed" }
];
const eligibilityMastery = {
  known: Core.rateMastery(null, "known", "known", "en-zh", "2026-09-08T00:00:00.000Z"),
  due: Core.rateMastery(null, "due", "unknown", "en-zh", "2026-09-01T00:00:00.000Z"),
  simple: Core.rateMastery(null, "simple", "simple", "en-zh", "2026-09-08T00:00:00.000Z"),
  malformed: { status: "broken", nextReviewAt: "not-a-date" }
};
assert.deepEqual(Core.eligibleSlice(eligibilityWords, eligibilityMastery, 0, 10).ids, ["new", "malformed"], "daily eligibility must include only unseen valid data");
assert.deepEqual(Core.prioritizeDueWords(eligibilityWords, eligibilityMastery, Date.parse("2026-09-10T00:00:00.000Z")).map(word => word.id), ["due"], "due words must be isolated in review");

const splitDue = Core.rateMastery(
  Core.rateMastery(null, "split", "known", "en-zh", "2026-09-01T00:00:00.000Z"),
  "split", "known", "zh-en", "2026-09-09T00:00:00.000Z"
);
assert.deepEqual(Core.dueDirections(splitDue, Date.parse("2026-09-08T00:00:00.000Z")), ["en-zh"], "recognition due must select recognition only");
const productionDue = Core.rateMastery(
  Core.rateMastery(null, "split", "known", "en-zh", "2026-09-09T00:00:00.000Z"),
  "split", "unknown", "zh-en", "2026-09-01T00:00:00.000Z"
);
assert.deepEqual(Core.dueDirections(productionDue, Date.parse("2026-09-02T00:00:00.000Z")), ["zh-en"], "production due must select production only");

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
assert.deepEqual(sessionBook.session.directionRatings, { "en-zh": 20, "zh-en": 0 }, "legacy unfinished sessions must derive completed direction counts");
for (const resumeIndex of [1, 49]) {
  const boundary = Core.sanitizeBook({ session: { ...sessionBook.session, index: resumeIndex } }, kaoyan, new Set(sessionQueue));
  assert.equal(boundary.session.index, resumeIndex, `${resumeIndex}/50 breakpoint must be preserved`);
  assert.equal(boundary.session.queue[boundary.session.index], sessionQueue[resumeIndex], `${resumeIndex}/50 must continue at the next word`);
}

const spellingResume = Core.sanitizeBook({
  session: {
    mode: "daily", queue: sessionQueue, round: 1, index: 4, ratings: { fuzzy: 1 },
    directionRatings: { "en-zh": 50, "zh-en": 3 }, startedAt: at,
    spelling: { wordId: sessionQueue[4], attempts: 1, hadClose: true, resolved: false, result: "" }
  }
}, kaoyan, new Set(sessionQueue));
assert.equal(spellingResume.session.index, 4);
assert.deepEqual(spellingResume.session.spelling, { wordId: sessionQueue[4], attempts: 1, hadClose: true, hadWrong: false, resolved: false, result: "" }, "unfinished spelling attempt must resume without persisting an answer");

const reviewResume = Core.sanitizeBook({
  session: {
    mode: "review", queue: sessionQueue.slice(0, 2), round: 0, index: 0, startedAt: at,
    reviewDirections: { [sessionQueue[0]]: ["en-zh"], [sessionQueue[1]]: ["zh-en"] }
  }
}, kaoyan, new Set(sessionQueue));
assert.deepEqual(reviewResume.session.reviewDirections[sessionQueue[0]], ["en-zh"]);
assert.deepEqual(reviewResume.session.reviewDirections[sessionQueue[1]], ["zh-en"]);

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

const activeDayState = Core.sanitizeV4({
  version: Core.VERSION,
  selectedBookId: kaoyan.bookId,
  books: { [kaoyan.bookId]: { session: { mode: "daily", queue: sessionQueue, index: 5, ratings: { known: 5 }, startedAt: at } } }
}, manifest, catalogs);
assert.equal(Core.report(activeDayState, manifest, Date.parse(at)).studyDays, 1, "an in-progress session with ratings must count as a study day");

const srsBackupState = structuredClone(sessionState);
srsBackupState.mastery.resolution = secondKnown;
const srsBackup = backup.createBackup(new MemoryStorage({ xiaoluXiaogVocabularyV2: JSON.stringify(srsBackupState) }), new Date(at));
const srsTarget = new MemoryStorage();
backup.restoreBackup(srsBackup, srsTarget);
const srsRestored = Core.sanitizeV4(JSON.parse(srsTarget.getItem("xiaoluXiaogVocabularyV2")), manifest, catalogs);
assert.equal(srsRestored.mastery.resolution.nextReviewAt, secondKnown.nextReviewAt, "backup restore must preserve nextReviewAt");
assert.equal(srsRestored.mastery.resolution.directions["en-zh"].streak, 2, "backup restore must preserve SRS streak");

const splitBackupState = structuredClone(sessionState);
splitBackupState.mastery.adapt = mastery;
splitBackupState.books[kaoyan.bookId] = spellingResume;
const splitBackup = backup.createBackup(new MemoryStorage({ xiaoluXiaogVocabularyV2: JSON.stringify(splitBackupState) }), new Date(at));
const splitTarget = new MemoryStorage();
backup.restoreBackup(splitBackup, splitTarget);
const splitRestored = Core.sanitizeV4(JSON.parse(splitTarget.getItem("xiaoluXiaogVocabularyV2")), manifest, catalogs);
assert.equal(splitRestored.mastery.adapt.directions["en-zh"].status, "simple");
assert.equal(splitRestored.mastery.adapt.directions["zh-en"].status, "unknown");
assert.equal(splitRestored.mastery.adapt.directions["zh-en"].nextReviewAt, mastery.directions["zh-en"].nextReviewAt);
assert.equal(splitRestored.books[kaoyan.bookId].session.spelling.attempts, 1, "backup restore must preserve the unfinished spelling attempt");
assert.equal(splitRestored.books[kaoyan.bookId].session.directionRatings["zh-en"], 3);

console.log("PASS v2.8 study core: independent recognition/production, spelling tolerance, directional SRS, migration, fixed resume and backup restore");
