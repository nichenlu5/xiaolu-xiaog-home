const questions = [...syncQuestions].sort(() => Math.random() - .5).slice(0, 10);
let index = 0, score = 0, xAnswer = null;
const $ = id => document.getElementById(id);
$("best").textContent = ArcadeStorage.read().syncBest || 0;

function renderHistory() {
  const list = $("sync-history-list"), trend = $("sync-trend"), history = ArcadeStorage.getSyncHistory();
  list.replaceChildren();
  trend.replaceChildren();
  if (!history.length) {
    trend.hidden = true;
    const item = document.createElement("li");
    item.className = "empty-history";
    item.textContent = "完成一局后，默契记录会留在这里。";
    list.append(item);
    return;
  }
  trend.hidden = false;
  const recent = history.slice(0, 10).reverse();
  const points = recent.map((game, trendIndex) => {
    const x = recent.length === 1 ? 150 : 12 + trendIndex * 276 / (recent.length - 1);
    const y = 68 - game.score / (game.total || 10) * 56;
    return { x, y, game };
  });
  const ns = "http://www.w3.org/2000/svg";
  const guide = document.createElementNS(ns, "line"); guide.setAttribute("x1", "10"); guide.setAttribute("x2", "290"); guide.setAttribute("y1", "68"); guide.setAttribute("y2", "68"); guide.setAttribute("class", "trend-guide"); trend.append(guide);
  if (points.length > 1) { const line = document.createElementNS(ns, "polyline"); line.setAttribute("points", points.map(point => `${point.x},${point.y}`).join(" ")); line.setAttribute("class", "trend-line"); trend.append(line); }
  points.forEach(point => { const dot = document.createElementNS(ns, "circle"); dot.setAttribute("cx", point.x); dot.setAttribute("cy", point.y); dot.setAttribute("r", "4"); dot.setAttribute("class", "trend-dot"); const title = document.createElementNS(ns, "title"); title.textContent = `${point.game.score}/${point.game.total || 10}`; dot.append(title); trend.append(dot); });
  trend.setAttribute("aria-label", `最近${recent.length}局默契折线趋势：${recent.map(game => `${game.score}/${game.total || 10}`).join("、")}`);
  [...history].reverse().forEach((game, recordIndex) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = `第${recordIndex + 1}次`;
    value.textContent = `${game.score}/${game.total || 10}`;
    item.append(label, value);
    list.append(item);
  });
}

function render() {
  const q = questions[index]; xAnswer = null; $("round").textContent = `${index + 1} / 10`; $("question").textContent = q.question; $("options").replaceChildren(); $("g-options").replaceChildren(); $("g-entry").hidden = true; $("reveal").hidden = true; $("next").hidden = true;
  q.options.forEach((text, i) => { const b = document.createElement("button"); b.className = "arcade-option"; b.textContent = `${String.fromCharCode(65 + i)} · ${text}`; b.onclick = () => chooseX(i); $("options").append(b); });
}
function chooseX(i) {
  if (xAnswer !== null) return; xAnswer = i; [...$("options").children].forEach(b => { b.disabled = true; b.textContent = "🔒 小路的答案已隐藏"; });
  "ABCD".split("").forEach((l, n) => { const b = document.createElement("button"); b.textContent = l; b.setAttribute("aria-label", `录入小G答案 ${l}`); b.onclick = () => reveal(n); $("g-options").append(b); }); $("g-entry").hidden = false;
}
function reveal(g) {
  const q = questions[index], same = xAnswer === g; if (same) score++; $("score").textContent = score;
  [...$("options").children].forEach((b, n) => { b.textContent = `${String.fromCharCode(65 + n)} · ${q.options[n]}`; if (n === xAnswer) b.classList.add(same ? "correct" : "selected"); if (n === g && !same) b.classList.add("wrong"); });
  $("g-entry").hidden = true; $("reveal").innerHTML = `<h2>${same ? "💞 默契 +1" : "原来我们想得不一样～"}</h2><p>小路：<b>${String.fromCharCode(65 + xAnswer)} · ${q.options[xAnswer]}</b></p><p>小G：<b>${String.fromCharCode(65 + g)} · ${q.options[g]}</b></p>`; $("reveal").hidden = false; $("next").textContent = index === 9 ? "查看默契称号 →" : "下一题 →"; $("next").hidden = false;
}
$("next").onclick = () => { if (++index < 10) render(); else finish(); };
function finish() {
  ArcadeStorage.addPlay("sync"); const best = ArcadeStorage.saveSyncBest(score); ArcadeStorage.saveSyncResult(score); renderHistory();
  const title = score <= 3 ? "还在互相探索" : score <= 6 ? "越来越懂彼此" : score <= 8 ? "很有默契" : score === 9 ? "心有灵犀" : "满级默契 💞";
  $("play").hidden = true; $("result").innerHTML = `<div class="result-emoji">💞</div><p class="eyebrow">默契结算</p><h2>${title}</h2><p>10 题中有 <b>${score}</b> 题想到了一起<br>历史最高：${best} 题</p><div class="actions" style="justify-content:center"><button class="primary-button" onclick="location.reload()">再玩一局</button><a class="text-button" href="./game-hall.html">返回游戏厅</a></div>`; $("result").hidden = false;
}
renderHistory();
render();
