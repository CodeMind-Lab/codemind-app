import { calendarHourHeight, calendarSelection, movedCalendarEntry, shiftedCalendarDay, snapMinute, calendarWall } from '../utils/agendaCalendar.js?v=65';
import { wallTime, toInstant } from '../utils/agenda.js?v=65';
import { shiftDate } from '../utils/dates.js?v=65';

// One delegated pointer handler and one animation frame while dragging. Pointer
// coordinates are resolved against the live grid, also after automatic scrolling.
export function bindCalendarInteractions({ scroll, timezone, getEntry, onSelect, onMove, onOpen, onError }) {
  const controller = new AbortController(), listener = { signal: controller.signal };
  const panel = scroll.closest('.calendar-panel'), toggle = panel.querySelector('[data-calendar-select]');
  const status = panel.querySelector('[data-calendar-status]');
  const columns = [...scroll.querySelectorAll('[data-calendar-day]')];
  let gesture, frame, busy = false, selecting = false, suppressUntil = 0;
  const announce = text => { status.textContent = text; };
  const selectMode = value => {
    selecting = value; scroll.classList.toggle('is-selecting',value);
    toggle.setAttribute('aria-pressed',String(value));
    announce(value ? 'Trascina su un giorno per scegliere inizio e fine.' : 'Trascina gli impegni per spostarli.');
  };
  toggle.onclick = () => { if (!busy) selectMode(!selecting); };
  const bodyTop = () => scroll.querySelector('.calendar-untimed-row').getBoundingClientRect().bottom;
  const point = (x,y,dayOnly = false) => {
    const box = scroll.getBoundingClientRect(), axis = scroll.querySelector('.calendar-time-axis').getBoundingClientRect();
    if (x < axis.right || x > box.right || y < box.top || y > box.bottom) return null;
    const column = columns.find(c => { const b = c.getBoundingClientRect(); return x >= b.left && x < b.right; });
    if (!column) return null;
    const top = bodyTop(), b = column.getBoundingClientRect();
    if (dayOnly && y < top) return { column, date:column.dataset.calendarDay, untimed:true };
    const minute = Math.min(1440, Math.max(0, (Math.max(top + 1,y) - b.top) / calendarHourHeight * 60));
    return { column, date:column.dataset.calendarDay, minute };
  };
  const clearPreview = () => {
    scroll.querySelectorAll('.calendar-ghost,.calendar-drag-label').forEach(e => e.remove());
    scroll.querySelectorAll('.is-moving').forEach(e => e.classList.remove('is-moving'));
  };
  const cleanup = () => {
    cancelAnimationFrame(frame); clearPreview(); scroll.classList.remove('is-dragging');
    const pointerId = gesture?.pointerId; gesture = null;
    if (pointerId !== undefined && scroll.hasPointerCapture(pointerId)) scroll.releasePointerCapture(pointerId);
  };
  const ghost = (column,from,to,label,color,untimed=false) => {
    const element = document.createElement('div'); element.className = 'calendar-ghost';
    element.style.setProperty('--category-color',color || 'var(--brand-cyan)');
    if (untimed) { element.classList.add('is-untimed'); column = scroll.querySelector(`.calendar-untimed-cell[data-date="${column.dataset.calendarDay}"]`); }
    else { element.style.top = from / 60 * calendarHourHeight + 'px'; element.style.height = Math.max(24,(to-from) / 60 * calendarHourHeight - 2) + 'px'; }
    const text = document.createElement('span'); text.textContent = label; element.append(text); column.append(element);
  };
  const positionLabel = () => {
    const element = scroll.querySelector('.calendar-drag-label'); if (!element || !gesture) return;
    const box = scroll.getBoundingClientRect(), width = element.getBoundingClientRect().width;
    element.style.left = Math.max(box.left+4,Math.min(box.right-width-6,gesture.x+10)) + 'px';
    element.style.top = Math.max(bodyTop()+4,Math.min(box.bottom-40,gesture.y-38)) + 'px';
  };
  const preview = () => {
    if (!gesture?.dragged) return;
    const p = point(gesture.x,gesture.y,gesture.type === 'move');
    if (!p) { gesture.candidate = null; gesture.signature = null; clearPreview(); return; }
    try {
      let label, signature;
      if (gesture.type === 'select') {
        // A time-range selection remains on the day where the gesture started.
        const minute = Math.min(1440,Math.max(0,(Math.max(bodyTop()+1,gesture.y) - gesture.column.getBoundingClientRect().top) / calendarHourHeight * 60));
        gesture.candidate = calendarSelection(gesture.date,gesture.anchor,minute,true);
        label = `${gesture.candidate.start.slice(11)}–${gesture.candidate.endMinute === 1440 ? '24:00' : gesture.candidate.end.slice(11)}`;
        signature = label;
        if (signature === gesture.signature) return;
        clearPreview(); ghost(gesture.column,gesture.candidate.startMinute,gesture.candidate.endMinute,label);
      } else {
        const e = gesture.entry;
        gesture.candidate = p.untimed ? shiftedCalendarDay(e,p.date,gesture.sourceDate,timezone) : movedCalendarEntry(e,p.date,snapMinute(p.minute),timezone,gesture.offset);
        const start = gesture.candidate.starts_at ? wallTime(gesture.candidate.starts_at,timezone) : '';
        const end = gesture.candidate.ends_at ? wallTime(gesture.candidate.ends_at,timezone) : '';
        label = start ? `${start.slice(11)}–${end.slice(11)}${start.slice(0,10) !== end.slice(0,10) ? ' · +1 giorno' : ''}` : 'Senza orario';
        signature = JSON.stringify(gesture.candidate);
        if (signature === gesture.signature) return;
        clearPreview();
        scroll.querySelectorAll('[data-agenda-event]').forEach(b => { if (b.dataset.agendaEvent === e.id) b.classList.add('is-moving'); });
        if (!start || e.kind === 'off') ghost(p.column,0,0,e.title,gesture.color,true);
        else for (const column of columns) {
          const date = column.dataset.calendarDay;
          if (date < start.slice(0,10) || date > end.slice(0,10)) continue;
          const first = date === start.slice(0,10) ? Number(start.slice(11,13))*60 + Number(start.slice(14)) : 0;
          const last = date === end.slice(0,10) ? Number(end.slice(11,13))*60 + Number(end.slice(14)) : 1440;
          if (last > first) ghost(column,first,last,`${e.title} · ${label}`,gesture.color);
        }
      }
      gesture.signature = signature; announce(label);
      const floating = document.createElement('div'); floating.className = 'calendar-drag-label'; floating.textContent = label; scroll.append(floating); positionLabel();
    } catch (error) { gesture.candidate = null; gesture.signature = null; gesture.error = error.message; clearPreview(); announce(error.message); }
  };
  const animate = () => {
    if (!gesture?.dragged || !scroll.isConnected) { cleanup(); return; }
    const box = scroll.getBoundingClientRect(), left = scroll.querySelector('.calendar-time-axis').getBoundingClientRect().right;
    const top = bodyTop(), edge = 24;
    const dy = gesture.y < top+edge ? -8 : gesture.y > box.bottom-edge ? 8 : 0;
    const dx = gesture.type === 'move' ? gesture.x < left+edge ? -8 : gesture.x > box.right-edge ? 8 : 0 : 0;
    const edgeKey = `${dx}:${dy}`;
    if (edgeKey !== gesture.edgeKey) { gesture.edgeKey = edgeKey; gesture.edgeSince = performance.now(); }
    if (performance.now() - gesture.edgeSince > 180) { scroll.scrollTop += dy; scroll.scrollLeft += dx; }
    preview(); positionLabel(); frame = requestAnimationFrame(animate);
  };
  const commit = async (entry,patch) => {
    if (!patch || busy) return;
    if (Object.entries(patch).every(([key,value]) => entry[key] === value)) return;
    busy = true; scroll.classList.add('is-saving'); scroll.setAttribute('aria-busy','true'); announce('Salvataggio dello spostamento…');
    try { await onMove(entry,patch); }
    catch (error) { onError(error.message); announce('Spostamento non salvato. L’impegno conserva il suo orario.'); }
    finally { busy = false; scroll.classList.remove('is-saving'); scroll.removeAttribute('aria-busy'); }
  };
  scroll.addEventListener('pointerdown',event => {
    if (busy || event.button !== 0 || !event.isPrimary) return;
    const node = event.target.closest('[data-agenda-event]'), p = point(event.clientX,event.clientY,!!node);
    if (!p) return;
    if (node) {
      if (event.pointerType !== 'mouse' && !event.target.closest('.calendar-drag-handle')) return;
      const entry = getEntry(node.dataset.agendaEvent); if (!entry) return;
      let grabbed = 0;
      try { if (!p.untimed && entry.starts_at) grabbed = (Date.parse(toInstant(calendarWall(p.date,snapMinute(p.minute)),timezone))-Date.parse(entry.starts_at))/60000; }
      catch (error) { onError(error.message); return; }
      gesture = { type:'move',entry,sourceDate:node.dataset.date || node.closest('[data-date]')?.dataset.date || entry.entry_date,offset:grabbed,color:getComputedStyle(node).getPropertyValue('--category-color') };
      node.focus();
    } else {
      if (event.target.closest('button') || !event.target.closest('[data-calendar-day]')) return;
      if (event.pointerType !== 'mouse' && !selecting) return;
      gesture = { type:'select',column:p.column,date:p.date,anchor:p.minute };
      scroll.focus({preventScroll:true});
    }
    Object.assign(gesture,{pointerId:event.pointerId,x:event.clientX,y:event.clientY,initialX:event.clientX,initialY:event.clientY});
    scroll.setPointerCapture(event.pointerId);
    if (event.pointerType === 'mouse') event.preventDefault();
  },listener);
  scroll.addEventListener('pointermove',event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.x = event.clientX; gesture.y = event.clientY;
    if (!gesture.dragged && Math.hypot(gesture.x-gesture.initialX,gesture.y-gesture.initialY) > 5) {
      gesture.dragged = true; scroll.classList.add('is-dragging'); frame = requestAnimationFrame(animate);
    }
    if (gesture.dragged) event.preventDefault();
  },listener);
  scroll.addEventListener('pointerup',event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.x = event.clientX; gesture.y = event.clientY;
    if (gesture.dragged) preview();
    const previous = gesture, candidate = gesture.candidate;
    if (previous.dragged || previous.type === 'select' || previous.type === 'move') suppressUntil = performance.now()+600;
    cleanup();
    if (previous.type === 'move') { if (!previous.dragged) onOpen(previous.entry.id); else if (candidate) void commit(previous.entry,candidate); else announce(previous.error || 'Spostamento annullato: rilascia dentro l’agenda.'); }
    else { selectMode(false); onSelect(previous.dragged ? candidate : calendarSelection(previous.date,previous.anchor)); }
  },listener);
  scroll.addEventListener('pointercancel',cleanup,listener);
  scroll.addEventListener('lostpointercapture',() => { if (gesture) cleanup(); },listener);
  scroll.addEventListener('click',event => {
    if (performance.now() < suppressUntil || busy) { event.preventDefault(); event.stopPropagation(); return; }
    const node = event.target.closest('[data-agenda-event]');
    if (node) { onOpen(node.dataset.agendaEvent); return; }
    // Touch scroll stays native; a simple tap still selects a single hour.
    const p = point(event.clientX,event.clientY);
    if (event.target.closest('[data-calendar-day]') && p) onSelect(calendarSelection(p.date,p.minute));
  },{ ...listener,capture:true });
  scroll.addEventListener('keydown',event => {
    if (event.key === 'Escape' && gesture) { event.preventDefault(); suppressUntil = performance.now()+600; cleanup(); announce('Spostamento annullato.'); return; }
    if (event.key === 'Escape' && selecting) { event.preventDefault(); selectMode(false); return; }
    const node = event.target.closest('[data-agenda-event]');
    if (!node || !event.altKey || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); if (busy) return;
    const entry = getEntry(node.dataset.agendaEvent); if (!entry) return;
    try {
      let patch;
      if (['ArrowLeft','ArrowRight'].includes(event.key)) patch = shiftedCalendarDay(entry,shiftDate(entry.entry_date,event.key === 'ArrowLeft' ? -1 : 1),entry.entry_date,timezone);
      else if (entry.starts_at) {
        const local = wallTime(entry.starts_at,timezone), minute = Number(local.slice(11,13))*60 + Number(local.slice(14));
        patch = movedCalendarEntry(entry,local.slice(0,10),minute + (event.key === 'ArrowUp' ? -15 : 15),timezone);
      }
      void commit(entry,patch);
    } catch (error) { onError(error.message); }
  },listener);
  return () => { cleanup(); controller.abort(); };
}
