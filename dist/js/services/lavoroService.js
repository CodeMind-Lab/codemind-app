// Dati di Lavoro Hotel e Lavoro Sviluppo (migrazione 013).
// Stessa logica degli altri servizi: in cloud si scrive su Supabase e si controlla che
// la riga non sia cambiata nel frattempo da un altro dispositivo (updated_at); fuori
// dal cloud (solo i test) si aggiorna la memoria della pagina.
import { state } from './store.js?v=65';
import { getClient, unwrap, readAll } from './supabase.js?v=65';
import { uid } from '../utils/helpers.js?v=65';

// tabella → chiave in state
const raccolte = {
  hotel_assenze: 'hotelAssenze', hotel_buste_paga: 'bustePaga', clienti: 'clienti',
  preventivi: 'preventivi', incassi: 'incassi', formazione: 'formazione',
};
export const TIPI_ASSENZA = { ferie: 'Ferie', permesso: 'Permesso', malattia: 'Malattia', altro: 'Altro' };
export const STATI_PREVENTIVO = { bozza: 'Bozza', inviato: 'Inviato', accettato: 'Accettato', rifiutato: 'Rifiutato' };
export const TIPI_FORMAZIONE = { corso: 'Corso', video: 'Video', libro: 'Libro', articolo: 'Articolo', documentazione: 'Documentazione', altro: 'Altro' };
export const STATI_FORMAZIONE = { da_fare: 'Da fare', in_corso: 'In corso', finito: 'Finito' };

export function clearLavoro() {
  Object.assign(state, { hotelContratto: null, hotelAssenze: [], bustePaga: [], clienti: [], preventivi: [], incassi: [], formazione: [], lavoroError: '' });
}
clearLavoro();

export async function loadLavoro() {
  try {
    const [contratti, assenze, buste, clienti, preventivi, incassi, formazione] = await Promise.all(
      ['hotel_contratto', 'hotel_assenze', 'hotel_buste_paga', 'clienti', 'preventivi', 'incassi', 'formazione'].map(t => readAll(t)));
    Object.assign(state, { hotelContratto: contratti[0] || null, hotelAssenze: assenze, bustePaga: buste, clienti, preventivi, incassi, formazione, lavoroError: '' });
  } catch (error) {
    clearLavoro();
    // Prima della migrazione 013 le tabelle non esistono: il resto dell'app deve funzionare lo stesso.
    state.lavoroError = 'Le sezioni Lavoro non sono ancora pronte nel database (manca la migrazione 013).';
  }
}

function scrivibile() {
  if (state.mode === 'signed_out') throw Error('Accedi prima di salvare.');
  if (state.mode === 'cloud' && !navigator.onLine) throw Error('Sei offline: riconnettiti per salvare.');
  if (state.mode === 'cloud' && state.lavoroError) throw Error(state.lavoroError);
}

async function scrivi(tabella, valori, esistente) {
  scrivibile();
  let riga;
  if (state.mode === 'cloud') {
    const c = await getClient();
    const query = esistente
      ? c.from(tabella).update(valori).eq('id', esistente.id).eq('updated_at', esistente.updated_at).select()
      : c.from(tabella).insert({ ...valori, user_id: state.user.id }).select();
    const dati = unwrap(await query);
    if (!dati.length) throw Error('Questo dato è cambiato su un altro dispositivo. Aggiorna la pagina e riprova.');
    riga = dati[0];
  } else {
    const ora = new Date().toISOString();
    riga = { ...esistente, ...valori, id: esistente?.id || uid(), created_at: esistente?.created_at || ora, updated_at: ora };
  }
  if (tabella === 'hotel_contratto') state.hotelContratto = riga;
  else { const k = raccolte[tabella]; state[k] = [...state[k].filter(x => x.id !== riga.id), riga]; }
  return riga;
}

