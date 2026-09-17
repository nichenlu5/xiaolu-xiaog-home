import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

const root=dirname(fileURLToPath(import.meta.url));
const read=file=>readFile(resolve(root,file),"utf8");
const html=await read("index.html"),manifest=JSON.parse(await read("manifest.webmanifest")),modules=JSON.parse(await read("data/home-modules.json")),sw=await read("sw.js");
const require=createRequire(import.meta.url),backup=require("./js/backup-core.js");

const appLinks=[...html.matchAll(/class="os-app [^"]+" href="([^"]+)"/g)].map(match=>match[1]);
assert.equal(appLinks.length,8,"Xiaolu OS must expose exactly eight real app entries");
assert.equal(new Set(appLinks).size,8,"Xiaolu OS app routes must be unique");
for(const route of appLinks) await access(resolve(root,route));
assert.equal([...html.matchAll(/class="os-dock"/g)].length,1,"home must have one bottom dock");
assert.equal([...html.matchAll(/<nav class="os-dock"[\s\S]*?<\/nav>/g)][0][0].match(/<a /g).length,4,"dock must expose four shortcuts");
for(const id of ["home-date","home-greeting","today-study","today-exercise","today-memory","today-wish","recent-study","offline-note"]) assert.ok(html.includes(`id="${id}"`),`home is missing #${id}`);

assert.equal(manifest.display,"standalone");
assert.equal(manifest.start_url,"./index.html");
assert.equal(manifest.icons.length,3);
for(const icon of manifest.icons) await access(resolve(root,icon.src));
assert.equal(manifest.shortcuts.length,5);
assert.ok(sw.includes("request.mode===\"navigate\""),"service worker needs an offline navigation strategy");
assert.ok(!sw.includes("localStorage"),"service worker must not touch localStorage");
assert.equal(backup.APP_VERSION,"2.7");
assert.equal(backup.specs.length,17,"v2.6 adds graduate journey to the backup registry");
assert.equal(modules.schemaVersion,4);
assert.equal(modules.modules.filter(module=>module.kind==="internal"&&module.status==="active").length,11,"module registry must cover eight apps, gifts, graduate journey and data center");
assert.equal(modules.capabilities.pwa,"active");

const elements=new Map(["#home-date","#home-greeting","#today-study","#today-exercise","#today-memory","#today-wish","#recent-exercise","#recent-memory","#recent-wish","#recent-note","#recent-study","#recent-achievement"].map(selector=>[selector,{textContent:""}]));
const values=new Map(); let writes=0;
const storage={getItem:key=>values.get(key)??null,setItem:()=>{writes++;}};
values.set("xiaoluXiaogVocabularyV2",JSON.stringify({books:{cet6:{history:[],session:{mode:"daily"}}}}));
values.set("xiaoluXiaogWishlistV1",JSON.stringify([{title:"一起看海",status:"done",completedAt:"2026-09-13T12:00:00.000Z"}]));
const context={document:{querySelector:selector=>elements.get(selector)||null},localStorage:storage,window:{XiaoluExerciseStore:{load:()=>({state:{records:[]}})},XiaoluTimelineStore:{load:()=>({state:{memories:[]}})},XiaoluNotesStore:{load:()=>({state:{notes:[]}})},XiaoluAchievementCore:{evaluate:()=>({latest:{icon:"✨",name:"愿望变成回忆"}})}}};
vm.runInNewContext(await read("js/home.js"),context);
assert.ok(elements.get("#home-date").textContent.includes("星期"),"home date was not rendered");
assert.equal(elements.get("#today-study").textContent,"今日学习进行中");
assert.equal(elements.get("#today-wish").textContent,"一起看海");
assert.equal(elements.get("#recent-achievement").textContent,"✨ 愿望变成回忆");
assert.equal(writes,0,"home summaries must remain read-only");

console.log("PASS v2.4 shell compatibility: eight main apps, dock, live summaries, install manifest and offline shell");
