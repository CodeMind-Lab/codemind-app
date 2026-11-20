export const state = {
  projects: [],
  tasks: [],
  mode: "starting",
  dailyTodos: [],
  notes: [],
  formaArchive: null,
  formaError: "",
  sportConnection: null,
  sportImports: [],
  sportError: "",
  scheduleEntries: [],
  timeLogs: [],
  weeklyGoals: [],
  agendaWeeks: [],
  agendaTimers: [],
  agendaAvailable: true,
  agendaError: "",
  timezone: "Europe/Rome",
  loaded: true,
};
export const projectOf = (id) => state.projects.find((p) => p.id === id);
export const activeTasks = () =>
  state.tasks.filter((t) => {
    const project = projectOf(t.project_id);
    return project && project.status !== "archived";
  });
