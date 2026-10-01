(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StudyPdf = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAILY_WORD_COUNT = 50;
  const text = (value, max) => String(value || "").trim().slice(0, max);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);

  function createDailyPayload({ date, bookName, words } = {}) {
    if (!Array.isArray(words) || words.length !== DAILY_WORD_COUNT) return null;
    const cleanWords = words.map(item => ({
      id: text(item?.id, 120),
      word: text(item?.word, 120),
      phonetic: text(item?.phonetic, 120),
      meaning: text(item?.meaning, 800),
      source: item?.source === "academic" ? "Academic Priority" : "主词书"
    }));
    if (cleanWords.some(item => !item.id || !item.word || !item.meaning)) return null;
    return {
      date: text(date, 10),
      bookName: text(bookName, 120),
      count: cleanWords.length,
      words: cleanWords
    };
  }

  function buildPrintHtml(payload) {
    if (!payload || payload.count !== DAILY_WORD_COUNT || payload.words?.length !== DAILY_WORD_COUNT) {
      throw new Error("只有完整完成的今日 50 词可以导出。");
    }
    const rows = payload.words.map((item, index) => `
      <article class="word-row">
        <span class="index">${index + 1}</span>
        <div class="word"><strong>${escapeHtml(item.word)}</strong>${item.phonetic ? `<small>${escapeHtml(item.phonetic)}</small>` : ""}</div>
        <p>${escapeHtml(item.meaning)}</p>
        <span class="source">${escapeHtml(item.source)}</span>
      </article>`).join("");
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>今日 50 词 · ${escapeHtml(payload.date)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #342d2a; background: #fff; font-family: "Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei","PingFang SC",sans-serif; }
  header { margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 2px solid #d98b67; }
  h1 { margin: 0 0 2mm; font-size: 22px; }
  header p { margin: 0; color: #6f625d; font-size: 11px; }
  .word-row { display: grid; grid-template-columns: 8mm 42mm minmax(0,1fr) 25mm; gap: 3mm; align-items: start; min-height: 13mm; padding: 2.5mm 0; border-bottom: 1px solid #e8ded8; break-inside: avoid; }
  .index { color: #a46950; font-size: 10px; }
  .word strong { display: block; overflow-wrap: anywhere; font-size: 13px; }
  .word small { display: block; margin-top: 1mm; color: #7a6c66; font-size: 9px; }
  .word-row p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 10px; line-height: 1.5; }
  .source { color: #7b6d67; font-size: 8px; text-align: right; }
  footer { margin-top: 5mm; color: #8a7b75; font-size: 9px; text-align: center; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 12mm; } }
</style></head><body>
  <header><h1>今日 50 词复习单</h1><p>${escapeHtml(payload.date)} · ${escapeHtml(payload.bookName)} · 共 ${payload.count} 词</p></header>
  <main>${rows}</main>
  <footer>小路 × 小G · 一起学习</footer>
</body></html>`;
  }

  function openPrintView(payload, browserWindow = root) {
    const popup = browserWindow?.open?.("", "_blank");
    if (!popup) throw new Error("浏览器拦截了打印窗口，请允许弹窗后重试。");
    popup.opener = null;
    popup.document.open();
    popup.document.write(buildPrintHtml(payload));
    popup.document.close();
    const print = () => {
      popup.focus();
      popup.print();
    };
    if (popup.document.readyState === "complete") setTimeout(print, 0);
    else popup.addEventListener("load", () => setTimeout(print, 0), { once: true });
    return popup;
  }

  return { DAILY_WORD_COUNT, createDailyPayload, buildPrintHtml, openPrintView };
});
