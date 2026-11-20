import { clearForma } from './services/formaService.js?v=65';
import { startAppUpdates } from "./services/appUpdate.js?v=68";
import { palestraPage, bindPalestra } from './modules/palestra.js?v=73';
import { clearSport } from './services/sportService.js?v=65';
import { universityData } from "./utils/university.js?v=65";
import { openChecklistImport } from "./modules/checklistImport.js?v=65";
import { attachmentsSection, bindAttachments, openFileImport } from './modules/attachments.js?v=65';
import { notesPage, bindNotes, noteForm } from "./modules/notes.js?v=65";
import {
  notebookPage,
  bindNotebook,
  clearNotebookDrafts,
} from "./modules/notebook.js?v=65";
import { quickAdd } from "./modules/quickAdd.js?v=65";
import { oggiPage, bindOggi } from "./modules/oggi.js?v=70";
import { schedeSviluppo, schedeNote } from "./modules/sezioni.js?v=70";
import { hotelPage, bindHotel } from "./modules/hotel.js?v=70";
import { sviluppoPage, bindSviluppo } from "./modules/sviluppo.js?v=70";
import { universitaPage, bindUniversita } from "./modules/universita.js?v=70";
import { clearUniversita } from "./services/universitaService.js?v=70";
import { clearLavoro } from "./services/lavoroService.js?v=70";
import {
  projects,
  projectHeading,
  confirmRemoveProjectTasks,
  projectForm,
} from "./modules/projects.js?v=65";
import {
  tasksPage,
  taskTable,
  taskForm,
  filterBar,
  filteredTasks,
  filters,
} from "./modules/tasks.js?v=65";
import { agendaPage, bindAgenda, entryForm } from "./modules/agenda.js?v=65";
import { clearAgenda, importLegacyWorkShifts } from "./services/agendaService.js?v=65";
import { navigation } from "./modules/navigation.js?v=65";
import { searchPage } from "./modules/search.js?v=65";
import {
  settingsPage,
  bindSettings,
  applyTheme,
  loginModal,
  passwordModal,
} from "./modules/settings.js?v=68";
import { state } from "./services/store.js?v=65";
import {
  loadCloud,
  setTaskStatus,
} from "./services/dataService.js?v=65";
import { getClient } from "./services/supabase.js?v=65";
import { session } from "./services/authService.js?v=65";
import { icon, esc } from "./utils/helpers.js?v=65";
import { toast } from "./utils/dom.js?v=65";
import { pages, route } from "./router.js?v=65";
const recovering = location.hash.includes("type=recovery");
let searchQuery = "",
  installEvent;
