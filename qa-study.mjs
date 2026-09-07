import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile=await mkdtemp(join(tmpdir(),"xiaolu-v20-"));
const proc=spawn(chrome,["--headless=new","--disable-gpu","--remote-debugging-port=9444",`--user-data-dir=${profile}`,"about:blank"]);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,nextId=0;const waiting=new Map();
async function connect(){for(let i=0;i<40;i++){try{const tabs=await fetch("http://127.0.0.1:9444/json/list").then(r=>r.json());const page=tabs.find(t=>t.type==="page");socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,bad)=>{socket.onopen=ok;socket.onerror=bad});socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id&&waiting.has(msg.id)){waiting.get(msg.id)(msg);waiting.delete(msg.id)}};return}catch{await pause(100)}}throw Error("Chrome connection failed")}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId;waiting.set(id,msg=>msg.error?reject(Error(msg.error.message)):resolve(msg.result));socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
async function open(path,width=390){await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:true});await send("Page.navigate",{url:`http://127.0.0.1:8765/${path}`});for(let i=0;i<30;i++){await pause(50);if(await evaluate("document.readyState==='complete'"))return}throw Error(`Timeout ${path}`)}
async function assert(ok,message){if(!ok)throw Error(message)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}

try{
  await connect();await send("Page.enable");await open("study.html");for(let i=0;i<30&&!(await evaluate("document.querySelectorAll('#book-select option').length===4"));i++)await pause(100);
  await assert(await evaluate("JSON.stringify([...document.querySelectorAll('#book-select option')].map(x=>x.textContent))===JSON.stringify(['考研必考词汇（2,291 词）','考研完整词汇（4,787 词）','CET-6（5,371 词）','CET-4（3,815 词）'])"),"wordbook manifest/counts failed");
  await evaluate("localStorage.clear();localStorage.setItem('v20Sentinel','keep-me');location.reload()");await pause(250);
  await click("#start-button");
  await assert(await evaluate("StudyApp.getBook().session.queue.length===50 && StudyApp.getBook().session.queue[0]==='kaoyan-required-00001'"),"daily 50/order failed");
  await click("#reveal-button");await click("#skip-button");
  await assert(await evaluate("StudyApp.getBook().session.queue.length===50 && StudyApp.getBook().skipped['kaoyan-required-00001'] && StudyApp.getBook().session.queue[49]==='kaoyan-required-00051'"),"skip did not replenish daily 50");
  await evaluate("StudyApp.rate('wrong')");
  await assert(await evaluate("!!StudyApp.getBook().wrong['kaoyan-required-00002']"),"wrong book recording failed");
  await evaluate("(()=>{while(StudyApp.getBook().session.round===0)StudyApp.rate('correct');for(let i=0;i<3;i++)StudyApp.rate('correct')})()");
  await click("#exit-button");await open("study.html");
  await assert(await evaluate("!document.querySelector('#resume-banner').hidden && StudyApp.getBook().session.round===1 && StudyApp.getBook().session.index===3"),"breakpoint resume failed");
  await click("#resume-button");await evaluate("(()=>{while(StudyApp.getBook().session)StudyApp.rate('correct')})()");
  await assert(await evaluate("StudyApp.getBook().history.length===1 && StudyApp.getBook().currentPosition===51 && StudyApp.getBook().learnedCount===50"),"completion/history/cursor failed");
  await click("#result-home");await click("#review-button");await evaluate("(()=>{while(StudyApp.getBook().session)StudyApp.rate('correct')})()");
  await assert(await evaluate("Object.keys(StudyApp.getBook().wrong).length===0 && StudyApp.getBook().history[0].mode==='review'"),"wrong review/mastery failed");
  await evaluate("StudyApp.loadBook('cet4')");await pause(150);await assert(await evaluate("StudyApp.getBook().bookId==='cet4'&&StudyApp.getBook().currentPosition===0"),"book switch did not isolate fresh progress");await click("#start-button");await evaluate("StudyApp.rate('correct')");await click("#exit-button");await evaluate("StudyApp.loadBook('kaoyan-required')");await pause(150);await assert(await evaluate("StudyApp.getBook().currentPosition===51&&!StudyApp.getBook().session"),"book progress isolation failed");
  const backup=await evaluate("JSON.stringify({app:'xiaolu-xiaog-vocabulary',schemaVersion:3,data:StudyApp.getState()})");
  await evaluate("localStorage.setItem('xiaoluXiaogVocabularyV2','{broken');location.reload()");await pause(250);
  await assert(await evaluate("localStorage.getItem('xiaoluXiaogVocabularyV2')==='{broken' && localStorage.getItem('v20Sentinel')==='keep-me'"),"malformed storage was overwritten or unrelated storage changed");
  await evaluate(`(()=>{const file=new File([${JSON.stringify(backup)}],'backup.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(300);
  await assert(await evaluate("StudyApp.getBook().history.length===2 && StudyApp.getState().books.cet4.session && localStorage.getItem('v20Sentinel')==='keep-me'"),"validated import or storage isolation failed");
  for(const width of [320,390,430,1024]){await open("study.html",width);const size=await evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})");await assert(size.scroll<=size.client,`study overflow ${width}`)}
  await open("index.html",320);await assert(await evaluate("!!document.querySelector('a[href=\"./study.html\"]')"),"home study entry missing");
  console.log("PASS v2.0: 4 offline MIT wordbooks; isolated progress; daily 50; two rounds; skip refill; wrong review; resume; history; safe storage; import; responsive");
}finally{proc.kill()}
