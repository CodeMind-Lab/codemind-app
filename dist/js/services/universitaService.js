// Dati dell'Università (migrazione 014): registro lezioni, piano di studio, appelli,
// simulazioni, errori da ripassare, elaborati. Stessa logica degli altri servizi:
// in cloud scrive su Supabase controllando updated_at, nei test aggiorna la memoria.
import { state } from './store.js?v=65';
import { getClient, unwrap, readAll } from './supabase.js?v=65';
import { saveProject } from './dataService.js?v=65';
import { universityData, encodeUniversity } from '../utils/university.js?v=65';
import { uid } from '../utils/helpers.js?v=65';

const raccolte = { uni_lezioni: 'uniLezioni', uni_piano: 'uniPiano', uni_appelli: 'uniAppelli', uni_simulazioni: 'uniSimulazioni', uni_errori: 'uniErrori', uni_elaborati: 'uniElaborati' };
export const PROVE = { intermedia: 'Prova intermedia', finale: 'Prova finale', unica: 'Esame' };
export const ESITI = { '': 'Da sostenere', superato: 'Superato', non_superato: 'Non superato', ritirato: 'Ritirato', assente: 'Assente' };
export const STATI_ELABORATO = { da_iniziare: 'Da iniziare', in_corso: 'In corso', consegnato: 'Consegnato', valutato: 'Valutato' };

export function clearUniversita() {
  for (const k of Object.values(raccolte)) state[k] = [];
  state.universitaError = '';
}
clearUniversita();

export async function loadUniversita() {
  try {
    const dati = await Promise.all(Object.keys(raccolte).map(t => readAll(t)));
    Object.values(raccolte).forEach((k, i) => { state[k] = dati[i]; });
    state.universitaError = '';
  } catch {
    clearUniversita();
    state.universitaError = 'Registro lezioni, piano, appelli e simulazioni non sono ancora pronti nel database (manca la migrazione 014).';
  }
}

function scrivibile() {
  if (state.mode === 'signed_out') throw Error('Accedi prima di salvare.');
  if (state.mode === 'cloud' && !navigator.onLine) throw Error('Sei offline: riconnettiti per salvare.');
  if (state.mode === 'cloud' && state.universitaError) throw Error(state.universitaError);
}
async function scrivi(tabella, valori, esistente) {
  scrivibile();
  let riga;
  if (state.mode === 'cloud') {
    const c = await getClient();
    const q = esistente
      ? c.from(tabella).update(valori).eq('id', esistente.id).eq('updated_at', esistente.updated_at).select()
      : c.from(tabella).insert({ ...valori, user_id: state.user.id }).select();
    const dati = unwrap(await q);
    if (!dati.length) throw Error('Questo dato è cambiato su un altro dispositivo. Aggiorna la pagina e riprova.');
    riga = dati[0];
  } else {
    const ora = new Date().toISOString();
    riga = { ...esistente, ...valori, id: esistente?.id || uid(), created_at: esistente?.created_at || ora, updated_at: ora };
  }
  const k = raccolte[tabella];
  state[k] = [...state[k].filter(x => x.id !== riga.id), riga];
  return riga;
}
export async function eliminaUni(tabella, riga) {
  scrivibile();
  if (state.mode === 'cloud') unwrap(await (await getClient()).from(tabella).delete().eq('id', riga.id));
  const k = raccolte[tabella];
  state[k] = state[k].filter(x => x.id !== riga.id);
}
// Più righe nuove in una chiamata sola (import di lezioni e piano di studio).
async function inserisciMolte(tabella, righe) {
  scrivibile();
  if (!righe.length) return [];
  let nuove;
  if (state.mode === 'cloud') {
    const c = await getClient();
    nuove = [];
    for (let i = 0; i < righe.length; i += 200) nuove.push(...unwrap(await c.from(tabella).insert(righe.slice(i, i + 200).map(r => ({ ...r, user_id: state.user.id }))).select()));
  } else {
    const ora = new Date().toISOString();
    nuove = righe.map(r => ({ ...r, id: uid(), created_at: ora, updated_at: ora }));
  }
  const k = raccolte[tabella];
  state[k] = [...state[k], ...nuove];
  return nuove;
}