export async function elimina(tabella, riga) {
  scrivibile();
  if (state.mode === 'cloud') unwrap(await (await getClient()).from(tabella).delete().eq('id', riga.id));
  const k = raccolte[tabella];
  state[k] = state[k].filter(x => x.id !== riga.id);
  // Gli incassi seguono il loro preventivo, come fa il database.
  if (tabella === 'preventivi') state.incassi = state.incassi.filter(i => i.preventivo_id !== riga.id);
  if (tabella === 'clienti') {
    const via = new Set(state.preventivi.filter(p => p.cliente_id === riga.id).map(p => p.id));
    state.preventivi = state.preventivi.filter(p => !via.has(p.id));
    state.incassi = state.incassi.filter(i => !via.has(i.preventivo_id));
    state.projects = state.projects.map(p => p.cliente_id === riga.id ? { ...p, cliente_id: null } : p);
  }
}

// ---------------- controlli comuni ----------------
const testo = (v, max, nome) => { const s = String(v ?? '').trim(); if (s.length > max) throw Error(`${nome}: massimo ${max} caratteri.`); return s; };
const obbligatorio = (v, max, nome) => { const s = testo(v, max, nome); if (!s) throw Error(`Scrivi ${nome.toLowerCase()}.`); return s; };
function numero(v, { min = 0, max = 1e9, nome = 'Il valore', vuoto = false } = {}) {
  if ((v === '' || v === null || v === undefined) && vuoto) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw Error(`Controlla ${nome[0].toLowerCase() + nome.slice(1)}: deve essere un numero tra ${min} e ${max}.`);
  return Math.round(n * 100) / 100;
}
const data = (v, nome = 'La data') => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '') || Number.isNaN(Date.parse(v + 'T12:00:00Z'))) throw Error(`${nome} non è valida.`); return v; };
const ora = v => { if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v || '')) throw Error('Orario non valido.'); return v.slice(0, 5); };

// ---------------- Hotel ----------------
export function saveContratto(v) {
  const extra = (v.mensilita_extra || []).map(m => ({ mese: numero(m.mese, { min: 1, max: 12, nome: 'Il mese della mensilità' }), nome: obbligatorio(m.nome, 20, 'Il nome della mensilità') }));
  return scrivi('hotel_contratto', {
    netto_mensile: numero(v.netto_mensile, { max: 100000, nome: 'Il netto mensile', vuoto: true }),
    lordo_mensile: numero(v.lordo_mensile, { max: 100000, nome: 'Il lordo mensile', vuoto: true }),
    mensilita_extra: extra,
    ore_giornaliere: numero(v.ore_giornaliere ?? 8, { min: 0.5, max: 24, nome: 'Le ore al giorno' }),
    ore_settimanali: numero(v.ore_settimanali ?? 40, { min: 1, max: 84, nome: 'Le ore a settimana' }),
    notte_inizio: ora(v.notte_inizio || '22:00'), notte_fine: ora(v.notte_fine || '06:00'),
    ferie_giorni_anno: numero(v.ferie_giorni_anno, { max: 60, nome: 'I giorni di ferie', vuoto: true }),
    permessi_ore_anno: numero(v.permessi_ore_anno, { max: 500, nome: 'Le ore di permesso', vuoto: true }),
    ferie_saldo_iniziale: numero(v.ferie_saldo_iniziale || 0, { min: -60, max: 200, nome: 'Il saldo ferie' }),
    permessi_saldo_iniziale: numero(v.permessi_saldo_iniziale || 0, { min: -500, max: 1000, nome: 'Il saldo permessi' }),
    anno_saldo: numero(v.anno_saldo || new Date().getFullYear(), { min: 2000, max: 2100, nome: "L'anno del saldo" }),
    note: testo(v.note, 5000, 'Le note'),
  }, state.hotelContratto);
}
export function saveAssenza(v, esistente) {
  if (!TIPI_ASSENZA[v.tipo]) throw Error('Scegli il tipo di assenza.');
  const ore = v.tipo === 'permesso' ? numero(v.ore, { min: 0.25, max: 24, nome: 'Le ore di permesso' }) : numero(v.ore, { min: 0.25, max: 24, nome: 'Le ore', vuoto: true });
  return scrivi('hotel_assenze', { data: data(v.data), tipo: v.tipo, ore, note: testo(v.note, 2000, 'Le note') }, esistente);
}
export function saveBustaPaga(v, esistente) {
  const mese = /^\d{4}-\d{2}$/.test(v.mese || '') ? v.mese + '-01' : v.mese;
  return scrivi('hotel_buste_paga', {
    mese: data(mese, 'Il mese'), netto: numero(v.netto, { max: 100000, nome: 'Il netto' }),
    lordo: numero(v.lordo, { max: 100000, nome: 'Il lordo', vuoto: true }),
    ore_pagate: numero(v.ore_pagate, { max: 744, nome: 'Le ore pagate', vuoto: true }),
    straordinari_pagati: numero(v.straordinari_pagati, { max: 744, nome: 'Gli straordinari', vuoto: true }),
    note: testo(v.note, 2000, 'Le note'),
  }, esistente);
}

