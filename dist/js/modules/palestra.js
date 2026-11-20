// Sezione "Palestra e alimentazione", riscritta dentro l'app (anteprime approvate il
// 20/11/2026: anteprime/06-palestra.html sul Mac e 07-palestra-iphone.html sul telefono).
// Prima tappa: Oggi, Diario pasti, Obiettivi e alimenti, aggiunta degli alimenti con
// ricerca e codice a barre. Allenamenti, schede, piano, misure e report usano ancora
// la Forma classica finché non vengono rifatti. I dati sono sempre l'archivio di Forma.
import { state } from '../services/store.js?v=65';
import * as P from '../services/palestraService.js?v=73';
import { riepilogoGiorno, turnoDi, obiettivoKcal, cfg, catalogo, cerca, recenti, ricette, porzioniDi, righePiano, allenamentoDelGiorno, ultimaSessione, sessioniDel, pesoAttuale, settimana, lunediDi, slotOra, macro, somma, prodottoDaOFF, di, PASTI, CATEGORIE } from '../utils/palestra.js?v=73';
import { Scanner } from '../utils/scanner.js?v=73';
import { formaClassica, bindFormaWorkspace } from './formaWorkspace.js?v=65';
import { vistaPiano, vistaMisure, vistaReport, bindPiano } from './palestraPiano.js?v=73';
import { vistaAllena, vistaSchede, vistaSessione, bindAllena, bottoneInizia, inizia } from './palestraAllena.js?v=73';
import { shiftPresets } from '../utils/workShifts.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { scaricaCsv, numeroCsv } from '../utils/esporta.js?v=70';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, closeModal, toast, confirmDelete } from '../utils/dom.js?v=65';

const SCHEDE = [['oggi', 'Oggi'], ['cibo', 'Diario pasti'], ['allena', 'Allenamenti'], ['schede', 'Schede'], ['piano', 'Piano settimanale'], ['misure', 'Misure'], ['report', 'Report'], ['obiettivi', 'Obiettivi e alimenti']];
// Schede non ancora rifatte → scheda della Forma classica che le contiene.
const CLASSICHE = {};
const PILL = { apertura: 'p-a', chiusura: 'p-c', notte: 'p-n', off: 'p-off', custom: 'p-x' };
const OFF_API = 'https://world.openfoodfacts.org/api/v2/product/';
const ICONA_SCAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>';

let giorno = null, renderPagina = () => {}, ctx = null, risultati = [];
const tz = () => state.timezone;
const oggi = () => today(tz());
const dSel = () => giorno || oggi();

// ------------------------------------------------------------ formati
const nf = new Map();
const fmt = (n, dec = 0) => {
  if (!nf.has(dec)) nf.set(dec, new Intl.NumberFormat('it-IT', { maximumFractionDigits: dec, minimumFractionDigits: 0, useGrouping: 'always' }));
  return nf.get(dec).format(Number(n) || 0);
};
const dataLunga = d => new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')).replace(/^./, c => c.toUpperCase());
const giornoBreve = d => new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const nomePasto = id => PASTI.find(p => p.id === id)?.l || 'Pasto';
const etichettaTurno = k => k === 'off' ? 'OFF' : shiftPresets[k] ? `${shiftPresets[k].label} ${shiftPresets[k].from}–${shiftPresets[k].to}` : 'Turno';
const pct = (v, t) => t > 0 ? Math.max(0, Math.min(100, Math.round(v / t * 100))) : 0;
const barra = (v, t, colore) => `<div class="barra"><i style="width:${pct(v, t)}%;background:${colore}"></i></div>`;
function quantita(r) {
  const porz = porzioniDi(r.n).find(x => Number(x.q) === Number(r.q));
  // "1 cucchiaio", "15 mandorle" dicono più dei grammi; "max giornaliero" no.
  return porz && /^\d/.test(porz.l) ? porz.l : `${fmt(r.q, 1)} g`;
}

