// Pagina "Oggi": la prima cosa che si vede aprendo l'app. Rivista il 20/11/2026: tre
// riquadri (turno e prossimo impegno, calorie e acqua, allenamento), settimana a fasce,
// scheda Sviluppo con ore della settimana e prossima scadenza.
// Mostra solo quello che è stato scelto il 19/11/2026: turno e agenda del giorno,
// obiettivi della settimana, pasti e allenamento. Le scadenze stanno nelle sezioni.
import { state } from '../services/store.js?v=65';
import { saveEntry, entryPayload } from '../services/agendaService.js?v=65';
import { archivio } from '../services/palestraService.js?v=85';
import { riepilogoGiorno, allenamentoDelGiorno, obiettiviGiorno } from '../utils/palestra.js?v=77';
import { entryForm, weekCompatta } from './agenda.js?v=69';
import { bindAllenamentiAgenda } from './agendaAllenamento.js?v=3';
import { cambiaAcqua } from '../services/palestraService.js?v=85';
import { bottoneInizia, inizia } from './palestraAllena.js?v=86';
import { universityData } from '../utils/university.js?v=65';
import { today, shiftDate, longDate } from '../utils/dates.js?v=65';
import { wallTime, weekStart, summary, goalProgress } from '../utils/agenda.js?v=65';
import { shiftPresets, shiftPreset } from '../utils/workShifts.js?v=65';
import { esc, icon } from '../utils/helpers.js?v=65';
import { toast } from '../utils/dom.js?v=65';

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
// Colore di ogni blocco, per categoria dell'agenda.
const CLASSE = { work: 'lavoro', study: 'studio', dev: 'sviluppo', gym: 'palestra', sleep: 'sonno', relax: 'relax', personal: 'personale' };
const ETICHETTA = { work: 'Lavoro Hotel', study: 'Studio', dev: 'Sviluppo', gym: 'Palestra', sleep: 'Sonno', relax: 'Relax', personal: 'Personale' };

