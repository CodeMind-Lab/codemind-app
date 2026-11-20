import { universityData } from "../utils/university.js?v=65";
import { state, activeTasks } from './store.js?v=65';
import { saveTask } from './dataService.js?v=65';
import { saveNote } from './notesService.js?v=65';
import { saveDailyTodo } from './notebookService.js?v=65';
import { today } from '../utils/dates.js?v=65';
export const dashboardOwner = () => state.mode === 'cloud' ? `user:${state.user?.id}` : state.mode;
const favoriteKey = () => `cm-favorite-projects:${dashboardOwner()}`;
export function favoriteIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(favoriteKey()) || '[]');
    return Array.isArray(ids) ? [...new Set(ids)].filter(id => state.projects.some(p => p.id === id && p.status !== 'archived' && !universityData(p))).slice(0,5) : [];
  } catch { return []; }
}
export function toggleFavorite(id) {
  const ids = favoriteIds();
  if (!state.projects.some(p => p.id === id && p.status !== 'archived' && !universityData(p))) throw Error('Progetto non disponibile.');
  if (!ids.includes(id) && ids.length >= 5) throw Error('Puoi fissare fino a 5 progetti. Rimuovi prima una stella.');
  localStorage.setItem(favoriteKey(), JSON.stringify(ids.includes(id) ? ids.filter(x => x !== id) : [...ids,id]));
}
export function todayItems() {
  const now = today(state.timezone);
  const focus = (state.dailyFocus || []).filter(x => x.focus_date === now).sort((a,b) => a.slot-b.slot).map(x => x.task_id);
  return activeTasks().filter(t => t.status !== 'completed' && (focus.includes(t.id) || t.priority === 'urgent' || (t.due_date && t.due_date <= now) || t.planned_date === now))
    .sort((a,b) => {
      const rank = t => focus.includes(t.id) ? focus.indexOf(t.id) : t.due_date && t.due_date < now ? 3 : t.priority === 'urgent' ? 4 : 5;
      return rank(a)-rank(b) || (a.due_date || '9999').localeCompare(b.due_date || '9999');
    });
}
export async function saveCapture({kind,text,projectId,planToday}) {
  const body = String(text || '').trim();
  if (!body) throw Error('Scrivi qualcosa prima di salvare.');
  const now = today(state.timezone);
  if (kind === 'note') return saveNote({title:body.split('\n')[0].slice(0,200),body});
  if (kind === 'todo') return saveDailyTodo({title:body,todo_date:null,is_completed:false});
  if (kind !== 'task') throw Error('Scegli cosa aggiungere.');
  if (body.length > 200) throw Error('Usa al massimo 200 caratteri per un’attività.');
  if (!state.projects.some(p => p.id === projectId && p.status !== 'archived' && !universityData(p))) throw Error('Seleziona un progetto, oppure crea prima un nuovo progetto.');
  return saveTask({title:body,project_id:projectId,status:'todo',priority:'medium',type:'feature',description:'',notes:'',tags:[],checklist:[],start_date:null,due_date:null,planned_date:planToday ? now : null,estimated_minutes:null,actual_minutes:null,github_url:null,github_issue_number:null,position:0});
}
