import { validDate, weekStart, wallTime } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';
export const FORMA_URL = 'https://codemind-lab.github.io/Tracking-sportivo/';
export const FORMA_ORIGIN = new URL(FORMA_URL).origin;
export const SPORT_PROTOCOL = 'codemind-forma-v1';
const clean = (s, max = 200) => String(s || '').trim().slice(0, max);
export function normalizeSportSnapshot(value, timezone = 'Europe/Rome') {
  if (value?.version !== 1 || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.source_id || '') || !Array.isArray(value.workouts) || !Array.isArray(value.plans) || value.workouts.length > 2000 || value.plans.length > 7) throw Error('Riepilogo Forma non valido. Aggiorna l’app sportiva e riprova.');
  const seen = new Set();
  const workouts = value.workouts.map(w => {
    const id = clean(w.id, 100);
    if (!id || seen.has(id) || !validDate(w.date)) throw Error('Allenamento non valido o duplicato.');
    seen.add(id);
    const duration = Number(w.duration_minutes);
    const started = Date.parse(w.started_at), ended = Date.parse(w.ended_at);
    const interval = !!w.completed && Number.isFinite(started) && Number.isFinite(ended) && ended > started && ended - started <= 300 * 60000 && wallTime(new Date(started), timezone).slice(0,10) === w.date && Math.abs((ended-started)/60000-duration) < 1;
    return { id, date:w.date, title:clean(w.title) || 'Allenamento', completed:!!w.completed, duration_minutes:Number.isFinite(duration) && duration > 0 && duration <= 300 ? Math.round(duration) : 0, started_at:interval ? new Date(started).toISOString() : null, ended_at:interval ? new Date(ended).toISOString() : null };
  }).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  seen.clear();
  const plans = value.plans.map(p => {
    if (!Number.isInteger(p.weekday) || p.weekday < 0 || p.weekday > 6 || seen.has(p.weekday)) throw Error('Programma settimanale non valido.');
    seen.add(p.weekday);
    return { id:clean(p.id,100) || `day-${p.weekday}`, weekday:p.weekday, title:clean(p.title) || 'Allenamento' };
  });
  return {version:1, source_id:value.source_id, workouts, plans};
}
export function sportWeek(snapshot, week) {
  const start = weekStart(week), end = shiftDate(start,6);
  const workouts = (snapshot?.workouts || []).filter(w => w.date >= start && w.date <= end);
  return {start,end,workouts, sessions:workouts.filter(w => w.completed).length, minutes:workouts.filter(w => w.completed).reduce((n,w) => n+w.duration_minutes,0), days:Array.from({length:7},(_,i) => ({date:shiftDate(start,i),plan:snapshot?.plans?.find(p => p.weekday === i),workouts:workouts.filter(w => w.date === shiftDate(start,i))}))};
}
export function sportImportItems(snapshot, week, entries, receipts) {
  if (!snapshot) return [];
  const known = new Set(receipts.map(x => x.source_key)), used = new Set();
  const data = sportWeek(snapshot,week), items = [];
  for (const w of data.workouts.filter(w => w.completed)) {
    const key = `${snapshot.source_id}:session:${w.id}`;
    if (known.has(key)) continue;
    const candidates = entries.filter(e => e.category === 'gym' && e.entry_date === w.date && !e.sport_session_key && !used.has(e.id));
    const linked = candidates.length === 1 ? candidates[0] : null;
    if (linked) used.add(linked.id);
    items.push({key,date:w.date,title:w.title,completed:true,planned_minutes:0,started_at:w.started_at,ended_at:w.ended_at,link_id:linked?.id || null,expected_updated_at:linked?.updated_at || null,candidates,duration_minutes:w.duration_minutes});
  }
  for (const day of data.days) {
    if (!day.plan || day.workouts.some(w => w.completed)) continue;
    const key = `${snapshot.source_id}:plan:${day.plan.id}:${day.date}`;
    if (!known.has(key)) items.push({key,date:day.date,title:day.plan.title,completed:false,planned_minutes:60,started_at:null,ended_at:null,link_id:null,expected_updated_at:null,candidates:entries.filter(e => e.category==='gym' && e.entry_date===day.date)});
  }
  return items;
}
