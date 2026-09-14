import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChrome, startStaticServer } from "./qa-browser-helper.mjs";

const chrome = resolveChrome(), server = await startStaticServer(8769), profile = await mkdtemp(join(tmpdir(), "xiaolu-v26-")), proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9336", `--user-data-dir=${profile}`, "about:blank"]), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, nextId = 0; const waiting = new Map();
async function connect() { for (let i = 0; i < 30; i++) { try { const tabs = await fetch("http://127.0.0.1:9336/json/list").then(response => response.json()), page = tabs.find(tab => tab.type === "page"); if (!page) throw new Error(); socket = new WebSocket(page.webSocketDebuggerUrl); await new Promise((ok, bad) => { socket.onopen = ok; socket.onerror = bad; }); socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); } }; return; } catch { await pause(100); } } throw new Error("Chrome DevTools connection failed"); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++nextId; waiting.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result)); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
async function open(path, width = 390) { await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: true }); await send("Page.navigate", { url: `http://127.0.0.1:8769/${path}` }); for (let i = 0; i < 30; i++) { await pause(80); if (await evaluate(`location.pathname.endsWith(${JSON.stringify(path)})&&document.readyState==='complete'`)) return; } throw new Error(`Timed out loading ${path}`); }
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function assert(condition, message) { if (!condition) throw new Error(message); }

try {
  await connect(); await send("Page.enable"); await send("Runtime.enable"); await open("graduate-journey.html", 320);
  await evaluate("localStorage.removeItem('xiaoluXiaogGraduateJourneyV1')"); await open("graduate-journey.html", 320);
  await assert(await evaluate("document.querySelector('#journey-date-range').textContent.includes('2026年9月')&&document.querySelector('#journey-date-range').textContent.includes('2029年6月（预计）')"), "default month-only journey dates were not rendered");
  await click("#open-settings"); await evaluate("document.querySelector('#graduation-date').value='2029-06-15';document.querySelector('#journey-settings-form').requestSubmit()");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogGraduateJourneyV1')).settings.graduationDate==='2029-06-15'"), "specific graduation date did not persist");
  await click("#add-milestone"); await evaluate("document.querySelector('#milestone-title-input').value='完成开题报告';document.querySelector('#milestone-stage').value='year2';document.querySelector('#milestone-category').value='科研';document.querySelector('#milestone-date').value='2027-10-01';document.querySelector('#milestone-estimated').checked=true;document.querySelector('#milestone-status').value='doing';document.querySelector('#milestone-note').value='先完成文献脉络';document.querySelector('#milestone-form').requestSubmit()");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogGraduateJourneyV1')).milestones[0].title==='完成开题报告'&&document.querySelectorAll('.milestone-card').length===1"), "milestone create failed");
  await click('[data-stage-filter="year1"]'); await assert(await evaluate("document.querySelectorAll('.milestone-card').length===0"), "stage filter failed");
  await click('[data-stage-filter="year2"]'); await click('.milestone-card [data-action="edit"]'); await evaluate("document.querySelector('#milestone-status').value='done';document.querySelector('#milestone-form').requestSubmit()");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogGraduateJourneyV1')).milestones[0].status==='done'"), "milestone edit failed");
  await evaluate("window.confirm=()=>true"); await click('.milestone-card [data-action="delete"]'); await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogGraduateJourneyV1')).milestones.length===0"), "milestone delete failed");
  await open("index.html", 390); await assert(await evaluate("document.querySelector('.graduate-summary-card')&&document.querySelector('#home-journey-percent').textContent.endsWith('%')"), "home journey summary failed");
  console.log("PASS v2.6 browser: settings, month precision, milestone CRUD/filter and home journey summary");
} finally { proc.kill(); server.close(); }
