// Scritture della sezione Palestra e alimentazione. Tutto vive nell'archivio di Forma
// (tabella forma_archives), così i dati restano compatibili con la vecchia app.
//
// Ogni modifica si vede subito: si applica a una copia locale dell'archivio e si salva
// poco dopo, una volta sola anche per tanti tocchi di fila (+250 ml, +250 ml…).
// Se il salvataggio non riesce (offline, conflitto) la copia resta sul dispositivo,
// in attesa, e si riprova quando torna la rete.
import { state } from './store.js?v=65';
import { formaModel, saveForma, pendingForma, scartaPendingForma } from './formaService.js?v=65';
import { righePiano, di, TARGET_DEFAULT, PROFILO_DEFAULT, CATEGORIE, PASTI, codiceValido } from '../utils/palestra.js?v=73';

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
