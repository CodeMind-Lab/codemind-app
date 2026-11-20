import { loadForma } from './formaService.js?v=65';
import { loadSport } from './sportService.js?v=65';
import { universityData } from "../utils/university.js?v=65";
import { listAttachments } from './attachmentsService.js?v=65';
import { loadAgenda, importLegacyWorkShifts } from "./agendaService.js?v=65";
import { loadLavoro } from "./lavoroService.js?v=70";
import { state } from "./store.js?v=65";
import { getClient, unwrap, readAll } from "./supabase.js?v=65";
import { uid, safeURL, statuses } from "../utils/helpers.js?v=65";
const todoDateFromStorage = (date) => date === "9999-12-31" ? null : date;
export async function loadCloud() {
  const c = await getClient(),
    s = unwrap(await c.auth.getSession())?.session;
  if (!s) throw Error("Accedi per caricare i tuoi dati.");
  const [projects, tasks, profiles, dailyTodos, notes] =
    await Promise.all([
      readAll("projects"),
      readAll("tasks", "*,task_checklist_items(*),task_tags(tags(name))"),
      c.from("profiles").select("*").eq("id", s.user.id).single(),
      readAll("daily_todos"),
      readAll("notes"),
    ]);
  const profile = unwrap(profiles);
  state.dailyTodos = dailyTodos.map(item => ({ ...item, todo_date: todoDateFromStorage(item.todo_date) }));
  state.notes = notes;
  state.projects = projects;
  state.tasks = tasks.map((t) => ({
    ...t,
    checklist: t.task_checklist_items.sort((a, b) => a.position - b.position),
    tags: t.task_tags.map((x) => x.tags.name),
  }));
  state.timezone = profile.timezone;
  state.user = s.user;
  state.profile = profile;
  state.mode = "cloud";
  await Promise.all([loadAgenda(),loadSport(),loadForma(),loadLavoro()]);
  await importLegacyWorkShifts();
  state.loaded = true;
}
function validateDates(value) {
  if (value.start_date && value.due_date && value.start_date > value.due_date)
    throw Error("La scadenza non può precedere la data di inizio.");
  for (const name of ["github_url", "project_url"])
    if (value[name] && !safeURL(value[name]))
      throw Error("Inserisci un URL completo http o https.");
}
export async function saveProject(value, existing) {
  assertWritable();
  validateDates(value);
  if (!value.name.trim()) throw Error("Inserisci il nome del progetto.");
  const now = new Date().toISOString();
  if (state.mode === "cloud") {
    const c = await getClient(),
      payload = {
        ...value,
        user_id: state.user.id,
        archived_at: value.status === "archived" ? now : null,
      };
    const query = existing
      ? c
          .from("projects")
          .update(payload)
          .eq("id", existing.id)
          .eq("updated_at", existing.updated_at)
          .select()
      : c.from("projects").insert(payload).select();
    const result = unwrap(await query);
    if (!result.length)
      throw Error(
        "Il progetto è cambiato su un altro dispositivo. Ricarica prima di salvare.",
      );
    await loadCloud();
  } else {
    const p = {
      ...existing,
      ...value,
      id: existing?.id || uid(),
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    if (existing)
      state.projects = state.projects.map((x) => (x.id === p.id ? p : x));
    else state.projects.push(p);
  }
}
export async function saveTask(value, existing) {
  assertWritable();
  validateDates(value);
  if (!value.title.trim()) throw Error("Inserisci il titolo dell’attività.");
  if (!state.projects.some((p) => p.id === value.project_id))
    throw Error("Seleziona un progetto valido.");
  const now = new Date().toISOString();
  if (state.mode === "cloud") {
    const c = await getClient();
    unwrap(
      await c.rpc("save_task", {
        payload: { ...value, id: existing?.id || uid() },
        expected_updated_at: existing?.updated_at || null,
      }),
    );
    await loadCloud();
  } else {
    const t = {
      ...existing,
      ...value,
      id: existing?.id || uid(),
      position: existing?.position || 0,
      created_at: existing?.created_at || now,
      updated_at: now,
      completed_at:
        value.status === "completed" ? existing?.completed_at || now : null,
    };
    if (existing) state.tasks = state.tasks.map((x) => (x.id === t.id ? t : x));
    else state.tasks.push(t);
  }
}
export async function setTaskStatus(id, status) {
  const existing = state.tasks.find((t) => t.id === id);
  if (!existing || !Object.hasOwn(statuses, status))
    throw Error("Attività o stato non valido.");
  await saveTask({ ...taskPayload(existing), status }, existing);
}
export function taskPayload(t) {
  const fields = [
    "title",
    "description",
    "project_id",
    "status",
    "priority",
    "type",
    "start_date",
    "planned_date",
    "due_date",
    "estimated_minutes",
    "actual_minutes",
    "notes",
    "github_url",
    "github_issue_number",
    "position",
  ];
  return {
    ...Object.fromEntries(fields.map((k) => [k, t[k] ?? null])),
    tags: t.tags || [],
    checklist: t.checklist || [],
  };
}
export async function remove(kind, id) {
  assertWritable();
  if (state.mode === "cloud") {
    const c = await getClient();
    if (kind === "projects") {
      let files;
      try { files = await listAttachments(id); }
      catch (e) { if (!e.message.includes('Archivio allegati non attivo')) throw e; }
      if (files?.length) throw Error('Elimina prima gli allegati del progetto, oppure archivia il progetto per conservarli.');
    }
    unwrap(await c.from(kind).delete().eq("id", id));
    await loadCloud();
  } else {
    state[kind] = state[kind].filter((x) => x.id !== id);
    if (kind === "projects") {
      state.tasks = state.tasks.filter((t) => t.project_id !== id);
      for (const key of ["scheduleEntries", "weeklyGoals"]) state[key] = state[key].map(item => item.project_id === id ? {...item, project_id:null} : item);
    }
    state.dailyFocus = (state.dailyFocus || []).filter((item) =>
      state.tasks.some((task) => task.id === item.task_id),
    );
  }
}
export async function updateProfile(values) {
  if (state.mode === "cloud") {
    unwrap(
      await (
        await getClient()
      )
        .from("profiles")
        .update(values)
        .eq("id", state.user.id),
    );
    state.profile = { ...state.profile, ...values };
  }
  if (values.timezone) state.timezone = values.timezone;
}

function assertWritable() {
  if (state.mode === "signed_out") throw Error("Accedi prima di salvare.");
  if (state.mode === "cloud" && !navigator.onLine)
    throw Error(
      "Sei offline. Riconnettiti per salvare: i campi compilati restano aperti.",
    );
}

export async function deleteProjectTasks(projectId, {confirmed = false} = {}) {
  if (confirmed !== true) throw Error('Conferma l’eliminazione di tutte le attività.');
  assertWritable();
  const project = state.projects.find(p => p.id === projectId);
  if (!project || universityData(project)) throw Error('Progetto non disponibile.');
  if (state.mode === 'cloud') {
    const client = await getClient();
    // A single scoped statement deletes all states; RLS and cascades remain active.
    unwrap(await client.from('tasks').delete().eq('project_id', projectId).eq('user_id', state.user.id));
    await loadCloud();
  } else {
    const deletedIds = new Set(state.tasks.filter(t => t.project_id === projectId).map(t => t.id));
    state.tasks = state.tasks.filter(t => t.project_id !== projectId);
    state.dailyFocus = (state.dailyFocus || []).filter(item => !deletedIds.has(item.task_id));
  }
}
