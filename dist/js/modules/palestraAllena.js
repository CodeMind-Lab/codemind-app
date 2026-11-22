// Palestra, seconda tappa: Allenamenti, Schede e allenamento in corso (anteprime approvate
// il 20/11/2026: anteprime/08-allenamenti.html, 09-schede.html e la terza schermata di
// 07-palestra-iphone.html). Le sessioni sono le voci t:'w' dell'archivio di Forma, le
// schede t:'s', la settimana di allenamento t:'pa'.
import { state } from '../services/store.js?v=65';
import * as P from '../services/palestraService.js?v=83';
import { statSessione, sessioni, progressi, eserciziFatti, seriePerGruppo, nomiEsercizi, schedeDi, pianoAllenamento, pianoSettimana, nomeSettimana, dateSettimana, proponiSettimana, allenamentoDelGiorno, ultimaSessione, isCardio, nomeGruppo, gruppoDi, fmtRec, recSecondi, turnoDi, lunediDi, GIORNI_SETT, NOMI_GIORNI, di } from '../utils/palestra.js?v=75';
import { ID_ABC, PAGINA_ABC, estraiDati } from '../utils/schedaAbc.js?v=82';
import { shiftPresets } from '../utils/workShifts.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { scaricaCsv, numeroCsv } from '../utils/esporta.js?v=70';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, closeModal, toast, confirmDelete } from '../utils/dom.js?v=65';

