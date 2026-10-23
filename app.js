// ===============================================
// לוח פרויקטים — לוגיקת האפליקציה
// הנתונים נשמרים בדפדפן (localStorage)
// ===============================================

const STORAGE_KEY = "project-board-data-v1";
const CFG = window.CONFIG;
const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let state = load();
let currentView = "table";
let search = "";
let personFilter = "";

// ---------- Storage ----------
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.boards) return saved;
  } catch (e) {}
  return sampleData();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function newItem(name, extra = {}) {
  return { id: uid(), name, person: "", status: "", priority: "", date: "", notes: "", subtasks: [], updates: [], ...extra };
}
function sampleData() {
  const s = CFG.statuses.map((x) => x.label);
  const p = CFG.priorities.map((x) => x.label);
  const ppl = CFG.people;
  const d = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  const boardId = uid();
  return {
    activeBoardId: boardId,
    people: [...ppl],
    boards: [{
      id: boardId,
      name: "הפרויקט הראשון שלי",
      groups: [
        { id: uid(), name: "השבוע", color: CFG.groupColors[0], collapsed: false, items: [
          newItem("תכנון דרישות", { person: ppl[0], status: s[3], priority: p[2], date: d(-2) }),
          newItem("עיצוב מסכים", { person: ppl[1], status: s[1], priority: p[1], date: d(2),
            subtasks: [{ id: uid(), text: "מסך בית", done: true }, { id: uid(), text: "מסך הגדרות", done: false }] }),
          newItem("פגישה עם לקוח", { person: ppl[2], status: s[2], priority: p[3], date: d(0) }),
        ]},
        { id: uid(), name: "בשבוע הבא", color: CFG.groupColors[1], collapsed: false, items: [
          newItem("פיתוח צד שרת", { person: ppl[3], status: s[0], priority: p[2], date: d(7) }),
          newItem("בדיקות", { person: ppl[0], status: s[0], priority: p[0], date: d(10) }),
        ]},
      ],
    }],
  };
}