// ------------------------------------------------------------ parti comuni
function testa(a, d) {
  const turno = a ? turnoDi(a, d, state.scheduleEntries, tz()) : '';
  const pill = turno ? `<span class="pill ${PILL[turno] || 'p-x'}">${esc(etichettaTurno(turno))}</span>` : '<span class="pill p-x">turno non inserito</span>';
  return `<div class="page-heading lavoro-testa pal-testa"><div><h1>Palestra<span class="solo-largo"> e alimentazione</span></h1><p class="subtext">${esc(dataLunga(d))} · ${pill}${a ? `<span class="solo-largo"> · obiettivo da giorno ${turno === 'off' ? 'OFF' : 'di turno'}</span>` : ''}</p></div>
  ${a ? `<div class="mese-nav piccolo"><button class="icona-tonda" data-pal-giorno="-1" aria-label="Giorno precedente">‹</button><button class="pal-oggi" data-pal-oggi title="Torna a oggi">${d === oggi() ? 'Oggi' : esc(giornoBreve(d))}</button><button class="icona-tonda" data-pal-giorno="1" aria-label="Giorno successivo">›</button></div>
  <div class="azioni"><button class="btn" data-pal-scan>${ICONA_SCAN}<span>Scansiona</span></button><button class="btn primary pal-acc" data-pal-aggiungi>+ Alimento</button></div>` : ''}</div>`;
}
const schede = attiva => `<nav class="schede-sezione pal-schede" aria-label="Schede di Palestra e alimentazione">${SCHEDE.map(([k, n]) => `<a class="chip ${k === attiva ? 'on' : ''}" href="#/sport${k === 'oggi' ? '' : '/' + k}" ${k === attiva ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;

function statoHtml() {
  const s = P.statoSalvataggio, offline = !navigator.onLine;
  if (s.stato === 'errore' || (offline && P.inAttesa())) {
    return `<div class="avviso pal-avviso">${offline ? 'Sei offline: le modifiche restano su questo dispositivo e si salvano da sole quando torna la rete.' : esc(s.messaggio)}
      <button class="link" data-pal-riprova>Riprova</button>${offline ? '' : ' · <button class="link" data-pal-scarta>Scarta le modifiche non salvate</button>'}</div>`;
  }
  return '';
}
const testoStato = () => ({ salvato: P.inAttesa() ? 'In attesa di salvataggio' : 'Tutto salvato', 'in-attesa': 'Modifiche in attesa…', 'in-corso': 'Salvataggio…', errore: 'Non salvato' })[P.statoSalvataggio.stato];

function vuoto() {
  return `<section class="card pal-vuoto"><div class="card-testa"><h2>Porta qui i tuoi dati di Forma</h2></div><div class="contenuto">
    <p>Diario, piano dei pasti, alimenti, ricette, schede, allenamenti e misure stanno nell'archivio di Forma. Sull'iPhone apri la vecchia Forma → Impostazioni → <b>Esporta tutto (file JSON)</b>, poi carica qui il file. Oppure parti da zero.</p>
    ${state.formaError ? `<p class="form-error">${esc(state.formaError)}</p>` : ''}
    <div class="form-actions"><button class="btn primary" data-pal-backup>Carica il backup (.json)</button><button class="btn" data-pal-zero>Parti da zero</button></div>
    <input type="file" id="pal-backup-file" accept="application/json,.json" hidden><p class="form-error" role="alert" id="pal-vuoto-errore"></p></div></section>`;
}

// ------------------------------------------------------------ pasti del giorno
function fascia(a, d, p) {
  const piano = righePiano(a, d, p.id);
  const righe = p.righe.length ? `<table class="dati pal-righe"><tbody>${p.righe.map(r => { const m = macro(r); return `<tr data-pal-riga="${esc(r.id)}" tabindex="0" title="Modifica"><td>${esc(r.n)}</td><td class="q">${esc(quantita(r))}</td><td class="n">${fmt(m.k)} kcal</td><td class="n nasc">${m.p ? fmt(m.p, 1) + ' P' : '—'}</td></tr>`; }).join('')}</tbody></table>
    <button class="riassunto" data-pal-slot="${p.id}">${esc(p.righe.map(r => r.n).join(', '))}</button>` : '';
  const dalPiano = !p.righe.length && piano.length ? `<div class="vuota"><span>Dal piano: ${esc(piano.map(r => `${r.n} ${fmt(r.q)} g`).join(' + '))} · ${fmt(somma(piano).k)} kcal</span><button class="btn" data-pal-dal-piano="${p.id}">Aggiungi</button></div>` : '';
  return `<div class="fascia ${p.righe.length ? '' : 'senza'}"><div class="fascia-t"><button class="fascia-nome" data-pal-slot="${p.id}">${esc(p.l)}</button><span class="tot">${p.righe.length ? `${fmt(p.tot.k)} kcal · ${fmt(p.tot.p)} g P` : '—'}</span><button class="piu" data-pal-aggiungi="${p.id}" aria-label="Aggiungi a ${esc(p.l)}">+</button></div>${righe}${dalPiano}</div>`;
}
function cartaPasti(a, d, rg) {
  const piano = righePiano(a, d);
  return `<section class="card pal-pasti"><div class="card-testa"><h2>${d === oggi() ? 'Pasti di oggi' : 'Pasti del giorno'}</h2>${piano.length ? '<button class="link" data-pal-piano>Usa il piano della settimana →</button>' : ''}</div>
    <div class="contenuto">${rg.perPasto.map(p => fascia(a, d, p)).join('')}</div></section>`;
}

// ------------------------------------------------------------ riquadri
function datiGiorno(a, d) {
  const rg = riepilogoGiorno(a, d), turno = turnoDi(a, d, state.scheduleEntries, tz());
  const c = cfg(a), all = allenamentoDelGiorno(a, d), fatte = sessioniDel(a, d).filter(w => w.fine);
  return { rg, turno, t: c.target, profilo: c.profilo, ob: obiettivoKcal(a, turno), all, fatte, peso: pesoAttuale(a, d) };
}
function kpi(x) {
  const { rg, ob, t, all, fatte, peso, profilo } = x, resto = ob - rg.tot.k, pasti = rg.perPasto.filter(p => p.righe.length).length;
  const allenamento = fatte.length ? `<div class="num">${esc(fatte[0].gn || 'Allenamento')}</div><div class="sotto">fatto ✓${fatte[0].dur ? ' · ' + fmt(fatte[0].dur) + ' min' : ''}</div>`
    : all ? `<div class="num">${esc(all.giorno.n)}</div><div class="sotto">${(all.giorno.eser || []).length} esercizi · ${esc(all.scheda.n || 'scheda')}</div>`
      : '<div class="num">Riposo</div><div class="sotto">nessuna seduta nel piano</div>';
  return `<section class="kpi-lavoro pal-desk">
    <div class="k t-corallo"><div class="etichetta">Calorie</div><div class="num">${fmt(rg.tot.k)} <small>/ ${fmt(ob)} kcal</small></div>${barra(rg.tot.k, ob, '#fff')}<div class="sotto">${resto >= 0 ? `restano ${fmt(resto)}` : `oltre di ${fmt(-resto)}`} · ${pasti} pasti su 6 registrati</div></div>
    <div class="k t-azzurro"><div class="etichetta">Proteine</div><div class="num">${fmt(rg.tot.p)} <small>/ ${fmt(t.prot)} g</small></div>${barra(rg.tot.p, t.prot, 'var(--teal)')}<div class="sotto">${rg.tot.p >= t.prot ? 'obiettivo raggiunto' : `mancano ${fmt(t.prot - rg.tot.p)} g`}</div></div>
    <div class="k t-navy"><div class="etichetta">Allenamento</div>${allenamento}</div>
    <div class="k t-lilla"><div class="etichetta">Peso</div>${peso ? `<div class="num">${fmt(peso.peso, 1)} <small>kg</small></div><div class="sotto">${peso.delta != null ? `${peso.delta > 0 ? '+' : peso.delta < 0 ? '−' : ''}${fmt(Math.abs(peso.delta), 1)} in 2 settimane · ` : ''}obiettivo ${fmt(profilo.pesoObiettivo, 1)}</div>` : '<div class="num">—</div><div class="sotto"><a href="#/sport/misure">Registra il peso</a></div>'}</div>
  </section>`;
}
function anello(k, ob, cls = '') {
  return `<div class="anello ${cls}" style="--giro:${pct(k, ob)}%"><div><b>${fmt(k)}</b><small>di ${fmt(ob)}</small></div></div>`;
}
const bicchieri = (ml, target) => { const n = Math.max(1, Math.round(target / 250)), f = Math.round(ml / 250); return `<div class="bicchieri">${Array.from({ length: Math.min(n, 16) }, (_, i) => `<i class="${i < f ? 'f' : ''}"></i>`).join('')}</div>`; };
function cartaMacro(x) {
  const { rg, ob, t } = x;
  const righe = [['Proteine', rg.tot.p, t.prot, 'var(--teal)'], ['Carboidrati', rg.tot.c, t.carb, '#8F80EE'], ['Grassi', rg.tot.g, t.gras, '#F5A524'], ['Olio', rg.olio, t.olio, '#15803D']];
  return `<section class="card"><div class="card-testa"><h2>Macro</h2></div><div class="contenuto"><div class="kcal">${anello(rg.tot.k, ob, 'grande')}<div class="macro">${righe.map(([n, v, max, col]) => `<div>${n}${barra(v, max, col)}<span>${fmt(v)} / ${fmt(max)} g</span></div>`).join('')}</div></div></div></section>`;
}
function cartaAcqua(x) {
  const { rg, t } = x;
  return `<section class="card"><div class="card-testa"><h2>Acqua e passi</h2></div><div class="contenuto"><div class="due">
    <div class="mini"><div class="etichetta">Acqua</div><div class="num">${fmt(rg.acqua)} <small>/ ${fmt(t.acqua)} ml</small></div>${bicchieri(rg.acqua, t.acqua)}<div class="azioni"><button data-pal-acqua="-250" aria-label="Togli 250 ml">−</button><button data-pal-acqua="250">+250</button><button data-pal-acqua="500">+500</button></div></div>
    <div class="mini"><div class="etichetta">Passi</div><div class="num">${fmt(rg.passi)} <small>/ ${fmt(t.passi)}</small></div>${barra(rg.passi, t.passi, '#15803D')}<div class="azioni"><button data-pal-passi>Scrivi passi</button></div></div>
  </div></div></section>`;
}
function cartaAllenamento(a, d, x) {
  const { all, fatte } = x;
  if (!all && !fatte.length) return `<section class="card"><div class="card-testa"><h2>Allenamento</h2><a class="link" href="#/sport/piano">Piano →</a></div><p class="vuoto-giornata">Riposo: nessuna seduta nel piano per questo giorno.</p></section>`;
  if (!all) return `<section class="card"><div class="card-testa"><h2>Allenamento</h2><a class="link" href="#/sport/allena">Sessioni →</a></div><div class="contenuto"><div class="all-t fatto"><div><b>${esc(fatte[0].gn || 'Allenamento')}</b><small>fatto ✓</small></div></div></div></section>`;
  const ult = ultimaSessione(a, all.scheda.id, all.giorno.n, d), fatto = fatte.some(w => w.sid === all.scheda.id && w.gn === all.giorno.n);
  const esercizi = (all.giorno.eser || []).map(e => `<div class="es"><span class="nome">${esc(e.n)}</span><span>${e.cardio ? (e.min ? esc(e.min) + ' min' : 'cardio') : `${esc(e.serie || 3)} × ${esc(e.rip || '')}`}</span><em>${e.peso ? esc(e.peso) + ' kg' : ''}</em></div>`).join('');
  return `<section class="card"><div class="card-testa"><h2>Allenamento ${d === oggi() ? 'di oggi' : 'del giorno'}</h2><a class="link" href="#/sport/piano">Cambia →</a></div><div class="contenuto">
    <div class="all-t ${fatto ? 'fatto' : ''}"><div><b>${esc(all.giorno.n)}</b><small>${esc(all.scheda.n || 'Scheda')}${ult ? ` · ultima volta ${esc(giornoBreve(ult.d))}${ult.dur ? ', ' + fmt(ult.dur) + ' min' : ''}` : ''}</small></div>${fatto ? '<span class="pill p-off">fatto ✓</span>' : bottoneInizia(a, d, all.scheda.id, all.giorno.n)}</div>
    ${esercizi}</div></section>`;
}
function cartaSettimana(a, d) {
  const giorni = settimana(a, lunediDi(d)), chiusi = giorni.filter(g => g.kcal != null && g.d < oggi());
  const fatti = giorni.filter(g => g.allenato).length, previsti = giorni.filter(g => g.previsto).length;
  return `<section class="card"><div class="card-testa"><h2>Settimana</h2><a class="link" href="#/sport/cibo">Diario →</a></div><div class="contenuto">
    <div class="sett">${giorni.map(g => `<button class="sg ${g.d === d ? 'scelto' : ''} ${g.d === oggi() ? 'oggi' : ''}" data-pal-vai="${g.d}"><b>${g.nome}</b><span>${Number(g.d.slice(8))}</span><em>${g.kcal != null ? fmt(g.kcal) : '—'}</em><i class="pall ${g.allenato ? 'ok' : g.previsto ? 'prev' : ''}"></i></button>`).join('')}</div>
    <div class="legenda"><span><i style="background:var(--corallo)"></i>allenamento fatto</span><span><i style="background:var(--riga-forte)"></i>in programma</span><span>numeri: kcal del giorno</span></div>
    <p class="nota">${fatti} allenamenti su ${previsti} in programma${chiusi.length ? ` · media ${fmt(chiusi.reduce((s, g) => s + g.kcal, 0) / chiusi.length)} kcal nei giorni chiusi` : ''}</p></div></section>`;
}
// Il blocco del telefono (anteprima 07): settimana, anello, acqua e passi, allenamento.
function blocchiTelefono(a, d, x) {
  const { rg, ob, t, all, fatte } = x, giorni = settimana(a, lunediDi(d));
  const mb = (l, v, max) => `<div class="mb">${l}<i><u style="width:${pct(v, max)}%"></u></i><span>${fmt(v)}/${fmt(max)}</span></div>`;
  const resto = ob - rg.tot.k;
  const allenamento = fatte.length ? `<div class="grosso">${esc(fatte[0].gn || 'Allenamento')}</div><small>fatto ✓</small>`
    : all ? `<div class="grosso">${esc(all.giorno.n)}</div><small>${(all.giorno.eser || []).length} esercizi · ${esc(all.scheda.n || '')}</small>` : '<div class="grosso">Riposo</div><small>nessuna seduta nel piano</small>';
  return `<div class="pal-tel">
    <div class="giorni-tel">${giorni.map(g => `<button class="${g.d === d ? 'on' : ''}" data-pal-vai="${g.d}"><b>${g.nome.slice(0, 1)}</b><span>${Number(g.d.slice(8))}</span><i class="${g.allenato ? 'ok' : ''}"></i></button>`).join('')}</div>
    <div class="tile t-corallo eroe-k">${anello(rg.tot.k, ob, 'chiaro')}<div class="dx"><div class="etq">${resto >= 0 ? `Restano ${fmt(resto)} kcal` : `Oltre di ${fmt(-resto)} kcal`}</div>${mb('P', rg.tot.p, t.prot)}${mb('C', rg.tot.c, t.carb)}${mb('G', rg.tot.g, t.gras)}</div></div>
    <div class="griglia2">
      <div class="tile t-azzurro"><div class="etq">Acqua</div><div class="grosso">${fmt(rg.acqua / 1000, 2)} <small>/ ${fmt(t.acqua / 1000, 1)} l</small></div><div class="piccoli"><button data-pal-acqua="250">+250</button><button data-pal-acqua="500">+500</button><button data-pal-acqua="-250" aria-label="Togli 250 ml">−</button></div></div>
      <div class="tile t-lilla"><div class="etq">Passi</div><div class="grosso">${fmt(rg.passi)} <small>/ ${fmt(t.passi)}</small></div><div class="piccoli"><button data-pal-passi>Scrivi</button></div></div>
    </div>
    <div class="tile t-navy all-tel"><div><div class="etq">Allenamento ${d === oggi() ? 'di oggi' : 'del giorno'}</div>${allenamento}</div>${all && !fatte.length ? bottoneInizia(a, d, all.scheda.id, all.giorno.n) : ''}</div>
  </div>`;
}

// ------------------------------------------------------------ schede
function vistaOggi(a, d) {
  const x = datiGiorno(a, d);
  return `${kpi(x)}${blocchiTelefono(a, d, x)}<div class="griglia-lavoro"><div class="col">${cartaPasti(a, d, x.rg)}</div><div class="col pal-desk">${cartaMacro(x)}${cartaAcqua(x)}${cartaAllenamento(a, d, x)}${cartaSettimana(a, d)}</div></div>`;
}
function righeSettimana(a, d) {
  return settimana(a, lunediDi(d)).map(g => {
    const rg = riepilogoGiorno(a, g.d), turno = turnoDi(a, g.d, state.scheduleEntries, tz()), ob = obiettivoKcal(a, turno);
    return { ...g, rg, turno, ob, diff: rg.righe.length ? rg.tot.k - ob : null };
  });
}
function vistaCibo(a, d) {
  const x = datiGiorno(a, d), { rg, ob, t } = x, righe = righeSettimana(a, d), chiusi = righe.filter(r => r.rg.righe.length && r.d < oggi());
  const media = k => chiusi.length ? chiusi.reduce((s, r) => s + k(r), 0) / chiusi.length : null;
  const tot = `<section class="card"><div class="card-testa"><h2>Totali del giorno</h2></div><div class="contenuto">
    <div class="riga2 totale"><span>Calorie</span><b>${fmt(rg.tot.k)} / ${fmt(ob)} kcal</b></div>
    <div class="riga2"><span>Proteine</span><b>${fmt(rg.tot.p, 1)} / ${fmt(t.prot)} g</b></div><div class="riga2"><span>Carboidrati</span><b>${fmt(rg.tot.c, 1)} / ${fmt(t.carb)} g</b></div>
    <div class="riga2"><span>Grassi</span><b>${fmt(rg.tot.g, 1)} / ${fmt(t.gras)} g</b></div><div class="riga2"><span>Olio</span><b>${fmt(rg.olio)} / ${fmt(t.olio)} g</b></div>
    <div class="riga2"><span>Acqua</span><b>${fmt(rg.acqua)} / ${fmt(t.acqua)} ml</b></div><div class="riga2"><span>Passi</span><b>${fmt(rg.passi)} / ${fmt(t.passi)}</b></div>
    ${rg.tot.k > ob ? `<div class="delta meno">Oltre l'obiettivo di ${fmt(rg.tot.k - ob)} kcal.</div>` : rg.righe.length ? `<div class="delta ok">Restano ${fmt(ob - rg.tot.k)} kcal.</div>` : ''}</div></section>`;
  const tabella = `<section class="card"><div class="card-testa"><h2>Settimana dal ${esc(giornoBreve(righe[0].d))} al ${esc(giornoBreve(righe[6].d))}</h2></div>
    <div class="barra-strumenti"><button class="chip" data-pal-sett="-7">‹ Settimana prima</button><button class="chip" data-pal-sett="7">Settimana dopo ›</button><span class="spazio"></span><button class="btn" data-pal-csv>CSV</button><button class="btn" data-stampa>Stampa</button></div>
    <div class="table-wrap"><table class="dati"><thead><tr><th>Giorno</th><th class="nasc">Turno</th><th class="n">Kcal</th><th class="n nasc">Obiettivo</th><th class="n">Diff.</th><th class="n">Proteine</th><th class="n nasc">Carbo</th><th class="n nasc">Grassi</th><th class="n nasc">Acqua</th><th class="n nasc">Passi</th><th class="nasc">Allenamento</th></tr></thead><tbody>
    ${righe.map(r => `<tr class="${r.d > oggi() ? 'futuro' : ''} ${r.d === d ? 'scelta' : ''}" data-pal-vai="${r.d}" tabindex="0"><td>${esc(giornoBreve(r.d))}</td><td class="nasc">${r.turno ? `<span class="pill ${PILL[r.turno] || 'p-x'}">${esc(r.turno === 'off' ? 'OFF' : shiftPresets[r.turno]?.label || 'Turno')}</span>` : '—'}</td>
      <td class="n">${r.rg.righe.length ? fmt(r.rg.tot.k) : '—'}</td><td class="n nasc">${fmt(r.ob)}</td><td class="n ${r.diff == null ? '' : r.diff > 0 ? 'negativo' : 'positivo'}">${r.diff == null ? '—' : (r.diff > 0 ? '+' : '−') + fmt(Math.abs(r.diff))}</td>
      <td class="n">${r.rg.righe.length ? fmt(r.rg.tot.p) + ' g' : '—'}</td><td class="n nasc">${r.rg.righe.length ? fmt(r.rg.tot.c) + ' g' : '—'}</td><td class="n nasc">${r.rg.righe.length ? fmt(r.rg.tot.g) + ' g' : '—'}</td>
      <td class="n nasc">${r.rg.acqua ? fmt(r.rg.acqua) + ' ml' : '—'}</td><td class="n nasc">${r.rg.passi ? fmt(r.rg.passi) : '—'}</td><td class="nasc">${r.allenato ? 'fatto ✓' : r.previsto ? 'in programma' : '—'}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Media</td><td class="nasc">${chiusi.length === 1 ? '1 giorno chiuso' : chiusi.length + ' giorni chiusi'}</td><td class="n">${media(r => r.rg.tot.k) == null ? '—' : fmt(media(r => r.rg.tot.k))}</td><td class="nasc"></td><td></td><td class="n">${media(r => r.rg.tot.p) == null ? '—' : fmt(media(r => r.rg.tot.p)) + ' g'}</td><td class="nasc"></td><td class="nasc"></td><td class="nasc"></td><td class="nasc"></td><td class="nasc"></td></tr></tfoot></table></div></section>`;
  return `<div class="griglia-lavoro"><div class="col">${cartaPasti(a, d, rg)}</div><div class="col">${tot}</div></div>${tabella}`;
}
function vistaObiettivi(a) {
  const { target: t, profilo: p } = cfg(a), miei = di(a, 'a').sort((x, y) => x.n.localeCompare(y.n, 'it'));
  const campo = (nome, etichetta, v, extra = '') => `<label class="field">${etichetta}<input name="${nome}" type="number" inputmode="decimal" step="any" value="${esc(v)}" ${extra}></label>`;
  return `<div class="pal-impila"><section class="card"><div class="card-testa"><h2>Obiettivi giornalieri</h2></div><div class="contenuto">
    <form id="pal-obiettivi" class="form-contratto"><fieldset><legend>Calorie e macro</legend>${campo('kcal', 'Kcal nei giorni di turno', t.kcal)}${campo('kcalOff', 'Kcal nei giorni OFF', t.kcalOff)}${campo('prot', 'Proteine (g)', t.prot)}${campo('carb', 'Carboidrati (g)', t.carb)}${campo('gras', 'Grassi (g)', t.gras)}${campo('olio', 'Olio massimo (g)', t.olio)}</fieldset>
    <fieldset><legend>Giornata</legend>${campo('acqua', 'Acqua (ml)', t.acqua)}${campo('passi', 'Passi', t.passi)}</fieldset>
    <fieldset><legend>Profilo</legend><label class="field">Nome<input name="nome" value="${esc(p.nome)}" maxlength="60"></label>${campo('altezza', 'Altezza (cm)', p.altezza)}${campo('pesoObiettivo', 'Peso obiettivo (kg)', p.pesoObiettivo)}${campo('giroObiettivo', 'Giro vita obiettivo (cm)', p.giroObiettivo)}</fieldset>
    <p class="subtext piccolo">L'obiettivo dei giorni OFF vale quando in Lavoro Hotel il giorno è segnato OFF.</p>
    <div class="form-actions"><button class="btn primary" type="submit">Salva obiettivi</button></div><p class="form-error" role="alert"></p></form></div></section>
    <section class="card"><div class="card-testa"><h2>I tuoi alimenti</h2><button class="link" data-pal-nuovo-alimento>+ Nuovo</button></div>
    <div class="barra-strumenti"><input class="pal-filtro" id="pal-filtro-alimenti" type="search" placeholder="Filtra per nome o codice" aria-label="Filtra i tuoi alimenti"><span class="spazio"></span><span class="subtext piccolo">${miei.length} alimenti · valori per 100 g</span></div>
    <div class="table-wrap"><table class="dati"><thead><tr><th>Nome</th><th class="nasc">Categoria</th><th class="n">Kcal</th><th class="n">P</th><th class="n nasc">C</th><th class="n nasc">G</th><th class="nasc">Codice</th></tr></thead><tbody>
    ${miei.length ? miei.map(x => `<tr data-pal-alimento="${esc(x.id)}" data-cerca="${esc((x.n + ' ' + (x.ean || '')).toLowerCase())}" tabindex="0" title="Modifica"><td>${esc(x.n)}</td><td class="nasc">${esc(x.cat || 'Altro')}</td><td class="n">${fmt(x.k)}</td><td class="n">${fmt(x.p, 1)}</td><td class="n nasc">${fmt(x.c, 1)}</td><td class="n nasc">${fmt(x.g, 1)}</td><td class="nasc">${esc(x.ean || '')}</td></tr>`).join('') : '<tr><td colspan="7" class="vuoto-tabella">Nessun alimento tuo: si aggiungono creando un alimento o scansionando un codice a barre.</td></tr>'}
    </tbody></table></div></section></div>`;
}
function vistaClassica(k) {
  return `<div class="avviso">Questa scheda è ancora quella della vecchia Forma: la sto rifacendo nello stile dell'app. I dati sono gli stessi.</div>${formaClassica(CLASSICHE[k])}`;
}

export function palestraPage(id, sub) {
  const a = P.archivio(), d = dSel();
  if (a && id === 'sessione') return `<div class="lavoro palestra" data-scheda="sessione"><div id="pal-stato">${statoHtml()}</div>${vistaSessione(a, sub)}</div>`;
  const scheda = SCHEDE.some(([k]) => k === id) ? id : 'oggi';
  if (!a) return `<div class="lavoro palestra">${testa(null, d)}${vuoto()}</div>`;
  const viste = { oggi: () => vistaOggi(a, d), cibo: () => vistaCibo(a, d), allena: () => vistaAllena(a, d), schede: () => vistaSchede(a, d), piano: () => vistaPiano(a, d), misure: () => vistaMisure(a, d), report: () => vistaReport(a, d), obiettivi: () => vistaObiettivi(a) };
  const corpo = viste[scheda] ? viste[scheda]() : vistaClassica(scheda);
  return `<div class="lavoro palestra" data-scheda="${scheda}">${testa(a, d)}<div class="pal-sotto-testa">${schede(scheda)}<span class="pal-salvataggio" id="pal-salvataggio" role="status">${testoStato()}</span></div><div id="pal-stato">${statoHtml()}</div>${corpo}</div>`;
}

// ------------------------------------------------------------ aggiungere un alimento
const FILTRI = [['tutti', 'Tutti'], ['recenti', 'Recenti'], ['miei', 'Miei'], ['ricette', 'Ricette']];
function apriAggiungi(d, slot, scelto = null, dest = null) {
  ctx = { dest, d, slot: slot || (d === oggi() ? slotOra() : 'pranzo'), filtro: 'tutti', testo: '', scelto, q: scelto ? (scelto.q || porzioniDi(scelto.n)[0]?.q || 100) : '' };
  openModal(dest ? `Aggiungi a ${dest.nome || 'giornata'}` : 'Aggiungi un alimento', `<div class="pal-agg">
    <div class="pal-agg-testa"><label class="field">Pasto<select id="pal-slot">${PASTI.map(p => `<option value="${p.id}" ${p.id === ctx.slot ? 'selected' : ''}>${esc(p.l)}</option>`).join('')}</select></label><span class="subtext piccolo">${dest ? 'giornata tipo del piano' : esc(dataLunga(d))}</span></div>
    <div class="pal-cerca"><input id="pal-testo" type="search" placeholder="Cerca un alimento…" autocomplete="off" enterkeyhint="search" ${scelto ? '' : 'autofocus'}><button type="button" class="pal-scan-btn" data-pal-scan-modal aria-label="Scansiona il codice a barre">${ICONA_SCAN}</button></div>
    <div class="pal-filtri">${FILTRI.map(([k, n]) => `<button type="button" class="chip ${k === 'tutti' ? 'on' : ''}" data-pal-filtro="${k}">${n}</button>`).join('')}</div>
    <div id="pal-scelto"></div><div id="pal-risultati" class="pal-risultati"></div>
    <p class="pal-nota">Non c'è? <button type="button" class="link" data-pal-crea>Crea un alimento</button> oppure inquadra il codice a barre: i valori arrivano da Open Food Facts e il prodotto resta tra i tuoi.</p></div>`);
  const box = document.querySelector('#modal .pal-agg');
  box.querySelector('#pal-slot').onchange = e => { ctx.slot = e.target.value; disegnaScelto(); };
  box.querySelector('#pal-testo').oninput = e => { ctx.testo = e.target.value; disegnaRisultati(); };
  box.querySelectorAll('[data-pal-filtro]').forEach(b => b.onclick = () => { ctx.filtro = b.dataset.palFiltro; box.querySelectorAll('[data-pal-filtro]').forEach(x => x.classList.toggle('on', x === b)); disegnaRisultati(); });
  box.querySelector('[data-pal-scan-modal]').onclick = () => scansiona(ctx.d, ctx.slot);
  box.querySelector('[data-pal-crea]').onclick = () => apriAlimento(null, { n: ctx.testo, d: ctx.d, slot: ctx.slot });
  disegnaRisultati(); disegnaScelto();
}
function disegnaRisultati() {
  const el = document.getElementById('pal-risultati');
  if (!el) return;
  const a = P.archivio(), testo = ctx.testo.trim();
  const filtra = l => testo ? cerca(l, testo, 40) : l;
  let titolo = '';
  if (ctx.filtro === 'recenti') risultati = filtra(recenti(a, 40));
  else if (ctx.filtro === 'miei') risultati = filtra(catalogo(a).filter(x => x.mio));
  else if (ctx.filtro === 'ricette') risultati = filtra(ricette(a).map(r => ({ ...r, ricetta: true })));
  else if (testo) risultati = cerca(catalogo(a), testo, 40);
  else { risultati = recenti(a, 12); titolo = risultati.length ? '<p class="pal-titoletto">Usati di recente</p>' : '<p class="pal-titoletto">Scrivi il nome di un alimento: ci sono le tabelle CREA e i tuoi.</p>'; }
  el.innerHTML = titolo + (risultati.length ? risultati.map((x, i) => {
    if (x.ricetta) { const t = somma(x.righe); return `<button type="button" class="ris" data-pal-ris="${i}"><span><b>${esc(x.n)}</b><small>ricetta · ${x.righe.length} alimenti</small></span><span class="dx">${fmt(t.k)} kcal<br>${fmt(t.p)} P</span></button>`; }
    return `<button type="button" class="ris" data-pal-ris="${i}"><span><b>${esc(x.n)}${x.mio ? '<span class="tag">mio</span>' : ''}</b><small>${x.q ? `l'ultima volta ${fmt(x.q, 1)} g` : esc(x.cat || '')}${x.ean ? ' · codice ' + esc(x.ean) : ''}</small></span><span class="dx">${fmt(x.k)} kcal<br>${fmt(x.p, 1)} P</span></button>`;
  }).join('') : testo ? '<p class="pal-titoletto">Nessun risultato.</p>' : '');
  el.querySelectorAll('[data-pal-ris]').forEach(b => b.onclick = () => {
    const x = risultati[Number(b.dataset.palRis)];
    ctx.scelto = x; ctx.q = x.q || porzioniDi(x.n)[0]?.q || 100;
    disegnaScelto();
    document.getElementById('pal-scelto')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    document.getElementById('pal-q')?.select();
  });
}
function anteprimaValori(x, q) {
  const m = macro({ ...x, q });
  return `<div><b>${fmt(m.k)}</b><span>kcal</span></div><div><b>${fmt(m.p, 1)}</b><span>proteine</span></div><div><b>${fmt(m.c, 1)}</b><span>carbo</span></div><div><b>${fmt(m.g, 1)}</b><span>grassi</span></div>`;
}
function chipsPorzioni(x, q) {
  const lista = [...porzioniDi(x.n).map(p => ({ l: p.l + (/\d\s?g\b/.test(p.l) ? '' : ` · ${fmt(p.q)} g`), q: p.q }))];
  for (const g of [50, 100, 150, 200]) if (!lista.some(p => Number(p.q) === g)) lista.push({ l: `${g} g`, q: g });
  return lista.slice(0, 7).map(p => `<button type="button" class="chip ${Number(p.q) === Number(q) ? 'on' : ''}" data-pal-porz="${p.q}">${esc(p.l)}</button>`).join('');
}
function disegnaScelto() {
  const el = document.getElementById('pal-scelto');
  if (!el) return;
  const x = ctx.scelto;
  if (!x) { el.innerHTML = ''; return; }
  if (x.ricetta) {
    const t = somma(x.righe);
    el.innerHTML = `<div class="scelto"><div class="top"><b>${esc(x.n)}</b><small>${fmt(t.k)} kcal · ${fmt(t.p)} g P</small></div><ul class="pal-ricetta">${x.righe.map(r => `<li>${esc(r.n)} <span>${fmt(r.q, 1)} g</span></li>`).join('')}</ul><button type="button" class="btn primary pieno" data-pal-conferma>Aggiungi a ${esc(nomePasto(ctx.slot))}</button><p class="form-error" role="alert"></p></div>`;
  } else {
    el.innerHTML = `<div class="scelto"><div class="top"><b>${esc(x.n)}</b><small>per 100 g: ${fmt(x.k)} kcal</small></div>
      <div class="grammi"><label class="g"><input id="pal-q" type="number" inputmode="decimal" min="1" max="5000" step="any" value="${esc(ctx.q)}" aria-label="Grammi"><small>g</small></label><div class="porz">${chipsPorzioni(x, ctx.q)}</div></div>
      <div class="quattro" id="pal-anteprima">${anteprimaValori(x, ctx.q)}</div>
      <button type="button" class="btn primary pieno" data-pal-conferma>Aggiungi a ${esc(nomePasto(ctx.slot))}</button><p class="form-error" role="alert"></p></div>`;
    const q = el.querySelector('#pal-q');
    q.oninput = () => { ctx.q = q.value; el.querySelector('#pal-anteprima').innerHTML = anteprimaValori(x, Number(String(q.value).replace(',', '.')) || 0); el.querySelectorAll('[data-pal-porz]').forEach(c => c.classList.toggle('on', Number(c.dataset.palPorz) === Number(q.value))); };
    q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); conferma(); } };
    el.querySelectorAll('[data-pal-porz]').forEach(c => c.onclick = () => { q.value = c.dataset.palPorz; q.oninput(); });
  }
  el.querySelector('[data-pal-conferma]').onclick = conferma;
}
function conferma() {
  const x = ctx.scelto, err = document.querySelector('#pal-scelto .form-error');
  try {
    if (ctx.dest) { for (const r of x.ricetta ? x.righe : [{ ...x, q: ctx.q }]) P.aggiungiRigaGiornata(ctx.dest.gt, ctx.slot, r, r.q); toast(`Aggiunto alla giornata: ${x.n}`); }
    else if (x.ricetta) { const n = P.aggiungiRicetta(ctx.d, ctx.slot, x); toast(`${x.n}: ${n} alimenti in ${nomePasto(ctx.slot)}`); }
    else { const r = P.aggiungiRiga(ctx.d, ctx.slot, x, ctx.q); toast(`Aggiunto a ${nomePasto(ctx.slot)}: ${x.n} · ${fmt(r.q, 1)} g`); }
    // La finestra resta aperta per il prossimo alimento dello stesso pasto.
    ctx.scelto = null; ctx.testo = '';
    const t = document.getElementById('pal-testo'); if (t) { t.value = ''; t.focus(); }
    disegnaScelto(); disegnaRisultati(); renderPagina();
  } catch (e) { if (err) err.textContent = e.message; else toast(e.message); }
}

