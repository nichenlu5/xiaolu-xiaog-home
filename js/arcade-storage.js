const ArcadeStorage = (() => {
  const KEY = "xiaoluXiaogArcadeV1";
  const empty = () => ({ plays: { lyrics: 0, timer: 0, sync: 0 }, timerBest: { xiaolu: null, xiaog: null }, syncBest: 0, syncHistory: [] });
  function read() {
    try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch (error) { console.warn("读取游戏厅存档失败：", error); return empty(); }
  }
  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (error) { console.warn("保存游戏厅存档失败：", error); }
  }
  function addPlay(game) { const data = read(); data.plays = { ...empty().plays, ...data.plays }; data.plays[game] += 1; write(data); }
  function saveTimerBest(player, error) { const data = read(); if (data.timerBest[player] === null || error < data.timerBest[player]) data.timerBest[player] = error; write(data); return data.timerBest[player]; }
  function saveSyncBest(score) { const data = read(); data.syncBest = Math.max(data.syncBest || 0, score); write(data); return data.syncBest; }
  function saveSyncResult(score) { const data = read(); data.syncHistory = Array.isArray(data.syncHistory) ? data.syncHistory : []; data.syncHistory.unshift({ date: new Date().toISOString(), score, total: 10 }); write(data); return data.syncHistory; }
  function getSyncHistory() { const history = read().syncHistory; return Array.isArray(history) ? history : []; }
  return { read, addPlay, saveTimerBest, saveSyncBest, saveSyncResult, getSyncHistory };
})();
