// Sezione "Università" (anteprime approvate il 20/11/2026: 04-universita.html e 05-materia.html).
// Panoramica: Materie · Appelli · Simulazioni · Errori da ripassare · Libretto.
// Scheda materia: Panoramica · Lezioni · Piano di studio · Appelli · Simulazioni ed errori ·
// Elaborati · Scheda ufficiale. Le materie restano progetti con il JSON nelle note.
import { state } from '../services/store.js?v=65';
import { saveProject } from '../services/dataService.js?v=65';
import { aggiornaMateria, impostaLezioni, segnaLezione, salvaTitoloLezione, importaTitoli, salvaPiano, importaPiano, salvaAppello, salvaSimulazione, salvaErrore, aggiornaRipasso, salvaElaborato, eliminaUni, PROVE, ESITI, STATI_ELABORATO } from '../services/universitaService.js?v=70';
import { testoDocx, righeFoglio } from '../services/checklistReader.js?v=65';
import { subjectForm } from './university.js?v=65';
import { universityData, universityStats, studyStatuses, encodeUniversity } from '../utils/university.js?v=65';
import { materie, datiMateria, registro, studioPerMateria, appelliFuturi, iscrizioneUrgente, dopoRipasso, daRipassare, migliorSimulazione, leggiSchede, normalizzaNome } from '../utils/universita.js?v=70';
import { minutiInOre } from '../utils/hotel.js?v=70';
import { weekStart } from '../utils/agenda.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, closeModal, bindForm, confirmDelete, toast } from '../utils/dom.js?v=65';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const SCHEDE_GENERALI = [['materie', 'Materie'], ['appelli', 'Appelli'], ['simulazioni', 'Simulazioni'], ['errori', 'Errori da ripassare'], ['libretto', 'Libretto']];
const SCHEDE_MATERIA = [['panoramica', 'Panoramica'], ['lezioni', 'Lezioni'], ['piano', 'Piano di studio'], ['appelli', 'Appelli'], ['prove', 'Simulazioni ed errori'], ['elaborati', 'Elaborati'], ['scheda', 'Scheda ufficiale']];
const CLASSE_STATO = { planned: 's-iniziare', studying: 's-studio', ready: 's-sostenere', passed: 's-superato' };
const SEZIONI_UFFICIALI = [['obiettivi', 'Obiettivi formativi'], ['risultati', 'Risultati di apprendimento attesi'], ['syllabus', 'Programma del corso'], ['books', 'Testi consigliati'], ['examMode', "Modalità d'esame"], ['accertamento', 'Modalità di accertamento'], ['propedeuticita', 'Propedeuticità'], ['prerequisiti', 'Prerequisiti'], ['organizzazione', 'Organizzazione didattica']];