// ---------------- controlli ----------------
const testo = (v, max) => String(v ?? '').trim().slice(0, max);
const obbligatorio = (v, max, cosa) => { const s = testo(v, max); if (!s) throw Error(`Scrivi ${cosa}.`); return s; };
const data = (v, cosa = 'la data') => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) throw Error(`Controlla ${cosa}.`); return v; };
const intero = (v, min, max, cosa, vuoto = false) => {
  if ((v === '' || v == null) && vuoto) return null;
  const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw Error(`Controlla ${cosa}: un numero intero da ${min} a ${max}.`); return n;
};
const decimale = (v, min, max, cosa) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < min || n > max) throw Error(`Controlla ${cosa}.`); return Math.round(n * 100) / 100;
};
const materiaValida = id => { if (!state.projects.some(p => p.id === id && universityData(p))) throw Error('Materia non trovata.'); return id; };

// ---------------- materia (JSON nel progetto) ----------------
// Aggiorna solo alcuni campi della scheda materia lasciando com'è tutto il resto.
export async function aggiornaMateria(p, campi) {
  const d = { ...universityData(p), ...campi };
  return saveProject({ name: p.name, description: p.description ?? null, color: p.color, status: p.status, start_date: p.start_date ?? null, due_date: p.due_date ?? null, github_url: p.github_url ?? null, project_url: p.project_url ?? null, icon: p.icon ?? null, notes: encodeUniversity(d) }, p);
}
export function impostaLezioni(p, totali, intermediaFino) {
  const t = intero(totali, 0, 500, 'il numero di lezioni');
  const f = intero(intermediaFino, 1, 500, 'la lezione dove finisce la prova intermedia', true);
  if (f != null && f > t) throw Error("La prova intermedia non può finire dopo l'ultima lezione.");
  return aggiornaMateria(p, { lezioniTotali: t, intermediaFino: f });
}

// ---------------- registro lezioni ----------------
export function segnaLezione(materiaId, numero, seguita, oggi) {
  materiaValida(materiaId);
  const riga = state.uniLezioni.find(r => r.materia_id === materiaId && r.numero === numero);
  const valori = { seguita, data_seguita: seguita ? (riga?.data_seguita || oggi) : null };
  return riga ? scrivi('uni_lezioni', valori, riga) : scrivi('uni_lezioni', { materia_id: materiaId, numero: intero(numero, 1, 500, 'il numero'), titolo: '', note: '', ...valori });
}
export function salvaTitoloLezione(materiaId, numero, titolo) {
  const riga = state.uniLezioni.find(r => r.materia_id === materiaId && r.numero === numero);
  return riga ? scrivi('uni_lezioni', { titolo: testo(titolo, 300) }, riga) : scrivi('uni_lezioni', { materia_id: materiaValida(materiaId), numero, titolo: testo(titolo, 300), seguita: false, note: '' });
}
// Titoli dall'import: crea solo le lezioni che mancano, non tocca quelle già segnate.
export function importaTitoli(materiaId, lezioni) {
  const esistenti = new Set(state.uniLezioni.filter(r => r.materia_id === materiaId).map(r => r.numero));
  return inserisciMolte('uni_lezioni', lezioni.filter(l => !esistenti.has(l.numero)).map(l => ({ materia_id: materiaId, numero: l.numero, titolo: testo(l.titolo, 300), seguita: false, note: '' })));
}