// ---------------- Sviluppo ----------------
export function saveCliente(v, esistente) {
  const colore = /^#[0-9a-fA-F]{6}$/.test(v.colore || '') ? v.colore : '#5B4BC4';
  return scrivi('clienti', {
    nome: obbligatorio(v.nome, 120, 'Il nome'), referente: testo(v.referente, 120, 'Il referente'),
    email: testo(v.email, 200, "L'email"), telefono: testo(v.telefono, 40, 'Il telefono'), sito: testo(v.sito, 300, 'Il sito'),
    colore, interno: !!v.interno, archiviato: !!v.archiviato, note: testo(v.note, 5000, 'Le note'),
  }, esistente);
}
export function savePreventivo(v, esistente) {
  if (!state.clienti.some(c => c.id === v.cliente_id)) throw Error('Scegli il cliente.');
  if (v.project_id && !state.projects.some(p => p.id === v.project_id)) throw Error('Progetto non valido.');
  if (!STATI_PREVENTIVO[v.stato || 'bozza']) throw Error('Stato non valido.');
  return scrivi('preventivi', {
    cliente_id: v.cliente_id, project_id: v.project_id || null, titolo: obbligatorio(v.titolo, 200, 'Il titolo'),
    importo: numero(v.importo, { max: 1e7, nome: "L'importo" }), stato: v.stato || 'bozza',
    data: data(v.data), scadenza: v.scadenza ? data(v.scadenza, 'La scadenza') : null, note: testo(v.note, 5000, 'Le note'),
  }, esistente);
}
export function saveIncasso(v, esistente) {
  const p = state.preventivi.find(x => x.id === v.preventivo_id);
  if (!p) throw Error('Preventivo non trovato.');
  const importo = numero(v.importo, { min: 0.01, max: 1e7, nome: "L'importo incassato" });
  const gia = state.incassi.filter(i => i.preventivo_id === p.id && i.id !== esistente?.id).reduce((s, i) => s + Number(i.importo), 0);
  if (gia + importo > Number(p.importo) + 0.005) throw Error(`Supera l'importo del preventivo: restano ${(Number(p.importo) - gia).toFixed(2).replace('.', ',')} €.`);
  return scrivi('incassi', { preventivo_id: p.id, data: data(v.data), importo, note: testo(v.note, 2000, 'Le note') }, esistente);
}
export function saveFormazione(v, esistente) {
  if (!TIPI_FORMAZIONE[v.tipo || 'corso']) throw Error('Tipo non valido.');
  if (!STATI_FORMAZIONE[v.stato || 'da_fare']) throw Error('Stato non valido.');
  return scrivi('formazione', {
    titolo: obbligatorio(v.titolo, 200, 'Il titolo'), tipo: v.tipo || 'corso', link: testo(v.link, 500, 'Il link'),
    stato: v.stato || 'da_fare', ore_previste: numero(v.ore_previste, { max: 10000, nome: 'Le ore previste', vuoto: true }),
    ore_fatte: numero(v.ore_fatte || 0, { max: 10000, nome: 'Le ore fatte' }), note: testo(v.note, 5000, 'Le note'),
  }, esistente);
}