// ------------------------------------------------------------ voce del diario, pasto, passi
function apriRiga(id) {
  const r = P.archivio().items.find(x => x.id === id && x.t === 'l');
  if (!r) return;
  openModal(r.n, `<form id="pal-riga" class="pal-agg"><div class="scelto"><div class="top"><b>${esc(r.n)}</b><small>per 100 g: ${fmt(r.k)} kcal</small></div>
    <div class="grammi"><label class="g"><input id="pal-q" name="q" type="number" inputmode="decimal" min="1" max="5000" step="any" value="${esc(r.q)}" aria-label="Grammi" autofocus><small>g</small></label><div class="porz">${chipsPorzioni(r, r.q)}</div></div>
    <div class="quattro" id="pal-anteprima">${anteprimaValori(r, r.q)}</div>
    <label class="field">Pasto<select name="slot">${PASTI.map(p => `<option value="${p.id}" ${p.id === r.slot ? 'selected' : ''}>${esc(p.l)}</option>`).join('')}</select></label></div>
    <div class="form-actions"><button type="button" class="btn danger" data-pal-elimina-riga>Elimina</button><button type="submit" class="btn primary">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-riga'), q = f.querySelector('#pal-q');
  q.oninput = () => { f.querySelector('#pal-anteprima').innerHTML = anteprimaValori(r, Number(String(q.value).replace(',', '.')) || 0); f.querySelectorAll('[data-pal-porz]').forEach(c => c.classList.toggle('on', Number(c.dataset.palPorz) === Number(q.value))); };
  f.querySelectorAll('[data-pal-porz]').forEach(c => c.onclick = () => { q.value = c.dataset.palPorz; q.oninput(); });
  f.onsubmit = e => { e.preventDefault(); try { P.modificaRiga(r.id, { q: q.value, slot: f.elements.slot.value }); closeModal(); renderPagina(); } catch (err) { f.querySelector('.form-error').textContent = err.message; } };
  f.querySelector('[data-pal-elimina-riga]').onclick = () => { P.eliminaRiga(r.id); closeModal(); toast(`Tolto: ${r.n}`); renderPagina(); };
}
// Sul telefono un pasto si apre in una finestra: righe, totale, aggiungi, dal piano.
function apriPasto(d, slot) {
  const a = P.archivio(), p = riepilogoGiorno(a, d).perPasto.find(x => x.id === slot), piano = righePiano(a, d, slot);
  openModal(`${p.l} · ${giornoBreve(d)}`, `<div class="pal-agg">${p.righe.length ? `<div class="pal-risultati">${p.righe.map(r => { const m = macro(r); return `<button type="button" class="ris" data-pal-riga-modal="${esc(r.id)}"><span><b>${esc(r.n)}</b><small>${esc(quantita(r))}</small></span><span class="dx">${fmt(m.k)} kcal<br>${fmt(m.p, 1)} P</span></button>`; }).join('')}</div>
    <div class="riga2 totale"><span>Totale</span><b>${fmt(p.tot.k)} kcal · ${fmt(p.tot.p)} g P</b></div>` : '<p class="subtext">Ancora niente in questo pasto.</p>'}
    <div class="form-actions">${piano.length ? `<button type="button" class="btn" data-pal-dal-piano-modal>Dal piano (${fmt(somma(piano).k)} kcal)</button>` : ''}<button type="button" class="btn primary" data-pal-agg-modal>+ Aggiungi alimento</button></div></div>`);
  const m = document.getElementById('modal');
  m.querySelectorAll('[data-pal-riga-modal]').forEach(b => b.onclick = () => apriRiga(b.dataset.palRigaModal));
  m.querySelector('[data-pal-agg-modal]').onclick = () => apriAggiungi(d, slot);
  m.querySelector('[data-pal-dal-piano-modal]')?.addEventListener('click', () => dalPiano(d, slot));
}
function dalPiano(d, slot) {
  try { const n = P.applicaPasto(P.archivio(), d, slot); closeModal(); toast(`${nomePasto(slot)} dal piano: ${n} alimenti`); renderPagina(); } catch (e) { toast(e.message); }
}
function apriPassi(d) {
  const g = riepilogoGiorno(P.archivio(), d);
  openModal('Passi', `<form id="pal-passi-form"><label class="field">Passi di ${esc(giornoBreve(d))}<input name="passi" type="number" inputmode="numeric" min="0" max="100000" value="${g.passi || ''}" autofocus></label><div class="form-actions"><button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-passi-form');
  f.onsubmit = e => { e.preventDefault(); try { P.impostaPassi(d, f.elements.passi.value || 0); closeModal(); renderPagina(); } catch (err) { f.querySelector('.form-error').textContent = err.message; } };
}

// ------------------------------------------------------------ alimento personale e codice a barre
function apriAlimento(esistente, opz = {}) {
  const v = esistente || opz;
  openModal(esistente ? 'Modifica alimento' : opz.ean ? 'Prodotto dal codice a barre' : 'Nuovo alimento', `<form id="pal-alimento" class="form-contratto">
    ${opz.nota ? `<p class="avviso">${esc(opz.nota)}</p>` : ''}
    <fieldset><label class="field largo">Nome<input name="n" value="${esc(v.n || '')}" maxlength="120" required autofocus></label>
    <label class="field">Categoria<select name="cat">${CATEGORIE.map(c => `<option ${c === (v.cat || 'Altro') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></fieldset>
    <fieldset><legend>Valori per 100 g</legend>${[['k', 'Kcal'], ['p', 'Proteine (g)'], ['c', 'Carboidrati (g)'], ['g', 'Grassi (g)']].map(([k, l]) => `<label class="field">${l}<input name="${k}" type="number" inputmode="decimal" step="any" min="0" value="${esc(v[k] ?? '')}" required></label>`).join('')}</fieldset>
    <fieldset><label class="field">Codice a barre<input name="ean" inputmode="numeric" value="${esc(v.ean || '')}" maxlength="14"></label><label class="field">Confezione o nota<input name="nt" value="${esc(v.nt || '')}" maxlength="120"></label></fieldset>
    <div class="form-actions">${esistente ? '<button type="button" class="btn danger" data-pal-elimina-alimento>Elimina</button>' : ''}<button class="btn primary" type="submit">${!esistente && opz.d ? 'Salva e aggiungi' : 'Salva'}</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-alimento');
  f.onsubmit = e => {
    e.preventDefault();
    try {
      const nuovo = P.salvaAlimento(Object.fromEntries(new FormData(f)), esistente);
      if (!esistente && opz.d) { apriAggiungi(opz.d, opz.slot, { ...nuovo, mio: true }); } else { closeModal(); toast('Alimento salvato'); }
      renderPagina();
    } catch (err) { f.querySelector('.form-error').textContent = err.message; }
  };
  f.querySelector('[data-pal-elimina-alimento]')?.addEventListener('click', () => confirmDelete(`Eliminare "${esistente.n}" dai tuoi alimenti? Le voci già scritte nel diario restano.`, async () => { P.eliminaAlimento(esistente.id); renderPagina(); }));
}
function scansiona(d, slot) {
  if (document.getElementById('modal')?.open) closeModal();
  if (!Scanner.disponibile()) { codiceAMano(d, slot, 'La fotocamera non è disponibile qui: scrivi il codice.'); return; }
  Scanner.apri(codice => gestisciCodice(codice, d, slot), () => codiceAMano(d, slot));
}
function codiceAMano(d, slot, nota = '') {
  openModal('Codice a barre', `<form id="pal-codice">${nota ? `<p class="subtext">${esc(nota)}</p>` : ''}<label class="field">Le cifre sotto le barre<input name="codice" inputmode="numeric" pattern="[0-9]*" maxlength="14" autofocus></label><div class="form-actions"><button class="btn primary" type="submit">Cerca</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-codice');
  f.onsubmit = e => { e.preventDefault(); const c = f.elements.codice.value.replace(/\D/g, ''); if (!/^\d{8}$|^\d{12,14}$/.test(c)) { f.querySelector('.form-error').textContent = 'Il codice ha 8 o 13 cifre.'; return; } gestisciCodice(c, d, slot); };
}
async function gestisciCodice(codice, d, slot) {
  const mio = P.alimentoDaCodice(P.archivio(), codice);
  if (mio) { apriAggiungi(d, slot, { ...mio, mio: true }); return; }
  if (!navigator.onLine) { apriAlimento(null, { ean: codice, d, slot, nota: "Sei offline: scrivi i valori dall'etichetta. Il prodotto resta tra i tuoi." }); return; }
  toast('Cerco il prodotto su Open Food Facts…');
  try {
    const r = await fetch(OFF_API + encodeURIComponent(codice) + '?fields=product_name,product_name_it,brands,quantity,nutriments,categories_tags');
    if (!r.ok && r.status !== 404) throw Error('HTTP ' + r.status);
    const p = r.ok ? prodottoDaOFF(await r.json(), codice) : null;
    apriAlimento(null, p ? { ...p, d, slot, nota: 'Trovato su Open Food Facts: controlla i valori per 100 g con l’etichetta e salva.' } : { ean: codice, d, slot, nota: "Prodotto non trovato su Open Food Facts: scrivi i valori dall'etichetta." });
  } catch { apriAlimento(null, { ean: codice, d, slot, nota: "Open Food Facts non risponde: scrivi i valori dall'etichetta." }); }
}

// ------------------------------------------------------------ eventi
function esportaSettimana(a, d) {
  const righe = righeSettimana(a, d);
  scaricaCsv(`pasti-settimana-${righe[0].d}.csv`, [['Giorno', 'Turno', 'Kcal', 'Obiettivo kcal', 'Differenza', 'Proteine g', 'Carboidrati g', 'Grassi g', 'Olio g', 'Acqua ml', 'Passi', 'Allenamento'],
    ...righe.map(r => [r.d, r.turno ? etichettaTurno(r.turno) : '', numeroCsv(r.rg.righe.length ? r.rg.tot.k : ''), numeroCsv(r.ob), numeroCsv(r.diff), numeroCsv(r.rg.tot.p), numeroCsv(r.rg.tot.c), numeroCsv(r.rg.tot.g), numeroCsv(r.rg.olio), numeroCsv(r.rg.acqua), numeroCsv(r.rg.passi), r.allenato ? 'fatto' : r.previsto ? 'in programma' : ''])]);
}
globalThis.window?.addEventListener('cm:palestra-stato', () => {
  const s = document.getElementById('pal-salvataggio'); if (s) s.textContent = testoStato();
  const box = document.getElementById('pal-stato');
  if (box) { box.innerHTML = statoHtml(); legaStato(box); }
});
function legaStato(box) {
  box.querySelector('[data-pal-riprova]')?.addEventListener('click', () => P.salva().then(() => toast('Salvato')).catch(e => toast(e.message)));
  box.querySelector('[data-pal-scarta]')?.addEventListener('click', () => confirmDelete('Scartare le modifiche non salvate? Torni a quello che è salvato nel cloud.', async () => { P.scarta(); renderPagina(); }));
}

export function bindPalestra(render) {
  renderPagina = render;
  const pagina = document.querySelector('.palestra');
  if (!pagina) return;
  const d = dSel(), a = P.archivio(), su = (sel, fn) => pagina.querySelectorAll(sel).forEach(fn);
  if (!a) {
    const file = pagina.querySelector('#pal-backup-file'), errore = pagina.querySelector('#pal-vuoto-errore');
    pagina.querySelector('[data-pal-backup]')?.addEventListener('click', () => file.click());
    if (file) file.onchange = async () => { const f = file.files[0]; if (!f) return; try { await P.caricaBackup(await f.text()); toast('Backup caricato'); render(); } catch (e) { errore.textContent = e.message; } finally { file.value = ''; } };
    pagina.querySelector('[data-pal-zero]')?.addEventListener('click', async e => { e.target.disabled = true; try { await P.creaArchivio(); render(); } catch (err) { errore.textContent = err.message; e.target.disabled = false; } });
    return;
  }
  const box = pagina.querySelector('#pal-stato'); if (box) legaStato(box);
  su('[data-pal-giorno]', b => b.onclick = () => { giorno = shiftDate(d, Number(b.dataset.palGiorno)); render(); });
  su('[data-pal-oggi]', b => b.onclick = () => { giorno = null; render(); });
  su('[data-pal-vai]', b => { const vai = () => { giorno = b.dataset.palVai === oggi() ? null : b.dataset.palVai; render(); }; b.onclick = vai; b.onkeydown = e => { if (e.key === 'Enter') vai(); }; });
  su('[data-pal-sett]', b => b.onclick = () => { giorno = shiftDate(d, Number(b.dataset.palSett)); render(); });
  su('[data-pal-aggiungi]', b => b.onclick = () => apriAggiungi(d, b.dataset.palAggiungi || null));
  su('[data-pal-scan]', b => b.onclick = () => scansiona(d, d === oggi() ? slotOra() : 'pranzo'));
  su('[data-pal-slot]', b => b.onclick = () => apriPasto(d, b.dataset.palSlot));
  su('[data-pal-riga]', r => { r.onclick = () => apriRiga(r.dataset.palRiga); r.onkeydown = e => { if (e.key === 'Enter') apriRiga(r.dataset.palRiga); }; });
  su('[data-pal-dal-piano]', b => b.onclick = () => dalPiano(d, b.dataset.palDalPiano));
  su('[data-pal-piano]', b => b.onclick = () => {
    const fai = () => { const n = P.applicaPiano(P.archivio(), d); toast(`Giornata dal piano: ${n} alimenti`); render(); };
    const gia = riepilogoGiorno(a, d).righe.length;
    if (!gia) { try { fai(); } catch (e) { toast(e.message); } return; }
    openModal('Usa il piano della settimana', `<p>Il diario di ${esc(giornoBreve(d))} ha già ${gia} voci. Le sostituisco con la giornata del piano?</p><div class="form-actions"><button class="btn" data-close-piano>Annulla</button><button class="btn primary" data-ok-piano>Sostituisci</button></div>`);
    document.querySelector('[data-close-piano]').onclick = closeModal;
    document.querySelector('[data-ok-piano]').onclick = () => { try { fai(); closeModal(); } catch (e) { toast(e.message); } };
  });
  su('[data-pal-acqua]', b => b.onclick = () => { try { P.cambiaAcqua(d, Number(b.dataset.palAcqua)); render(); } catch (e) { toast(e.message); } });
  su('[data-pal-passi]', b => b.onclick = () => apriPassi(d));
  su('[data-pal-csv]', b => b.onclick = () => esportaSettimana(a, d));
  su('[data-stampa]', b => b.onclick = () => window.print());
  su('[data-pal-nuovo-alimento]', b => b.onclick = () => apriAlimento(null));
  su('[data-pal-alimento]', r => { const apri = () => apriAlimento(di(P.archivio(), 'a').find(x => x.id === r.dataset.palAlimento)); r.onclick = apri; r.onkeydown = e => { if (e.key === 'Enter') apri(); }; });
  const filtro = pagina.querySelector('#pal-filtro-alimenti');
  if (filtro) filtro.oninput = () => { const t = filtro.value.trim().toLowerCase(); pagina.querySelectorAll('[data-pal-alimento]').forEach(r => { r.hidden = !!t && !r.dataset.cerca.includes(t); }); };
  const obiettivi = pagina.querySelector('#pal-obiettivi');
  if (obiettivi) obiettivi.onsubmit = e => { e.preventDefault(); try { P.salvaObiettivi(Object.fromEntries(new FormData(obiettivi))); toast('Obiettivi salvati'); render(); } catch (err) { obiettivi.querySelector('.form-error').textContent = err.message; } };
  su('[data-pal-inizia]', b => b.onclick = () => { const [sid, ...gn] = b.dataset.palInizia.split('|'); try { inizia(d, sid, gn.join('|')); } catch (e) { toast(e.message); } });
  bindAllena(pagina, render, d);
  bindPiano(pagina, render, d, apriAggiungi);
  if (pagina.querySelector('#forma-editor')) {
    // Prima di aprire la Forma classica salvo le modifiche fatte qui, così la vede aggiornata.
    if (P.inAttesa()) P.salva().catch(() => {});
    bindFormaWorkspace(render);
  }
}
