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
  const pages = ["game-hall.html", "game.html", "lyrics.html", "timer.html", "sync.html", "memory.html", "world.html", "province.html"];
  for (const width of [360, 375, 390, 412, 430, 768, 1024]) for (const page of pages) { await open(page, width); const sizes = await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})"); await assert(sizes.scroll <= sizes.client, `${page} overflows at ${width}px: ${sizes.scroll}/${sizes.client}`); }

  await open("memory.html", 360); await click('[data-mode="solo"]');
  const pairs = await evaluate(`Object.values([...document.querySelectorAll('.memory-card')].reduce((a,b)=>{const k=b.querySelector('.card-face').textContent;(a[k]??=[]).push(b.dataset.index);return a},{}))`);
  for (const pair of pairs) { for (const i of pair) await click(`[data-index="${i}"]`); await pause(20); }
  await pause(100); await assert(await evaluate("!document.querySelector('#memory-result').hidden"), "memory solo did not finish");
  await open("memory.html", 360); await click('[data-mode="battle"]'); const mismatch = await evaluate(`(()=>{const c=[...document.querySelectorAll('.memory-card')];for(let i=1;i<c.length;i++)if(c[0].querySelector('.card-face').textContent!==c[i].querySelector('.card-face').textContent)return [0,i]})()`); for (const i of mismatch) await click(`[data-index="${i}"]`); await pause(900); await assert((await evaluate("document.querySelector('#turn-note').textContent")).includes("小G"), "memory battle did not switch player after mismatch"); const battlePairs = await evaluate(`Object.values([...document.querySelectorAll('.memory-card')].reduce((a,b)=>{const k=b.querySelector('.card-face').textContent;(a[k]??=[]).push(b.dataset.index);return a},{}))`); for (const pair of battlePairs) { for (const i of pair) await click(`[data-index="${i}"]`); await pause(20); } await assert(await evaluate("!document.querySelector('#memory-result').hidden"), "memory battle did not finish");

  for (const worldMode of ["country", "city"]) { await open("world.html", 390); await click(`[data-world-mode="${worldMode}"]`); for (let i=0;i<10;i++) { await click("#guess-button"); const answer = await evaluate(`(()=>{const clue=document.querySelector('#clue-list p').textContent;return WorldQuestions.${worldMode}.find(q=>q[1]===clue)[0]})()`); await click(`[data-answer="${answer}"]`); await pause(950); } await assert(await evaluate("!document.querySelector('#world-result').hidden"), `world ${worldMode} did not finish`); }
  for (const layer of [1,2,3,4]) { await open("world.html", 390); await click('[data-world-mode="country"]'); for(let i=1;i<layer;i++) await click("#next-clue"); await click("#guess-button"); const answer = await evaluate(`(()=>{const clue=document.querySelector('#clue-list p').textContent;return WorldQuestions.country.find(q=>q[1]===clue)[0]})()`); await click(`[data-answer="${answer}"]`); await pause(50); const actual = Number(await evaluate("document.querySelector('#world-score').textContent")); await assert(actual === 5-layer, `world layer ${layer} awarded ${actual}, expected ${5-layer}`); }

  for (const total of [10,20]) { await open("province.html", 430); await click(`[data-total="${total}"]`); for (let i=0;i<total;i++) { const province = await evaluate(`ProvinceQuestions.find(q=>q.city===document.querySelector('#province-city').textContent).province`); await click(`[data-province="${province}"]`); await pause(820); } await assert(await evaluate("!document.querySelector('#province-result').hidden"), `province ${total} did not finish`); }
  await open("province.html", 430); const saved = await evaluate(`JSON.parse(localStorage.getItem('xiaoluXiaogArcadeV1'))`); await assert(saved.memoryBest.normal.time !== null && saved.worldBest.country > 0 && saved.worldBest.city > 0 && saved.provinceBest.ten === 10 && saved.provinceBest.twenty === 20, "localStorage records were not persisted");
  console.log("PASS responsive: 8 pages × 7 viewports; memory solo/battle complete; world country/city + 4/3/2/1 scoring; province 10/20; localStorage persistence");
} finally { proc.kill(); }
