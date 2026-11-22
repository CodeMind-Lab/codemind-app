// Sezione "Lavoro Hotel" (anteprima approvata il 20/11/2026: anteprime/02-hotel.html).
// Schede: Mese · Ferie e permessi · Buste paga · Note di turno · Contratto.
// I turni sono quelli dell'Agenda (schedule_entries); qui si leggono e si riassumono.
import { state } from '../services/store.js?v=65';
import { saveEntry, entryPayload } from '../services/agendaService.js?v=65';
import { saveContratto, saveAssenza, saveBustaPaga, elimina, TIPI_ASSENZA } from '../services/lavoroService.js?v=70';
import { openWorkWeek } from './agenda.js?v=68';
import { riepilogoMese, stipendioPrevisto, saldi, contrattoDi, minutiInOre, euro, eFestivo } from '../utils/hotel.js?v=70';
import { scaricaCsv, numeroCsv } from '../utils/esporta.js?v=70';
import { wallTime, weekStart } from '../utils/agenda.js?v=65';
import { shiftPresets, shiftPreset } from '../utils/workShifts.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { esc } from '../utils/helpers.js?v=65';
import { toast, confirmDelete } from '../utils/dom.js?v=65';

const SCHEDE = [['mese', 'Mese'], ['ferie', 'Ferie e permessi'], ['buste', 'Buste paga'], ['note', 'Note di turno'], ['contratto', 'Contratto']];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const PILL = { apertura: 'p-a', chiusura: 'p-c', notte: 'p-n', off: 'p-off', custom: 'p-x', ferie: 'p-f', permesso: 'p-f', malattia: 'p-m', altro: 'p-x' };
// Sigle per il calendario sul telefono, dove i nomi interi non entrano.
const CORTO = { apertura: 'A', chiusura: 'C', notte: 'N', off: 'OFF', custom: 'T', ferie: 'F', permesso: 'P', malattia: 'M', altro: 'X' };
let meseScelto = null, filtroTurno = 'tutti', annoFerie = null;

