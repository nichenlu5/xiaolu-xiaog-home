(() => {
  "use strict";
  const $=s=>document.querySelector(s),safe=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}},sortBy=(list,fields)=>[...list].sort((a,b)=>String(fields.map(x=>b?.[x]).find(Boolean)||"").localeCompare(String(fields.map(x=>a?.[x]).find(Boolean)||"")))[0];
  const exercise=window.XiaoluExerciseStore?.load().state.records||[],memories=window.XiaoluTimelineStore?.load().state.memories||[],notes=window.XiaoluNotesStore?.load().state.notes||[],wishes=safe("xiaoluXiaogWishlistV1",[]),study=safe("xiaoluXiaogVocabularyV2",{}),achievement=window.XiaoluAchievementCore?.evaluate();
  const latestExercise=sortBy(exercise,["date","updatedAt"]),latestMemory=sortBy(memories,["date","updatedAt"]),latestNote=sortBy(notes,["date","updatedAt"]),latestWish=sortBy(Array.isArray(wishes)?wishes.filter(x=>x?.status==="done"):[],["completedAt","updatedAt"]);
  const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10),history=Object.values(study?.books||{}).flatMap(book=>Array.isArray(book?.history)?book.history:[]),todayWords=history.filter(x=>x?.mode==="daily"&&String(x.date||"").slice(0,10)===today).reduce((sum,x)=>sum+(Number(x.words)||0),0),active=Object.values(study?.books||{}).some(book=>book?.session?.mode==="daily");
  $("#recent-exercise").textContent=latestExercise?latestExercise.date+" · "+latestExercise.type+(latestExercise.action?" · "+latestExercise.action:""):"还没有运动记录";
  $("#recent-memory").textContent=latestMemory?latestMemory.date+" · "+latestMemory.title:"还没有回忆";
  $("#recent-wish").textContent=latestWish?latestWish.title:"还没有完成的愿望";
  $("#recent-note").textContent=latestNote?latestNote.date+" · "+latestNote.title:"还没有小纸条";
  $("#today-study").textContent=todayWords?"今日已完成 "+todayWords+" 词":active?"今日学习进行中":"今天可以慢慢开始";
  $("#recent-achievement").textContent=achievement?.latest?achievement.latest.icon+" "+achievement.latest.name:"还没有解锁记录";
})();
