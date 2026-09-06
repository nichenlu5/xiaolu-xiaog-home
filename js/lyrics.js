const total = Math.min(5, lyricQuestions.length);
const questions = [...lyricQuestions].sort(() => Math.random() - .5).slice(0, total);
let index = 0, xAnswer = null, xScore = 0, gScore = 0, xStreak = 0, gStreak = 0;
const $ = id => document.getElementById(id);
function render() {
  const q = questions[index]; xAnswer = null; $("round").textContent = `${index + 1} / ${total}`; $("clue").textContent = q.clue; $("g-entry").hidden = true; $("reveal").hidden = true; $("next").hidden = true; $("options").replaceChildren(); $("g-options").replaceChildren();
  q.options.forEach((text, i) => { const b = document.createElement("button"); b.className="arcade-option"; b.textContent=`${String.fromCharCode(65+i)} · ${text}`; b.onclick=()=>chooseX(i); $("options").append(b); });
}
function chooseX(i) {
  if (xAnswer !== null) return; xAnswer=i; [...$("options").children].forEach((b,n)=>{b.disabled=true;if(n===i)b.classList.add("selected");});
  "ABCD".split("").forEach((letter,n)=>{const b=document.createElement("button");b.textContent=letter;b.setAttribute("aria-label",`录入小G答案 ${letter}`);b.onclick=()=>reveal(n);$("g-options").append(b);}); $("g-entry").hidden=false;
}
function reveal(gAnswer) {
  const q=questions[index], xc=xAnswer===q.answer, gc=gAnswer===q.answer; xScore+=xc?1:0;gScore+=gc?1:0;xStreak=xc?xStreak+1:0;gStreak=gc?gStreak+1:0;
  [...$("options").children].forEach((b,n)=>{b.classList.remove("selected");if(n===q.answer)b.classList.add("correct");if(n===xAnswer&&!xc)b.classList.add("wrong");}); [...$("g-options").children].forEach(b=>b.disabled=true);
  $("xs").textContent=xScore;$("gs").textContent=gScore;$("xst").textContent=xStreak;$("gst").textContent=gStreak;
  const label=n=>`${String.fromCharCode(65+n)} · ${q.options[n]}`; $("reveal").innerHTML=`<h2>${xc?"小路答对":"小路差一点"}，${gc?"小G答对":"小G差一点"}</h2><p>小路：<b>${label(xAnswer)}</b></p><p>小G：<b>${label(gAnswer)}</b></p><p>正确答案：<b>${label(q.answer)}</b></p>`; $("reveal").hidden=false;$("next").textContent=index===total-1?"查看结果 →":"下一题 →";$("next").hidden=false;$("g-entry").hidden=true;
}
$("next").onclick=()=>{if(++index<total)render();else finish();};
function finish(){ArcadeStorage.addPlay("lyrics");$("play").hidden=true;const winner=xScore>gScore?"小路获胜！":xScore<gScore?"小G获胜！":"这一局平手！";$("result").innerHTML=`<div class="result-emoji">🎶</div><p class="eyebrow">本局完成</p><h2>${winner}</h2><p>小路 ${xScore} : ${gScore} 小G</p><div class="actions" style="justify-content:center"><button class="primary-button" onclick="location.reload()">再玩一局</button><a class="text-button" href="game-hall.html">返回游戏厅</a></div>`;$("result").hidden=false;}
render();
