import { state } from './store.js?v=65';
import { getClient, unwrap, readAll } from './supabase.js?v=65';
import { uid } from '../utils/helpers.js?v=65';
import { shiftDate } from '../utils/dates.js?v=65';
import { categories, validDate, weekStart, minutesBetween, toInstant } from '../utils/agenda.js?v=65';
import { shiftPresets, shiftValues, commuteValues, syncDemoCommutes, shiftPreset } from '../utils/workShifts.js?v=65';
export function clearAgenda() { state.scheduleEntries = []; state.timeLogs = []; state.weeklyGoals = []; state.agendaWeeks = []; state.agendaTimers = []; state.agendaAvailable = true; state.agendaError = ''; }
export async function loadAgenda() {
  try {
    const [entries, goals, logs, weeks, timers] = await Promise.all([readAll('schedule_entries'), readAll('weekly_goals'), readAll('time_logs'), readAll('agenda_weeks'), readAll('agenda_timers')]);
    Object.assign(state, { scheduleEntries: entries, weeklyGoals: goals, timeLogs: logs, agendaWeeks: weeks, agendaTimers: timers, agendaAvailable: true, agendaError: '' });
    globalThis.window?.dispatchEvent(new Event('cm:agenda-updated'));
  } catch (error) {
    clearAgenda(); state.agendaAvailable = false;
    state.agendaError = 'Non riesco a caricare l’Agenda. Controlla la connessione e premi Aggiorna dati. Se il problema continua, contatta l’assistenza.';
  }
}
export function assertAgendaWritable() {
  if (state.mode === 'signed_out') throw Error('Accedi prima di salvare.');
  if (state.mode === 'cloud' && (!navigator.onLine || !state.agendaAvailable)) throw Error(state.agendaError || 'Riconnettiti per salvare.');
}
function title(value) { const s = String(value || '').trim(); if (!s || s.length > 200) throw Error('Scrivi un titolo di massimo 200 caratteri.'); return s; }
function category(value) { if (!Object.hasOwn(categories, value)) throw Error('Seleziona una categoria valida.'); return value; }
function project(value) { if (value && !state.projects.some(p => p.id === value)) throw Error('Progetto non valido.'); return value || null; }
function integer(value, max = 10080) { const n = Number(value); if (!Number.isInteger(n) || n < 0 || n > max) throw Error('Inserisci una durata o un obiettivo valido.'); return n; }
function interval(start, end) { const duration = minutesBetween(start, end); if (!Number.isFinite(duration) || duration <= 0 || duration > 1440) throw Error('La fine deve seguire l’inizio, entro 24 ore.'); return duration; }
const collections = { schedule_entries: 'scheduleEntries', weekly_goals: 'weeklyGoals', time_logs: 'timeLogs', agenda_weeks: 'agendaWeeks' };
async function write(table, values, existing) {
  assertAgendaWritable();
  let item;
  if (state.mode === 'cloud') {
    const c = await getClient();
    const query = existing ? c.from(table).update(values).eq('id', existing.id).eq('updated_at', existing.updated_at).select() : c.from(table).insert({ ...values, user_id: state.user.id }).select();
    const data = unwrap(await query);
    if (!data.length) throw Error('Questa voce è cambiata su un altro dispositivo. Aggiorna i dati prima di salvare.');
    item = data[0];
  } else {
    const now = new Date().toISOString();
    item = { ...existing, ...values, id: existing?.id || uid(), created_at: existing?.created_at || now, updated_at: now };
    if (table === "schedule_entries") item.completed_at = item.is_completed ? existing?.completed_at || now : null;
  }
  const key = collections[table];
  state[key] = [...state[key].filter(x => x.id !== item.id), item];
  if (table === 'schedule_entries' && (item.kind === 'shift' || existing?.kind === 'shift')) {
    if (state.mode === 'cloud') state.scheduleEntries = await readAll('schedule_entries');
    else state.scheduleEntries = syncDemoCommutes(state.scheduleEntries, item, existing, state.timezone);
  }
  
  if(table==='schedule_entries')globalThis.window?.dispatchEvent(new Event('cm:agenda-updated'));
  return item;
}
export function entryPayload(e) { return Object.fromEntries(['title', 'category', 'kind', 'entry_date', 'starts_at', 'ends_at', 'planned_minutes', 'project_id', 'notes', 'is_completed'].map(k => [k, e[k] ?? null])); }
export async function saveEntry(values, existing) {
  if (existing && (values.is_completed || !values.entry_date || values.kind === "off")) assertNoRunningTimer(existing);
  const entry = { title: title(values.title), category: category(values.category), kind: values.kind || 'activity', entry_date: values.entry_date || null, starts_at: values.starts_at || null, ends_at: values.ends_at || null, planned_minutes: integer(values.planned_minutes || 0, 1440), project_id: project(values.project_id), notes: String(values.notes || '').slice(0, 5000), is_completed: !!values.is_completed };
  if (!['activity', 'shift', 'off', 'commute'].includes(entry.kind)) throw Error('Tipo di impegno non valido.');
  if (entry.entry_date && !validDate(entry.entry_date)) throw Error('Scegli una data valida.');
  if (entry.kind === 'shift' && (entry.category !== 'work' || !entry.starts_at)) throw Error('Il turno richiede categoria Lavoro e orari.');
  if (entry.kind === 'off' && (entry.category !== 'work' || !entry.entry_date)) throw Error('Il giorno OFF richiede una data e categoria Lavoro.');
  if (entry.starts_at || entry.ends_at) {
    if (!entry.entry_date || !entry.starts_at || !entry.ends_at) throw Error('Compila giorno, inizio e fine oppure lascia entrambi gli orari vuoti.');
    entry.planned_minutes = interval(entry.starts_at, entry.ends_at);
  }
  if (existing?.sport_session_key && entry.category !== 'gym') entry.sport_session_key=null;
  if (entry.kind === 'off') { entry.starts_at = null; entry.ends_at = null; entry.planned_minutes = 0; }
  if (existing && (!entry.entry_date || entry.kind === 'off') && state.timeLogs.some(l => l.entry_id === existing.id)) throw Error('Elimina gli intervalli registrati prima di rimuovere la data o scegliere OFF.');
  if (existing?.kind === 'shift' && entry.kind !== 'shift') assertNoShiftLogs(existing, false);
  // Changing a journey's type explicitly detaches it from the automatic pair.
  if (existing?.shift_id && entry.kind !== 'commute') Object.assign(entry, { shift_id: null, commute_leg: null });
  if (entry.is_completed && !entry.entry_date) throw Error('Pianifica l’attività prima di completarla.');
  return write('schedule_entries', entry, existing);
}
export async function saveLog(values, existing) {
  if (existing && existing.entry_id !== values.entry_id) throw Error('Il collegamento all’attività non può cambiare.');
  const entry = state.scheduleEntries.find(e => e.id === values.entry_id);
  if (!entry || entry.kind === 'off' || !entry.entry_date) throw Error('Pianifica una voce valida prima di registrare il tempo.');
  const duration = interval(values.started_at, values.ended_at);
  // Prevent counting overlapping intervals, including across different activities.
  if (state.timeLogs.some(l => l.id !== existing?.id && Date.parse(l.started_at) < Date.parse(values.ended_at) && Date.parse(l.ended_at) > Date.parse(values.started_at))) throw Error('Questo intervallo si sovrappone a ore già registrate. Modifica l’intervallo esistente.');
  return write('time_logs', { entry_id: entry.id, started_at: values.started_at, ended_at: values.ended_at, notes: String(values.notes || '').slice(0, 2000) }, existing).then(item => ({ ...item, duration_minutes: duration }));
}
export async function saveGoal(values, existing) {
  if (!validDate(values.week_start) || weekStart(values.week_start) !== values.week_start) throw Error('La settimana deve iniziare lunedì.');
  if (!['minutes', 'sessions'].includes(values.unit)) throw Error('Unità non valida.');
  const target = integer(values.target), stretch = integer(values.stretch_target || values.target);
  if (stretch < target || target < 1) throw Error('L’obiettivo ideale deve essere almeno pari al minimo.');
  return write('weekly_goals', { title: title(values.title), week_start: values.week_start, category: category(values.category), unit: values.unit, target, stretch_target: stretch, project_id: project(values.project_id) }, existing);
}
export async function deleteAgenda(table, existing) {
  assertAgendaWritable(); if (!collections[table] || !existing) throw Error('Voce non valida.');
  if (table === 'schedule_entries') assertNoRunningTimer(existing);
  if (state.mode === 'cloud') {
    const data = unwrap(await (await getClient()).from(table).delete().eq('id', existing.id).eq('updated_at', existing.updated_at).select());
    if (!data.length) throw Error('Voce modificata altrove. Aggiorna i dati prima di eliminarla.');
  }
  const removed = new Set([existing.id, ...(table === 'schedule_entries' ? state.scheduleEntries.filter(e => e.shift_id === existing.id).map(e => e.id) : [])]);
  state[collections[table]] = state[collections[table]].filter(x => !removed.has(x.id));
  if (table === 'schedule_entries') state.timeLogs = state.timeLogs.filter(l => !removed.has(l.entry_id));
  
  if(table==='schedule_entries')globalThis.window?.dispatchEvent(new Event('cm:agenda-updated'));
}
function assertNoShiftLogs(existing, includeShift = true) {
  assertNoRunningTimer(existing);
  const ids = new Set(state.scheduleEntries.filter(e => e.shift_id === existing.id).map(e => e.id));
  if (includeShift) ids.add(existing.id);
  if (state.timeLogs.some(l => ids.has(l.entry_id))) throw Error('Il turno o un tragitto ha ore registrate: elimina prima gli intervalli per rimuovere il turno o scegliere OFF.');
}
function workDayChange(date, day) {
  if (!validDate(date)) throw Error('Giorno non valido.');
  const rows = state.scheduleEntries.filter(e => e.entry_date === date && ['shift', 'off'].includes(e.kind));
  if (rows.length > 1) throw Error('Ci sono più turni nello stesso giorno. Modificali singolarmente nell’Agenda.');
  const existing = rows[0];
  if (!day.kind && !day.preset) {
    if (!existing) return null;
    assertNoShiftLogs(existing);
    return { id: existing.id, expected_updated_at: existing.updated_at, remove: true };
  }
  const values = shiftValues(date, day, state.timezone);
  if (values.kind === 'off' && existing) assertNoShiftLogs(existing);
  const unchanged = existing && ['kind','entry_date','starts_at','ends_at'].every(key => existing[key] === values[key]);
  if (unchanged && (values.kind === 'off' || state.scheduleEntries.filter(e => e.shift_id === existing.id).length === 2)) return null;
  return { id: existing?.id || uid(), expected_updated_at: existing?.updated_at || null, remove: false, ...values,
    title: day.preset || existing?.kind !== values.kind ? values.title : existing.title,
    category: 'work', planned_minutes: values.starts_at ? interval(values.starts_at, values.ends_at) : 0,
    project_id: existing?.project_id || null, notes: existing?.notes || '', is_completed: existing?.is_completed || false };
}
// One transaction creates/updates shifts and their linked journeys in Supabase.
async function saveWorkDays(days) {
  assertAgendaWritable();
  const changes = days.map(({date, day}) => workDayChange(date, day)).filter(Boolean);
  if (!changes.length) return;
  if (state.mode === 'cloud') {
    unwrap(await (await getClient()).rpc('save_agenda_shifts', { changes }));
    await loadAgenda();
    if (!state.agendaAvailable) throw Error(state.agendaError);
  } else {
    const now = new Date().toISOString(); let entries = [...state.scheduleEntries];
    for (const change of changes) {
      const previous = entries.find(e => e.id === change.id);
      entries = entries.filter(e => e.id !== change.id);
      if (change.remove) entries = entries.filter(e => e.shift_id !== change.id);
      else {
        const {remove, expected_updated_at, ...entry} = change;
        const saved = {...previous,...entry,updated_at:now,created_at:previous?.created_at || now};
        entries.push(saved); entries = syncDemoCommutes(entries, saved, previous, state.timezone);
      }
    }
    state.scheduleEntries = entries;
    globalThis.window?.dispatchEvent(new Event('cm:agenda-updated'));
  }
}
export async function saveWorkShift(date, preset) {
  if (preset && !Object.hasOwn(shiftPresets, preset)) throw Error('Scegli un turno valido.');
  await saveWorkDays([{ date, day: preset ? { preset } : { kind: '' } }]);
}
export async function saveWorkWeek(start, days) {
  if (!validDate(start) || weekStart(start) !== start) throw Error('Settimana non valida.');
  if (days.length !== 7) throw Error('Inserisci tutti e sette i giorni.');
  await saveWorkDays(days.map((day, i) => ({ date: shiftDate(start, i), day })));
}
// Import legacy browser-only shifts once per account. Calendar data takes precedence.
export async function importLegacyWorkShifts() {
  state.workShiftsImportError = '';
  if (state.mode === 'signed_out' || !state.agendaAvailable) return;
  const owner = state.mode === 'cloud' ? `user:${state.user?.id}` : state.mode;
  const key = `cm-work-shifts:${owner}`, markerKey = `${key}:imported`;
  try {
    const legacy = JSON.parse(localStorage.getItem(key) || '{}');
    const imported = JSON.parse(localStorage.getItem(markerKey) || '{}');
    if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy) || !imported || typeof imported !== 'object' || Array.isArray(imported)) throw Error('Turni locali non leggibili.');
    const dates = Object.keys(legacy).filter(date => validDate(date) && !imported[date] && Object.hasOwn(shiftPresets, legacy[date]));
    if (!dates.length) return;
    // Verify marker storage before any cloud import; keep the original data as a backup.
    localStorage.setItem(markerKey, JSON.stringify(imported));
    const conflicts = dates.filter(date => {
      const existing = state.scheduleEntries.find(e => e.entry_date === date && ['shift','off'].includes(e.kind));
      return existing && shiftPreset(existing, state.timezone) !== legacy[date];
    });
    const missing = dates.filter(date => !state.scheduleEntries.some(e => e.entry_date === date && ['shift','off'].includes(e.kind)));
    await saveWorkDays(missing.map(date => ({ date, day: { preset: legacy[date] } })));
    for (const date of dates) imported[date] = true;
    localStorage.setItem(markerKey, JSON.stringify(imported));
    if (conflicts.length) state.workShiftsImportError = `Per ${conflicts.length} giorni erano già presenti turni diversi nell’Agenda: li abbiamo mantenuti. Le scelte precedenti restano nel backup di questo browser. Puoi correggere i turni dalla scheda.`;
  } catch (error) {
    state.workShiftsImportError = `I turni salvati in precedenza restano conservati su questo browser. Importazione da riprovare: ${error.message}`;
  }
}

export function assertNoRunningTimer(existing) {
  const ids=new Set([existing.id,...state.scheduleEntries.filter(e=>e.shift_id===existing.id).map(e=>e.id)]);
  if ((state.agendaTimers || []).some(t=>ids.has(t.entry_id))) throw Error("Termina il timer prima di completare o eliminare l’impegno.");
}
