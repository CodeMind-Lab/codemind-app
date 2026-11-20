import { state } from '../services/store.js?v=65';
import { saveWorkShift } from '../services/agendaService.js?v=65';
import { shiftPresets, shiftPreset } from '../utils/workShifts.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { weekStart, timeLabel, wallTime } from '../utils/agenda.js?v=65';
import { esc } from '../utils/helpers.js?v=65';

export const shiftTypes = Object.fromEntries(Object.entries(shiftPresets).map(([key, preset]) => [key, preset.label]));
let weekOffset = 0, busy = false;
export const monday = weekStart;
const dateText = date => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
const currentStart = () => shiftDate(monday(today(state.timezone)), weekOffset * 7);
export function weeklyShifts() {
  const now = today(state.timezone), start = currentStart();
  const available = state.mode !== 'signed_out' && (state.mode !== 'cloud' || state.agendaAvailable);
  return `<section class="work-shifts panel" aria-labelledby="work-shifts-title"><div class="work-shifts-heading"><div><h2 id="work-shifts-title">Turni settimanali</h2><p>${dateText(start)} – ${dateText(shiftDate(start, 6))}</p></div><div class="work-shifts-nav"><button class="btn" data-shift-week="-1" aria-label="Settimana precedente">‹</button><button class="btn" data-shift-week="0">Oggi</button><button class="btn" data-shift-week="1" aria-label="Settimana successiva">›</button></div></div><div class="work-shifts-scroll" tabindex="0" role="region" aria-label="Turni della settimana"><div class="work-shifts-grid">${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(day => `<span class="work-shifts-weekday">${day}</span>`).join('')}${Array.from({length:7}, (_, i) => {
    const date = shiftDate(start,i), rows = state.scheduleEntries.filter(e => e.entry_date === date && ['shift','off'].includes(e.kind));
    const entry = rows[0], kind = rows.length > 1 ? 'multiple' : shiftPreset(entry, state.timezone);
    const times = entry?.kind === 'shift' ? `${timeLabel(entry.starts_at, state.timezone)}–${timeLabel(entry.ends_at, state.timezone)}${wallTime(entry.ends_at, state.timezone).slice(0,10) !== wallTime(entry.starts_at, state.timezone).slice(0,10) ? ' +1' : ''}` : kind === 'off' ? 'Giorno libero' : 'Da definire';
    return `<div class="work-shifts-day"><time datetime="${date}" class="work-shifts-date ${date === now ? 'is-today' : ''}" ${date === now ? 'aria-current="date"' : ''}>${Number(date.slice(-2))}</time><select class="work-shift-select ${kind ? `shift-${kind}` : 'shift-empty'}" data-shift-date="${date}" aria-label="Turno del ${esc(dateText(date))}" ${!available || busy || kind === 'multiple' ? 'disabled' : ''}><option value="">＋ Turno</option>${Object.entries(shiftTypes).map(([value,label]) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${label}</option>`).join('')}${kind === 'custom' || kind === 'multiple' ? `<option value="${kind}" selected disabled>${kind === 'multiple' ? 'Più turni' : 'Personalizzato'}</option>` : ''}</select><small class="work-shift-hours">${times}</small></div>`;
  }).join('')}</div></div><div class="work-shifts-footer"><p class="work-shifts-hint">8 h di lavoro + 30 min andata e 30 min ritorno, nell’Agenda.${state.mode === 'demo' ? ' Solo su questo dispositivo.' : ''}</p><button class="link" data-edit-work-week ${!available || busy ? 'disabled' : ''}>Modifica settimana</button></div><p class="work-shifts-error" role="alert">${esc(state.workShiftsImportError || (!available ? state.agendaError || 'Accedi per salvare i turni.' : ''))}</p></section>`;
}
export function bindWeeklyShifts(render, toast, editWeek) {
  document.querySelectorAll('[data-shift-week]').forEach(button => {
    button.onclick = () => { const step = Number(button.dataset.shiftWeek); weekOffset = step === 0 ? 0 : weekOffset + step; render(); document.querySelector(`[data-shift-week="${step}"]`)?.focus(); };
  });
  document.querySelector('[data-edit-work-week]')?.addEventListener('click', () => editWeek(currentStart()));
  document.querySelectorAll('[data-shift-date]').forEach(select => {
    select.onchange = async () => {
      if (busy) return;
      busy = true;
      document.querySelectorAll('[data-shift-date], [data-shift-week], [data-edit-work-week]').forEach(control => control.disabled = true);
      const date = select.dataset.shiftDate;
      try {
        await saveWorkShift(date, select.value);
        busy = false; render();
        document.querySelector(`[data-shift-date="${date}"]`)?.focus({preventScroll:true});
        toast(select.value ? 'Turno e tragitti aggiornati nell’Agenda' : 'Turno e tragitti rimossi dall’Agenda');
      } catch (error) {
        busy = false; render();
        document.querySelector('.work-shifts-error').textContent = error.message;
      }
    };
  });
}
