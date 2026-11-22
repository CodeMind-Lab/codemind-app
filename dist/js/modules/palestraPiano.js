// Palestra, terza tappa: Piano settimanale dei pasti (giornate tipo, settimana, lista della
// spesa), Misure e Report. Stesso stile Bento delle altre schede della sezione.
import { state } from '../services/store.js?v=65';
import * as P from '../services/palestraService.js?v=83';
import { giornate, pianoPasti, spesa, misure, reportSettimane, somma, macro, turnoDi, lunediDi, cfg, pesoAttuale, GIORNI_SETT, NOMI_GIORNI, PASTI, di } from '../utils/palestra.js?v=75';
import { shiftPresets } from '../utils/workShifts.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { scaricaCsv, numeroCsv } from '../utils/esporta.js?v=70';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, closeModal, toast, confirmDelete } from '../utils/dom.js?v=65';

let giornataScelta = '', settimaneReport = 8;
const tz = () => state.timezone;
const oggi = () => today(tz());
const nf = new Map();
const fmt = (n, dec = 0) => { if (!nf.has(dec)) nf.set(dec, new Intl.NumberFormat('it-IT', { maximumFractionDigits: dec, useGrouping: 'always' })); return nf.get(dec).format(Number(n) || 0); };
const dataBreve = d => new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const giornoMese = d => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
const PILL = { apertura: 'p-a', chiusura: 'p-c', notte: 'p-n', off: 'p-off', custom: 'p-x' };
const TIPI = { '': 'Qualsiasi giorno', on: 'Giorno di turno', off: 'Giorno OFF' };

