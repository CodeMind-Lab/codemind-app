// Scritture della sezione Palestra e alimentazione. Tutto vive nell'archivio di Forma
// (tabella forma_archives), così i dati restano compatibili con la vecchia app.
//
// Ogni modifica si vede subito: si applica a una copia locale dell'archivio e si salva
// poco dopo, una volta sola anche per tanti tocchi di fila (+250 ml, +250 ml…).
// Se il salvataggio non riesce (offline, conflitto) la copia resta sul dispositivo,
// in attesa, e si riprova quando torna la rete.
import { state } from './store.js?v=65';
import { formaModel, saveForma, pendingForma, scartaPendingForma } from './formaService.js?v=65';
import { righePiano, di, TARGET_DEFAULT, PROFILO_DEFAULT, CATEGORIE, PASTI, codiceValido, gruppoDi, isCardio, ripNumero, GIORNI_SETT } from '../utils/palestra.js?v=73';

let locale = null, versione = 0, timer = null, inCorso = null;
export const statoSalvataggio = { stato: 'salvato', messaggio: '' };

const avvisa = (stato, messaggio = '') => {
  Object.assign(statoSalvataggio, { stato, messaggio });
  globalThis.window?.dispatchEvent(new CustomEvent('cm:palestra-stato', { detail: { stato, messaggio } }));
};
const idNuovo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// L'archivio da mostrare: le modifiche locali, oppure quelle rimaste in attesa da una
// sessione precedente, oppure quello salvato nel cloud.
export function archivio() {
  const server = state.formaArchive;
  if (!server) return null;
  if (locale) return locale;
  const p = pendingForma();
  if (p && p.source_id === server.source_id) {
    try { return formaModel.merge(p.base, p.archive, server.archive); } catch { return formaModel.normalize(p.archive); }
  }
  return server.archive;
}
export const inAttesa = () => !!locale || !!(pendingForma() && pendingForma().source_id === state.formaArchive?.source_id);
export function dimenticaLocale() { locale = null; versione = 0; clearTimeout(timer); avvisa('salvato'); }

function modifica(fn) {
  if (state.mode === 'signed_out') throw Error('Accedi prima di salvare.');
  const attuale = archivio();
  if (!attuale) throw Error('Carica prima il backup di Forma oppure parti da zero.');
  const nuovo = structuredClone(attuale), ora = Date.now();
  const risultato = fn(nuovo, ora);
  locale = formaModel.normalize(nuovo);
  versione++;
  avvisa('in-attesa');
  clearTimeout(timer);
  timer = setTimeout(() => { salva().catch(() => {}); }, 450);
  return risultato;
}

// Salva subito la copia locale. Restituisce l'archivio salvato.
export async function salva() {
  clearTimeout(timer);
  if (inCorso) { await inCorso.catch(() => {}); }
  const server = state.formaArchive;
  if (!server) return null;
  if (!locale) {
    const p = pendingForma();
    if (!p || p.source_id !== server.source_id) return server;
    locale = archivio();
  }
  const inviata = versione, copia = locale;
  avvisa('in-corso');
  // La base è l'ultima versione salvata: così il confronto a tre vie prende tutte le
  // modifiche fatte qui, anche quelle di un salvataggio precedente non riuscito.
  inCorso = saveForma(copia, server.archive, server.source_id);
  try {
    const salvato = await inCorso;
    if (versione === inviata) { locale = null; avvisa('salvato'); }
    else { avvisa('in-attesa'); timer = setTimeout(() => { salva().catch(() => {}); }, 300); }
    return salvato;
  } catch (e) {
    avvisa('errore', e.message);
    throw e;
  } finally { inCorso = null; }
}
// Lascia perdere le modifiche non salvate e torna all'archivio del cloud.
export function scarta() { scartaPendingForma(); dimenticaLocale(); }

globalThis.window?.addEventListener('online', () => { if (inAttesa()) salva().catch(() => {}); });

