export const statuses = {
  backlog: "Backlog",
  todo: "Da fare",
  in_progress: "In corso",
  testing: "Test",
  completed: "Completato",
};
export const priorities = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};
export const isOpenHighPriority = task => task.priority === 'high' && task.status !== 'completed';
export function projectPriorityMarker(tasks) {
  const count = tasks.filter(isOpenHighPriority).length;
  const label = `${count} attività ad alta priorità da completare`;
  return count ? `<span class="project-priority-marker" role="img" aria-label="${label}" title="${label}"><span aria-hidden="true">✱</span></span>` : '';
}
export const types = {
  feature: "Feature",
  bug: "Bug",
  ui_ux: "UI/UX",
  refactoring: "Refactoring",
  test: "Test",
  documentation: "Documentazione",
  maintenance: "Manutenzione",
  study: "Studio",
  other: "Altro",
};
export const projectStatuses = {
  planned: "Pianificato",
  active: "Attivo",
  paused: "In pausa",
  completed: "Completato",
  archived: "Archiviato",
};
export const uid = () => crypto.randomUUID();
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeURL = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
};
export const progress = (tasks) =>
  tasks.length
    ? Math.round(
        (tasks.filter((t) => t.status === "completed").length / tasks.length) *
          100,
      )
    : 0;
export const icon = (name) => {
  const paths = {
    sport: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
    oggi: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZZZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    agenda: "M3 7.5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zZZZM3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M7.5 17h6",
    hotel: "M3 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14ZZZM15 10h4a2 2 0 0 1 2 2v8M1.5 20h21M7 8h2M7 12h2M7 16h2",
    sviluppo: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    pasti: "M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10ZZZM17 3c-2 1.5-3 4-3 7h3v11",
    altro: "M5 12h.01M12 12h.01M19 12h.01",
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    today:
      "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M5.6 18.4l1.4-1.4m10-10l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "daily-todos":
      "M9 5h12M9 12h12M9 19h12M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2",
    notes: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h3",
    journal: "M4 3h14v18H4zM8 3v18M11 7h4M11 11h4M11 15h3",
    university: "M2 8l10-5 10 5-10 5zM6 10v7c4 3 8 3 12 0v-7M22 8v9",
    projects: "M3 7V4h6l2 3h10v13H3z",
    tasks: "M9 5h12M9 12h12M9 19h12M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2",
    calendar: "M4 5h16v16H4zM4 10h16M8 3v4m8-4v4",
    search: "M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZZZM16 16l5 5",
    statistics: "M4 21V12m8 9V3m8 18V8",
    archive: "M3 4h18v5H3zM5 9v12h14V9M10 13h4",
    settings:
      "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(
    paths[name] || paths.projects
  )
    .split("ZZZ")
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;
};

export const validProjectIcon = (value) =>
  /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value || "") &&
  value.length <= 100000;
export const projectIcon = (project) =>
  validProjectIcon(project.icon)
    ? `<img class="project-favicon" src="${project.icon}" alt="" width="32" height="32">`
    : esc((project.name || "").slice(0, 1));