// ------------------------------------------------------------ Piano settimanale
export function vistaPiano(a, d) {
  const lista = giornate(a), piano = pianoPasti(a), t = cfg(a).target;
  if (!lista.some(g => g.id === giornataScelta)) giornataScelta = piano.find(p => p.gt)?.gt || lista[0]?.id || '';
  const g = lista.find(x => x.id === giornataScelta), usate = new Set(piano.map(p => p.gt).filter(Boolean));
  const elenco = `<div class="sch-elenco">${lista.map(x => { const k = somma(x.righe || []).k; return `<button class="sch ${x.id === giornataScelta ? 'on' : ''}" data-pal-giornata="${esc(x.id)}"><b>${esc(x.n)}</b><small>${fmt(k)} kcal · ${(x.righe || []).length} alimenti${x.tipo ? ' · ' + (x.tipo === 'off' ? 'OFF' : 'turno') : ''}</small>${usate.has(x.id) ? '<span class="pill p-c">nel piano</span>' : ''}</button>`; }).join('')}<button class="nuova" data-pal-nuova-giornata>+ Nuova giornata</button><button class="nuova" data-pal-da-diario>Salva il diario di ${esc(dataBreve(d))} come giornata</button></div>`;
  let editor = '<section class="card"><p class="vuoto-giornata">Crea una giornata tipo (es. "Giorno di turno", "Giorno OFF") e mettici i pasti: poi assegnala ai giorni della settimana.</p></section>';
  if (g) {
    const righe = g.righe || [], tot = somma(righe), ob = g.tipo === 'off' ? t.kcalOff : t.kcal;
    const fasce = PASTI.map(p => { const rp = righe.map((r, i) => ({ r, i })).filter(x => x.r.slot === p.id); const tp = somma(rp.map(x => x.r));
      return `<div class="fascia"><div class="fascia-t"><span class="fascia-nome">${esc(p.l)}</span><span class="tot">${rp.length ? `${fmt(tp.k)} kcal · ${fmt(tp.p)} g P` : '—'}</span><button class="piu" data-pal-agg-giornata="${p.id}" aria-label="Aggiungi a ${esc(p.l)}">+</button></div>
      ${rp.length ? `<table class="dati pal-righe pal-righe-piano"><tbody>${rp.map(({ r, i }) => { const m = macro(r); return `<tr><td>${esc(r.n)}</td><td class="q"><input class="cella-g" data-pal-riga-gt="${i}" type="number" inputmode="decimal" step="any" min="1" value="${esc(r.q)}" aria-label="Grammi"> g</td><td class="n">${fmt(m.k)} kcal</td><td class="n nasc">${fmt(m.p, 1)} P</td><td class="n"><button class="x" data-pal-togli-gt="${i}" aria-label="Togli">✕</button></td></tr>`; }).join('')}</tbody></table>` : ''}</div>`; }).join('');
    editor = `<section class="card"><div class="card-testa"><h2>${esc(g.n)}</h2><span class="link-gruppo"><button class="link" data-pal-rinomina-giornata>Rinomina</button> · <button class="link" data-pal-duplica-giornata>Duplica</button> · <button class="link" data-pal-elimina-giornata>Elimina</button></span></div>
      <div class="contenuto"><div class="riga2 totale"><span>${esc(TIPI[g.tipo || ''])} · obiettivo ${fmt(ob)} kcal</span><b>${fmt(tot.k)} kcal</b></div>
      <div class="macro pal-macro-piano">${[['Proteine', tot.p, t.prot, 'var(--teal)'], ['Carboidrati', tot.c, t.carb, '#8F80EE'], ['Grassi', tot.g, t.gras, '#F5A524']].map(([n, v, m, c]) => `<div>${n}<div class="barra"><i style="width:${m ? Math.min(100, Math.round(v / m * 100)) : 0}%;background:${c}"></i></div><span>${fmt(v)} / ${fmt(m)} g</span></div>`).join('')}</div>
      ${fasce}</div></section>`;
  }
  const lun = lunediDi(d), opzioni = lista.map(x => [x.id, `${x.n} · ${fmt(somma(x.righe || []).k)} kcal`]);
  const settimana = `<section class="card"><div class="card-testa"><h2>Settimana dei pasti</h2><span class="gr">il turno è quello di questa settimana</span></div>
    <div class="sett7">${piano.map((p, i) => { const data = shiftDate(lun, i), tn = turnoDi(a, data, state.scheduleEntries, tz());
      return `<label class="${p.gt ? 'a' : ''}"><b>${NOMI_GIORNI[i]}</b><select data-pal-piano-gs="${GIORNI_SETT[i]}"><option value="">Nessuna</option>${opzioni.map(([k, n]) => `<option value="${esc(k)}" ${k === p.gt ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><em>${tn ? `<span class="pill ${PILL[tn] || 'p-x'}">${esc(tn === 'off' ? 'OFF' : shiftPresets[tn]?.label || 'Turno')}</span>` : 'turno —'}</em></label>`; }).join('')}</div></section>`;
  return `<div class="layout-schede">${elenco}<div class="pal-impila">${editor}${settimana}${cartaSpesa(a)}</div></div>`;
}
function cartaSpesa(a) {
  const scelti = a.settings?.spesaGiorni || GIORNI_SETT, presi = a.settings?.spesaPresi || {}, gruppi = spesa(a, scelti);
  const voci = gruppi.flatMap(g => g.voci), mancano = voci.filter(v => !presi[v.n]).length, pieni = new Set(pianoPasti(a).filter(p => p.gt).map(p => p.gs));
  return `<section class="card"><div class="card-testa"><h2>Lista della spesa</h2><span class="gr">${mancano} da comprare su ${voci.length}</span></div>
    <div class="barra-strumenti">${GIORNI_SETT.map((gs, i) => `<button class="chip ${scelti.includes(gs) ? 'on' : ''}" data-pal-spesa-gs="${gs}" ${pieni.has(gs) ? '' : 'disabled title="Nessuna giornata nel piano"'}>${NOMI_GIORNI[i]}</button>`).join('')}
      <span class="spazio"></span><button class="btn" data-pal-spesa-azzera>Azzera spunte</button><button class="btn" data-pal-csv-spesa>CSV</button><button class="btn" data-stampa>Stampa</button></div>
    <div class="contenuto">${gruppi.length ? gruppi.map(g => `<p class="pal-titoletto">${esc(g.cat)}</p>${g.voci.map(v => `<label class="spesa-r ${presi[v.n] ? 'preso' : ''}"><input type="checkbox" data-pal-preso="${esc(v.n)}" ${presi[v.n] ? 'checked' : ''}><span>${esc(v.n)}</span><b>${fmt(v.q)} g</b><small>${v.giorni.size} giorni</small></label>`).join('')}`).join('') : '<p class="subtext">Assegna le giornate ai giorni della settimana: qui compare quanto comprare.</p>'}</div></section>`;
}
function csvSpesa(a) {
  const scelti = a.settings?.spesaGiorni || GIORNI_SETT, presi = a.settings?.spesaPresi || {};
  scaricaCsv('lista-spesa.csv', [['Categoria', 'Alimento', 'Grammi', 'Giorni', 'Preso'], ...spesa(a, scelti).flatMap(g => g.voci.map(v => [g.cat, v.n, numeroCsv(v.q), v.giorni.size, presi[v.n] ? 'sì' : '']))]);
}

// ------------------------------------------------------------ Misure
function graficoPeso(lista, obiettivo) {
  const punti = lista.filter(m => Number(m.peso) > 0).slice(0, 20).reverse();
  if (punti.length < 2) return '<p class="subtext">Il grafico compare dalla seconda pesata.</p>';
  const valori = punti.map(m => Number(m.peso)), min = Math.min(...valori, obiettivo || Infinity) - 1, max = Math.max(...valori) + 1, W = 600, H = 160;
  const x = i => 20 + i * (W - 40) / (punti.length - 1), y = v => H - 20 - (v - min) / (max - min) * (H - 40);
  const linea = punti.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(m.peso)).toFixed(1)}`).join(' ');
  return `<svg class="pal-grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del peso">${obiettivo ? `<line x1="20" x2="${W - 20}" y1="${y(obiettivo)}" y2="${y(obiettivo)}" class="obiettivo"/><text x="${W - 22}" y="${y(obiettivo) - 6}" text-anchor="end" class="et">obiettivo ${fmt(obiettivo, 1)}</text>` : ''}
    <path d="${linea}" class="linea"/>${punti.map((m, i) => `<circle cx="${x(i)}" cy="${y(Number(m.peso))}" r="4" class="punto"><title>${giornoMese(m.d)}: ${fmt(m.peso, 1)} kg</title></circle>`).join('')}
    <text x="20" y="${H - 4}" class="et">${giornoMese(punti[0].d)}</text><text x="${W - 20}" y="${H - 4}" text-anchor="end" class="et">${giornoMese(punti[punti.length - 1].d)}</text></svg>`;
}
export function vistaMisure(a, d) {
  const lista = misure(a), p = cfg(a).profilo, peso = pesoAttuale(a), ult = k => lista.find(m => Number(m[k]) > 0);
  const giro = ult('giro'), mg = ult('mg'), oggiM = lista.find(m => m.d === d) || {};
  const bmi = peso && p.altezza ? peso.peso / (p.altezza / 100) ** 2 : null;
  return `<section class="kpi-lavoro">
    <div class="k t-corallo"><div class="etichetta">Peso</div><div class="num">${peso ? fmt(peso.peso, 1) + ' <small>kg</small>' : '—'}</div><div class="sotto">${peso ? `${peso.delta != null ? (peso.delta > 0 ? '+' : peso.delta < 0 ? '−' : '') + fmt(Math.abs(peso.delta), 1) + ' in 2 settimane · ' : ''}mancano ${fmt(Math.max(0, peso.peso - p.pesoObiettivo), 1)} kg` : 'nessuna pesata'}</div></div>
    <div class="k t-azzurro"><div class="etichetta">Giro vita</div><div class="num">${giro ? fmt(giro.giro, 1) + ' <small>cm</small>' : '—'}</div><div class="sotto">obiettivo ${fmt(p.giroObiettivo)} cm</div></div>
    <div class="k t-navy"><div class="etichetta">Massa grassa</div><div class="num">${mg ? fmt(mg.mg, 1) + ' <small>%</small>' : '—'}</div><div class="sotto">${mg ? 'del ' + esc(dataBreve(mg.d)) : 'facoltativa'}</div></div>
    <div class="k t-lilla"><div class="etichetta">Indice di massa corporea</div><div class="num">${bmi ? fmt(bmi, 1) : '—'}</div><div class="sotto">altezza ${fmt(p.altezza)} cm (in Obiettivi)</div></div>
  </section>
  <div class="griglia-lavoro"><div class="col"><section class="card"><div class="card-testa"><h2>Andamento del peso</h2></div><div class="contenuto">${graficoPeso(lista, p.pesoObiettivo)}</div></section>
    <section class="card"><div class="card-testa"><h2>Misure</h2><span class="spazio"></span><button class="btn" data-pal-csv-misure>CSV</button></div>
    <div class="table-wrap"><table class="dati"><thead><tr><th>Data</th><th class="n">Peso</th><th class="n">Variazione</th><th class="n">Giro vita</th><th class="n nasc">Massa grassa</th><th></th></tr></thead><tbody>
    ${lista.length ? lista.map((m, i) => { const prec = lista.slice(i + 1).find(x => Number(x.peso) > 0), dv = Number(m.peso) > 0 && prec ? Number(m.peso) - Number(prec.peso) : null;
      return `<tr data-pal-misura="${esc(m.d)}" tabindex="0" title="Modifica"><td>${esc(dataBreve(m.d))}</td><td class="n">${m.peso ? fmt(m.peso, 1) + ' kg' : '—'}</td><td class="n ${dv == null ? '' : dv > 0 ? 'negativo' : 'positivo'}">${dv == null ? '—' : (dv > 0 ? '+' : dv < 0 ? '−' : '') + fmt(Math.abs(dv), 1)}</td><td class="n">${m.giro ? fmt(m.giro, 1) + ' cm' : '—'}</td><td class="n nasc">${m.mg ? fmt(m.mg, 1) + ' %' : '—'}</td><td class="n"><button class="x" data-pal-elimina-misura="${esc(m.id)}" aria-label="Elimina">✕</button></td></tr>`; }).join('') : '<tr><td colspan="6" class="vuoto-tabella">Nessuna misura ancora.</td></tr>'}
    </tbody></table></div></section></div>
  <div class="col"><section class="card"><div class="card-testa"><h2>Nuova misura</h2></div><div class="contenuto">
    <form id="pal-misura" class="form-contratto"><fieldset><label class="field">Data<input name="d" type="date" value="${esc(d)}" max="${esc(oggi())}" required></label>
    <label class="field">Peso (kg)<input name="peso" type="number" inputmode="decimal" step="0.1" value="${esc(oggiM.peso ?? '')}"></label>
    <label class="field">Giro vita (cm)<input name="giro" type="number" inputmode="decimal" step="0.5" value="${esc(oggiM.giro ?? '')}"></label>
    <label class="field">Massa grassa (%)<input name="mg" type="number" inputmode="decimal" step="0.1" value="${esc(oggiM.mg ?? '')}"></label></fieldset>
    <p class="subtext piccolo">Una misura per giorno: se la data c'è già, la aggiorni. Meglio al mattino, a digiuno.</p>
    <div class="form-actions"><button class="btn primary" type="submit">Salva misura</button></div><p class="form-error" role="alert"></p></form></div></section></div></div>`;
}

