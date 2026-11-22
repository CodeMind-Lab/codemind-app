import {agendaConflicts,candidateConflicts} from '../utils/agendaProductivity.js?v=65';
import {activeTimerPanel,timerDetailControl,entryConflictNote,conflictsPanel,bindAgendaProductivity,bindTimerControls} from './agendaProductivity.js?v=65';
import { loadAgendaColors, saveAgendaColors } from '../services/agendaPreferences.js?v=65';
import { state, projectOf } from '../services/store.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { categories, categoryColors, defaultCategoryColors, categoryTextColor, weekStart, hours, summary, dayEntries, wallTime, toInstant, timeLabel, goalProgress } from '../utils/agenda.js?v=65';
import { esc, icon } from '../utils/helpers.js?v=65';
import { openModal, closeModal, bindForm, options, field, confirmDelete, toast } from '../utils/dom.js?v=65';
import { saveEntry, saveLog, saveGoal, entryPayload, deleteAgenda, saveWorkWeek } from '../services/agendaService.js?v=65';
import { shiftPresets, shiftPreset } from '../utils/workShifts.js?v=65';
import { calendarWeek, calendarHourHeight, minuteLabel, scalaOre, oreConImpegni, yDaMinuto, impostaScala, scala } from '../utils/agendaCalendar.js?v=65';
let selectedWeek, view = 'week', categoryFilter = '';
const calendarScroll = new Map();
import { bindCalendarInteractions } from './agendaInteractions.js?v=65';
import { rigaAllenamentiFasce, rigaAllenamentiOre, bindAllenamentiAgenda } from './agendaAllenamento.js?v=2';
let calendarTimer, calendarDispose, lastMove;
let previewWeek, previewDate, previewFocusDate;
const dayLabel = date => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const projectOptions = selected => options(Object.fromEntries(state.projects.filter(p => p.status !== 'archived' || p.id === selected).map(p => [p.id, p.name])), selected, 'Nessun progetto');
const empty = text => `<p class="agenda-empty">${text}</p>`;
function rangeLabel(start, end) {
  const a = wallTime(start, state.timezone), b = wallTime(end, state.timezone);
  return `${a.slice(11)}–${b.slice(11)}${a.slice(0, 10) !== b.slice(0, 10) ? ' (+1 giorno)' : ''}`;
}
function entryCard(e, continuation = false) {
  const logs = state.timeLogs.filter(l => l.entry_id === e.id), actual = logs.reduce((n, l) => n + Math.round((Date.parse(l.ended_at) - Date.parse(l.started_at)) / 60000), 0);
  const time = e.kind === 'off' ? 'OFF' : e.starts_at ? rangeLabel(e.starts_at, e.ends_at) : e.entry_date ? 'Orario libero' : 'Da pianificare';
  return `<article class="agenda-entry ${e.is_completed ? 'is-done' : ''} ${!e.entry_date ? 'is-backlog' : ''}" style="--category-color:${categoryColors[e.category]};--category-ink:${categoryTextColor(categoryColors[e.category])}">
    <div class="agenda-entry-mark">${e.kind !== 'off' && e.entry_date ? `<button class="check-button ${e.is_completed ? 'done' : ''}" data-agenda-complete="${e.id}" aria-label="${e.is_completed ? 'Riapri' : 'Completa'} ${esc(e.title)}">${e.is_completed ? '✓' : ''}</button>` : '<span class="agenda-entry-dot"></span>'}</div>
    <div class="agenda-entry-content"><div class="agenda-entry-top"><span class="agenda-category">${categories[e.category]}</span><span class="agenda-time">${time}</span>${continuation ? '<span class="agenda-continuation">Dalla notte</span>' : ''}</div><button class="agenda-title" data-agenda-edit="${e.id}">${esc(e.title)}</button>${e.project_id ? `<a class="link agenda-project" href="#/projects/${e.project_id}">${esc(projectOf(e.project_id)?.name || '')} ↗</a>` : ''}${logs.length ? `<details class="agenda-entry-logs"><summary>${logs.length === 1 ? '1 intervallo registrato' : `${logs.length} intervalli registrati`}</summary>${logs.map(l => `<button class="agenda-log-preview" data-agenda-log="${e.id}" data-log-id="${l.id}">${rangeLabel(l.started_at, l.ended_at)} · Modifica</button>`).join('')}</details>` : ''}</div>
    <div class="agenda-duration"><span>Previsto ${hours(e.planned_minutes)}</span><strong class="${actual ? 'has-actual' : ''}">Effettivo ${hours(actual)}</strong></div>
    <div class="agenda-entry-actions">${e.kind !== 'off' ? `<button class="agenda-log-action" ${!e.entry_date ? `data-agenda-edit="${e.id}"` : `data-agenda-log="${e.id}"`}>${!e.entry_date ? 'Pianifica →' : '＋ Registra ore'}</button>` : `<button class="agenda-log-action" data-agenda-edit="${e.id}" aria-label="Modifica ${esc(e.title)}">Modifica</button>`}</div>
  </article>`;
}
function goalsPanel(start) {
  const goals = state.weeklyGoals.filter(g => g.week_start === start);
  return `<section class="panel agenda-goals"><div class="panel-head"><div><span class="agenda-section-kicker">I TUOI TRAGUARDI</span><h2>Obiettivi della settimana</h2></div><button class="agenda-add-link" data-agenda-goal-new>＋ Obiettivo</button></div><div class="agenda-goal-grid">${goals.map(g => {
    const value = goalProgress(g, state.scheduleEntries, state.timeLogs, state.timezone), percentage = Math.min(100, Math.round(value / g.target * 100));
    const format = n => g.unit === 'minutes' ? hours(n) : `${n} sessioni`;
    return `<button class="agenda-goal" data-agenda-goal="${g.id}" style="--category-color:${categoryColors[g.category]}"><div><strong>${esc(g.title)}</strong><span>${percentage}%</span></div><p>${format(value)} <span>/ ${format(g.target)}</span></p><div class="progress-track" role="progressbar" aria-label="${esc(g.title)}" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percentage}%"></span></div>${g.stretch_target > g.target ? `<small>Ideale ${format(g.stretch_target)}</small>` : ''}${g.project_id ? `<small>${esc(projectOf(g.project_id)?.name || '')}</small>` : ''}</button>`;
  }).join('') || empty('Scegli un obiettivo di studio, palestra o progetto per questa settimana.')}</div><p class="agenda-panel-footnote">Si aggiornano con le ore che registri. Tocca un obiettivo per modificarlo.</p></section>`;
}
export function agendaTodayPanel() {
  loadAgendaColors();
  const date = today(state.timezone), entries = dayEntries(state.scheduleEntries, date, state.timezone).slice(0, 3);
  return `<section class="panel day-priorities"><div class="panel-head"><h2>Impegni di oggi</h2><a class="link" href="#/today">Agenda →</a></div><div class="agenda-day-body">${entries.map(e => entryCard(e, e.entry_date !== date)).join('') || empty('La giornata è libera. Pianifica i tuoi impegni nell’agenda.')}</div></section>`;
}
// Reuse the calendar's day segments so nights and journeys keep the same dates.
const previewWeekday = date => new Intl.DateTimeFormat('it-IT', {weekday:'short', timeZone:'UTC'}).format(new Date(date + 'T12:00:00Z'));
function previewItems(day, includeJourneys = false) {
  const all = [...day.untimed.map(entry => ({entry})), ...day.timed];
  const commitments = all.filter(item => item.entry.kind !== 'commute');
  return includeJourneys || !commitments.length ? all : commitments;
}
function previewEvent(item, date, detail = false) {
  const e = item.entry;
  const time = e.kind === 'off' ? 'Giorno libero' : item.continuation ? `↳ ${minuteLabel(item.startMinute)}–${minuteLabel(item.endMinute)}` : e.starts_at ? rangeLabel(e.starts_at, e.ends_at) : 'Senza orario';
  const label = `${e.title}, ${categories[e.category]}, ${dayLabel(date)}, ${time}${item.continuation ? ', continua dalla notte precedente' : ''}${e.is_completed ? ', completato' : ''}`;
  return `<button class="mini-calendar-event ${detail ? 'is-detail' : ''} ${e.kind === 'off' ? 'is-off' : ''} ${e.is_completed ? 'is-done' : ''}" data-agenda-preview-entry="${e.id}" aria-label="${esc(label)}" title="${esc(label)}" style="--category-color:${categoryColors[e.category]}"><time>${time}</time><span>${e.is_completed ? '✓ ' : ''}${esc(e.title)}</span>${detail ? `<small>${categories[e.category]}${item.continuation ? ' · Dalla notte precedente' : ''}${e.project_id ? ` · ${esc(projectOf(e.project_id)?.name || '')}` : ''}</small>` : ''}</button>`;
}
export function agendaSummaryLink() {
  loadAgendaColors();
  const now = today(state.timezone), start = previewWeek || weekStart(now), end = shiftDate(start, 6);
  const data = summary(state.scheduleEntries, state.timeLogs, start, end, state.timezone);
  const days = calendarWeek(state.scheduleEntries, Array.from({length:7}, (_, i) => shiftDate(start, i)), state.timezone);
  if (!days.some(day => day.date === previewFocusDate)) previewFocusDate = now >= start && now <= end ? now : start;
  const available = state.mode !== 'cloud' || state.agendaAvailable;
  return `<section class="panel dashboard-mini-calendar" aria-labelledby="agenda-preview-title"><div class="mini-calendar-heading"><div class="mini-calendar-heading-title"><span class="mini-calendar-icon" aria-hidden="true">${icon('calendar')}</span><div><h2 id="agenda-preview-title">Agenda personale</h2><p>${weekLabel(start, end)}</p></div></div><div class="mini-calendar-heading-actions"><div class="mini-calendar-week-nav"><button data-agenda-preview-week="-1" aria-label="Settimana precedente agenda">‹</button><button data-agenda-preview-week="0">Questa settimana</button><button data-agenda-preview-week="1" aria-label="Settimana successiva agenda">›</button></div><a class="mini-calendar-open" href="#/today" data-agenda-preview-open>Apri Agenda <span aria-hidden="true">↗</span></a></div></div>${available ? `<div class="mini-calendar-mobile-days" role="group" aria-label="Scegli il giorno del riepilogo">${days.map(day => `<button data-preview-select="${day.date}" aria-label="Mostra ${dayLabel(day.date)}" aria-pressed="${day.date === previewFocusDate}" ${day.date === now ? 'aria-current="date"' : ''}><span>${previewWeekday(day.date)}</span><time datetime="${day.date}">${Number(day.date.slice(-2))}</time></button>`).join('')}</div><div class="mini-calendar-scroll" tabindex="0" role="region" aria-label="Riepilogo agenda da lunedì a domenica"><div class="mini-calendar-grid">${days.map(day => {
    const events = previewItems(day);
    return `<div class="mini-calendar-day ${day.date === now ? 'is-today' : ''}" data-preview-date="${day.date}"><button class="mini-calendar-date" data-agenda-preview-day="${day.date}" aria-label="Riepilogo ${dayLabel(day.date)}${events.length ? `, ${events.length} impegni` : ', giornata libera'}" ${day.date === now ? 'aria-current="date"' : ''}><span>${previewWeekday(day.date)}</span><time datetime="${day.date}">${Number(day.date.slice(-2))}</time>${day.date === now ? '<small>Oggi</small>' : ''}</button><div class="mini-calendar-events">${events.slice(0, 2).map(item => previewEvent(item, day.date)).join('') || '<div class="mini-calendar-free"><span aria-hidden="true">☀</span><span>Nessun impegno<small>Spazio per i tuoi programmi</small></span></div>'}</div>${events.length > 2 ? `<button class="mini-calendar-more" data-agenda-preview-day="${day.date}" aria-label="Altri ${events.length - 2} impegni, ${dayLabel(day.date)}">+ ${events.length - 2} ${events.length - 2 === 1 ? 'altro impegno' : 'altri impegni'} <span aria-hidden="true">→</span></button>` : '<span class="mini-calendar-more-spacer" aria-hidden="true"></span>'}</div>`;
  }).join('')}</div></div>` : '<p class="mini-calendar-unavailable">Agenda non disponibile. Aprila per aggiornare i dati.</p>'}<div class="mini-calendar-footer"><span>${available ? `<span><i class="mini-calendar-total-dot" aria-hidden="true"></i><strong>${hours(data.actual)}</strong> registrate</span><span class="mini-calendar-planned">${hours(data.planned)} pianificate</span>` : ''}</span><span class="mini-calendar-swipe-hint">Scorri per cambiare giorno ↔</span><span class="mini-calendar-desktop-hint">Tocca un impegno per i dettagli</span></div></section>`;
}
function openPreviewAgenda(date) {
  selectedWeek = previewWeek || weekStart(today(state.timezone));
  previewDate = date; view = 'week'; categoryFilter = ''; calendarScroll.delete(selectedWeek);
  location.hash = '#/today';
}
function previewDayDetails(date, render) {
  const day = calendarWeek(state.scheduleEntries, [date], state.timezone)[0];
  const items = previewItems(day, true);
  openModal(dayLabel(date), `<div class="mini-calendar-day-detail"><p class="mini-calendar-detail-intro">${date === today(state.timezone) ? 'I tuoi impegni di oggi' : 'Impegni del giorno'}${items.length ? ` · ${items.length} ${items.length === 1 ? 'evento' : 'eventi'}` : ''}</p><div class="mini-calendar-detail-list">${items.map(item => previewEvent(item, date, true)).join('') || '<p class="agenda-empty">La giornata è libera. Aggiungi i tuoi programmi nell’Agenda.</p>'}</div><div class="form-actions"><button class="btn primary" data-preview-detail-open>Apri questo giorno in Agenda →</button></div></div>`);
  document.querySelector('#modal [data-preview-detail-open]').onclick = () => {closeModal(); openPreviewAgenda(date);};
  document.querySelectorAll('#modal [data-agenda-preview-entry]').forEach(button => button.onclick = () => {closeModal(); eventDetails(button.dataset.agendaPreviewEntry, render);});
}
export function bindAgendaPreview(render) {
  document.querySelectorAll('[data-agenda-preview-week]').forEach(button => button.onclick = () => {
    const step = Number(button.dataset.agendaPreviewWeek);
    previewWeek = step === 0 ? weekStart(today(state.timezone)) : shiftDate(previewWeek || weekStart(today(state.timezone)), step * 7);
    previewFocusDate = null;
    render(); document.querySelector(`[data-agenda-preview-week="${step}"]`)?.focus({preventScroll:true});
  });
  document.querySelectorAll('[data-agenda-preview-open]').forEach(button => button.onclick = event => {event.preventDefault(); openPreviewAgenda(button.dataset.date);});
  document.querySelectorAll('[data-agenda-preview-day]').forEach(button => button.onclick = () => previewDayDetails(button.dataset.agendaPreviewDay, render));
  document.querySelectorAll('.dashboard-mini-calendar [data-agenda-preview-entry]').forEach(button => button.onclick = () => eventDetails(button.dataset.agendaPreviewEntry, render));
  const scroller = document.querySelector('.mini-calendar-scroll');
  if (!scroller) return;
  const days = [...scroller.querySelectorAll('[data-preview-date]')];
  let lastWidth = scroller.clientWidth;
  const mobile = () => matchMedia('(max-width:700px)').matches;
  const select = date => {
    previewFocusDate = date;
    document.querySelectorAll('[data-preview-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.previewSelect === date)));
  };
  const show = date => {
    const day = days.find(day => day.dataset.previewDate === date);
    if (day) scroller.scrollLeft = day.offsetLeft - days[0].offsetLeft;
    select(date);
  };
  document.querySelectorAll('[data-preview-select]').forEach(button => button.onclick = () => show(button.dataset.previewSelect));
  if (mobile()) show(previewFocusDate);
  // Native scrolling and snapping also update the accessible day selector.
  scroller.onscroll = () => {
    // Layout can emit scroll before ResizeObserver restores the selected day.
    if (!mobile() || scroller.clientWidth !== lastWidth) return;
    const left = scroller.scrollLeft + days[0].offsetLeft;
    const nearest = days.reduce((a,b) => Math.abs(a.offsetLeft - left) <= Math.abs(b.offsetLeft - left) ? a : b);
    select(nearest.dataset.previewDate);
  };
  const observer = new ResizeObserver(() => {
    if (!scroller.isConnected) {observer.disconnect(); return;}
    lastWidth = scroller.clientWidth;
    if (mobile()) show(previewFocusDate);
  });
  observer.observe(scroller);
  // Disconnect when the dashboard is removed or rendered again.
  previewResizeDispose?.(); previewResizeDispose = () => observer.disconnect();
}
let previewResizeDispose;
function weekLabel(start, end) {
  const month = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' });
  const a = new Date(start + 'T12:00:00Z'), b = new Date(end + 'T12:00:00Z');
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${month.format(b)} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${month.format(a)} – ${b.getUTCDate()} ${month.format(b)} ${b.getUTCFullYear()}`;
}
// Vista compatta (scelta il 20/11/2026, "Griglia con fasce"): mattina, pomeriggio e notte al
// posto delle 24 ore, senza i tragitti (restano nella Griglia oraria).
let vistaAgenda = (() => { try { return localStorage.getItem('cm-agenda-vista') || 'compatta'; } catch { return 'compatta'; } })();
const sceltaVista = () => `<div class="vista-agenda" role="group" aria-label="Vista della settimana"><button data-agenda-vista="compatta" aria-pressed="${vistaAgenda === 'compatta'}">Fasce</button><button data-agenda-vista="griglia" aria-pressed="${vistaAgenda === 'griglia'}">Ore</button></div>`;
// Tre fasce fisse al posto delle 24 ore, come i turni dell'hotel (scelte il 20/11/2026):
// mattina 7:30–15:30, pomeriggio 15:30–23:30, sera 23:30–7:30.
const FASCE = [['Mattina', 450, 930], ['Pomeriggio', 930, 1410], ['Sera', 1410, 1890]];
export function weekCompatta(days, now, perOggi = false) {
  const model = calendarWeek(state.scheduleEntries, days, state.timezone, categoryFilter);
  const conflictIds = new Set(agendaConflicts(state.scheduleEntries, days[0], days.at(-1), state.timezone).flatMap(c => [c.a.id, c.b.id]));
  const weekday = date => new Intl.DateTimeFormat('it-IT', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  const stile = e => `--category-color:${categoryColors[e.category]};--category-ink:${categoryTextColor(categoryColors[e.category])}`;
  // La sera comprende 23:30–24 e 0–7:30 dello stesso giorno: i minuti dopo mezzanotte valgono +1440.
  const nellaFascia = (x, [, da, a]) => { const tratti = da < 1440 && a > 1440 ? [[da, 1440], [0, a - 1440]] : [[da, a]]; return tratti.some(([i, f]) => x.startMinute < f && x.endMinute > i); };
  const lavoro = e => e.kind === 'shift' || e.category === 'work';
  const voce = x => { const e = x.entry, orario = `${minuteLabel(x.startMinute)}–${x.endMinute === 1440 ? '24:00' : minuteLabel(x.endMinute)}`;
    return `<button class="fasce-voce ${lavoro(e) ? 'is-lavoro' : ''} ${e.is_completed ? 'is-done' : ''} ${conflictIds.has(e.id) ? 'is-conflict' : ''}" data-compatta-evento="${e.id}" style="${stile(e)}" title="${esc(e.title)} · ${orario}"><b>${e.is_completed ? '✓ ' : ''}${x.continuation ? '↳ ' : ''}${esc(lavoro(e) ? e.title.replace(/^Lavoro\s*·\s*/, '') : e.title)}</b><time>${orario}</time></button>`; };
  const celle = fascia => model.map(day => `<div class="fasce-cella ${day.date === now ? 'is-today' : ''}">${day.timed.filter(x => x.entry.kind !== 'commute' && nellaFascia(x, fascia)).sort((a, b) => a.startMinute - b.startMinute).map(voce).join('')}</div>`).join('');
  return `<section class="panel agenda-week-panel calendar-panel agenda-fasce ${perOggi ? 'fasce-oggi' : ''}" aria-label="Settimana per fasce"><div class="calendar-panel-bar"><span><i class="calendar-planned-dot"></i>${perOggi ? 'La settimana' : 'Impegni della settimana'}</span>${perOggi ? '<a class="fasce-apri" href="#/today">Apri Agenda →</a>' : `${sceltaVista()}<div class="calendar-tools"><button class="calendar-colors-button" data-agenda-colors>Colori</button></div>`}</div>
    <div class="fasce-scroll"><div class="fasce-griglia">
      <div class="fasce-angolo"></div>${model.map(day => `<header class="fasce-giorno ${day.date === now ? 'is-today' : ''}"><span>${weekday(day.date)}</span><time datetime="${day.date}">${Number(day.date.slice(-2))}</time><button data-agenda-new data-date="${day.date}" aria-label="Aggiungi impegno ${dayLabel(day.date)}">＋</button></header>`).join('')}
      <div class="fasce-etichetta piccola">Senza orario</div>${model.map(day => `<div class="fasce-cella senza-ora ${day.date === now ? 'is-today' : ''}">${day.untimed.map(e => `<button class="fasce-voce ${e.kind === 'off' ? 'is-off' : ''} ${e.is_completed ? 'is-done' : ''}" data-compatta-evento="${e.id}" style="${stile(e)}" title="${esc(e.title)}"><b>${e.kind === 'off' ? '☀ ' : ''}${esc(e.title)}</b></button>`).join('')}</div>`).join('')}
      ${rigaAllenamentiFasce(model.map(day => day.date), now)}
      ${FASCE.map(f => `<div class="fasce-etichetta"><b>${f[0]}</b><small>${minuteLabel(f[1])}–${minuteLabel(f[2] % 1440)}</small></div>${celle(f)}`).join('')}
    </div></div></section>`;
}
function weekCalendar(days, now) {
  if (vistaAgenda === 'compatta') return weekCompatta(days, now);
  const model = calendarWeek(state.scheduleEntries, days, state.timezone, categoryFilter);
  const conflictIds=new Set(agendaConflicts(state.scheduleEntries,days[0],days.at(-1),state.timezone).flatMap(c=>[c.a.id,c.b.id]));
  const actualByEntry = new Map();
  for (const log of state.timeLogs) actualByEntry.set(log.entry_id, (actualByEntry.get(log.entry_id) || 0) + Math.round((Date.parse(log.ended_at) - Date.parse(log.started_at)) / 60000));
  const current = wallTime(Date.now(), state.timezone), currentMinute = Number(current.slice(11,13)) * 60 + Number(current.slice(14));
  // Agenda compatta: alte solo le ore con impegni nella settimana, le altre ridotte a una fascia.
  const sc = scalaOre(oreConImpegni(model.flatMap(d => d.timed))); impostaScala(sc);
  const righeOre = Array.from({ length: 24 }, (_, o) => sc.visibili.has(o) ? `<i class="riga-ora" style="top:${sc.inizio[o]}px"></i><i class="riga-mezz" style="top:${sc.inizio[o] + sc.h[o] / 2}px"></i>` : `<i class="ora-vuota" style="top:${sc.inizio[o]}px;height:${sc.h[o]}px"></i>`).join('');
  const weekday = date => new Intl.DateTimeFormat('it-IT', { weekday:'short', timeZone:'UTC' }).format(new Date(date + 'T12:00:00Z'));
  const event = segment => {
    const e = segment.entry, actual = actualByEntry.get(e.id) || 0, duration = segment.endMinute - segment.startMinute;
    const label = `${e.title}, ${categories[e.category]}, ${dayLabel(segment.date)}, ${minuteLabel(segment.startMinute)}–${minuteLabel(segment.endMinute)}${segment.continuation ? ', continua dalla notte precedente' : ''}${segment.continues ? ', continua domani' : ''}${e.is_completed ? ', completato' : ''}${conflictIds.has(e.id) ? ', orario sovrapposto' : ''}`;
    return `<button class="calendar-event ${e.kind === 'commute' ? 'calendar-commute' : ''} ${e.is_completed ? 'is-done' : ''} ${duration < 60 ? 'is-short' : ''} ${conflictIds.has(e.id) ? 'is-conflict' : ''}" data-agenda-event="${e.id}" data-category="${e.category}" data-date="${segment.date}" aria-describedby="calendar-interaction-help" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" aria-label="${esc(label)}" title="${esc(e.title)} · ${rangeLabel(e.starts_at,e.ends_at)} · ${hours(e.planned_minutes)} previste${actual ? ` · ${hours(actual)} registrate` : ''}" style="--category-color:${categoryColors[e.category]};--category-ink:${categoryTextColor(categoryColors[e.category])};top:${yDaMinuto(scala(), segment.startMinute)}px;height:${Math.max(16,yDaMinuto(scala(), segment.endMinute) - yDaMinuto(scala(), segment.startMinute) - 2)}px;left:calc(${segment.lane / segment.lanes * 100}% + 2px);width:calc(${100 / segment.lanes}% - 4px)"><span class="calendar-drag-handle" aria-hidden="true" title="Trascina per spostare">⠿</span>${conflictIds.has(e.id) ? '<span class="calendar-conflict-badge" aria-hidden="true">!</span>' : ''}<strong>${e.is_completed ? '✓ ' : ''}${segment.continuation ? '↳ ' : ''}${esc(e.title)}</strong><span class="calendar-event-time">${minuteLabel(segment.startMinute)}–${minuteLabel(segment.endMinute)}${segment.continues ? ' ↗' : ''}</span>${duration >= 150 ? `<span class="calendar-event-category">${categories[e.category]}</span>` : ''}${actual && duration >= 180 ? `<span class="calendar-event-actual">${hours(actual)} registrate</span>` : ''}</button>`;
  };
  return `<section class="panel agenda-week-panel calendar-panel" aria-label="Calendario settimanale" style="--altezza-giorno:${sc.totale}px"><div class="calendar-panel-bar"><span><i class="calendar-planned-dot"></i>Impegni pianificati</span><span class="calendar-help">Seleziona una fascia oraria · Trascina un impegno per spostarlo</span>${sceltaVista()}<div class="calendar-tools"><button class="calendar-colors-button" data-agenda-colors>Colori</button><button class="calendar-select-button" data-calendar-select aria-label="Seleziona orario" aria-pressed="false">Seleziona orario</button></div></div><div class="calendar-scroll" tabindex="0" role="region" aria-label="Settimana da lunedì a domenica, orari da 00:00 a 24:00. Scorri per vedere tutti i giorni e gli orari."><div class="calendar-canvas"><div class="calendar-day-headers"><div class="calendar-corner">${esc(state.timezone === 'Europe/Rome' ? 'Roma' : state.timezone)}</div>${model.map(day => `<header class="calendar-day-header ${day.date === now ? 'is-today' : ''}" data-date="${day.date}"><span>${weekday(day.date)}</span><time datetime="${day.date}">${Number(day.date.slice(-2))}</time><small>${hours(day.planned)} previste</small><button data-agenda-new data-date="${day.date}" aria-label="Aggiungi impegno ${dayLabel(day.date)}">＋</button></header>`).join('')}${rigaAllenamentiOre(days, now)}</div><div class="calendar-untimed-row"><span class="calendar-corner">Senza orario</span>${model.map(day => `<div class="calendar-untimed-cell" data-date="${day.date}">${day.untimed.map(e => `<button class="calendar-untimed-event ${e.kind === 'off' ? 'calendar-off' : ''} ${e.is_completed ? 'is-done' : ''}" data-agenda-event="${e.id}" data-date="${day.date}" aria-describedby="calendar-interaction-help" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight" style="--category-color:${categoryColors[e.category]};--category-ink:${categoryTextColor(categoryColors[e.category])}" title="${esc(e.title)}"><span class="calendar-drag-handle" aria-hidden="true" title="Trascina per spostare">⠿</span>${e.is_completed ? '✓ ' : ''}${e.kind === 'off' ? '☀ ' : ''}${esc(e.title)}</button>`).join('')}</div>`).join('')}</div><div class="calendar-timed-grid"><div class="calendar-time-axis" aria-hidden="true">${Array.from({length:24},(_,hour) => hour).filter(hour => sc.visibili.has(hour)).map(hour => `<span style="top:${sc.inizio[hour]}px">${minuteLabel(hour*60)}</span>`).join('')}</div>${model.map(day => `<div class="calendar-day-column ${day.date === now ? 'is-today' : ''}" data-calendar-day="${day.date}" aria-label="${dayLabel(day.date)}">${righeOre}${day.timed.map(event).join('')}${day.date === now ? `<div class="calendar-now-line" style="top:${yDaMinuto(sc, currentMinute)}px" aria-label="Ora attuale ${current.slice(11)}"><i></i></div>` : ''}</div>`).join('')}</div></div></div><div class="calendar-footer"><span data-calendar-status role="status" aria-live="polite">Trascina gli impegni per spostarli.</span>${lastMove ? '<button class="calendar-undo-button" data-calendar-undo>↶ Annulla spostamento</button>' : ''}<span id="calendar-interaction-help" class="sr-only">Trascina la maniglia per spostare. Con la tastiera: Alt e frecce su o giù spostano di 15 minuti, Alt e frecce sinistra o destra cambiano giorno. Le ore effettive restano nel consuntivo.</span></div></section>`;
}
function confirmEntryDelete(entry, render) {
  const ids = new Set([entry.id, ...state.scheduleEntries.filter(e => e.shift_id === entry.id).map(e => e.id)]);
  const hasLogs = state.timeLogs.some(log => ids.has(log.entry_id));
  const message = `Eliminare “${entry.title}”?${entry.kind === 'shift' ? ' Verranno eliminati anche i tragitti collegati.' : ''}${hasLogs ? ' Verranno eliminati anche gli intervalli effettivi registrati per questi eventi.' : ''}`;
  confirmDelete(message, async () => {
    await deleteAgenda('schedule_entries', entry);
    if (lastMove?.saved.id === entry.id) lastMove = null;
    render();
  });
}
function eventDetails(entryId, render) {
  const e = state.scheduleEntries.find(e => e.id === entryId);
  if (!e) return;
  const logs = state.timeLogs.filter(l => l.entry_id === e.id).sort((a,b) => a.started_at.localeCompare(b.started_at));
  const actual = logs.reduce((n,l) => n + Math.round((Date.parse(l.ended_at) - Date.parse(l.started_at)) / 60000),0);
  openModal(e.title, `<div class="calendar-detail" style="--category-color:${categoryColors[e.category]};--category-ink:${categoryTextColor(categoryColors[e.category])}"><div class="calendar-detail-heading"><span class="calendar-detail-category">${categories[e.category]}${e.is_completed ? ' · Completato' : ''}</span><button type="button" class="btn danger calendar-detail-delete" data-detail-delete>Elimina evento</button></div><p class="calendar-detail-date">${e.entry_date ? dayLabel(e.entry_date) : 'Nel backlog'}${e.starts_at ? `<strong>${rangeLabel(e.starts_at,e.ends_at)}</strong>` : '<strong>Senza orario</strong>'}</p>${e.kind !== 'off' ? `<div class="calendar-detail-totals"><div><span>Tempo previsto</span><strong>${hours(e.planned_minutes)}</strong></div><div><span>Tempo effettivo</span><strong>${hours(actual)}</strong></div></div>` : ''}${e.project_id ? `<a class="link" href="#/projects/${e.project_id}">${esc(projectOf(e.project_id)?.name || '')} ↗</a>` : ''}${e.notes ? `<p class="calendar-detail-notes">${esc(e.notes)}</p>` : ''}${logs.length ? `<div class="calendar-detail-logs"><h3>Intervalli effettivi</h3>${logs.map(l => `<button data-detail-log="${l.id}"><strong>${dayLabel(wallTime(l.started_at,state.timezone).slice(0,10))}</strong><span>${rangeLabel(l.started_at,l.ended_at)} · Modifica →</span></button>`).join('')}</div>` : ''}${entryConflictNote(e)}${timerDetailControl(e)}<div class="calendar-detail-actions"><button class="btn" data-detail-edit autofocus>Modifica impegno</button>${e.kind !== 'off' && e.entry_date ? `<button class="btn primary" data-detail-record>＋ Registra ore</button><button class="btn" data-detail-complete>${e.is_completed ? 'Riapri attività' : 'Completa attività'}</button>` : ''}</div><p class="form-error" role="alert"></p></div>`);
  const dialog = document.querySelector('#modal');
  dialog.querySelector('[data-detail-edit]').onclick = () => entryForm(e,render);
  dialog.querySelector('[data-detail-delete]').onclick = () => confirmEntryDelete(e,render);
  dialog.querySelector('[data-detail-record]')?.addEventListener('click',() => logForm(e.id,null,render));
  dialog.querySelectorAll('[data-detail-log]').forEach(b => b.onclick = () => logForm(e.id,b.dataset.detailLog,render));
  dialog.querySelector('[data-detail-complete]')?.addEventListener('click', async event => {
    event.target.disabled = true;
    try { await saveEntry({ ...entryPayload(e), is_completed: !e.is_completed },e); closeModal(); render(); }
    catch (error) { dialog.querySelector('.form-error').textContent = error.message; event.target.disabled = false; }
  });
  dialog.querySelector('a')?.addEventListener('click',closeModal);
  bindTimerControls(render,id=>eventDetails(id,render),dialog);
}
export function agendaPage() {
  loadAgendaColors();
  selectedWeek ||= weekStart(today(state.timezone));
  const start = selectedWeek, end = shiftDate(start, 6), now = today(state.timezone);
  if (state.mode === 'cloud' && !state.agendaAvailable) return `<div class="page-heading"><h1>Agenda personale</h1></div><section class="panel empty"><p>${esc(state.agendaError)}</p><button class="btn" data-action="refresh">Aggiorna dati</button></section>`;
  const data = summary(state.scheduleEntries, state.timeLogs, start, end, state.timezone), backlog = state.scheduleEntries.filter(e => !e.entry_date);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const reportControls = `<div class="agenda-totals"><div class="panel"><span>Tempo pianificato</span><strong>${hours(data.planned)}</strong><small>Il programma della settimana</small></div><div class="panel agenda-total-actual"><span>Tempo registrato</span><strong>${hours(data.actual)}</strong><small>Gli intervalli che hai inserito</small></div><div class="panel"><span>Studio</span><strong>${hours(data.byCategory.study.actual)}</strong><small>Ore effettive</small></div><div class="panel"><span>Palestra</span><strong>${data.byCategory.gym.sessions} <small>sessioni</small></strong><small>Completate con ore registrate</small></div></div>
    <div class="agenda-viewbar"><div class="agenda-tabs" role="group" aria-label="Vista agenda"><button data-agenda-view="week" aria-pressed="${view === 'week'}" class="${view === 'week' ? 'selected' : ''}">${icon('calendar')} Settimana</button><button data-agenda-view="history" aria-pressed="${view === 'history'}" class="${view === 'history' ? 'selected' : ''}">${icon('statistics')} Consuntivo e grafici</button></div>${view === 'week' ? `<label class="agenda-filter"><span class="sr-only">Filtra agenda per categoria</span><select data-agenda-category aria-label="Filtra agenda per categoria">${options(categories,categoryFilter,'Tutte le categorie')}</select></label>` : '<span class="agenda-report-hint">Le tue ore, previste e reali</span>'}</div>
  ${view === 'week' ? `<div class="calendar-categories" role="group" aria-label="Categorie degli impegni">${Object.entries(categories).map(([key,name]) => `<button data-calendar-category="${key}" aria-pressed="${categoryFilter === key}" class="${categoryFilter && categoryFilter !== key ? 'is-muted' : ''}" style="--category-color:${categoryColors[key]}"><i></i>${name}</button>`).join('')}</div>` : ''}`;
  return `<div class="agenda-page"><div class="page-heading agenda-heading"><div><span class="page-eyebrow">SPAZIO AL TUO TEMPO</span><h1>Agenda personale</h1><p class="subtext">La tua settimana, a colpo d’occhio.</p></div><div class="heading-actions"><button class="btn agenda-search-button" data-agenda-search aria-label="Cerca nell’Agenda">${icon('search')}<span>Cerca</span></button><button class="btn agenda-shifts-button" data-agenda-shifts aria-label="Turni settimana">${icon('calendar')}<span>Turni settimana</span></button><button class="btn primary agenda-create-button" data-agenda-new aria-label="＋ Impegno"><span class="agenda-new-icon" aria-hidden="true">＋</span><span class="agenda-new-label">Impegno</span></button></div></div>
  <div class="agenda-toolbar"><div class="agenda-week-nav"><button class="agenda-nav-arrow" data-agenda-week="-1" aria-label="Settimana precedente">‹</button><div><span class="agenda-section-kicker">LA TUA SETTIMANA</span><strong>${weekLabel(start,end)}</strong></div><button class="agenda-nav-arrow" data-agenda-week="1" aria-label="Settimana successiva">›</button></div><div class="agenda-toolbar-actions"><button class="btn" data-agenda-prepare>Prepara settimana</button><button class="btn" data-agenda-current>Questa settimana</button><label class="agenda-date-label"><span class="sr-only">Vai alla settimana</span><input type="date" value="${start}" data-agenda-week-date aria-label="Vai alla settimana"></label></div></div>
  ${activeTimerPanel()}<div class="agenda-layout calendar-layout"><div class="agenda-primary">${view === 'history' ? reportControls : ''}${view === 'week' ? weekCalendar(days,now) : agendaStatistics(start)}${view === 'week' ? conflictsPanel(start) + reportControls + agendaWeeklyChart(start) : ''}
  <details class="agenda-routine"><summary><span>La tua routine</span><span>Sonno 6–7 h · Tragitto 30 min</span><span>⌄</span></summary><div class="agenda-context"><span>Sonno target 6–7 h</span><span>Apertura: sveglia 06:00</span><span>Chiusura: sveglia 07:30</span><span>Tragitto 30 min per tratta</span><span>Fuso: ${esc(state.timezone)}</span></div></details></div>
  <aside class="agenda-secondary" aria-label="Obiettivi e attività da pianificare">${goalsPanel(start)}<section class="panel agenda-backlog"><div class="panel-head"><div><span class="agenda-section-kicker">DA ORGANIZZARE</span><h2>Backlog personale</h2></div><button class="agenda-add-link" data-agenda-new data-backlog>＋ Nel backlog</button></div><div class="agenda-backlog-grid">${backlog.map(e => entryCard(e)).join('') || empty('Conserva qui le idee. Scegli quando occupartene.')}</div></section></aside></div></div>`;
}
function recordedTimeline(logs, days) {
  return `<section class="panel agenda-timeline"><div class="panel-head"><div><h2>Quando hai lavorato</h2><p class="subtext">Fasce orarie effettive per giorno · Tocca un intervallo per modificarlo</p></div></div><div class="agenda-timeline-body"><div class="agenda-time-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>${days.map(date => {
    const from = Date.parse(toInstant(date + 'T00:00', state.timezone)), to = Date.parse(toInstant(shiftDate(date, 1) + 'T00:00', state.timezone));
    const daily = logs.filter(l => Date.parse(l.started_at) < to && Date.parse(l.ended_at) > from);
    return `<div class="agenda-timeline-day"><strong>${dayLabel(date)}</strong>${daily.map(l => {
      const e = state.scheduleEntries.find(e => e.id === l.entry_id), a = Math.max(from, Date.parse(l.started_at)), b = Math.min(to, Date.parse(l.ended_at));
      const label = `${esc(e.title)} · ${timeLabel(a, state.timezone)}–${b === to ? '24:00' : timeLabel(b, state.timezone)}`;
      return `<button class="agenda-timeline-log" data-agenda-log="${e.id}" data-log-id="${l.id}"><span class="agenda-timeline-track" aria-hidden="true"><i style="left:${(a-from)/(to-from)*100}%;width:${(b-a)/(to-from)*100}%;background:${categoryColors[e.category]}"></i></span><span>${label}</span></button>`;
    }).join('') || '<span class="muted">Nessun intervallo</span>'}</div>`;
  }).join('')}</div></section>`;
}
export function agendaWeeklyChart(start = weekStart(today(state.timezone))) {
  if (state.mode === 'cloud' && !state.agendaAvailable) return '';
  const end = shiftDate(start, 6), now = today(state.timezone);
  const days = Array.from({length:7}, (_, i) => {
    const date = shiftDate(start, i);
    return {date, ...summary(state.scheduleEntries, state.timeLogs, date, date, state.timezone)};
  });
  const cap = Math.max(60, Math.ceil(Math.max(...days.flatMap(d => [d.planned, d.actual])) / 60) * 60);
  const planned = days.reduce((sum,d) => sum + d.planned, 0), actual = days.reduce((sum,d) => sum + d.actual, 0);
  return `<section class="panel weekly-hours-panel" aria-label="Grafico ore della settimana"><div class="weekly-hours-heading"><div><h2>Ore della settimana</h2><p>${weekLabel(start,end)}</p></div><div class="weekly-hours-total"><strong>${hours(actual)}</strong><span>registrate su ${hours(planned)} pianificate</span></div></div><div class="weekly-hours-legend"><span><i class="weekly-planned-key"></i>Pianificate</span><span><i class="weekly-actual-key"></i>Registrate</span></div><div class="weekly-hours-chart" role="img" aria-label="${esc(days.map(d => `${dayLabel(d.date)}: ${hours(d.planned)} pianificate, ${hours(d.actual)} registrate`).join('; '))}"><div class="weekly-hours-axis" aria-hidden="true">${[1,.75,.5,.25,0].map(f => `<span>${hours(cap*f)}</span>`).join('')}</div><div class="weekly-hours-columns">${days.map(d => `<div class="weekly-hours-day ${d.date === now ? 'is-today' : ''}"><div class="weekly-hours-bars" title="${esc(dayLabel(d.date))}: ${hours(d.actual)} registrate / ${hours(d.planned)} pianificate"><span class="weekly-hours-bar is-planned" style="height:${d.planned / cap * 100}%"></span><span class="weekly-hours-bar is-actual" style="height:${d.actual / cap * 100}%"></span></div><strong>${dayLabel(d.date).split(' ')[0].slice(0,3)}</strong><small>${hours(d.actual)} <span>/ ${hours(d.planned)}</span></small></div>`).join('')}</div></div>${!actual ? '<p class="weekly-hours-empty">Nessun intervallo registrato questa settimana.</p>' : ''}</section>`;
}
export function agendaStatistics(start = weekStart(today(state.timezone))) {
  loadAgendaColors();
  const end = shiftDate(start, 6), data = summary(state.scheduleEntries, state.timeLogs, start, end, state.timezone), days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const entryIds = new Set(state.scheduleEntries.map(e => e.id));
  const from = Date.parse(toInstant(start + 'T00:00',state.timezone)), to = Date.parse(toInstant(shiftDate(end,1) + 'T00:00',state.timezone));
  const logs = state.timeLogs.filter(l => entryIds.has(l.entry_id) && Math.round((Math.min(Date.parse(l.ended_at),to) - Math.max(Date.parse(l.started_at),from)) / 60000) > 0).sort((a, b) => a.started_at.localeCompare(b.started_at));
  return `${agendaWeeklyChart(start)}
  <section class="panel agenda-category-stats"><div class="panel-head"><h2>Tempo per categoria</h2></div><div class="agenda-stat-body">${Object.entries(categories).filter(([k]) => data.byCategory[k].planned || data.byCategory[k].actual).map(([k, name]) => { const d = data.byCategory[k]; const cap = Math.max(60, ...Object.values(data.byCategory).flatMap(value => [value.planned, value.actual])); return `<div class="agenda-category-row"><div><strong><span class="agenda-dot" style="background:${categoryColors[k]}"></span>${name}</strong><span>${hours(d.planned)} previste / ${hours(d.actual)} effettive</span></div><div class="agenda-mini-track"><i style="width:${d.planned / cap * 100}%"></i><b style="width:${d.actual / cap * 100}%"></b></div></div>`; }).join('')}</div></section>
  ${recordedTimeline(logs, days)}<section class="panel agenda-history"><div class="panel-head"><div><h2>Storico giornaliero</h2><p class="subtext">Inizio e fine inseriti da te · Modifica un intervallo per correggere le ore</p></div></div><div class="agenda-history-body">${days.map(d => { const s = summary(state.scheduleEntries, state.timeLogs, d, d, state.timezone); return `<div class="agenda-history-day"><strong>${dayLabel(d)}</strong><span>${hours(s.actual)} effettive / ${hours(s.planned)} previste</span></div>`; }).join('')}${logs.map(l => { const e = state.scheduleEntries.find(e => e.id === l.entry_id); return `<button class="agenda-history-log" data-agenda-log="${e.id}" data-log-id="${l.id}"><strong>${esc(e.title)}</strong><span>${dayLabel(wallTime(l.started_at, state.timezone).slice(0, 10))} · ${rangeLabel(l.started_at, l.ended_at)}</span><span>${hours(l.duration_minutes ?? Math.round((Date.parse(l.ended_at) - Date.parse(l.started_at)) / 60000))} · Modifica →</span></button>`; }).join('') || empty('Nessun intervallo registrato. Usa “Registra ore” accanto a un impegno.')}</div></section>`;
}
export function entryForm(existing, render, defaults = {}) {
  const e = existing || { title: defaults.title || '', category: defaults.kind === 'shift' ? 'work' : defaults.category || categoryFilter || 'personal', kind: defaults.kind || 'activity', entry_date: defaults.backlog ? null : defaults.date || selectedWeek || today(state.timezone), planned_minutes: 60 };
  const start = e.starts_at ? wallTime(e.starts_at, state.timezone) : defaults.start || '', end = e.ends_at ? wallTime(e.ends_at, state.timezone) : defaults.end || '';
  openModal(existing ? 'Modifica impegno' : 'Nuovo impegno', `<form id="agenda-entry-form"><div class="form-grid">${field('Titolo', 'title', e.title || '', 'text', 'required maxlength="200" class="agenda-title-input"')}<label class="field">Categoria<select name="category">${options(categories, e.category)}</select></label><label class="field">Tipo<select name="kind">${options({ activity: 'Impegno', shift: 'Turno di lavoro', off: 'Giorno OFF', commute: 'Tragitto' }, e.kind)}</select></label>${field('Giorno (vuoto = backlog)', 'entry_date', e.entry_date || '', 'date')}${field('Inizio previsto', 'start_time', start.slice(11), 'time')}${field('Fine prevista', 'end_time', end.slice(11), 'time')}<label class="field"><span>Fine il giorno successivo</span><input type="checkbox" name="next_day" ${start && end && start.slice(0, 10) !== end.slice(0, 10) ? 'checked' : ''}></label>${field('Minuti previsti (senza orari)', 'planned_minutes', e.planned_minutes, 'number', 'min="0" max="1440" step="1"')}<label class="field full">Progetto facoltativo<select name="project_id">${projectOptions(e.project_id)}</select></label><label class="field full">Appunti<textarea name="notes" maxlength="5000">${esc(e.notes || '')}</textarea></label>${e.entry_date && e.kind !== 'off' ? `<label class="field full"><span>Attività completata</span><input name="is_completed" type="checkbox" ${e.is_completed ? 'checked' : ''}></label>` : ''}</div><div class="agenda-entry-warning" data-entry-conflicts role="status" hidden></div><p class="subtext">Per i turni scegli Lavoro. Per la notte indica “giorno successivo”. La durata prevista viene calcolata dagli orari. Il completamento non aggiunge ore effettive.</p><div class="form-actions">${existing ? '<button type="button" class="btn danger" data-agenda-delete-entry>Elimina</button>' : ''}<button type="submit" class="btn primary">Salva impegno</button></div><p class="form-error" role="alert"></p></form>`);
  const form = document.getElementById('agenda-entry-form');
  const kind = form.elements.kind, cat = form.elements.category;
  kind.onchange = () => { if (['shift', 'off'].includes(kind.value)) cat.value = 'work'; if (kind.value === 'off') { form.elements.start_time.value = ''; form.elements.end_time.value = ''; form.elements.planned_minutes.value = 0; } };
  bindForm('agenda-entry-form', async data => {
    const date = String(data.get('entry_date')), from = String(data.get('start_time')), to = String(data.get('end_time'));
    if (!date && (from || to)) throw Error('Inserisci un giorno per gli orari o rimuovili per il backlog.');
    if (!!from !== !!to) throw Error('Compila entrambi gli orari.');
    const starts_at = from ? toInstant(`${date}T${from}`, state.timezone) : null, ends_at = to ? toInstant(`${data.has('next_day') ? shiftDate(date, 1) : date}T${to}`, state.timezone) : null;
    await saveEntry({ title: data.get('title'), category: data.get('category'), kind: data.get('kind'), entry_date: date, starts_at, ends_at, planned_minutes: data.get('planned_minutes'), notes: data.get('notes'), project_id: data.get('project_id'), is_completed: data.has('is_completed') }, existing); render();
  });
  const updateConflicts=()=>{
    const warning=form.querySelector('[data-entry-conflicts]');
    try {
      const date=form.elements.entry_date.value,from=form.elements.start_time.value,to=form.elements.end_time.value;
      const values={title:form.elements.title.value||'Nuovo impegno',category:cat.value,kind:kind.value,entry_date:date,starts_at:from&&date?toInstant(`${date}T${from}`,state.timezone):null,ends_at:to&&date?toInstant(`${form.elements.next_day.checked?shiftDate(date,1):date}T${to}`,state.timezone):null,is_completed:!!form.elements.is_completed?.checked};
      const conflicts=candidateConflicts(values,existing,state.scheduleEntries,state.timezone);
      warning.hidden=!conflicts.length;
      warning.innerHTML=conflicts.length?`<strong>! Orari sovrapposti</strong>${conflicts.map(c=>`<span>${esc(c.a.title)} ↔ ${esc(c.b.title)} · ${rangeLabel(c.start,c.end)}</span>`).join('')}<small>Puoi salvare e sistemare gli orari quando preferisci.</small>`:'';
    }catch{warning.hidden=true;warning.textContent='';}
  };
  form.addEventListener('input',updateConflicts);form.addEventListener('change',updateConflicts);updateConflicts();
  document.querySelector('[data-agenda-delete-entry]')?.addEventListener('click', () => confirmEntryDelete(existing, render));
}
function logForm(entryId, logId, render) {
  const e = state.scheduleEntries.find(e => e.id === entryId), existing = state.timeLogs.find(l => l.id === logId);
  openModal(existing ? 'Modifica ore registrate' : 'Registra ore effettive', `<form id="agenda-log-form"><p><strong>${esc(e.title)}</strong></p><p class="subtext">Inserisci quando hai effettivamente iniziato e finito. Le date possono essere diverse da quelle previste.</p><div class="form-grid">${field('Inizio effettivo', 'started_at', existing ? wallTime(existing.started_at, state.timezone) : e.starts_at ? wallTime(e.starts_at, state.timezone) : `${e.entry_date}T09:00`, 'datetime-local', 'required')}${field('Fine effettiva', 'ended_at', existing ? wallTime(existing.ended_at, state.timezone) : e.ends_at ? wallTime(e.ends_at, state.timezone) : `${e.entry_date}T10:00`, 'datetime-local', 'required')}<label class="field full">Appunti<textarea name="notes" maxlength="2000">${esc(existing?.notes || '')}</textarea></label></div><p class="subtext">Puoi registrare più intervalli per le pause. Evita sovrapposizioni. Gli orari sono nel fuso ${esc(state.timezone)}.</p><div class="form-actions">${existing ? '<button class="btn danger" type="button" data-agenda-delete-log>Elimina intervallo</button>' : ''}<button type="submit" class="btn primary">Salva ore</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('agenda-log-form', async data => { await saveLog({ entry_id: entryId, started_at: toInstant(String(data.get('started_at')), state.timezone), ended_at: toInstant(String(data.get('ended_at')), state.timezone), notes: data.get('notes') }, existing); render(); });
  document.querySelector('[data-agenda-delete-log]')?.addEventListener('click', () => confirmDelete('Eliminare questo intervallo dal consuntivo?', async () => { await deleteAgenda('time_logs', existing); render(); }));
}
function goalForm(existing, render) {
  const g = existing || { week_start: selectedWeek, category: 'study', unit: 'minutes', target: 480, stretch_target: 480 };
  openModal(existing ? 'Modifica obiettivo settimanale' : 'Nuovo obiettivo settimanale', `<form id="agenda-goal-form"><div class="form-grid">${field('Nome obiettivo', 'title', g.title || '', 'text', 'required maxlength="200"')}<label class="field">Categoria<select name="category">${options(categories, g.category)}</select></label><label class="field">Misura<select name="unit">${options({ minutes: 'Minuti effettivi (8 h = 480)', sessions: 'Sessioni completate' }, g.unit)}</select></label>${field('Obiettivo minimo', 'target', g.target, 'number', 'required min="1" max="10080" step="1"')}${field('Obiettivo ideale', 'stretch_target', g.stretch_target, 'number', 'required min="1" max="10080" step="1"')}<label class="field">Progetto facoltativo<select name="project_id">${projectOptions(g.project_id)}</select></label></div><p class="subtext">Valido solo per la settimana ${dayLabel(g.week_start)}. Le sessioni contano attività completate con ore registrate.</p><div class="form-actions">${existing ? '<button class="btn danger" type="button" data-agenda-delete-goal>Elimina</button>' : ''}<button class="btn primary" type="submit">Salva obiettivo</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('agenda-goal-form', async data => { await saveGoal({ ...Object.fromEntries(data), week_start: g.week_start }, existing); render(); });
  document.querySelector('[data-agenda-delete-goal]')?.addEventListener('click', () => confirmDelete('Eliminare l’obiettivo di questa settimana?', async () => { await deleteAgenda('weekly_goals', existing); render(); }));
}
function colorsForm(render) {
  const colors = loadAgendaColors();
  openModal('Colori del calendario', `<form id="agenda-colors-form"><p class="subtext">Scegli un colore per ogni categoria. Le preferenze sono salvate su questo dispositivo.</p><div class="agenda-color-grid">${Object.entries(categories).map(([key, label]) => `<label class="agenda-color-field"><span>${label}<small data-color-hex="${key}">${colors[key].toUpperCase()}</small></span><input type="color" name="${key}" value="${colors[key]}" aria-label="Colore ${label}"></label>`).join('')}</div><div class="form-actions"><button type="button" class="btn" data-colors-reset>Ripristina brand</button><button type="submit" class="btn primary">Salva colori</button></div><p class="form-error" role="alert"></p></form>`);
  const form = document.getElementById('agenda-colors-form');
  const updateHex = () => Object.keys(categories).forEach(key => { form.querySelector(`[data-color-hex="${key}"]`).textContent = form.elements[key].value.toUpperCase(); });
  form.oninput = updateHex;
  form.querySelector('[data-colors-reset]').onclick = () => { for (const key of Object.keys(categories)) form.elements[key].value = defaultCategoryColors[key]; updateHex(); };
  bindForm('agenda-colors-form', async data => { saveAgendaColors(Object.fromEntries(data)); render(); });
}
export function openWorkWeek(render, start = selectedWeek) {
  selectedWeek = start;
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const choices = { '': 'Non definito', ...Object.fromEntries(Object.entries(shiftPresets).map(([key,preset]) => [key, preset.label])), custom: 'Personalizzato' };
  openModal('Turni della settimana', `<form id="agenda-shifts-form"><p class="subtext">Scegli il turno per ogni giorno. Aggiungiamo automaticamente 30 minuti di andata e 30 di ritorno. La notte termina il giorno successivo; OFF non aggiunge lavoro.</p><div class="agenda-shift-rows">${dates.map((date, i) => {
    const e = state.scheduleEntries.find(e => e.entry_date === date && ['shift','off'].includes(e.kind));
    const preset = shiftPreset(e, state.timezone);
    return `<div class="agenda-shift-row"><strong>${dayLabel(date)}</strong><label class="field">Turno<select name="preset_${i}">${options(choices, preset)}</select></label>${field('Inizio', `from_${i}`, e?.starts_at ? timeLabel(e.starts_at, state.timezone) : '', 'time')}${field('Fine', `to_${i}`, e?.ends_at ? timeLabel(e.ends_at, state.timezone) : '', 'time')}</div>`;
  }).join('')}</div><p class="subtext">Personalizzato mantiene disponibili gli orari liberi. Le ore effettive già registrate restano nello storico.</p><div class="form-actions"><button class="btn primary" type="submit">Salva turni</button></div><p class="form-error" role="alert"></p></form>`);
  const form = document.getElementById('agenda-shifts-form');
  const updateRow = (i, changed = false) => {
    const key = form.elements[`preset_${i}`].value, preset = shiftPresets[key];
    for (const [edge, value] of [['from',preset?.from],['to',preset?.to]]) {
      const input = form.elements[`${edge}_${i}`];
      if (changed && key !== 'custom') input.value = value || '';
      input.readOnly = key !== 'custom'; input.required = key === 'custom';
      input.classList.toggle('is-preset-time', key !== 'custom');
    }
  };
  dates.forEach((_,i) => { updateRow(i); form.elements[`preset_${i}`].onchange = () => updateRow(i, true); });
  bindForm('agenda-shifts-form', async data => {
    await saveWorkWeek(start, dates.map((_, i) => {
      const preset = String(data.get(`preset_${i}`));
      return preset === 'custom' ? {kind:'shift',from:String(data.get(`from_${i}`)),to:String(data.get(`to_${i}`))} : preset ? {preset} : {kind:''};
    })); render();
  });
}
export function bindAgenda(render) {
  bindAgendaProductivity(render,{week:selectedWeek||weekStart(today(state.timezone)),openEntry:id=>eventDetails(id,render),openGoal:g=>goalForm(g,render),openWeek:date=>{selectedWeek=date;view='week';categoryFilter='';calendarScroll.delete(date);}});
  clearInterval(calendarTimer); calendarDispose?.(); calendarDispose = null;
  const scroll = document.querySelector('.calendar-scroll');
  if (scroll) {
    const weekKey = selectedWeek, saved = calendarScroll.get(weekKey), headers = Array.from(document.querySelectorAll('.calendar-day-header'));
    const todayIndex = headers.findIndex(h => previewDate ? h.dataset.date === previewDate : h.classList.contains('is-today'));
    const column = document.querySelector('.calendar-day-column');
    scroll.scrollTop = 0;
    scroll.scrollLeft = saved?.left ?? (scroll.clientWidth < 600 && todayIndex > 0 ? todayIndex * column.clientWidth : 0);
    if (previewDate) headers[todayIndex]?.querySelector('button')?.focus({preventScroll:true});
    previewDate = null;
    scroll.onscroll = () => calendarScroll.set(weekKey,{top:scroll.scrollTop,left:scroll.scrollLeft});
    calendarDispose = bindCalendarInteractions({ scroll,timezone:state.timezone,
      getEntry:id => state.scheduleEntries.find(e => e.id === id),
      onSelect:range => { if (range) entryForm(null,render,range); },
      onOpen:id => eventDetails(id,render), onError:toast,
      onMove:async (entry,patch) => {
        const previous = entryPayload(entry), saved = await saveEntry({ ...previous,...patch },entry);
        lastMove = { previous,saved }; render();
        const moved = [...document.querySelectorAll('[data-agenda-event]')].filter(b => b.dataset.agendaEvent === saved.id);
        (moved.find(b => b.dataset.date === saved.entry_date) || moved[0])?.focus({preventScroll:true});
        toast('Impegno spostato. Puoi annullare l’ultimo spostamento.');
      }
    });
    document.querySelector('[data-calendar-undo]')?.addEventListener('click',async event => {
      event.target.disabled = true;
      try {
        const current = state.scheduleEntries.find(e => e.id === lastMove?.saved.id);
        if (!current || current.updated_at !== lastMove.saved.updated_at || JSON.stringify(entryPayload(current)) !== JSON.stringify(entryPayload(lastMove.saved))) { lastMove = null; render(); throw Error('L’impegno è stato modificato ancora. Questo spostamento non può più essere annullato.'); }
        await saveEntry(lastMove.previous,lastMove.saved); lastMove = null; render(); toast('Spostamento annullato.');
      } catch (error) { toast(error.message); event.target.disabled = false; }
    });
    // The indicator updates without rerendering or touching stored agenda data.
    const updateNow = () => {
      if (!scroll.isConnected) { clearInterval(calendarTimer); return; }
      const current = wallTime(Date.now(),state.timezone), line = scroll.querySelector('.calendar-now-line');
      if (line) { line.hidden = line.closest('[data-calendar-day]').dataset.calendarDay !== current.slice(0,10); line.style.top = (yDaMinuto(scala(), Number(current.slice(11,13))*60 + Number(current.slice(14)))) + 'px'; line.setAttribute('aria-label','Ora attuale ' + current.slice(11)); }
    };
    calendarTimer = setInterval(updateNow,60000);
  }
  document.querySelectorAll('[data-calendar-category]').forEach(b => b.onclick = () => { categoryFilter = categoryFilter === b.dataset.calendarCategory ? '' : b.dataset.calendarCategory; render(); document.querySelector('.calendar-panel')?.scrollIntoView({block:'start'}); });

  document.querySelector('[data-agenda-category]')?.addEventListener('change', e => { categoryFilter = e.target.value; render(); document.querySelector('.calendar-panel')?.scrollIntoView({block:'start'}); });
  document.querySelector('[data-agenda-colors]')?.addEventListener('click', () => colorsForm(render));
  document.querySelector('[data-agenda-shifts]')?.addEventListener('click', () => openWorkWeek(render));
  document.querySelectorAll('[data-agenda-vista]').forEach(b => b.onclick = () => { vistaAgenda = b.dataset.agendaVista; try { localStorage.setItem('cm-agenda-vista', vistaAgenda); } catch { /* resta per questa sessione */ } render(); });
  document.querySelectorAll('[data-compatta-evento]').forEach(b => b.onclick = () => eventDetails(b.dataset.compattaEvento, render));
  bindAllenamentiAgenda(render, entryForm);
  document.querySelectorAll('[data-agenda-new]').forEach(b => b.onclick = () => entryForm(null, render, { kind: b.dataset.kind, date: b.dataset.date, backlog: b.hasAttribute('data-backlog') }));
  document.querySelectorAll('[data-agenda-edit]').forEach(b => b.onclick = () => entryForm(state.scheduleEntries.find(e => e.id === b.dataset.agendaEdit), render));
  document.querySelectorAll('[data-agenda-log]').forEach(b => b.onclick = () => logForm(b.dataset.agendaLog, b.dataset.logId, render));
  document.querySelectorAll('[data-agenda-complete]').forEach(b => b.onclick = async () => { b.disabled = true; try { const e = state.scheduleEntries.find(e => e.id === b.dataset.agendaComplete); await saveEntry({ ...entryPayload(e), is_completed: !e.is_completed }, e); render(); } catch (error) { toast(error.message); b.disabled = false; } });
  document.querySelectorAll('[data-agenda-week]').forEach(b => b.onclick = () => { selectedWeek = shiftDate(selectedWeek, Number(b.dataset.agendaWeek) * 7); render(); });
  document.querySelector('[data-agenda-current]')?.addEventListener('click', () => { selectedWeek = weekStart(today(state.timezone)); render(); });
  document.querySelector('[data-agenda-week-date]')?.addEventListener('change', e => { if (e.target.value) { selectedWeek = weekStart(e.target.value); render(); } });
  document.querySelectorAll('[data-agenda-view]').forEach(b => b.onclick = () => { view = b.dataset.agendaView; render(); document.querySelector(view === 'week' ? '.calendar-panel' : '.agenda-viewbar')?.scrollIntoView({block:'start'}); });
  document.querySelector('[data-agenda-goal-new]')?.addEventListener('click', () => goalForm(null, render));
  document.querySelectorAll('[data-agenda-goal]').forEach(b => b.onclick = () => goalForm(state.weeklyGoals.find(g => g.id === b.dataset.agendaGoal), render));
}
