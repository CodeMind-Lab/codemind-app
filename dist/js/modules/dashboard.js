import { sportDashboardPanel } from './sport.js?v=65';
import {dashboardAgendaGoals,activeTimerPanel} from './agendaProductivity.js?v=65';
import { universityData } from "../utils/university.js?v=65";
import { agendaSummaryLink, agendaTodayPanel, bindAgendaPreview, agendaWeeklyChart, openWorkWeek } from './agenda.js?v=68';
import { weeklyShifts, bindWeeklyShifts } from './shifts.js?v=65';
import { favoriteIds, toggleFavorite, todayItems, saveCapture, dashboardOwner } from "../services/dashboardService.js?v=65";
import { state, activeTasks } from "../services/store.js?v=65";
import {
  esc,
  progress,
  projectStatuses,
  statuses,
  icon,
  projectIcon,
  projectPriorityMarker,
  isOpenHighPriority,
} from "../utils/helpers.js?v=65";
import { saveDailyTodo } from "../services/notebookService.js?v=65";
import { longDate, dateLabel, today, shiftDate } from "../utils/dates.js?v=65";
export function projectCard(p) {
  const tasks = state.tasks.filter((t) => t.project_id === p.id);
  const value = progress(tasks);
  return `<a class="project-card" href="#/projects/${p.id}" style="--project-color:${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#0d7191"}"><div class="project-card-top"><span class="project-icon">${projectIcon(p)}${projectPriorityMarker(tasks)}</span><span class="badge ${p.status}">${projectStatuses[p.status]}</span></div><h3 class="project-title">${esc(p.name)}</h3><p class="project-desc">${esc(p.description || "Nessuna descrizione")}</p><div class="progress-label"><span>${tasks.filter((t) => t.status === "completed").length} di ${tasks.length} attività</span><span>${value}%</span></div><div class="progress-track" role="progressbar" aria-label="Avanzamento ${esc(p.name)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%"></span></div><div class="project-meta"><span>☷ ${tasks.length} attività</span><span>${dateLabel(p.due_date, state.timezone)}</span></div></a>`;
}
export function metrics(items) {
  return `<div class="metric-grid">${items.map(([label, value, foot, name, percentage]) => `<div class="panel metric"><div class="metric-top"><span>${label}</span><span class="metric-icon" style="font-size:16px">${icon(name)}</span></div><div class="metric-number">${value}</div><div class="metric-foot">${foot}</div>${Number.isFinite(percentage) ? `<div class="metric-completion-track" role="progressbar" aria-label="Avanzamento attività" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percentage}%"></span></div>` : ''}</div>`).join("")}</div>`;
}
function projectOverviewRow(project) {
  const tasks = state.tasks.filter((task) => task.project_id === project.id);
  const completed = tasks.filter((task) => task.status === "completed").length;
  const value = progress(tasks);
  const color = /^#[0-9a-f]{6}$/i.test(project.color)
    ? project.color
    : "#0d7191";
  return `<tr data-dashboard-project data-name="${esc(project.name.toLocaleLowerCase("it"))}" data-project-status="${esc(project.status)}"><td><a class="overview-project" href="#/projects/${project.id}" style="--project-color:${color}"><span class="project-icon">${projectIcon(project)}${projectPriorityMarker(tasks)}</span><span><strong>${esc(project.name)}</strong><small>${esc(project.description || "Nessuna descrizione")}</small></span></a></td><td data-label="Stato"><span class="badge ${project.status}">${projectStatuses[project.status]}</span></td><td data-label="Avanzamento"><div class="overview-progress"><span>${value}%</span><div class="progress-track" role="progressbar" aria-label="Avanzamento ${esc(project.name)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="width:${value}%;background:${color}"></span></div><small>${completed}/${tasks.length} attività</small></div></td><td class="overview-date" data-label="Scadenza">${dateLabel(project.due_date, state.timezone)}</td><td><div class="project-fast-actions">${favoriteButton(project)}<button class="btn" data-action="new-task" data-project="${project.id}" aria-label="Aggiungi attività a ${esc(project.name)}">＋ Attività</button><button class="icon-btn" data-edit-project="${project.id}" aria-label="Modifica ${esc(project.name)}">✎</button></div></td></tr>`;
}