// ------------------------------------------------------------ Report
export function vistaReport(a, d) {
  const t = cfg(a).target, sett = reportSettimane(a, lunediDi(d), settimaneReport), conDati = sett.filter(s => s.giorni);
  const media = k => conDati.length ? conDati.reduce((x, s) => x + s[k], 0) / conDati.length : null;
  const allen = sett.reduce((x, s) => x + s.allenamenti, 0), pesi = sett.filter(s => s.peso != null);
  const variazione = pesi.length > 1 ? pesi[0].peso - pesi[pesi.length - 1].peso : null;
  const maxK = Math.max(t.kcal, ...sett.map(s => s.kcal || 0));
  return `<section class="kpi-lavoro">
    <div class="k t-corallo"><div class="etichetta">Kcal medie al giorno</div><div class="num">${media('kcal') == null ? '—' : fmt(media('kcal'))}</div><div class="sotto">obiettivo ${fmt(t.kcal)} (turno) · ${fmt(t.kcalOff)} (OFF)</div></div>
    <div class="k t-azzurro"><div class="etichetta">Proteine medie</div><div class="num">${media('prot') == null ? '—' : fmt(media('prot')) + ' <small>g</small>'}</div><div class="sotto">obiettivo ${fmt(t.prot)} g</div></div>
    <div class="k t-navy"><div class="etichetta">Allenamenti</div><div class="num">${allen}</div><div class="sotto">${fmt(allen / settimaneReport, 1)} a settimana</div></div>
    <div class="k t-lilla"><div class="etichetta">Peso nel periodo</div><div class="num">${variazione == null ? '—' : (variazione > 0 ? '+' : variazione < 0 ? '−' : '') + fmt(Math.abs(variazione), 1) + ' <small>kg</small>'}</div><div class="sotto">${pesi.length ? 'ultimo ' + fmt(pesi[0].peso, 1) + ' kg' : 'nessuna pesata'}</div></div>
  </section>
  <section class="card"><div class="card-testa"><h2>Settimana per settimana</h2></div>
    <div class="barra-strumenti">${[[4, '4 settimane'], [8, '8 settimane'], [13, '3 mesi'], [26, '6 mesi']].map(([n, l]) => `<button class="chip ${n === settimaneReport ? 'on' : ''}" data-pal-report="${n}">${l}</button>`).join('')}<span class="spazio"></span><button class="btn" data-pal-csv-report>CSV</button><button class="btn" data-stampa>Stampa</button></div>
    <div class="contenuto"><div class="grafico-sim pal-report-grafico">${[...sett].reverse().map(s => `<div><b>${s.kcal == null ? '—' : fmt(s.kcal)}</b><i style="height:${s.kcal ? Math.max(4, Math.round(s.kcal / maxK * 90)) : 2}%;${s.kcal && s.kcal > t.kcal ? 'background:#B5412B' : ''}"></i>${esc(giornoMese(s.da))}</div>`).join('')}</div><p class="nota">Kcal medie al giorno, nei giorni con il diario compilato. In rosso le settimane sopra l'obiettivo dei giorni di turno.</p></div>
    <div class="table-wrap"><table class="dati"><thead><tr><th>Settimana</th><th class="n">Giorni scritti</th><th class="n">Kcal medie</th><th class="n">Proteine medie</th><th class="n">Allenamenti</th><th class="n nasc">Volume</th><th class="n">Peso</th></tr></thead><tbody>
    ${sett.map(s => `<tr class="${s.da > oggi() ? 'futuro' : ''}"><td>${esc(giornoMese(s.da))} – ${esc(giornoMese(s.al))}</td><td class="n">${s.giorni} / 7</td><td class="n">${s.kcal == null ? '—' : fmt(s.kcal)}</td><td class="n">${s.prot == null ? '—' : fmt(s.prot) + ' g'}</td><td class="n">${s.allenamenti}</td><td class="n nasc">${s.volume ? fmt(Math.round(s.volume)) + ' kg' : '—'}</td><td class="n">${s.peso == null ? '—' : fmt(s.peso, 1) + ' kg'}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}

