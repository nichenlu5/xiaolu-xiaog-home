import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChrome,startStaticServer } from "./qa-browser-helper.mjs";

const chrome=resolveChrome(),server=await startStaticServer(8768),profile=await mkdtemp(join(tmpdir(),"xiaolu-v25-")),proc=spawn(chrome,["--headless=new","--disable-gpu","--remote-debugging-port=9335",`--user-data-dir=${profile}`,"about:blank"]),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,nextId=0;const waiting=new Map();
async function connect(){for(let i=0;i<30;i++){try{const tabs=await fetch("http://127.0.0.1:9335/json/list").then(response=>response.json()),page=tabs.find(tab=>tab.type==="page");if(!page)throw new Error();socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,bad)=>{socket.onopen=ok;socket.onerror=bad});socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&waiting.has(message.id)){waiting.get(message.id)(message);waiting.delete(message.id)}};return}catch{await pause(100)}}throw new Error("Chrome DevTools connection failed")}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId;waiting.set(id,message=>message.error?reject(new Error(message.error.message)):resolve(message.result));socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const result=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
async function waitPage(path){for(let i=0;i<30;i++){await pause(80);if(await evaluate(`location.pathname.endsWith(${JSON.stringify(path)})&&document.readyState==='complete'`))return}throw new Error(`Timed out loading ${path}`)}
async function open(path,width=390){await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:true});await send("Page.navigate",{url:`http://127.0.0.1:8768/${path}`});await waitPage(path)}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}
async function assert(condition,message){if(!condition)throw new Error(message)}

try{
  await connect();await send("Page.enable");await send("Runtime.enable");await open("notes.html");
  await evaluate(`localStorage.setItem('xiaoluXiaogNotesV1',JSON.stringify({schemaVersion:2,notebooks:[{id:'default',name:'小路的笔记'}],notes:[{id:'n-old',notebookId:'missing',title:'旧笔记',body:'旧正文',date:'2026-09-01',tags:['迁移'],source:{module:'manual'}}]}));localStorage.removeItem('xiaoluXiaogTimelineV1');localStorage.removeItem('xiaoluXiaogGiftsV1');location.reload()`);await waitPage("notes.html");
  await assert(await evaluate("document.querySelectorAll('.notebook-card').length===7"),"six default notebooks plus all view were not rendered");
  await assert(await evaluate("document.querySelector('.note-card .notebook-badge').textContent.includes('默认笔记')"),"old note was not migrated to default notebook");
  await click("#add-notebook");await evaluate(`document.querySelector('#notebook-name').value='灵感';document.querySelector('#notebook-emoji').value='💡';document.querySelector('#notebook-name').dispatchEvent(new Event('input'));document.querySelector('#notebook-form').requestSubmit()`);
  const customId=await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogNotesV1')).notebooks.find(x=>x.name==='灵感').id");
  await click(`.note-card [data-action="move"]`);await evaluate(`document.querySelector('#move-notebook').value=${JSON.stringify(customId)};document.querySelector('#move-form').requestSubmit()`);
  await assert(await evaluate(`JSON.parse(localStorage.getItem('xiaoluXiaogNotesV1')).notes.find(x=>x.id==='n-old').notebookId===${JSON.stringify(customId)}`),"note move did not persist stable notebook id");
  await click(".note-card .record-actions a");await waitPage("timeline.html");
  await assert(await evaluate("document.querySelector('#memory-dialog').open&&document.querySelector('#source-module').value==='note'&&document.querySelector('#source-id').value==='n-old'"),"note to memory prefill lost stable note id");
  await evaluate("document.querySelector('#memory-form').requestSubmit()");
  await assert(await evaluate("(()=>{const m=JSON.parse(localStorage.getItem('xiaoluXiaogTimelineV1')).memories[0],n=JSON.parse(localStorage.getItem('xiaoluXiaogNotesV1')).notes.find(x=>x.id==='n-old');return m.source.module==='note'&&m.source.itemId==='n-old'&&m.links.noteIds.includes('n-old')&&n.links.memoryIds.includes(m.id)})()"),"note and memory stable backlinks were not persisted");
  await click('.memory-card [data-action="pin"]');await click('.memory-card [data-action="favorite"]');
  await assert(await evaluate("(()=>{const m=JSON.parse(localStorage.getItem('xiaoluXiaogTimelineV1')).memories[0];return m.pinned&&m.favorite})()"),"memory pin/favorite did not persist");
  await click('[data-memory-filter="pinned"]');await assert(await evaluate("document.querySelectorAll('.memory-card').length===1"),"pinned filter failed");
  await click('[data-memory-filter="favorite"]');await assert(await evaluate("document.querySelectorAll('.memory-card').length===1"),"favorite filter failed");
  await evaluate("document.querySelector('#tag-filter').value='迁移';document.querySelector('#tag-filter').dispatchEvent(new Event('change'))");await assert(await evaluate("document.querySelectorAll('.memory-card').length===1"),"memory tag filter failed");

  await open("gifts.html");await click("#add-gift");await evaluate(`document.querySelector('#gift-name').value='第一封信';document.querySelector('#gift-type').value='文件礼物';document.querySelector('#gift-giver').value='小G';document.querySelector('#gift-description').value='保存下来的文件礼物';document.querySelector('#gift-tags').value='纪念日，文件';document.querySelector('#gift-favorite').checked=true;document.querySelector('#gift-form').requestSubmit()`);
  const giftId=await evaluate("JSON.parse(localStorage.getItem('xiaoluXiaogGiftsV1')).gifts[0].id");await assert(Boolean(giftId),"gift create failed");
  await click(".gift-card .record-actions a");await waitPage("timeline.html");await assert(await evaluate(`document.querySelector('#memory-dialog').open&&document.querySelector('#source-module').value==='gift'&&document.querySelector('#source-id').value===${JSON.stringify(giftId)}`),"gift to memory prefill lost stable gift id");await evaluate("document.querySelector('#memory-form').requestSubmit()");
  await assert(await evaluate(`(()=>{const m=JSON.parse(localStorage.getItem('xiaoluXiaogTimelineV1')).memories.find(x=>x.source.module==='gift'),g=JSON.parse(localStorage.getItem('xiaoluXiaogGiftsV1')).gifts.find(x=>x.id===${JSON.stringify(giftId)});return m&&m.links.giftIds.includes(g.id)&&g.links.memoryIds.includes(m.id)})()`),"gift and memory stable backlinks were not persisted");
  await open("gifts.html");await assert(await evaluate("document.querySelector('.gift-card .record-actions a').textContent==='查看关联回忆'"),"linked gift action did not change to view memory");
  await open("data-center.html");await assert(await evaluate("[...document.querySelectorAll('#export-summary span')].some(x=>x.textContent.includes('礼物盒'))"),"gift data is missing from backup summary");
  console.log("PASS v2.5 browser: notebook migration/create/move, note→memory, timeline filters, gift CRUD→memory, backup UI");
}finally{proc.kill();server.close()}