function deadlineRow(task) {
  const project = state.projects.find(
    (project) => project.id === task.project_id,
  );
  return `<div class="deadline-row"><button class="check-button" data-complete="${task.id}" aria-label="Completa ${esc(task.title)}"></button><div><button class="task-title" data-task="${task.id}">${esc(task.title)}</button><span class="deadline-project">${esc(project?.name)}</span></div><time datetime="${task.due_date}">${dateLabel(task.due_date, state.timezone)}</time></div>`;
}

function highPriorityPanel(projects) {
  const byProject = new Map(projects.map(project => [project.id, project]));
  const tasks = state.tasks.filter(task => isOpenHighPriority(task) && byProject.has(task.project_id))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.title.localeCompare(b.title, 'it') || a.id.localeCompare(b.id));
  const row = task => `<div class="high-priority-row" data-high-priority-task="${task.id}"><button class="check-button" data-complete="${task.id}" aria-label="Completa ${esc(task.title)}"></button><div class="high-priority-content"><button class="task-title" data-task="${task.id}">${esc(task.title)}</button><div class="high-priority-meta"><a href="#/projects/${task.project_id}">${esc(byProject.get(task.project_id).name)}</a><span>${statuses[task.status]}</span>${task.due_date ? `<time datetime="${task.due_date}">${dateLabel(task.due_date, state.timezone)}</time>` : ''}</div></div><span class="badge high">Alta</span></div>`;
  return `<section class="panel high-priority-panel" aria-labelledby="high-priority-title"><div class="panel-head"><div class="section-title"><h2 id="high-priority-title">Attività ad alta priorità</h2><span class="count-label">${tasks.length}</span></div></div><div class="high-priority-body">${tasks.length ? tasks.slice(0, 6).map(row).join('') + (tasks.length > 6 ? `<details class="high-priority-more"><summary>Altre ${tasks.length - 6} attività ad alta priorità</summary>${tasks.slice(6).map(row).join('')}</details>` : '') : '<p class="high-priority-empty">Nessuna attività con priorità alta da completare.</p>'}</div></section>`;
}

