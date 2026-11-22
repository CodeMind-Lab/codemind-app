// Agenda ↔ Palestra: in ogni giorno dell'Agenda (viste Fasce e Ore) e nella settimana di Oggi
// si vede e si sceglie l'allenamento. Scrive nello stesso piano della Palestra (voce t:'pa'
// con la data, vedi utils/palestra.js), quindi Agenda, Palestra → Schede, Allenamenti e Oggi
// mostrano sempre la stessa cosa e il salvataggio passa dall'archivio di Forma (anche offline).
// Gli impegni "Palestra" con orario dell'Agenda seguono la scelta (titolo aggiornato solo se
// generico, vedi titoloPalestra) e, se mancano, si creano da qui.
import { state } from '../services/store.js?v=65';
import * as P from '../services/palestraService.js?v=84';
import { saveEntry, entryPayload } from '../services/agendaService.js?v=65';
import { pianoDelGiorno, allenamentoDelGiorno, schedeDi, sessioniDel, statSessione, turnoDi, titoloPalestra } from '../utils/palestra.js?v=76';
import { wallTime } from '../utils/agenda.js?v=65';
import { shiftPresets } from '../utils/workShifts.js?v=65';
import { today } from '../utils/dates.js?v=65';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, closeModal, toast } from '../utils/dom.js?v=65';
import { inizia } from './palestraAllena.js?v=85';

const PILL = { apertura: 'p-a', chiusura: 'p-c', notte: 'p-n', off: 'p-off', custom: 'p-x' };
const giornoLungo = d => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const conGiorni = a => schedeDi(a).filter(s => (s.giorni || []).length);
const impegniPalestra = d => (state.scheduleEntries || []).filter(e => e.entry_date === d && e.category === 'gym' && e.kind === 'activity')
  .sort((x, y) => String(x.starts_at || '').localeCompare(String(y.starts_at || '')));
const ora = iso => wallTime(iso, state.timezone).slice(11, 16);
const orario = e => e.starts_at ? `${ora(e.starts_at)}–${ora(e.ends_at)}` : 'senza orario';
let schedaModale = '';

// Lo stato di un giorno: allenamento previsto, sessione fatta o in corso, scelta solo per quel giorno.
function statoDi(a, d) {
  const piano = pianoDelGiorno(a, d), all = allenamentoDelGiorno(a, d), sessioni = sessioniDel(a, d);
  return { all, proprio: !!piano?.d, fatta: sessioni.find(w => w.fine) || null, aperta: sessioni.find(w => !w.fine) || null };
}
const attiva = () => { const a = P.archivio(); return a && conGiorni(a).length ? a : null; };

function chip(a, d) {
  const { all, fatta, aperta } = statoDi(a, d), imp = impegniPalestra(d).find(e => e.starts_at);
  const nome = fatta ? (fatta.gn || 'Allenamento') : all ? all.giorno.n : 'Riposo';
  const cls = fatta ? 'is-fatto' : aperta ? 'is-corso' : all ? 'is-previsto' : 'is-riposo';
  const titolo = fatta ? `Fatto: ${nome}` : aperta ? `In corso: ${aperta.gn || 'Allenamento'}` : all ? `Allenamento: ${nome} · ${all.scheda.n}` : 'Riposo';
  const quando = all && imp && !fatta ? `<small>${esc(ora(imp.starts_at))}</small>` : '';
  return `<button class="allena-chip ${cls}" data-agenda-allena="${d}" title="${esc(titolo)}${imp ? ' · in agenda ' + esc(orario(imp)) : ''} · tocca per cambiare" aria-label="${esc(giornoLungo(d))}: ${esc(titolo)}. Tocca per scegliere l'allenamento">${fatta ? '✓ ' : aperta ? '● ' : ''}${esc(nome)}${quando}</button>`;
}
// Riga per la vista a fasce (stessa griglia: etichetta + 7 celle).
export function rigaAllenamentiFasce(days, now) {
  const a = attiva();
  if (!a) return '';
  return `<div class="fasce-etichetta allena"><b><span class="lungo">Allenamento</span><span class="corto">Allena</span></b><small>tocca per scegliere</small></div>${days.map(d => `<div class="fasce-cella allena ${d === now ? 'is-today' : ''}">${chip(a, d)}</div>`).join('')}`;
}
// Riga per la vista a ore: sotto le intestazioni dei giorni, nella stessa griglia.
export function rigaAllenamentiOre(days, now) {
  const a = attiva();
  if (!a) return '';
  return `<div class="calendar-corner allena-angolo">Allena</div>${days.map(d => `<div class="calendar-allena ${d === now ? 'is-today' : ''}">${chip(a, d)}</div>`).join('')}`;
}

// Aggiorna il titolo degli impegni Palestra del giorno (non completati) alla nuova scelta.
async function allineaImpegni(a, d, gn) {
  const nomi = conGiorni(a).flatMap(s => s.giorni.map(g => g.n));
  let n = 0;
  for (const e of impegniPalestra(d).filter(e => !e.is_completed)) {
    const titolo = titoloPalestra(e.title, nomi, gn);
    if (titolo) { await saveEntry({ ...entryPayload(e), title: titolo }, e); n++; }
  }
  return n;
}

