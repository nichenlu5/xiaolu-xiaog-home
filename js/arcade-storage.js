const ArcadeStorage = (() => {
  const KEY = "xiaoluXiaogArcadeV1";
  const empty = () => ({
    plays: { lyrics: 0, timer: 0, sync: 0, memory: 0, world: 0, province: 0 },
    timerBest: { xiaolu: null, xiaog: null }, timerSoloBest: { single: null, average: null }, timerHistory: [], syncBest: 0, syncHistory: [],
    memoryBest: { easy: { time: null, moves: null }, normal: { time: null, moves: null }, hard: { time: null, moves: null } },
    memoryBattleHistory: [],
    worldBest: { score: 0, streak: 0, country: 0, city: 0 },
    provinceBest: { ten: 0, twenty: 0, streak: 0 }, lyricsBest: { xiaolu: 0, xiaog: 0, total: 5 }, lyricsHistory: [],
    achievementDates: {}
  });
  function read() {
    try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch (error) { console.warn("读取游戏厅存档失败：", error); return empty(); }
  }
  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (error) { console.warn("保存游戏厅存档失败：", error); }
  }
  function addPlay(game) { const data = read(); data.plays = { ...empty().plays, ...data.plays }; data.plays[game] = (data.plays[game] || 0) + 1; write(data); }
  function saveTimerBest(player, error) { const data = read(); if (data.timerBest[player] === null || error < data.timerBest[player]) data.timerBest[player] = error; write(data); return data.timerBest[player]; }
  function saveTimerSolo(errors) { const data = read(), bestSingle = Math.min(...errors), average = errors.reduce((sum, value) => sum + value, 0) / errors.length; data.timerSoloBest = { ...(empty().timerSoloBest), ...(data.timerSoloBest || {}) }; if (data.timerSoloBest.single === null || bestSingle < data.timerSoloBest.single) data.timerSoloBest.single = bestSingle; if (data.timerSoloBest.average === null || average < data.timerSoloBest.average) data.timerSoloBest.average = average; data.timerHistory = Array.isArray(data.timerHistory) ? data.timerHistory : []; data.timerHistory.unshift({ date: new Date().toISOString(), errors: [...errors], average, bestSingle }); data.timerHistory = data.timerHistory.slice(0, 30); write(data); return data.timerSoloBest; }
  function saveSyncBest(score) { const data = read(); data.syncBest = Math.max(data.syncBest || 0, score); write(data); return data.syncBest; }
  function saveSyncResult(score) { const data = read(); data.syncHistory = Array.isArray(data.syncHistory) ? data.syncHistory : []; data.syncHistory.unshift({ date: new Date().toISOString(), score, total: 10 }); write(data); return data.syncHistory; }
  function getSyncHistory() { const history = read().syncHistory; return Array.isArray(history) ? history : []; }
  function saveMemoryBest(level, time, moves) { const data = read(); data.memoryBest = { ...empty().memoryBest, ...(data.memoryBest || {}) }; const old = data.memoryBest[level] || { time: null, moves: null }; data.memoryBest[level] = { time: old.time === null ? time : Math.min(old.time, time), moves: old.moves === null ? moves : Math.min(old.moves, moves) }; write(data); return data.memoryBest[level]; }
  function saveMemoryBattle(xiaolu, xiaog) { const data = read(); data.memoryBattleHistory = Array.isArray(data.memoryBattleHistory) ? data.memoryBattleHistory : []; data.memoryBattleHistory.unshift({ date: new Date().toISOString(), xiaolu, xiaog, winner: xiaolu === xiaog ? "平局" : xiaolu > xiaog ? "小路" : "小G" }); data.memoryBattleHistory = data.memoryBattleHistory.slice(0, 30); write(data); return data.memoryBattleHistory; }
  function saveWorldBest(mode, score, streak) { const data = read(); data.worldBest = { ...empty().worldBest, ...(data.worldBest || {}) }; data.worldBest.score = Math.max(data.worldBest.score || 0, score); data.worldBest.streak = Math.max(data.worldBest.streak || 0, streak); data.worldBest[mode] = Math.max(data.worldBest[mode] || 0, score); write(data); return data.worldBest; }
  function saveProvinceBest(total, score, streak) { const data = read(); data.provinceBest = { ...empty().provinceBest, ...(data.provinceBest || {}) }; const key = total === 20 ? "twenty" : "ten"; data.provinceBest[key] = Math.max(data.provinceBest[key] || 0, score); data.provinceBest.streak = Math.max(data.provinceBest.streak || 0, streak); write(data); return data.provinceBest; }
  function saveLyricsResult(xiaolu, xiaog, total) { const data = read(); data.lyricsBest = { ...(empty().lyricsBest), ...(data.lyricsBest || {}) }; data.lyricsBest.xiaolu = Math.max(data.lyricsBest.xiaolu || 0, xiaolu); data.lyricsBest.xiaog = Math.max(data.lyricsBest.xiaog || 0, xiaog); data.lyricsBest.total = total; data.lyricsHistory = Array.isArray(data.lyricsHistory) ? data.lyricsHistory : []; data.lyricsHistory.unshift({ date: new Date().toISOString(), xiaolu, xiaog, total }); data.lyricsHistory = data.lyricsHistory.slice(0, 30); write(data); }
  function saveAchievementDates(ids) { const data = read(); data.achievementDates = data.achievementDates && typeof data.achievementDates === "object" ? data.achievementDates : {}; const now = new Date().toISOString(); ids.forEach(id => { if (!data.achievementDates[id]) data.achievementDates[id] = now; }); write(data); return data.achievementDates; }
  return { read, addPlay, saveTimerBest, saveTimerSolo, saveSyncBest, saveSyncResult, getSyncHistory, saveMemoryBest, saveMemoryBattle, saveWorldBest, saveProvinceBest, saveLyricsResult, saveAchievementDates };
})();
