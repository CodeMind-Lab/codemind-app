import { wallTime, toInstant } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';

export const calendarHourHeight = 48;
export const minuteLabel = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const clockMinute = wall => Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16));
export const calendarStep = 15;
export const snapMinute = (minute, round = Math.round) => Math.min(1425, Math.max(0, round(minute / calendarStep) * calendarStep));
export const calendarWall = (date, minute) => `${shiftDate(date, Math.floor(minute / 1440))}T${minuteLabel((minute % 1440 + 1440) % 1440)}`;

export function calendarSelection(date, anchor, current = anchor, dragged = false) {
  const first = snapMinute(anchor, Math.floor);
  const start = dragged && current < first ? snapMinute(current, Math.floor) : first;
  const end = dragged ? Math.min(1440, Math.max(first + calendarStep, Math.ceil(current / calendarStep) * calendarStep)) : first + 60;
  return { date, start: calendarWall(date, start), end: calendarWall(date, end), startMinute: start, endMinute: end };
}

// Move the original interval as a whole, including a grabbed continuation.
// Effective logs are independent records and are deliberately not rescheduled.
export function movedCalendarEntry(entry, date, minute, timezone, grabOffset = 0) {
  if (entry.kind === 'off') return { entry_date: date };
  const duration = entry.starts_at ? Date.parse(entry.ends_at) - Date.parse(entry.starts_at) : (entry.planned_minutes || 60) * 60000;
  const from = Date.parse(toInstant(calendarWall(date, minute), timezone)) - grabOffset * 60000;
  const start = new Date(from).toISOString(), end = new Date(from + duration).toISOString();
  return { entry_date: wallTime(start, timezone).slice(0,10), starts_at: start, ends_at: end };
}

export function shiftedCalendarDay(entry, date, sourceDate, timezone) {
  const delta = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(sourceDate + 'T12:00:00Z')) / 86400000);
  const nextDate = shiftDate(entry.entry_date, delta);
  if (!entry.starts_at) return { entry_date: nextDate };
  return movedCalendarEntry(entry, nextDate, clockMinute(wallTime(entry.starts_at, timezone)), timezone);
}

// Group connected overlaps, then assign a lane. Short events reserve their
// visible hit area, so adjacent tiny blocks cannot cover each other's buttons.
export function layoutCalendarDay(segments) {
  const sorted = segments.map(s => ({ ...s, layoutEnd: Math.min(1440, Math.max(s.endMinute, s.startMinute + 30)) }))
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute || a.entry.id.localeCompare(b.entry.id));
  let group = [], lanes = [], groupEnd = -1;
  const flush = () => { for (const item of group) item.lanes = lanes.length; group = []; lanes = []; };
  for (const item of sorted) {
    if (item.startMinute >= groupEnd) flush();
    let lane = lanes.findIndex(end => end <= item.startMinute);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = item.layoutEnd;
    item.lane = lane;
    group.push(item);
    groupEnd = group.length === 1 ? item.layoutEnd : Math.max(groupEnd, item.layoutEnd);
  }
  flush();
  return sorted;
}

// Convert each interval once. Overnight events become independently clickable
// segments; durations still use real elapsed time on DST transition days.
export function calendarWeek(entries, days, timezone, category = '') {
  const result = days.map(date => ({ date, timed: [], untimed: [], planned: 0,
    from: Date.parse(toInstant(date + 'T00:00', timezone)),
    to: Date.parse(toInstant(shiftDate(date, 1) + 'T00:00', timezone)) }));
  const byDate = new Map(result.map(day => [day.date, day]));
  for (const entry of entries) {
    if (category && entry.category !== category) continue;
    if (!entry.starts_at || !entry.ends_at) {
      const day = byDate.get(entry.entry_date);
      if (day) { day.untimed.push(entry); day.planned += entry.planned_minutes || 0; }
      continue;
    }
    const from = Date.parse(entry.starts_at), to = Date.parse(entry.ends_at);
    if (!(to > from) || to <= result[0].from || from >= result.at(-1).to) continue;
    const start = wallTime(from, timezone), end = wallTime(to, timezone);
    for (const day of result) {
      const left = Math.max(from, day.from), right = Math.min(to, day.to);
      if (right <= left) continue;
      const startMinute = left === day.from ? 0 : clockMinute(start);
      let endMinute = right === day.to ? 1440 : clockMinute(end);
      // During the autumn clock repeat the end can appear before the start.
      if (endMinute <= startMinute) endMinute = Math.min(1440, startMinute + (right - left) / 60000);
      day.planned += Math.round((right - left) / 60000);
      day.timed.push({ entry, date: day.date, startMinute, endMinute,
        continuation: from < day.from, continues: to > day.to });
    }
  }
  for (const day of result) day.timed = layoutCalendarDay(day.timed);
  return result;
}
