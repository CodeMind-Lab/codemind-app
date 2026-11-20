import { shiftDate, localISODate } from './dates.js?v=65';
// Categorie dell'agenda. Dal 20/11/2026 i clienti non hanno più una categoria propria:
// c'è solo "dev" (Sviluppo) e il cliente si vede dal progetto collegato (migrazione 012).
export const categories = { work: 'Lavoro', study: 'Studio', dev: 'Sviluppo', gym: 'Palestra', sleep: 'Sonno', relax: 'Relax', personal: 'Personale' };
export const defaultCategoryColors = Object.freeze({ work: '#0b1a2e', study: '#6cd4f0', dev: '#8f80ee', gym: '#ff664c', sleep: '#56708f', relax: '#1f7a6d', personal: '#6b7280' });
export const categoryColors = { ...defaultCategoryColors };
export function categoryTextColor(color) {
  const linear = hex => {
    const rgb = [1,3,5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const luminance = linear(color);
  if ((luminance + 0.05) / (linear('#0c2441') + 0.05) >= 4.5) return '#0c2441';
  return 1.05 / (luminance + 0.05) >= 4.5 ? '#ffffff' : '#000000';
}
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
export function weekStart(date) { return shiftDate(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7)); }
const wallFormatters = new Map();
export function wallTime(value, timezone = 'Europe/Rome') {
  if (!wallFormatters.has(timezone)) wallFormatters.set(timezone, new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const parts = wallFormatters.get(timezone).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Convert local wall time to an instant, including DST. Reject skipped clock times.
// A repeated autumn clock time selects the first occurrence.
export function toInstant(value, timezone = 'Europe/Rome') {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '') || !validDate(value.slice(0, 10)) || +value.slice(11, 13) > 23 || +value.slice(14) > 59) throw Error('Inserisci data e ora valide.');
  const target = Date.parse(value + ':00Z');
  const offsets = new Set([-36, 0, 36].map(h => {
    const probe = target + h * 3600000;
    return Date.parse(wallTime(probe, timezone) + ':00Z') - probe;
  }));
  const matches = [...offsets].map(offset => target - offset).filter(t => wallTime(t, timezone) === value).sort((a, b) => a - b);
  if (!matches.length) throw Error('Questo orario non esiste nel fuso scelto (cambio ora).');
  return new Date(matches[0]).toISOString();
}
export const minutesBetween = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / 60000);
export const hours = minutes => `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
export const timeLabel = (value, timezone) => value ? wallTime(value, timezone).slice(11) : '—';
export function intervalMinutes(start, end, from, to, timezone) {
  if (!start || !end) return 0;
  const left = Date.parse(toInstant(from + 'T00:00', timezone));
  const right = Date.parse(toInstant(shiftDate(to, 1) + 'T00:00', timezone));
  return Math.max(0, Math.round((Math.min(Date.parse(end), right) - Math.max(Date.parse(start), left)) / 60000));
}
export function dayEntries(entries, date, timezone) {
  return entries.filter(e => e.entry_date === date || (e.starts_at && intervalMinutes(e.starts_at, e.ends_at, date, date, timezone) > 0)).sort((a, b) => String(a.starts_at || 'z').localeCompare(String(b.starts_at || 'z')));
}
export function summary(entries, logs, from, to, timezone) {
  const left = Date.parse(toInstant(from + 'T00:00', timezone));
  const right = Date.parse(toInstant(shiftDate(to, 1) + 'T00:00', timezone));
  const clip = (start,end) => Math.max(0, Math.round((Math.min(Date.parse(end),right) - Math.max(Date.parse(start),left)) / 60000));
  const byCategory = Object.fromEntries(Object.keys(categories).map(k => [k, { planned: 0, actual: 0, sessions: 0 }]));
  for (const e of entries) {
    const minutes = e.starts_at ? clip(e.starts_at, e.ends_at) : e.entry_date >= from && e.entry_date <= to ? e.planned_minutes : 0;
    byCategory[e.category].planned += minutes || 0;
  }
  const entryById = new Map(entries.map(e => [e.id, e]));
  const logsByEntry = new Map();
  for (const log of logs) {
    if (!logsByEntry.has(log.entry_id)) logsByEntry.set(log.entry_id, []);
    logsByEntry.get(log.entry_id).push(log);
    const entry = entryById.get(log.entry_id);
    if (!entry) continue;
    byCategory[entry.category].actual += clip(log.started_at, log.ended_at);
  }
  // Sessions are completed entries with at least one recorded interval starting in the range.
  for (const e of entries.filter(e => e.is_completed)) if ((e.sport_session_key && e.entry_date >= from && e.entry_date <= to) || (logsByEntry.get(e.id) || []).some(l => localISODate(l.started_at, timezone) >= from && localISODate(l.started_at, timezone) <= to)) byCategory[e.category].sessions++;
  const values = Object.values(byCategory);
  return { byCategory, planned: values.reduce((n, x) => n + x.planned, 0), actual: values.reduce((n, x) => n + x.actual, 0) };
}
export function goalProgress(goal, entries, logs, timezone) {
  const to = shiftDate(goal.week_start, 6);
  const selected = entries.filter(e => e.category === goal.category && (!goal.project_id || e.project_id === goal.project_id));
  const data = summary(selected, logs, goal.week_start, to, timezone).byCategory[goal.category];
  return goal.unit === 'sessions' ? data.sessions : data.actual;
}
