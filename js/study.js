(function () {
  "use strict";

  const KEY = "xiaoluXiaogVocabularyV2";
  const DAILY = 50;
  const MANIFEST_URL = "./data/wordbooks/manifest.json";
  const PRACTICE_URL = "./data/study-practice.json";
  const Core = window.StudyCore;
  const $ = id => document.getElementById(id);

  let allManifest = [];
  let manifest = [];
  let words = [];
  let byId = new Map();
  let byWord = new Map();
  let practice = { collocations: [], confusables: [] };
  let active = null;
  let warning = "";
  let storageLocked = false;
  let rawState = readStored();
  let state = Core.blankRoot();

  function readStored() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (![3, Core.VERSION].includes(parsed?.version)) {
        storageLocked = true;
        warning = "检测到无法识别的学习数据版本，为避免覆盖，当前使用只读空白状态。";
        return null;
      }
      return parsed;
    } catch {
      storageLocked = true;
      warning = "浏览器中的学习数据无法读取，已使用安全的空白状态；原数据没有被覆盖。";
      return null;
    }
  }

  function save() {
    if (storageLocked) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      warning = "这次进度无法写入浏览器，请先导出备份并检查存储空间。";
      return false;
    }
  }

  const meta = () => manifest.find(item => item.bookId === state.selectedBookId);
  const book = () => state.books[state.selectedBookId];
  const current = () => active && byId.get(active.queue[active.index]);
  const formatWord = word => `${word.word}${word.phonetic ? ` ${word.phonetic}` : ""}`;
  const masteryFor = word => state.mastery[Core.normalizeWord(word)];
  const statusText = entry => entry ? `${Core.STATUS[entry.status].icon} ${Core.STATUS[entry.status].label}` : "⚪ 未学习";

  async function fetchCatalog(bookMeta) {
    const response = await fetch(bookMeta.file);
    if (!response.ok) throw new Error(`词书读取失败：${response.status}`);
    const payload = await response.json();
    if (payload.bookId !== bookMeta.bookId || !Array.isArray(payload.words)) throw new Error("词书格式不正确");
    return payload.words.filter(item => {
      return item && typeof item.id === "string" && typeof item.word === "string" && typeof item.meaning === "string";
    });
  }

  async function migrateIfNeeded() {
    if (!rawState) {
      state = Core.blankRoot();
      return;
    }
    if (rawState.version === 3) {
      const catalogs = {};
      const loaded = await Promise.all(allManifest.map(async item => [item.bookId, await fetchCatalog(item)]));
      for (const [bookId, catalog] of loaded) catalogs[bookId] = catalog;
      state = Core.migrateV3(rawState, allManifest, catalogs);
      storageLocked = false;
      save();
      return;
    }
    state = Core.sanitizeV4(rawState, allManifest);
    save();
  }

  async function init() {
    try {
      const [manifestResponse, practiceResponse] = await Promise.all([fetch(MANIFEST_URL), fetch(PRACTICE_URL)]);
      if (!manifestResponse.ok) throw new Error(`词书清单读取失败：${manifestResponse.status}`);
      allManifest = await manifestResponse.json();
      if (!Array.isArray(allManifest)) throw new Error("词书清单格式不正确");
      manifest = allManifest.filter(item => item.active !== false);
      if (manifest.length !== 2 || !manifest.some(item => item.bookId === "kaoyan-complete") || !manifest.some(item => item.bookId === "cet6")) {
        throw new Error("v2.1 主词书清单不完整");
      }
      if (practiceResponse.ok) {
        const payload = await practiceResponse.json();
        practice = {
          collocations: Array.isArray(payload.collocations) ? payload.collocations : [],
          confusables: Array.isArray(payload.confusables) ? payload.confusables : []
        };
      }
      await migrateIfNeeded();
      if (!manifest.some(item => item.bookId === state.selectedBookId)) state.selectedBookId = manifest[0].bookId;
      $("book-select").innerHTML = manifest.map(item => `<option value="${item.bookId}">${item.name}（${item.totalWords.toLocaleString()} 词）</option>`).join("");
      await loadBook(state.selectedBookId);
    } catch (error) {
      $("daily-range").textContent = error.message;
      $("start-button").disabled = true;
    }
  }

  async function loadBook(id) {
    const chosen = manifest.find(item => item.bookId === id) || manifest[0];
    words = await fetchCatalog(chosen);
    byId = new Map(words.map(item => [item.id, item]));
    byWord = new Map(words.map(item => [Core.normalizeWord(item.word), item]));
    state.selectedBookId = chosen.bookId;
    state.books[chosen.bookId] = Core.sanitizeBook(state.books[chosen.bookId], chosen, new Set(byId.keys()));
    save();
    renderDashboard();
  }

  function eligibleFrom(start, count, excluded = []) {
    const ids = [];
    const blocked = new Set(excluded);
    let index = Math.max(0, start);
    while (index < words.length && ids.length < count) {
      const word = words[index++];
      const mastery = masteryFor(word.word);
      if (mastery?.status !== "simple" && !blocked.has(word.id)) ids.push(word.id);
    }
    return { ids, next: index };
  }

  function dueIds() {
    const found = [];
    const seen = new Set();
    for (const word of words) {
      const key = Core.normalizeWord(word.word);
      if (!seen.has(key) && Core.isDue(state.mastery[key])) {
        found.push(word.id);
        seen.add(key);
      }
    }
    return found;
  }

  function nextPlan() {
    return eligibleFrom(book().currentPosition, DAILY).ids.map(id => byId.get(id));
  }

  function newSession(mode) {
    const data = book();
    const found = mode === "daily"
      ? eligibleFrom(data.currentPosition, DAILY)
      : { ids: dueIds(), next: data.currentPosition };
    if (!found.ids.length) return null;
    return {
      mode,
      queue: found.ids,
      round: 0,
      index: 0,
      ratings: { unknown: 0, fuzzy: 0, known: 0, simple: 0 },
      startedAt: new Date().toISOString(),
      scanCursor: found.next
    };
  }

  function dashboardReport() {
    return Core.report(state, allManifest);
  }

  function achievements(summary) {
    return [
      { icon: "🌱", name: "第一次学习", on: summary.sessions > 0 },
      { icon: "📚", name: "认识 50 词", on: summary.counts.known >= 50 },
      { icon: "🔥", name: "坚持 7 天", on: summary.studyDays >= 7 },
      { icon: "🧭", name: "双向记忆", on: Object.values(state.mastery).some(item => item.directions?.["en-zh"] && item.directions?.["zh-en"]) }
    ];
  }

  function renderDashboard() {
    if (!manifest.length) return;
    active = null;
    const data = book();
    const selectedMeta = meta();
    const summary = dashboardReport();
    const due = dueIds().length;
    $("dashboard").hidden = false;
    $("session").hidden = true;
    $("result").hidden = true;
    $("book-select").value = selectedMeta.bookId;
    $("book-source").textContent = `${selectedMeta.totalWords.toLocaleString()} 词 · ${selectedMeta.license} · 本词书进度独立，掌握状态全局共享`;
    $("mastered-count").textContent = summary.counts.known;
    $("due-count").textContent = summary.due;
    $("day-count").textContent = summary.studyDays;
    $("review-badge").textContent = due;
    $("review-button").disabled = !due;

    const plan = nextPlan();
    $("daily-range").textContent = plan.length
      ? `${formatWord(plan[0])} → ${formatWord(plan.at(-1))}（${plan.length} 词）`
      : `《${selectedMeta.name}》已全部走完，可以继续到期复习。`;
    $("start-button").disabled = !plan.length;

    $("resume-banner").hidden = !data.session;
    if (data.session) {
      $("resume-copy").textContent = `《${selectedMeta.name}》· ${data.session.mode === "daily" ? "每日学习" : "到期复习"} · 第 ${data.session.round + 1} 轮 · ${Math.min(data.session.index + 1, data.session.queue.length)} / ${data.session.queue.length}`;
    }

    const migrationNote = $("migration-note");
    migrationNote.hidden = !state.migration;
    if (state.migration) migrationNote.textContent = "旧版学习数据已安全迁移：原词书进度保留，重复单词已合并为共享掌握状态。";

    $("achievement-list").innerHTML = achievements(summary).map(item => {
      return `<span class="study-achievement ${item.on ? "unlocked" : ""}"><b>${item.icon}</b>${item.name}</span>`;
    }).join("");
    if (warning) $("daily-range").textContent = `${warning} ${$("daily-range").textContent}`;
  }

  function begin(session) {
    active = session;
    if (!active) return;
    book().session = active;
    save();
    $("dashboard").hidden = true;
    $("result").hidden = true;
    $("session").hidden = false;
    showWord();
  }

  function renderMeaning(word) {
    const meaning = Core.parseMeaning(word.meaning);
    $("meaning-core").textContent = `${meaning.core.pos ? meaning.core.pos + " " : ""}${meaning.core.text}`;
    $("meaning-common").innerHTML = meaning.common.map(item => `<li>${item.pos ? `<em>${item.pos}</em> ` : ""}${item.text}</li>`).join("");
    $("meaning-common-wrap").hidden = !meaning.common.length;
    $("meaning-extra").innerHTML = meaning.extra.map(item => `<li>${item.pos ? `<em>${item.pos}</em> ` : ""}${item.text}</li>`).join("");
    $("meaning-extra-wrap").hidden = !meaning.extra.length;
    $("meaning-extra-wrap").open = false;

    const matches = practice.collocations.filter(item => Core.normalizeWord(item.word) === Core.normalizeWord(word.word));
    const collocations = $("word-collocations");
    collocations.hidden = !matches.length;
    collocations.querySelector("ul").innerHTML = matches.map(item => `<li><strong>${item.prompt.replace("___", item.answer)}</strong><span>${item.meaning}</span></li>`).join("");
  }

  function showWord() {
    const word = current();
    if (!word) {
      completeRound();
      return;
    }
    const enToZh = active.round === 0;
    const entry = masteryFor(word.word);
    $("round-label").textContent = `${active.mode === "review" ? "到期复习" : "今日 50 词"} · 第 ${active.round + 1} 轮`;
    $("direction-label").textContent = enToZh ? "英 → 中主动回忆" : "中 → 英主动回忆";
    $("session-progress-text").textContent = `${active.index + 1} / ${active.queue.length}`;
    $("session-progress-bar").style.width = `${active.queue.length ? active.index / active.queue.length * 100 : 0}%`;
    $("unit-label").textContent = meta().name;
    $("current-status").textContent = statusText(entry);
    $("current-status").className = `current-status ${entry ? `status-${entry.status}` : ""}`;
    $("prompt-label").textContent = enToZh ? "看到英文，说出核心中文语义" : "看到中文，说出英文并拼写";
    const meaning = Core.parseMeaning(word.meaning);
    $("word-prompt").textContent = enToZh ? formatWord(word) : [meaning.core.text, ...meaning.common.slice(0, 2).map(item => item.text)].join("；");
    $("answer-english").textContent = enToZh ? "" : formatWord(word);
    renderMeaning(word);
    $("answer-panel").hidden = true;
    $("reveal-button").hidden = false;
  }

  function rate(status) {
    const word = current();
    if (!word || !Core.STATUS[status]) return;
    const direction = active.round === 0 ? "en-zh" : "zh-en";
    const key = Core.normalizeWord(word.word);
    state.mastery[key] = Core.rateMastery(state.mastery[key], word.word, status, direction);
    active.ratings[status]++;

    if (status === "simple" && active.round === 0) {
      active.queue.splice(active.index, 1);
      if (active.mode === "daily" && active.round === 0) {
        const fill = eligibleFrom(active.scanCursor, 1, active.queue);
        if (fill.ids.length) {
          active.queue.push(fill.ids[0]);
          active.scanCursor = fill.next;
        }
      }
      if (active.index >= active.queue.length) {
        completeRound();
        return;
      }
    } else {
      active.index++;
    }
    book().session = active;
    save();
    showWord();
  }

  function completeRound() {
    if (active.round === 0 && active.queue.length) {
      active.round = 1;
      active.index = 0;
      book().session = active;
      save();
      showWord();
      return;
    }
    finish();
  }

  function finish() {
    const data = book();
    if (active.mode === "daily") data.currentPosition = Math.max(data.currentPosition, active.scanCursor);
    const durationSeconds = Math.max(0, Math.round((Date.now() - Date.parse(active.startedAt)) / 1000));
    data.history.unshift({
      date: new Date().toISOString(),
      mode: active.mode,
      words: active.queue.length,
      ratings: { ...active.ratings },
      directions: { "en-zh": active.queue.length, "zh-en": active.queue.length },
      durationSeconds
    });
    data.history = data.history.slice(0, 366);
    data.session = null;
    save();

    $("session").hidden = true;
    $("result").hidden = false;
    $("result-title").textContent = active.mode === "daily" ? "今天的双向回忆完成啦" : "到期复习完成啦";
    $("result-copy").textContent = active.mode === "daily"
      ? "英→中和中→英都认真回忆过了，复习日期已经按掌握程度安排。"
      : "新的掌握程度和下次复习日期已经更新。";
    $("result-stats").innerHTML = Object.entries(active.ratings).map(([status, count]) => {
      return `<span><strong>${Core.STATUS[status].icon} ${count}</strong> ${Core.STATUS[status].label}</span>`;
    }).join("");
    active = null;
  }

  function renderHistory() {
    const history = book().history;
    $("history-list").innerHTML = history.length ? history.map(item => {
      const ratings = item.ratings || {};
      return `<article class="history-entry"><strong>${item.mode === "daily" ? "每日学习" : "到期复习"} · ${new Date(item.date).toLocaleString("zh-CN")}</strong><small>${item.words} 词 · 🔴 ${ratings.unknown || 0} · 🟠 ${ratings.fuzzy || 0} · 🟢 ${ratings.known || 0} · 🟡 ${ratings.simple || 0}${item.durationSeconds ? ` · ${Math.ceil(item.durationSeconds / 60)} 分钟` : ""}</small></article>`;
    }).join("") : '<p class="empty-message">这本词书还没有学习记录。</p>';
  }

  function renderReport() {
    const summary = dashboardReport();
    const totalRatings = Object.values(summary.recentRatings).reduce((sum, value) => sum + value, 0);
    const solid = totalRatings ? Math.round((summary.recentRatings.known + summary.recentRatings.simple) / totalRatings * 100) : 0;
    const directionPercent = direction => {
      const counts = summary.directionCounts[direction];
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return total ? Math.round((counts.known + counts.simple) / total * 100) : 0;
    };
    $("report-content").innerHTML = `
      <div class="report-summary">
        <span><strong>${summary.sessions}</strong><small>累计学习</small></span>
        <span><strong>${summary.recentSessions}</strong><small>近 7 天场次</small></span>
        <span><strong>${solid}%</strong><small>近 7 天稳固率</small></span>
        <span><strong>${summary.due}</strong><small>当前待复习</small></span>
      </div>
      <div class="status-report">
        ${Object.entries(summary.counts).map(([status, count]) => `<span class="status-${status}">${Core.STATUS[status].icon} ${Core.STATUS[status].label}<strong>${count}</strong></span>`).join("")}
      </div>
      <div class="direction-report">
        <h3>双向掌握</h3>
        <article><span>英 → 中</span><div class="report-bar"><i style="width:${directionPercent("en-zh")}%"></i></div><strong>${directionPercent("en-zh")}%</strong></article>
        <article><span>中 → 英</span><div class="report-bar"><i style="width:${directionPercent("zh-en")}%"></i></div><strong>${directionPercent("zh-en")}%</strong></article>
      </div>
      <div class="book-report">
        <h3>词书进度</h3>
        ${summary.books.map(item => `<article><div><strong>${item.name}</strong><span>${item.position.toLocaleString()} / ${item.total.toLocaleString()}（${item.percent}%）</span></div><div class="report-bar"><i style="width:${item.percent}%"></i></div></article>`).join("")}
      </div>
      <p class="report-note">复习节奏：不认识 1 天后、模糊 3 天后、认识按 7 / 14 / 30 / 60 天逐步延长；“太简单”不再进入计划。</p>
    `;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startPractice(mode) {
    const source = mode === "collocations" ? practice.collocations : practice.confusables;
    const session = { mode, items: shuffle(source).slice(0, 10), index: 0, score: 0, answered: false };
    $("practice-title").textContent = mode === "collocations" ? "高频搭配练习" : "易混词训练";
    $("practice-eyebrow").textContent = mode === "collocations" ? "COLLOCATIONS" : "CONFUSABLE WORDS";
    $("practice-dialog").showModal();
    renderPractice(session);
  }

  function renderPractice(session) {
    const item = session.items[session.index];
    if (!item) {
      $("practice-body").innerHTML = `<div class="practice-result"><div>🌟</div><h3>完成啦</h3><p>答对 ${session.score} / ${session.items.length}</p><button class="primary-button" data-practice-close>完成</button></div>`;
      $("practice-body").querySelector("[data-practice-close]").onclick = () => $("practice-dialog").close();
      return;
    }
    const hint = session.mode === "collocations" ? item.meaning : item.group;
    $("practice-body").innerHTML = `
      <div class="practice-progress">${session.index + 1} / ${session.items.length}</div>
      <p class="practice-hint">${hint}</p>
      <h3 class="practice-prompt">${item.prompt}</h3>
      <div class="practice-options">${shuffle(item.options).map(option => `<button data-practice-answer="${option}">${option}</button>`).join("")}</div>
      <div class="practice-feedback" role="status"></div>
    `;
    $("practice-body").querySelectorAll("[data-practice-answer]").forEach(button => {
      button.onclick = () => {
        if (session.answered) return;
        session.answered = true;
        const correct = button.dataset.practiceAnswer === item.answer;
        if (correct) session.score++;
        $("practice-body").querySelectorAll("[data-practice-answer]").forEach(option => {
          option.disabled = true;
          if (option.dataset.practiceAnswer === item.answer) option.classList.add("correct");
          else if (option === button) option.classList.add("wrong");
        });
        const detail = session.mode === "confusables" ? item.note : `${item.prompt.replace("___", item.answer)}：${item.meaning}`;
        const feedback = $("practice-body").querySelector(".practice-feedback");
        feedback.innerHTML = `<strong>${correct ? "答对啦" : `正确答案：${item.answer}`}</strong><p>${detail}</p><button class="primary-button" data-practice-next>${session.index + 1 === session.items.length ? "查看结果" : "下一题"}</button>`;
        feedback.querySelector("[data-practice-next]").onclick = () => {
          session.index++;
          session.answered = false;
          renderPractice(session);
        };
      };
    });
  }

  function exportData() {
    const payload = { app: "xiaolu-xiaog-vocabulary", schemaVersion: Core.VERSION, exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `一起背单词-v2.1-${new Date().toLocaleDateString("sv-SE")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    $("data-message").textContent = "v2.1 学习数据已导出。";
  }

  async function importData(file) {
    try {
      if (!file || file.size > 5 * 1024 * 1024) throw new Error("文件为空或超过 5 MB");
      const payload = JSON.parse(await file.text());
      if (payload.app !== "xiaolu-xiaog-vocabulary" || ![3, Core.VERSION].includes(payload.schemaVersion) || payload.data?.version !== payload.schemaVersion) {
        throw new Error("不是可识别的词汇学习备份");
      }
      if (payload.schemaVersion === 3) {
        const catalogs = {};
        const loaded = await Promise.all(allManifest.map(async item => [item.bookId, await fetchCatalog(item)]));
        for (const [bookId, catalog] of loaded) catalogs[bookId] = catalog;
        state = Core.migrateV3(payload.data, allManifest, catalogs);
      } else {
        state = Core.sanitizeV4(payload.data, allManifest);
      }
      storageLocked = false;
      await loadBook(state.selectedBookId);
      $("data-message").textContent = "导入成功：进度、共享掌握状态和旧数据归档已恢复。";
    } catch (error) {
      $("data-message").textContent = `导入失败：${error.message}`;
    }
  }

  $("book-select").onchange = async event => {
    if (book()?.session && !confirm("当前词书有未完成进度。切换后仍会保留，确定切换吗？")) {
      event.target.value = state.selectedBookId;
      return;
    }
    await loadBook(event.target.value);
  };
  $("start-button").onclick = () => begin(newSession("daily"));
  $("review-button").onclick = () => begin(newSession("review"));
  $("resume-button").onclick = () => begin(book().session);
  $("reveal-button").onclick = () => { $("reveal-button").hidden = true; $("answer-panel").hidden = false; };
  document.querySelectorAll("[data-rating]").forEach(button => button.onclick = () => rate(button.dataset.rating));
  $("exit-button").onclick = renderDashboard;
  $("result-home").onclick = renderDashboard;
  $("collocation-button").onclick = () => startPractice("collocations");
  $("confusable-button").onclick = () => startPractice("confusables");
  $("report-button").onclick = () => { renderReport(); $("report-dialog").showModal(); };
  $("history-button").onclick = () => { renderHistory(); $("history-dialog").showModal(); };
  $("data-button").onclick = () => { $("data-message").textContent = ""; $("data-dialog").showModal(); };
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $(button.dataset.close).close());
  $("export-button").onclick = exportData;
  $("import-input").onchange = event => importData(event.target.files[0]);

  window.StudyApp = {
    loadBook,
    newSession,
    eligibleFrom,
    getState: () => state,
    getBook: book,
    getWords: () => words,
    rate,
    dueIds,
    renderReport
  };
  init();
})();
