import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile,access } from "node:fs/promises";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require=createRequire(import.meta.url),timeline=require("./js/timeline-storage.js"),notes=require("./js/notes-storage.js"),gifts=require("./js/gifts-storage.js"),backup=require("./js/backup-core.js");
const root=dirname(fileURLToPath(import.meta.url)),json=value=>JSON.stringify(value);
class MemoryStorage{constructor(seed={}){this.values=new Map(Object.entries(seed))}getItem(key){return this.values.has(key)?this.values.get(key):null}setItem(key,value){this.values.set(key,String(value))}removeItem(key){this.values.delete(key)}}

const oldTimeline=timeline.normalizeState({schemaVersion:2,memories:[{id:"m-old",date:"2026-09-01",title:"旧回忆",body:"必须保留",tags:["以前"],source:{module:"notes",itemId:"n-old",label:"旧笔记"}}]});
assert.equal(oldTimeline.schemaVersion,3);
assert.equal(oldTimeline.memories[0].favorite,false);
assert.equal(oldTimeline.memories[0].pinned,false);
assert.deepEqual(oldTimeline.memories[0].tags,["以前"]);
assert.equal(oldTimeline.memories[0].source.module,"note");
assert.deepEqual(oldTimeline.memories[0].links.noteIds,["n-old"],"source id must also enter the stable links structure");
const giftMemory=timeline.normalizeMemory({id:"m-gift",title:"文件礼物",source:{module:"gifts",itemId:"g-1"},links:{giftIds:["g-1","g-1"]},favorite:true,pinned:true});
assert.equal(giftMemory.source.module,"gift");assert.deepEqual(giftMemory.links.giftIds,["g-1"]);assert.equal(giftMemory.favorite,true);assert.equal(giftMemory.pinned,true);

const migratedNotes=notes.normalizeState({schemaVersion:2,notebooks:[{id:"default",name:"小路的笔记"}],notes:[{id:"n-old",notebookId:"missing",title:"旧笔记",body:"内容",date:"2026-09-01",tags:["迁移"]}]});
assert.equal(migratedNotes.schemaVersion,3);
assert.equal(migratedNotes.notebooks.length,6);
assert.deepEqual(migratedNotes.notebooks.map(book=>book.id),["default","research","c-language","travel","diary","xiaolu-xiaog"]);
assert.equal(migratedNotes.notebooks[0].name,"默认笔记");
assert.equal(migratedNotes.notes[0].notebookId,"default");
assert.equal(migratedNotes.notes[0].body,"内容");
const customState=notes.normalizeState({schemaVersion:3,notebooks:[{id:"default",name:"默认笔记",emoji:"📥"},{id:"custom",name:"灵感",emoji:"💡",coverColor:"#abcdef"}],notes:[{id:"n2",notebookId:"custom",title:"想法",body:"测试"}]});
assert.equal(customState.notebooks.length,2,"deleted built-in notebooks must not reappear after v3 migration");
assert.equal(customState.notes[0].notebookId,"custom");
const linkedNotes=notes.linkMemory(customState,"n2","m2");assert.deepEqual(linkedNotes.notes[0].links.memoryIds,["m2"]);assert.deepEqual(notes.unlinkMemory(linkedNotes,"m2").notes[0].links.memoryIds,[]);

const gift=gifts.normalizeGift({id:"g-1",date:"2026-09-02",name:" 情书 ",type:"文件礼物",giver:"小G",description:"第一份文件礼物",imageRef:"https://example.com/gift.png",tags:"纪念日，文件",favorite:true});
assert.equal(gift.name,"情书");assert.equal(gift.type,"文件礼物");assert.deepEqual(gift.tags,["纪念日","文件"]);assert.equal(gift.favorite,true);assert.equal(gifts.normalizeGift({imageRef:"javascript:alert(1)"}).imageRef,"");
const giftState=gifts.linkMemory({schemaVersion:1,gifts:[gift]},"g-1","m-gift");assert.deepEqual(giftState.gifts[0].links.memoryIds,["m-gift"]);assert.deepEqual(gifts.unlinkMemory(giftState,"m-gift").gifts[0].links.memoryIds,[]);
assert.equal(gifts.load(new MemoryStorage({[gifts.KEY]:json({schemaVersion:2,gifts:[]})})).locked,true);

const storage=new MemoryStorage({sentinel:"keep",[notes.KEY]:json(migratedNotes),[timeline.KEY]:json(oldTimeline),[gifts.KEY]:json({schemaVersion:1,gifts:[gift]})});
const payload=backup.createBackup(storage,new Date("2026-09-13T12:00:00.000Z"));
assert.equal(payload.app.version,"2.8");assert.equal(backup.specs.length,17);assert.equal(payload.modules.notes.entries[notes.KEY].value.notebooks.length,6);assert.equal(payload.modules.gifts.entries[gifts.KEY].value.gifts[0].id,"g-1");
const oldPayload=structuredClone(payload);delete oldPayload.modules.gifts;oldPayload.app.version="2.4";const preservedGifts=json({schemaVersion:1,gifts:[{id:"keep",name:"保留的礼物"}]}),oldTarget=new MemoryStorage({sentinel:"keep",[gifts.KEY]:preservedGifts}),oldInspection=backup.inspectBackup(oldPayload,oldTarget);assert.equal(oldInspection.valid,true);const restored=backup.restoreBackup(oldPayload,oldTarget);assert.ok(restored.restored.includes(notes.KEY));assert.equal(oldTarget.getItem("sentinel"),"keep");assert.equal(oldTarget.getItem(gifts.KEY),preservedGifts,"old backups without gifts must not clear current gift data");

const timelineHtml=await readFile(resolve(root,"timeline.html"),"utf8"),notesJs=await readFile(resolve(root,"js/notes.js"),"utf8"),giftsJs=await readFile(resolve(root,"js/gifts.js"),"utf8"),sw=await readFile(resolve(root,"sw.js"),"utf8");
assert.ok(timelineHtml.includes('data-memory-filter="pinned"')&&timelineHtml.includes('data-memory-filter="favorite"')&&timelineHtml.includes('id="tag-filter"'));
assert.ok(notesJs.includes('source:"note"')&&notesJs.includes("查看关联回忆"),"note to memory flow is missing");
assert.ok(giftsJs.includes('source:"gift"')&&giftsJs.includes("查看关联回忆"),"gift to memory flow is missing");
assert.ok(sw.includes("xiaolu-home-v2.8-shell-2")&&sw.includes("./js/gifts-storage.js"));
for(const path of ["gifts.html","js/gifts.js","js/gifts-storage.js","manifest.webmanifest","icons/app-icon-192.png"])await access(resolve(root,path));

console.log("PASS v2.5 core: memory flags/links, notebook migration/management, note and gift backlinks, old backup compatibility, PWA resources");
