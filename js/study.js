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
  let academicMeta = null;
  let words = [];
  let academicWords = [];
  let academicIds = new Set();
  let academicCatalogInfo = null;
  let catalogs = {};
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
  const academicBook = () => academicMeta && state.books[academicMeta.bookId];
  const current = () => active && byId.get(active.queue[active.index]);
  const formatWord = word => `${word.word}${word.phonetic ? ` ${word.phonetic}` : ""}`;
  const masteryFor = word => state.mastery[Core.normalizeWord(word)];
  function directionStatusText(entry, direction, label) {
    const status = entry?.directions?.[direction]?.status;
    return status ? `${label}：${Core.STATUS[status].label}` : `${label}：— 未训练`;
  }

  async function fetchRequired(url, label) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    let failure;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(absoluteUrl, attempt ? { cache: "reload" } : undefined);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      } catch (error) {
        failure = error;
      }
    }
    throw new Error(`${label}读取失败：${absoluteUrl}（${failure?.message || "网络请求失败"}）`);
  }

  async function fetchCatalog(bookMeta) {
    if (catalogs[bookMeta.bookId]) return catalogs[bookMeta.bookId];
    const response = await fetchRequired(bookMeta.file, `词书「${bookMeta.name}」`);
    const payload = await response.json();
    if (payload.bookId !== bookMeta.bookId || !Array.isArray(payload.words)) throw new Error("词书格式不正确");
    if (bookMeta.kind === "academic" && ![1, 2].includes(payload.schemaVersion)) throw new Error("学术词库 schema 暂不支持");
    if (bookMeta.kind === "academic") academicCatalogInfo = {
      complete: payload.complete === true,
      sourceEntryCount: Number(payload.sourceEntryCount) || payload.words.length,
      uniqueWordCount: Number(payload.uniqueWordCount) || payload.words.length
    };
    const clean = payload.words.filter(item => {
      return item && typeof item.id === "string" && typeof item.word === "string" && typeof item.meaning === "string";
    }).map(item => bookMeta.kind === "academic" ? Core.sanitizeAcademicWord(item) : item).filter(Boolean);
    catalogs[bookMeta.bookId] = clean;
    return clean;
  }

  async function migrateIfNeeded() {
    if (!rawState) {
      state = Core.blankRoot();
      return;
    }
    if (rawState.version === 3) {
      state = Core.migrateV3(rawState, allManifest, catalogs);
      storageLocked = false;
      save();
      return;
    }
    state = Core.sanitizeV4(rawState, allManifest, catalogs);
    save();
  }

  async function init() {
    try {
      const manifestResponse = await fetchRequired(MANIFEST_URL, "词书清单");
      allManifest = await manifestResponse.json();
      if (!Array.isArray(allManifest)) throw new Error("词书清单格式不正确");
      const activeManifest = allManifest.filter(item => item.active !== false);
      manifest = activeManifest.filter(item => item.kind !== "academic");
      academicMeta = activeManifest.find(item => item.kind === "academic") || null;
      if (manifest.length !== 2 || !manifest.some(item => item.bookId === "kaoyan-complete") || !manifest.some(item => item.bookId === "cet6") || !academicMeta) {
        throw new Error("v2.1 主词书清单不完整");
      }
      for (const bookMeta of rawState?.version === 3 ? allManifest : activeManifest) await fetchCatalog(bookMeta);
      academicWords = catalogs[academicMeta.bookId];
      academicIds = new Set(academicWords.map(item => item.id));
      try {
        const practiceResponse = await fetchRequired(PRACTICE_URL, "专项练习数据");
        const payload = await practiceResponse.json();
        practice = {
          collocations: Array.isArray(payload.collocations) ? payload.collocations : [],
          confusables: Array.isArray(payload.confusables) ? payload.confusables : []
        };
      } catch {}
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
    const combined = [...academicWords, ...words];
    byId = new Map(combined.map(item => [item.id, item]));
    byWord = new Map(combined.map(item => [Core.normalizeWord(item.word), item]));
    state.selectedBookId = chosen.bookId;
    state.books[chosen.bookId] = Core.sanitizeBook(state.books[chosen.bookId], chosen, new Set(byId.keys()));
    state.books[academicMeta.bookId] = Core.sanitizeBook(state.books[academicMeta.bookId], academicMeta, new Set(byId.keys()));
    save();
    renderDashboard();
  }

  function duePlan() {
    return Core.prioritizeDueWords([...academicWords, ...words], state.mastery).map(word => ({
      id: word.id,
      directions: Core.dueDirections(masteryFor(word.word))
    }));
  }

  function dueIds() {
    return duePlan().map(item => item.id);
  }

  function nextPlan() {
    const plan = Core.buildDailyPlan(words, academicWords, state.mastery, book().currentPosition, academicBook().currentPosition, DAILY, 30);
    return plan.ids.map(id => byId.get(id));
  }

  function academicModePlan() {
    let found = Core.eligibleSlice(academicWords, state.mastery, academicBook().currentPosition, DAILY);
    if (!found.ids.length && academicBook().currentPosition >= academicWords.length) found = Core.eligibleSlice(academicWords, state.mastery, 0, DAILY);
    return found;
  }

  function newSession(mode) {
    const data = book();
    const reviewPlan = mode === "review" ? duePlan() : [];
    const found = mode === "daily"
      ? Core.buildDailyPlan(words, academicWords, state.mastery, data.currentPosition, academicBook().currentPosition, DAILY, state.preferences.academicDailyGoal)
      : mode === "academic"
        ? { ...academicModePlan(), academicIds: [], generalIds: [] }
        : {
            ids: reviewPlan.map(item => item.id),
            next: data.currentPosition,
            academicIds: [],
            generalIds: [],
            reviewDirections: Object.fromEntries(reviewPlan.map(item => [item.id, item.directions]))
          };
    if (!found.ids.length) return null;
    return {
      mode,
      queue: found.ids,
      round: 0,
      index: 0,
      ratings: { unknown: 0, fuzzy: 0, known: 0, simple: 0 },
      directionRatings: { "en-zh": 0, "zh-en": 0 },
      reviewDirections: found.reviewDirections || {},
      spelling: null,
      startedAt: new Date().toISOString(),
      scanCursor: found.generalNext ?? found.next,
      generalScanCursor: found.generalNext ?? data.currentPosition,
      academicScanCursor: found.academicNext ?? (mode === "academic" ? found.next : academicBook().currentPosition),
      academicWords: mode === "academic" ? found.ids.length : found.academicIds.length,
      generalWords: found.generalIds.length
    };
  }

  function startOrResume(mode) {
    begin(book().session || newSession(mode));
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
    const today = new Date().toLocaleDateString("sv-SE");
    const allHistory = Object.values(state.books).flatMap(item => Array.isArray(item.history) ? item.history : []);
    const todayHistory = allHistory.filter(item => item.mode === "daily" && new Date(item.date).toLocaleDateString("sv-SE") === today);
    const completedTotal = todayHistory.reduce((sum, item) => sum + item.words, 0);
    const completedAcademic = todayHistory.reduce((sum, item) => sum + (item.academicWords || 0), 0);
    const live = data.session?.mode === "daily" && data.session.round === 0 ? data.session : null;
    const liveSeen = live ? live.queue.slice(0, live.index) : [];
    const liveAcademic = liveSeen.filter(id => academicIds.has(id)).length;
    $("dashboard").hidden = false;
    $("session").hidden = true;
    $("result").hidden = true;
    $("book-select").value = selectedMeta.bookId;
    $("book-source").textContent = `${selectedMeta.totalWords.toLocaleString()} 词 · ${selectedMeta.license} · 本词书进度独立，掌握状态全局共享`;
    $("mastered-count").textContent = summary.counts.known;
    $("due-count").textContent = summary.due;
    $("day-count").textContent = summary.studyDays;
    $("review-badge").textContent = due;
    $("review-button").disabled = Boolean(data.session) || !due;
    $("academic-today").textContent = `${Math.min(30, completedAcademic + liveAcademic)} / 30`;
    $("total-today").textContent = `${Math.min(50, completedTotal + liveSeen.length)} / 50`;
    $("academic-latest").textContent = state.preferences.lastAcademicWord || "还没有";
    $("academic-button").disabled = Boolean(data.session) || !academicModePlan().ids.length;
    $("academic-data-note").textContent = academicCatalogInfo?.complete
      ? `完整手册：${academicCatalogInfo.sourceEntryCount} 个源词条，合并为 ${academicCatalogInfo.uniqueWordCount} 个去重学习词条。`
      : `当前为 ${academicWords.length} 个已核对种子词；完整手册数据导入后会自动扩展。`;

    const plan = nextPlan();
    $("daily-range").textContent = data.session
      ? "当前任务进行中；完成后再按 SRS 生成新的每日任务。"
      : plan.length
        ? `${formatWord(plan[0])} → ${formatWord(plan.at(-1))}（${plan.length} 词）`
        : `《${selectedMeta.name}》暂无可加入普通任务的新词，请完成到期复习或切换词书。`;
    $("start-button").hidden = Boolean(data.session);
    $("start-button").disabled = !plan.length;
    $("start-button").textContent = "开始主动回忆";

    $("resume-banner").hidden = !data.session;
    if (data.session) {
      const sessionName = data.session.mode === "daily" ? "每日学习" : data.session.mode === "academic" ? "论文模式" : "到期复习";
      const completed = Math.min(data.session.index, data.session.queue.length);
      const next = Math.min(completed + 1, data.session.queue.length);
      $("resume-copy").textContent = `《${selectedMeta.name}》· ${sessionName} · 第 ${data.session.round + 1} 轮 · 本轮学习 ${completed} / ${data.session.queue.length}${completed < data.session.queue.length ? ` · 从第 ${next} 个继续` : ""}`;
    }

    const migrationNote = $("migration-note");
    migrationNote.hidden = !state.migration;
    if (state.migration) migrationNote.textContent = state.migration.academicCatalog
      ? "Academic Priority 已从种子库升级为完整手册：原四状态与复习记录保留，学习游标已安全重排。"
      : "旧版学习数据已安全迁移：原词书进度保留，重复单词已合并为共享掌握状态。";

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

    const matches = word.source === "academic"
      ? (Array.isArray(word.collocations) ? word.collocations.map(item => ({ prompt: item.text, answer: "", meaning: item.translation })) : [])
      : practice.collocations.filter(item => Core.normalizeWord(item.word) === Core.normalizeWord(word.word));
    const collocations = $("word-collocations");
    collocations.hidden = !matches.length;
    collocations.querySelector("ul").innerHTML = matches.map(item => `<li><strong>${item.prompt.replace("___", item.answer)}</strong><span>${item.meaning}</span></li>`).join("");
    const academicDetail = $("academic-detail");
    academicDetail.hidden = word.source !== "academic";
    if (word.source === "academic") {
      const academicExamples = Array.isArray(word.examples) && word.examples.length ? word.examples : [{ text: word.example, translation: word.translation }];
      $("academic-meaning").textContent = word.academicMeaning || word.meaning;
      $("academic-example").textContent = academicExamples.map((item, index) => `${academicExamples.length > 1 ? `${index + 1}. ` : ""}${item.text}`).join("\n") || "暂无例句";
      $("academic-translation").textContent = academicExamples.map((item, index) => `${academicExamples.length > 1 ? `${index + 1}. ` : ""}${item.translation}`).join("\n");
      $("academic-confusable").textContent = word.confusableNote || "";
      $("academic-confusable").hidden = !word.confusableNote;
      const stars = "★".repeat(Math.max(0, Math.min(5, Number(word.frequency) || 0)));
      $("academic-meta").textContent = [word.partOfSpeech, stars, ...(Array.isArray(word.tags) ? word.tags : [])].filter(Boolean).join(" · ");
    }
  }

  function directionForRound() {
    return active?.round === 0 ? "en-zh" : "zh-en";
  }

  function shouldSkip(word, direction) {
    if (masteryFor(word.word)?.directions?.[direction]?.status === "simple") return true;
    if (active.mode !== "review") return false;
    return !active.reviewDirections?.[word.id]?.includes(direction);
  }

  function ensureSpelling(word) {
    if (active.spelling?.wordId === word.id) return active.spelling;
    active.spelling = { wordId: word.id, attempts: 0, hadClose: false, hadWrong: false, resolved: false, result: "" };
    book().session = active;
    save();
    return active.spelling;
  }

  function renderSpelling(word) {
    const spelling = ensureSpelling(word);
    const resolved = spelling.resolved;
    $("spelling-form").hidden = false;
    $("spelling-input").hidden = resolved;
    $("spelling-form").querySelector("label").hidden = resolved;
    $("spelling-form").querySelector(".spelling-actions").hidden = resolved;
    $("spelling-next").hidden = !resolved;
    $("recognition-rating").hidden = true;
    $("answer-panel").hidden = !resolved;
    const feedback = $("spelling-feedback");
    feedback.className = `spelling-feedback${resolved ? " correct" : ""}`;
    feedback.textContent = resolved
      ? spelling.result === "known"
        ? "✓ 拼写正确"
        : spelling.result === "fuzzy"
          ? "✓ 已经想起来了，稍后再巩固"
          : "正确答案如下；输出会更早复习。"
      : spelling.attempts
        ? "继续尝试，答案还没有揭示。"
        : "";
    if (!resolved) {
      $("spelling-input").value = "";
      requestAnimationFrame(() => $("spelling-input").focus({ preventScroll: true }));
    }
  }

  function showWord() {
    let word = current();
    const direction = directionForRound();
    let skipped = false;
    while (word && shouldSkip(word, direction)) {
      active.index++;
      active.spelling = null;
      skipped = true;
      word = current();
    }
    if (skipped) {
      book().session = active;
      save();
    }
    if (!word) {
      completeRound();
      return;
    }
    const academic = active.mode === "academic" && word.source === "academic";
    const question = academic ? Core.academicQuestion(word, active.index, active.round) : null;
    const enToZh = direction === "en-zh";
    active.currentDirection = direction;
    const entry = masteryFor(word.word);
    $("round-label").textContent = `${active.mode === "review" ? "到期复习" : active.mode === "academic" ? "Academic Mode" : "今日 50 词"} · ${enToZh ? "Recognition" : "Production"}`;
    $("direction-label").textContent = academic && enToZh ? "论文语境主动辨析" : enToZh ? "英 → 中识别" : "中 → 英拼写";
    $("session-progress-text").textContent = `${active.index + 1} / ${active.queue.length}`;
    $("session-progress-bar").style.width = `${active.queue.length ? active.index / active.queue.length * 100 : 0}%`;
    $("unit-label").textContent = academic ? `论文语境${word.section ? ` · ${word.section}` : ""}` : word.source === "academic" ? "Academic Priority" : meta().name;
    $("recognition-status").textContent = directionStatusText(entry, "en-zh", "识别");
    $("production-status").textContent = directionStatusText(entry, "zh-en", "输出");
    $("prompt-label").textContent = question?.label || (enToZh ? "看到英文，说出核心中文语义" : "看到中文，输入正确英文单词");
    const meaning = Core.parseMeaning(word.meaning);
    $("word-prompt").textContent = question?.prompt || (enToZh ? formatWord(word) : [meaning.core.text, ...meaning.common.slice(0, 2).map(item => item.text)].join("；"));
    $("answer-english").textContent = enToZh ? "" : formatWord(word);
    renderMeaning(word);
    $("recall-hint").textContent = enToZh ? "先在心里说出含义，再点击揭晓。" : "请直接输入英文；大小写和首尾空格不影响判断。";
    $("spelling-form").hidden = enToZh;
    $("reveal-button").hidden = !enToZh;
    $("recognition-rating").hidden = !enToZh;
    $("spelling-next").hidden = true;
    $("answer-panel").hidden = true;
    if (!enToZh) renderSpelling(word);
  }

  function applyRating(word, status, direction) {
    const key = Core.normalizeWord(word.word);
    state.mastery[key] = Core.rateMastery(state.mastery[key], word.word, status, direction);
    if (word.source === "academic") state.preferences.lastAcademicWord = word.word;
    active.ratings[status]++;
    active.directionRatings ||= { "en-zh": 0, "zh-en": 0 };
    active.directionRatings[direction]++;
  }

  function advance() {
    active.index++;
    active.spelling = null;
    book().session = active;
    save();
    showWord();
  }

  function rate(status) {
    const word = current();
    if (!word || !Core.STATUS[status]) return;
    const direction = active.currentDirection || directionForRound();
    applyRating(word, status, direction);
    advance();
  }

  function resolveSpelling(status) {
    const word = current(), spelling = active?.spelling;
    if (!word || !spelling || spelling.resolved) return;
    applyRating(word, status, "zh-en");
    spelling.resolved = true;
    spelling.result = status;
    book().session = active;
    save();
    showWord();
  }

  function submitSpelling() {
    const word = current(), spelling = active?.spelling;
    if (!word || !spelling || spelling.resolved) return;
    const result = Core.checkSpelling($("spelling-input").value, word.word);
    if (result === "correct") {
      resolveSpelling(spelling.attempts ? "fuzzy" : "known");
      return;
    }
    spelling.attempts++;
    spelling.hadClose ||= result === "close";
    spelling.hadWrong ||= result === "wrong";
    book().session = active;
    save();
    const feedback = $("spelling-feedback");
    feedback.className = `spelling-feedback ${result}`;
    feedback.textContent = result === "close" ? "很接近，再试一次。" : "还不对，再想想；也可以选择“想不起来”。";
    $("spelling-input").focus();
    $("spelling-input").select();
  }

  function completeRound() {
    if (active.round === 0 && active.queue.length) {
      active.round = 1;
      active.index = 0;
      active.spelling = null;
      book().session = active;
      save();
      showWord();
      return;
    }
    finish();
  }

  function finish() {
    const data = book();
    if (active.mode === "daily") {
      data.currentPosition = Math.max(data.currentPosition, active.generalScanCursor);
      academicBook().currentPosition = Math.max(academicBook().currentPosition, active.academicScanCursor);
    }
    if (active.mode === "academic") academicBook().currentPosition = Math.max(academicBook().currentPosition, active.academicScanCursor);
    const durationSeconds = Math.max(0, Math.round((Date.now() - Date.parse(active.startedAt)) / 1000));
    data.history.unshift({
      date: new Date().toISOString(),
      mode: active.mode,
      words: active.queue.length,
      ratings: { ...active.ratings },
      directions: { ...(active.directionRatings || { "en-zh": active.queue.length, "zh-en": active.queue.length }) },
      durationSeconds,
      academicWords: active.queue.filter(id => academicIds.has(id)).length,
      generalWords: active.queue.filter(id => !academicIds.has(id)).length
    });
    data.history = data.history.slice(0, 366);
    data.session = null;
    save();

    $("session").hidden = true;
    $("result").hidden = false;
    $("result-title").textContent = active.mode === "daily" ? "今天的双向回忆完成啦" : active.mode === "academic" ? "论文模式完成啦" : "到期复习完成啦";
    $("result-copy").textContent = active.mode === "daily"
      ? "英→中和中→英都认真回忆过了，复习日期已经按掌握程度安排。"
      : active.mode === "academic" ? "论文语境、搭配和例句都练过了，四级掌握状态已经同步更新。" : "新的掌握程度和下次复习日期已经更新。";
    $("result-stats").innerHTML = Object.entries(active.ratings).map(([status, count]) => {
      return `<span><strong>${Core.STATUS[status].icon} ${count}</strong> ${Core.STATUS[status].label}</span>`;
    }).join("");
    active = null;
  }

  function renderHistory() {
    const history = book().history;
    $("history-list").innerHTML = history.length ? history.map(item => {
      const ratings = item.ratings || {};
      const modeName = item.mode === "daily" ? "每日学习" : item.mode === "academic" ? "论文模式" : "到期复习";
      return `<article class="history-entry"><strong>${modeName} · ${new Date(item.date).toLocaleString("zh-CN")}</strong><small>${item.words} 词${item.academicWords ? ` · 学术 ${item.academicWords}` : ""} · 🔴 ${ratings.unknown || 0} · 🟠 ${ratings.fuzzy || 0} · 🟢 ${ratings.known || 0} · 🟡 ${ratings.simple || 0}${item.durationSeconds ? ` · ${Math.ceil(item.durationSeconds / 60)} 分钟` : ""}</small></article>`;
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
      <h3>Recognition 识别状态</h3>
      <div class="status-report">
        ${Object.entries(summary.counts).map(([status, count]) => `<span class="status-${status}">${Core.STATUS[status].icon} ${Core.STATUS[status].label}<strong>${count}</strong></span>`).join("")}
      </div>
      <div class="direction-report">
        <h3>Recognition × Production</h3>
        <article><span>识别</span><div class="report-bar"><i style="width:${directionPercent("en-zh")}%"></i></div><strong>${directionPercent("en-zh")}%</strong></article>
        <article><span>输出</span><div class="report-bar"><i style="width:${directionPercent("zh-en")}%"></i></div><strong>${directionPercent("zh-en")}%</strong></article>
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
    anchor.download = `一起背单词-v2.8-${new Date().toLocaleDateString("sv-SE")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    $("data-message").textContent = "v2.8 学习数据已导出（含 Recognition、Production 与 Academic Priority）。";
  }

  async function importData(file) {
    try {
      if (!file || file.size > 5 * 1024 * 1024) throw new Error("文件为空或超过 5 MB");
      const payload = JSON.parse(await file.text());
      if (payload.app !== "xiaolu-xiaog-vocabulary" || ![3, Core.VERSION].includes(payload.schemaVersion) || payload.data?.version !== payload.schemaVersion) {
        throw new Error("不是可识别的词汇学习备份");
      }
      if (payload.schemaVersion === 3) {
        await Promise.all(allManifest.map(fetchCatalog));
        state = Core.migrateV3(payload.data, allManifest, catalogs);
      } else {
        state = Core.sanitizeV4(payload.data, allManifest, catalogs);
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
  $("start-button").onclick = () => startOrResume("daily");
  $("academic-button").onclick = () => startOrResume("academic");
  $("review-button").onclick = () => startOrResume("review");
  $("resume-button").onclick = () => begin(book().session);
  $("reveal-button").onclick = () => { $("reveal-button").hidden = true; $("answer-panel").hidden = false; };
  $("spelling-form").onsubmit = event => { event.preventDefault(); submitSpelling(); };
  $("spelling-forget").onclick = () => resolveSpelling("unknown");
  $("spelling-next").onclick = advance;
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
    getState: () => state,
    getBook: book,
    getWords: () => words,
    getAcademicWords: () => academicWords,
    rate,
    submitSpelling,
    resolveSpelling,
    dueIds,
    renderReport
  };
  init();
})();
