const QUESTIONS_PER_GAME = 10;

const elements = {
  modeArea: document.querySelector("#mode-area"), gameArea: document.querySelector("#game-area"),
  soloMode: document.querySelector("#solo-mode"), battleMode: document.querySelector("#battle-mode"), revengeMode: document.querySelector("#revenge-mode"),
  wrongCountLabel: document.querySelector("#wrong-count-label"), historySummary: document.querySelector("#history-summary"), historyList: document.querySelector("#history-list"),
  gameTitle: document.querySelector("#game-title"), category: document.querySelector("#category"),
  currentNumber: document.querySelector("#current-number"), totalNumber: document.querySelector("#total-number"),
  correctCount: document.querySelector("#correct-count"), streakCount: document.querySelector("#streak-count"),
  stats: document.querySelector(".stats"), battleScoreboard: document.querySelector("#battle-scoreboard"),
  xiaoluScore: document.querySelector("#xiaolu-score"), xiaogScore: document.querySelector("#xiaog-score"),
  xiaoluStreak: document.querySelector("#xiaolu-streak"), xiaogStreak: document.querySelector("#xiaog-streak"),
  battleCurrentNumber: document.querySelector("#battle-current-number"), battleTotalNumber: document.querySelector("#battle-total-number"),
  progressBar: document.querySelector("#progress-bar"), questionArea: document.querySelector("#question-area"),
  questionText: document.querySelector("#question-text"), options: document.querySelector("#options"),
  xiaogAnswerArea: document.querySelector("#xiaog-answer-area"), xiaogOptions: document.querySelector("#xiaog-options"),
  feedback: document.querySelector("#feedback"), feedbackTitle: document.querySelector("#feedback-title"), answerSummary: document.querySelector("#answer-summary"),
  explanation: document.querySelector("#explanation"), nextButton: document.querySelector("#next-button"),
  resultArea: document.querySelector("#result-area"), finalScore: document.querySelector("#final-score"),
  finalCorrect: document.querySelector("#final-correct"), bestStreak: document.querySelector("#best-streak"),
  resultMessage: document.querySelector("#result-message"), battleResult: document.querySelector("#battle-result"),
  winnerText: document.querySelector("#winner-text"), finalXiaoluScore: document.querySelector("#final-xiaolu-score"),
  finalXiaogScore: document.querySelector("#final-xiaog-score"), restartButton: document.querySelector("#restart-button"),
  changeModeButton: document.querySelector("#change-mode-button"), resultDetails: document.querySelector(".result-details")
};

let mode = "solo";
let selectedDifficulty = "medium";
let gameQuestions = [];
let currentIndex = 0;
let players = createPlayers();
let answered = false;
let xiaoluAnswer = null;
let revengeWins = 0;

function createPlayers() {
  return { xiaolu: { score: 0, streak: 0, bestStreak: 0 }, xiaog: { score: 0, streak: 0, bestStreak: 0 } };
}

// Fisher-Yates 洗牌：生成随机且不重复的题目顺序。
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }
  return result;
}

function selectMode(selectedMode) {
  mode = selectedMode;
  selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
  elements.modeArea.hidden = true;
  elements.gameArea.hidden = false;
  elements.gameTitle.textContent = mode === "battle" ? "小路 VS 小G" : mode === "revenge" ? "错题复仇" : "知识问答";
  elements.stats.hidden = mode === "battle";
  elements.battleScoreboard.hidden = mode !== "battle";
  startGame();
}

function startGame() {
  let availableQuestions = mode === "revenge" ? GameStorage.getWrongQuestions(questionBank) : questionBank;
  if (selectedDifficulty !== "random") {
    const difficultyQuestions = availableQuestions.filter(question => question.difficulty === selectedDifficulty);
    if (mode !== "revenge" || difficultyQuestions.length > 0) availableQuestions = difficultyQuestions;
  }
  gameQuestions = shuffle(availableQuestions).slice(0, QUESTIONS_PER_GAME);
  if (gameQuestions.length === 0) {
    returnToModes();
    return;
  }
  currentIndex = 0;
  players = createPlayers();
  revengeWins = 0;
  elements.totalNumber.textContent = gameQuestions.length;
  elements.battleTotalNumber.textContent = gameQuestions.length;
  elements.questionArea.hidden = false;
  elements.resultArea.hidden = true;
  elements.battleResult.hidden = true;
  showQuestion();
}

