(() => {
  const $ = id => document.getElementById(id), shuffle = list => { const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
  let mode, questions, index, layer, score, streak, maxStreak, answered, candidatesOpen, advancing = false;
  function showRecord() { const b = ArcadeStorage.read().worldBest || {}; $("world-record").textContent = `历史最佳：国家 ${b.country || 0} 分 · 城市 ${b.city || 0} 分 · 最高连对 ${b.streak || 0}`; }
  function start(chosen) { mode = chosen; questions = shuffle(WorldQuestions[mode]).slice(0, 10); index = score = streak = maxStreak = 0; $("world-setup").hidden = true; $("world-game").hidden = false; showQuestion(); }
  function showQuestion() { layer = 1; answered = candidatesOpen = advancing = false; $("candidate-area").hidden = true; $("world-feedback").hidden = true; $("guess-button").hidden = false; $("next-clue").hidden = false; render(); }
  function render() { const q = questions[index]; $("world-title").textContent = mode === "country" ? "🌍 猜国家" : "🏙️ 猜城市"; $("world-round").textContent = `题目 ${index + 1} / 10`; $("world-score").textContent = score; $("world-streak").textContent = streak; $("world-layer").textContent = `${layer} / 4`; $("clue-list").innerHTML = q.slice(1, layer + 1).map((clue, i) => `<div><span>线索 ${i + 1}</span><p>${clue}</p></div>`).join(""); $("next-clue").disabled = layer >= 4; }
  function revealNext() { if (layer < 4) { layer++; candidatesOpen = false; $("candidate-area").hidden = true; render(); } }
  function openCandidates() { if (candidatesOpen || advancing) return; candidatesOpen = true; const answer = questions[index][0]; const pool = WorldQuestions[mode].map(q => q[0]).filter(x => x !== answer); const names = shuffle([answer, ...shuffle(pool).slice(0, 7)]); $("candidate-grid").innerHTML = names.map(name => `<button class="candidate-button" data-answer="${name}">${name}</button>`).join(""); $("candidate-grid").querySelectorAll("button").forEach(button => button.addEventListener("click", choose)); $("candidate-area").hidden = false; }
  function choose(event) {
    if (advancing) return;
    const selected = event.currentTarget.dataset.answer, answer = questions[index][0], correct = selected === answer;
    answered = true;
    if (correct) {
      const points = 5 - layer; score += points; streak++; maxStreak = Math.max(maxStreak, streak);
      event.currentTarget.classList.add("correct"); feedback(`答对了！${answer}，获得 ${points} 分。`, true); renderStatsOnly(); advanceSoon();
    } else {
      event.currentTarget.classList.add("wrong"); streak = 0; feedback(`不是${selected}。再看一条线索吧。`, false);
      if (layer < 4) {
        advancing = true; document.querySelectorAll(".candidate-button").forEach(b => b.disabled = true);
        setTimeout(() => { advancing = false; revealNext(); $("world-feedback").hidden = true; }, 700);
      } else {
        document.querySelectorAll(".candidate-button").forEach(b => { if (b.dataset.answer === answer) b.classList.add("correct"); });
        feedback(`正确答案是${answer}。`, false); advanceSoon();
      }
      renderStatsOnly();
    }
  }
  function feedback(text, correct) { const el = $("world-feedback"); el.className = `feedback ${correct ? "correct-feedback" : "wrong-feedback"}`; el.textContent = text; el.hidden = false; }
  function renderStatsOnly() { $("world-score").textContent = score; $("world-streak").textContent = streak; }
  function advanceSoon() { advancing = true; document.querySelectorAll(".candidate-button").forEach(b => b.disabled = true); setTimeout(() => { index++; index < 10 ? showQuestion() : finish(); }, 900); }
  function finish() { ArcadeStorage.addPlay("world"); const best = ArcadeStorage.saveWorldBest(mode, score, maxStreak); $("world-game").hidden = true; const result = $("world-result"); result.innerHTML = `<div class="result-emoji">🌟</div><p class="eyebrow">JOURNEY COMPLETE</p><h2>探索完成！</h2><p class="score-line"><strong>${score}</strong><span>/ 40 分</span></p><div class="result-details"><span>最高连对 ${maxStreak}</span><span>${mode === "country" ? "国家" : "城市"}最佳 ${best[mode]} 分</span></div><div class="actions result-actions"><button class="primary-button" onclick="location.reload()">再玩一局</button><a class="text-button" href="./game-hall.html">返回游戏厅</a></div>`; result.hidden = false; }
  document.querySelectorAll("[data-world-mode]").forEach(b => b.addEventListener("click", () => start(b.dataset.worldMode))); $("guess-button").addEventListener("click", openCandidates); $("next-clue").addEventListener("click", revealNext); showRecord();
})();
