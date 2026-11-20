import {universityData,universityNotes} from "../utils/university.js?v=65";
import {subjectForm} from "./university.js?v=65";
import { state } from "../services/store.js?v=65";
import { projectCard } from "./dashboard.js?v=65";
import {
  esc,
  projectStatuses,
  safeURL,
  progress,
  projectIcon,
  projectPriorityMarker,
  isOpenHighPriority,
  validProjectIcon,
} from "../utils/helpers.js?v=65";
import {
  options,
  field,
  openModal,
  bindForm,
  confirmDelete,
  closeModal,
} from "../utils/dom.js?v=65";
import { saveProject, remove, deleteProjectTasks } from "../services/dataService.js?v=65";
export function projects(archived = false) {
  const list = state.projects.filter(
    (p) => !universityData(p) && (p.status === "archived") === archived,
  );
  return `<div class="page-heading"><div><h1>${archived ? "Archivio" : "Progetti"}</h1><p class="subtext">${list.length} progetti ${archived ? "archiviati" : "nel tuo workspace"}</p></div>${archived ? "" : '<div class="heading-actions"><button class="btn" data-action="import-checklist">☷ Importa checklist</button><button class="btn" data-action="import-files">Allega file</button><button class="btn primary" data-action="new-project">＋ Nuovo progetto</button></div>'}</div><div class="projects-grid">${list.map(projectCard).join("") || '<div class="panel empty">Nessun progetto presente.</div>'}</div>`;
}
export function projectHeading(p) {
  const tasks = state.tasks.filter((t) => t.project_id === p.id);
  const high = tasks.filter(isOpenHighPriority);
  const alert = high.length ? `<section class="project-priority-alert" aria-label="Attività ad alta priorità"><div>${projectPriorityMarker(tasks)}<strong>${high.length} attività ad alta priorità da completare</strong></div><div class="project-priority-preview">${high.slice(0,3).map(task => `<button class="task-title" data-task="${task.id}">${esc(task.title)}</button>`).join('')}${high.length > 3 ? `<span>+${high.length - 3} altre</span>` : ''}</div></section>` : '';
  return `<div class="page-heading"><div><a class="link" href="#/projects">← Progetti</a><div class="project-heading-title"><h1 style="margin-top:12px">${esc(p.name)}</h1>${projectPriorityMarker(tasks)}</div><p class="subtext">${projectStatuses[p.status]} · ${progress(tasks)}% completato</p></div><div class="heading-actions"><button class="btn" data-action="import-checklist" data-project="${p.id}">☷ Importa checklist</button><button class="btn" data-action="import-files" data-project="${p.id}">Allega file</button><button class="btn" data-edit-project="${p.id}">Modifica progetto</button><button class="btn danger" data-delete-project-tasks="${p.id}" ${!tasks.length ? "disabled" : ""}>Elimina tutto</button><button class="btn primary" data-action="new-task" data-project="${p.id}">＋ Nuova attività</button></div></div>${alert}${universityData(p)?`<p><a class="link" href="#/university/${p.id}">Apri scheda universitaria, CFU e voto →</a></p>`:""}<p class="detail-description">${esc(p.description)}</p><div class="project-links">${[
    ["github_url", "Repository GitHub ↗"],
    ["project_url", "Apri progetto ↗"],
  ]
    .map(([key, label]) =>
      safeURL(p[key])
        ? `<a class="link" target="_blank" rel="noopener" href="${esc(safeURL(p[key]))}">${label}</a>`
        : "",
    )
    .join(
      "",
    )}</div>${p.notes ? `<p class="subtext" style="white-space:pre-wrap;margin-bottom:20px">${esc(universityNotes(p))}</p>` : ""}`;
}
export function projectForm(existing, onSave) {
  if (universityData(existing)) return subjectForm(existing,onSave);
  const p = existing || { status: "active", color: "#0d7191" };
  openModal(
    existing ? "Modifica progetto" : "Nuovo progetto",
    `<form id="project-form"><div class="form-grid">${field("Nome *", "name", p.name, "text", 'required maxlength="120"')}${field("Colore", "color", p.color, "color")}<label class="field full">Descrizione<textarea name="description" maxlength="2000">${esc(p.description)}</textarea></label><label class="field">Stato<select name="status">${options(projectStatuses, p.status)}</select></label>${state.lavoroError ? "" : `<label class="field">Cliente<select name="cliente_id"><option value="">Nessuno</option>${state.clienti.filter(c => !c.archiviato || c.id === p.cliente_id).sort((a, b) => a.nome.localeCompare(b.nome)).map(c => `<option value="${esc(c.id)}" ${c.id === p.cliente_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>`}<div class="field full"><label for="project-icon-file">Icona del progetto</label><div class="project-icon-picker"><span class="project-icon" id="project-icon-preview">${projectIcon(p)}</span><input id="project-icon-file" type="file" accept=".ico,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"><button class="btn" type="button" id="remove-project-icon">Rimuovi icona</button></div><p class="subtext">Favicon ICO, PNG, JPG o WebP · massimo 1 MB. L’icona viene adattata a 64 × 64 px.</p><p id="project-icon-error" class="form-error" role="alert"></p></div>${field("Data inizio", "start_date", p.start_date, "date")}${field("Scadenza", "due_date", p.due_date, "date")}${field("Repository GitHub", "github_url", p.github_url, "url")}${field("URL progetto", "project_url", p.project_url, "url")}<label class="field full">Note<textarea name="notes">${esc(universityNotes(p))}</textarea></label></div><div class="form-actions">${existing ? '<button class="btn danger" type="button" id="delete-project">Elimina</button>' : ""}<button class="btn primary" type="submit">Salva progetto</button></div><p class="form-error" role="alert"></p></form>`,
  );
  let selectedIcon = validProjectIcon(p.icon) ? p.icon : null;
  let readingIcon = false;
  const form = document.querySelector("#project-form");
  const input = document.querySelector("#project-icon-file");
  const preview = document.querySelector("#project-icon-preview");
  const error = document.querySelector("#project-icon-error");
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    error.textContent = "";
    readingIcon = true;
    try {
      if (file.size > 1024 * 1024)
        throw Error("Scegli un file di massimo 1 MB.");
      if (!/\.(ico|png|jpe?g|webp)$/i.test(file.name))
        throw Error("Scegli un file ICO, PNG, JPG o WebP.");
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () =>
            reject(Error("Il file non è un’immagine supportata."));
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ratio = Math.min(64 / image.width, 64 / image.height);
        canvas
          .getContext("2d")
          .drawImage(
            image,
            (64 - image.width * ratio) / 2,
            (64 - image.height * ratio) / 2,
            image.width * ratio,
            image.height * ratio,
          );
        selectedIcon = canvas.toDataURL("image/png");
        preview.innerHTML = projectIcon({ ...p, icon: selectedIcon });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      error.textContent = e.message;
      input.value = "";
    } finally {
      readingIcon = false;
    }
  };
  document.querySelector("#remove-project-icon").onclick = () => {
    selectedIcon = null;
    input.value = "";
    preview.innerHTML = projectIcon({ ...p, icon: null });
    error.textContent = "";
  };
  bindForm("project-form", async (data) => {
    if (readingIcon) throw Error("Attendi il caricamento dell’icona.");
    const v = Object.fromEntries(data);
    for (const k of Object.keys(v)) if (!v[k]) v[k] = null;
    v.name = String(data.get("name")).trim();
    v.icon = selectedIcon;
    await saveProject(v, existing);
    onSave();
  });
  if (existing)
    document.querySelector("#delete-project").onclick = () =>
      confirmDelete(
        `Eliminare “${existing.name}” e tutte le sue ${state.tasks.filter((t) => t.project_id === existing.id).length} attività? L’operazione è definitiva.`,
        async () => {
          await remove("projects", existing.id);
          location.hash = "#/projects";
          onSave();
        },
      );
}

export function confirmRemoveProjectTasks(project, onSave) {
  if (!project || universityData(project)) return;
  const tasks = state.tasks.filter(t => t.project_id === project.id);
  if (!tasks.length) return;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const mode = state.mode, owner = state.user?.id;
  openModal('Elimina tutte le attività', `<form id="delete-project-tasks-form"><p>Stai per eliminare definitivamente tutte le <strong>${tasks.length} attività</strong> di <strong>${esc(project.name)}</strong>: ${completed} completate e ${tasks.length - completed} da eseguire, comprese le relative checklist. Il progetto e i file allegati restano disponibili.</p><label class="bulk-delete-accept"><input type="checkbox" name="accepted" id="accept-delete-project-tasks" required>Accetto di eliminare tutte le attività di questo progetto. L’operazione è definitiva.</label><div class="form-actions"><button class="btn" type="button" id="cancel-delete-project-tasks">Annulla</button><button class="btn danger" type="submit" disabled>Elimina tutte le attività</button></div><p class="form-error" role="alert"></p></form>`);
  const form = document.querySelector('#delete-project-tasks-form');
  const accept = form.querySelector('[name="accepted"]');
  const submit = form.querySelector('[type="submit"]');
  let busy = false;
  accept.onchange = () => { submit.disabled = busy || !accept.checked; };
  document.querySelector('#cancel-delete-project-tasks').onclick = () => { if (!busy) closeModal(); };
  bindForm('delete-project-tasks-form', async data => {
    if (!data.has('accepted')) throw Error('Accetta l’eliminazione prima di continuare.');
    if (state.mode !== mode || state.user?.id !== owner) throw Error('Il workspace è cambiato. Riapri la conferma.');
    busy = true;
    accept.disabled = true;
    try { await deleteProjectTasks(project.id, {confirmed:true}); onSave(); }
    finally { busy = false; accept.disabled = false; }
  });
}