// ------------------------------------------------------------ controlli
const numero = (v, min, max, cosa) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw Error(`Controlla ${cosa}: un numero da ${min} a ${max}.`);
  return Math.round(n * 10) / 10;
};
const data = d => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw Error('Data non valida.'); return d; };
const pasto = s => { if (!PASTI.some(p => p.id === s)) throw Error('Scegli il pasto.'); return s; };
function valori100(x) {
  const n = String(x.n || '').trim().slice(0, 120);
  if (!n) throw Error("Scrivi il nome dell'alimento.");
  return { n, k: numero(x.k, 0, 900, 'le kcal per 100 g'), p: numero(x.p, 0, 100, 'le proteine'), c: numero(x.c, 0, 100, 'i carboidrati'), g: numero(x.g, 0, 100, 'i grassi') };
}

// Il giorno (acqua, passi, turno) esiste come riga solo quando ci scrivi qualcosa.
function giornoIn(a, d, ora) {
  let g = a.items.find(i => i.t === 'g' && i.d === d);
  if (!g) { g = { id: 'g-' + d, t: 'g', d, acqua: 0, passi: 0 }; a.items.push(g); delete a.graves[g.id]; }
  g.updatedAt = ora;
  return g;
}
function togli(a, id, ora) {
  const i = a.items.findIndex(x => x.id === id);
  if (i >= 0) { a.items.splice(i, 1); a.graves[id] = ora; }
}
const nuovaRiga = (d, slot, x, q, ora) => ({ id: idNuovo(), t: 'l', d, slot, n: x.n, q, k: x.k, p: x.p, c: x.c, g: x.g, updatedAt: ora });

// ------------------------------------------------------------ diario dei pasti
export function aggiungiRiga(d, slot, alimento, grammi) {
  const v = valori100(alimento), q = numero(grammi, 1, 5000, 'i grammi');
  data(d); pasto(slot);
  return modifica((a, ora) => { const r = nuovaRiga(d, slot, v, q, ora); a.items.push(r); return r; });
}
export function modificaRiga(id, campi) {
  return modifica((a, ora) => {
    const r = a.items.find(x => x.id === id && x.t === 'l');
    if (!r) throw Error('Voce del diario non trovata.');
    if (campi.q != null) r.q = numero(campi.q, 1, 5000, 'i grammi');
    if (campi.slot) r.slot = pasto(campi.slot);
    r.updatedAt = ora;
  });
}
export const eliminaRiga = id => modifica((a, ora) => togli(a, id, ora));
export function aggiungiRicetta(d, slot, ricetta) {
  data(d); pasto(slot);
  const righe = (ricetta.righe || []).map(r => ({ ...valori100(r), q: numero(r.q, 1, 5000, 'i grammi') }));
  if (!righe.length) throw Error('La ricetta è vuota.');
  return modifica((a, ora) => { for (const r of righe) a.items.push(nuovaRiga(d, slot, r, r.q, ora)); return righe.length; });
}
// Un pasto dal piano: sostituisce quello già scritto (un doppio tocco non conta due volte).
export function applicaPasto(arch, d, slot) {
  const piano = righePiano(arch, d, slot);
  if (!piano.length) throw Error('Il piano non prevede niente per questo pasto.');
  return modifica((a, ora) => {
    for (const r of a.items.filter(x => x.t === 'l' && x.d === d && x.slot === slot)) togli(a, r.id, ora);
    for (const r of piano) a.items.push(nuovaRiga(d, slot, r, Number(r.q) || 0, ora));
    const g = giornoIn(a, d, ora);
    g.pasti = [...new Set([...(g.pasti || []), slot])];
    return piano.length;
  });
}
// Tutta la giornata dal piano: sostituisce le voci del giorno (la conferma la chiede la pagina).
export function applicaPiano(arch, d) {
  const piano = righePiano(arch, d);
  if (!piano.length) throw Error('Questo giorno della settimana non ha una giornata nel piano.');
  return modifica((a, ora) => {
    for (const r of a.items.filter(x => x.t === 'l' && x.d === d)) togli(a, r.id, ora);
    for (const r of piano) a.items.push(nuovaRiga(d, r.slot, r, Number(r.q) || 0, ora));
    return piano.length;
  });
}

