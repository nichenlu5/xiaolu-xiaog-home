import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChrome, startStaticServer } from "./qa-browser-helper.mjs";

const chrome = resolveChrome();
const server = await startStaticServer();
const profile = await mkdtemp(join(tmpdir(), "xiaolu-v21-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--remote-debugging-port=9444", `--user-data-dir=${profile}`, "about:blank"]);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let nextId = 0;
const waiting = new Map();

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const tabs = await fetch("http://127.0.0.1:9444/json/list").then(response => response.json());
      const page = tabs.find(tab => tab.type === "page");
      socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = reject; });
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id && waiting.has(message.id)) {
          waiting.get(message.id)(message);
          waiting.delete(message.id);
        }
      };
      return;
    } catch {
      await pause(100);
    }
  }
  throw new Error("Chrome connection failed");
}

function send(method, params = {}) {
  return new Promise((resolveSend, reject) => {
    const id = ++nextId;
    waiting.set(id, message => message.error ? reject(new Error(message.error.message)) : resolveSend(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function open(path, width = 390) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `http://127.0.0.1:8765/${path}` });
  for (let i = 0; i < 40; i++) {
    await pause(50);
    if (await evaluate("document.readyState==='complete'")) return;
  }
  throw new Error(`Timeout ${path}`);
}
async function assert(ok, message) { if (!ok) throw new Error(message); }
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function ready() {
  for (let i = 0; i < 50; i++) {
    if (await evaluate("document.querySelectorAll('#book-select option').length===2")) return;
    await pause(100);
  }
  throw new Error("study app did not initialize");
}

try {
  await connect();
  await send("Page.enable");
  await open("study.html");
  await ready();
  await assert(await evaluate("JSON.stringify([...document.querySelectorAll('#book-select option')].map(x=>x.textContent))===JSON.stringify(['考研词汇（4,787 词）','CET-6（5,371 词）'])"), "v2.1 main wordbooks failed");

  await evaluate(`localStorage.clear();localStorage.setItem('v21Sentinel','keep-me');localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify({
    version:3,selectedBookId:'kaoyan-required',books:{
      'kaoyan-required':{currentPosition:51,learned:{'kaoyan-required-00001':{lastSeenAt:'2026-09-06T00:00:00.000Z'}},wrong:{'kaoyan-required-00002':{lastWrongAt:'2026-09-07T00:00:00.000Z'}},skipped:{'kaoyan-required-00003':{at:'2026-09-05T00:00:00.000Z',word:'state'}},history:[],session:null},
      cet6:{currentPosition:12,learned:{},wrong:{},skipped:{},history:[],session:null}
    }}));location.reload()`);
  await pause(450);
  await ready();
  await assert(await evaluate("StudyApp.getState().version===4 && StudyApp.getState().selectedBookId==='kaoyan-complete'"), "v3 to v4 migration failed");
  await assert(await evaluate("StudyApp.getState().legacyBooks['kaoyan-required'].currentPosition===51 && StudyApp.getState().books.cet6.currentPosition===12"), "retired or active book progress was lost");
  await assert(await evaluate("StudyApp.getState().mastery.government.status==='known' && StudyApp.getState().mastery.system.status==='unknown' && StudyApp.getState().mastery.state.status==='simple'"), "legacy mastery conversion failed");
  await assert(await evaluate("localStorage.getItem('v21Sentinel')==='keep-me'"), "migration touched unrelated localStorage");

  await click("#start-button");
  await assert(await evaluate("StudyApp.getBook().session.queue.length===50 && StudyApp.getBook().session.queue[0]==='kaoyan-complete-00001'"), "daily 50/order failed");
  await click("#reveal-button");
  await click('[data-rating="unknown"]');
  await click("#reveal-button");
  await click('[data-rating="simple"]');
  await assert(await evaluate("StudyApp.getBook().session.queue.length===50 && StudyApp.getBook().session.queue[49]==='kaoyan-complete-00051'"), "too-simple did not refill daily goal");
  await assert(await evaluate("Object.values(StudyApp.getState().mastery).some(x=>x.status==='unknown') && Object.values(StudyApp.getState().mastery).some(x=>x.status==='simple')"), "four-level mastery was not saved");
  await evaluate("(()=>{while(StudyApp.getBook().session.round===0)StudyApp.rate('known');for(let i=0;i<3;i++)StudyApp.rate('known')})()");
  await click("#exit-button");
  await open("study.html");
  await ready();
  await assert(await evaluate("!document.querySelector('#resume-banner').hidden && StudyApp.getBook().session.round===1 && StudyApp.getBook().session.index===3"), "breakpoint resume failed");
  await click("#resume-button");
  await evaluate("(()=>{while(StudyApp.getBook().session)StudyApp.rate('known')})()");
  await assert(await evaluate("StudyApp.getBook().history.length===1 && StudyApp.getBook().currentPosition===51"), "completion/history/cursor failed");

  await click("#result-home");
  await evaluate("(()=>{const s=StudyApp.getState();const key=Object.keys(s.mastery).find(k=>s.mastery[k].status==='unknown');s.mastery[key].nextReviewAt='2000-01-01T00:00:00.000Z';s.mastery[key].directions['en-zh'].nextReviewAt='2000-01-01T00:00:00.000Z';localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify(s));location.reload()})()");
  await pause(350);
  await ready();
  await assert(await evaluate("StudyApp.dueIds().length>0 && !document.querySelector('#review-button').disabled"), "due review scheduling failed");

  const sharedWord = await evaluate("(async()=>{const first=StudyApp.getWords()[0].word;StudyApp.getState().mastery[first.toLowerCase()]={word:first,status:'fuzzy',updatedAt:new Date().toISOString(),nextReviewAt:new Date().toISOString(),directions:{'en-zh':{status:'fuzzy',updatedAt:new Date().toISOString(),nextReviewAt:new Date().toISOString(),streak:0,misses:0}}};await StudyApp.loadBook('cet6');return first})()");
  await assert(await evaluate(`StudyApp.getState().mastery[${JSON.stringify(sharedWord.toLowerCase())}].status==='fuzzy' && StudyApp.getBook().currentPosition===12`), "shared mastery or independent book progress failed");

  await click("#collocation-button");
  await assert(await evaluate("document.querySelector('#practice-dialog').open && document.querySelectorAll('[data-practice-answer]').length>=2"), "collocation practice structure failed");
  await click('[data-close="practice-dialog"]');
  await click("#confusable-button");
  await assert(await evaluate("document.querySelector('#practice-dialog').open && document.querySelector('#practice-title').textContent.includes('易混词')"), "confusable practice structure failed");
  await click('[data-close="practice-dialog"]');
  await click("#report-button");
  await assert(await evaluate("document.querySelector('#report-dialog').open && document.querySelectorAll('.book-report article').length===2"), "learning report failed");
  await click('[data-close="report-dialog"]');

  const backup = await evaluate("JSON.stringify({app:'xiaolu-xiaog-vocabulary',schemaVersion:4,data:StudyApp.getState()})");
  await evaluate("localStorage.setItem('xiaoluXiaogVocabularyV2','{broken');location.reload()");
  await pause(250);
  await assert(await evaluate("localStorage.getItem('xiaoluXiaogVocabularyV2')==='{broken' && localStorage.getItem('v21Sentinel')==='keep-me'"), "malformed storage was overwritten");
  await evaluate(`(()=>{const file=new File([${JSON.stringify(backup)}],'backup.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await pause(350);
  await assert(await evaluate("StudyApp.getState().version===4 && localStorage.getItem('v21Sentinel')==='keep-me'"), "validated import or storage isolation failed");

  for (const width of [320, 360, 390, 430, 1024]) {
    await open("study.html", width);
    await ready();
    const size = await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})");
    await assert(size.scroll <= size.client, `study overflow ${width}`);
  }
  await open("index.html", 320);
  await assert(await evaluate("!!document.querySelector('a[href=\"./study.html\"]')"), "home study entry missing");
  console.log("PASS v2.1 browser: two main books; v3 migration; shared mastery; independent progress; four ratings; active recall; SRS; practice; report; safe storage; import; responsive");
} finally {
  proc.kill();
  server.close();
}