// Finestra di scelta: Riposo o un giorno della scheda; impegno in agenda; Inizia/Riprendi se è oggi.
function scegli(d, render, nuovoImpegno) {
  const a = P.archivio();
  if (!a) return;
  const schede = conGiorni(a), { all, proprio, fatta, aperta } = statoDi(a, d), impegni = impegniPalestra(d);
  if (!schede.some(s => s.id === schedaModale)) schedaModale = all?.scheda.id && schede.some(s => s.id === all.scheda.id) ? all.scheda.id : schede[0].id;
  const s = schede.find(x => x.id === schedaModale), tn = turnoDi(a, d, state.scheduleEntries, state.timezone), oggi = d === today(state.timezone);
  const scelto = (sid, gn) => all ? all.scheda.id === sid && all.giorno.n === gn : !sid;
  const opzione = (sid, gn, testo, sotto) => `<button class="allena-opz ${scelto(sid, gn) ? 'on' : ''}" data-opz-sid="${esc(sid)}" data-opz-gn="${esc(gn)}" aria-pressed="${scelto(sid, gn)}"><b>${esc(testo)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ''}</button>`;
  const fatto = fatta ? (() => { const st = statSessione(fatta); return `<p class="allena-fatto">✓ Fatto: <b>${esc(fatta.gn || 'Allenamento')}</b>${st.dur ? ` · ${st.dur} min` : ''}${st.serie ? ` · ${st.serie} serie` : ''}</p>`; })() : '';
  const inAgenda = impegni.length
    ? `<p class="allena-agenda">In agenda: ${impegni.map(e => `<b>${esc(e.title)}</b> <span>${esc(orario(e))}${e.is_completed ? ' · fatto' : ''}</span>`).join(' · ')}</p>`
    : all && nuovoImpegno ? `<p class="allena-agenda vuota">Nessun orario in agenda per la palestra. <button class="link" data-allena-impegno>Metti in agenda</button></p>` : '';
  const azione = aperta ? `<a class="btn primary" href="#/sport/sessione/${esc(aperta.id)}" data-allena-chiudi>Riprendi allenamento</a>`
    : oggi && all && !fatta ? `<button class="btn primary" data-allena-inizia>Inizia ${esc(all.giorno.n)}</button>` : '';
  openModal(`Allenamento · ${giornoLungo(d)}`, `<div class="allena-modale">
    <p class="allena-info">${tn ? `<span class="pill ${PILL[tn] || 'p-x'}">${esc(tn === 'off' ? 'OFF' : shiftPresets[tn]?.label || 'Turno')}</span>` : ''}<span>${proprio ? 'Scelto per questo giorno' : 'Dalla settimana tipo'}</span></p>
    ${fatto}
    ${schede.length > 1 ? `<label class="field">Scheda<select data-allena-scheda>${schede.map(x => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>` : ''}
    <div class="allena-opzioni">${opzione('', '', 'Riposo', '')}${s.giorni.map(g => opzione(s.id, g.n, g.n, `${(g.eser || []).length} esercizi`)).join('')}</div>
    ${inAgenda}
    <div class="form-actions allena-azioni">${proprio ? '<button class="btn" data-allena-tipo>Come la settimana tipo</button>' : ''}<a class="btn" href="#/sport/schede" data-allena-chiudi>Apri in Palestra</a>${azione}</div>
    <p class="form-error" role="alert"></p></div>`);
  const m = document.querySelector('#modal'), errore = t => { m.querySelector('.form-error').textContent = t; };
  // Dopo la scelta: piano salvato subito (archivio di Forma), poi i titoli in agenda.
  const dopo = async (gn, msg) => {
    closeModal(); render();
    try { const n = await allineaImpegni(P.archivio(), d, gn); if (n) render(); toast(msg + (n ? ' · aggiornato anche in agenda' : '')); }
    catch (e) { render(); toast(`${msg} · agenda non aggiornata: ${e.message}`); }
  };
  m.querySelectorAll('[data-opz-sid]').forEach(b => b.onclick = () => {
    const sid = b.dataset.opzSid, gn = sid ? b.dataset.opzGn : '';
    try { P.impostaGiornoData(d, sid, gn); } catch (e) { return errore(e.message); }
    dopo(gn, `${giornoLungo(d)}: ${gn || 'riposo'}`);
  });
  m.querySelector('[data-allena-scheda]')?.addEventListener('change', e => { schedaModale = e.target.value; scegli(d, render, nuovoImpegno); });
  m.querySelector('[data-allena-tipo]')?.addEventListener('click', () => {
    try { P.togliGiornoData(d); } catch (e) { return errore(e.message); }
    dopo(allenamentoDelGiorno(P.archivio(), d)?.giorno.n || '', 'Torna come la settimana tipo');
  });
  m.querySelector('[data-allena-impegno]')?.addEventListener('click', () => { closeModal(); nuovoImpegno(null, render, { date: d, category: 'gym', title: `Palestra · ${all.giorno.n}` }); });
  m.querySelector('[data-allena-inizia]')?.addEventListener('click', () => { try { closeModal(); inizia(d, all.scheda.id, all.giorno.n); } catch (e) { toast(e.message); } });
  m.querySelectorAll('[data-allena-chiudi]').forEach(x => x.addEventListener('click', closeModal));
}
// nuovoImpegno: il form "Nuovo impegno" dell'Agenda (entryForm), passato da chi lega la pagina.
export function bindAllenamentiAgenda(render, nuovoImpegno, radice = document) {
  radice.querySelectorAll('[data-agenda-allena]').forEach(b => b.onclick = e => { e.stopPropagation(); scegli(b.dataset.agendaAllena, render, nuovoImpegno); });
}