// ------------------------------------------------------------ acqua e passi
export function cambiaAcqua(d, delta) {
  data(d);
  return modifica((a, ora) => { const g = giornoIn(a, d, ora); g.acqua = Math.max(0, Math.min(10000, (Number(g.acqua) || 0) + Number(delta))); return g.acqua; });
}
export function impostaPassi(d, passi) {
  data(d); const n = Math.round(numero(passi, 0, 100000, 'i passi'));
  return modifica((a, ora) => { giornoIn(a, d, ora).passi = n; return n; });
}

// ------------------------------------------------------------ obiettivi e alimenti
export function salvaObiettivi(v) {
  const target = {
    kcal: numero(v.kcal, 800, 6000, 'le kcal dei giorni di turno'), kcalOff: numero(v.kcalOff, 800, 6000, 'le kcal dei giorni OFF'),
    prot: numero(v.prot, 0, 500, 'le proteine'), carb: numero(v.carb, 0, 1000, 'i carboidrati'), gras: numero(v.gras, 0, 400, 'i grassi'),
    acqua: numero(v.acqua, 0, 10000, "l'acqua"), passi: numero(v.passi, 0, 100000, 'i passi'), olio: numero(v.olio, 0, 200, "l'olio"),
  };
  const profilo = { nome: String(v.nome || '').trim().slice(0, 60), altezza: numero(v.altezza, 100, 250, "l'altezza"), pesoObiettivo: numero(v.pesoObiettivo, 30, 300, 'il peso obiettivo'), giroObiettivo: numero(v.giroObiettivo, 40, 200, 'il giro vita obiettivo') };
  return modifica((a, ora) => {
    let c = a.items.find(i => i.t === 'cfg');
    if (!c) { c = { id: 'cfg', t: 'cfg', target: { ...TARGET_DEFAULT }, profilo: { ...PROFILO_DEFAULT } }; a.items.push(c); }
    c.target = { ...(c.target || {}), ...target }; c.profilo = { ...(c.profilo || {}), ...profilo }; c.updatedAt = ora;
  });
}
export function salvaAlimento(v, esistente) {
  const base = valori100(v), cat = CATEGORIE.includes(v.cat) ? v.cat : 'Altro', ean = String(v.ean || '').trim();
  if (ean && !codiceValido(ean)) throw Error('Il codice a barre deve avere 8, 12, 13 o 14 cifre.');
  return modifica((a, ora) => {
    if (a.items.some(x => x.t === 'a' && x.id !== esistente?.id && x.n.toLowerCase() === base.n.toLowerCase())) throw Error('Hai già un alimento con questo nome.');
    if (ean && a.items.some(x => x.t === 'a' && x.id !== esistente?.id && x.ean === ean)) throw Error('Questo codice a barre è già tra i tuoi alimenti.');
    const dati = { ...base, cat, nt: String(v.nt || '').trim().slice(0, 120), ...(ean ? { ean } : {}), updatedAt: ora };
    const it = esistente && a.items.find(x => x.id === esistente.id && x.t === 'a');
    if (it) { Object.assign(it, dati); if (!ean) delete it.ean; return it; }
    const nuovo = { id: idNuovo(), t: 'a', ...dati };
    a.items.push(nuovo);
    return nuovo;
  });
}
export const eliminaAlimento = id => modifica((a, ora) => togli(a, id, ora));
export const alimentoDaCodice = (a, codice) => di(a, 'a').find(x => x.ean === codice) || null;