export function render() {
  const { page, id, sub } = route();
  if (page === "projects" && id && universityData(state.projects.find(p => p.id === id))) {
    location.replace(`#/university/${id}`);
    return;
  }
  document.title = (pages[page] || "Ricerca") + " · CodeMind Projects";
  document.querySelector("#navigation").innerHTML = navigation(page, id);
  const addButton = document.querySelector("#quick-add-global");
  addButton.querySelector(".quick-global-label").textContent = page === "today" ? "Impegno" : "Attività";
  addButton.setAttribute("aria-label", page === "today" ? "Aggiungi impegno in agenda" : "Aggiungi attività rapidamente");
  addButton.title = page === "today" ? "Aggiungi impegno (Q)" : "Aggiungi attività (Q)";
  document.querySelector("#breadcrumb").textContent = pages[page] || "Ricerca";
  document.querySelector('.topbar').classList.toggle('is-compact', ['dashboard','today'].includes(page));
  const banner = document.querySelector("#mode-banner");
  banner.hidden = state.mode === 'cloud' && navigator.onLine;
  banner.innerHTML =
    state.mode === "cloud"
      ? `<span>${navigator.onLine ? "Workspace collegato a Supabase" : "Sei offline · Il salvataggio richiede una connessione"}</span><button class="link" data-action="refresh">↻ Aggiorna dati</button>`
      : "<span>Accedi per aprire il tuo workspace.</span>";
  const main = document.querySelector("#main");
  if (state.mode === "starting" || (state.mode === "cloud" && !state.loaded)) {
    main.innerHTML = '<div class="skeleton" aria-label="Caricamento"></div>';
    return;
  }
  let content;
  if (state.mode === "signed_out" && page !== "settings") {
    content =
      '<section class="panel empty"><h2>Il tuo workspace è privato.</h2><p class="subtext">Accedi per vedere progetti e attività.</p><button class="btn primary" data-action="login" style="margin-top:18px">Accedi</button><a class="btn" href="#/settings" style="margin-left:8px">Impostazioni</a></section>';
  } else if (page === "projects" && id) {
    const p = state.projects.find((p) => p.id === id && !universityData(p));
    const projectActions = `<span class="muted" style="font-size:14px">${state.tasks.filter((t) => t.project_id === id).length} attività</span>`;
    content = p
      ? `${projectHeading(p)}<div class="page-heading"><div></div>${projectActions}</div>${filterBar(id)}${taskTable(filteredTasks(id), {completion:true})}${attachmentsSection(p.id)}`
      : '<div class="panel empty">Progetto non trovato. <a class="link" href="#/projects">Torna ai progetti</a></div>';
  } else {
    const views = {
      university: () => universitaPage(id, sub),
      dashboard: oggiPage,
      hotel: () => hotelPage(id),
      sviluppo: () => sviluppoPage(id),
      projects: () => schedeSviluppo("projects") + projects(false),
      archive: () => schedeSviluppo("archive") + projects(true),
      tasks: () => schedeSviluppo("tasks") + tasksPage(),
      today: agendaPage,
      sport: () => palestraPage(id),
      "daily-todos": () => schedeNote("daily-todos") + notebookPage("daily-todos"),
      notes: () => schedeNote("notes") + notesPage(),
      settings: settingsPage,
      search: () => searchPage(searchQuery),
    };
    content = (views[page] || oggiPage)();
  }
  main.innerHTML = content;
  bind();
  if (page === "dashboard") bindOggi(render);
  if (page === "hotel") bindHotel(render);
  if (page === "sviluppo") bindSviluppo(render);
  if (page === "university") bindUniversita(render);
  if (page === "sport") bindPalestra(render);
  bindAttachments();
  bindAgenda(render);
  document.querySelector("#navigation-more").onclick = toggleMenu;
  bindNotebook(render);
  bindNotes(render);
  bindSettings(render, installEvent);
  if (state.mode === "cloud") {
    document.querySelectorAll(".sidebar-foot div").forEach((el) => {
      el.innerHTML =
        esc(state.profile?.display_name || state.user.email) +
        "<small>CodeMind.Lab</small>";
    });
  }
}
function bind() {
  document.querySelectorAll("[data-action]").forEach(
    (el) =>
      (el.onclick = async () => {
        const action = el.dataset.action;
        if (action === "import-checklist") openChecklistImport(el.dataset.project || route().id, render);
        if (action === "import-files") openFileImport(el.dataset.project || route().id);
        if (action === "new-note") noteForm(null, render);
        if (action === "new-project") projectForm(null, render);
        if (action === "new-task" || action === "quick-add")
          quickAdd(
            el.dataset.project || route().id,
            render,
            el.dataset.planToday === "true",
          );
        if (action === "reset-filters") {
          Object.assign(filters, {
            project: "",
            status: "",
            priority: "",
            type: "",
            due: "",
            tag: "",
            sort: "",
          });
          render();
        }
        if (action === "login") loginModal(render);
        if (action === "refresh") {
          el.disabled = true;
          try {
            await loadCloud();
            render();
            toast("Dati aggiornati");
          } catch (e) {
            toast(e.message);
            el.disabled = false;
          }
        }
      }),
  );
  document.querySelectorAll("[data-task]").forEach(
    (el) =>
      (el.onclick = () =>
        taskForm(
          state.tasks.find((t) => t.id === el.dataset.task),
          null,
          render,
        )),
  );
  document.querySelectorAll("[data-edit-project]").forEach(
    (el) =>
      (el.onclick = () =>
        projectForm(
          state.projects.find((p) => p.id === el.dataset.editProject),
          render,
        )),
  );
  document.querySelectorAll("[data-delete-project-tasks]").forEach(el => {
    el.onclick = () => confirmRemoveProjectTasks(state.projects.find(p => p.id === el.dataset.deleteProjectTasks), render);
  });
  document.querySelectorAll("[data-complete]").forEach(
    (el) =>
      (el.onclick = async () => {
        el.disabled = true;
        const t = state.tasks.find((t) => t.id === el.dataset.complete);
        const wasCompleted = t?.status === "completed";
        try {
          if (!t) throw Error("Attività non trovata.");
          await setTaskStatus(
            t.id,
            wasCompleted ? "todo" : "completed",
          );
          render();
          toast(
            wasCompleted
              ? "Attività riaperta"
              : "Attività completata",
          );
        } catch (e) {
          toast(e.message);
          if (el.type === "checkbox") el.checked = wasCompleted;
          el.disabled = false;
        }
      }),
  );
  document.querySelectorAll("[data-status]").forEach(
    (el) =>
      (el.onchange = async () => {
        el.disabled = true;
        try {
          await setTaskStatus(el.dataset.status, el.value);
          render();
          toast("Stato aggiornato");
        } catch (e) {
          toast(e.message);
          render();
        }
      }),
  );
  document.querySelectorAll("[data-filter]").forEach(
    (el) =>
      (el.onchange = () => {
        filters[el.dataset.filter] = el.value;
        render();
      }),
  );
}
if (localStorage.getItem("cm-tech-style") !== "white-tech-v1") {
  localStorage.setItem("cm-tech-style", "white-tech-v1");
  localStorage.setItem("cm-theme", "light");
}
applyTheme(localStorage.getItem("cm-theme") || "light");
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => {
  if (localStorage.getItem("cm-theme") === "system") applyTheme("system");
});
document.querySelector("#theme-toggle").onclick = () =>
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
function closeMenu() {
  document.querySelector(".sidebar").classList.remove("menu-open");
  document.querySelector("#menu-backdrop").hidden = true;
  document.querySelector("#navigation-more")?.setAttribute("aria-expanded", "false");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
}
function toggleMenu() {
  const open = document.querySelector(".sidebar").classList.toggle("menu-open");
  document.querySelector("#menu-backdrop").hidden = !open;
  document.querySelector("#navigation-more")?.setAttribute("aria-expanded", String(open));
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", String(open));
}
document.querySelector("#mobile-menu").onclick = toggleMenu;
document.querySelector("#menu-backdrop").onclick = closeMenu;
let searchTimer;
document.querySelector("#global-search").oninput = (e) => {
  searchQuery = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (route().page === "search") render();
    else location.hash = "#/search";
  }, 180);
};
function globalAdd() {
  if (route().page === "today") entryForm(null, render);
  else quickAdd(route().page === "projects" ? route().id : undefined, render);
}
document.querySelector("#quick-add-global").onclick = globalAdd;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
  const typing = e.target.closest?.(
    'input, textarea, select, [contenteditable="true"]',
  );
  if (
    e.key.toLowerCase() === "q" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !typing &&
    !document.querySelector("#modal").open
  ) {
    e.preventDefault();
    globalAdd();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    document.querySelector("#global-search").focus();
  }
});
window.addEventListener("hashchange", () => {
  closeMenu();
  if (route().page !== "search") {
    searchQuery = "";
    document.querySelector("#global-search").value = "";
  }
  render();
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  if (route().page === "settings") render();
});
window.addEventListener("online", render);
window.addEventListener("offline", render);
async function init() {
  try {
    const c = await getClient();
    if (c) {
      state.mode = "signed_out";
      state.projects = [];
      state.tasks = [];
      clearAgenda(); clearSport(); clearForma(); clearLavoro(); clearUniversita();
      const s = await session();
      if (s) {
        await loadCloud();
        applyTheme(
          localStorage.getItem("cm-theme") || state.profile?.theme || "light",
        );
      }
      c.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setTimeout(passwordModal, 0);
        if (event === "SIGNED_OUT") {
          state.mode = "signed_out";
          state.projects = [];
          state.tasks = [];
          state.dailyTodos = [];
          state.notes = [];
          clearAgenda(); clearSport(); clearForma(); clearLavoro(); clearUniversita();
          clearNotebookDrafts();
          render();
        }
      });
    } else state.mode = "signed_out";
  } catch (e) {
    state.mode = "signed_out";
    state.projects = [];
    state.tasks = [];
    clearAgenda(); clearSport(); clearForma();
    toast("Connessione non disponibile: " + e.message);
  }
  render();
  if (sessionStorage.getItem("cm-connection-ready") === "yes") {
    sessionStorage.removeItem("cm-connection-ready");
    if (state.mode === "signed_out") {
      toast("Connessione verificata. Accedi con il tuo utente Supabase.");
      loginModal(render);
    }
  }
  if (recovering) passwordModal();
}
render();
startAppUpdates();
init();
