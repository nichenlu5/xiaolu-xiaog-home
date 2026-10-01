import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Pdf = require("./js/study-pdf.js");
const words = Array.from({ length: 50 }, (_, index) => ({
  id: `word-${index + 1}`,
  word: index ? `word${index + 1}` : "significant",
  phonetic: index ? "" : "/sɪɡˈnɪfɪkənt/",
  meaning: index ? `第 ${index + 1} 个词的中文释义` : "adj. 重要的，显著的",
  source: index < 30 ? "academic" : "general"
}));

assert.equal(Pdf.createDailyPayload({ words: words.slice(0, 49) }), null, "incomplete daily sessions must not become exportable");
const payload = Pdf.createDailyPayload({ date: "2026-10-01", bookName: "考研完整词汇", words });
assert.equal(payload.count, 50);
assert.equal(payload.words.length, 50);
assert.equal(payload.words[0].source, "Academic Priority");
const html = Pdf.buildPrintHtml(payload);
assert.match(html, /<meta charset="utf-8">/);
assert.match(html, /今日 50 词复习单/);
assert.match(html, /重要的，显著的/);
assert.equal((html.match(/class="word-row"/g) || []).length, 50);
assert.throws(() => Pdf.buildPrintHtml({ ...payload, count: 49 }), /完整完成/);

const escaped = Pdf.createDailyPayload({ date: "2026-10-01", bookName: "<script>", words: words.map((word, index) => index ? word : { ...word, meaning: "<b>中文</b>" }) });
const escapedHtml = Pdf.buildPrintHtml(escaped);
assert.ok(!escapedHtml.includes("<script>"));
assert.ok(escapedHtml.includes("&lt;b&gt;中文&lt;/b&gt;"));

let written = "", printed = 0;
const popup = {
  document: { readyState: "complete", open() {}, write(value) { written = value; }, close() {} },
  focus() {},
  print() { printed++; }
};
assert.equal(Pdf.openPrintView(payload, { open: () => popup }), popup);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal((written.match(/class="word-row"/g) || []).length, 50);
assert.equal(printed, 1, "the completed print document must invoke the browser PDF/print flow once");
assert.throws(() => Pdf.openPrintView(payload, { open: () => null }), /拦截了打印窗口/);

console.log("PASS v2.9 daily vocabulary PDF: completion gate, 50-word fidelity, UTF-8 Chinese and safe print document");
