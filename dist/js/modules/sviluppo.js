// Sezione "Lavoro Sviluppo" (anteprima approvata il 20/11/2026: anteprime/03-sviluppo.html).
// Panoramica, Clienti, Preventivi e Formazione AI stanno qui; Progetti, Attività e
// Archivio restano le pagine di prima, con la stessa fila di schede in alto.
import { state } from '../services/store.js?v=65';
import { saveCliente, savePreventivo, saveIncasso, saveFormazione, elimina, STATI_PREVENTIVO, TIPI_FORMAZIONE, STATI_FORMAZIONE } from '../services/lavoroService.js?v=70';
import { oreProgetti, perCliente, contoPreventivo, totaliPreventivi, iniziali } from '../utils/sviluppo.js?v=70';
import { minutiInOre, euro } from '../utils/hotel.js?v=70';
import { scaricaCsv, numeroCsv } from '../utils/esporta.js?v=70';
import { universityData } from '../utils/university.js?v=65';
import { schedeSviluppo } from './sezioni.js?v=70';
import { today } from '../utils/dates.js?v=65';
import { esc, safeURL, priorities } from '../utils/helpers.js?v=65';
import { openModal, closeModal, bindForm, confirmDelete, toast } from '../utils/dom.js?v=65';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
let meseScelto = null, filtroStato = 'aperti', filtroCliente = '';
const tz = () => state.timezone;
const oggi = () => today(tz());
const nomeMese = m => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const spostaMese = (m, n) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
const dataBreve = d => d ? d.split('-').reverse().join('/') : '—';
const ore = m => m ? minutiInOre(m) : '–';
const progettiSviluppo = () => state.projects.filter(p => !universityData(p));
const attivitaAperte = () => state.tasks.filter(t => t.status !== 'completed' && progettiSviluppo().some(p => p.id === t.project_id && p.status !== 'archived'));
const clienteDi = id => state.clienti.find(c => c.id === id);
const nomeCliente = id => clienteDi(id)?.nome || '—';

function testa() {
  return `<div class="page-heading lavoro-testa"><div><h1>Lavoro Sviluppo</h1><p class="subtext">Clienti, progetti, ore, preventivi e formazione</p></div>
  <div class="mese-nav"><button class="icona-tonda" data-svil-mese="-1" aria-label="Mese precedente">‹</button><b>${esc(nomeMese(meseScelto).replace(/^./, c => c.toUpperCase()))}</b><button class="icona-tonda" data-svil-mese="1" aria-label="Mese successivo">›</button></div>
  <div class="azioni"><button class="btn" data-svil-nuovo-cliente>+ Cliente</button><button class="btn quick-global" data-svil-nuovo-preventivo>+ Preventivo</button></div></div>`;
}
const avviso = () => state.lavoroError ? `<div class="avviso">${esc(state.lavoroError)} Progetti e attività funzionano già; clienti, preventivi e formazione arrivano dopo l'aggiornamento del database.</div>` : '';