// ---------- Helpers ----------
const board = () => state.boards.find((b) => b.id === state.activeBoardId) || state.boards[0];
const colorOf = (list, label) => (list.find((x) => x.label === label) || {}).color;
function personColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 50%)`;
}
function avatar(name) {
  if (!name) return `<span class="avatar empty">?</span>`;
  return `<span class="avatar" style="background:${personColor(name)}" title="${esc(name)}">${esc(name.slice(0, 2))}</span>`;
}
function findItem(itemId) {
  for (const g of board().groups) {
    const it = g.items.find((i) => i.id === itemId);
    if (it) return { group: g, item: it };
  }
  return {};
}
function matches(item) {
  if (personFilter && item.person !== personFilter) return false;
  if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
  return true;
}
function progressOf(item) {
  if (!item.subtasks.length) return item.status === CFG.statuses[CFG.statuses.length - 1].label ? 100 : 0;
  return Math.round((item.subtasks.filter((s) => s.done).length / item.subtasks.length) * 100);
}
function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function isOverdue(item) {
  const doneLabel = CFG.statuses[CFG.statuses.length - 1].label;
  return item.date && item.date < today() && item.status !== doneLabel;
}

// ---------- Render ----------
function render() {
  save();
  renderSidebar();
  const b = board();
  $("#boardTitle").textContent = b ? b.name : "";
  renderPersonFilter();
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === currentView));
  if (!b) { $("#view").innerHTML = `<div class="empty-state">אין לוחות. צור לוח חדש מהתפריט.</div>`; return; }
  if (currentView === "table") renderTable(b);
  else if (currentView === "kanban") renderKanban(b);
  else renderDashboard(b);
}

function renderSidebar() {
  $("#boardList").innerHTML = state.boards.map((b) =>
    `<li data-id="${b.id}" class="${b.id === state.activeBoardId ? "active" : ""}">${esc(b.name)}</li>`).join("");
}

function renderPersonFilter() {
  const sel = $("#personFilter");
  sel.innerHTML = `<option value="">כל האנשים</option>` +
    state.people.map((p) => `<option ${p === personFilter ? "selected" : ""}>${esc(p)}</option>`).join("");
}

function renderTable(b) {
  const html = b.groups.map((g) => {
    const items = g.items.filter(matches);
    const statusCounts = CFG.statuses.map((s) => ({ ...s, n: g.items.filter((i) => i.status === s.label).length }));
    const total = g.items.length || 1;
    const rows = items.map((it) => `
      <tr data-item="${it.id}" draggable="true">
        <td class="col-name" style="--group-color:${g.color}">
          <div class="name-wrap">
            <input class="cell-text" data-field="name" value="${esc(it.name)}">
            ${it.updates.length ? `<span class="badge-count" title="עדכונים">💬 ${it.updates.length}</span>` : ""}
            <button class="open-item" data-open="${it.id}" title="פתח פריט">⤢ פתח</button>
          </div>
        </td>
        <td><div class="person" data-pick="person">${avatar(it.person)}<span>${esc(it.person)}</span></div></td>
        <td><button class="pill ${it.status ? "" : "empty"}" data-pick="status" style="background:${colorOf(CFG.statuses, it.status) || ""}">${esc(it.status)}</button></td>
        <td><button class="pill ${it.priority ? "" : "empty"}" data-pick="priority" style="background:${colorOf(CFG.priorities, it.priority) || ""}">${esc(it.priority)}</button></td>
        <td><input type="date" class="cell-date ${isOverdue(it) ? "overdue" : ""}" data-field="date" value="${it.date}"></td>
        <td><div class="progress" title="${progressOf(it)}%"><div style="width:${progressOf(it)}%"></div></div></td>
        <td style="width:40px"><button class="del-row" data-del="${it.id}" title="מחק">✕</button></td>
      </tr>`).join("");
    return `
      <div class="group" data-group="${g.id}">
        <div class="group-head">
          <button class="group-toggle" data-toggle="${g.id}" style="color:${g.color}">${g.collapsed ? "◀" : "▼"}</button>
          <span class="group-name" contenteditable="true" spellcheck="false" data-gname="${g.id}" style="color:${g.color}">${esc(g.name)}</span>
          <span class="group-count">${g.items.length} פריטים</span>
          <button class="btn icon group-menu" data-gmenu="${g.id}">⋯</button>
        </div>
        ${g.collapsed ? "" : `
        <div class="table-wrap"><table>
          <thead><tr>
            <th class="col-name">משימה</th><th>אחראי</th><th>סטטוס</th><th>עדיפות</th><th>תאריך יעד</th><th>התקדמות</th><th></th>
          </tr></thead>
          <tbody>${rows}
            <tr class="add-row"><td class="col-name" style="--group-color:${g.color}" colspan="7">
              <input placeholder="+ הוסף משימה" data-add="${g.id}">
            </td></tr>
            <tr class="summary-row"><td></td><td></td>
              <td><div class="summary-bar">${statusCounts.filter((s) => s.n).map((s) =>
                `<div style="background:${s.color};width:${(s.n / total) * 100}%" title="${esc(s.label)}: ${s.n}"></div>`).join("")}</div></td>
              <td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table></div>`}
      </div>`;
  }).join("");
  $("#view").innerHTML = html + `<button class="btn primary" id="addGroupBtn">+ הוסף קבוצה</button>`;
}

function renderKanban(b) {
  const all = b.groups.flatMap((g) => g.items.map((it) => ({ it, g }))).filter(({ it }) => matches(it));
  const cols = [{ label: "", color: "#c4c4c4", title: "ללא סטטוס" }, ...CFG.statuses.map((s) => ({ ...s, title: s.label }))];
  $("#view").innerHTML = `<div class="kanban">${cols.map((c) => {
    const items = all.filter(({ it }) => it.status === c.label);
    return `<div class="kcol">
      <div class="kcol-head" style="background:${c.color}"><span>${esc(c.title)}</span><span>${items.length}</span></div>
      <div class="kcol-body" data-status="${esc(c.label)}">
        ${items.map(({ it, g }) => `
          <div class="kcard" draggable="true" data-kitem="${it.id}">
            <div class="kcard-title">${esc(it.name)}</div>
            <div class="kcard-meta">
              ${avatar(it.person)}
              <span class="tag" style="background:${g.color}">${esc(g.name)}</span>
              ${it.priority ? `<span class="tag" style="background:${colorOf(CFG.priorities, it.priority)}">${esc(it.priority)}</span>` : ""}
              ${it.date ? `<span class="${isOverdue(it) ? "overdue" : ""}">📅 ${formatDate(it.date)}</span>` : ""}
            </div>
          </div>`).join("")}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderDashboard(b) {
  const items = b.groups.flatMap((g) => g.items).filter(matches);
  const doneLabel = CFG.statuses[CFG.statuses.length - 1].label;
  const done = items.filter((i) => i.status === doneLabel).length;
  const overdue = items.filter(isOverdue).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const bars = (list, key) => {
    const max = Math.max(1, ...list.map((x) => items.filter((i) => i[key] === x.label).length));
    return list.map((x) => {
      const n = items.filter((i) => i[key] === x.label).length;
      return `<div class="bar-row"><span class="lbl">${esc(x.label)}</span><div class="bar"><div style="width:${(n / max) * 100}%;background:${x.color}"></div></div><span class="val">${n}</span></div>`;
    }).join("");
  };
  const peopleList = state.people.map((p) => ({ label: p, color: personColor(p) }));
  $("#view").innerHTML = `<div class="dash">
    <div class="card"><h3>סה"כ משימות</h3><div class="big-num">${items.length}</div></div>
    <div class="card"><h3>הושלמו</h3><div class="big-num" style="color:#00c875">${done} <small style="font-size:16px">(${pct}%)</small></div></div>
    <div class="card"><h3>באיחור</h3><div class="big-num" style="color:#e2445c">${overdue}</div></div>
    <div class="card"><h3>לפי סטטוס</h3>${bars(CFG.statuses, "status")}</div>
    <div class="card"><h3>לפי עדיפות</h3>${bars(CFG.priorities, "priority")}</div>
    <div class="card"><h3>לפי אחראי</h3>${bars(peopleList, "person")}</div>
  </div>`;
}

// ---------- Popover ----------
function showPopover(anchor, html, onClick) {
  const pop = $("#popover");
  pop.innerHTML = html;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.top = Math.min(r.bottom + 4, window.innerHeight - h - 8) + "px";
  pop.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + "px";
  pop.onclick = (e) => {
    const opt = e.target.closest("[data-val]");
    if (!opt) return;
    onClick(opt.dataset.val);
    hidePopover();
  };
}
function hidePopover() { $("#popover").hidden = true; }

function pickFor(anchor, item, field) {
  let html;
  if (field === "person") {
    html = state.people.map((p) => `<button class="opt plain" data-val="${esc(p)}">${avatar(p)} ${esc(p)}</button>`).join("") +
      `<button class="opt plain" data-val="">✕ ללא</button>`;
  } else {
    const list = field === "status" ? CFG.statuses : CFG.priorities;
    html = list.map((s) => `<button class="opt" data-val="${esc(s.label)}" style="background:${s.color}">${esc(s.label)}</button>`).join("") +
      `<button class="opt plain" data-val="">✕ נקה</button>`;
  }
  showPopover(anchor, html, (val) => { item[field] = val; render(); });
}

// ---------- Modal ----------
function openModal(title, bodyHtml) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHtml;
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; render(); }

function openItem(itemId) {
  const { item } = findItem(itemId);
  if (!item) return;
  const draw = () => {
    openModal(item.name, `
      <div class="field"><label>שם המשימה</label><input type="text" id="mName" value="${esc(item.name)}"></div>
      <div class="field"><label>הערות</label><textarea id="mNotes">${esc(item.notes)}</textarea></div>
      <div class="field"><label>תתי-משימות (${item.subtasks.filter((s) => s.done).length}/${item.subtasks.length})</label>
        ${item.subtasks.map((s) => `
          <div class="subtask ${s.done ? "done" : ""}">
            <input type="checkbox" data-sub-done="${s.id}" ${s.done ? "checked" : ""}>
            <input type="text" data-sub-text="${s.id}" value="${esc(s.text)}">
            <button class="btn icon" data-sub-del="${s.id}">✕</button>
          </div>`).join("")}
        <input type="text" id="mNewSub" placeholder="+ הוסף תת-משימה ולחץ Enter">
      </div>
      <div class="field"><label>עדכונים</label>
        ${item.updates.map((u) => `<div class="update"><small>${esc(u.when)}</small>${esc(u.text)}</div>`).join("") || `<div style="color:var(--muted)">אין עדכונים עדיין</div>`}
        <textarea id="mUpdate" placeholder="כתוב עדכון..." style="margin-top:6px;min-height:50px"></textarea>
        <button class="btn primary" id="mAddUpdate" style="margin-top:6px">פרסם עדכון</button>
      </div>`);
    const body = $("#modalBody");
    $("#mName").oninput = (e) => { item.name = e.target.value; $("#modalTitle").textContent = item.name; save(); };
    $("#mNotes").oninput = (e) => { item.notes = e.target.value; save(); };
    $("#mNewSub").onkeydown = (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        item.subtasks.push({ id: uid(), text: e.target.value.trim(), done: false });
        save(); draw(); $("#mNewSub").focus();
      }
    };
    $("#mAddUpdate").onclick = () => {
      const t = $("#mUpdate").value.trim();
      if (!t) return;
      item.updates.unshift({ text: t, when: new Date().toLocaleString("he-IL") });
      save(); draw();
    };
    body.onchange = (e) => {
      const id = e.target.dataset.subDone;
      if (id) { item.subtasks.find((s) => s.id === id).done = e.target.checked; save(); draw(); }
    };
    body.oninput = (e) => {
      const id = e.target.dataset.subText;
      if (id) { item.subtasks.find((s) => s.id === id).text = e.target.value; save(); }
    };
    body.onclick = (e) => {
      const id = e.target.dataset.subDel;
      if (id) { item.subtasks = item.subtasks.filter((s) => s.id !== id); save(); draw(); }
    };
  };
  draw();
}

function openPeople() {
  const draw = () => {
    openModal("אנשי צוות", `
      ${state.people.map((p, i) => `
        <div class="people-row">${avatar(p)}
          <input type="text" data-pidx="${i}" value="${esc(p)}">
          <button class="btn icon" data-pdel="${i}">✕</button>
        </div>`).join("")}
      <div class="people-row"><input type="text" id="newPerson" placeholder="שם חדש"><button class="btn primary" id="addPerson">הוסף</button></div>`);
    const body = $("#modalBody");
    const add = () => {
      const v = $("#newPerson").value.trim();
      if (v && !state.people.includes(v)) { state.people.push(v); save(); draw(); }
    };
    $("#addPerson").onclick = add;
    $("#newPerson").onkeydown = (e) => { if (e.key === "Enter") add(); };
    body.onchange = (e) => {
      const i = e.target.dataset.pidx;
      if (i === undefined) return;
      const oldName = state.people[i], newName = e.target.value.trim();
      if (!newName) return;
      state.people[i] = newName;
      state.boards.forEach((b) => b.groups.forEach((g) => g.items.forEach((it) => { if (it.person === oldName) it.person = newName; })));
      save(); draw();
    };
    body.onclick = (e) => {
      const i = e.target.dataset.pdel;
      if (i !== undefined) { state.people.splice(Number(i), 1); save(); draw(); }
    };
  };
  draw();
}

// ---------- Events ----------
$("#boardList").onclick = (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  state.activeBoardId = li.dataset.id;
  $("#sidebar").classList.remove("open");
  render();
};
$("#addBoardBtn").onclick = () => {
  const name = prompt("שם הלוח החדש:", "לוח חדש");
  if (!name) return;
  const b = { id: uid(), name, groups: [{ id: uid(), name: "קבוצה חדשה", color: CFG.groupColors[0], collapsed: false, items: [] }] };
  state.boards.push(b);
  state.activeBoardId = b.id;
  render();
};
$("#deleteBoardBtn").onclick = () => {
  const b = board();
  if (!b || !confirm(`למחוק את הלוח "${b.name}"? לא ניתן לבטל.`)) return;
  state.boards = state.boards.filter((x) => x.id !== b.id);
  state.activeBoardId = state.boards[0]?.id;
  render();
};
$("#boardTitle").onblur = (e) => { const b = board(); if (b) { b.name = e.target.textContent.trim() || b.name; render(); } };
$("#boardTitle").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } };
$("#searchInput").oninput = (e) => { search = e.target.value; render(); $("#searchInput").focus(); };
$("#personFilter").onchange = (e) => { personFilter = e.target.value; render(); };
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => { currentView = t.dataset.view; render(); }));
$("#peopleBtn").onclick = openPeople;
$("#modalClose").onclick = closeModal;
$("#modal").onclick = (e) => { if (e.target.id === "modal") closeModal(); };
$("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");
document.addEventListener("click", (e) => {
  if (!e.target.closest("#popover") && !e.target.closest("[data-pick]") && !e.target.closest("[data-gmenu]")) hidePopover();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { hidePopover(); if (!$("#modal").hidden) closeModal(); } });

$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `project-board-${today()}.json`;
  a.click();
};
$("#importInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.boards) throw new Error();
    if (confirm("הייבוא יחליף את כל הנתונים הנוכחיים. להמשיך?")) { state = data; render(); }
  } catch { alert("הקובץ אינו תקין"); }
  e.target.value = "";
};

// Table interactions (delegated)
const view = $("#view");
view.addEventListener("click", (e) => {
  const t = e.target;
  const row = t.closest("[data-item]");
  const pick = t.closest("[data-pick]");
  if (pick && row) { pickFor(pick, findItem(row.dataset.item).item, pick.dataset.pick); return; }
  if (t.dataset.open) { openItem(t.dataset.open); return; }
  if (t.dataset.del) {
    const { group } = findItem(t.dataset.del);
    group.items = group.items.filter((i) => i.id !== t.dataset.del);
    render(); return;
  }
  if (t.dataset.toggle) {
    const g = board().groups.find((x) => x.id === t.dataset.toggle);
    g.collapsed = !g.collapsed; render(); return;
  }
  if (t.dataset.gmenu) {
    const g = board().groups.find((x) => x.id === t.dataset.gmenu);
    const html = `<div style="display:flex;gap:4px;flex-wrap:wrap;max-width:180px;padding:4px">${CFG.groupColors.map((c) =>
      `<button class="opt" data-val="color:${c}" style="background:${c};width:28px;height:28px;padding:0"></button>`).join("")}</div>
      <button class="opt plain" data-val="delete">🗑 מחק קבוצה</button>`;
    showPopover(t, html, (val) => {
      if (val === "delete") {
        if (confirm(`למחוק את הקבוצה "${g.name}" וכל המשימות שבה?`)) board().groups = board().groups.filter((x) => x !== g);
      } else g.color = val.slice(6);
      render();
    });
    return;
  }
  if (t.id === "addGroupBtn") {
    const b = board();
    b.groups.unshift({ id: uid(), name: "קבוצה חדשה", color: CFG.groupColors[b.groups.length % CFG.groupColors.length], collapsed: false, items: [] });
    render();
  }
  const card = t.closest("[data-kitem]");
  if (card) openItem(card.dataset.kitem);
});
view.addEventListener("change", (e) => {
  const t = e.target, row = t.closest("[data-item]");
  if (row && t.dataset.field) { findItem(row.dataset.item).item[t.dataset.field] = t.value; render(); }
});
view.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key !== "Enter") return;
  if (t.dataset.add && t.value.trim()) {
    const g = board().groups.find((x) => x.id === t.dataset.add);
    g.items.push(newItem(t.value.trim()));
    render();
    document.querySelector(`[data-add="${g.id}"]`)?.focus();
  } else if (t.dataset.field === "name" || t.dataset.gname) {
    e.preventDefault(); t.blur();
  }
});
view.addEventListener("focusout", (e) => {
  const t = e.target;
  if (t.dataset.gname) {
    const g = board().groups.find((x) => x.id === t.dataset.gname);
    g.name = t.textContent.trim() || g.name; save();
  }
});

// Drag & drop — rows between groups (table) and cards between statuses (kanban)
let dragId = null;
view.addEventListener("dragstart", (e) => {
  const el = e.target.closest("[data-item],[data-kitem]");
  if (!el) return;
  dragId = el.dataset.item || el.dataset.kitem;
  e.dataTransfer.effectAllowed = "move";
});
view.addEventListener("dragover", (e) => {
  const target = e.target.closest(".kcol-body,.group");
  if (!target || !dragId) return;
  e.preventDefault();
  document.querySelectorAll(".drag-over").forEach((x) => x.classList.remove("drag-over"));
  target.classList.add("drag-over");
});
view.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!dragId) return;
  const { group, item } = findItem(dragId);
  const kcol = e.target.closest(".kcol-body");
  const gEl = e.target.closest(".group");
  if (kcol) item.status = kcol.dataset.status;
  else if (gEl) {
    const dest = board().groups.find((g) => g.id === gEl.dataset.group);
    const overRow = e.target.closest("[data-item]");
    group.items = group.items.filter((i) => i !== item);
    const idx = overRow ? dest.items.findIndex((i) => i.id === overRow.dataset.item) : dest.items.length;
    dest.items.splice(idx < 0 ? dest.items.length : idx, 0, item);
  }
  dragId = null;
  render();
});
view.addEventListener("dragend", () => { dragId = null; document.querySelectorAll(".drag-over").forEach((x) => x.classList.remove("drag-over")); });

render();
