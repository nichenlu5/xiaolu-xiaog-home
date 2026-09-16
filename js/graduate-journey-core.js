((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.XiaoluGraduateJourney = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";

  const KEY = "xiaoluXiaogGraduateJourneyV1";
  const SCHEMA_VERSION = 2;
  const DAY_MS = 86400000;
  const DEFAULT_SETTINGS = Object.freeze({ admissionDate: "2026-09-14", admissionMonth: "2026-09", graduationMonth: "2029-06", graduationDate: "" });
  const STATUSES = Object.freeze(["todo", "doing", "done"]);
  const STATUS_NAMES = Object.freeze({ todo: "未开始", doing: "进行中", done: "已完成" });
  const CATEGORIES = Object.freeze(["课程", "科研", "文献", "技能", "项目", "实习", "求职", "论文", "答辩", "其他"]);
  const COMMUNICATION_TYPES = Object.freeze(["导师交流", "组会", "师兄师姐交流", "其他科研交流"]);
  const EXPERIMENT_STATUSES = Object.freeze(["draft", "rehearsed", "completed"]);
  const EXPERIMENT_STATUS_NAMES = Object.freeze({ draft: "草稿", rehearsed: "已预演", completed: "已完成" });
  const PHASES = Object.freeze([
    { id: "year1", name: "研一", description: "课程、科研入门、文献阅读、技能基础" },
    { id: "year2", name: "研二", description: "科研主线、工程项目、实习、求职准备" },
    { id: "year3", name: "研三", description: "秋招、论文、答辩、毕业" }
  ]);

  const text = (value, max = 3000) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "");
  const makeId = value => text(value, 100) || globalThis.crypto?.randomUUID?.() || `graduate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isValidMonth = value => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
    return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
  };
  const isValidDate = value => {
    const raw = String(value || "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return false;
    const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Date(stamp).toISOString().slice(0, 10) === raw;
  };
  const monthStart = value => {
    const [year, month] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, 1);
  };
  const monthEnd = value => {
    const [year, month] = value.split("-").map(Number);
    return Date.UTC(year, month, 0);
  };
  const exactDay = value => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const todayDay = value => {
    if (isValidDate(value)) return exactDay(value);
    const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };

  function normalizeSettings(input = {}) {
    const suppliedMonth = isValidMonth(input.admissionMonth) ? input.admissionMonth : "";
    let admissionDate = isValidDate(input.admissionDate)
      ? input.admissionDate
      : suppliedMonth
        ? (suppliedMonth === DEFAULT_SETTINGS.admissionMonth ? DEFAULT_SETTINGS.admissionDate : `${suppliedMonth}-01`)
        : DEFAULT_SETTINGS.admissionDate;
    let admissionMonth = admissionDate.slice(0, 7);
    let graduationMonth = isValidMonth(input.graduationMonth) ? input.graduationMonth : DEFAULT_SETTINGS.graduationMonth;
    let graduationDate = isValidDate(input.graduationDate) ? input.graduationDate : "";
    if (graduationDate) graduationMonth = graduationDate.slice(0, 7);
    if ((graduationDate ? exactDay(graduationDate) : monthEnd(graduationMonth)) <= exactDay(admissionDate)) {
      admissionDate = DEFAULT_SETTINGS.admissionDate;
      admissionMonth = DEFAULT_SETTINGS.admissionMonth;
      graduationMonth = DEFAULT_SETTINGS.graduationMonth;
      graduationDate = "";
    }
    return { admissionDate, admissionMonth, graduationMonth, graduationDate };
  }

  function journeyMetrics(settings, now = new Date()) {
    const normalized = normalizeSettings(settings);
    const start = exactDay(normalized.admissionDate);
    const end = normalized.graduationDate ? exactDay(normalized.graduationDate) : monthEnd(normalized.graduationMonth);
    const current = todayDay(now);
    const totalDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
    const elapsedDays = current < start ? 0 : Math.min(totalDays, Math.floor((current - start) / DAY_MS) + 1);
    const remainingDays = Math.max(0, Math.ceil((end - current) / DAY_MS));
    const progress = Math.max(0, Math.min(100, Math.round(elapsedDays / totalDays * 1000) / 10));
    const [year, month, day] = normalized.admissionDate.split("-").map(Number);
    const anniversary = offset => Date.UTC(year + offset, month - 1, Math.min(day, new Date(Date.UTC(year + offset, month, 0)).getUTCDate()));
    const year2Start = anniversary(1);
    const year3Start = anniversary(2);
    let phase;
    if (current < start) phase = { id: "before", name: "入学前", description: "距离研究生旅程开始还有一段准备时间" };
    else if (current >= end) phase = { id: "graduated", name: "已毕业", description: "这段研究生旅程已经走到终点" };
    else if (current < year2Start) phase = PHASES[0];
    else if (current < year3Start) phase = PHASES[1];
    else phase = PHASES[2];
    return { ...normalized, start, end, current, totalDays, elapsedDays, remainingDays, progress, phase, approximateGraduation: !normalized.graduationDate };
  }

  function normalizeMilestone(input = {}) {
    const stage = PHASES.some(item => item.id === input.stage) ? input.stage : "year1";
    const status = STATUSES.includes(input.status) ? input.status : "todo";
    const rawDate = text(input.targetDate, 10);
    return {
      id: makeId(input.id),
      title: text(input.title, 120),
      category: CATEGORIES.includes(input.category) ? input.category : "其他",
      stage,
      targetDate: isValidDate(rawDate) || isValidMonth(rawDate) ? rawDate : "",
      estimated: Boolean(input.estimated),
      status,
      note: text(input.note, 3000),
      createdAt: text(input.createdAt, 40) || new Date().toISOString(),
      updatedAt: text(input.updatedAt, 40) || new Date().toISOString(),
      sourceCommunicationId: text(input.sourceCommunicationId, 100)
    };
  }

  function normalizeDailyRecord(input = {}) {
    if (!isValidDate(input.date)) return null;
    return { id: makeId(input.id || `daily-${input.date}`), date: input.date, study: text(input.study), research: text(input.research), literature: text(input.literature), experiment: text(input.experiment), english: text(input.english), life: text(input.life), mood: text(input.mood, 120), sentence: text(input.sentence, 500), note: text(input.note), createdAt: text(input.createdAt, 40) || new Date().toISOString(), updatedAt: text(input.updatedAt, 40) || new Date().toISOString() };
  }

  function normalizeCommunication(input = {}) {
    const date = isValidDate(input.date) ? input.date : "";
    return { id: makeId(input.id), date, type: COMMUNICATION_TYPES.includes(input.type) ? input.type : COMMUNICATION_TYPES[0], subject: text(input.subject, 160), content: text(input.content), advice: text(input.advice), questions: text(input.questions), nextStep: text(input.nextStep), deadline: isValidDate(input.deadline) ? input.deadline : "", note: text(input.note), milestoneId: text(input.milestoneId, 100), createdAt: text(input.createdAt, 40) || new Date().toISOString(), updatedAt: text(input.updatedAt, 40) || new Date().toISOString() };
  }

  function normalizeExperiment(input = {}) {
    return { id: makeId(input.id), name: text(input.name, 160), date: isValidDate(input.date) ? input.date : "", purpose: text(input.purpose), reason: text(input.reason), theory: text(input.theory), materials: text(input.materials), steps: text(input.steps), parameters: text(input.parameters), parameterReason: text(input.parameterReason), expected: text(input.expected), problems: text(input.problems), solutions: text(input.solutions), dataPlan: text(input.dataPlan), cautions: text(input.cautions), note: text(input.note), status: EXPERIMENT_STATUSES.includes(input.status) ? input.status : "draft", createdAt: text(input.createdAt, 40) || new Date().toISOString(), updatedAt: text(input.updatedAt, 40) || new Date().toISOString() };
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const seen = new Set();
    const milestones = Array.isArray(source.milestones) ? source.milestones
      .filter(item => item && typeof item === "object")
      .map(normalizeMilestone)
      .filter(item => item.title && !seen.has(item.id) && seen.add(item.id)) : [];
    const unique = (items, normalizer, valid) => { const ids = new Set(); return Array.isArray(items) ? items.filter(item => item && typeof item === "object").map(normalizer).filter(item => item && valid(item) && !ids.has(item.id) && ids.add(item.id)) : []; };
    const dailyByDate = new Map();
    unique(source.dailyRecords, normalizeDailyRecord, item => item.date).forEach(item => { const old = dailyByDate.get(item.date); if (!old || item.updatedAt > old.updatedAt) dailyByDate.set(item.date, item); });
    return { schemaVersion: SCHEMA_VERSION, settings: normalizeSettings(source.settings), milestones, dailyRecords: [...dailyByDate.values()], communications: unique(source.communications, normalizeCommunication, item => item.date && item.subject), experiments: unique(source.experiments, normalizeExperiment, item => item.name) };
  }

  function load(storage = globalThis.localStorage) {
    const raw = storage?.getItem(KEY);
    if (raw == null) return { state: normalizeState(), warning: "" };
    try {
      const parsed = JSON.parse(raw);
      if (Number(parsed?.schemaVersion) > SCHEMA_VERSION) return { state: normalizeState(parsed), warning: "研究生旅程数据来自更新版本，当前页面仅供查看。", locked: true };
      return { state: normalizeState(parsed), warning: "" };
    } catch {
      return { state: normalizeState(), warning: "研究生旅程数据格式异常，已暂停覆盖原始数据。", locked: true };
    }
  }

  function save(state, storage = globalThis.localStorage) {
    try { storage.setItem(KEY, JSON.stringify(normalizeState(state))); return true; }
    catch { return false; }
  }

  function upsertMilestone(state, input) {
    const next = normalizeState(state);
    const current = next.milestones.find(item => item.id === text(input?.id, 100));
    const now = new Date().toISOString();
    const milestone = normalizeMilestone({ ...current, ...input, createdAt: current?.createdAt || input?.createdAt || now, updatedAt: now });
    if (current) Object.assign(current, milestone); else if (milestone.title) next.milestones.push(milestone);
    return next;
  }

  function removeMilestone(state, milestoneId) {
    const next = normalizeState(state);
    const id = text(milestoneId, 100);
    next.milestones = next.milestones.filter(item => item.id !== id);
    next.communications.forEach(item => { if (item.milestoneId === id) item.milestoneId = ""; });
    return next;
  }

  function upsertDailyRecord(state, input) {
    const next = normalizeState(state), record = normalizeDailyRecord(input); if (!record) return next;
    const byId = next.dailyRecords.find(item => item.id === text(input?.id,100)), byDate = next.dailyRecords.find(item => item.date === record.date), current = byId || byDate, now = new Date().toISOString();
    record.id = byDate?.id || (byId?.date === record.date ? byId.id : `daily-${record.date}`); record.createdAt = current?.createdAt || record.createdAt; record.updatedAt = now;
    next.dailyRecords = next.dailyRecords.filter(item => item.id !== byId?.id && item.id !== byDate?.id); next.dailyRecords.push(record); return next;
  }
  function removeDailyRecord(state, id) { const next = normalizeState(state); next.dailyRecords = next.dailyRecords.filter(item => item.id !== text(id,100)); return next; }
  function upsertCommunication(state, input) { const next=normalizeState(state),current=next.communications.find(item=>item.id===text(input?.id,100)),now=new Date().toISOString(),row=normalizeCommunication({...current,...input,createdAt:current?.createdAt||input?.createdAt||now,updatedAt:now}); if(current)Object.assign(current,row);else if(row.date&&row.subject)next.communications.push(row);return next; }
  function removeCommunication(state,id){const next=normalizeState(state);next.communications=next.communications.filter(item=>item.id!==text(id,100));return next;}
  function upsertExperiment(state,input){const next=normalizeState(state),current=next.experiments.find(item=>item.id===text(input?.id,100)),now=new Date().toISOString(),row=normalizeExperiment({...current,...input,createdAt:current?.createdAt||input?.createdAt||now,updatedAt:now});if(current)Object.assign(current,row);else if(row.name)next.experiments.push(row);return next;}
  function removeExperiment(state,id){const next=normalizeState(state);next.experiments=next.experiments.filter(item=>item.id!==text(id,100));return next;}
  function convertCommunicationToMilestone(state,communicationId,input={}) {
    let next=normalizeState(state);const row=next.communications.find(item=>item.id===text(communicationId,100));if(!row||!row.nextStep)return next;
    const existing=row.milestoneId&&next.milestones.find(item=>item.id===row.milestoneId);if(existing)return next;
    next=upsertMilestone(next,{title:input.title||row.nextStep,stage:input.stage||"year1",category:input.category||"科研",targetDate:input.targetDate||row.deadline,estimated:Boolean(input.estimated),status:"todo",note:input.note||`来自${row.type}：${row.subject}`,sourceCommunicationId:row.id});
    const created=next.milestones.find(item=>item.sourceCommunicationId===row.id);next.communications.find(item=>item.id===row.id).milestoneId=created?.id||"";return normalizeState(next);
  }
  function weekRange(now=new Date()) { const current=todayDay(now),day=new Date(current).getUTCDay()||7,start=current-(day-1)*DAY_MS,end=start+6*DAY_MS;return { start:new Date(start).toISOString().slice(0,10),end:new Date(end).toISOString().slice(0,10) }; }
  function weeklySummary(state,now=new Date()) { const next=normalizeState(state),range=weekRange(now),inWeek=value=>value>=range.start&&value<=range.end,daily=next.dailyRecords.filter(item=>inWeek(item.date)),communications=next.communications.filter(item=>inWeek(item.date)),milestones=next.milestones.filter(item=>item.status==="done"&&((item.targetDate.length===10&&inWeek(item.targetDate))||inWeek(String(item.updatedAt).slice(0,10)))),experiments=next.experiments.filter(item=>inWeek(item.date)||inWeek(String(item.updatedAt).slice(0,10)));const filled=field=>daily.filter(item=>item[field]).length;return { ...range,recordedDays:new Set(daily.map(item=>item.date)).size,studyDays:filled("study"),researchDays:filled("research"),literatureDays:filled("literature"),experimentDays:filled("experiment"),englishDays:filled("english"),communicationCount:communications.length,communicationSubjects:communications.map(item=>item.subject),milestoneCount:milestones.length,milestoneTitles:milestones.map(item=>item.title),experimentCount:experiments.length,completedExperiments:experiments.filter(item=>item.status==="completed").length }; }

  function nextMilestone(state, now = new Date()) {
    const current = todayDay(now);
    const rows = normalizeState(state).milestones.filter(item => item.status !== "done");
    return rows.sort((a, b) => {
      const dayA = a.targetDate ? (a.targetDate.length === 7 ? monthEnd(a.targetDate) : exactDay(a.targetDate)) : Infinity;
      const dayB = b.targetDate ? (b.targetDate.length === 7 ? monthEnd(b.targetDate) : exactDay(b.targetDate)) : Infinity;
      const groupA = dayA >= current ? 0 : 1, groupB = dayB >= current ? 0 : 1;
      return groupA - groupB || (groupA === 0 ? dayA - dayB : dayB - dayA) || b.updatedAt.localeCompare(a.updatedAt);
    })[0] || null;
  }

  function formatMonth(value) {
    return isValidMonth(value) ? `${Number(value.slice(0, 4))}年${Number(value.slice(5, 7))}月` : "时间待定";
  }

  function formatTarget(value, estimated = false) {
    if (isValidMonth(value)) return `${formatMonth(value)}${estimated ? "（预计）" : ""}`;
    if (!isValidDate(value)) return "日期待定";
    return `${Number(value.slice(0, 4))}年${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日${estimated ? "（预计）" : ""}`;
  }

  function readGrowthStats(storage = globalThis.localStorage) {
    const parse = key => { try { const raw = storage?.getItem(key); return raw == null ? null : JSON.parse(raw); } catch { return null; } };
    const study = parse("xiaoluXiaogVocabularyV2"), exercise = parse("xiaoluXiaogExerciseV1"), timeline = parse("xiaoluXiaogTimelineV1"), notes = parse("xiaoluXiaogNotesV1"), wishes = parse("xiaoluXiaogWishlistV1");
    const books = study?.books && typeof study.books === "object" && !Array.isArray(study.books) ? Object.values(study.books) : null;
    const studyHistory = books ? books.flatMap(book => Array.isArray(book?.history) ? book.history : []) : null;
    const count = (available, value, label) => available ? { available: true, value, label: `${label} ${value}` } : { available: false, value: null, label: "暂无数据" };
    return {
      study: count(Boolean(studyHistory), studyHistory?.length || 0, "已记录"),
      exercise: count(Array.isArray(exercise?.records), exercise?.records?.filter(item => item?.status === "completed").length || 0, "已完成"),
      memories: count(Array.isArray(timeline?.memories), timeline?.memories?.length || 0, "已创建"),
      notes: count(Array.isArray(notes?.notes), notes?.notes?.length || 0, "已创建"),
      wishes: count(Array.isArray(wishes), wishes?.filter(item => item?.status === "done").length || 0, "已完成")
    };
  }

  return { KEY, SCHEMA_VERSION, DEFAULT_SETTINGS, PHASES, STATUSES, STATUS_NAMES, CATEGORIES, COMMUNICATION_TYPES, EXPERIMENT_STATUSES, EXPERIMENT_STATUS_NAMES, isValidMonth, isValidDate, normalizeSettings, normalizeMilestone, normalizeDailyRecord, normalizeCommunication, normalizeExperiment, normalizeState, journeyMetrics, load, save, upsertMilestone, removeMilestone, upsertDailyRecord, removeDailyRecord, upsertCommunication, removeCommunication, upsertExperiment, removeExperiment, convertCommunicationToMilestone, weekRange, weeklySummary, nextMilestone, formatMonth, formatTarget, readGrowthStats };
});