// ------------------------------------------------------------ eventi
const prova = (fn, render, msg) => { try { const r = fn(); if (msg) toast(msg); render?.(); return r; } catch (e) { toast(e.message); } };
function modulo(titolo, campi, salva) {
  openModal(titolo, `<form id="pal-mod" class="form-contratto"><fieldset>${campi}</fieldset><div class="form-actions"><button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`);
  const f = document.getElementById('pal-mod');
  f.onsubmit = e => { e.preventDefault(); try { salva(Object.fromEntries(new FormData(f))); closeModal(); } catch (err) { f.querySelector('.form-error').textContent = err.message; } };
}
const campiGiornata = (n = '', tipo = '') => `<label class="field">Nome<input name="n" value="${esc(n)}" maxlength="80" required autofocus></label><label class="field">Per<select name="tipo">${Object.entries(TIPI).map(([k, l]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;

export function bindPiano(pagina, render, d, apriAggiungi) {
  const a = P.archivio(), su = (sel, fn) => pagina.querySelectorAll(sel).forEach(fn), g = giornataScelta;
  // Piano settimanale
  su('[data-pal-giornata]', b => b.onclick = () => { giornataScelta = b.dataset.palGiornata; render(); });
  su('[data-pal-nuova-giornata]', b => b.onclick = () => modulo('Nuova giornata', campiGiornata(), v => { giornataScelta = P.creaGiornata(v.n, v.tipo).id; render(); }));
  su('[data-pal-da-diario]', b => b.onclick = () => modulo('Giornata dal diario', campiGiornata(`Giornata del ${dataBreve(d)}`), v => { const x = P.giornataDalDiario(d, v.n); P.rinominaGiornata(x.id, v.n, v.tipo); giornataScelta = x.id; render(); }));
  const x = di(a, 'gt').find(y => y.id === g);
  su('[data-pal-rinomina-giornata]', b => b.onclick = () => modulo('Rinomina giornata', campiGiornata(x?.n, x?.tipo), v => { P.rinominaGiornata(g, v.n, v.tipo); render(); }));
  su('[data-pal-duplica-giornata]', b => b.onclick = () => prova(() => { giornataScelta = P.duplicaGiornata(g).id; }, render, 'Giornata duplicata'));
  su('[data-pal-elimina-giornata]', b => b.onclick = () => confirmDelete(`Eliminare la giornata "${x?.n}"? Il diario già scritto non cambia; i giorni della settimana che la usavano restano senza giornata.`, async () => { P.eliminaGiornata(g); giornataScelta = ''; render(); }));
  su('[data-pal-agg-giornata]', b => b.onclick = () => apriAggiungi(d, b.dataset.palAggGiornata, null, { gt: g, nome: x?.n }));
  su('[data-pal-riga-gt]', i => i.onchange = () => prova(() => P.modificaRigaGiornata(g, Number(i.dataset.palRigaGt), { q: i.value }), render));
  su('[data-pal-togli-gt]', b => b.onclick = () => prova(() => P.togliRigaGiornata(g, Number(b.dataset.palTogliGt)), render));
  su('[data-pal-piano-gs]', s => s.onchange = () => prova(() => P.impostaPianoGiorno(s.dataset.palPianoGs, s.value), render));
  su('[data-pal-spesa-gs]', b => b.onclick = () => { const scelti = a.settings?.spesaGiorni || GIORNI_SETT, gs = b.dataset.palSpesaGs; prova(() => P.impostaGiorniSpesa(scelti.includes(gs) ? scelti.filter(x => x !== gs) : [...scelti, gs]), render); });
  su('[data-pal-preso]', c => c.onchange = () => prova(() => P.segnaPreso(c.dataset.palPreso, c.checked), render));
  su('[data-pal-spesa-azzera]', b => b.onclick = () => prova(() => P.azzeraSpesa(), render));
  su('[data-pal-csv-spesa]', b => b.onclick = () => csvSpesa(a));
  // Misure
  const fm = pagina.querySelector('#pal-misura');
  if (fm) fm.onsubmit = e => { e.preventDefault(); try { P.salvaMisura(Object.fromEntries(new FormData(fm))); toast('Misura salvata'); render(); } catch (err) { fm.querySelector('.form-error').textContent = err.message; } };
  su('[data-pal-misura]', r => { const apri = e => { if (e.target.closest('button')) return; const m = misure(a).find(y => y.d === r.dataset.palMisura); if (!fm || !m) return; fm.elements.d.value = m.d; for (const k of ['peso', 'giro', 'mg']) fm.elements[k].value = m[k] ?? ''; fm.scrollIntoView({ behavior: 'smooth', block: 'center' }); fm.elements.peso.focus(); }; r.onclick = apri; r.onkeydown = e => { if (e.key === 'Enter') apri(e); }; });
  su('[data-pal-elimina-misura]', b => b.onclick = () => confirmDelete('Eliminare questa misura?', async () => { P.eliminaMisura(b.dataset.palEliminaMisura); render(); }));
  su('[data-pal-csv-misure]', b => b.onclick = () => scaricaCsv('misure.csv', [['Data', 'Peso kg', 'Giro vita cm', 'Massa grassa %'], ...misure(a).map(m => [m.d, numeroCsv(m.peso ?? ''), numeroCsv(m.giro ?? ''), numeroCsv(m.mg ?? '')])]));
  // Report
  su('[data-pal-report]', b => b.onclick = () => { settimaneReport = Number(b.dataset.palReport); render(); });
  su('[data-pal-csv-report]', b => b.onclick = () => scaricaCsv('report-settimane.csv', [['Dal', 'Al', 'Giorni scritti', 'Kcal medie', 'Proteine medie g', 'Allenamenti', 'Volume kg', 'Peso kg'], ...reportSettimane(a, lunediDi(d), settimaneReport).map(s => [s.da, s.al, s.giorni, numeroCsv(s.kcal ?? ''), numeroCsv(s.prot ?? ''), s.allenamenti, numeroCsv(s.volume), numeroCsv(s.peso ?? '')])]));
}