export function dashboard() {
  const tasks = activeTasks();
  const open = tasks.filter((task) => task.status !== "completed");
  const completed = tasks.length - open.length;
  const value = progress(tasks);
  const now = today(state.timezone);
  const projects = state.projects.filter(
    (project) => project.status !== "archived" && !universityData(project),
  );
  const overdue = open.filter((task) => task.due_date && task.due_date < now);
  const urgent = open.filter((task) => task.priority === "urgent");
  const dueToday = open.filter(
    (task) => task.due_date === now || task.planned_date === now,
  );
  const due = open
    .filter((task) => task.due_date >= now)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4);
  const todos = state.dailyTodos.filter((item) => item.todo_date === now);
  const priorities = (state.dailyFocus || []).filter(item => item.focus_date === now)
    .sort((a,b) => a.slot - b.slot).map(item => tasks.find(task => task.id === item.task_id)).filter(Boolean).slice(0,3);
  const todoDone = todos.filter((item) => item.is_completed).length;
  const notes = [...state.notes]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);
  const recent = [...tasks]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 4);
  return `<div class="dashboard-professional">
    <div class="page-heading"><div><span class="page-eyebrow">WORKSPACE PERSONALE</span><h1>Il tuo workspace, a colpo d’occhio.</h1><p class="subtext">${longDate(state.timezone)}</p></div><div class="heading-actions"><button class="btn" data-action="new-project">＋ Nuovo progetto</button><button class="btn primary" data-action="new-task">＋ Nuova attività</button></div></div>
    ${weeklyShifts()}
    ${agendaSummaryLink()}
    ${activeTimerPanel()}
    <nav class="dashboard-shortcuts" aria-label="Accessi rapidi">
      <a class="dashboard-shortcut" href="#/projects"><span class="dashboard-shortcut-icon" aria-hidden="true">${icon("projects")}</span><span class="dashboard-shortcut-copy"><strong>Progetti</strong><small>${projects.length} nel workspace</small></span></a>
      <a class="dashboard-shortcut" href="#/notes"><span class="dashboard-shortcut-icon" aria-hidden="true">${icon("notes")}</span><span class="dashboard-shortcut-copy"><strong>Note</strong><small>${state.notes.length} appunti salvati</small></span></a>
      <a class="dashboard-shortcut" href="#/daily-todos"><span class="dashboard-shortcut-icon" aria-hidden="true">${icon("tasks")}</span><span class="dashboard-shortcut-copy"><strong>To do list</strong><small>${state.dailyTodos.filter(item => !item.is_completed).length} cose da completare</small></span></a>
      <a class="dashboard-shortcut" href="#/university"><span class="dashboard-shortcut-icon" aria-hidden="true">${icon("university")}</span><span class="dashboard-shortcut-copy"><strong>Università</strong><small>Materie ed esami</small></span></a>
    </nav>
    ${metrics([
      [
        "Progetti attivi",
        projects.filter((project) => project.status === "active").length,
        `${projects.length} progetti nel workspace`,
        "projects",
      ],
      [
        "Da fare",
        tasks.filter((task) => task.status === "todo").length,
        `${tasks.filter((task) => task.status === "backlog").length} nel backlog`,
        "tasks",
      ],
      [
        "In corso",
        tasks.filter((task) => task.status === "in_progress").length,
        `${tasks.filter((task) => task.status === "testing").length} altre attività in test`,
        "statistics",
      ],
      ["Completate", completed, `${value}% del totale`, "today", value],
    ])}
    ${dashboardAgendaGoals()}
    ${workspaceCharts(projects, tasks, value)}
    ${agendaWeeklyChart()}

    ${captureForm(projects)}
    <div class="dashboard-command">${todayPanel()}${favoritesPanel(projects)}</div>

    <div class="dashboard-personal">
      ${agendaTodayPanel()}
      <section class="panel personal-notes"><div class="panel-head"><h2>Note</h2><button class="link" data-action="new-note">＋ Nuova nota</button></div><div class="personal-body">${notes.length ? notes.map((note) => `<button class="dashboard-note" data-edit-note="${note.id}">${esc(note.title)}<span aria-hidden="true">↗</span></button>`).join("") : '<p class="personal-summary">Link e appunti, sempre a portata di mano.</p><p class="personal-excerpt">Incolla una risorsa o conserva un’idea.</p>'}</div><a class="personal-footer" href="#/notes">Tutte le note (${state.notes.length}) →</a></section>
    </div>
    <div class="dashboard-workspace">
      <div class="dashboard-primary">
        <section class="panel portfolio-panel" id="project-overview"><div class="panel-head"><div class="section-title"><h2>Panoramica progetti</h2><span class="count-label">${projects.length}</span></div><a class="link" href="#/projects">Tutti i progetti <span aria-hidden="true">→</span></a></div>
        <div class="dashboard-project-tools"><label><span class="sr-only">Cerca progetto</span><input id="dashboard-project-search" type="search" placeholder="Cerca un progetto…"></label><label><span class="sr-only">Filtra stato progetto</span><select id="dashboard-project-status"><option value="">Tutti gli stati</option value="active">Attivi</option><option value="planned">Pianificati</option><option value="paused">In pausa</option><option value="completed">Completati</option></select></label><span id="dashboard-project-count" role="status">${projects.length} progetti</span></div>
        <div class="table-wrap"><table class="portfolio-table"><thead><tr><th>Progetto</th><th>Stato</th><th>Avanzamento</th><th>Scadenza</th><th>Azioni</th></tr></thead><tbody>${projects.map(projectOverviewRow).join("")}</tbody></table><div id="dashboard-project-empty" class="empty" hidden>Nessun progetto corrisponde alla ricerca.</div>${!projects.length ? '<div class="empty">Crea il tuo primo progetto per iniziare.</div>' : ""}</div>
        <div class="portfolio-summary"><span><strong>${completed}</strong> attività completate su ${tasks.length}</span><span>Avanzamento totale <strong>${value}%</strong></span></div></section>
        ${highPriorityPanel(projects)}
        <details class="panel recent-panel dashboard-fold" data-dashboard-fold="recent"><summary>Attività recenti <span>Mostra / nascondi</span></summary><div class="panel-head"><a class="link" href="#/tasks">Tutte le attività →</a></div>${recent.map((task) => `<div class="recent-row"><span class="recent-marker ${task.status === "completed" ? "is-complete" : ""}">${task.status === "completed" ? "✓" : "·"}</span><button class="task-title" data-task="${task.id}">${esc(task.title)}</button><span class="recent-project">${esc(state.projects.find((project) => project.id === task.project_id)?.name)}</span></div>`).join("") || '<div class="empty">Nessuna attività presente.</div>'}</details>
      </div>
      <aside class="dashboard-secondary" aria-label="Priorità e scadenze">
        ${sportDashboardPanel()}
        <section class="panel focus-panel"><div class="panel-head"><h2>Da tenere d’occhio</h2><span class="focus-indicator" aria-hidden="true"></span></div><a href="#/tasks" class="focus-row"><span>Scadute</span><strong class="${overdue.length ? "attention-number" : ""}">${overdue.length}</strong><span aria-hidden="true">→</span></a><a href="#/tasks" class="focus-row"><span>Priorità urgente</span><strong>${urgent.length}</strong><span aria-hidden="true">→</span></a><a href="#/tasks" class="focus-row"><span title="Attività con scadenza o pianificazione oggi, contate una sola volta">In programma oggi</span><strong>${dueToday.length}</strong><span aria-hidden="true">→</span></a><div class="focus-footer"><a class="link" href="#/tasks">Apri attività →</a></div></section>
        <section class="panel deadlines-panel"><div class="panel-head"><h2>Prossime scadenze</h2><a class="calendar-shortcut" href="#/tasks" aria-label="Apri attività">${icon("calendar")}</a></div>${due.map(deadlineRow).join("") || '<div class="empty">Nessuna scadenza in programma.</div>'}<a class="deadline-footer" href="#/tasks">Visualizza attività <span aria-hidden="true">→</span></a></section>
      </aside>
    </div>


  </div>`;
}


