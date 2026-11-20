// Dati di prova per i test: sono i vecchi dati di esempio della modalità demo,
// tolta dall'app il 19/11/2026. I test che li usano li caricano importando questo file
// per primo; i servizi girano nel ramo locale (mode "demo") senza Supabase.
import { uid } from "../dist/js/utils/helpers.js?v=65";
import { today, shiftDate } from "../dist/js/utils/dates.js?v=65";
import { state } from "../dist/js/services/store.js?v=65";
import { minutesBetween, toInstant } from "../dist/js/utils/agenda.js?v=65";
import { commuteValues } from "../dist/js/utils/workShifts.js?v=65";
const names = [
  "Forma",
  "CodeMind.Lab",
  "portfolio.example",
  "B&B Esempio",
  "Studio Design",
  "Gestionale Spese",
];
const descriptions = [
  "Una nuova forma al benessere digitale.",
  "Il laboratorio delle prossime idee.",
  "Portfolio personale e presenza online.",
  "Ospitalità, con un tocco personale.",
  "Identità visiva e nuove esperienze.",
  "Spese sotto controllo, ogni giorno.",
];
const colors = [
  "#0c2441",
  "#0d7191",
  "#359eba",
  "#c7523a",
  "#667e9b",
  "#3e6882",
];
const projects = names.map((name, i) => ({
  id: uid(),
  name,
  description: descriptions[i],
  color: colors[i],
  status: i === 4 ? "paused" : i === 5 ? "planned" : "active",
  due_date: shiftDate(today(), [18, 10, 7, 25, 35, 45][i]),
  created_at: new Date().toISOString(),
}));
const titles = [
  [
    "Progettare la dashboard principale",
    "Correggere sincronizzazione Supabase",
    "Definire il design system",
    "Implementare onboarding",
    "Testare layout su iPhone",
  ],
  [
    "Configurare repository GitHub",
    "Disegnare la nuova identità",
    "Scrivere la pagina dei servizi",
    "Rivedere struttura del sito",
  ],
  [
    "Aggiornare la sezione progetti",
    "Ottimizzare immagini portfolio",
    "Pubblicare il nuovo articolo",
  ],
  [
    "Creare pagina prenotazioni",
    "Rivedere esperienza mobile",
    "Aggiungere galleria fotografica",
  ],
  ["Definire palette e tipografia", "Preparare proposta di design"],
  ["Progettare schema delle spese", "Definire categorie e budget"],
];
const tasks = titles.flatMap((list, i) =>
  list.map((title, j) => ({
    id: uid(),
    project_id: projects[i].id,
    title,
    description: "",
    status:
      j === 2
        ? "completed"
        : j === 1
          ? "in_progress"
          : j === 3
            ? "testing"
            : "todo",
    priority: i === 0 && j === 1 ? "urgent" : j === 0 ? "high" : "medium",
    type: j === 1 ? "bug" : j === 2 ? "documentation" : "ui_ux",
    due_date: shiftDate(today(), j === 0 ? 0 : j === 1 ? -1 : 3 + j + i),
    planned_date: j === 0 ? today() : null,
    position: j,
    estimated_minutes: 60,
    actual_minutes: 0,
    notes: "",
    tags: j === 0 ? ["design"] : ["frontend"],
    checklist:
      i === 0 && j === 1
        ? [
            { id: uid(), title: "Riprodurre il bug", is_completed: true },
            { id: uid(), title: "Controllare updated_at", is_completed: true },
            { id: uid(), title: "Correggere la logica", is_completed: false },
            { id: uid(), title: "Test Mac", is_completed: false },
            { id: uid(), title: "Test iPhone", is_completed: false },
            { id: uid(), title: "Commit GitHub", is_completed: false },
          ]
        : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at:
      j === 2 ? new Date(Date.now() - i * 86400000).toISOString() : null,
  })),
);
state.projects = projects;
state.tasks = tasks;
state.mode = "demo";