// ------------------------------------------------------------------ Panoramica
function cartaCliente(c, orePerCliente) {
  const progetti = progettiSviluppo().filter(p => p.cliente_id === c.id && p.status !== 'archived');
  const o = orePerCliente.get(c.id), t = totaliPreventivi(state.preventivi, state.incassi, c.id);
  const aperte = attivitaAperte().filter(x => progetti.some(p => p.id === x.project_id)).length;
  const link = [c.sito && safeURL(c.sito) ? `<a href="${esc(safeURL(c.sito))}" target="_blank" rel="noopener">Sito ↗</a>` : '',
    ...progetti.flatMap(p => [p.project_url && safeURL(p.project_url) ? `<a href="${esc(safeURL(p.project_url))}" target="_blank" rel="noopener">${esc(p.name)} ↗</a>` : '', p.github_url && safeURL(p.github_url) ? `<a href="${esc(safeURL(p.github_url))}" target="_blank" rel="noopener">GitHub ↗</a>` : ''])].filter(Boolean).join('');
  return `<article class="cliente-carta"><button class="cliente-testa" data-svil-cliente="${esc(c.id)}"><span class="ini" style="background:${esc(c.colore)}">${esc(iniziali(c.nome))}</span><span><b>${esc(c.nome)}</b><small>${progetti.length ? progetti.map(p => esc(p.name)).join(' · ') : 'nessun progetto collegato'}</small></span></button>
  <div class="numeri"><div><b>${ore(o?.fatte || 0)}</b><span>questo mese</span></div><div><b>${c.interno ? '—' : euro(t.daIncassare).replace(',00', '')}</b><span>${c.interno ? 'interni' : 'da incassare'}</span></div><div><b>${aperte}</b><span>attività aperte</span></div></div>
  ${link ? `<div class="link-c">${link}</div>` : ''}</article>`;
}
function tabellaOre(righe) {
  const tot = righe.reduce((s, r) => ({ p: s.p + r.pianificate, f: s.f + r.fatte }), { p: 0, f: 0 });
  return `<div class="barra-strumenti"><span class="spazio"></span><button class="btn" data-svil-csv="ore">CSV</button><button class="btn" data-stampa>Stampa</button></div>
  <div class="table-wrap"><table class="dati"><thead><tr><th>Progetto</th><th class="nasc">Cliente</th><th class="n">Pianificate</th><th class="n">Fatte</th></tr></thead><tbody>
  ${righe.map(r => `<tr><td>${r.project_id ? `<a href="#/projects/${esc(r.project_id)}">${esc(r.progetto)}</a>` : esc(r.progetto)}</td><td class="nasc">${esc(nomeCliente(r.cliente_id))}</td><td class="n">${ore(r.pianificate)}</td><td class="n">${ore(r.fatte)}</td></tr>`).join('') || '<tr><td colspan="4" class="vuoto-tabella">Nessun blocco di Sviluppo in agenda in questo mese.</td></tr>'}
  </tbody><tfoot><tr><td>Totale</td><td class="nasc"></td><td class="n">${ore(tot.p)}</td><td class="n">${ore(tot.f)}</td></tr></tfoot></table></div>`;
}
function tabellaPreventivi(lista, conAzioni = false) {
  const t = lista.filter(p => p.stato === 'accettato').map(p => ({ p, c: contoPreventivo(p, state.incassi) }));
  return `<div class="table-wrap"><table class="dati"><thead><tr><th>Lavoro</th><th class="nasc">Cliente</th>${conAzioni ? '<th class="nasc">Data</th>' : ''}<th class="n">Importo</th><th class="n">Incassato</th><th>Stato</th>${conAzioni ? '<th></th>' : ''}</tr></thead><tbody>
  ${lista.map(p => { const c = contoPreventivo(p, state.incassi); return `<tr><td>${esc(p.titolo)}${p.scadenza && c.residuo > 0 ? `<small class="sotto-riga">scade il ${dataBreve(p.scadenza)}</small>` : ''}</td><td class="nasc">${esc(nomeCliente(p.cliente_id))}</td>${conAzioni ? `<td class="nasc">${dataBreve(p.data)}</td>` : ''}<td class="n">${euro(p.importo)}</td><td class="n">${c.incassato ? euro(c.incassato) : '—'}</td><td><span class="pill ${c.classe}">${c.etichetta}</span></td>${conAzioni ? `<td class="n azioni-riga">${p.stato === 'accettato' && c.residuo > 0 ? `<button class="link" data-svil-incasso="${esc(p.id)}">+ Incasso</button>` : ''}<button class="link" data-svil-preventivo="${esc(p.id)}">Modifica</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="${conAzioni ? 7 : 5}" class="vuoto-tabella">Nessun preventivo. Crealo con "+ Preventivo".</td></tr>`}
  </tbody><tfoot><tr><td>Totale accettati</td><td class="nasc"></td>${conAzioni ? '<td class="nasc"></td>' : ''}<td class="n">${euro(t.reduce((s, x) => s + Number(x.p.importo), 0))}</td><td class="n">${euro(t.reduce((s, x) => s + x.c.incassato, 0))}</td><td>${euro(t.reduce((s, x) => s + x.c.residuo, 0))} da incassare</td>${conAzioni ? '<td></td>' : ''}</tr></tfoot></table></div>`;
}
function inScadenza() {
  const limite = new Date(Date.parse(oggi() + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  const lista = attivitaAperte().filter(t => t.due_date && t.due_date <= limite).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
  return lista.map(t => { const p = state.projects.find(x => x.id === t.project_id); const scaduta = t.due_date < oggi(); return `<div class="riga2"><span><a href="#/tasks">${esc(t.title)}</a><small class="sotto-riga">${esc(p?.name || '')} · ${esc(priorities[t.priority] || '')}</small></span><b class="${scaduta ? 'scaduta' : ''}">${scaduta ? 'scaduta' : dataBreve(t.due_date).slice(0, 5)}</b></div>`; }).join('') || '<p class="vuoto-giornata">Niente in scadenza nei prossimi 7 giorni.</p>';
}
function listaFormazione(lista, completa = false) {
  const icone = { corso: '🎓', video: '▶️', libro: '📘', articolo: '📰', documentazione: '📄', altro: '✳️' };
  const classi = { da_fare: 'p-x', in_corso: 'p-a', finito: 'p-off' };
  return lista.map(f => `<div class="corso"><span class="tipo">${icone[f.tipo] || '✳️'}</span><div><b>${f.link && safeURL(f.link) ? `<a href="${esc(safeURL(f.link))}" target="_blank" rel="noopener">${esc(f.titolo)} ↗</a>` : esc(f.titolo)}</b><small>${TIPI_FORMAZIONE[f.tipo]} · ${f.ore_previste ? `${Number(f.ore_fatte).toLocaleString('it-IT')} h su ${Number(f.ore_previste).toLocaleString('it-IT')}` : `${Number(f.ore_fatte).toLocaleString('it-IT')} h fatte`}</small></div><span class="dx"><span class="pill ${classi[f.stato]}">${STATI_FORMAZIONE[f.stato]}</span>${completa ? `<button class="link" data-svil-formazione="${esc(f.id)}">Modifica</button>` : ''}</span>${f.ore_previste ? `<div class="barra"><i style="width:${Math.min(100, Math.round(f.ore_fatte / f.ore_previste * 100))}%;background:var(--c-sviluppo)"></i></div>` : ''}</div>`).join('') || '<p class="vuoto-giornata">Aggiungi corsi, video e documentazione sull\'AI che vuoi seguire.</p>';
}
function vistaPanoramica() {
  const righe = oreProgetti(state.scheduleEntries, state.timeLogs, state.projects, meseScelto, tz());
  const perC = perCliente(righe), tot = righe.reduce((s, r) => ({ p: s.p + r.pianificate, f: s.f + r.fatte }), { p: 0, f: 0 });
  const conti = totaliPreventivi(state.preventivi, state.incassi);
  const aperte = attivitaAperte(), scadute = aperte.filter(t => t.due_date && t.due_date < oggi()).length;
  const prossima = aperte.filter(t => t.due_date && t.due_date >= oggi()).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const clienti = state.clienti.filter(c => !c.archiviato).sort((a, b) => Number(a.interno) - Number(b.interno) || a.nome.localeCompare(b.nome));
  const preventivi = [...state.preventivi].filter(p => p.stato !== 'rifiutato').sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  const formazione = [...state.formazione].sort((a, b) => ({ in_corso: 0, da_fare: 1, finito: 2 })[a.stato] - ({ in_corso: 0, da_fare: 1, finito: 2 })[b.stato]).slice(0, 4);
  return `${avviso()}<section class="kpi-lavoro">
   <div class="k t-navy"><div class="etichetta">Ore di sviluppo a ${esc(MESI[Number(meseScelto.slice(5, 7)) - 1])}</div><div class="num">${minutiInOre(tot.f)} <small>/ ${minutiInOre(tot.p)} pianificate</small></div><div class="barra"><i style="width:${tot.p ? Math.min(100, Math.round(tot.f / tot.p * 100)) : 0}%;background:var(--azzurro)"></i></div></div>
   <div class="k t-lilla"><div class="etichetta">Da incassare</div><div class="num">${euro(conti.daIncassare)}</div><div class="sotto">su ${conti.accettati} ${conti.accettati === 1 ? 'preventivo accettato' : 'preventivi accettati'}${conti.inAttesa ? ` · ${euro(conti.inAttesa)} in attesa` : ''}</div></div>
   <div class="k t-azzurro"><div class="etichetta">Attività aperte</div><div class="num">${aperte.length} <small>· ${scadute} scadute</small></div><div class="sotto">nei progetti di sviluppo</div></div>
   <div class="k t-corallo"><div class="etichetta">Prossima scadenza</div><div class="num corta">${prossima ? esc(prossima.title) : 'Nessuna'}</div><div class="sotto">${prossima ? `${esc(state.projects.find(p => p.id === prossima.project_id)?.name || '')} · ${dataBreve(prossima.due_date)}` : 'niente in calendario'}</div></div>
  </section>
  ${clienti.length ? `<div class="clienti-griglia">${clienti.map(c => cartaCliente(c, perC)).join('')}</div>` : `<section class="card vuota-cta"><p>Crea i tuoi clienti e collegali ai progetti: qui vedrai ore, preventivi e attività di ognuno.</p><button class="btn primary" data-svil-nuovo-cliente>+ Primo cliente</button></section>`}
  <div class="griglia-lavoro"><div class="col">
   <section class="card"><div class="card-testa"><h2>Ore per progetto</h2></div>${tabellaOre(righe)}</section>
   <section class="card"><div class="card-testa"><h2>Preventivi e incassi</h2><a class="link" href="#/sviluppo/preventivi">Tutti →</a></div>${tabellaPreventivi(preventivi)}</section>
  </div><div class="col">
   <section class="card"><div class="card-testa"><h2>Attività in scadenza</h2><a class="link" href="#/tasks">Attività →</a></div><div class="contenuto">${inScadenza()}</div></section>
   <section class="card"><div class="card-testa"><h2>Formazione AI</h2><a class="link" href="#/sviluppo/formazione">Tutta →</a></div><div class="contenuto">${listaFormazione(formazione)}</div></section>
  </div></div>`;
}

// ------------------------------------------------------------------ Clienti
function vistaClienti() {
  const righe = oreProgetti(state.scheduleEntries, state.timeLogs, state.projects, meseScelto, tz()), perC = perCliente(righe);
  const lista = [...state.clienti].sort((a, b) => Number(a.archiviato) - Number(b.archiviato) || a.nome.localeCompare(b.nome));
  const senza = progettiSviluppo().filter(p => !p.cliente_id && p.status !== 'archived');
  return `${avviso()}<section class="card"><div class="card-testa"><h2>Clienti</h2><button class="link" data-svil-nuovo-cliente>+ Nuovo cliente</button></div>
  <div class="table-wrap"><table class="dati"><thead><tr><th>Cliente</th><th class="nasc">Referente</th><th class="nasc">Contatti</th><th>Progetti</th><th class="n">Ore ${esc(MESI[Number(meseScelto.slice(5, 7)) - 1])}</th><th class="n">Da incassare</th><th></th></tr></thead><tbody>
  ${lista.map(c => { const progetti = progettiSviluppo().filter(p => p.cliente_id === c.id); const t = totaliPreventivi(state.preventivi, state.incassi, c.id);
    return `<tr class="${c.archiviato ? 'futuro' : ''}"><td><span class="ini piccola" style="background:${esc(c.colore)}">${esc(iniziali(c.nome))}</span> ${esc(c.nome)}${c.interno ? ' <span class="pill p-x">interno</span>' : ''}${c.archiviato ? ' <span class="pill p-x">archiviato</span>' : ''}</td><td class="nasc">${esc(c.referente) || '—'}</td><td class="nasc">${[c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '', esc(c.telefono)].filter(Boolean).join(' · ') || '—'}</td><td>${progetti.map(p => `<a href="#/projects/${esc(p.id)}">${esc(p.name)}</a>`).join(', ') || '—'}</td><td class="n">${ore(perC.get(c.id)?.fatte || 0)}</td><td class="n">${c.interno ? '—' : euro(t.daIncassare)}</td><td class="n"><button class="link" data-svil-cliente="${esc(c.id)}">Modifica</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="vuoto-tabella">Nessun cliente.</td></tr>'}
  </tbody></table></div>
  ${senza.length ? `<p class="subtext piccolo contenuto">Progetti senza cliente: ${senza.map(p => `<a href="#/projects/${esc(p.id)}">${esc(p.name)}</a>`).join(', ')}. Il cliente si sceglie nella scheda del progetto (Modifica).</p>` : ''}</section>`;
}

// ------------------------------------------------------------------ Preventivi
function vistaPreventivi() {
  const filtri = [['aperti', 'Da incassare'], ['tutti', 'Tutti'], ['inviato', 'Inviati'], ['bozza', 'Bozze'], ['pagati', 'Pagati'], ['rifiutato', 'Rifiutati']];
  let lista = [...state.preventivi].sort((a, b) => b.data.localeCompare(a.data));
  if (filtroCliente) lista = lista.filter(p => p.cliente_id === filtroCliente);
  lista = lista.filter(p => { const c = contoPreventivo(p, state.incassi);
    return filtroStato === 'tutti' || (filtroStato === 'aperti' ? p.stato === 'accettato' && c.residuo > 0 : filtroStato === 'pagati' ? c.etichetta === 'Pagato' : p.stato === filtroStato); });
  return `${avviso()}<section class="card"><div class="card-testa"><h2>Preventivi e incassi</h2><button class="link" data-svil-nuovo-preventivo>+ Nuovo preventivo</button></div>
  <div class="barra-strumenti">${filtri.map(([k, n]) => `<button class="chip ${k === filtroStato ? 'on' : ''}" data-svil-filtro="${k}">${n}</button>`).join('')}
   <select class="filtro-cliente" data-svil-filtro-cliente aria-label="Filtra per cliente"><option value="">Tutti i clienti</option>${state.clienti.map(c => `<option value="${esc(c.id)}" ${c.id === filtroCliente ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
   <span class="spazio"></span><button class="btn" data-svil-csv="preventivi">CSV</button><button class="btn" data-stampa>Stampa</button></div>
  ${tabellaPreventivi(lista, true)}</section>`;
}

// ------------------------------------------------------------------ Formazione
function vistaFormazione() {
  const ordine = { in_corso: 0, da_fare: 1, finito: 2 };
  const lista = [...state.formazione].sort((a, b) => ordine[a.stato] - ordine[b.stato] || a.titolo.localeCompare(b.titolo));
  const fatte = lista.reduce((s, f) => s + Number(f.ore_fatte || 0), 0);
  return `${avviso()}<section class="card"><div class="card-testa"><h2>Formazione AI</h2><button class="link" data-svil-nuova-formazione>+ Aggiungi</button></div>
  <p class="subtext piccolo contenuto">${lista.filter(f => f.stato === 'in_corso').length} in corso · ${lista.filter(f => f.stato === 'finito').length} finiti · ${fatte.toLocaleString('it-IT')} h di studio registrate</p>
  <div class="contenuto">${listaFormazione(lista, true)}</div></section>`;
}

export function sviluppoPage(id) {
  meseScelto ||= oggi().slice(0, 7);
  const viste = { clienti: vistaClienti, preventivi: vistaPreventivi, formazione: vistaFormazione };
  const scheda = viste[id] ? id : 'panoramica';
  return `<div class="lavoro">${testa()}${schedeSviluppo(scheda)}${(viste[scheda] || vistaPanoramica)()}</div>`;
}

// ------------------------------------------------------------------ finestre
const opzioni = (valori, attuale) => Object.entries(valori).map(([k, n]) => `<option value="${esc(k)}" ${k === attuale ? 'selected' : ''}>${esc(n)}</option>`).join('');
function formCliente(c, render) {
  const x = c || { colore: '#5B4BC4' };
  openModal(c ? 'Modifica cliente' : 'Nuovo cliente', `<form id="svil-cliente-form"><div class="form-grid">
   <label class="field">Nome *<input name="nome" required maxlength="120" value="${esc(x.nome || '')}"></label>
   <label class="field">Colore<input type="color" name="colore" value="${esc(x.colore)}"></label>
   <label class="field">Referente<input name="referente" maxlength="120" value="${esc(x.referente || '')}"></label>
   <label class="field">Email<input type="email" name="email" maxlength="200" value="${esc(x.email || '')}"></label>
   <label class="field">Telefono<input name="telefono" maxlength="40" value="${esc(x.telefono || '')}"></label>
   <label class="field">Sito<input type="url" name="sito" maxlength="300" value="${esc(x.sito || '')}" placeholder="https://"></label>
   <label class="field full">Note<textarea name="note" maxlength="5000">${esc(x.note || '')}</textarea></label>
   <label class="check"><input type="checkbox" name="interno" ${x.interno ? 'checked' : ''}> Progetti miei (interni, senza incassi)</label>
   <label class="check"><input type="checkbox" name="archiviato" ${x.archiviato ? 'checked' : ''}> Archiviato</label></div>
   <div class="form-actions">${c ? '<button class="btn danger" type="button" id="svil-elimina-cliente">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('svil-cliente-form', async d => { await saveCliente({ ...Object.fromEntries(d), interno: d.get('interno') === 'on', archiviato: d.get('archiviato') === 'on' }, c); render(); });
  document.getElementById('svil-elimina-cliente')?.addEventListener('click', () => confirmDelete(`Eliminare il cliente "${c.nome}"? I suoi progetti restano, i preventivi e gli incassi vengono cancellati.`, async () => { await elimina('clienti', c); render(); }));
}
function formPreventivo(p, render) {
  if (!state.clienti.length) { toast('Crea prima un cliente.'); return formCliente(null, render); }
  const x = p || { stato: 'bozza', data: oggi(), cliente_id: filtroCliente || state.clienti.find(c => !c.archiviato && !c.interno)?.id };
  const incassi = p ? state.incassi.filter(i => i.preventivo_id === p.id).sort((a, b) => a.data.localeCompare(b.data)) : [];
  openModal(p ? 'Modifica preventivo' : 'Nuovo preventivo', `<form id="svil-preventivo-form"><div class="form-grid">
   <label class="field full">Lavoro *<input name="titolo" required maxlength="200" value="${esc(x.titolo || '')}" placeholder="es. Shop Shopify · fase 2"></label>
   <label class="field">Cliente *<select name="cliente_id" required>${state.clienti.map(c => `<option value="${esc(c.id)}" ${c.id === x.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
   <label class="field">Progetto<select name="project_id"><option value="">Nessuno</option>${progettiSviluppo().filter(pr => pr.status !== 'archived' || pr.id === x.project_id).map(pr => `<option value="${esc(pr.id)}" ${pr.id === x.project_id ? 'selected' : ''}>${esc(pr.name)}</option>`).join('')}</select></label>
   <label class="field">Importo (€) *<input name="importo" required inputmode="decimal" value="${x.importo != null ? esc(String(x.importo).replace('.', ',')) : ''}"></label>
   <label class="field">Stato<select name="stato">${opzioni(STATI_PREVENTIVO, x.stato)}</select></label>
   <label class="field">Data<input type="date" name="data" value="${esc(x.data)}" required></label>
   <label class="field">Pagamento entro<input type="date" name="scadenza" value="${esc(x.scadenza || '')}"></label>
   <label class="field full">Note<textarea name="note" maxlength="5000">${esc(x.note || '')}</textarea></label></div>
   ${incassi.length ? `<div class="incassi-elenco"><b>Incassi</b>${incassi.map(i => `<div class="riga2"><span>${dataBreve(i.data)}${i.note ? ' · ' + esc(i.note) : ''}</span><b>${euro(i.importo)} <button class="link" type="button" data-elimina-incasso="${esc(i.id)}">Elimina</button></b></div>`).join('')}</div>` : ''}
   <div class="form-actions">${p ? '<button class="btn danger" type="button" id="svil-elimina-preventivo">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('svil-preventivo-form', async d => { await savePreventivo(Object.fromEntries(d), p); render(); });
  document.getElementById('svil-elimina-preventivo')?.addEventListener('click', () => confirmDelete(`Eliminare il preventivo "${p.titolo}" e i suoi incassi?`, async () => { await elimina('preventivi', p); render(); }));
  document.querySelectorAll('[data-elimina-incasso]').forEach(b => b.onclick = async () => { const i = state.incassi.find(x => x.id === b.dataset.eliminaIncasso); try { await elimina('incassi', i); closeModal(); toast('Incasso eliminato'); render(); } catch (e) { toast(e.message); } });
}
function formIncasso(p, render) {
  const c = contoPreventivo(p, state.incassi);
  openModal('Registra un incasso', `<form id="svil-incasso-form"><p class="subtext">${esc(p.titolo)} · ${esc(nomeCliente(p.cliente_id))} · restano ${euro(c.residuo)}</p><div class="form-grid">
   <label class="field">Importo (€) *<input name="importo" required inputmode="decimal" value="${esc(String(c.residuo).replace('.', ','))}"></label>
   <label class="field">Data<input type="date" name="data" value="${oggi()}" required></label>
   <label class="field full">Note<input name="note" maxlength="2000" placeholder="es. acconto, bonifico"></label></div>
   <div class="form-actions"><button class="btn primary" type="submit">Registra</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('svil-incasso-form', async d => { await saveIncasso({ ...Object.fromEntries(d), preventivo_id: p.id }); render(); });
}
function formFormazione(f, render) {
  const x = f || { tipo: 'corso', stato: 'da_fare', ore_fatte: 0 };
  openModal(f ? 'Modifica formazione' : 'Nuova formazione', `<form id="svil-formazione-form"><div class="form-grid">
   <label class="field full">Titolo *<input name="titolo" required maxlength="200" value="${esc(x.titolo || '')}" placeholder="es. Corso su agenti e MCP"></label>
   <label class="field">Tipo<select name="tipo">${opzioni(TIPI_FORMAZIONE, x.tipo)}</select></label>
   <label class="field">Stato<select name="stato">${opzioni(STATI_FORMAZIONE, x.stato)}</select></label>
   <label class="field">Ore previste<input name="ore_previste" inputmode="decimal" value="${x.ore_previste != null ? esc(String(x.ore_previste).replace('.', ',')) : ''}"></label>
   <label class="field">Ore fatte<input name="ore_fatte" inputmode="decimal" value="${esc(String(x.ore_fatte ?? 0).replace('.', ','))}"></label>
   <label class="field full">Link<input type="url" name="link" maxlength="500" value="${esc(x.link || '')}" placeholder="https://"></label>
   <label class="field full">Note<textarea name="note" maxlength="5000">${esc(x.note || '')}</textarea></label></div>
   <div class="form-actions">${f ? '<button class="btn danger" type="button" id="svil-elimina-formazione">Elimina</button>' : ''}<button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('svil-formazione-form', async d => { await saveFormazione(Object.fromEntries(d), f); render(); });
  document.getElementById('svil-elimina-formazione')?.addEventListener('click', () => confirmDelete(`Eliminare "${f.titolo}"?`, async () => { await elimina('formazione', f); render(); }));
}

export function bindSviluppo(render) {
  const pagina = document.querySelector('.lavoro');
  if (!pagina) return;
  pagina.querySelectorAll('[data-svil-mese]').forEach(b => b.onclick = () => { meseScelto = spostaMese(meseScelto, Number(b.dataset.svilMese)); render(); });
  pagina.querySelectorAll('[data-svil-nuovo-cliente]').forEach(b => b.onclick = () => formCliente(null, render));
  pagina.querySelectorAll('[data-svil-cliente]').forEach(b => b.onclick = () => formCliente(clienteDi(b.dataset.svilCliente), render));
  pagina.querySelectorAll('[data-svil-nuovo-preventivo]').forEach(b => b.onclick = () => formPreventivo(null, render));
  pagina.querySelectorAll('[data-svil-preventivo]').forEach(b => b.onclick = () => formPreventivo(state.preventivi.find(p => p.id === b.dataset.svilPreventivo), render));
  pagina.querySelectorAll('[data-svil-incasso]').forEach(b => b.onclick = () => formIncasso(state.preventivi.find(p => p.id === b.dataset.svilIncasso), render));
  pagina.querySelectorAll('[data-svil-nuova-formazione]').forEach(b => b.onclick = () => formFormazione(null, render));
  pagina.querySelectorAll('[data-svil-formazione]').forEach(b => b.onclick = () => formFormazione(state.formazione.find(f => f.id === b.dataset.svilFormazione), render));
  pagina.querySelectorAll('[data-svil-filtro]').forEach(b => b.onclick = () => { filtroStato = b.dataset.svilFiltro; render(); });
  pagina.querySelector('[data-svil-filtro-cliente]')?.addEventListener('change', e => { filtroCliente = e.target.value; render(); });
  pagina.querySelectorAll('[data-stampa]').forEach(b => b.onclick = () => window.print());
  pagina.querySelectorAll('[data-svil-csv]').forEach(b => b.onclick = () => esporta(b.dataset.svilCsv));
}

function esporta(cosa) {
  if (cosa === 'ore') {
    const righe = oreProgetti(state.scheduleEntries, state.timeLogs, state.projects, meseScelto, tz());
    scaricaCsv(`ore-sviluppo-${meseScelto}.csv`, [['Progetto', 'Cliente', 'Ore pianificate', 'Ore fatte'], ...righe.map(r => [r.progetto, nomeCliente(r.cliente_id), numeroCsv(r.pianificate / 60), numeroCsv(r.fatte / 60)])]);
  } else if (cosa === 'preventivi') {
    scaricaCsv('preventivi.csv', [['Data', 'Lavoro', 'Cliente', 'Importo', 'Incassato', 'Da incassare', 'Stato', 'Pagamento entro'],
      ...[...state.preventivi].sort((a, b) => a.data.localeCompare(b.data)).map(p => { const c = contoPreventivo(p, state.incassi); return [p.data, p.titolo, nomeCliente(p.cliente_id), numeroCsv(p.importo), numeroCsv(c.incassato), numeroCsv(c.residuo), c.etichetta, p.scadenza || '']; })]);
  }
}