function workspaceCharts(projects, tasks, total) {
  const shown = projects.slice(0, 8);
  const completion = shown.map(p => ({name:p.name, value:progress(tasks.filter(t => t.project_id === p.id))}));
  const statuses = [['todo','Da fare'],['in_progress','In corso'],['testing','In test'],['completed','Completate'],['backlog','Backlog']];
  const counts = statuses.map(([key,label]) => ({label,count:tasks.filter(t => t.status === key).length}));
  const max = Math.max(1,...counts.map(x => x.count));
  return `<div class="workspace-charts"><section class="panel completion-panel"><div class="panel-head"><div><h2>Avanzamento progetti</h2><p class="subtext">Attività completate per progetto</p></div><a class="link" href="#/statistics">Statistiche ↗</a></div><div class="completion-content">${completion.length ? `<div class="completion-chart" role="img" aria-label="${esc(completion.map(x => x.name+': '+x.value+'%').join(', '))}"><div class="chart-grid" aria-hidden="true"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div class="completion-bars">${completion.map((x,i) => `<div class="completion-column"><div class="completion-track"><div class="completion-fill ${i === 0 ? 'highlight' : ''}" style="height:${x.value}%"></div><span class="completion-value">${x.value}%</span></div><span class="completion-label" title="${esc(x.name)}">${esc(x.name)}</span></div>`).join('')}</div></div>` : '<div class="empty">Il grafico apparirà quando creerai un progetto.</div>'}</div></section><section class="panel activity-panel"><div class="panel-head"><div><h2>Attività del workspace</h2><p class="subtext">Distribuzione per stato</p></div><span class="badge">${tasks.length} attività</span></div><div class="activity-content"><div class="workspace-ring" style="--completion:${total}%" role="img" aria-label="Avanzamento totale: ${total}%"><div><strong>${total}%</strong><span>completato</span></div></div><div class="activity-legend">${counts.map((x,i) => `<div class="activity-line"><span class="activity-dot dot-${i}"></span><span>${x.label}</span><strong>${x.count}</strong><div class="activity-track"><span class="dot-${i}" style="width:${x.count/max*100}%"></span></div></div>`).join('')}</div></div></section></div>`;
}