// ------------------------------------------------------------ primo avvio
export async function creaArchivio() {
  if (state.formaArchive) throw Error("L'archivio esiste già.");
  return saveForma({ version: 1, items: [{ id: 'cfg', t: 'cfg', target: { ...TARGET_DEFAULT }, profilo: { ...PROFILO_DEFAULT }, updatedAt: Date.now() }], settings: { recDefault: 90 }, graves: {} }, null, crypto.randomUUID());
}
// Il backup JSON esportato dalla Forma dell'iPhone (Impostazioni → Esporta).
export async function caricaBackup(testo) {
  let dati;
  try { dati = JSON.parse(testo); } catch { throw Error('Il file non è un JSON valido.'); }
  if (dati?.app !== 'forma' || !Array.isArray(dati.items)) throw Error('Il file non è un backup di Forma.');
  return saveForma({ version: 1, items: dati.items, settings: { recDefault: 90, ...(dati.settings || {}) }, graves: {} }, null, crypto.randomUUID());
}

// ------------------------------------------------------------ allenamenti (t:'w')
const testoBreve = (v, max, cosa) => { const t = String(v ?? '').trim().slice(0, max); if (!t) throw Error(`Scrivi ${cosa}.`); return t; };
const valoreLibero = v => { const t = String(v ?? '').trim().replace(',', '.'); if (t === '') return ''; const n = Number(t); if (!Number.isFinite(n) || n < 0 || n > 10000) throw Error('Controlla il numero.'); return n; };
const recDi = a => Number(a.settings?.recDefault) || 90;
function sessioneIn(a, id) { const w = a.items.find(x => x.id === id && x.t === 'w'); if (!w) throw Error('Allenamento non trovato.'); return w; }
const serieVuote = (n, rip, peso) => Array.from({ length: Math.max(1, Math.min(20, Number(n) || 3)) }, () => ({ r: ripNumero(rip), w: peso ?? '', ok: false }));
function esercizioSessione(e, rec) {
  const cardio = isCardio(e);
  return { n: e.n, gruppo: e.gruppo || gruppoDi(e.n), rip: e.rip ?? '', peso: e.peso ?? '', rec: e.rec || rec, cardio, note: e.note || '',
    ...(cardio ? { min: e.min || ripNumero(e.rip) || '', km: '', sets: [] } : { sets: serieVuote(e.serie, e.rip, e.peso) }) };
}
// Parte da un giorno di una scheda; senza scheda è un allenamento libero.
export function avviaAllenamento(d, sid, gn) {
  data(d);
  return modifica((a, ora) => {
    const s = sid ? a.items.find(x => x.id === sid && x.t === 's') : null;
    const g = s ? (s.giorni || []).find(x => x.n === gn) : null;
    if (sid && !g) throw Error('Giorno della scheda non trovato.');
    const w = { id: idNuovo(), t: 'w', d, sid: s?.id || '', sn: s?.n || '', gn: g?.n || 'Allenamento libero', eser: (g?.eser || []).map(e => esercizioSessione(e, recDi(a))), fine: false, inizio: ora, updatedAt: ora };
    a.items.push(w);
    return w;
  });
}
export function aggiornaSerie(wid, ei, si, campi) {
  return modifica((a, ora) => {
    const w = sessioneIn(a, wid), s = w.eser?.[ei]?.sets?.[si];
    if (!s) throw Error('Serie non trovata.');
    if ('r' in campi) s.r = valoreLibero(campi.r);
    if ('w' in campi) s.w = valoreLibero(campi.w);
    if ('ok' in campi) s.ok = !!campi.ok;
    w.updatedAt = ora;
    return s;
  });
}
export function aggiungiSerie(wid, ei) {
  return modifica((a, ora) => {
    const w = sessioneIn(a, wid), e = w.eser?.[ei];
    if (!e) throw Error('Esercizio non trovato.');
    const ult = e.sets?.[e.sets.length - 1];
    e.sets = [...(e.sets || []), { r: ult?.r ?? ripNumero(e.rip), w: ult?.w ?? e.peso ?? '', ok: false }];
    w.updatedAt = ora;
  });
}
export function togliSerie(wid, ei, si) {
  return modifica((a, ora) => { const w = sessioneIn(a, wid), e = w.eser?.[ei]; if (!e?.sets?.[si]) throw Error('Serie non trovata.'); e.sets.splice(si, 1); w.updatedAt = ora; });
}
export function aggiornaCardio(wid, ei, campi) {
  return modifica((a, ora) => { const w = sessioneIn(a, wid), e = w.eser?.[ei]; if (!e) throw Error('Esercizio non trovato.'); if ('min' in campi) e.min = valoreLibero(campi.min); if ('km' in campi) e.km = valoreLibero(campi.km); w.updatedAt = ora; });
}
export function aggiungiEsercizioSessione(wid, nome) {
  const n = testoBreve(nome, 120, "il nome dell'esercizio");
  return modifica((a, ora) => { const w = sessioneIn(a, wid); w.eser = [...(w.eser || []), esercizioSessione({ n, serie: 3, rip: 10 }, recDi(a))]; w.updatedAt = ora; });
}
export function togliEsercizioSessione(wid, ei) {
  return modifica((a, ora) => { const w = sessioneIn(a, wid); w.eser.splice(ei, 1); w.updatedAt = ora; });
}
// La durata la dà l'orologio; sopra le 5 ore è una sessione dimenticata aperta, non una durata.
export function terminaSessione(wid) {
  return modifica((a, ora) => {
    const w = sessioneIn(a, wid);
    w.fine = true;
    if (w.inizio && !w.dur) { const m = Math.round((ora - Number(w.inizio)) / 60000); if (m > 0 && m <= 300) w.dur = m; }
    w.updatedAt = ora;
    return w;
  });
}
export const riapriSessione = wid => modifica((a, ora) => { const w = sessioneIn(a, wid); w.fine = false; w.updatedAt = ora; });
export function impostaDurata(wid, minuti) {
  const m = Math.round(numero(minuti, 0, 300, 'i minuti'));
  return modifica((a, ora) => { const w = sessioneIn(a, wid); w.dur = m; w.updatedAt = ora; });
}
export const eliminaSessione = wid => modifica((a, ora) => togli(a, wid, ora));

