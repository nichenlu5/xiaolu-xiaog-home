(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StudyCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 4;
  const STATUS = Object.freeze({
    unknown: { label: "不认识", icon: "🔴", delayDays: 1, weight: 4 },
    fuzzy: { label: "模糊", icon: "🟠", delayDays: 3, weight: 3 },
    known: { label: "认识", icon: "🟢", delayDays: 7, weight: 2 },
    simple: { label: "太简单", icon: "🟡", delayDays: null, weight: 1 }
  });
  const DIRECTIONS = ["en-zh", "zh-en"];
  const ACTIVE_DEFAULT = "kaoyan-complete";
  const DAY = 86_400_000;

  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const object = value => isObject(value) ? value : {};
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.trunc(finiteNumber(value, min))));
  const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const isoOr = (value, fallback) => validDate(value) ? new Date(value).toISOString() : fallback;
  const normalizeWord = word => String(word || "").trim().toLocaleLowerCase("en-US");
  const validStatus = value => Object.hasOwn(STATUS, value) ? value : null;
  const uniqueStrings = value => Array.isArray(value)
    ? [...new Set(value.filter(item => typeof item === "string" && item.length <= 120))]
    : [];

  function blankRoot() {
    return {
      version: VERSION,
      selectedBookId: ACTIVE_DEFAULT,
      mastery: {},
      books: {},
      legacyBooks: {},
      preferences: { dailyGoal: 50, academicDailyGoal: 30, lastAcademicWord: "" },
      migration: null
    };
  }

  function emptyBook(meta) {
    return {
      bookId: meta.bookId,
      name: meta.name,
      source: meta.source,
      totalWords: meta.totalWords,
      catalogVersion: clampInt(meta.catalogVersion ?? 1, 1, 10_000),
      currentPosition: 0,
      history: [],
      session: null
    };
  }

  function sanitizeHistory(value) {
    return (Array.isArray(value) ? value : []).filter(item => {
      return isObject(item) && validDate(item.date) && ["daily", "review", "academic"].includes(item.mode);
    }).slice(0, 366).map(item => ({
      date: new Date(item.date).toISOString(),
      mode: item.mode,
      words: clampInt(item.words, 0, 10_000),
      ratings: {
        unknown: clampInt(item.ratings?.unknown ?? item.wrong, 0, 20_000),
        fuzzy: clampInt(item.ratings?.fuzzy, 0, 20_000),
        known: clampInt(item.ratings?.known ?? item.correct, 0, 20_000),
        simple: clampInt(item.ratings?.simple ?? item.skipped, 0, 20_000)
      },
      directions: {
        "en-zh": clampInt(item.directions?.["en-zh"], 0, 20_000),
        "zh-en": clampInt(item.directions?.["zh-en"], 0, 20_000)
      },
      durationSeconds: clampInt(item.durationSeconds, 0, 86_400),
      academicWords: clampInt(item.academicWords, 0, 10_000),
      generalWords: clampInt(item.generalWords, 0, 10_000)
    }));
  }

  function sanitizeSession(value, validIds, currentPosition) {
    if (!isObject(value) || !["daily", "review", "academic"].includes(value.mode)) return null;
    const rawQueue = Array.isArray(value.queue)
      ? value.queue.filter(id => typeof id === "string" && id.length <= 120).slice(0, 5000)
      : [];
    const rawIndex = clampInt(value.index, 0, rawQueue.length);
    const seen = new Set(), queue = [];
    let index = 0;
    rawQueue.forEach((id, position) => {
      if (seen.has(id) || (validIds && !validIds.has(id))) return;
      seen.add(id);
      queue.push(id);
      if (position < rawIndex) index++;
    });
    if (!queue.length) return null;
    return {
      mode: value.mode,
      queue,
      round: value.round === 1 ? 1 : 0,
      index: clampInt(index, 0, queue.length),
      ratings: {
        unknown: clampInt(value.ratings?.unknown ?? value.wrong, 0, 20_000),
        fuzzy: clampInt(value.ratings?.fuzzy, 0, 20_000),
        known: clampInt(value.ratings?.known ?? value.correct, 0, 20_000),
        simple: clampInt(value.ratings?.simple ?? value.skipped, 0, 20_000)
      },
      startedAt: isoOr(value.startedAt, new Date().toISOString()),
      scanCursor: clampInt(value.scanCursor, currentPosition, Number.MAX_SAFE_INTEGER),
      generalScanCursor: clampInt(value.generalScanCursor ?? value.scanCursor, currentPosition, Number.MAX_SAFE_INTEGER),
      academicScanCursor: clampInt(value.academicScanCursor, 0, Number.MAX_SAFE_INTEGER),
      academicWords: clampInt(value.academicWords, 0, queue.length),
      generalWords: clampInt(value.generalWords, 0, queue.length)
    };
  }

  function sanitizeBook(value, meta, validIds) {
    const input = object(value);
    const result = emptyBook(meta);
    const idSet = validIds || {
      has(id) {
        if (typeof id !== "string" || !id.startsWith(meta.bookId + "-")) return false;
        const number = Number(id.slice(meta.bookId.length + 1));
        return Number.isInteger(number) && number >= 1 && number <= meta.totalWords;
      }
    };
    result.currentPosition = clampInt(input.currentPosition, 0, meta.totalWords);
    result.history = sanitizeHistory(input.history);
    result.session = sanitizeSession(input.session, idSet, result.currentPosition);
    return result;
  }

  function sanitizeDirection(value) {
    const input = object(value);
    const status = validStatus(input.status);
    if (!status) return null;
    const updatedAt = isoOr(input.updatedAt, new Date(0).toISOString());
    return {
      status,
      updatedAt,
      nextReviewAt: status === "simple" ? null : isoOr(input.nextReviewAt, updatedAt),
      streak: clampInt(input.streak, 0, 10_000),
      misses: clampInt(input.misses, 0, 10_000)
    };
  }

  function deriveStatus(directions, fallback = "unknown") {
    const statuses = DIRECTIONS.map(direction => directions[direction]?.status).filter(Boolean);
    if (!statuses.length) return validStatus(fallback) || "unknown";
    if (statuses.includes("simple")) return statuses.every(status => status === "simple") ? "simple" : statuses.filter(status => status !== "simple").sort((a, b) => STATUS[b].weight - STATUS[a].weight)[0];
    return statuses.sort((a, b) => STATUS[b].weight - STATUS[a].weight)[0];
  }

  function sanitizeMastery(value, key) {
    const input = object(value);
    const directions = {};
    for (const direction of DIRECTIONS) {
      const clean = sanitizeDirection(input.directions?.[direction]);
      if (clean) directions[direction] = clean;
    }
    const fallbackStatus = validStatus(input.status);
    if (!Object.keys(directions).length && fallbackStatus) {
      const updatedAt = isoOr(input.updatedAt, new Date(0).toISOString());
      for (const direction of DIRECTIONS) directions[direction] = {
        status: fallbackStatus,
        updatedAt,
        nextReviewAt: fallbackStatus === "simple" ? null : isoOr(input.nextReviewAt, updatedAt),
        streak: clampInt(input.streak, 0, 10_000),
        misses: clampInt(input.misses, 0, 10_000)
      };
    }
    if (!Object.keys(directions).length) return null;
    const timestamps = Object.values(directions).map(item => item.updatedAt).sort();
    const status = deriveStatus(directions, fallbackStatus);
    const due = Object.values(directions).map(item => item.nextReviewAt).filter(Boolean).sort()[0] || null;
    return {
      word: String(input.word || key).trim().slice(0, 120),
      status,
      updatedAt: timestamps.at(-1),
      nextReviewAt: status === "simple" ? null : due,
      directions
    };
  }

  function sanitizeV4(raw, metas, catalogs = {}) {
    const input = object(raw);
    const result = blankRoot();
    const activeMetas = metas.filter(meta => meta.active !== false);
    const selectableIds = new Set(activeMetas.filter(meta => meta.kind !== "academic").map(meta => meta.bookId));
    const allCatalogIds = new Set(activeMetas.flatMap(meta => (Array.isArray(catalogs[meta.bookId]) ? catalogs[meta.bookId] : []).map(item => item.id)));
    result.selectedBookId = selectableIds.has(input.selectedBookId) ? input.selectedBookId : (selectableIds.has(ACTIVE_DEFAULT) ? ACTIVE_DEFAULT : [...selectableIds][0]);
    result.preferences.dailyGoal = clampInt(input.preferences?.dailyGoal, 5, 100);
    result.preferences.academicDailyGoal = clampInt(input.preferences?.academicDailyGoal ?? 30, 0, result.preferences.dailyGoal);
    result.preferences.lastAcademicWord = String(input.preferences?.lastAcademicWord || "").trim().slice(0, 120);
    for (const [key, value] of Object.entries(object(input.mastery))) {
      const normalized = normalizeWord(key || value?.word);
      if (!normalized || normalized.length > 120) continue;
      const clean = sanitizeMastery(value, normalized);
      if (clean) result.mastery[normalized] = clean;
    }
    for (const meta of activeMetas) {
      result.books[meta.bookId] = sanitizeBook(input.books?.[meta.bookId], meta, allCatalogIds.size ? allCatalogIds : undefined);
    }
    const academicMeta = activeMetas.find(meta => meta.kind === "academic");
    const oldAcademic = object(input.books?.[academicMeta?.bookId]);
    const academicCatalogChanged = academicMeta && Object.keys(oldAcademic).length
      && clampInt(oldAcademic.catalogVersion ?? 1, 1, 10_000) < clampInt(academicMeta.catalogVersion ?? 1, 1, 10_000);
    if (academicCatalogChanged) {
      result.books[academicMeta.bookId].currentPosition = 0;
      for (const data of Object.values(result.books)) {
        if (data.session?.queue.some(id => id.startsWith("academic-priority-"))) data.session.academicScanCursor = 0;
      }
      result.migration = {
        ...(isObject(input.migration) ? input.migration : {}),
        academicCatalog: {
          fromVersion: clampInt(oldAcademic.catalogVersion ?? 1, 1, 10_000),
          toVersion: clampInt(academicMeta.catalogVersion ?? 1, 1, 10_000),
          migratedAt: new Date().toISOString()
        }
      };
    }
    for (const meta of metas.filter(meta => meta.active === false)) {
      if (input.legacyBooks?.[meta.bookId]) result.legacyBooks[meta.bookId] = sanitizeBook(input.legacyBooks[meta.bookId], meta);
    }
    if (!academicCatalogChanged) result.migration = isObject(input.migration) ? input.migration : null;
    return result;
  }

  function legacyCandidate(root, word, status, at, sourceBookId) {
    const key = normalizeWord(word);
    if (!key || !validStatus(status)) return;
    const timestamp = isoOr(at, new Date(0).toISOString());
    const existing = root.mastery[key];
    const shouldReplace = !existing || timestamp > existing.updatedAt || (timestamp === existing.updatedAt && STATUS[status].weight > STATUS[existing.status].weight);
    if (!shouldReplace) return;
    const nextReviewAt = status === "simple" ? null : new Date(Date.parse(timestamp) + STATUS[status].delayDays * DAY).toISOString();
    root.mastery[key] = {
      word,
      status,
      updatedAt: timestamp,
      nextReviewAt,
      directions: Object.fromEntries(DIRECTIONS.map(direction => [direction, {
        status,
        updatedAt: timestamp,
        nextReviewAt,
        streak: status === "known" ? 1 : 0,
        misses: status === "unknown" ? 1 : 0,
        migratedFrom: sourceBookId
      }]))
    };
  }

  function migrateV3(raw, metas, catalogs, now = new Date().toISOString()) {
    const input = object(raw);
    const result = blankRoot();
    const activeMetas = metas.filter(meta => meta.active !== false);
    const activeIds = new Set(activeMetas.map(meta => meta.bookId));
    result.selectedBookId = activeIds.has(input.selectedBookId) ? input.selectedBookId : (activeIds.has(ACTIVE_DEFAULT) ? ACTIVE_DEFAULT : activeMetas[0]?.bookId);
    for (const meta of metas) {
      const oldBook = object(input.books?.[meta.bookId]);
      const words = Array.isArray(catalogs[meta.bookId]) ? catalogs[meta.bookId] : [];
      const byId = new Map(words.map(item => [item.id, item]));
      for (const [id, item] of Object.entries(object(oldBook.learned))) {
        const word = byId.get(id)?.word;
        if (word) legacyCandidate(result, word, "known", item?.lastSeenAt, meta.bookId);
      }
      for (const [id, item] of Object.entries(object(oldBook.wrong))) {
        const word = byId.get(id)?.word;
        if (word) legacyCandidate(result, word, "unknown", item?.lastWrongAt, meta.bookId);
      }
      for (const [id, item] of Object.entries(object(oldBook.skipped))) {
        const word = byId.get(id)?.word || item?.word;
        if (word) legacyCandidate(result, word, "simple", item?.at, meta.bookId);
      }
      const validIds = new Set(words.map(item => item.id));
      const cleaned = sanitizeBook(oldBook, meta, validIds);
      if (meta.active === false) result.legacyBooks[meta.bookId] = cleaned;
      else result.books[meta.bookId] = cleaned;
    }
    result.migration = { fromVersion: 3, migratedAt: isoOr(now, new Date().toISOString()) };
    return result;
  }

  function reviewDelay(status, streak) {
    if (status === "unknown") return 1;
    if (status === "fuzzy") return 3;
    if (status === "known") return [7, 14, 30, 60][Math.min(Math.max(streak - 1, 0), 3)];
    return null;
  }

  function rateMastery(previous, word, status, direction, now = new Date().toISOString()) {
    if (!validStatus(status) || !DIRECTIONS.includes(direction)) throw new Error("Invalid mastery rating");
    const timestamp = isoOr(now, new Date().toISOString());
    const current = sanitizeMastery(previous, normalizeWord(word)) || { word, directions: {} };
    const directions = { ...current.directions };
    if (status === "simple") {
      for (const itemDirection of DIRECTIONS) directions[itemDirection] = {
        status: "simple", updatedAt: timestamp, nextReviewAt: null, streak: 0, misses: 0
      };
    } else {
      const old = directions[direction] || {};
      const streak = status === "known" ? clampInt(old.streak, 0, 10_000) + 1 : 0;
      const misses = clampInt(old.misses, 0, 10_000) + (status === "unknown" ? 1 : 0);
      directions[direction] = {
        status,
        updatedAt: timestamp,
        nextReviewAt: new Date(Date.parse(timestamp) + reviewDelay(status, streak) * DAY).toISOString(),
        streak,
        misses
      };
    }
    const overall = deriveStatus(directions, status);
    const due = Object.values(directions).map(item => item.nextReviewAt).filter(Boolean).sort()[0] || null;
    return { word, status: overall, updatedAt: timestamp, nextReviewAt: overall === "simple" ? null : due, directions };
  }

  function isDue(entry, now = Date.now()) {
    return Boolean(entry && entry.status !== "simple" && validDate(entry.nextReviewAt) && Date.parse(entry.nextReviewAt) <= Number(now));
  }

  function eligibleSlice(words, mastery, start, count, excluded = [], excludedWords = []) {
    const ids = [], blocked = new Set(excluded), blockedWords = new Set(excludedWords.map(normalizeWord));
    let index = Math.max(0, Math.trunc(finiteNumber(start)));
    while (index < words.length && ids.length < count) {
      const word = words[index++];
      const key = normalizeWord(word?.word);
      const learned = validStatus(object(mastery)[key]?.status);
      if (word && !blocked.has(word.id) && !blockedWords.has(key) && !learned) {
        ids.push(word.id);
        blockedWords.add(key);
      }
    }
    return { ids, next: index };
  }

  function buildDailyPlan(generalWords, academicWords, mastery, generalStart = 0, academicStart = 0, dailyGoal = 50, academicGoal = 30) {
    const total = clampInt(dailyGoal, 1, 100), academicTarget = clampInt(academicGoal, 0, total);
    let academic = eligibleSlice(academicWords, mastery, academicStart, academicTarget);
    const academicChosenWords = academic.ids.map(id => academicWords.find(word => word.id === id)?.word).filter(Boolean);
    let general = eligibleSlice(generalWords, mastery, generalStart, total - academic.ids.length, academic.ids, academicChosenWords);
    if (academic.ids.length + general.ids.length < total) {
      const generalChosenWords = general.ids.map(id => generalWords.find(word => word.id === id)?.word).filter(Boolean);
      const extraAcademic = eligibleSlice(academicWords, mastery, academic.next, total - academic.ids.length - general.ids.length, [...academic.ids, ...general.ids], generalChosenWords);
      academic = { ids: academic.ids.concat(extraAcademic.ids), next: extraAcademic.next };
    }
    if (academic.ids.length + general.ids.length < total) {
      const allAcademicWords = academic.ids.map(id => academicWords.find(word => word.id === id)?.word).filter(Boolean);
      const extraGeneral = eligibleSlice(generalWords, mastery, general.next, total - academic.ids.length - general.ids.length, [...academic.ids, ...general.ids], allAcademicWords);
      general = { ids: general.ids.concat(extraGeneral.ids), next: extraGeneral.next };
    }
    return {
      ids: academic.ids.concat(general.ids),
      academicIds: academic.ids,
      generalIds: general.ids,
      academicNext: academic.next,
      generalNext: general.next
    };
  }

  function prioritizeDueWords(words, mastery, now = Date.now()) {
    const seen = new Set();
    return words.filter(word => {
      const key = normalizeWord(word?.word);
      if (!key || seen.has(key) || !isDue(object(mastery)[key], now)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const left = object(mastery)[normalizeWord(a.word)], right = object(mastery)[normalizeWord(b.word)];
      return (STATUS[right?.status]?.weight || 0) - (STATUS[left?.status]?.weight || 0)
        || Number(b.source === "academic") - Number(a.source === "academic")
        || String(left?.nextReviewAt || "").localeCompare(String(right?.nextReviewAt || ""));
    });
  }

  function academicQuestion(word, index = 0, round = 0) {
    const meaning = String(word?.academicMeaning || word?.meaning || "暂无论文语境释义");
    if (round) return { type: "zh-en", direction: "zh-en", label: "根据论文语境，说出英文词", prompt: meaning };
    const collocations = (Array.isArray(word?.collocations) ? word.collocations : []).filter(item => item?.text);
    const examples = (Array.isArray(word?.examples) && word.examples.length ? word.examples : [{ text: word?.example }]).filter(item => item?.text);
    const confusableWith = Array.isArray(word?.confusableWith) ? word.confusableWith.filter(Boolean) : [];
    const activities = ["academic-meaning"];
    if (collocations.length) activities.push("collocation");
    if (examples.length) activities.push("example");
    if (confusableWith.length) activities.push("confusable");
    const position = Math.max(0, Math.trunc(finiteNumber(index)));
    const type = activities[position % activities.length];
    const variant = Math.floor(position / activities.length);
    if (type === "collocation") {
      const collocation = collocations[variant % collocations.length];
      return { type, direction: "en-zh", label: "理解这组高频论文搭配", prompt: collocation.text };
    }
    if (type === "example") {
      const example = examples[variant % examples.length];
      return { type, direction: "en-zh", label: "结合论文例句判断语境义", prompt: example.text };
    }
    if (type === "confusable") return { type, direction: "en-zh", label: `与 ${confusableWith.join(" / ")} 辨析`, prompt: word.word };
    return { type, direction: "en-zh", label: "说出它在论文中的核心语义", prompt: word.word };
  }

  function sanitizeAcademicWord(value) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id.startsWith("academic-priority-") || typeof value.word !== "string") return null;
    const word = value.word.trim().slice(0, 120), academicMeaning = String(value.academicMeaning || value.meaning || "").trim().slice(0, 500);
    if (!word || !academicMeaning) return null;
    const cleanCollocation = item => isObject(item) ? {
      text: String(item.text || "").trim().slice(0, 160), translation: String(item.translation || "").trim().slice(0, 200)
    } : null;
    const cleanExample = item => isObject(item) ? {
      text: String(item.text || "").trim().slice(0, 500), translation: String(item.translation || "").trim().slice(0, 500)
    } : null;
    const cleanSense = item => isObject(item) ? {
      sectionId: String(item.sectionId || "").trim().slice(0, 40), section: String(item.section || "").trim().slice(0, 120),
      academicMeaning: String(item.academicMeaning || "").trim().slice(0, 500),
      collocation: cleanCollocation(item.collocation), example: String(item.example || "").trim().slice(0, 500),
      translation: String(item.translation || "").trim().slice(0, 500)
    } : null;
    return {
      id: value.id.slice(0, 120), word,
      phonetic: String(value.phonetic || "").trim().slice(0, 120),
      partOfSpeech: String(value.partOfSpeech || "").trim().slice(0, 40),
      meaning: String(value.meaning || academicMeaning).trim().slice(0, 500), academicMeaning,
      frequency: clampInt(value.frequency, 0, 5), frequencyLabel: String(value.frequencyLabel || "").trim().slice(0, 5),
      collocations: (Array.isArray(value.collocations) ? value.collocations : []).slice(0, 12).map(cleanCollocation).filter(item => item?.text),
      example: String(value.example || "").trim().slice(0, 500), translation: String(value.translation || "").trim().slice(0, 500),
      examples: (Array.isArray(value.examples) ? value.examples : []).slice(0, 12).map(cleanExample).filter(item => item?.text),
      senses: (Array.isArray(value.senses) ? value.senses : []).slice(0, 12).map(cleanSense).filter(item => item?.academicMeaning),
      source: "academic", sectionId: String(value.sectionId || "").trim().slice(0, 40), section: String(value.section || "").trim().slice(0, 120),
      top100Rank: Number.isInteger(Number(value.top100Rank)) && Number(value.top100Rank) >= 1 && Number(value.top100Rank) <= 100 ? Number(value.top100Rank) : null,
      tags: uniqueStrings(value.tags).slice(0, 12), confusableWith: uniqueStrings(value.confusableWith).slice(0, 12),
      confusableNote: String(value.confusableNote || "").trim().slice(0, 500), masteryStatus: null
    };
  }

  function parseMeaning(meaning) {
    const cleaned = String(meaning || "").replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
    const chunks = cleaned.split(/[；;]/).flatMap(part => {
      const pos = part.match(/^([a-z]+\.)\s*/i)?.[1] || "";
      return part.replace(/^([a-z]+\.)\s*/i, "").split(/[,，]/).map(text => ({ pos, text: text.trim() }));
    }).filter(item => item.text && item.text.length <= 80);
    const unique = [];
    const seen = new Set();
    for (const item of chunks) {
      const key = item.text.toLocaleLowerCase("zh-CN");
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    }
    const fallback = cleaned || "暂无释义";
    return {
      core: unique[0] || { pos: "", text: fallback },
      common: unique.slice(1, 5),
      extra: unique.slice(5),
      original: fallback
    };
  }

  function report(state, metas, now = Date.now()) {
    const counts = { unknown: 0, fuzzy: 0, known: 0, simple: 0 };
    const directionCounts = {
      "en-zh": { unknown: 0, fuzzy: 0, known: 0, simple: 0 },
      "zh-en": { unknown: 0, fuzzy: 0, known: 0, simple: 0 }
    };
    let due = 0;
    for (const entry of Object.values(object(state.mastery))) {
      if (validStatus(entry.status)) counts[entry.status]++;
      for (const direction of DIRECTIONS) {
        const status = validStatus(entry.directions?.[direction]?.status);
        if (status) directionCounts[direction][status]++;
      }
      if (isDue(entry, now)) due++;
    }
    const activeBooks = metas.filter(meta => meta.active !== false).map(meta => {
      const data = state.books?.[meta.bookId] || {};
      const position = clampInt(data.currentPosition, 0, meta.totalWords);
      return { bookId: meta.bookId, name: meta.name, position, total: meta.totalWords, percent: meta.totalWords ? Math.round(position / meta.totalWords * 100) : 0 };
    });
    const history = activeBooks.flatMap(meta => sanitizeHistory(state.books?.[meta.bookId]?.history));
    const studyDates = new Set(history.map(item => item.date.slice(0, 10)));
    for (const meta of activeBooks) {
      const session = state.books?.[meta.bookId]?.session;
      const hasProgress = clampInt(session?.index, 0, Number.MAX_SAFE_INTEGER) > 0
        || Object.values(object(session?.ratings)).some(value => clampInt(value, 0, 20_000) > 0);
      if (hasProgress && validDate(session?.startedAt)) studyDates.add(new Date(session.startedAt).toISOString().slice(0, 10));
    }
    const lastSeven = Number(now) - 7 * DAY;
    const recent = history.filter(item => Date.parse(item.date) >= lastSeven);
    const ratings = recent.reduce((sum, item) => {
      for (const status of Object.keys(counts)) sum[status] += item.ratings[status] || 0;
      return sum;
    }, { unknown: 0, fuzzy: 0, known: 0, simple: 0 });
    return { counts, directionCounts, due, books: activeBooks, sessions: history.length, studyDays: studyDates.size, recentSessions: recent.length, recentRatings: ratings };
  }

  return {
    VERSION, STATUS, DIRECTIONS, ACTIVE_DEFAULT,
    blankRoot, emptyBook, normalizeWord, sanitizeBook, sanitizeV4, migrateV3,
    rateMastery, isDue, eligibleSlice, buildDailyPlan, prioritizeDueWords, academicQuestion, sanitizeAcademicWord, parseMeaning, report, validDate
  };
});
