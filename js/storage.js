// 浏览器本地记录。清理浏览器站点数据后，这些记录也会被清除。
const GameStorage = (() => {
  const WRONG_KEY = "xiaoluQuizWrongQuestionsV1";
  const HISTORY_KEY = "xiaoluQuizBattleHistoryV1";

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      console.warn("读取本地记录失败：", error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("保存本地记录失败：", error);
    }
  }

  function getWrongRecords() {
    return read(WRONG_KEY, {});
  }

  function recordWrong(question) {
    const records = getWrongRecords();
    const old = records[question.question] || { wrongCount: 0, masteredCount: 0 };
    records[question.question] = {
      wrongCount: old.wrongCount + 1,
      masteredCount: old.masteredCount,
      lastWrongAt: new Date().toISOString()
    };
    write(WRONG_KEY, records);
  }

  function recordMastered(question) {
    const records = getWrongRecords();
    if (!records[question.question]) return;
    records[question.question].masteredCount += 1;
    records[question.question].lastMasteredAt = new Date().toISOString();
    write(WRONG_KEY, records);
  }

  function getWrongQuestions(allQuestions) {
    const records = getWrongRecords();
    return allQuestions.filter(question => records[question.question]);
  }

  function saveBattle(xiaoluScore, xiaogScore) {
    const result = xiaoluScore > xiaogScore ? "小路胜" : xiaoluScore < xiaogScore ? "小G胜" : "平局";
    const history = read(HISTORY_KEY, []);
    history.unshift({ date: new Date().toISOString(), xiaoluScore, xiaogScore, result });
    write(HISTORY_KEY, history.slice(0, 100));
  }

  function getBattleSummary() {
    const history = read(HISTORY_KEY, []);
    return {
      total: history.length,
      xiaoluWins: history.filter(game => game.result === "小路胜").length,
      xiaogWins: history.filter(game => game.result === "小G胜").length,
      draws: history.filter(game => game.result === "平局").length,
      history
    };
  }

  return { getWrongRecords, recordWrong, recordMastered, getWrongQuestions, saveBattle, getBattleSummary };
})();