const ora = (iso, tz) => wallTime(iso, tz).slice(11);
const durata = minuti => {
  const h = Math.floor(minuti / 60), m = Math.round(minuti % 60);
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`;
};
const numero = n => Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' });
const barra = (fatto, totale, colore) => `<div class="barra"><i style="width:${totale ? Math.min(100, Math.round(fatto / totale * 100)) : 0}%;background:${colore}"></i></div>`;

// Turno o OFF scritto per un giorno: è la voce dell'agenda di tipo shift/off con quella data.
function turnoDel(data) {
  return state.scheduleEntries.find(e => e.entry_date === data && (e.kind === 'shift' || e.kind === 'off')) || null;
}
function nomeTurno(voce, tz) {
  if (!voce) return null;
  const chiave = shiftPreset(voce, tz);
  return shiftPresets[chiave]?.label || 'Turno';
}

// Voci con orario che toccano la giornata, tagliate a mezzanotte (la Notte comincia
// il giorno prima e finisce stamattina: va mostrata).
function vociDelGiorno(data, tz) {
  const inizio = `${data}T00:00`, fine = `${shiftDate(data, 1)}T00:00`;
  return state.scheduleEntries
    .filter(e => e.kind !== 'off' && e.starts_at && e.ends_at)
    .map(e => ({ e, da: wallTime(e.starts_at, tz), a: wallTime(e.ends_at, tz) }))
    .filter(x => x.da < fine && x.a > inizio)
    .sort((x, y) => x.da.localeCompare(y.da));
}

function prossimoImpegno(tz) {
  const ora = new Date().toISOString();
  const x = state.scheduleEntries.filter(e => e.starts_at && e.starts_at > ora && e.kind !== 'commute' && e.kind !== 'off').sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (!x) return '';
  const quando = wallTime(x.starts_at, tz), oggi = today(tz);
  const giorno = quando.slice(0, 10) === oggi ? '' : quando.slice(0, 10) === shiftDate(oggi, 1) ? 'domani ' : quando.slice(8, 10) + '/' + Number(quando.slice(5, 7)) + ' ';
  return `<div class="prossimo-imp" data-oggi-voce="${x.id}" role="button" tabindex="0"><span>Prossimo</span><b>${giorno}${quando.slice(11)} · ${esc(x.title)}</b></div>`;
}
function schedaTurno(data, tz) {
  const voce = turnoDel(data), prossimo = prossimoImpegno(tz);
  if (!voce) return `<div class="k eroe vuoto"><div class="etichetta">Turno di oggi</div><div class="num">Da inserire</div><div class="sotto"><a href="#/hotel">Inserisci i turni della settimana →</a></div>${prossimo}</div>`;
  if (voce.kind === 'off') return `<div class="k eroe libero-oggi"><div class="etichetta">Turno di oggi <span class="badge">OFF</span></div><div class="num">Giorno libero</div><div class="sotto">Niente lavoro in hotel oggi</div>${prossimo}</div>`;
  const andata = state.scheduleEntries.find(e => e.shift_id === voce.id && e.commute_leg === 'outbound');
  const ritorno = state.scheduleEntries.find(e => e.shift_id === voce.id && e.commute_leg === 'return');
  return `<div class="k eroe"><div class="etichetta">Turno di oggi <span class="badge">${esc(nomeTurno(voce, tz))}</span></div><div class="num">${ora(voce.starts_at, tz)} – ${ora(voce.ends_at, tz)}</div><div class="sotto">${andata ? `Partenza alle ${ora(andata.starts_at, tz)}` : ''}${andata && ritorno ? ' · ' : ''}${ritorno ? `rientro verso le ${ora(ritorno.ends_at, tz)}` : ''}</div>${prossimo}</div>`;
}


function giornata(data, tz) {
  const righe = vociDelGiorno(data, tz);
  const senzaOra = state.scheduleEntries.filter(e => e.entry_date === data && e.kind === 'activity' && !e.starts_at);
  const adesso = wallTime(new Date().toISOString(), tz);
  let lineaMessa = data !== adesso.slice(0, 10);
  const blocchi = righe.map(({ e, da, a }) => {
    let linea = '';
    if (!lineaMessa && da > adesso) { lineaMessa = true; linea = `<div class="ora-adesso" data-ora="${adesso.slice(11)}"></div>`; }
    const tragitto = e.kind === 'commute';
    const classe = tragitto ? 'tragitto' : CLASSE[e.category] || 'personale';
    const dalle = da < `${data}T00:00` ? '00:00' : da.slice(11), alle = a > `${shiftDate(data, 1)}T00:00` ? '24:00' : a.slice(11);
    const spunta = e.kind === 'activity' ? `<button class="spunta ${e.is_completed ? 'si' : ''}" data-oggi-fatto="${e.id}" aria-label="${e.is_completed ? 'Segna da fare' : 'Segna come fatto'}">${e.is_completed ? '✓' : ''}</button>` : '';
    const progetto = state.projects.find(p => p.id === e.project_id);
    const nota = e.kind === 'shift' ? (e.notes || '') : progetto ? progetto.name : (e.notes || '').replace('[agenda-codemind]', '').trim();
    return `${linea}<div class="riga-t"><div class="ora">${dalle}<small>${alle}</small></div><div class="blocco ${classe}" data-oggi-voce="${e.id}" role="button" tabindex="0"><div><b>${esc(e.title)}</b>${nota && !tragitto ? `<p>${esc(nota.split('\n')[0])}</p>` : ''}</div><div class="dx">${!tragitto ? `<span class="cat">${ETICHETTA[e.category] || ''}</span>` : ''}${spunta}</div></div></div>`;
  }).join('');
  const fine = !lineaMessa ? `<div class="ora-adesso" data-ora="${adesso.slice(11)}"></div>` : '';
  const vuoto = !righe.length ? `<p class="vuoto-giornata">Nessun impegno con orario. <a href="#/today">Organizza la giornata nell'Agenda →</a></p>` : '';
  const daFare = senzaOra.length ? `<div class="da-collocare"><b>Da collocare oggi</b>${senzaOra.map(e => `<span class="chip" data-oggi-voce="${e.id}" role="button" tabindex="0">${esc(e.title)}</span>`).join('')}</div>` : '';
  return `<section class="card"><div class="card-testa"><h2>La giornata</h2><a class="link" href="#/today">Apri in Agenda →</a></div><div class="tempo">${vuoto}${blocchi}${fine}</div>${daFare}</section>`;
}

function obiettivi(data, tz) {
  const lun = weekStart(data), dom = shiftDate(lun, 6);
  const goals = state.weeklyGoals.filter(g => g.week_start === lun);
  if (!goals.length) return `<section class="card"><div class="card-testa"><h2>Obiettivi della settimana</h2><a class="link" href="#/today">Imposta →</a></div><p class="vuoto-giornata">Nessun obiettivo per questa settimana. Nell'Agenda puoi aggiungere Studio, Sviluppo e Palestra.</p></section>`;
  const colori = { study: 'var(--c-studio)', gym: 'var(--c-palestra)', dev: 'var(--c-sviluppo)' };
  const righe = goals.map(g => {
    const fatto = goalProgress(g, state.scheduleEntries, state.timeLogs, tz);
    const selezione = state.scheduleEntries.filter(e => e.category === g.category && (!g.project_id || e.project_id === g.project_id));
    const previsto = summary(selezione, state.timeLogs, lun, dom, tz).byCategory[g.category]?.planned || 0;
    if (g.unit === 'sessions') {
      const pallini = Array.from({ length: g.stretch_target || g.target }, (_, i) => `<i class="${i < fatto ? 'f' : ''}"></i>`).join('');
      return `<div class="obj-r"><b>${esc(g.title)}</b><span>${fatto} di ${g.target}${g.stretch_target > g.target ? '–' + g.stretch_target : ''} sessioni</span><div class="pallini">${pallini}</div></div>`;
    }
    return `<div class="obj-r"><b>${esc(g.title)}</b><span>${durata(fatto)} di ${durata(g.target)}</span>${barra(fatto, g.target, colori[g.category] || 'var(--primario)')}<em>${durata(previsto)} in agenda questa settimana</em></div>`;
  }).join('');
  return `<section class="card"><div class="card-testa"><h2>Obiettivi della settimana</h2><a class="link" href="#/today">Gestisci →</a></div><div class="obj">${righe}</div></section>`;
}

