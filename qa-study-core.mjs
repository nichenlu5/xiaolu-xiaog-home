import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const Core = require("./js/study-core.js");
const manifest = JSON.parse(await readFile(new URL("./data/wordbooks/manifest.json", import.meta.url), "utf8"));
const catalogs = {};
for (const meta of manifest) {
  catalogs[meta.bookId] = JSON.parse(await readFile(new URL(meta.file, import.meta.url), "utf8")).words;
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

const summary = Core.report({ ...migrated, mastery: { ...migrated.mastery, adapt: mastery } }, manifest, Date.parse("2026-09-10T00:00:00.000Z"));
assert.equal(summary.counts.simple, 2);
assert.ok(summary.books.every(book => ["kaoyan-complete", "cet6"].includes(book.bookId)));

console.log("PASS v2.1 core: v3 migration, archived progress, shared mastery, directional SRS, meaning tiers, anomaly filtering, report");
