import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),backup=require("./js/backup-core.js"),achievements=require("./js/achievement-core.js");

class MemoryStorage {
  constructor(seed={}){this.values=new Map(Object.entries(seed));this.setCount=0;this.failKey="";}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.setCount++;if(key===this.failKey)throw new Error("quota");this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
const json=value=>JSON.stringify(value),date="2026-09-08T10:00:00.000Z";

assert.equal(backup.specs.length,15,"backup registry must cover all 15 persistent keys");
const source=new MemoryStorage({
  legacySentinel:"keep-me",
  xiaoluXiaogVocabularyV2:"{bad json",
  xiaoluXiaogWishlistV1:json([{id:"w1",title:"看海",status:"done",completedAt:date}]),
  xiaoluXiaogTimelineV1:json({schemaVersion:2,memories:[],futureField:{keep:true}}),
  xiaoluXiaogNotesV1:json({schemaVersion:2,notebooks:[],notes:[]})
});
const payload=backup.createBackup(source,new Date(date));
assert.equal(payload.backupSchemaVersion,1);
assert.equal(payload.app.version,"2.3");
assert.equal(payload.modules.english.entries.xiaoluXiaogVocabularyV2.format,"raw","broken JSON must still be preserved in export");
assert.equal(payload.modules.timeline.entries.xiaoluXiaogTimelineV1.value.futureField.keep,true,"unknown fields must survive export");
const target=new MemoryStorage({legacySentinel:"keep-me",unrelatedApp:"untouched"});
const inspection=backup.inspectBackup(payload,target);
assert.equal(inspection.valid,true);
assert.ok(inspection.skipped.some(x=>x.key==="xiaoluXiaogVocabularyV2"),"invalid module must be skipped independently");
const restored=backup.restoreBackup(payload,target);
assert.equal(restored.restored.length,3);
assert.equal(target.getItem("legacySentinel"),"keep-me");
assert.equal(target.getItem("unrelatedApp"),"untouched");
assert.equal(JSON.parse(target.getItem("xiaoluXiaogTimelineV1")).futureField.keep,true);
assert.equal(backup.inspectBackup({...payload,backupSchemaVersion:2},target).valid,false,"future backup schema must not restore");

const downgradePayload=backup.createBackup(new MemoryStorage({xiaoluXiaogExerciseV1:json({schemaVersion:2,records:[]})}),new Date(date));
const newerTarget=new MemoryStorage({xiaoluXiaogExerciseV1:json({schemaVersion:3,records:[{id:"future"}]})});
const downgrade=backup.inspectBackup(downgradePayload,newerTarget);
assert.equal(downgrade.restorable.length,0);
assert.match(downgrade.skipped[0].reason,/避免降级覆盖/);

const rollbackPayload=backup.createBackup(new MemoryStorage({xiaoluXiaogWishlistV1:json([{id:"new"}]),xiaoluXiaogTimelineV1:json({schemaVersion:2,memories:[]})}),new Date(date));
const rollbackTarget=new MemoryStorage({xiaoluXiaogWishlistV1:json([{id:"old"}])});
rollbackTarget.failKey="xiaoluXiaogTimelineV1";
const rollback=backup.restoreBackup(rollbackPayload,rollbackTarget);
assert.equal(rollback.rolledBack,true);
assert.equal(JSON.parse(rollbackTarget.getItem("xiaoluXiaogWishlistV1"))[0].id,"old","partial restore must roll back earlier writes");

const exerciseRecords=[...Array.from({length:10},(_,i)=>({id:"e"+i,date:"2026-09-"+String(i+1).padStart(2,"0"),type:"核心",status:"completed"})),{id:"rest",date:"2026-09-11",type:"休息",status:"rest"}];
const lifeStorage=new MemoryStorage({
  xiaoluXiaogWishlistV1:json([{id:"w1",title:"看海",status:"done",createdAt:date,completedAt:date}]),
  xiaoluXiaogTravelV1:json({schemaVersion:1,records:Array.from({length:5},(_,i)=>({id:"p"+i,status:"visited",createdAt:date}))}),
  xiaoluXiaogTransportV1:json({schemaVersion:1,entries:{},custom:[],achievementDates:{}}),
  xiaoluXiaogExerciseV1:json({schemaVersion:2,records:exerciseRecords}),
  xiaoluXiaogTimelineV1:json({schemaVersion:2,memories:Array.from({length:10},(_,i)=>({id:"m"+i,title:"回忆"+i,date:"2026-09-01",createdAt:date}))}),
  xiaoluXiaogNotesV1:json({schemaVersion:2,notes:Array.from({length:10},(_,i)=>({id:"n"+i,title:"笔记"+i,date:"2026-09-01",createdAt:date}))}),
  xiaoluXiaogVocabularyV2:json({version:4,books:{cet6:{history:[{date,mode:"daily",words:50}]}}})
});
const first=achievements.evaluate(lifeStorage,new Date("2026-09-12T00:00:00.000Z"));
assert.equal(first.definitions.length,35);
for(const id of ["wish-first","wish-first-done","footprint-first","footprint-five","exercise-first","exercise-five","exercise-ten","exercise-rest","timeline-first","timeline-ten","note-first","note-ten","study-daily-fifty"])assert.ok(first.unlocked.some(x=>x.id===id),id+" should auto-unlock from old data");
const savedDates=JSON.parse(lifeStorage.getItem(achievements.KEY)).unlocked,setsAfterFirst=lifeStorage.setCount;
achievements.evaluate(lifeStorage,new Date("2026-09-13T00:00:00.000Z"));
assert.deepEqual(JSON.parse(lifeStorage.getItem(achievements.KEY)).unlocked,savedDates,"achievement unlock dates must not repeat");
assert.equal(lifeStorage.setCount,setsAfterFirst,"second evaluation should not rewrite unchanged achievement state");
const futureAchievementState=json({schemaVersion:2,unlocked:{future:{unlockedAt:date}},unknown:true}),futureStorage=new MemoryStorage({xiaoluXiaogAchievementsV2:futureAchievementState,xiaoluXiaogWishlistV1:json([{id:"w"}])});
achievements.evaluate(futureStorage,new Date());
assert.equal(futureStorage.getItem(achievements.KEY),futureAchievementState,"future achievement schema must remain untouched");
const brokenAchievements=new MemoryStorage({xiaoluXiaogAchievementsV2:"{bad",xiaoluXiaogWishlistV1:json([{id:"w"}])});
achievements.evaluate(brokenAchievements,new Date());
assert.equal(brokenAchievements.getItem(achievements.KEY),"{bad","malformed achievement data must not be overwritten");

console.log("PASS v2.3 core: full backup, invalid isolation, no downgrade, rollback, unknown preservation, life achievements, no duplicate unlocks");
