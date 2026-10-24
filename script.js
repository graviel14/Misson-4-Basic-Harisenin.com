"use strict";

/* ============================================================
   To-Do List App
   - Profile (name + role), live clock (day & date)
   - Add task with priority (low / medium / high) and date
   - Check task -> struck through -> moves to DONE
   - Delete single task / delete all
   - Filter by day, today, and OVERDUE (bonus feature)
   ============================================================ */

const STORAGE_TASKS = "todo.tasks.v1";
const STORAGE_PROFILE = "todo.profile.v1";
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High" };

/* ---------- State ---------- */
const state = {
  tasks: load(STORAGE_TASKS, []),
  profile: load(STORAGE_PROFILE, null),
  filter: "all",      // "all" | "today" | "overdue" | "date"
  filterDate: ""      // used when filter === "date"
};

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  avatar: $("avatar"), profileName: $("profileName"), profileRole: $("profileRole"),
  editProfileBtn: $("editProfileBtn"),
  clockDay: $("clockDay"), clockDate: $("clockDate"), clockTime: $("clockTime"),
  form: $("taskForm"), text: $("taskText"), date: $("taskDate"), error: $("taskError"),
  chips: document.querySelectorAll(".chip"), filterDate: $("filterDate"),
  overdueCount: $("overdueCount"), filterInfo: $("filterInfo"),
  todoList: $("todoList"), doneList: $("doneList"),
  todoCount: $("todoCount"), doneCount: $("doneCount"),
  todoEmpty: $("todoEmpty"), doneEmpty: $("doneEmpty"),
  deleteAll: $("deleteAllBtn"),
  profileDialog: $("profileDialog"), profileForm: $("profileForm"),
  inputName: $("inputName"), inputRole: $("inputRole"),
  profileError: $("profileError"), profileCancel: $("profileCancel"),
  confirmDialog: $("confirmDialog")
};

/* ---------- Storage helpers ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

/* ---------- Date helpers ---------- */
function pad(n) { return String(n).padStart(2, "0"); }

function toDateString(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function todayString() { return toDateString(new Date()); }

function parseDate(str) { return new Date(str + "T00:00:00"); }

function formatLong(str) {
  return parseDate(str).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}
function formatShort(str) {
  return parseDate(str).toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
}

/* ---------- Clock ---------- */
function tickClock() {
  const now = new Date();
  el.clockDay.textContent = now.toLocaleDateString("id-ID", { weekday: "long" });
  el.clockDate.textContent = now.toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric"
  });
  el.clockTime.textContent = now.toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

/* ---------- Profile ---------- */
function renderProfile() {
  const p = state.profile;
  if (!p) return;
  el.profileName.textContent = p.name;
  el.profileRole.textContent = p.role;
  el.avatar.textContent = p.name.trim().charAt(0).toUpperCase() || "?";
}

function openProfileDialog(isFirstTime) {
  el.inputName.value = state.profile ? state.profile.name : "";
  el.inputRole.value = state.profile ? state.profile.role : "";
  el.profileError.hidden = true;
  el.profileCancel.hidden = isFirstTime;
  el.profileDialog.dataset.required = isFirstTime ? "1" : "";
  el.profileDialog.showModal();
  el.inputName.focus();
}

el.profileForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = el.inputName.value.trim();
  const role = el.inputRole.value.trim();
  if (!name || !role) {
    el.profileError.hidden = false;
    return;
  }
  state.profile = { name, role };
  save(STORAGE_PROFILE, state.profile);
  renderProfile();
  el.profileDialog.close();
});

el.profileCancel.addEventListener("click", () => el.profileDialog.close());
el.editProfileBtn.addEventListener("click", () => openProfileDialog(false));

// The first-time setup cannot be dismissed with Esc
el.profileDialog.addEventListener("cancel", (e) => {
  if (el.profileDialog.dataset.required === "1") e.preventDefault();
});

/* ---------- Tasks: logic ---------- */
function persist() { save(STORAGE_TASKS, state.tasks); }

function isOverdue(task) {
  return !task.done && task.date < todayString();
}

function addTask(text, priority, date) {
  state.tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text,
    priority,
    date,
    done: false
  });
  persist();
  render();
}

function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  persist();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((x) => x.id !== id);
  persist();
  render();
}

function deleteAll() {
  state.tasks = [];
  persist();
  render();
}

/* ---------- Tasks: filtering & sorting ---------- */
function isVisible(task) {
  switch (state.filter) {
    case "today":   return task.date === todayString();
    case "date":    return task.date === state.filterDate;
    case "overdue": return task.done ? true : isOverdue(task);
    default:        return true;
  }
}