let periodo = 'mese', filtroScheda = '', esercizioProg = '', schedaScelta = '', giornoScelto = 0, schedaSett = '', lunSett = '';
let recupero = null, orologio = null, blocco = null;
const aperti = new Set();
const tz = () => state.timezone;
const oggi = () => today(tz());
const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, useGrouping: 'always' });
const fmt = n => nf.format(Number(n) || 0);
const giornoBreve = d => new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const durata = m => m ? (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}′` : `${m}′`) : '—';
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); return (h ? h + ':' : '') + String(Math.floor(s / 60) % 60).padStart(h ? 2 : 1, '0') + ':' + String(s % 60).padStart(2, '0'); };
const barra = (v, t, c) => `<div class="barra"><i style="width:${t > 0 ? Math.min(100, Math.round(v / t * 100)) : 0}%;background:${c}"></i></div>`;
const PILL = { apertura: 'p-a', chiusura: 'p-c', notte: 'p-n', off: 'p-off', custom: 'p-x' };

function intervallo(d) {
  const m = d.slice(0, 7);
  if (periodo === '7') return [shiftDate(d, -6), d, 'negli ultimi 7 giorni'];
  if (periodo === 'mese') return [m + '-01', m + '-31', 'questo mese'];
  if (periodo === 'prima') { const p = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).toISOString().slice(0, 7); return [p + '-01', p + '-31', 'il mese scorso']; }
  return ['', '', 'in tutto'];
}
// Pulsante per iniziare (o riprendere, se c'è già una sessione aperta oggi) un giorno di scheda.
export function bottoneInizia(a, d, sid, gn, cls = 'btn') {
  const aperta = di(a, 'w').find(w => !w.fine && w.d === d && w.sid === sid && w.gn === gn);
  return aperta ? `<a class="${cls}" href="#/sport/sessione/${esc(aperta.id)}">Riprendi</a>` : `<button class="${cls}" data-pal-inizia="${esc(sid)}|${esc(gn)}">Inizia</button>`;
}
// La Scheda A·B·C si legge dalla sua pagina una volta sola per apertura dell'app
// (offline arriva dalla cache del service worker); poi si porta nell'archivio.
let datiAbc = null;
function caricaAbc() {
  datiAbc ||= fetch(PAGINA_ABC, { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('Pagina Scheda A·B·C non raggiungibile.'); return r.text(); }).then(estraiDati).catch(e => { datiAbc = null; throw e; });
  return datiAbc;
}
let sincronizzando = false;
function sincronizzaAbc(render) {
  if (sincronizzando) return;
  sincronizzando = true;
  caricaAbc().then(dati => { if (P.sincronizzaSchedaAbc(dati, oggi())) render(); }).catch(() => {}).finally(() => { sincronizzando = false; });
}
const primaAbc = l => [...l.filter(s => s.abc), ...l.filter(s => !s.abc)];
export function inizia(d, sid, gn) {
  const w = P.avviaAllenamento(d, sid, gn);
  location.hash = '#/sport/sessione/' + w.id;
}

// ------------------------------------------------------------ Allenamenti
export function vistaAllena(a, d) {
  const [da, al, quando] = intervallo(d), lista = sessioni(a, da, al, filtroScheda), stats = lista.map(w => ({ w, s: statSessione(w) }));
  const fatte = stats.filter(x => x.w.fine), tot = fatte.reduce((t, x) => ({ serie: t.serie + x.s.serie, vol: t.vol + x.s.volume, dur: t.dur + x.s.dur, max: Math.max(t.max, x.s.max) }), { serie: 0, vol: 0, dur: 0, max: 0 });
  const conDurata = fatte.filter(x => x.s.dur), media = conDurata.length ? Math.round(conDurata.reduce((t, x) => t + x.s.dur, 0) / conDurata.length) : 0;
  const lun = lunediDi(d), settimana = sessioni(a, lun, shiftDate(lun, 6)).filter(w => w.fine).length, previsti = pianoSettimana(a, lun).filter(p => p.sid).length;
  // record: il carico più alto di questo periodo, con l'esercizio
  let record = null;
  for (const { w } of fatte) for (const e of w.eser || []) for (const s of e.sets || []) if (s.ok && Number(s.w) > (record?.kg || 0)) record = { kg: Number(s.w), r: s.r, n: e.n };
  const nomi = eserciziFatti(a); if (!nomi.includes(esercizioProg)) esercizioProg = nomi[0] || '';
  const prog = progressi(a, esercizioProg), maxProg = Math.max(1, ...prog.map(p => p.kg));
  const gruppi = seriePerGruppo(a, lun, shiftDate(lun, 6)), maxG = Math.max(1, ...gruppi.map(g => g[1]));
  const oggiAll = allenamentoDelGiorno(a, d), ultima = oggiAll && ultimaSessione(a, oggiAll.scheda.id, oggiAll.giorno.n, d);
  const schede = schedeDi(a);
  const periodi = [['7', '7 giorni'], ['mese', 'Questo mese'], ['prima', 'Mese scorso'], ['tutto', 'Tutto']];
  return `<section class="kpi-lavoro">
    <div class="k t-corallo"><div class="etichetta">Sessioni ${esc(quando)}</div><div class="num">${fatte.length}${periodo === '7' && previsti ? ` <small>/ ${previsti} in programma</small>` : ''}</div>${periodo === '7' && previsti ? barra(fatte.length, previsti, '#fff') : ''}<div class="sotto">${settimana} questa settimana${fatte[0] ? ' · ultima ' + esc(giornoBreve(fatte[0].w.d)) : ''}</div></div>
    <div class="k t-azzurro"><div class="etichetta">Volume</div><div class="num">${fmt(Math.round(tot.vol))} <small>kg</small></div><div class="sotto">${tot.serie} serie fatte</div></div>
    <div class="k t-navy"><div class="etichetta">Durata media</div><div class="num">${media || '—'} <small>${media ? 'min' : ''}</small></div><div class="sotto">${durata(tot.dur)} in tutto</div></div>
    <div class="k t-lilla"><div class="etichetta">Carico più alto</div><div class="num">${record ? fmt(record.kg) + ' <small>kg</small>' : '—'}</div><div class="sotto">${record ? `${esc(record.n)}${record.r ? ' · ' + esc(record.r) + ' rip' : ''}` : 'nessuna serie con il peso'}</div></div>
  </section>
  <div class="griglia-lavoro"><div class="col"><section class="card"><div class="card-testa"><h2>Sessioni</h2><button class="link" data-pal-libero>+ Allenamento libero</button></div>
    <div class="barra-strumenti">${periodi.map(([k, n]) => `<button class="chip ${k === periodo ? 'on' : ''}" data-pal-periodo="${k}">${n}</button>`).join('')}
      <select class="pal-filtro-scheda" data-pal-filtro-scheda aria-label="Filtra per scheda"><option value="">Tutte le schede</option>${schede.map(s => `<option value="${esc(s.id)}" ${s.id === filtroScheda ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}<option value="libero" ${filtroScheda === 'libero' ? 'selected' : ''}>Allenamenti liberi</option></select>
      <span class="spazio"></span><button class="btn" data-pal-csv-allena>CSV</button><button class="btn" data-stampa>Stampa</button></div>
    <div class="table-wrap"><table class="dati"><thead><tr><th>Data</th><th>Allenamento</th><th class="n">Durata</th><th class="n">Serie</th><th class="n nasc">Volume</th><th>Stato</th></tr></thead><tbody>
    ${stats.length ? stats.map(({ w, s }) => { const cardio = !s.serie && (s.min || s.km); return `<tr data-pal-apri-sess="${esc(w.id)}" tabindex="0" title="Apri"><td>${esc(giornoBreve(w.d))}</td><td>${esc(w.gn || 'Allenamento')} <span class="gr">· ${esc(w.sn || 'libero')}</span></td><td class="n">${durata(s.dur)}</td><td class="n">${s.serie || '—'}</td><td class="n nasc">${cardio ? (s.km ? fmt(s.km) + ' km' : fmt(s.min) + ' min') : s.volume ? fmt(Math.round(s.volume)) + ' kg' : '—'}</td><td>${!w.fine ? '<span class="pill p-c">in corso</span>' : cardio ? '<span class="pill p-a">cardio</span>' : s.serie ? '<span class="pill p-off">fatto</span>' : '<span class="pill p-x">vuoto</span>'}</td></tr>`; }).join('') : '<tr><td colspan="6" class="vuoto-tabella">Nessun allenamento in questo periodo.</td></tr>'}
    </tbody>${stats.length ? `<tfoot><tr><td>Totale</td><td>${fatte.length} sessioni</td><td class="n">${durata(tot.dur)}</td><td class="n">${tot.serie}</td><td class="n nasc">${fmt(Math.round(tot.vol))} kg</td><td></td></tr></tfoot>` : ''}</table></div></section></div>
  <div class="col">
    <section class="card"><div class="card-testa"><h2>Allenamento ${d === oggi() ? 'di oggi' : 'del giorno'}</h2><a class="link" href="#/sport/schede">Schede →</a></div><div class="contenuto">
      ${oggiAll ? `<div class="all-t"><div><b>${esc(oggiAll.giorno.n)}</b><small>${(oggiAll.giorno.eser || []).length} esercizi · ${esc(oggiAll.scheda.n)}${ultima ? ` · ultima volta ${esc(giornoBreve(ultima.d))}${ultima.dur ? ', ' + ultima.dur + ' min' : ''}` : ''}</small></div>${bottoneInizia(a, d, oggiAll.scheda.id, oggiAll.giorno.n)}</div>` : '<p class="subtext">Riposo nel piano. Puoi sempre fare un allenamento libero o sceglierne uno dalle schede.</p>'}</div></section>
    <section class="card"><div class="card-testa"><h2>Progressi</h2>${nomi.length ? `<select class="pal-filtro-scheda" data-pal-prog aria-label="Esercizio">${nomi.map(n => `<option ${n === esercizioProg ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}</div><div class="contenuto">
      ${prog.length ? `<div class="grafico-sim">${prog.map(p => `<div><b>${fmt(p.kg)}</b><i style="height:${Math.max(6, Math.round(p.kg / maxProg * 90))}%"></i>${esc(p.d.slice(8) + '/' + Number(p.d.slice(5, 7)))}</div>`).join('')}</div><p class="nota">Carico massimo per sessione${prog.length ? ` · ultima ${fmt(prog[prog.length - 1].kg)} kg × ${esc(prog[prog.length - 1].rip)}` : ''}</p>` : '<p class="subtext">Qui compare il carico massimo di ogni sessione, quando segni serie con il peso.</p>'}</div></section>
    <section class="card"><div class="card-testa"><h2>Serie per gruppo</h2><span class="gr">questa settimana</span></div><div class="contenuto">
      ${gruppi.length ? gruppi.map(([g, n]) => `<div class="gruppo-r">${esc(g)}${barra(n, maxG, 'var(--corallo)')}<span>${n}</span></div>`).join('') : '<p class="subtext">Ancora nessuna serie questa settimana.</p>'}</div></section>
  </div></div>`;
}
function csvAllena(a, d) {
  const [da, al] = intervallo(d);
  scaricaCsv(`allenamenti-${da || 'tutti'}.csv`, [['Data', 'Allenamento', 'Scheda', 'Durata min', 'Serie', 'Ripetizioni', 'Volume kg', 'Cardio min', 'Km', 'Chiuso'],
    ...sessioni(a, da, al, filtroScheda).map(w => { const s = statSessione(w); return [w.d, w.gn || '', w.sn || '', numeroCsv(s.dur || ''), s.serie, s.ripetizioni, numeroCsv(s.volume), numeroCsv(s.min || ''), numeroCsv(s.km || ''), w.fine ? 'sì' : 'no']; })]);
}

// ------------------------------------------------------------ Schede
export function vistaSchede(a, d) {
  const schede = primaAbc(schedeDi(a)), piano = pianoAllenamento(a);
  if (!schede.some(s => s.id === schedaScelta)) { const inUso = piano.find(p => p.sid); schedaScelta = inUso?.sid || schede[0]?.id || ''; giornoScelto = 0; }
  const s = schede.find(x => x.id === schedaScelta), usate = new Set([...piano, ...pianoSettimana(a, lunediDi(d))].map(p => p.sid).filter(Boolean));
  const elenco = `<div class="sch-elenco">${schede.map(x => `<button class="sch ${x.id === schedaScelta ? 'on' : ''}" data-pal-scheda="${esc(x.id)}"><b>${esc(x.n)}</b><small>${x.abc ? `${esc(x.abc.nome)} · ${esc(x.abc.settimane)} · ` : ''}${(x.giorni || []).length} giorni · ${(x.giorni || []).reduce((t, g) => t + (g.eser || []).length, 0)} esercizi</small>${usate.has(x.id) ? '<span class="pill p-c">in uso</span>' : ''}</button>`).join('')}<button class="nuova" data-pal-nuova-scheda>+ Nuova scheda</button></div>`;
  let editor = '<section class="card"><p class="vuoto-giornata">Crea la tua prima scheda: poi aggiungi i giorni e gli esercizi.</p></section>';
  if (s) {
    const giorni = s.giorni || []; if (giornoScelto >= giorni.length) giornoScelto = Math.max(0, giorni.length - 1);
    const g = giorni[giornoScelto], eser = g?.eser || [], recDef = Number(a.settings?.recDefault) || 90;
    const abc = !!s.abc, fissa = v => `<span class="cella-fissa">${esc(v ?? '') || '—'}</span>`;
    const cella = (ei, campo, v, tipo = 'text', extra = '') => abc && campo !== 'peso' ? fissa(campo === 'rec' && v ? fmtRec(v) : v) : `<input class="cella" data-pal-es="${ei}" data-campo="${campo}" type="${tipo}" ${tipo === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v ?? '')}" ${extra}>`;
    const ordine = ei => abc ? '<td></td>' : `<td class="ordine"><button data-pal-su="${ei}" aria-label="Sposta su">↑</button><button data-pal-giu="${ei}" aria-label="Sposta giù">↓</button></td>`;
    const togli = ei => abc ? '<td></td>' : `<td class="n"><button class="x" data-pal-togli-es="${ei}" aria-label="Togli">✕</button></td>`;
    const righe = eser.map((e, ei) => isCardio(e)
      ? `<tr>${ordine(ei)}<td>${cella(ei, 'n', e.n, 'text', 'list="pal-nomi-es"')}<span class="gr">Cardio</span></td><td class="n">—</td><td class="n">${cella(ei, 'min', e.min, 'number', 'placeholder="min"')}</td><td class="n">—</td><td class="n">—</td><td>${cella(ei, 'note', e.note)}</td>${togli(ei)}</tr>`
      : `<tr>${ordine(ei)}<td>${cella(ei, 'n', e.n, 'text', 'list="pal-nomi-es"')}<span class="gr">${esc(nomeGruppo(e.gruppo || gruppoDi(e.n)))}</span></td><td class="n">${cella(ei, 'serie', e.serie ?? 3, 'number')}</td><td class="n">${cella(ei, 'rip', e.rip ?? '')}</td><td class="n">${cella(ei, 'peso', e.peso ?? '', 'number')}</td><td class="n">${cella(ei, 'rec', e.rec ?? '', 'number', `placeholder="${recDef}"`)}</td><td>${cella(ei, 'note', e.note)}</td>${togli(ei)}</tr>`).join('');
    const serie = eser.reduce((t, e) => t + (isCardio(e) ? 0 : Number(e.serie) || 0), 0);
    const minuti = eser.reduce((t, e) => t + (isCardio(e) ? Number(e.min) || 0 : (Number(e.serie) || 3) * (recSecondi(e.rec, recDef) + 45) / 60), 0);
    editor = `<section class="card"><div class="card-testa"><h2>${esc(s.n)}</h2>${abc ? `<span class="link-gruppo"><a class="link" href="${PAGINA_ABC}">Apri la pagina</a> · <button class="link" data-pal-duplica-scheda>Duplica</button></span></div>
      <p class="subtext abc-nota">Sincronizzata con la Scheda A·B·C: ora è <b>${esc(s.abc.nome)}</b> (${esc(s.abc.settimane)}) e cambia da sola quando cambia la fase. Qui scrivi solo i kg; per modificarla liberamente, duplicala.</p>` : `<span class="link-gruppo"><button class="link" data-pal-rinomina-scheda>Rinomina</button> · <button class="link" data-pal-duplica-scheda>Duplica</button> · <button class="link" data-pal-elimina-scheda>Elimina</button></span></div>`}
      <div class="giorni-sch">${giorni.map((x, i) => `<button class="chip ${i === giornoScelto ? 'on' : ''}" data-pal-giorno-sch="${i}">${esc(x.n)}</button>`).join('')}${abc ? '' : '<button class="chip add" data-pal-nuovo-giorno>+ Giorno</button>'}</div>
      ${g ? `<div class="barra-strumenti">${abc ? '' : '<button class="link" data-pal-rinomina-giorno>Rinomina giorno</button><button class="link" data-pal-elimina-giorno>Elimina giorno</button>'}<span class="spazio"></span><span class="subtext piccolo">${abc ? 'Kg: si salvano da soli e restano al cambio di fase' : 'Recupero in secondi · le modifiche si salvano da sole'}</span></div>
      <div class="table-wrap"><table class="dati pal-editor"><thead><tr><th></th><th>Esercizio</th><th class="n">Serie</th><th class="n">Rip</th><th class="n">Kg</th><th class="n">Rec.</th><th>Note</th><th></th></tr></thead><tbody>${righe || '<tr><td colspan="8" class="vuoto-tabella">Nessun esercizio: aggiungilo qui sotto.</td></tr>'}</tbody>
      ${eser.length ? `<tfoot><tr><td></td><td>${eser.length} esercizi</td><td class="n">${serie}</td><td colspan="4" class="gr">circa ${abc && Number(s.abc.durate?.[g.n[0]]) ? Number(s.abc.durate[g.n[0]]) : Math.round(minuti / 5) * 5} min${abc ? ' nel piano' : ''}</td><td></td></tr></tfoot>` : ''}</table></div>
      <form class="agg-es" id="pal-agg-es">${abc ? '<span class="spazio"></span>' : '<input name="nome" list="pal-nomi-es" placeholder="Aggiungi esercizio (es. rematore, squat)…" autocomplete="off"><button class="btn" type="submit">Aggiungi</button>'}${eser.length ? bottoneInizia(a, oggi(), s.id, g.n, 'btn pal-inizia-btn').replace('>Inizia<', `>Inizia ${esc(g.n)}<`) : ''}</form>` : ''}
      <datalist id="pal-nomi-es">${nomiEsercizi(a).map(n => `<option value="${esc(n)}">`).join('')}</datalist></section>`;
  }
  return `<div class="pal-impila">${vistaSettimana(a, d, schede)}<div class="layout-schede">${elenco}<div class="pal-impila">${editor}</div></div></div>`;
}

// Settimana di allenamento. Con le frecce scegli la settimana: se non l'hai organizzata a
// parte vale la settimana tipo (quella che si ripete); il primo tocco la organizza solo per
// quella settimana. "Usa come settimana tipo" la fa valere per tutte le altre.
const corto = n => String(n).split('·')[0].trim() || String(n);
const settimanaMostrata = d => lunSett || lunediDi(d);
function vistaSettimana(a, d, schede) {
  const lun = settimanaMostrata(d), lunOggi = lunediDi(oggi()), conGiorni = schede.filter(x => (x.giorni || []).length);
  const nav = `<div class="sa-nav"><button class="sa-freccia" data-pal-sett-vai="-1" aria-label="Settimana precedente">‹</button><div class="sa-nav-t"><b>${esc(nomeSettimana(lun, lunOggi))}</b><small>${esc(dateSettimana(lun))}</small></div><button class="sa-freccia" data-pal-sett-vai="1" aria-label="Settimana successiva">›</button>${lun !== lunOggi ? '<button class="link" data-pal-sett-vai="0">Torna a questa settimana</button>' : ''}</div>`;
  const testa = `<div class="card-testa"><h2>Settimana di allenamento</h2>${nav}</div>`;
  if (!conGiorni.length) return `<section class="card sett-all">${testa}<p class="vuoto-giornata">Crea prima una scheda con almeno un giorno: poi qui scegli in quali giorni allenarti.</p></section>`;
  const piano = pianoSettimana(a, lun), propria = piano.some(p => p.proprio);
  if (!conGiorni.some(x => x.id === schedaSett)) { const inUso = piano.find(p => p.sid && conGiorni.some(x => x.id === p.sid))?.sid; schedaSett = inUso || conGiorni[0].id; }
  const sS = conGiorni.find(x => x.id === schedaSett), fatti = piano.filter(p => p.sid);
  const riepilogo = fatti.length ? `<b>${fatti.length} allenament${fatti.length === 1 ? 'o' : 'i'}</b> · ${piano.map((p, i) => p.sid ? `${NOMI_GIORNI[i]} ${esc(corto(p.gn))}` : '').filter(Boolean).join(' · ')}` : 'Nessun allenamento: tutta la settimana è a riposo.';
  const stato = propria
    ? `<div class="sa-stato propria"><span class="pill p-c">Organizzata a parte</span><span>vale solo per questa settimana</span><span class="spazio"></span><button class="link" data-pal-sett-tipo>Usa come settimana tipo</button><button class="link" data-pal-sett-ripristina>Torna alla settimana tipo</button></div>`
    : `<div class="sa-stato"><span class="pill p-x">Settimana tipo</span><span>si ripete ogni settimana · tocca un giorno per organizzare solo questa</span></div>`;
  const scelta = conGiorni.length > 1 ? `<label class="sa-scheda">Scheda <select class="pal-filtro-scheda" data-pal-sett-scheda aria-label="Scheda da usare">${conGiorni.map(x => `<option value="${esc(x.id)}" ${x.id === sS.id ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select></label>` : `<span class="sa-scheda">Scheda <b>${esc(sS.n)}</b></span>`;
  const giorni = piano.map((p, i) => {
    const tn = turnoDi(a, p.d, state.scheduleEntries, tz()), altra = p.sid && p.sid !== sS.id;
    const pill = tn ? `<span class="pill ${PILL[tn] || 'p-x'}">${esc(tn === 'off' ? 'OFF' : shiftPresets[tn]?.label || 'Turno')}</span>` : '';
    const bottoni = [`<button class="riposo ${!p.sid ? 'on' : ''}" data-pal-sett="${p.d}" aria-pressed="${!p.sid}">Riposo</button>`,
      ...sS.giorni.map(g => { const on = p.sid === sS.id && p.gn === g.n; return `<button class="${on ? 'on' : ''}" data-pal-sett="${p.d}" data-sid="${esc(sS.id)}" data-gn="${esc(g.n)}" title="${esc(g.n)}" aria-pressed="${on}">${esc(corto(g.n))}</button>`; })].join('');
    const nome = p.sid ? (altra ? `${esc(schede.find(x => x.id === p.sid)?.n || '')} · ${esc(p.gn)}` : esc(p.gn)) : '';
    return `<div class="sa-g ${p.sid ? 'a' : ''} ${p.d === oggi() ? 'oggi' : ''}"><div class="sa-t"><b>${NOMI_GIORNI[i]}</b><small>${Number(p.d.slice(8))}/${Number(p.d.slice(5, 7))}</small>${pill}</div><div class="sa-scelte">${bottoni}</div>${nome ? `<small class="sa-nome" title="${nome}">${nome}</small>` : ''}</div>`;
  }).join('');
  return `<section class="card sett-all">${testa}${stato}
    <div class="sa-barra">${scelta}<span class="spazio"></span><button class="btn" data-pal-sett-proponi title="Usa i turni di questa settimana: OFF prima, mai il giorno di notte, niente giorni di fila se si può">Proponi dai turni</button><button class="btn" data-pal-sett-azzera>Tutto riposo</button></div>
    <p class="sa-riepilogo">${riepilogo}</p><div class="sa-griglia">${giorni}</div></section>`;
}

// ------------------------------------------------------------ allenamento in corso
export function vistaSessione(a, wid) {
  const w = di(a, 'w').find(x => x.id === wid);
  if (!w) return '<section class="card"><p class="vuoto-giornata">Allenamento non trovato. <a class="link" href="#/sport/allena">Torna agli allenamenti</a></p></section>';
  const st = statSessione(w), eser = w.eser || [], prec = w.sid ? ultimaSessione(a, w.sid, w.gn, w.d + (w.fine ? '' : '~')) : null;
  const precDi = n => (prec?.eser || []).find(e => String(e.n).toLowerCase() === String(n).toLowerCase());
  const completo = e => isCardio(e) ? !!(Number(e.min) || Number(e.km)) : (e.sets || []).length > 0 && e.sets.every(s => s.ok);
  const corrente = eser.findIndex(e => !completo(e));
  const blocchi = eser.map((e, ei) => {
    const p = precDi(e.n), fatto = completo(e), aperto = !fatto || aperti.has(ei) || w.fine;
    if (!aperto) { const s = statSessione({ eser: [e] }); return `<button class="eser fatto" data-pal-espandi="${ei}"><span><b>${esc(e.n)}</b>${isCardio(e) ? `${fmt(e.min)} min${e.km ? ' · ' + fmt(e.km) + ' km' : ''}` : `${s.serie} serie · volume ${fmt(Math.round(s.volume))} kg`}</span><span>✓ fatto</span></button>`; }
    const testa = `<div class="eser-t"><b>${esc(e.n)}</b><small>${isCardio(e) ? 'cardio' : 'rec ' + fmtRec(recSecondi(e.rec, Number(a.settings?.recDefault) || 90))}</small></div>
      <p>${isCardio(e) ? (p ? `l'ultima volta ${fmt(p.min)} min${p.km ? ' · ' + fmt(p.km) + ' km' : ''}` : '') : `${(e.sets || []).length} × ${esc(e.rip || '')}${p ? ` · l'ultima volta ${(p.sets || []).filter(s => s.ok).map(s => `${fmt(s.w)} kg × ${fmt(s.r)}`).slice(0, 3).join(', ')}` : ''}`}${e.note ? ' · ' + esc(e.note) : ''}</p>`;
    if (isCardio(e)) return `<div class="eser ${ei === corrente ? 'corrente' : ''}">${testa}<div class="cardio-campi"><label>Minuti<input class="in" data-pal-cardio="${ei}" data-campo="min" type="number" inputmode="decimal" value="${esc(e.min ?? '')}"></label><label>Km<input class="in" data-pal-cardio="${ei}" data-campo="km" type="number" inputmode="decimal" step="any" value="${esc(e.km ?? '')}"></label></div><button class="link" data-pal-togli-es-sess="${ei}">Togli esercizio</button></div>`;
    const prossima = (e.sets || []).findIndex(s => !s.ok);
    const serie = (e.sets || []).map((s, si) => { const ps = p?.sets?.[si]; return `<div class="serie ${s.ok ? 'fatta' : si === prossima && ei === corrente ? 'ora' : ''}" data-pal-serie="${ei}.${si}"><span class="n">${si + 1}</span><span class="prev">${ps?.ok ? `${fmt(ps.w)} × ${fmt(ps.r)}` : '—'}</span><input class="in" data-campo="w" type="number" inputmode="decimal" step="any" value="${esc(s.w ?? '')}" aria-label="Kg serie ${si + 1}"><input class="in" data-campo="r" type="number" inputmode="numeric" value="${esc(s.r ?? '')}" aria-label="Ripetizioni serie ${si + 1}"><button class="ok" data-pal-ok="${ei}.${si}" aria-pressed="${!!s.ok}" aria-label="${s.ok ? 'Serie fatta, tocca per togliere' : 'Segna la serie come fatta'}">✓</button></div>`; }).join('');
    return `<div class="eser ${ei === corrente ? 'corrente' : ''}">${testa}<div class="serie h"><span>#</span><span>Ultima volta</span><span>kg</span><span>Rip</span><span></span></div>${serie}
      <div class="eser-azioni"><button class="link" data-pal-agg-serie="${ei}">+ Aggiungi serie</button>${(e.sets || []).length > 1 ? `<button class="link" data-pal-togli-serie="${ei}">− Togli l'ultima</button>` : ''}<button class="link spazio" data-pal-togli-es-sess="${ei}">Togli esercizio</button></div></div>`;
  }).join('');
  const fatti = eser.filter(completo).length;
  return `<div class="sessione">
    <div class="sess-t"><a class="icona-tonda" href="#/sport/allena" aria-label="Torna agli allenamenti">‹</a><div><h1>${esc(w.gn || 'Allenamento')}</h1><p class="subtext">${esc(giornoBreve(w.d))}${w.sn ? ' · ' + esc(w.sn) : ''} · ${w.fine ? 'chiuso' : `esercizio ${Math.min(eser.length, fatti + 1)} di ${eser.length}`} · ${st.serie} serie fatte</p></div>
      <span class="crono" id="pal-crono" data-inizio="${Number(w.inizio) || ''}" data-fine="${w.fine ? 1 : ''}">${w.fine ? durata(st.dur) : mmss(Date.now() - Number(w.inizio || Date.now()))}</span></div>
    <div class="avanz">${eser.map(e => `<i class="${completo(e) ? 'f' : ''}"></i>`).join('')}</div>
    ${blocchi || '<p class="subtext">Nessun esercizio: aggiungine uno qui sotto.</p>'}
    <form class="agg-es" id="pal-agg-es-sess"><input name="nome" list="pal-nomi-es" placeholder="Aggiungi un esercizio…" autocomplete="off"><button class="btn" type="submit">Aggiungi</button></form>
    <datalist id="pal-nomi-es">${nomiEsercizi(a).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    ${w.fine ? `<div class="sess-fine"><label class="field">Durata (minuti)<input id="pal-durata" type="number" inputmode="numeric" min="0" max="300" value="${esc(w.dur ?? '')}"></label><button class="btn" data-pal-riapri>Riapri</button><button class="btn danger" data-pal-elimina-sess>Elimina</button></div>`
      : `<button class="fine-btn" data-pal-termina>Termina allenamento</button>`}
    <div class="recupero" id="pal-recupero" hidden><div><small>Recupero</small><span class="tempo2" id="pal-rec-tempo">0:00</span></div><div class="b"><button data-pal-rec="-15">−15</button><button data-pal-rec="15">+15</button><button class="s" data-pal-rec="0">Salta</button></div><div class="fila"><i id="pal-rec-fila"></i></div></div>
  </div>`;
}

// Orologio della sessione e del recupero: un solo timer, che si ferma da solo quando la
// schermata non c'è più. Lo schermo resta acceso finché l'allenamento è aperto.
function avviaOrologio() {
  if (orologio) return;
  orologio = setInterval(() => {
    const crono = document.getElementById('pal-crono');
    if (!crono) { clearInterval(orologio); orologio = null; recupero = null; blocco?.release?.().catch?.(() => {}); blocco = null; return; }
    if (!crono.dataset.fine && crono.dataset.inizio) crono.textContent = mmss(Date.now() - Number(crono.dataset.inizio));
    mostraRecupero();
  }, 250);
}
function mostraRecupero() {
  const box = document.getElementById('pal-recupero');
  if (!box) return;
  if (!recupero) { box.hidden = true; return; }
  const resto = recupero.fine - Date.now();
  if (resto <= -2500) { recupero = null; box.hidden = true; return; }
  if (resto <= 0 && !recupero.suonato) { recupero.suonato = true; navigator.vibrate?.([200, 100, 200]); box.classList.add('finito'); }
  box.hidden = false;
  document.getElementById('pal-rec-tempo').textContent = resto > 0 ? mmss(resto + 999) : 'Via!';
  document.getElementById('pal-rec-fila').style.width = Math.max(0, Math.min(100, resto / (recupero.tot * 1000) * 100)) + '%';
}
function partiRecupero(sec) { recupero = { fine: Date.now() + sec * 1000, tot: sec, suonato: false }; document.getElementById('pal-recupero')?.classList.remove('finito'); mostraRecupero(); }

// ------------------------------------------------------------ eventi
const prova = (fn, render, messaggio) => { try { const r = fn(); if (messaggio) toast(messaggio); render?.(); return r; } catch (e) { toast(e.message); } };
function chiediNome(titolo, etichetta, valore, salva) {
  openModal(titolo, `<form id="pal-nome-form"><label class="field">${esc(etichetta)}<input name="n" value="${esc(valore || '')}" maxlength="80" required autofocus></label><div class="form-actions"><button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-nome-form');
  f.onsubmit = e => { e.preventDefault(); try { salva(f.elements.n.value); closeModal(); } catch (err) { f.querySelector('.form-error').textContent = err.message; } };
}

export function bindAllena(pagina, render, d) {
  const a = P.archivio(), su = (sel, fn) => pagina.querySelectorAll(sel).forEach(fn);
  if (a) sincronizzaAbc(render);
  // Allenamenti
  su('[data-pal-periodo]', b => b.onclick = () => { periodo = b.dataset.palPeriodo; render(); });
  su('[data-pal-filtro-scheda]', s => s.onchange = () => { filtroScheda = s.value; render(); });
  su('[data-pal-prog]', s => s.onchange = () => { esercizioProg = s.value; render(); });
  su('[data-pal-csv-allena]', b => b.onclick = () => csvAllena(a, d));
  su('[data-pal-libero]', b => b.onclick = () => prova(() => inizia(d, '', '')));
  su('[data-pal-apri-sess]', r => { const vai = () => { location.hash = '#/sport/sessione/' + r.dataset.palApriSess; }; r.onclick = vai; r.onkeydown = e => { if (e.key === 'Enter') vai(); }; });
  // Schede
  const s = schedaScelta;
  su('[data-pal-scheda]', b => b.onclick = () => { schedaScelta = b.dataset.palScheda; giornoScelto = 0; render(); });
  su('[data-pal-nuova-scheda]', b => b.onclick = () => chiediNome('Nuova scheda', 'Nome della scheda', '', n => { const x = P.creaScheda(n); schedaScelta = x.id; giornoScelto = 0; render(); }));
  su('[data-pal-rinomina-scheda]', b => b.onclick = () => chiediNome('Rinomina scheda', 'Nome della scheda', di(a, 's').find(x => x.id === s)?.n, n => { P.rinominaScheda(s, n); render(); }));
  su('[data-pal-duplica-scheda]', b => b.onclick = () => prova(() => { const x = P.duplicaScheda(s); schedaScelta = x.id; }, render, 'Scheda duplicata'));
  su('[data-pal-elimina-scheda]', b => b.onclick = () => confirmDelete(`Eliminare la scheda "${di(a, 's').find(x => x.id === s)?.n}"? Gli allenamenti già fatti restano; i giorni della settimana che la usavano tornano a riposo.`, async () => { P.eliminaScheda(s); schedaScelta = ''; render(); }));
  su('[data-pal-giorno-sch]', b => b.onclick = () => { giornoScelto = Number(b.dataset.palGiornoSch); render(); });
  su('[data-pal-nuovo-giorno]', b => b.onclick = () => chiediNome('Nuovo giorno', 'Nome del giorno (es. Push A)', '', n => { giornoScelto = P.aggiungiGiorno(s, n); render(); }));
  su('[data-pal-rinomina-giorno]', b => b.onclick = () => chiediNome('Rinomina giorno', 'Nome del giorno', di(a, 's').find(x => x.id === s)?.giorni?.[giornoScelto]?.n, n => { P.rinominaGiorno(s, giornoScelto, n); render(); }));
  su('[data-pal-elimina-giorno]', b => b.onclick = () => confirmDelete('Eliminare questo giorno e i suoi esercizi dalla scheda? Gli allenamenti già fatti restano.', async () => { P.eliminaGiorno(s, giornoScelto); giornoScelto = 0; render(); }));
  // Le celle salvano quando lasci il campo, senza ridisegnare: così passi al campo dopo.
  su('[data-pal-es]', i => i.onchange = () => { try { P.aggiornaEsercizio(s, giornoScelto, Number(i.dataset.palEs), { [i.dataset.campo]: i.value }); if (i.dataset.campo === 'n') render(); } catch (e) { toast(e.message); i.focus(); } });
  su('[data-pal-su]', b => b.onclick = () => prova(() => P.spostaEsercizio(s, giornoScelto, Number(b.dataset.palSu), -1), render));
  su('[data-pal-giu]', b => b.onclick = () => prova(() => P.spostaEsercizio(s, giornoScelto, Number(b.dataset.palGiu), 1), render));
  su('[data-pal-togli-es]', b => b.onclick = () => prova(() => P.togliEsercizio(s, giornoScelto, Number(b.dataset.palTogliEs)), render));
  const agg = pagina.querySelector('#pal-agg-es');
  if (agg) agg.onsubmit = e => { e.preventDefault(); prova(() => P.aggiungiEsercizio(s, giornoScelto, agg.elements.nome.value), () => { render(); document.querySelector('#pal-agg-es input')?.focus(); }); };
  // Settimana di allenamento: ogni modifica vale solo per la settimana mostrata.
  const lunS = settimanaMostrata(d);
  su('[data-pal-sett-vai]', b => b.onclick = () => { const v = Number(b.dataset.palSettVai); lunSett = v ? shiftDate(lunS, 7 * v) : lunediDi(oggi()); render(); });
  su('[data-pal-sett]', b => b.onclick = () => prova(() => P.impostaGiornoData(b.dataset.palSett, b.dataset.sid || '', b.dataset.gn || ''), render));
  su('[data-pal-sett-scheda]', sel => sel.onchange = () => { schedaSett = sel.value; render(); });
  su('[data-pal-sett-proponi]', b => b.onclick = () => {
    const sS = di(a, 's').find(x => x.id === schedaSett);
    if (!sS?.giorni?.length) return;
    const turni = GIORNI_SETT.map((_, i) => turnoDi(a, shiftDate(lunS, i), state.scheduleEntries, tz()));
    const idx = proponiSettimana(turni, sS.giorni.length);
    if (idx.every(k => k < 0)) return toast('Nessun giorno libero dai turni di questa settimana.');
    prova(() => P.impostaSettimana(lunS, idx.map(k => k < 0 ? {} : { sid: sS.id, gn: sS.giorni[k].n })), render, turni.every(x => !x) ? 'Nessun turno inserito per questa settimana: ho messo giorni alterni' : 'Settimana proposta dai turni: cambia pure i giorni con un tocco');
  });
  su('[data-pal-sett-azzera]', b => b.onclick = () => prova(() => P.impostaSettimana(lunS, Array.from({ length: 7 }, () => ({}))), render, 'Settimana tutta a riposo'));
  su('[data-pal-sett-tipo]', b => b.onclick = () => prova(() => P.usaComeTipo(lunS), render, 'Ora è la settimana tipo: vale per tutte le settimane non organizzate a parte'));
  su('[data-pal-sett-ripristina]', b => b.onclick = () => prova(() => P.tornaSettimanaTipo(lunS), render, 'Questa settimana torna come la settimana tipo'));
  // Allenamento in corso
  const sess = pagina.querySelector('.sessione');
  if (!sess) return;
  const wid = location.hash.split('/')[3];
  avviaOrologio();
  if (!pagina.querySelector('#pal-crono')?.dataset.fine && 'wakeLock' in navigator && !blocco) navigator.wakeLock.request('screen').then(l => { blocco = l; }).catch(() => {});
  su('[data-pal-serie] .in', i => i.onchange = () => { const [ei, si] = i.closest('[data-pal-serie]').dataset.palSerie.split('.').map(Number); try { P.aggiornaSerie(wid, ei, si, { [i.dataset.campo]: i.value }); } catch (e) { toast(e.message); } });
  su('[data-pal-ok]', b => b.onclick = () => {
    const riga = b.closest('[data-pal-serie]'), [ei, si] = b.dataset.palOk.split('.').map(Number), ok = b.getAttribute('aria-pressed') !== 'true';
    try {
      P.aggiornaSerie(wid, ei, si, { w: riga.querySelector('[data-campo="w"]').value, r: riga.querySelector('[data-campo="r"]').value, ok });
      const e = di(P.archivio(), 'w').find(x => x.id === wid)?.eser?.[ei];
      if (ok) partiRecupero(recSecondi(e?.rec, Number(P.archivio().settings?.recDefault) || 90)); else recupero = null;
      render();
    } catch (err) { toast(err.message); }
  });
  su('[data-pal-cardio]', i => i.onchange = () => prova(() => P.aggiornaCardio(wid, Number(i.dataset.palCardio), { [i.dataset.campo]: i.value })));
  su('[data-pal-agg-serie]', b => b.onclick = () => prova(() => P.aggiungiSerie(wid, Number(b.dataset.palAggSerie)), render));
  su('[data-pal-togli-serie]', b => b.onclick = () => { const ei = Number(b.dataset.palTogliSerie), e = di(a, 'w').find(x => x.id === wid)?.eser?.[ei]; prova(() => P.togliSerie(wid, ei, e.sets.length - 1), render); });
  su('[data-pal-togli-es-sess]', b => b.onclick = () => prova(() => P.togliEsercizioSessione(wid, Number(b.dataset.palTogliEsSess)), render));
  su('[data-pal-espandi]', b => b.onclick = () => { aperti.add(Number(b.dataset.palEspandi)); render(); });
  su('[data-pal-rec]', b => b.onclick = () => { if (!recupero) return; const v = Number(b.dataset.palRec); if (!v) recupero = null; else recupero.fine = Math.max(Date.now(), recupero.fine + v * 1000), recupero.tot = Math.max(recupero.tot, (recupero.fine - Date.now()) / 1000); mostraRecupero(); });
  const aggS = sess.querySelector('#pal-agg-es-sess');
  if (aggS) aggS.onsubmit = e => { e.preventDefault(); prova(() => P.aggiungiEsercizioSessione(wid, aggS.elements.nome.value), render); };
  su('[data-pal-termina]', b => b.onclick = () => {
    const w = di(P.archivio(), 'w').find(x => x.id === wid), st = statSessione(w);
    openModal('Termina allenamento', `<p>${st.serie} serie fatte${st.volume ? `, volume ${fmt(Math.round(st.volume))} kg` : ''}. Chiudo l'allenamento?</p><div class="form-actions"><button class="btn" data-no>Continua</button><button class="btn primary" data-si>Termina</button></div>`);
    document.querySelector('#modal [data-no]').onclick = closeModal;
    document.querySelector('#modal [data-si]').onclick = () => { prova(() => { const x = P.terminaSessione(wid); recupero = null; aperti.clear(); closeModal(); toast(`Allenamento chiuso${x.dur ? ' · ' + x.dur + ' min' : ''}`); P.salva().catch(() => {}); }, render); };
  });
  su('[data-pal-riapri]', b => b.onclick = () => prova(() => P.riapriSessione(wid), render));
  const dur = sess.querySelector('#pal-durata');
  if (dur) dur.onchange = () => prova(() => P.impostaDurata(wid, dur.value), null, 'Durata salvata');
  su('[data-pal-elimina-sess]', b => b.onclick = () => confirmDelete('Eliminare questo allenamento?', async () => { P.eliminaSessione(wid); location.hash = '#/sport/allena'; }));
}
