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

  await evaluate(`localStorage.clear();localStorage.setItem('v21Sentinel','keep-me');
    for(const [key,value] of Object.entries({xiaoluXiaogGraduateJourneyV1:{dailyLog:[1],milestones:[2],experiments:[3],communications:[4]},xiaoluXiaogExerciseV1:{records:[5]},xiaoluXiaogTimelineV1:{memories:[6]},xiaoluXiaogNotesV1:{notes:[7]},xiaoluTheme:'dark'}))localStorage.setItem(key,JSON.stringify(value));
    localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify({version:4,selectedBookId:'kaoyan-complete',mastery:{government:{word:'government',status:'known',directions:{'en-zh':{status:'known',updatedAt:'2026-09-06T00:00:00.000Z',nextReviewAt:'2026-09-13T00:00:00.000Z',streak:2,misses:0},'zh-en':{status:'fuzzy',updatedAt:'2026-09-06T00:00:00.000Z',nextReviewAt:'2026-09-09T00:00:00.000Z',streak:0,misses:1}}}},books:{'kaoyan-complete':{currentPosition:51,history:[{date:'2026-09-06T00:00:00.000Z',mode:'daily',words:50}],session:{mode:'daily',queue:['kaoyan-complete-00001'],round:1,index:0,spelling:{wordId:'kaoyan-complete-00001',attempts:1}}},cet6:{currentPosition:12,history:[],session:null},'academic-priority':{currentPosition:30,history:[],session:null}},preferences:{dailyGoal:50,academicDailyGoal:30,lastAcademicWord:'significant'}}));location.reload()`);
  await pause(450);
  await ready();
  await assert(await evaluate("StudyApp.getState().version===4 && StudyApp.getState().vocabularyFreshStartVersion===1 && StudyApp.getState().selectedBookId==='kaoyan-complete'"), "one-time vocabulary fresh start did not mark the new state");
  await assert(await evaluate("Object.keys(StudyApp.getState().mastery).length===0 && StudyApp.getBook().currentPosition===0 && StudyApp.getState().books['academic-priority'].currentPosition===0 && StudyApp.getBook().history.length===0 && StudyApp.getBook().session===null"), "fresh start did not clear vocabulary mastery, cursors, history or session");
  await assert(await evaluate("localStorage.getItem('v21Sentinel')==='keep-me' && JSON.parse(localStorage.getItem('xiaoluXiaogGraduateJourneyV1')).milestones[0]===2 && JSON.parse(localStorage.getItem('xiaoluXiaogExerciseV1')).records[0]===5 && JSON.parse(localStorage.getItem('xiaoluXiaogTimelineV1')).memories[0]===6 && JSON.parse(localStorage.getItem('xiaoluXiaogNotesV1')).notes[0]===7 && JSON.parse(localStorage.getItem('xiaoluTheme'))==='dark'"), "fresh start touched non-vocabulary localStorage");
  await evaluate("location.reload()");
  await pause(450);
  await ready();
  await assert(await evaluate("StudyApp.getState().vocabularyFreshStartVersion===1 && Object.keys(StudyApp.getState().mastery).length===0 && StudyApp.getBook().currentPosition===0"), "fresh start repeated or produced an invalid state on the second refresh");

  await click("#start-button");
  await assert(await evaluate("StudyApp.getBook().session.queue.length===50 && StudyApp.getBook().session.queue.slice(0,30).every(id=>id.startsWith('academic-priority-')) && StudyApp.getBook().session.queue.filter(id=>id.startsWith('academic-priority-')).length===30"), "academic-first 30+20 daily plan failed");
  await evaluate("sessionStorage.setItem('v272Queue',JSON.stringify(StudyApp.getBook().session.queue))");
  await click("#reveal-button");
  await click('[data-rating="unknown"]');
  await click("#reveal-button");
  await click('[data-rating="simple"]');
  await assert(await evaluate("JSON.stringify(StudyApp.getBook().session.queue)===sessionStorage.getItem('v272Queue')"), "SRS rating changed the fixed session queue");
  await assert(await evaluate("Object.values(StudyApp.getState().mastery).some(x=>x.status==='unknown') && Object.values(StudyApp.getState().mastery).some(x=>x.status==='simple')"), "four-level mastery was not saved");
  await evaluate("(()=>{const s=StudyApp.getBook().session;const all=[...StudyApp.getAcademicWords(),...StudyApp.getWords()];sessionStorage.setItem('v272KnownWord',all.find(x=>x.id===s.queue[s.index]).word.toLowerCase());StudyApp.rate('known');while(StudyApp.getBook().session.index<5)StudyApp.rate('known');sessionStorage.setItem('v272Next5',StudyApp.getBook().session.queue[5])})()");
  await click("#exit-button");
  await open("study.html");
  await ready();
  await assert(await evaluate("StudyApp.getBook().session.index===5 && StudyApp.getBook().session.queue[5]===sessionStorage.getItem('v272Next5') && JSON.stringify(StudyApp.getBook().session.queue)===sessionStorage.getItem('v272Queue')"), "5/50 refresh did not resume at word 6 with the same queue");
  await assert(await evaluate("!document.querySelector('#resume-banner').hidden && document.querySelector('#start-button').hidden && document.querySelector('#daily-range').textContent.includes('当前任务进行中')"), "unfinished-session UX still exposed duplicate primary actions");
  await click("#resume-button");
  await evaluate("(()=>{while(StudyApp.getBook().session.index<20)StudyApp.rate('known');const session=StudyApp.getBook().session;sessionStorage.setItem('v271Queue',JSON.stringify(session.queue));sessionStorage.setItem('v271Completed',JSON.stringify(session.queue.slice(0,20)));sessionStorage.setItem('v271Next',session.queue[20])})()");
  await assert(await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogVocabularyV2')).books['kaoyan-complete'].session.index===20"), "20/50 breakpoint was not persisted immediately");
  await click("#exit-button");
  await open("study.html");
  await ready();
  await assert(await evaluate("!document.querySelector('#resume-banner').hidden && StudyApp.getBook().session.round===0 && StudyApp.getBook().session.index===20 && JSON.stringify(StudyApp.getBook().session.queue)===sessionStorage.getItem('v271Queue') && StudyApp.getState().mastery[sessionStorage.getItem('v272KnownWord')].directions['en-zh'].status==='known'"), "20/50 queue, index or post-reset learning was not restored");
  await assert(await evaluate("document.querySelector('#resume-copy').textContent.includes('本轮学习 20 / 50') && document.querySelector('#resume-copy').textContent.includes('从第 21 个继续') && document.querySelector('#start-button').hidden"), "resume UX did not show the saved 20/50 breakpoint");
  await assert(await evaluate("document.querySelector('#academic-button').disabled && document.querySelector('#review-button').disabled"), "another mode could overwrite the unfinished session");
  await click("#resume-button");
  await assert(await evaluate("StudyApp.getBook().session.queue[StudyApp.getBook().session.index]===sessionStorage.getItem('v271Next') && !JSON.parse(sessionStorage.getItem('v271Completed')).includes(StudyApp.getBook().session.queue[StudyApp.getBook().session.index])"), "resume did not continue from word 21");
  await evaluate("(()=>{while(StudyApp.getBook().session?.round===0)StudyApp.rate('known');while(StudyApp.getBook().session.index<2)StudyApp.rate('known');const s=StudyApp.getBook().session,all=[...StudyApp.getAcademicWords(),...StudyApp.getWords()];while(all.find(x=>x.id===s.queue[s.index]).word.length<5)StudyApp.rate('known');sessionStorage.setItem('v28SpellIndex',String(s.index));sessionStorage.setItem('v28SpellWord',all.find(x=>x.id===s.queue[s.index]).word)})()");
  await assert(await evaluate("!document.querySelector('#spelling-form').hidden && document.querySelector('#reveal-button').hidden && document.querySelector('#answer-panel').hidden && document.querySelector('#recognition-status').textContent.includes('认识') && document.querySelector('#production-status').textContent.includes('未训练')"), "production UI did not show independent untrained spelling state");
  await assert(await evaluate("document.querySelector('#spelling-hint').textContent===StudyCore.spellingHint(sessionStorage.getItem('v28SpellWord')) && document.querySelector('#spelling-input').value==='' && document.querySelector('#spelling-input').placeholder==='输入完整英文单词' && document.querySelector('#spelling-input').autocomplete==='off' && document.querySelector('#spelling-input').spellcheck===false"), "guided spelling hint leaked into the input or mobile prediction protections regressed");
  await evaluate("(()=>{const word=sessionStorage.getItem('v28SpellWord');const cut=Math.floor(word.length/2);const input=document.querySelector('#spelling-input');input.value=word.slice(0,cut)+word.slice(cut+1);document.querySelector('#spelling-form').requestSubmit()})()");
  await assert(await evaluate("document.querySelector('#spelling-feedback').textContent.includes('很接近') && document.querySelector('#answer-panel').hidden && StudyApp.getBook().session.spelling.attempts===1 && StudyApp.getState().mastery[sessionStorage.getItem('v28SpellWord').toLowerCase()].directions['en-zh'].status==='known' && !StudyApp.getState().mastery[sessionStorage.getItem('v28SpellWord').toLowerCase()].directions['zh-en']"), "close typo revealed the answer or changed recognition");
  await click("#exit-button");
  await open("study.html");
  await ready();
  await click("#resume-button");
  await assert(await evaluate("StudyApp.getBook().session.round===1 && StudyApp.getBook().session.index===Number(sessionStorage.getItem('v28SpellIndex')) && StudyApp.getBook().session.spelling.attempts===1 && !document.querySelector('#spelling-form').hidden && document.querySelector('#answer-panel').hidden"), "unfinished spelling attempt did not resume safely");
  await evaluate("(()=>{const input=document.querySelector('#spelling-input');input.value='  '+sessionStorage.getItem('v28SpellWord').toUpperCase()+'  ';document.querySelector('#spelling-form').requestSubmit()})()");
  await assert(await evaluate("!document.querySelector('#answer-panel').hidden && document.querySelector('#spelling-feedback').textContent.includes('稍后再巩固') && StudyApp.getState().mastery[sessionStorage.getItem('v28SpellWord').toLowerCase()].directions['en-zh'].status==='known' && StudyApp.getState().mastery[sessionStorage.getItem('v28SpellWord').toLowerCase()].directions['zh-en'].status==='fuzzy'"), "corrected typo did not become fuzzy production while preserving recognition");
  await click("#spelling-next");
  await evaluate("sessionStorage.setItem('v28ForgotWord',[...StudyApp.getAcademicWords(),...StudyApp.getWords()].find(x=>x.id===StudyApp.getBook().session.queue[StudyApp.getBook().session.index]).word.toLowerCase());document.querySelector('#spelling-input').value='completely-wrong';document.querySelector('#spelling-form').requestSubmit()");
  await assert(await evaluate("document.querySelector('#spelling-feedback').textContent.includes('还不对') && StudyApp.getState().mastery[sessionStorage.getItem('v28ForgotWord')].directions['en-zh'].status==='known'"), "wrong spelling changed recognition");
  await click("#spelling-forget");
  await assert(await evaluate("StudyApp.getState().mastery[sessionStorage.getItem('v28ForgotWord')].directions['en-zh'].status==='known' && StudyApp.getState().mastery[sessionStorage.getItem('v28ForgotWord')].directions['zh-en'].status==='unknown' && !document.querySelector('#answer-panel').hidden"), "give-up did not isolate production unknown");
  await click("#spelling-next");
  await evaluate("(()=>{const all=[...StudyApp.getAcademicWords(),...StudyApp.getWords()],word=all.find(x=>x.id===StudyApp.getBook().session.queue[StudyApp.getBook().session.index]).word;sessionStorage.setItem('v28ExactWord',word.toLowerCase());document.querySelector('#spelling-input').value=word;document.querySelector('#spelling-form').requestSubmit()})()");
  await assert(await evaluate("StudyApp.getState().mastery[sessionStorage.getItem('v28ExactWord')].directions['en-zh'].status==='known' && StudyApp.getState().mastery[sessionStorage.getItem('v28ExactWord')].directions['zh-en'].status==='known' && document.querySelector('#spelling-feedback').textContent.includes('拼写正确')"), "first-try correct spelling did not produce independent known output");
  await evaluate("document.querySelector('#spelling-form').requestSubmit()");
  await assert(await evaluate("StudyApp.getState().mastery[sessionStorage.getItem('v28ExactWord')].directions['zh-en'].streak===1"), "resolved spelling accepted a duplicate Enter/submit");
  await click("#spelling-next");
  await evaluate("(()=>{while(StudyApp.getBook().session)StudyApp.rate('known')})()");
  await assert(await evaluate("StudyApp.getBook().history.length===1 && StudyApp.getBook().currentPosition>=20 && StudyApp.getState().books['academic-priority'].currentPosition>=30 && StudyApp.getBook().history[0].academicWords===30"), "completion/history/cursors failed");

  await click("#result-home");
  await assert(await evaluate("(()=>{const next=StudyApp.newSession('daily');if(!next||next.index!==0)return false;const all=[...StudyApp.getAcademicWords(),...StudyApp.getWords()];const known=sessionStorage.getItem('v272KnownWord');return JSON.stringify(next.queue)!==sessionStorage.getItem('v271Queue')&&!next.queue.some(id=>all.find(x=>x.id===id)?.word.toLowerCase()===known)})()"), "the next daily session repeated a just-learned word");
  await evaluate("(()=>{const s=StudyApp.getState(),key=sessionStorage.getItem('v28ForgotWord');for(const entry of Object.values(s.mastery)){for(const direction of Object.values(entry.directions||{})){if(direction.status!=='simple')direction.nextReviewAt='2999-01-01T00:00:00.000Z'}entry.nextReviewAt='2999-01-01T00:00:00.000Z'}s.mastery[key].directions['en-zh'].nextReviewAt='2999-01-01T00:00:00.000Z';s.mastery[key].directions['zh-en'].nextReviewAt='2000-01-01T00:00:00.000Z';s.mastery[key].nextReviewAt='2000-01-01T00:00:00.000Z';localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify(s));location.reload()})()");
  await pause(350);
  await ready();
  await assert(await evaluate("StudyApp.dueIds().length>0 && !document.querySelector('#review-button').disabled"), "due review scheduling failed");
  await click("#review-button");
  await assert(await evaluate("StudyApp.getBook().session.mode==='review' && StudyApp.getBook().session.reviewDirections[StudyApp.getBook().session.queue[0]].includes('zh-en') && !StudyApp.getBook().session.reviewDirections[StudyApp.getBook().session.queue[0]].includes('en-zh') && !document.querySelector('#spelling-form').hidden"), "production due did not open a zh-en spelling review");
  await click("#spelling-forget");
  await click("#spelling-next");
  await click("#result-home");
  await evaluate("(()=>{const s=StudyApp.getState(),key=sessionStorage.getItem('v28ForgotWord');s.mastery[key].directions['en-zh'].status='known';s.mastery[key].directions['en-zh'].nextReviewAt='2000-01-01T00:00:00.000Z';s.mastery[key].directions['zh-en'].nextReviewAt='2999-01-01T00:00:00.000Z';s.mastery[key].status='known';s.mastery[key].nextReviewAt='2000-01-01T00:00:00.000Z';localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify(s));location.reload()})()");
  await pause(350);
  await ready();
  await click("#review-button");
  await assert(await evaluate("StudyApp.getBook().session.reviewDirections[StudyApp.getBook().session.queue[0]].includes('en-zh') && !StudyApp.getBook().session.reviewDirections[StudyApp.getBook().session.queue[0]].includes('zh-en') && !document.querySelector('#reveal-button').hidden && document.querySelector('#spelling-form').hidden"), "recognition due did not open an en-zh recognition review");
  await click("#reveal-button");
  await click('[data-rating="known"]');
  await click("#result-home");

  const sharedWord = await evaluate("(async()=>{const first=StudyApp.getWords()[0].word;StudyApp.getState().mastery[first.toLowerCase()]={word:first,status:'fuzzy',updatedAt:new Date().toISOString(),nextReviewAt:new Date().toISOString(),directions:{'en-zh':{status:'fuzzy',updatedAt:new Date().toISOString(),nextReviewAt:new Date().toISOString(),streak:0,misses:0}}};await StudyApp.loadBook('cet6');return first})()");
  await assert(await evaluate(`StudyApp.getState().mastery[${JSON.stringify(sharedWord.toLowerCase())}].status==='fuzzy' && StudyApp.getBook().currentPosition===0`), "shared mastery or independent book progress failed");

  await click("#academic-button");
  await assert(await evaluate("StudyApp.getBook().session.mode==='academic' && StudyApp.getBook().session.queue.every(id=>id.startsWith('academic-priority-')) && document.querySelector('#round-label').textContent.includes('Academic Mode') && document.querySelector('#direction-label').textContent.includes('论文语境') && document.querySelector('#unit-label').textContent.includes('论文语境') && /论文|搭配|例句|辨析/.test(document.querySelector('#prompt-label').textContent)"), "paper mode did not provide distinct academic-context training");
  await evaluate("(()=>{while(StudyApp.getBook().session)StudyApp.rate('known')})()");
  await click("#result-home");

  await evaluate("(()=>{const s=StudyApp.getState();s.books[s.selectedBookId].session={mode:'broken',queue:[null,'missing'],index:999};localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify(s));location.reload()})()");
  await pause(350);
  await ready();
  await assert(await evaluate("StudyApp.getBook().session===null && document.querySelector('#dashboard').hidden===false"), "damaged session did not fall back safely");

  await click("#collocation-button");
  await assert(await evaluate("document.querySelector('#practice-dialog').open && document.querySelectorAll('[data-practice-answer]').length>=2"), "collocation practice structure failed");
  await click('[data-close="practice-dialog"]');
  await click("#confusable-button");
  await assert(await evaluate("document.querySelector('#practice-dialog').open && document.querySelector('#practice-title').textContent.includes('易混词')"), "confusable practice structure failed");
  await click('[data-close="practice-dialog"]');
  await click("#report-button");
  await assert(await evaluate("document.querySelector('#report-dialog').open && document.querySelectorAll('.book-report article').length===3"), "learning report failed");
  await click('[data-close="report-dialog"]');

  const backup = await evaluate("JSON.stringify({app:'xiaolu-xiaog-vocabulary',schemaVersion:4,data:StudyApp.getState()})");
  await assert(await evaluate("JSON.parse(" + JSON.stringify(backup) + ").data.vocabularyFreshStartVersion===1"), "vocabulary backup did not preserve the fresh-start marker");
  await evaluate("localStorage.setItem('xiaoluXiaogVocabularyV2','{broken');location.reload()");
  await pause(250);
  await assert(await evaluate("localStorage.getItem('xiaoluXiaogVocabularyV2')==='{broken' && localStorage.getItem('v21Sentinel')==='keep-me'"), "malformed storage was overwritten");
  await evaluate(`(()=>{const file=new File([${JSON.stringify(backup)}],'backup.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await pause(350);
  await assert(await evaluate("StudyApp.getState().version===4 && localStorage.getItem('v21Sentinel')==='keep-me'"), "validated import or storage isolation failed");
  await evaluate("(()=>{const state=StudyApp.getState(),word=StudyApp.getAcademicWords().find(item=>item.word==='microstructure');state.books[state.selectedBookId].session={mode:'daily',queue:[word.id],round:1,index:0,ratings:{unknown:0,fuzzy:0,known:0,simple:0},directionRatings:{'en-zh':0,'zh-en':0},reviewDirections:{},spelling:null,startedAt:new Date().toISOString(),scanCursor:0,generalScanCursor:0,academicScanCursor:0,academicWords:1,generalWords:0};localStorage.setItem('xiaoluXiaogVocabularyV2',JSON.stringify(state))})()");

  for (const width of [320, 360, 375, 390, 430, 768, 1024]) {
    await open("study.html", width);
    await ready();
    await click("#resume-button");
    const size = await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})");
    await assert(size.scroll <= size.client, `study overflow ${width}`);
    await assert(await evaluate("document.querySelector('#spelling-hint').textContent==='mic___________' && document.querySelector('.word-card').scrollWidth<=document.querySelector('.word-card').clientWidth"), `long guided spelling hint overflow ${width}`);
  }
  await open("index.html", 320);
  await assert(await evaluate("!!document.querySelector('a[href=\"./study.html\"]')"), "home study entry missing");
  console.log("PASS v2.8 study browser: fresh start, guided spelling, independent states, typo/give-up, directional review, resume, Academic, backup and responsive");
} finally {
  socket?.close();
  proc.kill();
  server.close();
}