// ------------------------------------------------------------ schede (t:'s')
function schedaIn(a, sid) { const s = a.items.find(x => x.id === sid && x.t === 's'); if (!s) throw Error('Scheda non trovata.'); s.giorni = s.giorni || []; return s; }
function giornoScheda(s, gi) { const g = s.giorni[gi]; if (!g) throw Error('Giorno non trovato.'); g.eser = g.eser || []; return g; }
export function creaScheda(nome) {
  const n = testoBreve(nome, 80, 'il nome della scheda');
  return modifica((a, ora) => { const s = { id: idNuovo(), t: 's', n, giorni: [{ n: 'Giorno 1', eser: [] }], updatedAt: ora }; a.items.push(s); return s; });
}
export function rinominaScheda(sid, nome) {
  const n = testoBreve(nome, 80, 'il nome della scheda');
  return modifica((a, ora) => { const s = schedaIn(a, sid); s.n = n; s.updatedAt = ora; for (const w of a.items.filter(x => x.t === 'w' && x.sid === sid && !x.fine)) { w.sn = n; w.updatedAt = ora; } });
}
export function duplicaScheda(sid) {
  return modifica((a, ora) => { const s = schedaIn(a, sid), c = { ...structuredClone(s), id: idNuovo(), n: (s.n + ' (copia)').slice(0, 80), updatedAt: ora }; a.items.push(c); return c; });
}
// Il piano della settimana che puntava alla scheda torna a "riposo"; le sessioni fatte restano.
export function eliminaScheda(sid) {
  return modifica((a, ora) => { togli(a, sid, ora); for (const p of a.items.filter(x => x.t === 'pa' && x.sid === sid)) { p.sid = ''; p.gn = ''; p.updatedAt = ora; } });
}
export function aggiungiGiorno(sid, nome) {
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), n = String(nome || '').trim().slice(0, 60) || `Giorno ${s.giorni.length + 1}`;
    if (s.giorni.some(g => g.n === n)) throw Error('Questa scheda ha già un giorno con questo nome.');
    s.giorni.push({ n, eser: [] }); s.updatedAt = ora; return s.giorni.length - 1;
  });
}
export function rinominaGiorno(sid, gi, nome) {
  const n = testoBreve(nome, 60, 'il nome del giorno');
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), g = giornoScheda(s, gi), vecchio = g.n;
    if (s.giorni.some((x, i) => i !== gi && x.n === n)) throw Error('Questa scheda ha già un giorno con questo nome.');
    g.n = n; s.updatedAt = ora;
    for (const p of a.items.filter(x => x.t === 'pa' && x.sid === sid && x.gn === vecchio)) { p.gn = n; p.updatedAt = ora; }
  });
}
export function eliminaGiorno(sid, gi) {
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), g = giornoScheda(s, gi);
    s.giorni.splice(gi, 1); s.updatedAt = ora;
    for (const p of a.items.filter(x => x.t === 'pa' && x.sid === sid && x.gn === g.n)) { p.sid = ''; p.gn = ''; p.updatedAt = ora; }
  });
}
export function aggiungiEsercizio(sid, gi, nome) {
  const n = testoBreve(nome, 120, "il nome dell'esercizio");
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), g = giornoScheda(s, gi), gruppo = gruppoDi(n);
    g.eser.push(isCardio({ n, gruppo }) ? { n, gruppo, cardio: true, min: 30, km: '' } : { n, gruppo, serie: 3, rip: 10, peso: '', rec: recDi(a) });
    s.updatedAt = ora;
  });
}
export function aggiornaEsercizio(sid, gi, ei, campi) {
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), e = giornoScheda(s, gi).eser[ei];
    if (!e) throw Error('Esercizio non trovato.');
    if ('n' in campi) { e.n = testoBreve(campi.n, 120, "il nome dell'esercizio"); e.gruppo = gruppoDi(e.n); }
    if ('serie' in campi) e.serie = Math.round(numero(campi.serie, 1, 20, 'le serie'));
    if ('rip' in campi) e.rip = String(campi.rip ?? '').trim().slice(0, 20);
    if ('peso' in campi) e.peso = valoreLibero(campi.peso);
    if ('rec' in campi) e.rec = String(campi.rec).trim() === '' ? '' : Math.round(numero(campi.rec, 0, 900, 'il recupero (secondi)'));
    if ('min' in campi) e.min = valoreLibero(campi.min);
    if ('note' in campi) e.note = String(campi.note ?? '').trim().slice(0, 200);
    s.updatedAt = ora;
  });
}
export function spostaEsercizio(sid, gi, ei, verso) {
  return modifica((a, ora) => {
    const s = schedaIn(a, sid), l = giornoScheda(s, gi).eser, j = ei + verso;
    if (j < 0 || j >= l.length) return;
    [l[ei], l[j]] = [l[j], l[ei]]; s.updatedAt = ora;
  });
}
export const togliEsercizio = (sid, gi, ei) => modifica((a, ora) => { const s = schedaIn(a, sid); giornoScheda(s, gi).eser.splice(ei, 1); s.updatedAt = ora; });

// ------------------------------------------------------------ settimana di allenamento (t:'pa')
export function impostaGiornoSettimana(gs, sid, gn) {
  if (!GIORNI_SETT.includes(gs)) throw Error('Giorno della settimana non valido.');
  return modifica((a, ora) => {
    if (sid) { const s = schedaIn(a, sid); if (!s.giorni.some(g => g.n === gn)) throw Error('Giorno della scheda non trovato.'); }
    let p = a.items.find(x => x.t === 'pa' && x.gs === gs);
    if (!p) { p = { id: 'allena-' + gs, t: 'pa', gs }; a.items.push(p); delete a.graves[p.id]; }
    p.sid = sid || ''; p.gn = sid ? gn : ''; p.updatedAt = ora;
  });
}
