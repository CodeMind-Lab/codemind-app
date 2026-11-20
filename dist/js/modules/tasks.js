import {compareChecklistTasks,checklistId} from "../utils/checklist.js?v=65";
import {universityData,workspaceProjects} from "../utils/university.js?v=65";
import { attachmentsSection, bindAttachments } from "./attachments.js?v=65";
import { state, projectOf, activeTasks } from "../services/store.js?v=65";
import { esc, statuses, priorities, types, uid, isOpenHighPriority } from "../utils/helpers.js?v=65";
import { dateLabel, today, shiftDate } from "../utils/dates.js?v=65";
import {
  options,
  field,
  openModal,
  bindForm,
  confirmDelete,
} from "../utils/dom.js?v=65";
import { saveTask, remove } from "../services/dataService.js?v=65";
export const filters = {
  project: "",
  status: "",
  priority: "",
  type: "",
  due: "",
  tag: "",
  sort: "",
};
export function filteredTasks(projectId) {
  const now = today(state.timezone);
  let tasks = projectId
    ? state.tasks.filter((t) => t.project_id === projectId)
    : activeTasks();
  tasks = tasks.filter(
    (t) =>
      (projectId || !filters.project || t.project_id === filters.project) &&
      (filters.status === "all" || (filters.status ? t.status === filters.status : !projectId || t.status !== "completed")) &&
      (!filters.priority || t.priority === filters.priority) &&
      (!filters.type || t.type === filters.type) &&
      (!filters.tag || (t.tags || []).includes(filters.tag)) &&
      (!filters.due ||
        (filters.due === "today"
          ? t.due_date === now
          : filters.due === "overdue"
            ? t.due_date && t.due_date < now && t.status !== "completed"
            : filters.due === "week"
              ? t.due_date >= now && t.due_date <= shiftDate(now, 7)
              : !t.due_date)),
  );
  const sort = filters.sort || (projectId ? "id" : "due");
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    if (sort === "id") return compareChecklistTasks(a, b);
    const order =
      sort === "priority"
        ? rank[a.priority] - rank[b.priority]
        : sort === "project"
          ? (projectOf(a.project_id)?.name || "").localeCompare(
              projectOf(b.project_id)?.name || "",
            )
          : sort === "created"
            ? String(b.created_at).localeCompare(String(a.created_at))
            : String(a.due_date || "9999").localeCompare(
                String(b.due_date || "9999"),
              );
    return order || a.id.localeCompare(b.id);
  });
}
export function filterBar(projectId) {
  const projectOptions = Object.fromEntries(
    state.projects
      .filter((p) => p.status !== "archived")
      .map((p) => [p.id, p.name]),
  );
  const tags = Object.fromEntries(
    [...new Set(activeTasks().flatMap((t) => t.tags || []))].map((t) => [t, t]),
  );
  return `<div class="filters">${!projectId ? `<select aria-label="Filtrer par projet" data-filter="project">${options(projectOptions, filters.project, "Tous")}</select>`.replace("Filtrer par projet", "Filtra per progetto").replace("Tous", "Progetti") : ""}<select aria-label="Filtra per stato" data-filter="status">${options(projectId ? {all:"Tutte", ...statuses} : statuses, filters.status, projectId ? "Da eseguire" : "Stato")}</select><select aria-label="Filtra per priorità" data-filter="priority">${options(priorities, filters.priority, "Priorità")}</select><select aria-label="Filtra per tipo" data-filter="type">${options(types, filters.type, "Tipo")}</select><select aria-label="Filtra per scadenza" data-filter="due">${options({ today: "Oggi", overdue: "Scadute", week: "Prossimi 7 giorni", none: "Senza scadenza" }, filters.due, "Scadenze")}</select><select aria-label="Filtra per tag" data-filter="tag">${options(tags, filters.tag, "Tag")}</select><select aria-label="Ordina attività" data-filter="sort">${options({ id: "Ordina: ID", due: "Ordina: scadenza", priority: "Ordina: priorità", created: "Ordina: creazione", project: "Ordina: progetto" }, filters.sort || (projectId ? "id" : "due"))}</select><button class="btn" data-action="reset-filters">Azzera</button></div>`;
}
export function taskRow(t) {
  const p = projectOf(t.project_id);
  return `<div class="task-row ${isOpenHighPriority(t) ? 'is-high-priority' : ''}"><button class="check-button ${t.status === "completed" ? "done" : ""}" data-complete="${t.id}" aria-label="${t.status === "completed" ? "Riapri" : "Completa"} ${esc(t.title)}">${t.status === "completed" ? "✓" : ""}</button><div class="task-content"><button class="task-title ${t.status === "completed" ? "done-title" : ""}" data-task="${t.id}">${esc(t.title)}</button><div class="task-meta"><span>${esc(p?.name)}</span><span class="badge ${t.priority}">${priorities[t.priority]}</span><span>${statuses[t.status]}</span>${t.checklist?.length ? `<span>☷ ${t.checklist.filter((c) => c.is_completed).length}/${t.checklist.length}</span>` : ""}</div></div><span class="due-date">${dateLabel(t.due_date, state.timezone)}</span></div>`;
}
export function taskTable(tasks, {completion = false} = {}) {
  return `<section class="panel table-wrap task-table-wrap"><table class="task-table"><thead><tr><th>Attività</th><th>Progetto</th><th>Stato</th><th>Priorità</th><th>Tipo</th><th>Scadenza</th></tr></thead><tbody>${tasks.map((t) => `<tr class="${isOpenHighPriority(t) ? 'is-high-priority' : ''}"><td data-label="Attività"><div class="task-name-with-check">${completion ? `<input type="checkbox" class="project-task-check" data-complete="${t.id}" aria-label="${t.status === "completed" ? "Riapri" : "Completa"} ${esc(t.title)}" ${t.status === "completed" ? "checked" : ""}>` : ""}<button class="task-title ${completion && t.status === "completed" ? "done-title" : ""}" data-task="${t.id}">${esc(t.title)}</button></div><div class="task-meta">${checklistId(t) ? `<span>ID: ${esc(checklistId(t))}</span>` : ""}${(t.tags || []).map((tag) => `<span>#${esc(tag)}</span>`).join("")}${t.checklist?.length ? ` · ${t.checklist.filter((c) => c.is_completed).length}/${t.checklist.length} checklist` : ""}</div></td><td data-label="Progetto">${esc(projectOf(t.project_id)?.name)}</td><td data-label="Stato"><select aria-label="Stato di ${esc(t.title)}" data-status="${t.id}">${options(statuses, t.status)}</select></td><td data-label="Priorità"><span class="badge ${t.priority}">${priorities[t.priority]}</span></td><td data-label="Tipo">${types[t.type]}</td><td data-label="Scadenza" class="nowrap">${dateLabel(t.due_date, state.timezone)}</td></tr>`).join("")}</tbody></table>${!tasks.length ? '<div class="empty">Nessuna attività corrisponde ai filtri.</div>' : ""}</section>`;
}
export function tasksPage() {
  return `<div class="page-heading"><div><h1>Attività</h1><p class="subtext">Gestisci stato, priorità e scadenze.</p></div><div class="heading-actions"><button class="btn" data-action="import-checklist">☷ Importa checklist</button><button class="btn" data-action="import-files">Allega file</button><button class="btn primary" data-action="new-task">＋ Nuova attività</button></div></div>${filterBar()}${taskTable(filteredTasks())}`;
}
export function taskForm(existing, projectId, onSave) {
  const t = existing || {
    project_id:
      projectId || workspaceProjects(state.projects)[0]?.id,
    status: "todo",
    priority: "medium",
    type: "feature",
  };
  if (!t.project_id) {
    openModal(
      "Prima crea un progetto",
      "<p>Ogni attività appartiene a un progetto. Crea il primo dalla sezione Progetti.</p>",
    );
    return;
  }
  let checklist = structuredClone(t.checklist || []);
  openModal(
    existing ? "Dettaglio attività" : "Nuova attività",
    `<form id="task-form"><div class="form-grid"><label class="field full">Titolo *<input name="title" value="${esc(t.title)}" required maxlength="200"></label>${checklistId(t) ? `<label class="field full">ID checklist<input value="${esc(checklistId(t))}" readonly></label>` : ""}<label class="field full">Descrizione<textarea name="description">${esc(checklistId(t) ? String(t.description || "").replace(/^ID:[^\n]*\n?/im, "") : t.description)}</textarea></label><label class="field">${universityData(projectOf(t.project_id)) ? "Materia" : "Progetto"} *<select name="project_id" required>${options(Object.fromEntries(workspaceProjects(state.projects, t.project_id).map((p) => [p.id, p.name])), t.project_id)}</select></label><label class="field">Stato<select name="status">${options(statuses, t.status)}</select></label><label class="field">Priorità<select name="priority">${options(priorities, t.priority)}</select></label><label class="field">Tipo<select name="type">${options(types, t.type)}</select></label>${field("Data inizio", "start_date", t.start_date, "date")}${field("Pianificata per", "planned_date", t.planned_date, "date")}${field("Scadenza", "due_date", t.due_date, "date")}${field("Stima (minuti)", "estimated_minutes", t.estimated_minutes, "number", 'min="0" step="1"')}${field("Tempo effettivo (minuti)", "actual_minutes", t.actual_minutes, "number", 'min="0" step="1"')}${field("Tag (separati da virgole)", "tags", (t.tags || []).join(", "))}${field("Link GitHub", "github_url", t.github_url, "url")}${field("Numero issue GitHub", "github_issue_number", t.github_issue_number, "number", 'min="1" step="1"')}<div class="field full"><span>Checklist</span><div id="checklist-items"></div><div class="checklist-edit"><input id="checklist-title" aria-label="Nuovo elemento checklist" placeholder="Aggiungi un passaggio…"><button class="btn" type="button" id="add-checklist">＋</button></div></div><label class="field full">Note<textarea name="notes">${esc(t.notes)}</textarea></label></div><div class="form-actions">${existing ? '<button class="btn danger" type="button" id="delete-task">Elimina</button>' : ""}<button class="btn primary" type="submit">Salva attività</button></div><p class="form-error" role="alert"></p></form>${existing ? attachmentsSection(existing.project_id, existing.id) : '<p class="subtext">Salva l’attività per allegare file e checklist.</p>'}`,
  );
  bindAttachments(document.querySelector("#modal"));
  function renderChecklist() {
    document.querySelector("#checklist-items").innerHTML =
      `<p class="checklist-count">${checklist.filter((c) => c.is_completed).length} / ${checklist.length} completate</p>` +
      checklist
        .map(
          (c, i) =>
            `<div class="checklist-edit"><input type="checkbox" aria-label="Completa ${esc(c.title)}" data-check="${i}" ${c.is_completed ? "checked" : ""}><input type="text" value="${esc(c.title)}" aria-label="Titolo elemento ${i + 1}" data-check-title="${i}" required><button class="icon-btn" type="button" data-remove-check="${i}" aria-label="Rimuovi elemento">×</button></div>`,
        )
        .join("");
    document.querySelectorAll("[data-check]").forEach(
      (el) =>
        (el.onchange = () => {
          checklist[el.dataset.check].is_completed = el.checked;
          document.querySelector(".checklist-count").textContent =
            `${checklist.filter((c) => c.is_completed).length} / ${checklist.length} completate`;
        }),
    );
    document
      .querySelectorAll("[data-check-title]")
      .forEach(
        (el) =>
          (el.oninput = () =>
            (checklist[el.dataset.checkTitle].title = el.value)),
      );
    document.querySelectorAll("[data-remove-check]").forEach(
      (el) =>
        (el.onclick = () => {
          checklist.splice(Number(el.dataset.removeCheck), 1);
          renderChecklist();
        }),
    );
  }
  renderChecklist();
  document.querySelector("#add-checklist").onclick = () => {
    const input = document.querySelector("#checklist-title");
    if (input.value.trim()) {
      checklist.push({
        id: uid(),
        title: input.value.trim(),
        is_completed: false,
      });
      input.value = "";
      renderChecklist();
      input.focus();
    }
  };
  document.querySelector("#checklist-title").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector("#add-checklist").click();
    }
  };
  bindForm("task-form", async (data) => {
    const value = Object.fromEntries(data);
    if (existing && checklistId(existing)) value.description = `ID: ${checklistId(existing)}\n${String(value.description || "").replace(/^ID:[^\n]*\n?/gim, "")}`;
    ["start_date", "planned_date", "due_date", "github_url"].forEach(
      (k) => (value[k] = value[k] || null),
    );
    ["estimated_minutes", "actual_minutes", "github_issue_number"].forEach(
      (k) => (value[k] = value[k] ? Number(value[k]) : null),
    );
    value.tags = [
      ...new Set(
        String(value.tags)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
    value.checklist = checklist.map((c, i) => ({
      ...c,
      title: c.title.trim(),
      position: i,
    }));
    if (value.checklist.some((c) => !c.title))
      throw Error("Ogni elemento checklist deve avere un titolo.");
    value.position = existing?.position || 0;
    await saveTask(value, existing);
    onSave();
  });
  if (existing)
    document.querySelector("#delete-task").onclick = () =>
      confirmDelete(
        `Eliminare definitivamente “${existing.title}”?`,
        async () => {
          await remove("tasks", existing.id);
          onSave();
        },
      );
}