function updateScores() {
  elements.correctCount.textContent = players.xiaolu.score;
  elements.streakCount.textContent = players.xiaolu.streak;
  elements.xiaoluScore.textContent = players.xiaolu.score;
  elements.xiaogScore.textContent = players.xiaog.score;
  elements.xiaoluStreak.textContent = players.xiaolu.streak;
  elements.xiaogStreak.textContent = players.xiaog.streak;
}

function showQuestion() {
  answered = false;
  xiaoluAnswer = null;
  const question = gameQuestions[currentIndex];
  const difficultyNames = { easy: "简单", medium: "普通", hard: "困难" };
  elements.category.textContent = `${question.category} · ${difficultyNames[question.difficulty]}`;
  elements.currentNumber.textContent = currentIndex + 1;
  elements.battleCurrentNumber.textContent = currentIndex + 1;
  elements.progressBar.style.width = `${((currentIndex + 1) / gameQuestions.length) * 100}%`;
  elements.questionText.textContent = question.question;
  elements.feedback.hidden = true;
  elements.feedback.className = "feedback";
  elements.nextButton.hidden = true;
  elements.xiaogAnswerArea.hidden = true;
  elements.options.replaceChildren();
  elements.xiaogOptions.replaceChildren();
  updateScores();

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${option}</span>`;
    button.addEventListener("click", () => chooseXiaoluAnswer(index));
    elements.options.appendChild(button);
  });
}

function chooseXiaoluAnswer(selectedIndex) {
  if (answered || xiaoluAnswer !== null) return;
  xiaoluAnswer = selectedIndex;
  if (mode === "solo") {
    revealAnswers(selectedIndex, null);
    return;
  }
  [...elements.options.children].forEach((button, index) => {
    button.disabled = true;
    if (index === selectedIndex) button.classList.add("selected");
  });
  showXiaogButtons();
}

function showXiaogButtons() {
  ["A", "B", "C", "D"].forEach((letter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xiaog-option";
    button.textContent = letter;
    button.setAttribute("aria-label", `录入小G答案 ${letter}`);
    button.addEventListener("click", () => revealAnswers(xiaoluAnswer, index));
    elements.xiaogOptions.appendChild(button);
  });
  elements.xiaogAnswerArea.hidden = false;
  elements.xiaogOptions.firstElementChild.focus();
}

function applyResult(player, isCorrect) {
  if (isCorrect) {
    player.score += 1;
    player.streak += 1;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
  } else {
    player.streak = 0;
  }
}

function answerLabel(question, index) {
  return `${String.fromCharCode(65 + index)} · ${question.options[index]}`;
}

function revealAnswers(xiaoluSelected, xiaogSelected) {
  if (answered) return;
  answered = true;
  const question = gameQuestions[currentIndex];
  const xiaoluCorrect = xiaoluSelected === question.answer;
  const xiaogCorrect = xiaogSelected === question.answer;
  applyResult(players.xiaolu, xiaoluCorrect);
  if (mode === "battle") applyResult(players.xiaog, xiaogCorrect);
  if (xiaoluCorrect && mode === "revenge") { GameStorage.recordMastered(question); revengeWins += 1; }
  if (!xiaoluCorrect) GameStorage.recordWrong(question);

  [...elements.options.children].forEach((button, index) => {
    button.disabled = true;
    button.classList.remove("selected");
    if (index === question.answer) button.classList.add("correct");
    if (index === xiaoluSelected && !xiaoluCorrect) button.classList.add("wrong");
  });

  if (mode === "battle") {
    [...elements.xiaogOptions.children].forEach((button, index) => {
      button.disabled = true;
      if (index === question.answer) button.classList.add("correct");
      if (index === xiaogSelected && !xiaogCorrect) button.classList.add("wrong");
    });
    elements.feedbackTitle.textContent = `小路${xiaoluCorrect ? "答对" : "答错"}，小G${xiaogCorrect ? "答对" : "答错"}`;
    elements.feedback.classList.add(xiaoluCorrect && xiaogCorrect ? "correct-feedback" : "wrong-feedback");
  } else if (mode === "revenge") {
    const record = GameStorage.getWrongRecords()[question.question];
    elements.feedbackTitle.textContent = xiaoluCorrect ? `复仇成功！已掌握 ${record.masteredCount} 次` : "别灰心，这道题还会再见";
    elements.feedback.classList.add(xiaoluCorrect ? "correct-feedback" : "wrong-feedback");
  } else {
    elements.feedbackTitle.textContent = xiaoluCorrect ? "答对啦！ ✓" : "这次差一点";
    elements.feedback.classList.add(xiaoluCorrect ? "correct-feedback" : "wrong-feedback");
  }
  updateScores();
  const answerLines = [`<span>小路选择：<b>${answerLabel(question, xiaoluSelected)}</b></span>`];
  if (mode === "battle") answerLines.push(`<span>小G选择：<b>${answerLabel(question, xiaogSelected)}</b></span>`);
  answerLines.push(`<span>正确答案：<b>${answerLabel(question, question.answer)}</b></span>`);
  elements.answerSummary.innerHTML = answerLines.join("");
  elements.explanation.textContent = question.explanation;
  elements.feedback.hidden = false;
  elements.nextButton.textContent = currentIndex === gameQuestions.length - 1 ? "查看成绩 →" : "下一题 →";
  elements.nextButton.hidden = false;
  elements.feedback.focus({ preventScroll: true });
  elements.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function goToNextQuestion() {
  currentIndex += 1;
  if (currentIndex < gameQuestions.length) showQuestion();
  else showResult();
}

function showResult() {
  elements.questionArea.hidden = true;
  elements.resultArea.hidden = false;
  elements.category.textContent = "完成";
  GameStorage.saveResult(mode, players.xiaolu.score, players.xiaolu.bestStreak, revengeWins);
  if (mode === "battle") {
    const difference = players.xiaolu.score - players.xiaog.score;
    elements.winnerText.textContent = difference > 0 ? "小路获胜" : difference < 0 ? "小G获胜" : "平局";
    elements.finalXiaoluScore.textContent = players.xiaolu.score;
    elements.finalXiaogScore.textContent = players.xiaog.score;
    elements.battleResult.hidden = false;
    elements.finalScore.parentElement.hidden = true;
    elements.resultDetails.hidden = true;
    elements.resultMessage.textContent = "精彩的一局，知识因分享更有趣！";
    GameStorage.saveBattle(players.xiaolu.score, players.xiaog.score);
  } else {
    const score = players.xiaolu.score * 10;
    let message = "好奇心就是最棒的超能力。";
    if (score === 100) message = "满分！今天的知识之星就是你！";
    else if (score >= 80) message = "太厉害了，知识储备相当丰富！";
    else if (score >= 60) message = "稳稳过关，再来一局一定更棒！";
    elements.finalScore.parentElement.hidden = false;
    elements.resultDetails.hidden = false;
    elements.finalScore.textContent = score;
    elements.finalCorrect.textContent = players.xiaolu.score;
    elements.bestStreak.textContent = players.xiaolu.bestStreak;
    elements.resultMessage.textContent = message;
  }
  elements.restartButton.focus();
}

function returnToModes() {
  elements.gameArea.hidden = true;
  elements.modeArea.hidden = false;
  renderLobbyData();
  elements.soloMode.focus();
}

function renderLobbyData() {
  const wrongCount = GameStorage.getWrongQuestions(questionBank).length;
  elements.wrongCountLabel.textContent = wrongCount ? `${wrongCount} 道错题等待挑战` : "还没有错题记录";
  elements.revengeMode.disabled = wrongCount === 0;
  const summary = GameStorage.getBattleSummary();
  elements.historySummary.innerHTML = `<span>总对局 ${summary.total}</span><span>小路胜 ${summary.xiaoluWins}</span><span>小G胜 ${summary.xiaogWins}</span><span>平局 ${summary.draws}</span>`;
  elements.historyList.replaceChildren();
  summary.history.slice(0, 5).forEach(game => {
    const item = document.createElement("li");
    item.textContent = `${new Date(game.date).toLocaleDateString("zh-CN")}　小路 ${game.xiaoluScore}:${game.xiaogScore} 小G　${game.result}`;
    elements.historyList.appendChild(item);
  });
}

elements.soloMode.addEventListener("click", () => selectMode("solo"));
elements.battleMode.addEventListener("click", () => selectMode("battle"));
elements.revengeMode.addEventListener("click", () => selectMode("revenge"));
elements.nextButton.addEventListener("click", goToNextQuestion);
elements.restartButton.addEventListener("click", startGame);
elements.changeModeButton.addEventListener("click", returnToModes);
renderLobbyData();
