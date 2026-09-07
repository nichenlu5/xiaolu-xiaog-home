(() => {
  const arcade = ArcadeStorage.read(), battles = GameStorage.getBattleSummary(), quiz = GameStorage.getStats();
  const transportArchive = FootprintsStorage.transport();
  const transportCatalog = {
    bus:"urban",subway:"urban","light-rail":"urban",taxi:"urban",bicycle:"urban","e-bike":"urban",
    train:"railway","hard-seat":"railway","hard-sleeper":"railway","soft-sleeper":"railway","high-speed-rail":"railway",emu:"railway",intercity:"railway",
    coach:"road","self-drive":"road",motorcycle:"road",plane:"air",ferry:"water","tour-boat":"water",cruise:"water",maglev:"special",tram:"special","cable-car":"special",ropeway:"special","sightseeing-train":"special"
  };
  (transportArchive.custom || []).forEach(item => { if (item?.id) transportCatalog[item.id] = item.category || "future"; });
  const unlockedTransportIds = Object.keys(transportCatalog).filter(id => ["experienced","special"].includes(transportArchive.entries?.[id]?.state));
  const unlockedTransport = new Set(unlockedTransportIds), transportTotal = Object.keys(transportCatalog).length;
  const plays = { lyrics: 0, timer: 0, sync: 0, memory: 0, world: 0, province: 0, ...(arcade.plays || {}) };
  const totalPlays = Object.values(plays).reduce((sum, value) => sum + (Number(value) || 0), 0) + Math.max(quiz.plays || 0, battles.total || 0);
  const memory = arcade.memoryBest || {}, timer = arcade.timerSoloBest || {}, lyrics = arcade.lyricsBest || {}, province = arcade.provinceBest || {}, world = arcade.worldBest || {};
  const memoryGreat = Object.entries(memory).some(([level, value]) => value && Number.isFinite(value.moves) && value.moves <= ({ easy: 10, normal: 18, hard: 26 }[level] || 16));
  const nearMiss = (Number.isFinite(timer.average) && timer.average > .30 && timer.average <= .35) || arcade.syncBest === 7 || (world.score >= 28 && world.score < 30) || province.ten === 7 || (province.twenty >= 14 && province.twenty < 16);
  const oldest = list => Array.isArray(list) && list.length ? list[list.length - 1].date : null;
  const definitions = [
    ["first-play","🎮","初次开黑","完成任意一局游戏。",totalPlays > 0, oldest(arcade.syncHistory) || oldest(arcade.timerHistory) || oldest(arcade.lyricsHistory) || oldest(battles.history)],
    ["science-pride","🧠","理科生尊严","知识擂台拿到 8 分或更多。",(quiz.bestScore || 0) >= 8 || battles.history.some(game => game.xiaoluScore >= 8),null],
    ["xiaolu-wins","🌟","小路赢啦","小路第一次在双人知识擂台战胜小G。",battles.xiaoluWins > 0,battles.history.filter(game => game.result === "小路胜").at(-1)?.date],
    ["ai-oops","🤖","人机翻车现场","小G在知识擂台至少答错一道题。",battles.history.some(game => game.xiaogScore < 10),battles.history.filter(game => game.xiaogScore < 10).at(-1)?.date],
    ["streak-engine","🔥","连胜发动机","知识问答连续答对 5 题。",(quiz.bestStreak || 0) >= 5,null],
    ["in-sync","💞","心有灵犀","默契挑战一局匹配 8 题或更多。",(arcade.syncBest || 0) >= 8,oldest((arcade.syncHistory || []).filter(game => game.score >= 8))],
    ["do-we-know","😹","我们真的认识吗","默契只有 2 格也没关系，笑着玩完最重要。",(arcade.syncHistory || []).some(game => game.score <= 2),oldest((arcade.syncHistory || []).filter(game => game.score <= 2))],
    ["world-traveler","🌍","世界旅行家","世界猜猜猜拿到 30 分或更多。",(world.score || 0) >= 30,null],
    ["china-map","🗺️","中国地图装进脑子","猜省份正确率达到 80%。",(province.ten || 0) >= 8 || (province.twenty || 0) >= 16,null],
    ["memory-master","🧩","记忆大师","用很少的步数完成一次记忆翻牌。",memoryGreat,null],
    ["human-stopwatch","⏱️","人体秒表","读秒挑战平均误差不超过 0.30 秒。",Number.isFinite(timer.average) && timer.average <= .30,oldest((arcade.timerHistory || []).filter(game => game.average <= .30))],
    ["perfect-tick","⚡","分秒不差","读秒挑战单次误差不超过 0.10 秒。",Number.isFinite(timer.single) && timer.single <= .10,null],
    ["song-library","🎵","中华小曲库","猜歌词一局答对 4 题或更多。",(lyrics.xiaolu || 0) >= 4 || (lyrics.xiaog || 0) >= 4,oldest((arcade.lyricsHistory || []).filter(game => game.xiaolu >= 4 || game.xiaog >= 4))],
    ["revenge","⚔️","复仇成功","在错题复仇中重新答对一道题。",(quiz.revengeWins || 0) > 0,null],
    ["so-close","🌙","差一点点","用特别接近的成绩擦过更高档位。",nearMiss,null],
    ["regular","🏠","小家常客","累计完成 10 局游戏。",totalPlays >= 10,null],
    ["transport-urban","🚇","城市探索者","体验地铁或轻轨。",unlockedTransport.has("subway") || unlockedTransport.has("light-rail"),transportArchive.achievementDates?.["transport-urban"]],
    ["transport-rail","🚆","铁路旅行者","体验三种铁路交通。",unlockedTransportIds.filter(id => transportCatalog[id] === "railway").length >= 3,transportArchive.achievementDates?.["transport-rail"]],
    ["transport-air","✈️","第一次飞向天空","点亮客机。",unlockedTransport.has("plane"),transportArchive.achievementDates?.["transport-air"]],
    ["transport-water","⛴️","水上旅行者","体验任意一种水上交通。",unlockedTransportIds.some(id => transportCatalog[id] === "water"),transportArchive.achievementDates?.["transport-water"]],
    ["transport-collector","🎒","交通收藏家","解锁十种交通工具。",unlockedTransportIds.length >= 10,transportArchive.achievementDates?.["transport-collector"]],
    ["transport-master","🏆","交通大师","交通图鉴完成度达到 80%。",transportTotal > 0 && unlockedTransportIds.length / transportTotal >= .8,transportArchive.achievementDates?.["transport-master"]]
  ].map(([id, icon, name, description, unlocked, inferredAt]) => ({ id, icon, name, description, unlocked, inferredAt }));
  const unlocked = definitions.filter(item => item.unlocked), savedDates = ArcadeStorage.saveAchievementDates(unlocked.map(item => item.id));
  const formatDate = value => { if (!value) return "已解锁"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "已解锁" : `解锁于 ${date.toLocaleDateString("zh-CN")}`; };
  const grid = document.getElementById("achievement-grid");
  definitions.forEach(item => { const card = document.createElement("article"); card.className = `achievement-card${item.unlocked ? " unlocked" : " locked"}`; card.innerHTML = `<span class="achievement-icon" aria-hidden="true">${item.unlocked ? item.icon : "🔒"}</span><div><h2>${item.name}</h2><p>${item.description}</p><small>${item.unlocked ? formatDate(item.inferredAt || savedDates[item.id]) : "未解锁"}</small></div>`; grid.append(card); });
  const count = unlocked.length, total = definitions.length, percent = Math.round(count / total * 100); document.getElementById("achievement-count").textContent = `已解锁 ${count} / ${total}`; document.getElementById("achievement-percent").textContent = `${percent}%`; document.getElementById("achievement-progress-bar").style.width = `${percent}%`; document.querySelector(".achievement-progress").setAttribute("aria-valuenow", String(count)); document.querySelector(".achievement-progress").setAttribute("aria-valuemax", String(total));
})();