// ---------------- piano di studio ----------------
export function salvaPiano(v, esistente) {
  return scrivi('uni_piano', {
    materia_id: materiaValida(v.materia_id), posizione: intero(v.posizione ?? 0, 0, 10000, 'la posizione'),
    settimana: testo(v.settimana, 60), argomento: obbligatorio(v.argomento, 300, "l'argomento"), lezioni: testo(v.lezioni, 120),
    ore: decimale(v.ore, 0, 500, 'le ore'), fatto: !!v.fatto, note: testo(v.note, 2000),
  }, esistente);
}
// Righe incollate o lette da Excel/Word: [settimana, argomento, lezioni, ore]
export function importaPiano(materiaId, righe) {
  materiaValida(materiaId);
  const base = Math.max(0, ...state.uniPiano.filter(r => r.materia_id === materiaId).map(r => r.posizione)) + 1;
  const pulite = righe.map(r => ({ settimana: testo(r[0], 60), argomento: testo(r[1], 300), lezioni: testo(r[2], 120), ore: decimale(r[3], 0, 500, 'le ore') })).filter(r => r.argomento);
  if (!pulite.length) throw Error('Nessuna riga con un argomento da importare.');
  return inserisciMolte('uni_piano', pulite.map((r, i) => ({ materia_id: materiaId, posizione: base + i, fatto: false, note: '', ...r })));
}

// ---------------- appelli, simulazioni, errori, elaborati ----------------
export function salvaAppello(v, esistente) {
  if (!PROVE[v.prova || 'unica']) throw Error('Scegli la prova.');
  if (!(v.esito in ESITI)) throw Error('Esito non valido.');
  return scrivi('uni_appelli', {
    materia_id: materiaValida(v.materia_id), data: data(v.data, "la data dell'appello"), ora: v.ora || null, prova: v.prova || 'unica',
    modalita: testo(v.modalita, 120), iscrizione_entro: v.iscrizione_entro ? data(v.iscrizione_entro, "la scadenza d'iscrizione") : null,
    iscritto: !!v.iscritto, esito: v.esito || '', punti: decimale(v.punti, 0, 100, 'i punti'), note: testo(v.note, 2000),
  }, esistente);
}
export function salvaSimulazione(v, esistente) {
  const domande = intero(v.domande, 1, 200, 'le domande');
  return scrivi('uni_simulazioni', {
    materia_id: materiaValida(v.materia_id), data: data(v.data), prova: PROVE[v.prova] ? v.prova : 'intermedia',
    domande, corrette: intero(v.corrette, 0, domande, 'le risposte giuste'), minuti: intero(v.minuti, 1, 600, 'i minuti', true), note: testo(v.note, 2000),
  }, esistente);
}
export function salvaErrore(v, esistente) {
  return scrivi('uni_errori', {
    materia_id: materiaValida(v.materia_id), lezione: intero(v.lezione, 1, 500, 'la lezione', true),
    domanda: obbligatorio(v.domanda, 1000, 'la domanda o il concetto sbagliato'), risposta: testo(v.risposta, 2000), spiegazione: testo(v.spiegazione, 5000),
    ripassi: esistente?.ripassi ?? 0, prossimo_ripasso: esistente ? esistente.prossimo_ripasso : v.prossimo_ripasso || null, risolto: !!(esistente?.risolto),
  }, esistente);
}
export const aggiornaRipasso = (errore, valori) => scrivi('uni_errori', valori, errore);
export function salvaElaborato(v, esistente) {
  if (!STATI_ELABORATO[v.stato || 'da_iniziare']) throw Error('Stato non valido.');
  return scrivi('uni_elaborati', {
    materia_id: materiaValida(v.materia_id), titolo: obbligatorio(v.titolo, 200, 'il titolo'), scadenza: v.scadenza ? data(v.scadenza, 'la scadenza') : null,
    stato: v.stato || 'da_iniziare', punti: decimale(v.punti, 0, 10, 'i punti'), link: testo(v.link, 500), note: testo(v.note, 5000),
  }, esistente);
}
