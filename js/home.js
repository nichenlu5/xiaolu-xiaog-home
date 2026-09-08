(() => { "use strict";
  const exercise=window.XiaoluExerciseStore?.load().state.records||[],memories=window.XiaoluTimelineStore?.load().state.memories||[];
  const latestExercise=[...exercise].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt))[0];
  const latestMemory=[...memories].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt))[0];
  document.querySelector("#recent-exercise").textContent=latestExercise?`${latestExercise.date} · ${latestExercise.type}${latestExercise.action?` · ${latestExercise.action}`:""}`:"还没有运动记录";
  document.querySelector("#recent-memory").textContent=latestMemory?`${latestMemory.date} · ${latestMemory.title}`:"还没有回忆";
})();
