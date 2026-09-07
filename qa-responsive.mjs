import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(join(tmpdir(), "xiaolu-v14-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "about:blank"]);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, nextId = 0; const waiting = new Map();
async function connect() {
  for (let i = 0; i < 30; i++) { try { const tabs = await fetch("http://127.0.0.1:9333/json/list").then(r => r.json()); const page = tabs.find(t => t.type === "page" && t.url === "about:blank") || tabs.find(t => t.type === "page"); if (!page) throw new Error("page target unavailable"); socket = new WebSocket(page.webSocketDebuggerUrl); await new Promise((ok, bad) => { socket.onopen = ok; socket.onerror = bad; }); socket.onmessage = e => { const msg = JSON.parse(e.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } }; return; } catch { await pause(100); } } throw new Error("Chrome DevTools connection failed");
}
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; waiting.set(id, msg => msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression, awaitPromise = true) { const r = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
async function open(path, width) { await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: true }); await send("Page.navigate", { url: `http://127.0.0.1:8765/${path}` }); for (let i=0;i<20;i++) { await pause(50); if (await evaluate(`location.pathname.endsWith(${JSON.stringify(path)}) && document.readyState==='complete'`)) return; } throw new Error(`Timed out loading ${path}: ${await evaluate('location.href')}`); }
async function assert(condition, message) { if (!condition) throw new Error(message); }
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }

