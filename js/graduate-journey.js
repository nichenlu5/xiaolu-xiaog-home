(() => {
  "use strict";
  const core = window.XiaoluGraduateJourney;
  const loaded = core.load();
  let state = loaded.state, locked = Boolean(loaded.locked), stageFilter = "all";
  const $ = selector => document.querySelector(selector);
  const settingsDialog = $("#journey-settings-dialog"), settingsForm = $("#journey-settings-form"), milestoneDialog = $("#milestone-dialog"), milestoneForm = $("#milestone-form");
  let toastTimer;

  if (loaded.warning) { $("#storage-warning").hidden = false; $("#storage-warning").textContent = loaded.warning; }
  core.CATEGORIES.forEach(category => $("#milestone-category").append(Object.assign(document.createElement("option"), { value: category, textContent: category })));
  if (locked) [$("#open-settings"), $("#add-milestone")].forEach(button => { button.disabled = true; });

  function notify(message) {
    let toast = document.querySelector(".save-toast");
    if (!toast) { toast = document.createElement("div"); toast.className = "save-toast"; toast.setAttribute("role", "status"); document.body.append(toast); }
    toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }
  function persist() {
    if (locked) return false;
    const ok = core.save(state);
    if (!ok) { $("#storage-warning").hidden = false; $("#storage-warning").textContent = "浏览器存储空间不足，本次修改未保存。"; }
    return ok;
  }
  function actionButton(label, action, className = "") {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.action = action; button.className = className; return button;
  }
  function statusClass(status) { return status === "done" ? "is-done" : status === "doing" ? "is-doing" : "is-todo"; }

  function renderOverview() {
    const metrics = core.journeyMetrics(state.settings);
    const graduation = metrics.graduationDate ? core.formatTarget(metrics.graduationDate) : `${core.formatMonth(metrics.graduationMonth)}（预计）`;
    $("#journey-date-range").textContent = `${core.formatTarget(metrics.admissionDate)}入学 → ${graduation}`;
    $("#journey-phase").textContent = metrics.phase.name;
    $("#journey-remaining").textContent = metrics.phase.id === "graduated" ? "已到达" : `${metrics.approximateGraduation ? "约 " : ""}${metrics.remainingDays} 天`;
    $("#journey-elapsed").textContent = metrics.current < metrics.start ? "尚未入学" : `约 ${metrics.elapsedDays} 天`;
    $("#journey-percent").textContent = `${metrics.progress}%`;
    $("#journey-progress-bar").style.width = `${metrics.progress}%`;
    $(".journey-progress").setAttribute("aria-valuenow", String(metrics.progress));
    $("#journey-phase-copy").textContent = metrics.phase.description;
    $("#phase-map").replaceChildren(...core.PHASES.map(phase => {
      const card = document.createElement("article"); card.className = "phase-card" + (metrics.phase.id === phase.id ? " current" : ""); card.dataset.stage = phase.id;
      const count = state.milestones.filter(item => item.stage === phase.id).length, done = state.milestones.filter(item => item.stage === phase.id && item.status === "done").length;
      card.append(Object.assign(document.createElement("span"), { textContent: metrics.phase.id === phase.id ? "正在这里" : phase.name }), Object.assign(document.createElement("h3"), { textContent: phase.name }), Object.assign(document.createElement("p"), { textContent: phase.description }), Object.assign(document.createElement("small"), { textContent: `${done} / ${count} 个目标已完成` }));
      return card;
    }));
  }

  function renderGrowth() {
    const stats = core.readGrowthStats();
    Object.entries(stats).forEach(([key, item]) => { const element = $("#growth-" + key); if (element) element.textContent = item.available ? item.label + (key === "study" ? " 次" : " 条") : "暂无数据"; });
  }

  function milestoneCard(item) {
    const phase = core.PHASES.find(value => value.id === item.stage);
    const card = document.createElement("article"); card.className = `record-card milestone-card ${statusClass(item.status)}`; card.dataset.id = item.id;
    const top = document.createElement("div"), title = document.createElement("h3"), badge = document.createElement("span"); top.className = "record-top"; title.textContent = item.title; badge.className = "milestone-status"; badge.textContent = core.STATUS_NAMES[item.status]; top.append(title, badge); card.append(top);
    const meta = document.createElement("div"); meta.className = "record-meta"; [phase?.name, item.category, core.formatTarget(item.targetDate, item.estimated)].filter(Boolean).forEach(value => meta.append(Object.assign(document.createElement("span"), { textContent: value }))); card.append(meta);
    if (item.note) card.append(Object.assign(document.createElement("p"), { textContent: item.note }));
    const actions = document.createElement("div"); actions.className = "record-actions"; actions.append(actionButton("编辑", "edit"), actionButton("删除", "delete", "delete-action")); card.append(actions); return card;
  }

  function renderMilestones() {
    const statusOrder = { doing: 0, todo: 1, done: 2 };
    const rows = state.milestones.filter(item => stageFilter === "all" || item.stage === stageFilter).sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.targetDate || "9999-99-99").localeCompare(b.targetDate || "9999-99-99") || b.updatedAt.localeCompare(a.updatedAt));
    $("#milestone-summary").textContent = `共 ${rows.length} 个目标 · ${rows.filter(item => item.status === "done").length} 个已完成`;
    if (rows.length) $("#milestone-list").replaceChildren(...rows.map(milestoneCard));
    else { const empty = document.createElement("div"); empty.className = "empty-state"; empty.append(Object.assign(document.createElement("span"), { textContent: "🎯" }), Object.assign(document.createElement("p"), { textContent: "这个阶段还没有目标，写下第一件想完成的事吧。" })); $("#milestone-list").replaceChildren(empty); }
  }
  function render() { renderOverview(); renderGrowth(); renderMilestones(); }

  function openSettings() {
    settingsForm.reset(); $("#admission-date").value = state.settings.admissionDate; $("#graduation-month").value = state.settings.graduationMonth; $("#graduation-date").value = state.settings.graduationDate; settingsDialog.showModal();
  }
  function openMilestone(item = null) {
    milestoneForm.reset(); const currentPhase = core.journeyMetrics(state.settings).phase.id;
    $("#milestone-id").value = item?.id || ""; $("#milestone-title-input").value = item?.title || ""; $("#milestone-stage").value = item?.stage || (stageFilter !== "all" ? stageFilter : core.PHASES.some(phase => phase.id === currentPhase) ? currentPhase : "year1"); $("#milestone-category").value = item?.category || "科研"; $("#milestone-date").value = item?.targetDate?.length === 10 ? item.targetDate : ""; $("#milestone-estimated").checked = Boolean(item?.estimated); $("#milestone-status").value = item?.status || "todo"; $("#milestone-note").value = item?.note || ""; $("#milestone-dialog-title").textContent = item ? "编辑目标" : "添加目标"; milestoneDialog.showModal();
  }

  $("#open-settings").addEventListener("click", openSettings); $("#add-milestone").addEventListener("click", () => openMilestone());
  document.querySelectorAll(".dialog-close,.cancel-button").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
  $("#graduation-date").addEventListener("change", event => { if (event.target.value) $("#graduation-month").value = event.target.value.slice(0, 7); });
  settingsForm.addEventListener("submit", event => {
    event.preventDefault(); if (locked) return;
    const raw = { admissionDate: $("#admission-date").value, admissionMonth: $("#admission-date").value.slice(0, 7), graduationMonth: $("#graduation-month").value, graduationDate: $("#graduation-date").value };
    if (raw.graduationDate) raw.graduationMonth = raw.graduationDate.slice(0, 7);
    const graduationBoundary = raw.graduationDate || `${raw.graduationMonth}-31`;
    if (graduationBoundary <= raw.admissionDate) { notify("毕业时间必须晚于入学时间"); return; }
    const normalized = core.normalizeSettings(raw);
    state.settings = normalized; if (persist()) { settingsDialog.close(); render(); notify("旅程时间已更新"); }
  });
  milestoneForm.addEventListener("submit", event => {
    event.preventDefault(); if (locked) return;
    const previous = state.milestones.find(item => item.id === $("#milestone-id").value), input = { id: $("#milestone-id").value, title: $("#milestone-title-input").value, stage: $("#milestone-stage").value, category: $("#milestone-category").value, targetDate: $("#milestone-date").value, estimated: $("#milestone-estimated").checked, status: $("#milestone-status").value, note: $("#milestone-note").value };
    state = core.upsertMilestone(state, input); if (persist()) { milestoneDialog.close(); render(); notify(previous ? "目标已更新" : "目标已添加"); }
  });
  $("#milestone-list").addEventListener("click", event => {
    const action = event.target.closest("[data-action]"), card = event.target.closest("[data-id]"); if (!action || !card) return;
    const item = state.milestones.find(value => value.id === card.dataset.id); if (!item) return;
    if (action.dataset.action === "edit") openMilestone(item);
    else if (action.dataset.action === "delete" && confirm(`确定删除目标“${item.title}”吗？`)) { state = core.removeMilestone(state, item.id); if (persist()) { render(); notify("目标已删除"); } }
  });
  document.querySelectorAll("[data-stage-filter]").forEach(button => button.addEventListener("click", () => { stageFilter = button.dataset.stageFilter; document.querySelectorAll("[data-stage-filter]").forEach(item => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); }); renderMilestones(); }));
  render();
})();