function sortTasks(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

/* ---------- Tasks: rendering ---------- */
function buildTask(task) {
  const li = document.createElement("li");
  li.className = "task" + (task.done ? " done" : "");

  // checkbox
  const label = document.createElement("label");
  label.className = "check";
  label.title = task.done ? "Kembalikan ke To Do" : "Tandai selesai";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = task.done;
  input.setAttribute("aria-label", (task.done ? "Batalkan selesai: " : "Tandai selesai: ") + task.text);

  const box = document.createElement("span");
  box.className = "box";
  box.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  label.append(input, box);

  input.addEventListener("change", () => {
    // Show the strike-through for a moment, then move it to the other column
    if (input.checked) li.classList.add("striking");
    setTimeout(() => toggleTask(task.id), input.checked ? 380 : 0);
  });

  // content
  const body = document.createElement("div");
  body.className = "body";

  const text = document.createElement("p");
  text.className = "text";
  text.textContent = task.text;

  const meta = document.createElement("div");
  meta.className = "meta";

  const badge = document.createElement("span");
  badge.className = "badge " + task.priority;
  badge.textContent = PRIORITY_LABEL[task.priority];

  const date = document.createElement("span");
  date.textContent = formatShort(task.date);

  meta.append(badge, date);

  if (isOverdue(task)) {
    const late = document.createElement("span");
    late.className = "late";
    late.textContent = "• Terlambat";
    meta.append(late);
  }

  body.append(text, meta);

  // delete
  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.setAttribute("aria-label", "Hapus tugas: " + task.text);
  del.title = "Hapus";
  del.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  del.addEventListener("click", () => deleteTask(task.id));

  li.append(label, body, del);
  return li;
}

function renderList(listEl, emptyEl, tasks) {
  listEl.replaceChildren(...tasks.map(buildTask));
  emptyEl.hidden = tasks.length > 0;
}

function render() {
  const todos = state.tasks.filter((t) => !t.done && isVisible(t)).sort(sortTasks);
  const dones = state.tasks.filter((t) => t.done && isVisible(t)).sort(sortTasks);

  renderList(el.todoList, el.todoEmpty, todos);
  renderList(el.doneList, el.doneEmpty, dones);

  el.todoCount.textContent = todos.length;
  el.doneCount.textContent = dones.length;
  el.overdueCount.textContent = state.tasks.filter(isOverdue).length;

  // Empty-state copy depends on whether a filter is active
  el.todoEmpty.textContent = state.tasks.length && state.filter !== "all"
    ? "Tidak ada tugas untuk filter ini."
    : "Belum ada tugas. Mulai dengan menulis satu di atas.";

  // Filter chips + info line
  el.chips.forEach((c) => c.classList.toggle("active", c.dataset.filter === state.filter));
  el.filterDate.value = state.filter === "date" ? state.filterDate : "";

  if (state.filter === "today") el.filterInfo.textContent = "Menampilkan tugas untuk " + formatLong(todayString());
  else if (state.filter === "date") el.filterInfo.textContent = "Menampilkan tugas untuk " + formatLong(state.filterDate);
  else if (state.filter === "overdue") el.filterInfo.textContent = "Tugas yang melewati tanggalnya dan belum selesai.";
  else el.filterInfo.textContent = "";

  el.deleteAll.disabled = state.tasks.length === 0;
  el.deleteAll.style.opacity = state.tasks.length === 0 ? ".45" : "1";
}

/* ---------- Events ---------- */
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = el.text.value.trim();
  const date = el.date.value || todayString();
  const priority = el.form.elements.priority.value;

  if (!text) {
    el.error.hidden = false;
    el.text.classList.add("invalid");
    el.text.focus();
    return;
  }

  el.error.hidden = true;
  el.text.classList.remove("invalid");
  addTask(text, priority, date);

  el.text.value = "";
  el.date.value = todayString();
  el.form.elements.priority.value = "medium";
  el.text.focus();
});

el.text.addEventListener("input", () => {
  if (el.text.value.trim()) {
    el.error.hidden = true;
    el.text.classList.remove("invalid");
  }
});

// Ctrl/Cmd + Enter submits quickly
el.text.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    el.form.requestSubmit();
  }
});

el.chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.filter = chip.dataset.filter;
    render();
  });
});

el.filterDate.addEventListener("change", () => {
  if (el.filterDate.value) {
    state.filter = "date";
    state.filterDate = el.filterDate.value;
  } else {
    state.filter = "all";
  }
  render();
});

el.deleteAll.addEventListener("click", () => {
  if (!state.tasks.length) return;
  el.confirmDialog.showModal();
});

el.confirmDialog.addEventListener("close", () => {
  if (el.confirmDialog.returnValue === "ok") deleteAll();
  el.confirmDialog.returnValue = "";
});

/* ---------- Init ---------- */
function init() {
  el.date.value = todayString();
  tickClock();
  setInterval(tickClock, 1000);

  // Re-render at midnight / when the tab regains focus so "overdue" stays accurate
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

  renderProfile();
  render();

  if (!state.profile) openProfileDialog(true);
}

init();