export function bindDashboard(render, toast) {
  const search = document.querySelector("#dashboard-project-search");
  if (!search) return;
  const status = document.querySelector("#dashboard-project-status");
  const filter = () => {
    let count = 0;
    document.querySelectorAll("[data-dashboard-project]").forEach(row => {
      row.hidden = !row.dataset.name.includes(search.value.trim().toLocaleLowerCase("it")) || !!(status.value && row.dataset.projectStatus !== status.value);
      if (!row.hidden) count++;
    });
    document.querySelector("#dashboard-project-count").textContent = `${count} ${count === 1 ? "progetto" : "progetti"}`;
    document.querySelector("#dashboard-project-empty").hidden = count !== 0 || !state.projects.some(p => p.status !== "archived" && !universityData(p));
  };
  bindWeeklyShifts(render, toast, start => openWorkWeek(render, start));
  bindAgendaPreview(render);
  bindCommand(render, toast);
  search.oninput = filter;
  status.onchange = filter;
  document.querySelectorAll("[data-dashboard-todo]").forEach(button => {
    button.onclick = async () => {
      const item = state.dailyTodos.find(x => x.id === button.dataset.dashboardTodo);
      if (!item || button.disabled) return;
      button.disabled = true;
      try { await saveDailyTodo({...item, is_completed:true}, item); render(); toast("Cosa da fare completata"); }
      catch (error) { toast(error.message); button.disabled = false; }
    };
  });
}

