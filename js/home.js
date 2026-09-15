(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const set = (selector, value) => { const element=$(selector); if(element) element.textContent=value; };
  const safe = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const newest = (list, fields) => [...list].sort((a,b) => String(fields.map(key=>b?.[key]).find(Boolean)||"").localeCompare(String(fields.map(key=>a?.[key]).find(Boolean)||"")))[0];
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

  const now = new Date();
  const today = localDate(now);
  const weekdays = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
  const hour = now.getHours();
  const greeting = hour<6 ? "夜深了，小路" : hour<11 ? "早上好，小路" : hour<14 ? "中午好，小路" : hour<18 ? "下午好，小路" : "晚上好，小路";
  set("#home-date",`${now.getMonth()+1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`);
  set("#home-greeting",greeting);

  const exercise = window.XiaoluExerciseStore?.load().state.records || [];
  const memories = window.XiaoluTimelineStore?.load().state.memories || [];
  const notes = window.XiaoluNotesStore?.load().state.notes || [];
  const gifts = window.XiaoluGiftsStore?.load().state.gifts || [];
  const journeyLoaded = window.XiaoluGraduateJourney?.load();
  const rawWishes = safe("xiaoluXiaogWishlistV1",[]);
  const wishes = Array.isArray(rawWishes) ? rawWishes : [];
  const study = safe("xiaoluXiaogVocabularyV2",{});
  const achievement = window.XiaoluAchievementCore?.evaluate();
  const latestExercise = newest(exercise,["date","updatedAt"]);
  const latestMemory = newest(memories,["date","updatedAt"]);
  const latestNote = newest(notes,["date","updatedAt"]);
  const latestWish = newest(wishes.filter(item=>item?.status==="done"),["completedAt","updatedAt"]);
  const todayExercise = newest(exercise.filter(item=>item?.date===today),["updatedAt","createdAt"]);
  const history = Object.values(study?.books || {}).flatMap(book=>Array.isArray(book?.history)?book.history:[]);
  const todayHistory = history.filter(item=>item?.mode==="daily"&&Number.isFinite(Date.parse(item.date))&&localDate(new Date(item.date))===today);
  const todayWords = todayHistory.reduce((sum,item)=>sum+(Number(item.words)||0),0);
  const todayAcademic = todayHistory.reduce((sum,item)=>sum+(Number(item.academicWords)||0),0);
  const activeSession = Object.values(study?.books || {}).map(book=>book?.session).find(session=>session?.mode==="daily");
  const liveIds = activeSession?.round===0 ? activeSession.queue?.slice(0,activeSession.index)||[] : [];
  const liveAcademic = liveIds.filter(id=>String(id).startsWith("academic-priority-")).length;
  const liveWords = liveIds.length;
  const totalProgress = Math.min(50,todayWords+liveWords), academicProgress = Math.min(30,todayAcademic+liveAcademic);
  const studySummary = totalProgress ? `今日 ${totalProgress} / 50 · 学术 ${academicProgress} / 30` : activeSession ? "今日学习进行中" : "今天可以慢慢开始";
  const exerciseSummary = todayExercise ? (todayExercise.type==="休息"||todayExercise.status==="rest" ? "今天是安心休息日" : `今天 · ${todayExercise.type}${todayExercise.action?` · ${todayExercise.action}`:""}`) : "今天还没有记录";
  const memorySummary = latestMemory ? `${latestMemory.date} · ${latestMemory.title}` : "还没有回忆";
  const wishSummary = latestWish ? latestWish.title : "还没有完成的愿望";

  set("#today-study",studySummary);
  set("#today-exercise",exerciseSummary);
  set("#today-memory",memorySummary);
  set("#today-wish",wishSummary);
  set("#recent-exercise",latestExercise?`${latestExercise.date} · ${latestExercise.type}${latestExercise.action?` · ${latestExercise.action}`:""}`:"还没有运动记录");
  set("#recent-memory",memorySummary);
  set("#recent-wish",wishSummary);
  set("#recent-note",latestNote?`${latestNote.date} · ${latestNote.title}`:"还没有小纸条");
  set("#recent-study",studySummary);
  set("#recent-achievement",achievement?.latest?`${achievement.latest.icon} ${achievement.latest.name}`:"还没有解锁记录");
  const latestGift=newest(gifts,["date","updatedAt"]);
  set("#home-gift-summary",latestGift?`最近：${latestGift.name}`:"收藏文件礼物与纪念小物");
  if(journeyLoaded){const metrics=window.XiaoluGraduateJourney.journeyMetrics(journeyLoaded.state.settings,now),nextGoal=window.XiaoluGraduateJourney.nextMilestone(journeyLoaded.state,now);set("#home-journey-phase",metrics.phase.name);set("#home-journey-remaining",metrics.phase.id==="graduated"?"已经走到毕业这一站":`距离预计毕业${metrics.approximateGraduation?"约 ":""}${metrics.remainingDays} 天`);set("#home-journey-elapsed",metrics.current<metrics.start?"尚未入学":`已读研约 ${metrics.elapsedDays} 天`);set("#home-journey-percent",`${metrics.progress}%`);set("#home-journey-goal",nextGoal?`下一目标：${nextGoal.title}`:"还没有设置未完成目标");const bar=$("#home-journey-bar");if(bar)bar.style.width=`${metrics.progress}%`;}
})();
