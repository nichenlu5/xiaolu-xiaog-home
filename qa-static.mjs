import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const htmlFiles = [
  "index.html", "study.html", "wishlist.html", "footprints.html", "game-hall.html",
  "game.html", "lyrics.html", "timer.html", "sync.html", "memory.html", "world.html",
  "province.html", "literature.html", "pi-memory.html", "clue-guess.html",
  "speed-quiz.html", "achievements.html"
];

for (const htmlFile of htmlFiles) {
  const html = await readFile(resolve(root, htmlFile), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${htmlFile} contains duplicate IDs`);
  const assets = [...html.matchAll(/(?:href|src)="(\.\/[^"#?]+)"/g)].map(match => match[1]);
  for (const asset of assets) await access(resolve(root, asset));
}

for (const file of ["data/wordbooks/manifest.json", "data/study-practice.json", "data/home-modules.json"]) {
  JSON.parse(await readFile(resolve(root, file), "utf8"));
}

const studyHtml = await readFile(resolve(root, "study.html"), "utf8");
const studyJs = await readFile(resolve(root, "js/study.js"), "utf8");
const studyIds = new Set([...studyHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const referencedIds = new Set([...studyJs.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]));
for (const id of referencedIds) assert.ok(studyIds.has(id), `js/study.js references missing #${id}`);

for (const file of ["js/study-core.js", "js/study.js", "qa-study-core.mjs", "qa-study.mjs", "qa-responsive.mjs"]) {
  execFileSync(process.execPath, ["--check", resolve(root, file)], { stdio: "pipe" });
}

console.log(`PASS static QA: ${htmlFiles.length} pages, local assets, unique IDs, JSON, study DOM bindings, JavaScript syntax`);
