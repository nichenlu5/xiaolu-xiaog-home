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
  const pages = ["index.html", "wishlist.html", "game-hall.html", "game.html", "lyrics.html", "timer.html", "sync.html", "memory.html", "world.html", "province.html", "literature.html", "pi-memory.html", "clue-guess.html", "speed-quiz.html", "achievements.html"];
  for (const width of [360, 375, 390, 412, 430, 768, 1024]) for (const page of pages) { await open(page, width); const sizes = await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})"); await assert(sizes.scroll <= sizes.client, `${page} overflows at ${width}px: ${sizes.scroll}/${sizes.client}`); }

  await open("wishlist.html", 390);
  await assert(await evaluate("Array.isArray(window.XIAOLU_LEGACY_WISHLIST.items) && window.XIAOLU_LEGACY_WISHLIST.items.length === 450"), "legacy payload is not a 450-item array");
  await evaluate(`localStorage.removeItem('xiaoluXiaogWishlistMigrationVersion');localStorage.setItem('xiaoluXiaogWishlistV1',JSON.stringify([{id:'v16-kept',title:'v1.6 保留测试',note:'不能被覆盖',status:'doing',createdAt:'2026-09-01T00:00:00.000Z',updatedAt:'2026-09-01T00:00:00.000Z',completedAt:null}]))`);
  await open("wishlist.html", 390);
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).length === 451"), "v1.7 migration count is incorrect");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(x=>x.id==='v16-kept'&&x.source==='custom')"), "v1.6 item was not preserved");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).filter(x=>x.source==='legacy').length === 450 && new Set(JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).map(x=>x.id)).size===451"), "legacy data or stable IDs are incorrect");
  await open("wishlist.html", 390);
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).length === 451"), "legacy wishes were imported twice");
  await assert(await evaluate("document.querySelectorAll('#category-filter option').length === 22 && document.querySelectorAll('#difficulty-filter option').length === 5"), "legacy filters are incomplete");
  await assert(await evaluate("document.querySelectorAll('#panel-todo .wish-card').length === 60"), "large wishlist was not batch-rendered");
  await evaluate("localStorage.setItem('xiaoluLegacySentinel', 'keep-me')");
  await click("#add-wish");
  await evaluate(`document.querySelector('#wish-title').value='一起看一次海上日出'; document.querySelector('#wish-note').value='带上热饮，慢慢等天亮。'`);
  await click("#wish-form button[type=submit]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).some(item => item.title === '一起看一次海上日出')"), "wishlist item was not saved");
  await assert(await evaluate("document.querySelector('#total-count').textContent === '452' && document.querySelector('#tab-count-todo').textContent === '451'"), "wishlist counts did not update after adding");
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
  await click("#tab-todo");
  await evaluate(`document.querySelector('#wish-search').value='早安';document.querySelector('#wish-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  await assert(await evaluate("document.querySelector('#filter-summary').textContent === '当前找到 2 条'"), "search failed");
  await click("#panel-todo .wish-card [data-action=favorite]");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogWishlistV1')).find(x=>x.id==='legacy-001').favorite === true && document.querySelector('#favorite-count').textContent === '1'"), "favorite persistence or count failed");
  await click("#favorite-filter");
  await assert(await evaluate("document.querySelectorAll('#panel-todo .wish-card').length === 1"), "favorite combined filter failed");
  await click("#random-wish");
  await assert(await evaluate("document.querySelector('#random-dialog').open && document.querySelector('#random-title').textContent === '早安'"), "random draw did not use filtered results");
  await click(".random-close");
  await click("#clear-filters");
  await evaluate(`document.querySelector('#category-filter').value='21';document.querySelector('#category-filter').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#difficulty-filter').value='候选脑洞';document.querySelector('#difficulty-filter').dispatchEvent(new Event('change',{bubbles:true}))`);
  await assert(await evaluate("document.querySelector('#filter-summary').textContent === '当前找到 50 条'"), "category and difficulty combination failed");
  await evaluate(`document.querySelector('#wish-search').value='绝对不存在的愿望';document.querySelector('#wish-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  await assert(await evaluate("document.querySelector('.empty-wishes')?.textContent.includes('这里暂时没有符合条件的愿望')"), "zero-results state failed");
  await click("#random-wish");
  await assert(await evaluate("document.querySelector('#random-dialog').open && document.querySelector('#random-title').textContent === '暂时抽不到愿望'"), "zero-results random draw feedback failed");
  await click(".random-close");
  await click(".empty-wishes [data-action=clear-filters]");
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
  await open("game.html",390);await click('#solo-mode');for(let i=0;i<10;i++){await click('#options .option-button');await click('#next-button')}await assert(await evaluate("!document.querySelector('#result-area').hidden"),"knowledge quiz solo did not finish");
  await open("sync.html",390);for(let i=0;i<10;i++){await click('#options .arcade-option');await click('#g-options button');await click('#next')}await assert(await evaluate("!document.querySelector('#result').hidden"),"sync challenge did not finish");
  console.log("PASS knowledge quiz and sync regression");
  await open("achievements.html", 390); await assert(await evaluate("document.querySelectorAll('.achievement-card').length === 16"), "achievement count mismatch"); await assert(await evaluate("document.querySelectorAll('.achievement-card.unlocked').length > 0"), "achievement unlock logic did not recognize history");
  await open("literature.html", 390); await click('[data-lit-mode="classics"]');
  for(let i=0;i<10;i++){const a=await evaluate("LiteratureData.classics.find(q=>q.q===document.querySelector('.challenge-question').textContent).a");await click(`[data-answer="${a}"]`);await click("#lit-next");}
  await assert(await evaluate("!document.querySelector('#lit-result').hidden && document.querySelector('#lit-result').textContent.includes('100%')"),"literature classics did not complete");
  await open("literature.html",390);await click('[data-lit-mode="poetry"]');
  for(let i=0;i<10;i++){await evaluate(`(()=>{const prompt=document.querySelector('.poetry-prompt strong').textContent,q=LiteratureData.poetry.find(x=>x.before===prompt||x.after===prompt),answer=q.before===prompt?q.after:q.before;document.querySelector('#poetry-input').value='  '+answer+'。 ';document.querySelector('#poetry-form').requestSubmit()})()`);await click('#lit-next');}
  await assert(await evaluate("!document.querySelector('#lit-result').hidden && document.querySelector('#lit-result').textContent.includes('100%')"),"poetry normalization or completion failed");
  await open("literature.html",390);await click('[data-lit-mode="matching"]');
  const firstAuthor=await evaluate("document.querySelector('[data-author]').dataset.author");await click(`[data-author="${firstAuthor}"]`);const firstWork=await evaluate("LiteratureData.matching.find(x=>x.author==="+JSON.stringify(firstAuthor)+").work");await click(`[data-work="${firstWork}"]`);await click(`[data-author="${firstAuthor}"]`);await assert(await evaluate("document.querySelectorAll('.paired').length===0"),"matching cancel failed");
  await evaluate(`document.querySelectorAll('[data-author]').forEach(a=>{a.click();const w=LiteratureData.matching.find(x=>x.author===a.dataset.author).work;document.querySelector('[data-work="'+w+'"]').click()})`);await click('#match-submit');await assert(await evaluate("!document.querySelector('#lit-result').hidden && document.querySelector('#lit-result').textContent.includes('60')"),"matching re-pair or submit failed");
  console.log("PASS literature: classics, poetry normalization, matching cancel/re-pair/submit");

  await open("pi-memory.html",390);await click('[data-pi-mode="free"]');await evaluate("document.querySelector('#pi-input').value=PiDigits.slice(0,22)+'0'+PiDigits.slice(23,30)");await click('#pi-submit');await assert(await evaluate("document.querySelector('#pi-result').textContent.includes('本次成绩：22 位')&&document.querySelector('#pi-result').textContent.includes('第 23 位开始出错')"),"pi first-error scoring failed");
  await open("pi-memory.html",390);await click('[data-pi-mode="timed"]');const t0=await evaluate("document.querySelector('#pi-timer').textContent");await pause(1100);const t1=await evaluate("document.querySelector('#pi-timer').textContent");await assert(t0==='60 秒'&&t1==='59 秒',"pi 60-second countdown failed");await evaluate("document.querySelector('#pi-input').value=PiDigits.slice(0,30)");await click('#pi-submit');await open("pi-memory.html",390);await assert(await evaluate("document.querySelector('#pi-record').textContent.includes('自由 22 位')&&document.querySelector('#pi-record').textContent.includes('60 秒 30 位')"),"pi records did not persist independently");
  console.log("PASS pi: first-error scoring, countdown, free/timed persistence");

  for(const layer of [1,2,3,4]){await open("clue-guess.html",390);await click('[data-clue-mode="people"]');for(let i=1;i<layer;i++)await click('#clue-more');await evaluate("document.querySelector('#clue-input').value=[...ClueData.people].find(q=>q.clues[0]===document.querySelector('#clue-list-open p').textContent).answer;document.querySelector('#clue-form').requestSubmit()");await assert(Number(await evaluate("document.querySelector('#clue-score').textContent.split(' ')[0]"))===5-layer,`clue layer ${layer} score failed`)}
  await open("clue-guess.html",390);await click('[data-clue-mode="people"]');await evaluate(`(()=>{const q=ClueData.people.find(q=>q.clues[0]===document.querySelector('#clue-list-open p').textContent);q.aliases=['QA 别名'];document.querySelector('#clue-input').value=' QA，别名 ';document.querySelector('#clue-form').requestSubmit()})()`);await assert(await evaluate("document.querySelector('#clue-feedback').textContent.includes('答对了')"),"clue aliases failed");
  console.log("PASS clue guess: reveal, 4/3/2/1 scoring, aliases");

  await open("speed-quiz.html",430);await click('#speed-start');await pause(3100);await assert(await evaluate("!document.querySelector('#speed-game').hidden"),"speed 3/2/1/GO failed");
  await evaluate("document.querySelectorAll('[data-speed-answer]')[0].click()");await pause(700);await assert(await evaluate("document.querySelector('#speed-round').textContent==='2 / 20'"),"speed auto advance failed");await pause(10800);await assert(await evaluate("document.querySelector('#speed-round').textContent==='3 / 20'"),"speed timeout auto advance failed");
  for(let i=2;i<20;i++){await evaluate(`(()=>{const q=SpeedQuizData.find(q=>q.q===document.querySelector('#speed-question').textContent);document.querySelector('[data-speed-answer="'+q.a+'"]').click()})()`);await pause(700)}
  await assert(await evaluate("!document.querySelector('#speed-result').hidden && document.querySelector('#speed-result').textContent.includes('超时 1')"),"speed 20-question result failed");await open("speed-quiz.html",430);await assert(await evaluate("document.querySelector('#speed-record').textContent.includes('历史最高')&&localStorage.getItem('xiaoluXiaogSpeedQuizV1')"),"speed record persistence failed");
  console.log("PASS speed quiz: countdown, auto-next, timeout, combo, result, persistence");
  await open("game-hall.html",390);await assert(await evaluate("document.querySelectorAll('.game-grid .game-tile').length===11"),"game hall does not have 11 entries");
  console.log("PASS responsive: 15 pages × 7 viewports; 11 game entries; wishlist regression; 7 original games; 16 achievements; v1.8 games");
} finally { proc.kill(); }
