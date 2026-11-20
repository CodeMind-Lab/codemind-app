import { wallTime, toInstant, validDate } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';
import { uid } from './helpers.js?v=65';

export const shiftPresets = Object.freeze({
  apertura: { label: 'Apertura', kind: 'shift', from: '07:30', to: '15:30' },
  chiusura: { label: 'Chiusura', kind: 'shift', from: '15:30', to: '23:30' },
  off: { label: 'OFF', kind: 'off', from: '', to: '' },
  notte: { label: 'Notte', kind: 'shift', from: '23:30', to: '07:30' },
});
export function shiftPreset(entry, timezone) {
  if (!entry) return '';
  if (entry.kind === 'off') return 'off';
  const from = wallTime(entry.starts_at, timezone).slice(11), to = wallTime(entry.ends_at, timezone).slice(11);
  return Object.keys(shiftPresets).find(key => shiftPresets[key].from === from && shiftPresets[key].to === to) || 'custom';
}
export function shiftValues(date, day, timezone) {
  if (!validDate(date)) throw Error('Giorno non valido.');
  const preset = day.preset ? shiftPresets[day.preset] : null;
  if (day.preset && !preset) throw Error('Turno non valido.');
  const { kind, from, to } = preset || day;
  if (!['shift', 'off'].includes(kind)) throw Error('Tipo di turno non valido.');
  const starts_at = kind === 'shift' ? toInstant(`${date}T${from}`, timezone) : null;
  const ends_at = kind === 'shift' ? toInstant(`${to <= from ? shiftDate(date, 1) : date}T${to}`, timezone) : null;
  return { kind, entry_date: date, starts_at, ends_at, title: kind === 'off' ? 'Giorno OFF' : preset ? `Lavoro · ${preset.label}` : 'Turno di lavoro' };
}
export function commuteValues(shift, leg, timezone) {
  const outbound = leg === 'outbound', edge = Date.parse(outbound ? shift.starts_at : shift.ends_at);
  const starts_at = new Date(edge - (outbound ? 30 : 0) * 60000).toISOString();
  const ends_at = new Date(edge + (outbound ? 0 : 30) * 60000).toISOString();
  return { shift_id: shift.id, commute_leg: leg, kind: 'commute', category: 'personal', title: outbound ? 'Tragitto · andata' : 'Tragitto · ritorno', entry_date: wallTime(starts_at, timezone).slice(0, 10), starts_at, ends_at, planned_minutes: 30 };
}
// Mirrors the database trigger in demo mode, preserving IDs and recorded time.
export function syncDemoCommutes(entries, shift, previous, timezone) {
  if (shift.kind !== 'shift') return entries.filter(e => e.shift_id !== shift.id);
  const changed = !previous || ['kind', 'starts_at', 'ends_at', 'entry_date'].some(key => previous[key] !== shift[key]);
  for (const leg of ['outbound', 'return']) {
    const values = commuteValues(shift, leg, timezone);
    let child = entries.find(e => e.shift_id === shift.id && e.commute_leg === leg);
    if (child && !changed) continue;
    child ||= entries.find(e => !e.shift_id && e.kind === 'commute' && e.title === values.title && e.starts_at === values.starts_at && e.ends_at === values.ends_at);
    const now = new Date().toISOString();
    const item = { notes: '', project_id: null, is_completed: false, completed_at: null, ...child, ...values, title: child?.title || values.title, category: child?.category || values.category, id: child?.id || uid(), created_at: child?.created_at || now, updated_at: now };
    entries = [...entries.filter(e => e.id !== item.id), item];
  }
  return entries;
}