try {
  await connect(); await send("Page.enable"); await send("Runtime.enable");
  const pages = ["index.html", "wishlist.html", "game-hall.html", "game.html", "lyrics.html", "timer.html", "sync.html", "memory.html", "world.html", "province.html", "achievements.html"];
  for (const width of [360, 375, 390, 412, 430, 768, 1024]) for (const page of pages) { await open(page, width); const sizes = await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})"); await assert(sizes.scroll <= sizes.client, `${page} overflows at ${width}px: ${sizes.scroll}/${sizes.client}`); }

  await open("wishlist.html", 390);
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).length === 3"), "wishlist did not initialize exactly once");
  await assert(await evaluate("document.querySelector('#tab-count-todo').textContent === '2' && document.querySelector('#tab-count-doing').textContent === '1' && document.querySelector('#tab-count-done').textContent === '0'"), "wishlist initial counts are incorrect");
  await evaluate("localStorage.setItem('xiaoluLegacySentinel', 'keep-me')");
  await click("#add-wish");
  await evaluate(`document.querySelector('#wish-title').value='一起看一次海上日出'; document.querySelector('#wish-note').value='带上热饮，慢慢等天亮。'`);
  await click("#wish-form button[type=submit]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海上日出')"), "wishlist item was not saved");
  await assert(await evaluate("document.querySelector('#total-count').textContent === '4' && document.querySelector('#tab-count-todo').textContent === '3'"), "wishlist counts did not update after adding");
  await open("wishlist.html", 390);
  await assert(await evaluate("document.querySelector('.wish-card h2').textContent === '一起看一次海上日出'"), "wishlist item did not persist after refresh");
  await click(".wish-card [data-action=edit]");
  await evaluate(`document.querySelector('#wish-title').value='一起看一次海边日出'`);
  await click("#wish-form button[type=submit]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出' && item.updatedAt)"), "wishlist edit failed");
  await click(".wish-card [data-action=doing]");
  await click("#tab-doing");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出' && item.status === 'doing')"), "todo to doing failed");
  await click("#panel-doing .wish-card [data-action=done]");
  await click("#tab-done");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出' && item.status === 'done' && item.completedAt)"), "doing to done failed");
  await assert((await evaluate("document.querySelector('#panel-done .wish-card h2').textContent")) === "一起看一次海边日出", "completed items are not sorted newest first");
  await click("#panel-done .wish-card [data-action=doing]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出' && item.status === 'doing' && item.completedAt === null)"), "done to doing did not clear completedAt");
  await click("#tab-doing");
  await evaluate("window.confirm=()=>false");
  await click("#panel-doing .wish-card [data-action=delete]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出')"), "cancelled deletion removed item");
  await evaluate("window.confirm=()=>true");
  await click("#panel-doing .wish-card [data-action=delete]");
  await assert(await evaluate("!JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海边日出')"), "confirmed deletion failed");
  await assert(await evaluate("localStorage.getItem('xiaoluLegacySentinel') === 'keep-me'"), "wishlist changed unrelated localStorage data");
  console.log("PASS wishlist and responsive layouts");

  await open("memory.html", 360); await click('[data-mode="solo"]');
  const pairs = await evaluate(`Object.values([...document.querySelectorAll('.memory-card')].reduce((a,b)=>{const k=b.querySelector('.card-face').textContent;(a[k]??=[]).push(b.dataset.index);return a},{}))`);
  for (const pair of pairs) { for (const i of pair) await click(`[data-index="${i}"]`); await pause(20); }
  await pause(100); await assert(await evaluate("!document.querySelector('#memory-result').hidden"), "memory solo did not finish");
  await open("memory.html", 360); await click('[data-mode="battle"]'); const mismatch = await evaluate(`(()=>{const c=[...document.querySelectorAll('.memory-card')];for(let i=1;i<c.length;i++)if(c[0].querySelector('.card-face').textContent!==c[i].querySelector('.card-face').textContent)return [0,i]})()`); for (const i of mismatch) await click(`[data-index="${i}"]`); await pause(900); await assert((await evaluate("document.querySelector('#turn-note').textContent")).includes("小G"), "memory battle did not switch player after mismatch"); const battlePairs = await evaluate(`Object.values([...document.querySelectorAll('.memory-card')].reduce((a,b)=>{const k=b.querySelector('.card-face').textContent;(a[k]??=[]).push(b.dataset.index);return a},{}))`); for (const pair of battlePairs) { for (const i of pair) await click(`[data-index="${i}"]`); await pause(20); } await assert(await evaluate("!document.querySelector('#memory-result').hidden"), "memory battle did not finish");
  console.log("PASS memory regression");

  for (const worldMode of ["country", "city"]) { await open("world.html", 390); await click(`[data-world-mode="${worldMode}"]`); for (let i=0;i<10;i++) { await click("#guess-button"); const answer = await evaluate(`(()=>{const clue=document.querySelector('#clue-list p').textContent;return WorldQuestions.${worldMode}.find(q=>q[1]===clue)[0]})()`); await click(`[data-answer="${answer}"]`); await pause(950); } await assert(await evaluate("!document.querySelector('#world-result').hidden"), `world ${worldMode} did not finish`); }
  for (const layer of [1,2,3,4]) { await open("world.html", 390); await click('[data-world-mode="country"]'); for(let i=1;i<layer;i++) await click("#next-clue"); await click("#guess-button"); const answer = await evaluate(`(()=>{const clue=document.querySelector('#clue-list p').textContent;return WorldQuestions.country.find(q=>q[1]===clue)[0]})()`); await click(`[data-answer="${answer}"]`); await pause(50); const actual = Number(await evaluate("document.querySelector('#world-score').textContent")); await assert(actual === 5-layer, `world layer ${layer} awarded ${actual}, expected ${5-layer}`); }
  console.log("PASS world regression");

  for (const total of [10,20]) { await open("province.html", 430); await click(`[data-total="${total}"]`); for (let i=0;i<total;i++) { const province = await evaluate(`ProvinceQuestions.find(q=>q.city===document.querySelector('#province-city').textContent).province`); await click(`[data-province="${province}"]`); await pause(820); } await assert(await evaluate("!document.querySelector('#province-result').hidden"), `province ${total} did not finish`); }
  console.log("PASS province regression");
  await open("province.html", 430); const saved = await evaluate(`JSON.parse(localStorage.getItem('xiaoluXiaogArcadeV1'))`); await assert(saved.memoryBest.normal.time !== null && saved.worldBest.country > 0 && saved.worldBest.city > 0 && saved.provinceBest.ten === 10 && saved.provinceBest.twenty === 20, "localStorage records were not persisted");
  for (const category of ["classic", "pop", "random"]) {
    await open("lyrics.html", 390); await click(`[data-category="${category}"]`); const clues = [];
    for (let i=0;i<5;i++) { clues.push(await evaluate("document.querySelector('#clue').textContent")); await click("#options button"); await click("#g-options button"); await click("#next"); }
    await assert(new Set(clues).size === 5, `lyrics ${category} repeated a question`); await assert(await evaluate("!document.querySelector('#result').hidden"), `lyrics ${category} did not finish`);
  }
  await open("timer.html", 390);
  for (let i=0;i<3;i++) { await click("#timer-button"); await pause(5005); await click("#timer-button"); await pause(400); }
  await assert(await evaluate("!document.querySelector('#result').hidden"), "timer did not finish three rounds");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogArcadeV1')).timerHistory.length > 0"), "timer history was not persisted");
  await open("achievements.html", 390); await assert(await evaluate("document.querySelectorAll('.achievement-card').length === 16"), "achievement count mismatch"); await assert(await evaluate("document.querySelectorAll('.achievement-card.unlocked').length > 0"), "achievement unlock logic did not recognize history");
  console.log("PASS responsive: 11 pages × 7 viewports; wishlist CRUD/status/sorting/persistence; memory solo/battle; world scoring; province 10/20; lyrics 3 pools/no repeats; timer 3 rounds; 16 achievements; localStorage persistence");
} finally { proc.kill(); }
