import {universityData,workspaceProjects} from "../utils/university.js?v=65";
import { state } from "../services/store.js?v=65";
import { saveTask } from "../services/dataService.js?v=65";
import { openModal, bindForm, options } from "../utils/dom.js?v=65";
import { today } from "../utils/dates.js?v=65";
import { projectForm } from "./projects.js?v=65";

export function quickAdd(projectId, onSave, planForToday = false) {
  if (state.mode === "signed_out") {
    openModal(
      "Accesso richiesto",
      "<p>Accedi da Impostazioni per aggiungere attività al tuo workspace.</p>",
    );
    return;
  }
  const projects = workspaceProjects(state.projects, projectId).filter(p => p.status !== "archived");
  if (!projects.length) {
    openModal(
      "Crea il primo progetto",
      '<p>Le attività appartengono a un progetto. Aggiungine uno per iniziare.</p><div class="form-actions"><button class="btn primary" id="quick-first-project">Crea progetto</button></div>',
    );
    document.querySelector("#quick-first-project").onclick = () =>
      projectForm(null, onSave);
    return;
  }
  const selected = projects.some((project) => project.id === projectId)
    ? projectId
    : projects[0].id;
  openModal(
    "Aggiungi attività",
    `<form id="quick-add-form"><label class="field">Cosa devi fare?<input name="title" required maxlength="200" placeholder="Es. Correggere il menu su iPhone" autocomplete="off"></label><label class="field quick-project">${universityData(state.projects.find(p => p.id === projectId)) ? "Materia" : "Progetto"}<select name="project_id" required>${options(Object.fromEntries(projects.map((project) => [project.id, project.name])), selected)}</select></label><label class="quick-plan"><input name="plan_today" type="checkbox" ${planForToday ? "checked" : ""}>Pianifica per oggi</label><p class="subtext">Descrizione, checklist e scadenza si possono aggiungere dal dettaglio.</p><div class="form-actions"><span class="quick-shortcut">Invio per salvare</span><button class="btn primary" type="submit">Aggiungi attività</button></div><p class="form-error" role="alert"></p></form>`,
  );
  bindForm("quick-add-form", async (data) => {
    await saveTask({
      title: String(data.get("title")).trim(),
      project_id: String(data.get("project_id")),
      status: "todo",
      priority: "medium",
      type: universityData(state.projects.find(p=>p.id===String(data.get("project_id")))) ? "study" : "feature",
      description: "",
      notes: "",
      tags: [],
      checklist: [],
      start_date: null,
      due_date: null,
      planned_date: data.has("plan_today") ? today(state.timezone) : null,
      estimated_minutes: null,
      actual_minutes: null,
      github_url: null,
      github_issue_number: null,
      position: 0,
    });
    onSave();
  });
}