// Settimana 5–11 ottobre 2026 con turni, tragitti, studio e palestra: era il pulsante
// "Inserisci settimana iniziale" dell'agenda, tolto dall'app insieme alla demo.
export function initialWeek() {
  const tz = state.timezone, start = '2026-10-05', entries = [];
  const add = (date, from, to, title, category, kind = 'activity', projectName) => {
    const endDate = to <= from ? shiftDate(date, 1) : date;
    const starts_at = toInstant(`${date}T${from}`, tz), ends_at = toInstant(`${endDate}T${to}`, tz);
    entries.push({ id: uid(), title, category, kind, entry_date: date, starts_at, ends_at, planned_minutes: minutesBetween(starts_at, ends_at), is_completed: false, project_id: state.projects.find(p => projectName && p.name.toLowerCase().includes(projectName.toLowerCase()))?.id || null, notes: '' });
  };
  for (const [day, from, to] of [[2, '07:30', '15:30'], [3, '23:30', '07:30'], [5, '07:30', '15:30'], [6, '15:30', '23:30']]) {
    const date = shiftDate(start, day); add(date, from, to, 'Turno di lavoro', 'work', 'shift');
    const entry = entries.at(-1);
    for (const leg of ['outbound', 'return']) entries.push({ id: uid(), ...commuteValues(entry, leg, tz), is_completed: false, project_id: null, notes: '' });
  }
  entries.push({ id: uid(), title: 'Giorno OFF', category: 'work', kind: 'off', entry_date: '2026-10-09', starts_at: null, ends_at: null, planned_minutes: 0, is_completed: false, project_id: null, notes: 'Recupero dopo il turno notturno: la mattina termina il turno di giovedì.' });
  for (const [day, from, to] of [[0, '10:00', '12:00'], [1, '10:00', '12:00'], [3, '10:00', '12:00'], [6, '08:00', '10:00']]) add(shiftDate(start, day), from, to, 'Studio · secondo anno', 'study');
  for (const [day, from, to] of [[1, '14:00', '16:00'], [4, '16:00', '18:00'], [6, '10:30', '12:30']]) add(shiftDate(start, day), from, to, 'Studio Design', 'dev', 'activity', 'Studio Design');
  add('2026-10-06', '17:00', '18:00', 'Palestra', 'gym'); add('2026-10-10', '17:00', '18:00', 'Palestra', 'gym');
  add('2026-10-09', '08:30', '15:00', 'Sonno · recupero dopo la notte', 'sleep');
  entries.push({ id: uid(), title: 'B&B Esempio · prossime attività', category: 'dev', kind: 'activity', entry_date: null, starts_at: null, ends_at: null, planned_minutes: 60, project_id: state.projects.find(p => p.name.toLowerCase().includes('la casa gialla'))?.id || null, notes: 'Da pianificare quando c’è spazio.', is_completed: false });
  const goals = [
    { id: uid(), title: 'Studio', week_start: start, category: 'study', unit: 'minutes', target: 480, stretch_target: 480, project_id: null },
    { id: uid(), title: 'Palestra', week_start: start, category: 'gym', unit: 'sessions', target: 2, stretch_target: 3, project_id: null },
    { id: uid(), title: 'Studio Design', week_start: start, category: 'dev', unit: 'minutes', target: 360, stretch_target: 360, project_id: state.projects.find(p => p.name.toLowerCase().includes('studio design'))?.id || null },
  ];
  return { week_start: start, entries, goals };
}

export async function seminaSettimana() {
  const seed = initialWeek();
  if (state.agendaWeeks.some(w => w.week_start === seed.week_start)) throw Error("La settimana iniziale è già stata inserita.");
  state.agendaWeeks.push({ id: uid(), week_start: seed.week_start });
  state.scheduleEntries.push(...seed.entries);
  state.weeklyGoals.push(...seed.goals);
}
