import {universityData} from "../utils/university.js?v=65";
import { state } from "../services/store.js?v=65";
import { esc } from "../utils/helpers.js?v=65";
export function searchPage(query) {
  const q = query.trim().toLocaleLowerCase("it");
  const projects = q
      ? state.projects.filter((p) =>
          [p.name, p.description, p.notes]
            .join(" ")
            .toLocaleLowerCase("it")
            .includes(q),
        )
      : [],
    tasks = q
      ? state.tasks.filter((t) =>
          [t.title, t.description, t.notes, ...(t.tags || [])]
            .join(" ")
            .toLocaleLowerCase("it")
            .includes(q),
        )
      : [];
  return `<div class="page-heading"><div><h1>Ricerca nel workspace</h1><p class="subtext">${q ? `${projects.length + tasks.length} risultati per “${esc(query)}”` : "Cerca progetti, attività, descrizioni e tag dalla barra in alto."}</p></div></div><div class="search-results">${projects.map((p) => `<a class="search-result" href="#/${universityData(p) ? "university" : "projects"}/${p.id}"><span class="badge">${universityData(p) ? "Materia" : "Progetto"}${p.status === "archived" ? " · Archiviato" : ""}</span><h3 style="margin-top:8px">${esc(p.name)}</h3><p class="subtext">${esc(p.description)}</p></a>`).join("")}${tasks.map((t) => `<button class="search-result" data-task="${t.id}"><span class="badge">Attività</span><h3 style="margin-top:8px">${esc(t.title)}</h3><p class="subtext">${esc(state.projects.find((p) => p.id === t.project_id)?.name)} · ${(t.tags || []).map(esc).join(", ")}</p></button>`).join("")}${q && !projects.length && !tasks.length ? '<div class="panel empty">Nessun risultato. Prova un’altra parola.</div>' : ""}</div>`;
}