const captureDrafts = new Map();
const captureBusy = new Set();
function captureDraft() {
  const key = dashboardOwner();
  if (!captureDrafts.has(key)) captureDrafts.set(key, {kind:'task',text:'',projectId:'',planToday:true});
  return captureDrafts.get(key);
}
if (typeof window !== 'undefined') window.addEventListener('beforeunload', e => {
  if ([...captureDrafts.values()].some(d => d.text.trim())) { e.preventDefault(); e.returnValue = ''; }
});
function captureForm(projects) {
  const d = captureDraft();
  return `<form id="capture-form" class="panel capture-form"><fieldset ${captureBusy.has(dashboardOwner()) ? 'disabled' : ''}><legend>Aggiungi al volo</legend><div class="capture-input"><label class="sr-only" for="capture-text">Cosa vuoi aggiungere?</label><textarea id="capture-text" name="text" rows="2" maxlength="30000" required placeholder="Un’attività, un’idea o un pensiero…">${esc(d.text)}</textarea><button class="btn primary" type="submit">Salva</button></div><div class="capture-options"><label>Salva come <select name="kind">${[['task','Attività'],['todo','To-do personale'],['note','Nota']].map(([v,l]) => `<option value="${v}" ${d.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label id="capture-project" ${d.kind !== 'task' ? 'hidden' : ''}>Progetto <select name="projectId"><option value="">Scegli un progetto</option>${projects.map(p => `<option value="${p.id}" ${d.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><label id="capture-plan" ${d.kind !== 'task' ? 'hidden' : ''}><input name="planToday" type="checkbox" ${d.planToday ? 'checked' : ''}> Per oggi</label><span id="capture-hint">⌘ / Ctrl + Invio per salvare</span></div><p class="form-error" role="alert"></p></fieldset></form>`;
}
function favoriteButton(p) {
  const selected = favoriteIds().includes(p.id);
  return `<button class="icon-btn favorite-toggle ${selected ? 'is-favorite' : ''}" data-favorite="${p.id}" aria-pressed="${selected}" aria-label="${selected ? 'Rimuovi dai' : 'Aggiungi ai'} preferiti: ${esc(p.name)}">${selected ? '★' : '☆'}</button>`;
}
function favoritesPanel(projects) {
  const ids = favoriteIds();
  return `<section class="panel favorite-panel"><div class="panel-head"><h2>Progetti preferiti</h2><span class="badge">${ids.length}/5</span></div><p class="favorite-hint">Fissati in questo browser con la stella.</p>${ids.map(id => {
    const p = projects.find(x => x.id === id);
    const next = state.tasks.filter(t => t.project_id === id && t.status !== 'completed').sort((a,b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || (a.position || 0)-(b.position || 0))[0];
    return `<article class="favorite-project"><div><a href="#/projects/${p.id}"><strong>${esc(p.name)}</strong>${projectPriorityMarker(state.tasks.filter(t => t.project_id === p.id))}</a>${favoriteButton(p)}</div><p>Scadenza: ${dateLabel(p.due_date,state.timezone)}</p>${next ? `<button class="task-title" data-task="${next.id}">${esc(next.title)}</button>` : '<p>Nessuna attività aperta.</p>'}<a class="link" href="#/projects/${p.id}">Apri progetto →</a></article>`;
  }).join('') || '<div class="empty">Fissa i progetti su cui lavori più spesso.<br><button class="link" id="choose-favorites">Scegli dalla panoramica ↓</button></div>'}</section>`;
}
function todayPanel() {
  const now = today(state.timezone), items = todayItems();
  const todos = state.dailyTodos.filter(t => t.todo_date === now && !t.is_completed);
  const focus = new Set((state.dailyFocus || []).filter(f => f.focus_date === now).map(f => f.task_id));
  return `<section class="panel command-today"><div class="panel-head"><h2>Attività di oggi</h2><a class="link" href="#/tasks">Organizza →</a></div><p class="today-summary">${items.length} attività · ${todos.length} to-do da completare</p><div class="today-scroll">${items.slice(0,6).map(t => `<div class="command-row"><button class="check-button" data-complete="${t.id}" aria-label="Completa ${esc(t.title)}"></button><div><button class="task-title" data-task="${t.id}">${esc(t.title)}</button><small>${esc(state.projects.find(p => p.id === t.project_id)?.name || '')} · ${focus.has(t.id) ? 'Priorità del giorno' : t.due_date && t.due_date < now ? 'Scaduta' : t.priority === 'urgent' ? 'Urgente' : 'In programma'}${t.due_date ? ' · '+dateLabel(t.due_date,state.timezone) : ''}</small></div></div>`).join('')}${!items.length ? '<p class="today-empty">Nessuna attività in programma. Aggiungine una qui sopra o organizzale nella sezione Attività.</p>' : ''}${items.length > 6 ? `<a class="personal-footer" href="#/tasks">Vedi tutte le ${items.length} attività →</a>` : ''}<h3 class="todo-section-title">To-do personali</h3>${todos.slice(0,4).map(t => `<div class="command-row"><button class="check-button" data-dashboard-todo="${t.id}" aria-label="Completa ${esc(t.title)}"></button><span>${esc(t.title)}</span></div>`).join('') || '<p class="today-empty">Nessun to-do aperto per oggi.</p>'}</div><a class="personal-footer" data-personal-today="daily-todos" href="#/daily-todos">Apri la lista personale →</a></section>`;
}
function bindCommand(render, toast) {
  document.querySelectorAll('[data-dashboard-fold]').forEach(el => {
    const key = `cm-dashboard-fold:${dashboardOwner()}:${el.dataset.dashboardFold}`;
    try { el.open = localStorage.getItem(key) === 'open'; } catch {}
    el.ontoggle = () => { try { localStorage.setItem(key,el.open ? 'open' : 'closed'); } catch {} };
  });
  const choose = document.querySelector("#choose-favorites");
  if (choose) choose.onclick = () => { document.querySelector("#project-overview").scrollIntoView({block:"start"}); document.querySelector("#dashboard-project-search").focus({preventScroll:true}); };
  document.querySelectorAll('[data-favorite]').forEach(b => b.onclick = () => {
    try { toggleFavorite(b.dataset.favorite); render(); } catch(e) { toast(e.message); }
  });
  const form = document.querySelector('#capture-form');
  if (!form) return;
  const owner = dashboardOwner(), d = captureDraft(), fields = form.elements;
  const remember = () => Object.assign(d, {text:fields.text.value,kind:fields.kind.value,projectId:fields.projectId.value,planToday:fields.planToday.checked});
  form.oninput = remember;
  fields.kind.onchange = () => {
    remember();
    document.querySelector('#capture-project').hidden = d.kind !== 'task';
    document.querySelector('#capture-plan').hidden = d.kind !== 'task';
    document.querySelector('#capture-hint').textContent = '⌘ / Ctrl + Invio per salvare';
  };
  fields.text.onkeydown = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async e => {
    e.preventDefault();
    if (captureBusy.has(owner)) return;
    remember();
    const values = {...d};
    captureBusy.add(owner);
    form.querySelector('fieldset').disabled = true;
    form.querySelector('.form-error').textContent = '';
    try {
      await saveCapture(values);
      d.text = '';
      captureBusy.delete(owner);
      if (owner === dashboardOwner()) { render(); document.querySelector('#capture-text')?.focus(); toast({task:'Attività aggiunta',todo:'To-do aggiunto',note:'Nota salvata',journal:'Pensiero aggiunto al diario'}[values.kind]); }
    } catch(error) {
      captureBusy.delete(owner);
      if (form.isConnected) { form.querySelector('fieldset').disabled = false; form.querySelector('.form-error').textContent = error.message; }
      else toast(error.message);
    }
  };
}