// Calorie e macro del giorno dall'archivio di Forma, comprese le modifiche non ancora salvate.
function nutritionToday(d) { const a = archivio(); if (!a) return null; const r = riepilogoGiorno(a, d); return { total: r.tot, rows: r.righe.length }; }
// Dati di Forma: bersagli in "cfg", piano di allenamento della settimana in "pa",
// schede in "s". Se l'archivio non è collegato le schede lo dicono invece di mostrare zeri.
function forma() {
  const a = archivio();
  if (!a) return null;
  const item = t => a.items.filter(i => i.t === t);
  const cfg = item('cfg')[0] || {};
  return { archivio: a, item, target: { kcal: 2000, kcalOff: 1900, prot: 130, carb: 200, gras: 65, ...(cfg.target || {}) } };
}
// Settimana tipo o settimana organizzata a parte: la regola sta in utils/palestra.js.
const allenamentoDi = (f, data) => allenamentoDelGiorno(f.archivio, data);
// ob: obiettivi del giorno (obiettiviGiorno: turno/OFF oppure allenamento/riposo).
function pasti(data, f, ob) {
  if (!f) return `<section class="card"><div class="card-testa"><h2>Pasti di oggi</h2><a class="link" href="#/sport">Collega Forma →</a></div><p class="vuoto-giornata">Collega Forma per vedere calorie e macro di oggi.</p></section>`;
  const n = nutritionToday(data) || { total: { k: 0, p: 0, c: 0, g: 0 }, rows: 0 };
  const t = ob || f.target, obiettivo = t.kcal;
  const giro = Math.min(100, Math.round(n.total.k / obiettivo * 100));
  const macro = [['Proteine', n.total.p, t.prot, 'var(--c-palestra)'], ['Carboidrati', n.total.c, t.carb, 'var(--teal)'], ['Grassi', n.total.g, t.gras, 'var(--c-sviluppo)']];
  return `<section class="card"><div class="card-testa"><h2>Pasti di oggi</h2><a class="link" href="#/sport/cibo">Diario →</a></div><div class="pasti"><div class="kcal"><div class="anello" style="--giro:${giro}%"><div><b>${numero(n.total.k)}</b><small>di ${numero(obiettivo)}</small></div></div><div class="macro">${macro.map(([nome, v, t, c]) => `<div>${nome}${barra(v, t, c)}<span>${Math.round(v)}/${t} g</span></div>`).join('')}</div></div><p class="nota-pasti">${n.rows ? `${n.rows} alimenti registrati` : 'Ancora niente registrato oggi'} · obiettivo da giorno ${({ allenamento: 'di allenamento', riposo: 'di riposo', off: 'di riposo' })[t.chi] || 'di turno'}</p></div></section>`;
}
// Lavoro sviluppo: ore di sviluppo della settimana e prossima scadenza di un progetto.
function sviluppo(data, tz) {
  const lun = weekStart(data), s = summary(state.scheduleEntries.filter(e => e.category === 'dev'), state.timeLogs, lun, shiftDate(lun, 6), tz).byCategory.dev;
  const prossimo = state.projects.filter(p => !universityData(p) && p.due_date && p.due_date >= data && !['completed', 'archived', 'done'].includes(p.status)).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const giorni = prossimo ? Math.round((Date.parse(prossimo.due_date + 'T12:00:00Z') - Date.parse(data + 'T12:00:00Z')) / 864e5) : 0;
  return `<section class="card"><div class="card-testa"><h2>Lavoro sviluppo</h2><a class="link" href="#/sviluppo">Apri →</a></div><div class="obj">
    <div class="obj-r"><b>Ore questa settimana</b><span>${durata(s.actual)} fatte · ${durata(s.planned)} in agenda</span>${barra(s.actual, s.planned, 'var(--c-sviluppo)')}</div>
    <div class="obj-r"><b>Prossima scadenza</b><span>${prossimo ? `${giorni === 0 ? 'oggi' : giorni === 1 ? 'domani' : 'tra ' + giorni + ' giorni'}` : '—'}</span><em>${prossimo ? `<a href="#/projects/${prossimo.id}">${esc(prossimo.name)}</a> · ${esc(prossimo.due_date.split('-').reverse().join('/'))}` : 'Nessun progetto con scadenza'}</em></div>
  </div></section>`;
}

