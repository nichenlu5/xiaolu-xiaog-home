(() => {
  const icons = ["🌙","🍓","🐳","🌻","⭐","🎈","☕","✈️","🍀","🎵"];
  const levels = { easy: 6, normal: 8, hard: 10 };
  const $ = id => document.getElementById(id);
  let mode, level, pairCount, cards, open = [], matched = 0, moves = 0, startAt, locked = false, turn = "xiaolu", scores = { xiaolu: 0, xiaog: 0 }, flipTimer;
  const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  function showRecord() { const b = ArcadeStorage.read().memoryBest?.normal; $("memory-record").textContent = b && b.time !== null ? `普通难度最佳：${b.time.toFixed(1)} 秒 · ${b.moves} 步` : "完成单人挑战后，这里会留下你的最佳记录。"; }
  function start(chosenMode) {
    mode = chosenMode; level = document.querySelector('input[name="difficulty"]:checked').value; pairCount = levels[level];
    cards = shuffle(icons.slice(0, pairCount).flatMap((icon, pair) => [{ icon, pair }, { icon, pair }]));
    open = []; matched = moves = 0; locked = false; turn = "xiaolu"; scores = { xiaolu: 0, xiaog: 0 }; startAt = performance.now();
    $("setup").hidden = true; $("memory-result").hidden = true; $("memory-game").hidden = false; renderBoard(); updateStatus();
  }
  function renderBoard() {
    const board = $("memory-board"); board.className = `memory-board cards-${cards.length}`; board.innerHTML = "";
    cards.forEach((card, index) => { const button = document.createElement("button"); button.className = "memory-card"; button.dataset.index = index; button.setAttribute("aria-label", `第 ${index + 1} 张牌，背面`); button.innerHTML = `<span class="card-number">${index + 1}</span><span class="card-back">?</span><span class="card-face">${card.icon}</span>`; button.addEventListener("click", flip); board.appendChild(button); });
  }
  function updateStatus(message = "") {
    $("memory-progress").textContent = `${matched} / ${pairCount} 对 · ${moves} 步`;
    if (mode === "battle") { $("memory-score").innerHTML = `<div><span>小路</span><strong>${scores.xiaolu}</strong></div><b>VS</b><div><span>小G</span><strong>${scores.xiaog}</strong></div>`; $("turn-note").textContent = message || `现在轮到：${turn === "xiaolu" ? "小路" : "小G"}`; }
    else { $("memory-score").innerHTML = `<div><span>用时</span><strong id="memory-time">0.0 秒</strong></div><b>·</b><div><span>配对</span><strong>${matched} / ${pairCount}</strong></div>`; $("turn-note").textContent = message || "每翻开两张牌记为一步"; updateClock(); }
  }
  function updateClock() { if (mode !== "solo" || matched === pairCount) return; const el = $("memory-time"); if (el) el.textContent = `${((performance.now() - startAt) / 1000).toFixed(1)} 秒`; requestAnimationFrame(updateClock); }
  function flip(event) {
    const button = event.currentTarget, index = Number(button.dataset.index); if (locked || button.classList.contains("flipped") || button.classList.contains("matched")) return;
    button.classList.add("flipped"); button.setAttribute("aria-label", `第 ${index + 1} 张牌，${cards[index].icon}`); open.push(index); if (open.length < 2) return;
    moves++; locked = true; const [a, b] = open;
    if (cards[a].pair === cards[b].pair) { document.querySelectorAll(`[data-index="${a}"],[data-index="${b}"]`).forEach(el => el.classList.add("matched")); matched++; if (mode === "battle") scores[turn]++; open = []; locked = false; updateStatus("配对成功！再翻一次"); if (matched === pairCount) finish(); else setTimeout(() => updateStatus(), 650); }
    else { updateStatus("没有配对，记住它们的位置"); flipTimer = setTimeout(() => { [a,b].forEach(i => { const el = document.querySelector(`[data-index="${i}"]`); el.classList.remove("flipped"); el.setAttribute("aria-label", `第 ${i + 1} 张牌，背面`); }); open = []; if (mode === "battle") turn = turn === "xiaolu" ? "xiaog" : "xiaolu"; locked = false; updateStatus(); }, 850); }
  }
  function finish() {
    const seconds = (performance.now() - startAt) / 1000; ArcadeStorage.addPlay("memory"); $("memory-game").hidden = true; const result = $("memory-result");
    if (mode === "solo") { const best = ArcadeStorage.saveMemoryBest(level, seconds, moves); result.innerHTML = `<div class="result-emoji">🎉</div><p class="eyebrow">MEMORY COMPLETE</p><h2>完成！</h2><p>用时：<b>${seconds.toFixed(1)} 秒</b><br>步数：<b>${moves} 步</b></p><p class="record-line">本难度最佳：${best.time.toFixed(1)} 秒 · ${best.moves} 步</p>${resultActions()}`; }
    else { const winner = scores.xiaolu === scores.xiaog ? "平局" : scores.xiaolu > scores.xiaog ? "小路获胜！" : "小G获胜！"; ArcadeStorage.saveMemoryBattle(scores.xiaolu, scores.xiaog); result.innerHTML = `<div class="result-emoji">🏆</div><p class="eyebrow">BATTLE COMPLETE</p><h2>${winner}</h2><p>小路 <b>${scores.xiaolu}</b>　VS　小G <b>${scores.xiaog}</b></p>${resultActions()}`; }
    result.hidden = false;
  }
  const resultActions = () => `<div class="actions result-actions"><button class="primary-button" onclick="location.reload()">再玩一局</button><a class="text-button" href="./game-hall.html">返回游戏厅</a></div>`;
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => start(button.dataset.mode)));
  $("memory-restart").addEventListener("click", () => { clearTimeout(flipTimer); location.reload(); }); showRecord();
})();