const tz = () => state.timezone;
const oggi = () => today(tz());
const nomeMese = m => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const spostaMese = (m, n) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const ora = iso => wallTime(iso, tz()).slice(11);
const giornoBreve = d => `${['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date(d + 'T12:00:00Z').getUTCDay()]} ${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
const ore = m => m ? (m / 60).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '–';
function tipoTurno(v) {
  if (v.kind === 'off') return 'off';
  return shiftPreset(v, tz());
}
const etichettaTurno = k => shiftPresets[k]?.label || (k === 'off' ? 'OFF' : 'Turno');

function testa() {
  const m = meseScelto;
  return `<div class="page-heading lavoro-testa"><div><h1>Lavoro Hotel</h1><p class="subtext">Turni, ore, ferie e busta paga</p></div>
  <div class="mese-nav"><button class="icona-tonda" data-hotel-mese="-1" aria-label="Mese precedente">‹</button><b>${esc(nomeMese(m).replace(/^./, c => c.toUpperCase()))}</b><button class="icona-tonda" data-hotel-mese="1" aria-label="Mese successivo">›</button></div>
  <div class="azioni"><button class="btn" data-hotel-turni>Modifica turni</button><a class="btn quick-global" href="#/hotel/buste">+ Busta paga</a></div></div>`;
}
const schede = attiva => `<nav class="schede-sezione" aria-label="Schede di Lavoro Hotel">${SCHEDE.map(([k, n]) => `<a class="chip ${k === attiva ? 'on' : ''}" href="#/hotel${k === 'mese' ? '' : '/' + k}" ${k === attiva ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
const avvisoTabelle = () => state.lavoroError ? `<div class="avviso">${esc(state.lavoroError)} Turni e ore funzionano già; contratto, ferie e buste paga arrivano dopo l'aggiornamento del database.</div>` : '';

// ------------------------------------------------------------------ Mese
function calendario(m, riep) {
  const primo = `${m}-01`, vuoti = (new Date(primo + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const giorni = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
  const assenze = new Map(state.hotelAssenze.filter(a => a.data.startsWith(m)).map(a => [a.data, a]));
  let h = GIORNI.map(g => `<div class="cal-int">${g}</div>`).join('') + '<div class="cal-g vuoto"></div>'.repeat(vuoti);
  for (let i = 1; i <= giorni; i++) {
    const d = `${m}-${String(i).padStart(2, '0')}`;
    const v = state.scheduleEntries.find(e => e.entry_date === d && (e.kind === 'shift' || e.kind === 'off'));
    const a = assenze.get(d);
    let pill = '', orario = '';
    if (a) pill = `<span class="pill ${PILL[a.tipo]}"><i class="lungo">${TIPI_ASSENZA[a.tipo]}${a.ore ? ' ' + ore(a.ore * 60) + ' h' : ''}</i><i class="corto">${CORTO[a.tipo]}</i></span>`;
    if (v) { const k = tipoTurno(v); pill += `<span class="pill ${PILL[k]}"><i class="lungo">${etichettaTurno(k)}</i><i class="corto">${CORTO[k] || 'T'}</i></span>`; if (v.kind === 'shift') orario = `${ora(v.starts_at)}–${ora(v.ends_at)}`; }
    h += `<button class="cal-g ${d === oggi() ? 'oggi' : ''} ${eFestivo(d) ? 'festivo' : ''}" data-hotel-giorno="${d}" title="Modifica i turni di questa settimana"><b>${i}</b>${pill}<em>${orario}</em></button>`;
  }
  return `<div class="calendario-mese">${h}</div>`;
}
function tabellaTurni(riep) {
  const filtri = [['tutti', 'Tutti'], ['apertura', 'Apertura'], ['chiusura', 'Chiusura'], ['notte', 'Notte']];
  const righe = riep.turni.filter(t => filtroTurno === 'tutti' || tipoTurno(t.voce) === filtroTurno);
  const tot = righe.reduce((s, t) => ({ m: s.m + t.totale, n: s.n + t.notte, f: s.f + t.festivo }), { m: 0, n: 0, f: 0 });
  return `<div class="barra-strumenti">${filtri.map(([k, n]) => `<button class="chip ${k === filtroTurno ? 'on' : ''}" data-hotel-filtro="${k}">${n}</button>`).join('')}<span class="spazio"></span><button class="btn" data-hotel-csv="turni">CSV</button><button class="btn" data-stampa>Stampa</button></div>
  <div class="table-wrap"><table class="dati"><thead><tr><th>Giorno</th><th>Turno</th><th class="nasc">Orario</th><th class="n">Ore</th><th class="n nasc">Notturne</th><th class="n nasc">Festive</th><th class="nasc">Note di turno</th></tr></thead><tbody>
  ${righe.map(t => { const k = tipoTurno(t.voce); return `<tr class="${t.fatto ? '' : 'futuro'}"><td>${giornoBreve(t.voce.entry_date)}</td><td><span class="pill ${PILL[k]}">${etichettaTurno(k)}</span></td><td class="nasc">${ora(t.voce.starts_at)}–${ora(t.voce.ends_at)}</td><td class="n">${ore(t.totale)}</td><td class="n nasc">${ore(t.notte)}</td><td class="n nasc">${ore(t.festivo)}</td><td class="nasc nota-cella">${esc((t.voce.notes || '').split('\n')[0])}</td></tr>`; }).join('') || '<tr><td colspan="7" class="vuoto-tabella">Nessun turno in questo mese. Inseriscili con "Modifica turni".</td></tr>'}
  </tbody><tfoot><tr><td>Totale</td><td>${righe.length} turni</td><td class="nasc"></td><td class="n">${ore(tot.m)}</td><td class="n nasc">${ore(tot.n)}</td><td class="n nasc">${ore(tot.f)}</td><td class="nasc"></td></tr></tfoot></table></div>`;
}
function cartaStipendio(m, riep) {
  const c = state.hotelContratto, prev = stipendioPrevisto(c, m);
  const busta = state.bustePaga.find(b => b.mese.startsWith(m));
  if (!prev) return `<section class="card"><div class="card-testa"><h2>Stipendio previsto</h2><a class="link" href="#/hotel/contratto">Contratto →</a></div><p class="vuoto-giornata">Inserisci il netto mensile nella scheda Contratto per vedere lo stipendio previsto e confrontarlo con la busta paga.</p></section>`;
  const righe = [`<div class="riga2"><span>Netto mensile</span><b>${euro(prev.base)}</b></div>`, ...prev.extra.map(x => `<div class="riga2"><span>${esc(x.nome)} mensilità</span><b>${euro(x.importo)}</b></div>`), `<div class="riga2 totale"><span>Netto previsto</span><b>${euro(prev.totale)}</b></div>`];
  let confronto = '';
  if (busta) {
    const diff = Number(busta.netto) - prev.totale;
    confronto = `<div class="delta ${Math.abs(diff) < 0.01 ? 'ok' : diff < 0 ? 'meno' : 'piu'}">Busta paga registrata: ${euro(busta.netto)} netti${Math.abs(diff) < 0.01 ? ', uguale al previsto.' : `, <b>${euro(Math.abs(diff))} ${diff < 0 ? 'in meno' : 'in più'}</b> del previsto.`}${busta.straordinari_pagati != null ? ` Straordinari pagati ${ore(busta.straordinari_pagati * 60)} h, contati ${ore(riep.straordinari)} h.` : ''}</div>`;
  } else confronto = `<div class="delta neutro">Busta paga di ${esc(nomeMese(m))} non ancora registrata. <a href="#/hotel/buste">Registrala →</a></div>`;
  return `<section class="card"><div class="card-testa"><h2>Stipendio previsto</h2><a class="link" href="#/hotel/contratto">Contratto →</a></div><div class="contenuto">${righe.join('')}${confronto}</div></section>`;
}
function cartaNote(m) {
  const conNote = state.scheduleEntries.filter(e => e.kind === 'shift' && e.entry_date?.startsWith(m) && (e.notes || '').trim()).sort((a, b) => b.entry_date.localeCompare(a.entry_date)).slice(0, 4);
  return `<section class="card"><div class="card-testa"><h2>Note di turno</h2><a class="link" href="#/hotel/note">Tutte →</a></div><div class="contenuto">${conNote.map(e => `<div class="nota-turno"><small>${giornoBreve(e.entry_date)} · ${etichettaTurno(tipoTurno(e))}</small>${esc(e.notes)}</div>`).join('') || '<p class="vuoto-giornata">Nessuna nota in questo mese. Scrivile nella scheda Note di turno.</p>'}</div></section>`;
}
function cartaFerie() {
  const anno = Number(oggi().slice(0, 4)), s = saldi(state.hotelContratto, state.hotelAssenze, anno, oggi());
  const c = contrattoDi(state.hotelContratto);
  if (c.ferie_giorni_anno == null && !state.hotelAssenze.length) return `<section class="card"><div class="card-testa"><h2>Ferie e permessi</h2><a class="link" href="#/hotel/contratto">Imposta →</a></div><p class="vuoto-giornata">Inserisci nel Contratto i giorni di ferie e le ore di permesso dell'anno per vedere i residui.</p></section>`;
  const g = n => (Math.round(n * 10) / 10).toLocaleString('it-IT');
  return `<section class="card"><div class="card-testa"><h2>Ferie e permessi ${anno}</h2><a class="link" href="#/hotel/ferie">Registra →</a></div><div class="contenuto">
  <div class="riga2"><span>Ferie maturate (con il saldo iniziale)</span><b>${g(s.ferie.iniziali + s.ferie.maturate)} g</b></div>
  <div class="riga2"><span>Ferie godute · già segnate</span><b>${s.ferie.godute} · ${s.ferie.pianificate} g</b></div>
  <div class="riga2 totale"><span>Ferie residue</span><b>${g(s.ferie.residue)} g</b></div>
  <div class="riga2"><span>Permessi residui</span><b>${g(s.permessi.residui)} h</b></div>
  <div class="riga2"><span>Malattia nell'anno</span><b>${s.malattia} g</b></div></div></section>`;
}
function vistaMese() {
  const m = meseScelto, riep = riepilogoMese(state.scheduleEntries, state.hotelContratto, m, tz());
  const c = contrattoDi(state.hotelContratto), anno = Number(oggi().slice(0, 4)), s = saldi(state.hotelContratto, state.hotelAssenze, anno, oggi());
  const ferieMese = state.hotelAssenze.filter(a => a.tipo === 'ferie' && a.data.startsWith(m)).length;
  const g = n => (Math.round(n * 10) / 10).toLocaleString('it-IT');
  return `<section class="kpi-lavoro">
   <div class="k t-corallo"><div class="etichetta">Ore lavorate a ${esc(MESI[Number(m.slice(5, 7)) - 1])}</div><div class="num">${minutiInOre(riep.minutiFatti)} <small>/ ${minutiInOre(riep.minuti)} in calendario</small></div><div class="sotto">${riep.fatti} turni fatti · ${riep.inCalendario} ancora da fare</div></div>
   <div class="k t-azzurro"><div class="etichetta">Straordinari</div><div class="num">${minutiInOre(riep.straordinari)}</div><div class="sotto">oltre le ${ore(c.ore_settimanali * 60)} h settimanali</div></div>
   <div class="k t-navy"><div class="etichetta">Notturne · festive</div><div class="num">${minutiInOre(riep.notte)} <small>· ${minutiInOre(riep.festivo)}</small></div><div class="sotto">notte ${esc(String(c.notte_inizio).slice(0, 5))}–${esc(String(c.notte_fine).slice(0, 5))} · festivi nazionali</div></div>
   <div class="k t-lilla"><div class="etichetta">Ferie e permessi</div><div class="num">${c.ferie_giorni_anno == null ? '—' : g(s.ferie.residue) + ' g'} <small>· ${c.permessi_ore_anno == null ? '—' : g(s.permessi.residui) + ' h'}</small></div><div class="sotto">residui · ${ferieMese} ${ferieMese === 1 ? 'giorno' : 'giorni'} di ferie nel mese</div></div>
  </section>
  <div class="griglia-lavoro"><div class="col">
   <section class="card"><div class="card-testa"><h2>Calendario dei turni</h2><button class="link" data-hotel-turni>Modifica settimana →</button></div><div class="contenuto">${calendario(m, riep)}</div></section>
   <section class="card"><div class="card-testa"><h2>Turni del mese</h2></div>${tabellaTurni(riep)}</section>
  </div><div class="col">${cartaStipendio(m, riep)}${cartaNote(m)}${cartaFerie()}</div></div>`;
}

// ------------------------------------------------------------------ Ferie e permessi
function vistaFerie() {
  const anno = annoFerie ||= Number(oggi().slice(0, 4));
  const elenco = state.hotelAssenze.filter(a => a.data.startsWith(String(anno))).sort((a, b) => b.data.localeCompare(a.data));
  const s = saldi(state.hotelContratto, state.hotelAssenze, anno, oggi());
  const g = n => (Math.round(n * 10) / 10).toLocaleString('it-IT');
  return `${avvisoTabelle()}<div class="griglia-lavoro"><div class="col">
  <section class="card"><div class="card-testa"><h2>Registra un'assenza</h2></div><form id="hotel-assenza" class="form-riga contenuto">
   <label class="field">Giorno<input type="date" name="data" value="${oggi()}" required></label>
   <label class="field">Tipo<select name="tipo">${Object.entries(TIPI_ASSENZA).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
   <label class="field">Ore (per i permessi)<input name="ore" inputmode="decimal" placeholder="es. 2"></label>
   <label class="field largo">Note<input name="note" maxlength="2000" placeholder="facoltative"></label>
   <button class="btn primary" type="submit">Aggiungi</button><p class="form-error" role="alert"></p></form></section>
  <section class="card"><div class="card-testa"><h2>Assenze ${anno}</h2><span class="mese-nav piccolo"><button class="icona-tonda" data-hotel-anno="-1" aria-label="Anno precedente">‹</button><b>${anno}</b><button class="icona-tonda" data-hotel-anno="1" aria-label="Anno successivo">›</button></span></div>
   <div class="barra-strumenti"><span class="spazio"></span><button class="btn" data-hotel-csv="assenze">CSV</button></div>
   <div class="table-wrap"><table class="dati"><thead><tr><th>Giorno</th><th>Tipo</th><th class="n">Ore</th><th class="nasc">Note</th><th></th></tr></thead><tbody>
   ${elenco.map(a => `<tr class="${a.data > oggi() ? 'futuro' : ''}"><td>${giornoBreve(a.data)}/${a.data.slice(2, 4)}</td><td><span class="pill ${PILL[a.tipo]}">${TIPI_ASSENZA[a.tipo]}</span></td><td class="n">${a.ore ? ore(a.ore * 60) : '–'}</td><td class="nasc">${esc(a.note)}</td><td class="n"><button class="link" data-hotel-elimina-assenza="${a.id}">Elimina</button></td></tr>`).join('') || '<tr><td colspan="5" class="vuoto-tabella">Nessuna assenza registrata in questo anno.</td></tr>'}
   </tbody></table></div></section></div>
  <div class="col"><section class="card"><div class="card-testa"><h2>Saldo ${anno}</h2><a class="link" href="#/hotel/contratto">Contratto →</a></div><div class="contenuto">
   <div class="riga2"><span>Ferie: saldo iniziale</span><b>${g(s.ferie.iniziali)} g</b></div>
   <div class="riga2"><span>Ferie maturate finora</span><b>${g(s.ferie.maturate)} g</b></div>
   <div class="riga2"><span>Godute · già segnate</span><b>${s.ferie.godute} · ${s.ferie.pianificate} g</b></div>
   <div class="riga2 totale"><span>Ferie residue</span><b>${g(s.ferie.residue)} g</b></div>
   <div class="riga2"><span>Permessi: saldo iniziale</span><b>${g(s.permessi.iniziali)} h</b></div>
   <div class="riga2"><span>Permessi maturati finora</span><b>${g(s.permessi.maturati)} h</b></div>
   <div class="riga2"><span>Usati · già segnati</span><b>${g(s.permessi.goduti)} · ${g(s.permessi.pianificati)} h</b></div>
   <div class="riga2 totale"><span>Permessi residui</span><b>${g(s.permessi.residui)} h</b></div>
   <div class="riga2"><span>Malattia</span><b>${s.malattia} g</b></div>
   <p class="subtext piccolo">Le ferie maturano un dodicesimo al mese, fino al mese in corso. Il residuo di fine anno passa da solo all'anno dopo.</p></div></section></div></div>`;
}

// ------------------------------------------------------------------ Buste paga
function vistaBuste() {
  const elenco = [...state.bustePaga].sort((a, b) => b.mese.localeCompare(a.mese));
  return `${avvisoTabelle()}<div class="griglia-lavoro"><div class="col">
  <section class="card"><div class="card-testa"><h2>Registra una busta paga</h2></div><form id="hotel-busta" class="form-riga contenuto">
   <label class="field">Mese<input type="month" name="mese" value="${meseScelto}" required></label>
   <label class="field">Netto ricevuto (€)<input name="netto" inputmode="decimal" required placeholder="es. 1500"></label>
   <label class="field">Lordo (€)<input name="lordo" inputmode="decimal" placeholder="facoltativo"></label>
   <label class="field">Ore pagate<input name="ore_pagate" inputmode="decimal" placeholder="facoltativo"></label>
   <label class="field">Straordinari pagati (h)<input name="straordinari_pagati" inputmode="decimal" placeholder="facoltativo"></label>
   <label class="field largo">Note<input name="note" maxlength="2000" placeholder="es. conguaglio, trattenute"></label>
   <button class="btn primary" type="submit">Salva</button><p class="form-error" role="alert"></p></form>
   <p class="subtext piccolo contenuto">Se il mese c'è già, i valori vengono aggiornati.</p></section>
  <section class="card"><div class="card-testa"><h2>Buste paga</h2></div><div class="barra-strumenti"><span class="spazio"></span><button class="btn" data-hotel-csv="buste">CSV</button><button class="btn" data-stampa>Stampa</button></div>
   <div class="table-wrap"><table class="dati"><thead><tr><th>Mese</th><th class="n">Netto</th><th class="n">Previsto</th><th class="n">Differenza</th><th class="n nasc">Ore lavorate</th><th class="n nasc">Straord. pagati / contati</th><th></th></tr></thead><tbody>
   ${elenco.map(b => { const m = b.mese.slice(0, 7), prev = stipendioPrevisto(state.hotelContratto, m), r = riepilogoMese(state.scheduleEntries, state.hotelContratto, m, tz()), diff = prev ? Number(b.netto) - prev.totale : null;
      return `<tr><td>${esc(nomeMese(m))}</td><td class="n">${euro(b.netto)}</td><td class="n">${prev ? euro(prev.totale) : '—'}</td><td class="n ${diff == null ? '' : diff < -0.005 ? 'negativo' : diff > 0.005 ? 'positivo' : ''}">${diff == null ? '—' : (diff > 0 ? '+' : '') + euro(diff)}</td><td class="n nasc">${ore(r.minuti)}</td><td class="n nasc">${b.straordinari_pagati != null ? ore(b.straordinari_pagati * 60) : '–'} / ${ore(r.straordinari)}</td><td class="n"><button class="link" data-hotel-elimina-busta="${b.id}">Elimina</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="vuoto-tabella">Nessuna busta paga registrata.</td></tr>'}
   </tbody></table></div></section></div>
  <div class="col">${cartaStipendio(meseScelto, riepilogoMese(state.scheduleEntries, state.hotelContratto, meseScelto, tz()))}</div></div>`;
}

// ------------------------------------------------------------------ Note di turno
function vistaNote() {
  const turni = state.scheduleEntries.filter(e => e.kind === 'shift' && e.entry_date?.startsWith(meseScelto)).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  return `<section class="card"><div class="card-testa"><h2>Note di turno · ${esc(nomeMese(meseScelto))}</h2></div><div class="contenuto note-turni">
  ${turni.map(e => { const k = tipoTurno(e); return `<form class="nota-modulo" data-hotel-nota="${e.id}"><div><b>${giornoBreve(e.entry_date)}</b> <span class="pill ${PILL[k]}">${etichettaTurno(k)}</span> <small>${ora(e.starts_at)}–${ora(e.ends_at)}</small></div><textarea name="notes" rows="2" maxlength="5000" placeholder="Consegne, cose da passare al collega…">${esc(e.notes || '')}</textarea><button class="btn" type="submit">Salva</button></form>`; }).join('') || '<p class="vuoto-giornata">Nessun turno in questo mese.</p>'}
  </div></section>`;
}

// ------------------------------------------------------------------ Contratto
function vistaContratto() {
  const c = contrattoDi(state.hotelContratto), extra = new Set((c.mensilita_extra || []).map(m => Number(m.mese)));
  const v = x => x == null ? '' : esc(String(x).replace('.', ','));
  return `${avvisoTabelle()}<section class="card"><div class="card-testa"><h2>Contratto</h2></div><form id="hotel-contratto" class="contenuto form-contratto">
  <fieldset><legend>Paga</legend>
   <label class="field">Netto mensile (€)<input name="netto_mensile" inputmode="decimal" value="${v(c.netto_mensile)}" placeholder="es. 1500"></label>
   <label class="field">Lordo mensile (€)<input name="lordo_mensile" inputmode="decimal" value="${v(c.lordo_mensile)}" placeholder="facoltativo"></label>
   <label class="check"><input type="checkbox" name="m14" ${extra.has(7) ? 'checked' : ''}> 14ª mensilità a luglio</label>
   <label class="check"><input type="checkbox" name="m13" ${extra.has(12) ? 'checked' : ''}> 13ª mensilità a dicembre</label></fieldset>
  <fieldset><legend>Orario</legend>
   <label class="field">Ore al giorno<input name="ore_giornaliere" inputmode="decimal" value="${v(c.ore_giornaliere)}"></label>
   <label class="field">Ore a settimana (oltre sono straordinari)<input name="ore_settimanali" inputmode="decimal" value="${v(c.ore_settimanali)}"></label>
   <label class="field">Notte dalle<input type="time" name="notte_inizio" value="${esc(String(c.notte_inizio).slice(0, 5))}"></label>
   <label class="field">alle<input type="time" name="notte_fine" value="${esc(String(c.notte_fine).slice(0, 5))}"></label></fieldset>
  <fieldset><legend>Ferie e permessi</legend>
   <label class="field">Giorni di ferie all'anno<input name="ferie_giorni_anno" inputmode="decimal" value="${v(c.ferie_giorni_anno)}" placeholder="dalla busta paga"></label>
   <label class="field">Ore di permesso all'anno<input name="permessi_ore_anno" inputmode="decimal" value="${v(c.permessi_ore_anno)}" placeholder="dalla busta paga"></label>
   <label class="field">Saldo ferie a inizio anno (g)<input name="ferie_saldo_iniziale" inputmode="decimal" value="${v(c.ferie_saldo_iniziale)}"></label>
   <label class="field">Saldo permessi a inizio anno (h)<input name="permessi_saldo_iniziale" inputmode="decimal" value="${v(c.permessi_saldo_iniziale)}"></label>
   <label class="field">Anno del saldo<input name="anno_saldo" inputmode="numeric" value="${v(c.anno_saldo || Number(oggi().slice(0, 4)))}"></label></fieldset>
  <label class="field largo">Note<textarea name="note" rows="3" maxlength="5000" placeholder="es. livello, CCNL, scatti">${esc(c.note || '')}</textarea></label>
  <div class="form-actions"><button class="btn primary" type="submit">Salva il contratto</button></div><p class="form-error" role="alert"></p>
  <p class="subtext piccolo">I valori restano nel tuo account Supabase e non finiscono nel codice dell'app.</p></form></section>`;
}

export function hotelPage(id) {
  const scheda = SCHEDE.some(([k]) => k === id) ? id : 'mese';
  meseScelto ||= oggi().slice(0, 7);
  const viste = { mese: vistaMese, ferie: vistaFerie, buste: vistaBuste, note: vistaNote, contratto: vistaContratto };
  return `<div class="lavoro">${testa()}${schede(scheda)}${viste[scheda]()}</div>`;
}

// ------------------------------------------------------------------ eventi
async function prova(fn, render, messaggio = 'Salvato') {
  try { await fn(); toast(messaggio); render(); } catch (e) { toast(e.message); }
}
function erroreModulo(form, e) { const el = form.querySelector('.form-error'); if (el) el.textContent = e.message; else toast(e.message); }

export function bindHotel(render) {
  const pagina = document.querySelector('.lavoro');
  if (!pagina) return;
  pagina.querySelectorAll('[data-hotel-mese]').forEach(b => b.onclick = () => { meseScelto = spostaMese(meseScelto, Number(b.dataset.hotelMese)); render(); });
  pagina.querySelectorAll('[data-hotel-anno]').forEach(b => b.onclick = () => { annoFerie += Number(b.dataset.hotelAnno); render(); });
  pagina.querySelectorAll('[data-hotel-turni]').forEach(b => b.onclick = () => openWorkWeek(render, weekStart(meseScelto === oggi().slice(0, 7) ? oggi() : meseScelto + '-01')));
  pagina.querySelectorAll('[data-hotel-giorno]').forEach(b => b.onclick = () => openWorkWeek(render, weekStart(b.dataset.hotelGiorno)));
  pagina.querySelectorAll('[data-hotel-filtro]').forEach(b => b.onclick = () => { filtroTurno = b.dataset.hotelFiltro; render(); });
  pagina.querySelectorAll('[data-stampa]').forEach(b => b.onclick = () => window.print());
  pagina.querySelectorAll('[data-hotel-csv]').forEach(b => b.onclick = () => esporta(b.dataset.hotelCsv));
  const assenza = document.getElementById('hotel-assenza');
  if (assenza) assenza.onsubmit = async e => { e.preventDefault(); const f = new FormData(assenza); try { await saveAssenza(Object.fromEntries(f)); toast('Assenza registrata'); render(); } catch (err) { erroreModulo(assenza, err); } };
  const busta = document.getElementById('hotel-busta');
  if (busta) busta.onsubmit = async e => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(busta));
    const esistente = state.bustePaga.find(b => b.mese.startsWith(v.mese));
    try { await saveBustaPaga(v, esistente); toast('Busta paga salvata'); render(); } catch (err) { erroreModulo(busta, err); }
  };
  const contratto = document.getElementById('hotel-contratto');
  if (contratto) contratto.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(contratto), v = Object.fromEntries(f);
    v.mensilita_extra = [...(f.get('m14') ? [{ mese: 7, nome: '14ª' }] : []), ...(f.get('m13') ? [{ mese: 12, nome: '13ª' }] : [])];
    try { await saveContratto(v); toast('Contratto salvato'); render(); } catch (err) { erroreModulo(contratto, err); }
  };
  pagina.querySelectorAll('[data-hotel-nota]').forEach(form => form.onsubmit = async e => {
    e.preventDefault();
    const voce = state.scheduleEntries.find(x => x.id === form.dataset.hotelNota);
    if (voce) await prova(() => saveEntry({ ...entryPayload(voce), notes: form.elements.notes.value }, voce), render, 'Nota salvata');
  });
  pagina.querySelectorAll('[data-hotel-elimina-assenza]').forEach(b => b.onclick = () => { const r = state.hotelAssenze.find(x => x.id === b.dataset.hotelEliminaAssenza); confirmDelete(`Eliminare ${TIPI_ASSENZA[r.tipo].toLowerCase()} del ${r.data.split('-').reverse().join('/')}?`, async () => { await elimina('hotel_assenze', r); render(); }); });
  pagina.querySelectorAll('[data-hotel-elimina-busta]').forEach(b => b.onclick = () => { const r = state.bustePaga.find(x => x.id === b.dataset.hotelEliminaBusta); confirmDelete(`Eliminare la busta paga di ${nomeMese(r.mese.slice(0, 7))}?`, async () => { await elimina('hotel_buste_paga', r); render(); }); });
}

function esporta(cosa) {
  if (cosa === 'turni') {
    const r = riepilogoMese(state.scheduleEntries, state.hotelContratto, meseScelto, tz());
    scaricaCsv(`turni-${meseScelto}.csv`, [['Giorno', 'Turno', 'Inizio', 'Fine', 'Ore', 'Notturne', 'Festive', 'Note'],
      ...r.turni.map(t => [t.voce.entry_date, etichettaTurno(tipoTurno(t.voce)), ora(t.voce.starts_at), ora(t.voce.ends_at), numeroCsv(t.totale / 60), numeroCsv(t.notte / 60), numeroCsv(t.festivo / 60), t.voce.notes || '']),
      ['Totale', '', '', '', numeroCsv(r.minuti / 60), numeroCsv(r.notte / 60), numeroCsv(r.festivo / 60), `Straordinari ${numeroCsv(r.straordinari / 60)} h`]]);
  } else if (cosa === 'assenze') {
    scaricaCsv(`assenze-${annoFerie}.csv`, [['Giorno', 'Tipo', 'Ore', 'Note'], ...state.hotelAssenze.filter(a => a.data.startsWith(String(annoFerie))).sort((a, b) => a.data.localeCompare(b.data)).map(a => [a.data, TIPI_ASSENZA[a.tipo], numeroCsv(a.ore), a.note])]);
  } else if (cosa === 'buste') {
    scaricaCsv('buste-paga.csv', [['Mese', 'Netto', 'Previsto', 'Lordo', 'Ore pagate', 'Straordinari pagati', 'Note'], ...[...state.bustePaga].sort((a, b) => a.mese.localeCompare(b.mese)).map(b => [b.mese.slice(0, 7), numeroCsv(b.netto), numeroCsv(stipendioPrevisto(state.hotelContratto, b.mese.slice(0, 7))?.totale), numeroCsv(b.lordo), numeroCsv(b.ore_pagate), numeroCsv(b.straordinari_pagati), b.note])]);
  }
}
