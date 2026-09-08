import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const exercise = require("./js/exercise-storage.js");
const timeline = require("./js/timeline-storage.js");
const notes = require("./js/notes-storage.js");

const fakeStorage = raw => ({ getItem: () => raw, setItem(key, value) { this.saved = { key, value }; } });
const broken = fakeStorage("{bad json");
assert.equal(exercise.load(broken).locked, true, "malformed exercise data must be protected");
assert.equal(timeline.load(broken).locked, true, "malformed timeline data must be protected");
assert.equal(notes.load(broken).locked, true, "malformed notes data must be protected");
assert.equal(exercise.load(fakeStorage('{"schemaVersion":2,"records":[]}')).locked, true, "future exercise schema must be read-only");

const exerciseState = exercise.normalizeState({ records: [null, { type: "有氧", durationMinutes: "35", status: "completed", posturePhotoRefs: ["future-photo-id", 2] }] });
assert.equal(exerciseState.schemaVersion, 1);
assert.equal(exerciseState.records.length, 1);
assert.equal(exerciseState.records[0].durationMinutes, 35);
assert.deepEqual(exerciseState.records[0].posturePhotoRefs, ["future-photo-id"]);
assert.equal(exercise.normalizeRecord({ type: "未知类型" }).type, "臀腿");
assert.notEqual(exercise.normalizeRecord({ date: "2026-99-99" }).date, "2026-99-99");

const memory = timeline.normalizeMemory({ title: " 海边 ", tags: "旅行，第一次,旅行", source: { module: "footprints", itemId: 42 }, links: { wishIds: ["w1", null] } });
assert.equal(memory.title, "海边");
assert.deepEqual(memory.tags, ["旅行", "第一次"]);
assert.equal(memory.source.module, "footprints");
assert.equal(memory.source.itemId, "42");
assert.deepEqual(memory.links.wishIds, ["w1"]);
assert.equal(timeline.normalizeMemory({ imageRef: "javascript:alert(1)" }).imageRef, "");

const noteState = notes.normalizeState({ notes: [{ title: "想法", category: "不存在", tags: ["科研", "科研"] }] });
assert.equal(noteState.notebooks[0].id, "default");
assert.equal(noteState.notes[0].category, "其他");
assert.deepEqual(noteState.notes[0].tags, ["科研"]);
const saved = fakeStorage(null);
assert.equal(notes.save(noteState, saved), true);
assert.equal(saved.saved.key, notes.KEY);
assert.equal(JSON.parse(saved.saved.value).schemaVersion, 1);

const values = new Map([["legacySentinel", "keep-me"]]);
const isolatedStorage = { getItem:key=>values.has(key)?values.get(key):null, setItem:(key,value)=>values.set(key,value) };
assert.equal(exercise.save(exerciseState, isolatedStorage), true);
assert.equal(timeline.save({ memories:[memory] }, isolatedStorage), true);
assert.equal(notes.save(noteState, isolatedStorage), true);
assert.equal(values.get("legacySentinel"), "keep-me");
assert.deepEqual([...values.keys()].sort(), [exercise.KEY, "legacySentinel", notes.KEY, timeline.KEY].sort());

console.log("PASS v2.2 core: independent schemas, normalization, malformed JSON protection, storage isolation, references, notebook model");
