// Pagine-contenitore del nuovo menu (19/11/2026). Ogni sezione raccoglie le pagine
// che c'erano già, con una fila di schede in alto: le sezioni vere (Hotel, Sviluppo,
// Note) crescono qui sopra nei passi successivi senza cambiare gli indirizzi.
import { weeklyShifts, bindWeeklyShifts } from './shifts.js?v=65';
import { openWorkWeek } from './agenda.js?v=65';
import { toast } from '../utils/dom.js?v=65';

const schede = (attiva, voci) => `<nav class="schede-sezione" aria-label="Schede della sezione">${voci.map(([chiave, nome, href]) => `<a class="chip ${attiva === chiave ? 'on' : ''}" href="${href}" ${attiva === chiave ? 'aria-current="page"' : ''}>${nome}</a>`).join('')}</nav>`;

export const schedeSviluppo = attiva => schede(attiva, [['projects', 'Progetti', '#/projects'], ['tasks', 'Attività', '#/tasks'], ['archive', 'Archivio', '#/archive']]);
export const schedeNote = attiva => schede(attiva, [['notes', 'Note', '#/notes'], ['daily-todos', 'To-do', '#/daily-todos']]);

export function hotelPage() {
  return `<div class="page-heading"><div><h1>Lavoro Hotel</h1><p class="subtext">Turni della settimana. Ore, straordinari, ferie, permessi, busta paga e note di turno arrivano nel prossimo passo.</p></div></div>${weeklyShifts()}`;
}
export function bindHotel(render) {
  if (document.querySelector('.work-shifts')) bindWeeklyShifts(render, toast, start => openWorkWeek(render, start));
}
