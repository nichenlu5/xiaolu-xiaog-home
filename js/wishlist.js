(() => {
  "use strict";

  const STORAGE_KEY = "xiaoluXiaogWishlistV1";
  const statuses = ["todo", "doing", "done"];
  const emptyCopy = {
    todo: ["📝", "还有好多故事没写进来呢。"],
    doing: ["🌿", "现在没有正在进行的小计划。"],
    done: ["✨", "第一件完成的小事，会出现在这里。"]
  };
  const sampleItems = [
    { title: "去内蒙古学马术，在草原上真正骑一次马", note: "先学会基础马术，再去看看真正的大草原。", status: "todo" },
    { title: "继续建设 xiaolu-xiaog-home", note: "让这里慢慢变成真正属于我们的小家。", status: "doing" },
    { title: "做属于我们的旅行地图", note: "把一起去过和想去的地方都标出来。", status: "todo" }
  ];

  const dialog = document.querySelector("#wish-dialog");
  const form = document.querySelector("#wish-form");
  const titleInput = document.querySelector("#wish-title");
  const noteInput = document.querySelector("#wish-note");
  const idInput = document.querySelector("#wish-id");
  const dialogTitle = document.querySelector("#dialog-title");
  let activeStatus = "todo";
  let items = loadItems();

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `wish-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadItems() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const now = new Date().toISOString();
      const seeded = sampleItems.map((item, index) => ({
        id: makeId(), ...item, createdAt: new Date(Date.now() - index * 1000).toISOString(), updatedAt: now, completedAt: null
      }));
      saveItems(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(item => item && statuses.includes(item.status)) : [];
    } catch (error) {
      console.warn("读取想做的事失败：", error);
      return [];
    }
  }

  function saveItems(nextItems = items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems)); }
    catch (error) { console.warn("保存想做的事失败：", error); }
  }

  function localDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const digits = "〇一二三四五六七八九";
    const year = String(date.getFullYear()).replace(/\d/g, digit => digits[Number(digit)]);
    const chineseNumber = value => value < 10 ? digits[value] : value === 10 ? "十" : value < 20 ? `十${digits[value - 10]}` : `${digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ""}`;
    return `${year}年${chineseNumber(date.getMonth() + 1)}月${chineseNumber(date.getDate())}日`;
  }

  function createButton(label, action, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.className = className;
    return button;
  }

  function createCard(item) {
    const card = document.createElement("article");
    card.className = "wish-card";
    card.dataset.id = item.id;
    card.dataset.status = item.status;

    const heading = document.createElement("h2");
    heading.textContent = item.title;
    card.append(heading);

    if (item.note) {
      const note = document.createElement("p");
      note.className = "wish-note";
      note.textContent = item.note;
      card.append(note);
    }

    if (item.status === "done" && item.completedAt) {
      const completed = document.createElement("p");
      completed.className = "wish-completed";
      completed.textContent = `✅ ${localDate(item.completedAt)}完成`;
      const celebration = document.createElement("p");
      celebration.className = "wish-celebration";
      celebration.textContent = "又一起实现了一件小事。";
      card.append(completed, celebration);
    } else {
      const meta = document.createElement("p");
      meta.className = "wish-meta";
      meta.textContent = `${localDate(item.createdAt)}写下`;
      card.append(meta);
    }

    const actions = document.createElement("div");
    actions.className = "wish-actions";
    if (item.status === "todo") actions.append(createButton("开始做", "doing", "status-action"));
    if (item.status === "doing") actions.append(createButton("完成啦", "done", "status-action"), createButton("放回想做", "todo"));
    if (item.status === "done") actions.append(createButton("继续做", "doing", "status-action"));
    actions.append(createButton("✏️ 编辑", "edit"), createButton("删除", "delete", "delete-action"));
    card.append(actions);
    return card;
  }

  function render() {
    const counts = Object.fromEntries(statuses.map(status => [status, items.filter(item => item.status === status).length]));
    document.querySelector("#total-count").textContent = items.length;
    document.querySelector("#doing-count").textContent = counts.doing;
    document.querySelector("#done-count").textContent = counts.done;
    statuses.forEach(status => {
      document.querySelector(`#tab-count-${status}`).textContent = counts[status];
      const panel = document.querySelector(`[data-panel="${status}"]`);
      panel.replaceChildren();
      const matching = items.filter(item => item.status === status).sort((a, b) => {
        const aDate = status === "done" ? a.completedAt : a.updatedAt;
        const bDate = status === "done" ? b.completedAt : b.updatedAt;
        return new Date(bDate || 0) - new Date(aDate || 0);
      });
      if (!matching.length) {
        const empty = document.createElement("div");
        empty.className = "empty-wishes";
        const icon = document.createElement("span");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = emptyCopy[status][0];
        empty.append(icon, document.createTextNode(emptyCopy[status][1]));
        panel.append(empty);
      } else matching.forEach(item => panel.append(createCard(item)));
    });
  }

  function selectTab(status, focus = false) {
    activeStatus = status;
    document.querySelectorAll("[role=tab]").forEach(tab => {
      const selected = tab.dataset.status === status;
      tab.setAttribute("aria-selected", selected);
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== status; });
  }

  function openForm(item = null) {
    form.reset();
    idInput.value = item?.id || "";
    titleInput.value = item?.title || "";
    noteInput.value = item?.note || "";
    dialogTitle.textContent = item ? "编辑这件想做的事" : "写下一件想做的事";
    dialog.showModal();
    requestAnimationFrame(() => titleInput.focus());
  }

  document.querySelector("#add-wish").addEventListener("click", () => openForm());
  document.querySelectorAll(".dialog-close, .cancel-button").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) { titleInput.setCustomValidity("请写下这件想做的事。"); titleInput.reportValidity(); return; }
    titleInput.setCustomValidity("");
    const note = noteInput.value.trim();
    const now = new Date().toISOString();
    if (idInput.value) {
      const item = items.find(wish => wish.id === idInput.value);
      if (item) Object.assign(item, { title, note, updatedAt: now });
    } else {
      items.unshift({ id: makeId(), title, note, status: "todo", createdAt: now, updatedAt: now, completedAt: null });
      selectTab("todo");
    }
    saveItems();
    render();
    dialog.close();
  });
  titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));

  document.querySelector(".wishlist-shell").addEventListener("click", event => {
    const tab = event.target.closest("[role=tab]");
    if (tab) { selectTab(tab.dataset.status); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest(".wish-card");
    const item = items.find(wish => wish.id === card?.dataset.id);
    if (!item) return;
    const action = button.dataset.action;
    if (action === "edit") { openForm(item); return; }
    if (action === "delete") {
      if (!confirm("确定要删掉这件事吗？")) return;
      items = items.filter(wish => wish.id !== item.id);
    } else if (statuses.includes(action)) {
      item.status = action;
      item.updatedAt = new Date().toISOString();
      item.completedAt = action === "done" ? item.updatedAt : null;
    }
    saveItems();
    render();
  });

  document.querySelector(".wish-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = statuses.indexOf(activeStatus);
    const next = event.key === "Home" ? 0 : event.key === "End" ? statuses.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + statuses.length) % statuses.length;
    selectTab(statuses[next], true);
  });

  render();
  selectTab(activeStatus);
})();
