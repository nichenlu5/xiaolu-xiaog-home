// 一局抽取的题目数量。以后想调整题数，只需要修改这里。
const QUESTIONS_PER_GAME = 10;

const elements = {
  category: document.querySelector("#category"),
  currentNumber: document.querySelector("#current-number"),
  totalNumber: document.querySelector("#total-number"),
  correctCount: document.querySelector("#correct-count"),
  streakCount: document.querySelector("#streak-count"),
  progressBar: document.querySelector("#progress-bar"),
  questionArea: document.querySelector("#question-area"),
  questionText: document.querySelector("#question-text"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  feedbackTitle: document.querySelector("#feedback-title"),
  explanation: document.querySelector("#explanation"),
  nextButton: document.querySelector("#next-button"),
  resultArea: document.querySelector("#result-area"),
  finalScore: document.querySelector("#final-score"),
  finalCorrect: document.querySelector("#final-correct"),
  bestStreak: document.querySelector("#best-streak"),
  resultMessage: document.querySelector("#result-message"),
  restartButton: document.querySelector("#restart-button")
};

let gameQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let currentStreak = 0;
let bestStreak = 0;
let answered = false;

// Fisher-Yates 洗牌：生成一个随机且不重复的题目顺序。
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }
  return result;
}

function startGame() {
  gameQuestions = shuffle(questionBank).slice(0, QUESTIONS_PER_GAME);
  currentIndex = 0;
  correctCount = 0;
  currentStreak = 0;
  bestStreak = 0;
  elements.totalNumber.textContent = QUESTIONS_PER_GAME;
  elements.questionArea.hidden = false;
  elements.resultArea.hidden = true;
  showQuestion();
}

function showQuestion() {
  answered = false;
  const question = gameQuestions[currentIndex];

  elements.category.textContent = question.category;
  elements.currentNumber.textContent = currentIndex + 1;
  elements.correctCount.textContent = correctCount;
  elements.streakCount.textContent = currentStreak;
  elements.progressBar.style.width = `${((currentIndex + 1) / QUESTIONS_PER_GAME) * 100}%`;
  elements.questionText.textContent = question.question;
  elements.feedback.hidden = true;
  elements.feedback.className = "feedback";
  elements.nextButton.hidden = true;
  elements.options.replaceChildren();

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${option}</span>`;
    button.addEventListener("click", () => checkAnswer(index));
    elements.options.appendChild(button);
  });
}

function checkAnswer(selectedIndex) {
  if (answered) return;
  answered = true;

  const question = gameQuestions[currentIndex];
  const isCorrect = selectedIndex === question.answer;
  const optionButtons = [...elements.options.children];

  optionButtons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.answer) button.classList.add("correct");
  });

  if (isCorrect) {
    correctCount += 1;
    currentStreak += 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    elements.feedbackTitle.textContent = "答对啦！ ✓";
    elements.feedback.classList.add("correct-feedback");
  } else {
    currentStreak = 0;
    optionButtons[selectedIndex].classList.add("wrong");
    elements.feedbackTitle.textContent = "这次差一点";
    elements.feedback.classList.add("wrong-feedback");
  }

  elements.correctCount.textContent = correctCount;
  elements.streakCount.textContent = currentStreak;
  elements.explanation.textContent = question.explanation;
  elements.feedback.hidden = false;
  elements.nextButton.textContent = currentIndex === QUESTIONS_PER_GAME - 1 ? "查看成绩 →" : "下一题 →";
  elements.nextButton.hidden = false;
  elements.nextButton.focus();
}

function goToNextQuestion() {
  currentIndex += 1;
  if (currentIndex < QUESTIONS_PER_GAME) {
    showQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const score = correctCount * 10;
  let message = "好奇心就是最棒的超能力。";
  if (score === 100) message = "满分！今天的知识之星就是你！";
  else if (score >= 80) message = "太厉害了，知识储备相当丰富！";
  else if (score >= 60) message = "稳稳过关，再来一局一定更棒！";

  elements.questionArea.hidden = true;
  elements.resultArea.hidden = false;
  elements.category.textContent = "完成";
  elements.finalScore.textContent = score;
  elements.finalCorrect.textContent = correctCount;
  elements.bestStreak.textContent = bestStreak;
  elements.resultMessage.textContent = message;
  elements.restartButton.focus();
}

elements.nextButton.addEventListener("click", goToNextQuestion);
elements.restartButton.addEventListener("click", startGame);

startGame();