const tz = () => state.timezone;
const oggi = () => today(tz());
const dataBreve = d => d ? `${Number(d.slice(8))} ${MESI[Number(d.slice(5, 7)) - 1]}` : '—';
const dataLunga = d => d ? d.split('-').reverse().join('/') : '—';
const materiaDi = id => state.projects.find(p => p.id === id);
const nomeMateria = id => materiaDi(id)?.name || '—';
const avviso = () => state.universitaError ? `<div class="avviso">${esc(state.universitaError)} Materie e voti funzionano già.</div>` : '';
const schede = (lista, attiva, base) => `<nav class="schede-sezione" aria-label="Schede">${lista.map(([k, n]) => `<a class="chip ${k === attiva ? 'on' : ''}" href="${base}${k === lista[0][0] ? '' : '/' + k}" ${k === attiva ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
const percentuale = (a, b) => b ? Math.round(a / b * 100) : 0;
const barra = (p, colore) => `<div class="barra"><i style="width:${Math.min(100, p)}%;background:${colore}"></i></div>`;
const opzioni = (valori, attuale) => Object.entries(valori).map(([k, n]) => `<option value="${esc(k)}" ${k === attuale ? 'selected' : ''}>${esc(n)}</option>`).join('');

function studioSettimana() {
  const lun = weekStart(oggi()), dom = shiftDate(lun, 6);
  const fatte = [...studioPerMateria(state.scheduleEntries, state.timeLogs, state.projects, lun, dom, tz()).values()].reduce((s, x) => s + x.fatte, 0);
  const obiettivo = state.weeklyGoals.find(g => g.week_start === lun && g.category === 'study' && g.unit === 'minutes')?.target || 480;
  return { fatte, obiettivo };
}
const appelliDi = id => state.uniAppelli.filter(a => a.materia_id === id);
const prossimoAppello = id => appelliFuturi(id ? appelliDi(id) : state.uniAppelli, oggi())[0];

// ================================================================== panoramica generale
function cartaMateria(p, studioMese) {
  const d = datiMateria(p), reg = registro(p, state.uniLezioni), app = prossimoAppello(p.id);
  const sim = migliorSimulazione(state.uniSimulazioni.filter(s => s.materia_id === p.id));
  const elaborato = state.uniElaborati.find(e => e.materia_id === p.id && e.stato !== 'valutato');
  const terzo = d.studyStatus === 'passed' ? `<span>Voto<br><b>${d.passFail ? 'Idoneo' : d.grade + (d.honours ? ' e lode' : '')}</b></span>` : sim ? `<span>Simulazione<br><b>${sim.corrette}/${sim.domande}</b></span>` : elaborato ? `<span>Elaborato<br><b>${esc(STATI_ELABORATO[elaborato.stato].toLowerCase())}</b></span>` : '';
  const pi = reg.intermedia.totali ? percentuale(reg.intermedia.seguite, reg.intermedia.totali) : null;
  return `<a class="materia-carta" href="#/university/${esc(p.id)}"><div class="riga-t1"><div><h3>${esc(p.name)}</h3><span class="pill ${CLASSE_STATO[d.studyStatus] || 's-iniziare'}">${esc(studyStatuses[d.studyStatus] || 'Da iniziare')}</span></div><span class="cfu">${d.credits ? d.credits + ' CFU' : ''}</span></div>
  <div class="prog"><span>Lezioni</span>${barra(percentuale(reg.tutte.seguite, reg.tutte.totali), 'var(--teal)')}<b>${reg.tutte.totali ? `${reg.tutte.seguite}/${reg.tutte.totali}` : '—'}</b>${pi != null ? `<span>Intermedia</span>${barra(pi, 'var(--azzurro)')}<b>${pi}%</b>` : ''}</div>
  <div class="piede"><span>Appello<br><b>${app ? `${dataBreve(app.data)} · ${esc(PROVE[app.prova].replace('Prova ', ''))}` : 'da fissare'}</b></span><span>Studio a ${MESI[Number(oggi().slice(5, 7)) - 1]}<br><b>${studioMese?.fatte ? minutiInOre(studioMese.fatte) : '—'}</b></span>${terzo}</div></a>`;
}
function rigaAppello(a, conMateria = true) {
  const urgente = iscrizioneUrgente(a, oggi());
  const stato = a.esito ? `<span class="pill ${a.esito === 'superato' ? 's-superato' : 's-iniziare'}">${ESITI[a.esito]}</span>` : a.iscritto ? '<span class="pill s-superato">iscritto</span>' : a.iscrizione_entro ? `<span class="${urgente ? 'att' : 'pill s-iniziare'}">${urgente ? 'iscriviti entro ' : 'iscrizione entro '}${dataLunga(a.iscrizione_entro).slice(0, 5)}</span>` : '<span class="pill s-iniziare">da iscriversi</span>';
  return `<div class="app-riga"><div class="app-data"><b>${Number(a.data.slice(8))}</b><span>${MESI[Number(a.data.slice(5, 7)) - 1]}</span></div><div><b>${conMateria ? esc(nomeMateria(a.materia_id)) : esc(PROVE[a.prova])}</b><small>${conMateria ? esc(PROVE[a.prova]) + ' · ' : ''}${esc(a.modalita || '')}${a.ora ? ' · ore ' + esc(a.ora.slice(0, 5)) : ''}</small></div><span class="dx">${stato}<button class="link" data-uni-appello="${esc(a.id)}">Modifica</button></span></div>`;
}
function vistaMaterie() {
  const lista = materie(state.projects).filter(p => p.status !== 'archived');
  const inizioMese = oggi().slice(0, 8) + '01', studioMese = studioPerMateria(state.scheduleEntries, state.timeLogs, state.projects, inizioMese, oggi(), tz());
  const lun = weekStart(oggi()), studioSett = studioPerMateria(state.scheduleEntries, state.timeLogs, state.projects, lun, shiftDate(lun, 6), tz());
  const s = universityStats(materie(state.projects)), sett = studioSettimana(), app = prossimoAppello(), errori = daRipassare(state.uniErrori, oggi());
  const conStudio = lista.filter(p => studioMese.get(p.id)?.fatte || studioSett.get(p.id)?.fatte || state.uniPiano.some(r => r.materia_id === p.id));
  return `<section class="kpi-lavoro">
   <div class="k t-corallo"><div class="etichetta">Prossimo appello</div><div class="num">${app ? dataBreve(app.data) : '—'}</div><div class="sotto">${app ? `${esc(nomeMateria(app.materia_id))} · ${esc(PROVE[app.prova].toLowerCase())}${app.iscrizione_entro && !app.iscritto ? ` · iscrizione entro il ${dataLunga(app.iscrizione_entro).slice(0, 5)}` : ''}` : 'aggiungi gli appelli dalla scheda di ogni materia'}</div></div>
   <div class="k t-azzurro"><div class="etichetta">Studio della settimana</div><div class="num">${minutiInOre(sett.fatte)} <small>/ ${minutiInOre(sett.obiettivo)}</small></div>${barra(percentuale(sett.fatte, sett.obiettivo), 'var(--c-studio)')}</div>
   <div class="k t-navy"><div class="etichetta">CFU · media</div><div class="num">${s.credits} <small>/ ${s.totalCredits} CFU · media ${s.weighted ? s.weighted.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '—'}</small></div><div class="sotto">${s.passed} esami superati su ${s.subjects}</div></div>
   <div class="k t-lilla"><div class="etichetta">Errori da ripassare</div><div class="num">${errori.length}</div><div class="sotto">${state.uniErrori.filter(e => !e.risolto).length} aperti in tutto</div></div></section>
  ${lista.length ? `<div class="materie-griglia">${lista.map(p => cartaMateria(p, studioMese.get(p.id))).join('')}</div>` : `<section class="card vuota-cta"><p>Nessuna materia. Importa il documento dell'ateneo con le schede delle materie, oppure aggiungile a mano.</p><button class="btn primary" data-uni-importa>Importa schede (.docx)</button></section>`}
  <div class="griglia-lavoro"><div class="col"><section class="card"><div class="card-testa"><h2>Studio per materia</h2><a class="link" href="#/today">Apri Agenda →</a></div>
   <div class="table-wrap"><table class="dati"><thead><tr><th>Materia</th><th class="n">Settimana</th><th class="n">Mese</th><th class="n nasc">Lezioni seguite</th><th class="n nasc">Piano fatto</th></tr></thead><tbody>
   ${conStudio.map(p => { const reg = registro(p, state.uniLezioni), piano = state.uniPiano.filter(r => r.materia_id === p.id); return `<tr><td><a href="#/university/${esc(p.id)}">${esc(p.name)}</a></td><td class="n">${studioSett.get(p.id)?.fatte ? minutiInOre(studioSett.get(p.id).fatte) : '–'}</td><td class="n">${studioMese.get(p.id)?.fatte ? minutiInOre(studioMese.get(p.id).fatte) : '–'}</td><td class="n nasc">${reg.tutte.totali ? `${reg.tutte.seguite} / ${reg.tutte.totali}` : '–'}</td><td class="n nasc">${piano.length ? `${piano.filter(r => r.fatto).length} / ${piano.length}` : '–'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="vuoto-tabella">Lo studio arriva dai blocchi "Studio" dell\'Agenda collegati a una materia.</td></tr>'}
   </tbody></table></div></section></div>
  <div class="col"><section class="card"><div class="card-testa"><h2>Prossimi appelli</h2><a class="link" href="#/university/appelli">Tutti →</a></div><div class="contenuto">${appelliFuturi(state.uniAppelli, oggi()).slice(0, 4).map(a => rigaAppello(a)).join('') || '<p class="vuoto-giornata">Nessun appello in calendario.</p>'}</div></section></div></div>`;
}
function vistaAppelliTutti() {
  const lista = [...state.uniAppelli].sort((a, b) => (a.data < oggi()) - (b.data < oggi()) || a.data.localeCompare(b.data));
  return `<section class="card"><div class="card-testa"><h2>Appelli</h2><button class="link" data-uni-nuovo-appello>+ Appello</button></div><div class="contenuto">${lista.map(a => rigaAppello(a)).join('') || '<p class="vuoto-giornata">Nessun appello. Aggiungili con "+ Appello" quando escono in piattaforma.</p>'}</div></section>`;
}
function tabellaSimulazioni(lista, conMateria) {
  return `<div class="table-wrap"><table class="dati"><thead><tr><th>Data</th>${conMateria ? '<th>Materia</th>' : ''}<th>Prova</th><th class="n">Punteggio</th><th class="n">%</th><th class="n nasc">Minuti</th><th></th></tr></thead><tbody>
  ${lista.map(s => `<tr><td>${dataLunga(s.data)}</td>${conMateria ? `<td>${esc(nomeMateria(s.materia_id))}</td>` : ''}<td>${esc(PROVE[s.prova])}</td><td class="n"><b>${s.corrette}</b> / ${s.domande}</td><td class="n">${percentuale(s.corrette, s.domande)}%</td><td class="n nasc">${s.minuti || '–'}</td><td class="n"><button class="link" data-uni-simulazione="${esc(s.id)}">Modifica</button></td></tr>`).join('') || `<tr><td colspan="${conMateria ? 7 : 6}" class="vuoto-tabella">Nessuna simulazione registrata.</td></tr>`}
  </tbody></table></div>`;
}
function vistaSimulazioniTutte() {
  const lista = [...state.uniSimulazioni].sort((a, b) => b.data.localeCompare(a.data));
  return `<section class="card"><div class="card-testa"><h2>Simulazioni</h2><button class="link" data-uni-nuova-simulazione>+ Simulazione</button></div>${tabellaSimulazioni(lista, true)}</section>`;
}
function rigaErrore(e, conMateria) {
  const scaduto = !e.risolto && (!e.prossimo_ripasso || e.prossimo_ripasso <= oggi());
  return `<div class="errore ${e.risolto ? 'risolto' : ''}"><div><b>${esc(e.domanda)}</b><small>${conMateria ? esc(nomeMateria(e.materia_id)) + ' · ' : ''}${e.lezione ? 'lezione ' + e.lezione + ' · ' : ''}${e.risolto ? 'imparato' : scaduto ? 'da rivedere oggi' : 'prossimo ripasso il ' + dataLunga(e.prossimo_ripasso).slice(0, 5)} · ripassi ${e.ripassi}</small>${e.risposta ? `<p>${esc(e.risposta)}</p>` : ''}</div><span class="dx">${!e.risolto ? `<button class="btn" data-uni-ripassato="${esc(e.id)}">Ripassato ✓</button>` : ''}<button class="link" data-uni-errore="${esc(e.id)}">Modifica</button></span></div>`;
}
function vistaErroriTutti() {
  const oggiLista = daRipassare(state.uniErrori, oggi()), altri = state.uniErrori.filter(e => !oggiLista.includes(e)).sort((a, b) => (a.risolto - b.risolto) || String(a.prossimo_ripasso).localeCompare(String(b.prossimo_ripasso)));
  return `<section class="card"><div class="card-testa"><h2>Da ripassare oggi · ${oggiLista.length}</h2><button class="link" data-uni-nuovo-errore>+ Errore</button></div><div class="contenuto">${oggiLista.map(e => rigaErrore(e, true)).join('') || '<p class="vuoto-giornata">Niente da ripassare oggi.</p>'}</div></section>
  <section class="card"><div class="card-testa"><h2>Tutti gli errori</h2></div><div class="contenuto">${altri.map(e => rigaErrore(e, true)).join('') || '<p class="vuoto-giornata">Gli errori che segni nelle simulazioni tornano qui a 1, 3, 7, 14 e 30 giorni.</p>'}</div></section>`;
}
function vistaLibretto() {
  const lista = materie(state.projects), s = universityStats(lista);
  return `<section class="card"><div class="card-testa"><h2>Libretto</h2></div><div class="table-wrap"><table class="dati"><thead><tr><th>Materia</th><th class="n">CFU</th><th>Stato</th><th class="n">Voto</th><th class="nasc">Data esame</th></tr></thead><tbody>
  ${lista.map(p => { const d = universityData(p); return `<tr><td><a href="#/university/${esc(p.id)}">${esc(p.name)}</a></td><td class="n">${d.credits ?? '–'}</td><td><span class="pill ${CLASSE_STATO[d.studyStatus]}">${esc(studyStatuses[d.studyStatus])}</span></td><td class="n">${d.studyStatus === 'passed' ? (d.passFail ? 'Idoneo' : `${d.grade}${d.honours ? ' e lode' : ''}`) : '–'}</td><td class="nasc">${d.examDate ? dataLunga(d.examDate) : '–'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="vuoto-tabella">Nessuna materia.</td></tr>'}
  </tbody><tfoot><tr><td>${s.passed} superati</td><td class="n">${s.credits} / ${s.totalCredits}</td><td></td><td class="n">${s.weighted ? 'media ' + s.weighted.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : ''}</td><td class="nasc"></td></tr></tfoot></table></div></section>`;
}

// ================================================================== scheda materia
function gigliaLezioni(p, reg) {
  return `<div class="lezioni-griglia">${reg.lezioni.map(l => `<button class="lez ${l.prova === 'intermedia' ? 'int' : l.prova === 'finale' ? 'fin' : ''} ${l.seguita ? 'fatta' : ''}" data-uni-lezione="${l.numero}" title="${esc(l.titolo || 'Lezione ' + l.numero)}${l.seguita ? ' · seguita' : ''}">${l.numero}</button>`).join('') || '<p class="vuoto-giornata">Imposta il numero di lezioni nella scheda Lezioni.</p>'}</div>
  ${reg.lezioni.length ? `<div class="legenda">${datiMateria(p).intermediaFino ? `<span><i class="int"></i>Prova intermedia (1–${datiMateria(p).intermediaFino})</span><span><i class="fin"></i>Prova finale (${datiMateria(p).intermediaFino + 1}–${reg.lezioni.length})</span>` : ''}<span><i></i>Da seguire · tocca un numero per segnarlo</span></div>` : ''}`;
}
function tabellaPiano(p, solo) {
  const righe = state.uniPiano.filter(r => r.materia_id === p.id).sort((a, b) => a.posizione - b.posizione);
  const mostrate = solo ? righe.slice(0, solo) : righe, ore = righe.reduce((s, r) => s + Number(r.ore || 0), 0);
  return `<div class="table-wrap"><table class="dati"><thead><tr><th>Settimana</th><th>Argomento</th><th class="nasc">Lezioni</th><th class="n">Ore</th><th>Fatto</th>${solo ? '' : '<th></th>'}</tr></thead><tbody>
  ${mostrate.map(r => `<tr><td>${esc(r.settimana)}</td><td class="testo-lungo">${esc(r.argomento)}</td><td class="nasc">${esc(r.lezioni)}</td><td class="n">${r.ore != null ? Number(r.ore).toLocaleString('it-IT') : '–'}</td><td><button class="spunta ${r.fatto ? 'si' : ''}" data-uni-piano-fatto="${esc(r.id)}" aria-label="${r.fatto ? 'Segna da fare' : 'Segna fatto'}">${r.fatto ? '✓' : ''}</button></td>${solo ? '' : `<td class="n"><button class="link" data-uni-piano="${esc(r.id)}">Modifica</button></td>`}</tr>`).join('') || `<tr><td colspan="${solo ? 5 : 6}" class="vuoto-tabella">Il piano di studio lo scrivi tu: aggiungi le righe o importale da Excel.</td></tr>`}
  </tbody>${righe.length ? `<tfoot><tr><td>Totale</td><td>${righe.filter(r => r.fatto).length} di ${righe.length} righe fatte</td><td class="nasc"></td><td class="n">${ore.toLocaleString('it-IT')}</td><td></td>${solo ? '' : '<td></td>'}</tr></tfoot>` : ''}</table></div>`;
}
function graficoSimulazioni(lista) {
  const ultime = [...lista].sort((a, b) => a.data.localeCompare(b.data)).slice(-6);
  if (!ultime.length) return '<p class="vuoto-giornata">Nessuna simulazione. Registra le prove da 24 e da 7 domande per vedere l\'andamento.</p>';
  return `<div class="grafico-sim">${ultime.map(s => `<div><b>${s.corrette}/${s.domande}</b><i style="height:${Math.max(6, percentuale(s.corrette, s.domande))}%" class="${s.prova}"></i><span>${dataLunga(s.data).slice(0, 5)}</span></div>`).join('')}</div>`;
}
function panoramicaMateria(p) {
  const d = datiMateria(p), reg = registro(p, state.uniLezioni), sim = state.uniSimulazioni.filter(s => s.materia_id === p.id), best = migliorSimulazione(sim);
  const app = prossimoAppello(p.id), errori = state.uniErrori.filter(e => e.materia_id === p.id), daFare = daRipassare(errori, oggi());
  const mese = studioPerMateria(state.scheduleEntries, state.timeLogs, state.projects, oggi().slice(0, 8) + '01', oggi(), tz()).get(p.id);
  const piano = state.uniPiano.filter(r => r.materia_id === p.id);
  return `<section class="kpi-lavoro">
   <div class="k t-azzurro"><div class="etichetta">Lezioni seguite</div><div class="num">${reg.tutte.seguite} <small>/ ${reg.tutte.totali || '—'}</small></div><div class="sotto">${d.intermediaFino ? `intermedia ${reg.intermedia.seguite}/${reg.intermedia.totali} · finale ${reg.finale.seguite}/${reg.finale.totali}` : 'imposta dove finisce la prova intermedia'}</div></div>
   <div class="k t-lilla"><div class="etichetta">Migliore simulazione</div><div class="num">${best ? `${best.corrette} <small>/ ${best.domande}</small>` : '—'}</div><div class="sotto">${sim.length} ${sim.length === 1 ? 'simulazione' : 'simulazioni'}</div></div>
   <div class="k t-corallo"><div class="etichetta">Prossimo appello</div><div class="num">${app ? dataBreve(app.data) : '—'}</div><div class="sotto">${app ? `${esc(PROVE[app.prova].toLowerCase())}${app.iscrizione_entro && !app.iscritto ? ' · iscrizione entro ' + dataLunga(app.iscrizione_entro).slice(0, 5) : app.iscritto ? ' · iscritto' : ''}` : 'aggiungilo nella scheda Appelli'}</div></div>
   <div class="k t-navy"><div class="etichetta">Studio</div><div class="num">${mese?.fatte ? minutiInOre(mese.fatte) : '0 h'} <small>questo mese</small></div><div class="sotto">piano: ${piano.length ? `${piano.filter(r => r.fatto).length} di ${piano.length} righe fatte` : 'non ancora scritto'}</div></div></section>
  <div class="griglia-lavoro"><div class="col">
   <section class="card"><div class="card-testa"><h2>Registro lezioni</h2><a class="link" href="#/university/${esc(p.id)}/lezioni">Dettaglio →</a></div><div class="contenuto">${gigliaLezioni(p, reg)}</div></section>
   <section class="card"><div class="card-testa"><h2>Piano di studio</h2><a class="link" href="#/university/${esc(p.id)}/piano">Tutto il piano →</a></div>${tabellaPiano(p, 6)}</section>
  </div><div class="col">
   <section class="card"><div class="card-testa"><h2>Simulazioni</h2><button class="link" data-uni-nuova-simulazione>+ Registra</button></div><div class="contenuto">${graficoSimulazioni(sim)}</div></section>
   <section class="card"><div class="card-testa"><h2>Errori da ripassare · ${daFare.length}</h2><a class="link" href="#/university/${esc(p.id)}/prove">Tutti →</a></div><div class="contenuto">${daFare.slice(0, 3).map(e => rigaErrore(e, false)).join('') || '<p class="vuoto-giornata">Niente da ripassare oggi.</p>'}</div></section>
   <section class="card"><div class="card-testa"><h2>Appelli</h2><button class="link" data-uni-nuovo-appello>+ Appello</button></div><div class="contenuto">${appelliDi(p.id).sort((a, b) => a.data.localeCompare(b.data)).map(a => rigaAppello(a, false)).join('') || '<p class="vuoto-giornata">Nessun appello.</p>'}</div></section>
  </div></div>`;
}
function lezioniMateria(p) {
  const d = datiMateria(p), reg = registro(p, state.uniLezioni);
  return `<section class="card"><div class="card-testa"><h2>Impostazioni</h2></div><form id="uni-impostazioni" class="form-riga contenuto">
   <label class="field">Numero di lezioni<input name="totali" inputmode="numeric" value="${d.lezioniTotali || ''}" required></label>
   <label class="field">Prova intermedia fino alla lezione<input name="intermedia" inputmode="numeric" value="${d.intermediaFino || ''}" placeholder="vuoto = esame unico"></label>
   <button class="btn primary" type="submit">Salva</button><p class="form-error" role="alert"></p></form></section>
  <section class="card"><div class="card-testa"><h2>Registro · ${reg.tutte.seguite} di ${reg.tutte.totali} seguite</h2></div><div class="contenuto">${gigliaLezioni(p, reg)}</div>
  <div class="table-wrap"><table class="dati"><thead><tr><th class="n">N.</th><th>Titolo</th><th class="nasc">Prova</th><th>Seguita</th></tr></thead><tbody>
  ${reg.lezioni.map(l => `<tr><td class="n">${l.numero}</td><td><input class="titolo-lezione" data-uni-titolo="${l.numero}" value="${esc(l.titolo)}" maxlength="300" placeholder="Titolo della lezione" aria-label="Titolo della lezione ${l.numero}"></td><td class="nasc">${l.prova === 'unica' ? '–' : esc(PROVE[l.prova])}</td><td><button class="spunta ${l.seguita ? 'si' : ''}" data-uni-lezione="${l.numero}" aria-label="${l.seguita ? 'Segna da seguire' : 'Segna seguita'}">${l.seguita ? '✓' : ''}</button> <small>${l.data ? dataLunga(l.data).slice(0, 5) : ''}</small></td></tr>`).join('')}
  </tbody></table></div></section>`;
}
function pianoMateria(p) {
  return `<section class="card"><div class="card-testa"><h2>Piano di studio</h2><span class="azioni-riga"><button class="link" data-uni-piano-importa>Importa da Excel / CSV</button><button class="link" data-uni-piano-incolla>Incolla righe</button><button class="link" data-uni-nuovo-piano>+ Riga</button></span></div>${tabellaPiano(p)}
  <input type="file" id="uni-piano-file" accept=".xlsx,.xls,.ods,.csv,.tsv" hidden>
  <p class="subtext piccolo contenuto">Colonne attese, in quest'ordine: settimana, argomento, lezioni, ore. La prima riga può essere l'intestazione.</p></section>`;
}
function appelliMateria(p) {
  return `<section class="card"><div class="card-testa"><h2>Appelli</h2><button class="link" data-uni-nuovo-appello>+ Appello</button></div><div class="contenuto">${appelliDi(p.id).sort((a, b) => a.data.localeCompare(b.data)).map(a => rigaAppello(a, false)).join('') || '<p class="vuoto-giornata">Nessun appello. Aggiungili quando escono in piattaforma.</p>'}</div></section>`;
}
function proveMateria(p) {
  const sim = state.uniSimulazioni.filter(s => s.materia_id === p.id).sort((a, b) => b.data.localeCompare(a.data));
  const errori = state.uniErrori.filter(e => e.materia_id === p.id).sort((a, b) => (a.risolto - b.risolto) || String(a.prossimo_ripasso).localeCompare(String(b.prossimo_ripasso)));
  return `<div class="griglia-lavoro"><div class="col"><section class="card"><div class="card-testa"><h2>Simulazioni</h2><button class="link" data-uni-nuova-simulazione>+ Simulazione</button></div><div class="contenuto">${graficoSimulazioni(sim)}</div>${tabellaSimulazioni(sim, false)}</section></div>
  <div class="col"><section class="card"><div class="card-testa"><h2>Errori da ripassare</h2><button class="link" data-uni-nuovo-errore>+ Errore</button></div><div class="contenuto">${errori.map(e => rigaErrore(e, false)).join('') || '<p class="vuoto-giornata">Segna qui le domande sbagliate: tornano da ripassare dopo 1, 3, 7, 14 e 30 giorni.</p>'}</div></section></div></div>`;
}
function elaboratiMateria(p) {
  const lista = state.uniElaborati.filter(e => e.materia_id === p.id);
  return `<section class="card"><div class="card-testa"><h2>Elaborati</h2><button class="link" data-uni-nuovo-elaborato>+ Elaborato</button></div><div class="table-wrap"><table class="dati"><thead><tr><th>Titolo</th><th>Stato</th><th>Scadenza</th><th class="n">Punti</th><th></th></tr></thead><tbody>
  ${lista.map(e => `<tr><td>${esc(e.titolo)}${e.link ? ` <a href="${esc(e.link)}" target="_blank" rel="noopener">↗</a>` : ''}</td><td><span class="pill ${e.stato === 'valutato' || e.stato === 'consegnato' ? 's-superato' : e.stato === 'in_corso' ? 's-studio' : 's-iniziare'}">${STATI_ELABORATO[e.stato]}</span></td><td>${e.scadenza ? dataLunga(e.scadenza) : '–'}</td><td class="n">${e.punti ?? '–'}</td><td class="n"><button class="link" data-uni-elaborato="${esc(e.id)}">Modifica</button></td></tr>`).join('') || '<tr><td colspan="5" class="vuoto-tabella">Nessun elaborato per questa materia.</td></tr>'}
  </tbody></table></div></section>`;
}
function schedaUfficiale(p) {
  const d = universityData(p);
  const presenti = SEZIONI_UFFICIALI.filter(([k]) => d[k]);
  return `${presenti.length ? presenti.map(([k, titolo]) => `<section class="card"><div class="card-testa"><h2>${titolo}</h2></div><div class="contenuto testo-scheda">${esc(d[k])}</div></section>`).join('') : '<section class="card vuota-cta"><p>La scheda ufficiale arriva dal documento dell\'ateneo: torna su Università e premi "Importa schede (.docx)".</p></section>'}`;
}
function paginaMateria(p, sub) {
  const scheda = SCHEDE_MATERIA.some(([k]) => k === sub) ? sub : 'panoramica', d = universityData(p);
  const viste = { panoramica: panoramicaMateria, lezioni: lezioniMateria, piano: pianoMateria, appelli: appelliMateria, prove: proveMateria, elaborati: elaboratiMateria, scheda: schedaUfficiale };
  return `<div class="lavoro universita" data-materia="${esc(p.id)}"><p class="torna"><a href="#/university">← Università</a></p>
  <div class="page-heading lavoro-testa"><div><h1>${esc(p.name)}</h1><p class="subtext">${d.credits ? d.credits + ' CFU · ' : ''}${d.professor ? esc(d.professor) + ' · ' : ''}<span class="pill ${CLASSE_STATO[d.studyStatus]}">${esc(studyStatuses[d.studyStatus])}</span></p></div>
   <div class="azioni"><button class="btn" data-uni-modifica>Modifica materia</button><button class="btn quick-global" data-uni-nuova-simulazione>+ Simulazione</button></div></div>
  ${schede(SCHEDE_MATERIA, scheda, `#/university/${p.id}`)}${avviso()}${viste[scheda](p)}</div>`;
}

export function universitaPage(id, sub) {
  const materia = id && materie(state.projects).find(p => p.id === id);
  if (materia) return paginaMateria(materia, sub);
  if (id && !SCHEDE_GENERALI.some(([k]) => k === id)) return '<div class="panel empty">Materia non trovata. <a href="#/university">Torna a Università</a></div>';
  const scheda = id || 'materie', prima = materie(state.projects).map(universityData)[0] || {};
  const viste = { materie: vistaMaterie, appelli: vistaAppelliTutti, simulazioni: vistaSimulazioniTutte, errori: vistaErroriTutti, libretto: vistaLibretto };
  return `<div class="lavoro universita"><div class="page-heading lavoro-testa"><div><h1>Università</h1><p class="subtext">${esc([prima.degree, prima.year ? prima.year + '° anno' : '', prima.academicYear].filter(Boolean).join(' · ') || 'Materie, lezioni, appelli e piano di studio')}</p></div>
  <div class="azioni"><button class="btn" data-uni-importa>Importa schede (.docx)</button><button class="btn quick-global" data-uni-nuova-materia>+ Materia</button></div></div>
  <input type="file" id="uni-docx" accept=".docx" hidden>
  ${schede(SCHEDE_GENERALI, scheda, '#/university')}${avviso()}${viste[scheda]()}</div>`;
}

// ================================================================== finestre
const sceltaMateria = (attuale) => `<label class="field">Materia<select name="materia_id" required>${materie(state.projects).filter(p => p.status !== 'archived' || p.id === attuale).map(p => `<option value="${esc(p.id)}" ${p.id === attuale ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
function formAppello(a, materiaId, render) {
  const x = a || { prova: 'intermedia', data: shiftDate(oggi(), 14), esito: '', iscritto: false, materia_id: materiaId };
  openModal(a ? 'Modifica appello' : 'Nuovo appello', `<form id="uni-appello-form"><div class="form-grid">${sceltaMateria(x.materia_id)}
   <label class="field">Prova<select name="prova">${opzioni(PROVE, x.prova)}</select></label>
   <label class="field">Data<input type="date" name="data" value="${esc(x.data)}" required></label><label class="field">Ora<input type="time" name="ora" value="${esc((x.ora || '').slice(0, 5))}"></label>
   <label class="field">Modalità<input name="modalita" maxlength="120" value="${esc(x.modalita || '')}" placeholder="online, in presenza, sede…"></label>
   <label class="field">Iscrizione entro<input type="date" name="iscrizione_entro" value="${esc(x.iscrizione_entro || '')}"></label>
   <label class="check"><input type="checkbox" name="iscritto" ${x.iscritto ? 'checked' : ''}> Iscrizione fatta</label>
   <label class="field">Esito<select name="esito">${opzioni(ESITI, x.esito)}</select></label><label class="field">Punti ottenuti<input name="punti" inputmode="decimal" value="${x.punti ?? ''}"></label>
   <label class="field full">Note<textarea name="note" maxlength="2000">${esc(x.note || '')}</textarea></label></div>
   <div class="form-actions">${a ? '<button class="btn danger" type="button" id="uni-elimina">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-appello-form', async f => { await salvaAppello({ ...Object.fromEntries(f), iscritto: f.get('iscritto') === 'on' }, a); render(); });
  document.getElementById('uni-elimina')?.addEventListener('click', () => confirmDelete("Eliminare questo appello?", async () => { await eliminaUni('uni_appelli', a); render(); }));
}
function formSimulazione(s, materiaId, render) {
  const x = s || { prova: 'intermedia', domande: 24, data: oggi(), materia_id: materiaId };
  openModal(s ? 'Modifica simulazione' : 'Nuova simulazione', `<form id="uni-sim-form"><div class="form-grid">${sceltaMateria(x.materia_id)}
   <label class="field">Prova<select name="prova" id="uni-sim-prova">${opzioni(PROVE, x.prova)}</select></label>
   <label class="field">Data<input type="date" name="data" value="${esc(x.data)}" required></label>
   <label class="field">Domande<input name="domande" inputmode="numeric" value="${x.domande}" required></label>
   <label class="field">Risposte giuste<input name="corrette" inputmode="numeric" value="${x.corrette ?? ''}" required></label>
   <label class="field">Minuti<input name="minuti" inputmode="numeric" value="${x.minuti ?? ''}"></label>
   <label class="field full">Note<textarea name="note" maxlength="2000" placeholder="es. argomenti sbagliati">${esc(x.note || '')}</textarea></label></div>
   <div class="form-actions">${s ? '<button class="btn danger" type="button" id="uni-elimina">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  // Le prove di questo ateneo: 24 domande l'intermedia, 7 la finale.
  document.getElementById('uni-sim-prova').onchange = e => { const d = document.querySelector('#uni-sim-form [name=domande]'); if (!s) d.value = e.target.value === 'finale' ? 7 : 24; };
  bindForm('uni-sim-form', async f => { await salvaSimulazione(Object.fromEntries(f), s); render(); });
  document.getElementById('uni-elimina')?.addEventListener('click', () => confirmDelete('Eliminare questa simulazione?', async () => { await eliminaUni('uni_simulazioni', s); render(); }));
}
function formErrore(e, materiaId, render) {
  const x = e || { materia_id: materiaId };
  openModal(e ? 'Modifica errore' : 'Nuovo errore da ripassare', `<form id="uni-errore-form"><div class="form-grid">${sceltaMateria(x.materia_id)}
   <label class="field">Lezione<input name="lezione" inputmode="numeric" value="${x.lezione ?? ''}"></label>
   <label class="field full">Domanda o concetto sbagliato *<textarea name="domanda" maxlength="1000" required>${esc(x.domanda || '')}</textarea></label>
   <label class="field full">Risposta giusta<textarea name="risposta" maxlength="2000">${esc(x.risposta || '')}</textarea></label>
   <label class="field full">Spiegazione<textarea name="spiegazione" maxlength="5000">${esc(x.spiegazione || '')}</textarea></label></div>
   <div class="form-actions">${e ? '<button class="btn danger" type="button" id="uni-elimina">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-errore-form', async f => { await salvaErrore({ ...Object.fromEntries(f), prossimo_ripasso: shiftDate(oggi(), 1) }, e); render(); });
  document.getElementById('uni-elimina')?.addEventListener('click', () => confirmDelete('Eliminare questo errore?', async () => { await eliminaUni('uni_errori', e); render(); }));
}
function formElaborato(e, materiaId, render) {
  const x = e || { stato: 'da_iniziare', materia_id: materiaId };
  openModal(e ? 'Modifica elaborato' : 'Nuovo elaborato', `<form id="uni-elab-form"><div class="form-grid">${sceltaMateria(x.materia_id)}
   <label class="field full">Titolo *<input name="titolo" maxlength="200" required value="${esc(x.titolo || '')}"></label>
   <label class="field">Stato<select name="stato">${opzioni(STATI_ELABORATO, x.stato)}</select></label><label class="field">Scadenza<input type="date" name="scadenza" value="${esc(x.scadenza || '')}"></label>
   <label class="field">Punti bonus<input name="punti" inputmode="decimal" value="${x.punti ?? ''}" placeholder="fino a +2"></label><label class="field">Link<input type="url" name="link" maxlength="500" value="${esc(x.link || '')}"></label>
   <label class="field full">Note<textarea name="note" maxlength="5000">${esc(x.note || '')}</textarea></label></div>
   <div class="form-actions">${e ? '<button class="btn danger" type="button" id="uni-elimina">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-elab-form', async f => { await salvaElaborato(Object.fromEntries(f), e); render(); });
  document.getElementById('uni-elimina')?.addEventListener('click', () => confirmDelete('Eliminare questo elaborato?', async () => { await eliminaUni('uni_elaborati', e); render(); }));
}
function formPiano(r, materiaId, render) {
  const x = r || { materia_id: materiaId, posizione: Math.max(0, ...state.uniPiano.filter(y => y.materia_id === materiaId).map(y => y.posizione)) + 1 };
  openModal(r ? 'Modifica riga del piano' : 'Nuova riga del piano', `<form id="uni-piano-form"><input type="hidden" name="materia_id" value="${esc(x.materia_id)}"><input type="hidden" name="posizione" value="${x.posizione}"><div class="form-grid">
   <label class="field">Settimana<input name="settimana" maxlength="60" value="${esc(x.settimana || '')}" placeholder="es. 5 o 16–22 nov"></label><label class="field">Lezioni<input name="lezioni" maxlength="120" value="${esc(x.lezioni || '')}" placeholder="es. 8–10"></label>
   <label class="field full">Argomento *<input name="argomento" maxlength="300" required value="${esc(x.argomento || '')}"></label>
   <label class="field">Ore<input name="ore" inputmode="decimal" value="${x.ore ?? ''}"></label><label class="check"><input type="checkbox" name="fatto" ${x.fatto ? 'checked' : ''}> Fatto</label>
   <label class="field full">Note<textarea name="note" maxlength="2000">${esc(x.note || '')}</textarea></label></div>
   <div class="form-actions">${r ? '<button class="btn danger" type="button" id="uni-elimina">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-piano-form', async f => { await salvaPiano({ ...Object.fromEntries(f), fatto: f.get('fatto') === 'on' }, r); render(); });
  document.getElementById('uni-elimina')?.addEventListener('click', () => confirmDelete('Eliminare questa riga del piano?', async () => { await eliminaUni('uni_piano', r); render(); }));
}
function formIncolla(materiaId, render) {
  openModal('Incolla il piano di studio', `<form id="uni-incolla-form"><p class="subtext">Una riga per settimana. Colonne separate da tabulazione (copia da Excel o Word) o da punto e virgola: settimana; argomento; lezioni; ore.</p>
   <label class="field full"><textarea name="testo" rows="10" required placeholder="1;Pseudocodice e funzioni;1–2;10"></textarea></label>
   <div class="form-actions"><button class="btn primary" type="submit">Importa</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-incolla-form', async f => {
    const righe = String(f.get('testo')).split('\n').map(r => r.split(/\t|;/).map(c => c.trim())).filter(r => r.some(Boolean));
    const senzaIntestazione = /^settimana$/i.test(righe[0]?.[0] || '') ? righe.slice(1) : righe;
    await importaPiano(materiaId, senzaIntestazione); render();
  });
}

// Import del documento dell'ateneo: anteprima, poi crea o aggiorna le materie scelte.
async function importaDocumento(file, render) {
  let schede;
  try { schede = leggiSchede(await testoDocx(file)); } catch (e) { toast(e.message); return; }
  if (!schede.length) { toast('Nel documento non ho trovato schede di materie (titoli in maiuscolo seguiti da Obiettivi, Programma…).'); return; }
  const esistenti = new Map(materie(state.projects).map(p => [normalizzaNome(p.name), p]));
  openModal(`Schede trovate: ${schede.length}`, `<form id="uni-import-form"><p class="subtext">Scegli quali importare. Per le materie che hai già aggiorno solo la scheda ufficiale e, se mancano, numero di lezioni e divisione tra le prove: stato, voto e date restano come sono.</p>
   <div class="import-schede">${schede.map((s, i) => { const gia = esistenti.get(normalizzaNome(s.nome)); return `<label class="import-scheda"><input type="checkbox" name="s${i}" checked><span><b>${esc(s.nome)}</b><small>${gia ? 'aggiorna la materia che hai già' : 'nuova materia'} · ${s.lezioniTotali ? s.lezioniTotali + ' lezioni' : 'lezioni da indicare'}${s.intermediaFino ? ` · intermedia fino alla ${s.intermediaFino} (Piano Master)` : ''}${s.lezioni.length ? ` · ${s.lezioni.length} titoli` : ''}${s.incompleta ? ' · <span class="att">programma mancante nel documento</span>' : ''}</small></span></label>`; }).join('')}</div>
   <div class="form-actions"><button class="btn primary" type="submit">Importa le schede scelte</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('uni-import-form', async f => {
    let fatte = 0;
    for (const [i, s] of schede.entries()) {
      if (f.get('s' + i) !== 'on') continue;
      const ufficiale = { obiettivi: s.obiettivi || '', risultati: s.risultati || '', syllabus: s.programma || '', books: (s.testi || '').slice(0, 6000), examMode: (s.esame || '').slice(0, 500), accertamento: s.accertamento || '', propedeuticita: s.propedeuticita || '', prerequisiti: s.prerequisiti || '', organizzazione: s.organizzazione || '' };
      if (s.codice) ufficiale.code = s.codice;
      let p = esistenti.get(normalizzaNome(s.nome));
      if (p) {
        const d = datiMateria(p);
        await aggiornaMateria(p, { ...ufficiale, lezioniTotali: d.lezioniTotali || s.lezioniTotali, intermediaFino: d.intermediaFino || s.intermediaFino });
      } else {
        await saveProject({ name: s.nome.slice(0, 120), status: 'active', color: '#0B7FA6', description: null, notes: encodeUniversity({ studyStatus: 'planned', credits: null, grade: null, honours: false, passFail: false, ...ufficiale, lezioniTotali: s.lezioniTotali, intermediaFino: s.intermediaFino }) });
      }
      p = materie(state.projects).find(x => normalizzaNome(x.name) === normalizzaNome(s.nome));
      if (p && s.lezioni.length && !state.universitaError) await importaTitoli(p.id, s.lezioni);
      fatte++;
    }
    toast(`${fatte} ${fatte === 1 ? 'scheda importata' : 'schede importate'}`);
    render();
  });
}

export function bindUniversita(render) {
  const pagina = document.querySelector('.universita');
  if (!pagina) return;
  const materiaId = pagina.dataset.materia || null, p = materiaId && materiaDi(materiaId);
  const prova = async (fn) => { try { await fn(); render(); } catch (e) { toast(e.message); } };
  const docx = document.getElementById('uni-docx');
  pagina.querySelectorAll('[data-uni-importa]').forEach(b => b.onclick = () => docx?.click());
  if (docx) docx.onchange = () => { const f = docx.files[0]; docx.value = ''; if (f) importaDocumento(f, render); };
  pagina.querySelectorAll('[data-uni-nuova-materia]').forEach(b => b.onclick = () => subjectForm(null, render));
  pagina.querySelectorAll('[data-uni-modifica]').forEach(b => b.onclick = () => subjectForm(p, render));
  const primaMateria = () => materiaId || materie(state.projects).find(x => x.status !== 'archived')?.id;
  const serveMateria = fn => () => { if (!primaMateria()) { toast('Aggiungi prima una materia.'); return; } fn(); };
  pagina.querySelectorAll('[data-uni-nuovo-appello]').forEach(b => b.onclick = serveMateria(() => formAppello(null, primaMateria(), render)));
  pagina.querySelectorAll('[data-uni-appello]').forEach(b => b.onclick = () => formAppello(state.uniAppelli.find(a => a.id === b.dataset.uniAppello), null, render));
  pagina.querySelectorAll('[data-uni-nuova-simulazione]').forEach(b => b.onclick = serveMateria(() => formSimulazione(null, primaMateria(), render)));
  pagina.querySelectorAll('[data-uni-simulazione]').forEach(b => b.onclick = () => formSimulazione(state.uniSimulazioni.find(s => s.id === b.dataset.uniSimulazione), null, render));
  pagina.querySelectorAll('[data-uni-nuovo-errore]').forEach(b => b.onclick = serveMateria(() => formErrore(null, primaMateria(), render)));
  pagina.querySelectorAll('[data-uni-errore]').forEach(b => b.onclick = () => formErrore(state.uniErrori.find(e => e.id === b.dataset.uniErrore), null, render));
  pagina.querySelectorAll('[data-uni-ripassato]').forEach(b => b.onclick = () => { const e = state.uniErrori.find(x => x.id === b.dataset.uniRipassato); prova(() => aggiornaRipasso(e, dopoRipasso(e, oggi()))); });
  pagina.querySelectorAll('[data-uni-nuovo-elaborato]').forEach(b => b.onclick = () => formElaborato(null, materiaId, render));
  pagina.querySelectorAll('[data-uni-elaborato]').forEach(b => b.onclick = () => formElaborato(state.uniElaborati.find(e => e.id === b.dataset.uniElaborato), null, render));
  if (!p) return;
  pagina.querySelectorAll('[data-uni-lezione]').forEach(b => b.onclick = () => { const n = Number(b.dataset.uniLezione), r = state.uniLezioni.find(x => x.materia_id === p.id && x.numero === n); prova(() => segnaLezione(p.id, n, !r?.seguita, oggi())); });
  pagina.querySelectorAll('[data-uni-titolo]').forEach(i => i.onchange = () => prova(() => salvaTitoloLezione(p.id, Number(i.dataset.uniTitolo), i.value)));
  const imp = document.getElementById('uni-impostazioni');
  if (imp) imp.onsubmit = async e => { e.preventDefault(); try { await impostaLezioni(p, imp.elements.totali.value, imp.elements.intermedia.value); toast('Lezioni salvate'); render(); } catch (err) { imp.querySelector('.form-error').textContent = err.message; } };
  pagina.querySelectorAll('[data-uni-piano-fatto]').forEach(b => b.onclick = () => { const r = state.uniPiano.find(x => x.id === b.dataset.uniPianoFatto); prova(() => salvaPiano({ ...r, fatto: !r.fatto }, r)); });
  pagina.querySelectorAll('[data-uni-piano]').forEach(b => b.onclick = () => formPiano(state.uniPiano.find(x => x.id === b.dataset.uniPiano), p.id, render));
  pagina.querySelectorAll('[data-uni-nuovo-piano]').forEach(b => b.onclick = () => formPiano(null, p.id, render));
  pagina.querySelectorAll('[data-uni-piano-incolla]').forEach(b => b.onclick = () => formIncolla(p.id, render));
  const fileP = document.getElementById('uni-piano-file');
  pagina.querySelectorAll('[data-uni-piano-importa]').forEach(b => b.onclick = () => fileP?.click());
  if (fileP) fileP.onchange = async () => {
    const f = fileP.files[0]; fileP.value = ''; if (!f) return;
    try { const righe = await righeFoglio(f); const corpo = /^settimana$/i.test(String(righe[0]?.[0] || '').trim()) ? righe.slice(1) : righe; const n = (await importaPiano(p.id, corpo)).length; toast(`${n} righe importate`); render(); } catch (e) { toast(e.message); }
  };
}