// Settimana mostrata nel riquadro "La settimana" (lunedì); vuota = quella di oggi.
let settimanaVista = '';
export function oggiPage() {
  const tz = state.timezone, data = today(tz);
  const lun = weekStart(data);
  const turno = turnoDel(data), off = turno?.kind === 'off';
  const f = forma(), n = f ? nutritionToday(data) : null, a = f ? allenamentoDi(f, data) : null;
  const ob = f ? obiettiviGiorno(f.archivio, { turno: off ? 'off' : 'turno', allena: !!a }) : null, kcalObiettivo = ob ? ob.kcal : 0;
  const acqua = f ? Number(f.item('g').find(g => g.d === data)?.acqua) || 0 : 0, acquaObiettivo = ob ? Number(ob.acqua) || 2500 : 2500;
  const fatto = f && a ? f.item('w').some(w => w.d === data && w.fine && w.sid === a.scheda.id && w.gn === a.giorno.n) : false;
  return `<div class="oggi">
    <div class="testa"><div><h1>Oggi</h1><p>${esc(longDate(tz).replace(/^./, c => c.toUpperCase()))}</p></div></div>
    <section class="kpi kpi-tre">
      ${schedaTurno(data, tz)}
      <div class="k kcal-k"><div class="etichetta">Calorie e acqua</div>${f ? `<div class="num">${numero(n?.total.k || 0)} <small>/ ${numero(kcalObiettivo)} kcal</small></div>${barra(n?.total.k || 0, kcalObiettivo, 'var(--azzurro)')}<div class="sotto acqua-r">💧 ${numero(acqua)} / ${numero(acquaObiettivo)} ml<span><button data-oggi-acqua="250">+250</button><button data-oggi-acqua="500">+500</button></span></div>` : `<div class="num">—</div><div class="sotto"><a href="#/sport">Apri Palestra</a></div>`}</div>
      <div class="k all-k"><div class="etichetta">Allenamento</div>${a ? `<div class="num">${esc(a.giorno.n)}</div><div class="sotto all-r"><span>${esc(a.scheda.n || '')} · ${(a.giorno.eser || []).length} esercizi</span>${fatto ? '<b>fatto ✓</b>' : bottoneInizia(f.archivio, data, a.scheda.id, a.giorno.n, 'oggi-inizia')}</div>` : `<div class="num">${f ? 'Riposo' : '—'}</div><div class="sotto">${f ? 'Nessuna seduta in piano' : 'Apri Palestra'}</div>`}</div>
    </section>
    ${weekCompatta(Array.from({ length: 7 }, (_, i) => shiftDate(settimanaVista || lun, i)), data, true)}
    <div class="griglia"><div class="col">${giornata(data, tz)}</div><div class="col">${obiettivi(data, tz)}${pasti(data, f, ob)}${sviluppo(data, tz)}</div></div>
  </div>`;
}

export function bindOggi(render) {
  bindAllenamentiAgenda(render, entryForm);
  document.querySelectorAll('[data-oggi-sett]').forEach(b => b.onclick = () => {
    const v = Number(b.dataset.oggiSett), lun = settimanaVista || weekStart(today(state.timezone));
    settimanaVista = v ? shiftDate(lun, 7 * v) : '';
    if (settimanaVista === weekStart(today(state.timezone))) settimanaVista = '';
    render();
    document.querySelector('[data-oggi-sett="' + (v || 1) + '"]')?.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-oggi-acqua]').forEach(b => b.onclick = () => { try { cambiaAcqua(today(state.timezone), Number(b.dataset.oggiAcqua)); render(); } catch (e) { toast(e.message); } });
  document.querySelectorAll('.oggi [data-pal-inizia]').forEach(b => b.onclick = () => { const [sid, ...gn] = b.dataset.palInizia.split('|'); try { inizia(today(state.timezone), sid, gn.join('|')); } catch (e) { toast(e.message); } });
  document.querySelectorAll('[data-oggi-fatto]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const voce = state.scheduleEntries.find(x => x.id === b.dataset.oggiFatto);
    if (!voce) return;
    b.disabled = true;
    try { await saveEntry({ ...entryPayload(voce), is_completed: !voce.is_completed }, voce); render(); }
    catch (err) { toast(err.message); b.disabled = false; }
  });
  document.querySelectorAll('[data-oggi-voce]').forEach(el => {
    const apri = () => { const voce = state.scheduleEntries.find(x => x.id === el.dataset.oggiVoce); if (voce) entryForm(voce, render); };
    el.onclick = apri;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); } };
  });
}
