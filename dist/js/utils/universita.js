// Calcoli e lettura delle schede per la sezione Università. Funzioni pure, provate in
// tests/universita.mjs.
import { universityData } from './university.js?v=65';
import { summary } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';

// Dove finisce la prova intermedia, dal Piano Master di studio 2026/27 (programmi
// ufficiali delle materie). Si usa solo come proposta all'import: resta modificabile.
export const DIVISIONI_PIANO_MASTER = Object.freeze({
  'data science': 15, 'statistica e data analyst': 36, 'fondamenti di elettronica': 20, 'machine learning e artificial intelligence': 34, 'machine learning e ai': 34,
});
export const normalizzaNome = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*-\s*\w*\d\w*$/, '').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function divisioneSuggerita(nome) {
  const n = normalizzaNome(nome);
  const chiave = Object.keys(DIVISIONI_PIANO_MASTER).find(k => n === k || n.startsWith(k));
  return chiave ? DIVISIONI_PIANO_MASTER[chiave] : null;
}

export const materie = progetti => progetti.filter(p => universityData(p)).sort((a, b) => a.name.localeCompare(b.name, 'it'));
export function datiMateria(p) {
  const d = universityData(p) || {};
  return { ...d, lezioniTotali: Number(d.lezioniTotali) || 0, intermediaFino: d.intermediaFino ? Number(d.intermediaFino) : null };
}

// Registro: una riga per lezione da 1 a N, con la prova a cui serve.
export function registro(p, righe) {
  const d = datiMateria(p), perNumero = new Map(righe.filter(r => r.materia_id === p.id).map(r => [r.numero, r]));
  const totale = Math.max(d.lezioniTotali, ...[...perNumero.keys(), 0]);
  const lezioni = Array.from({ length: totale }, (_, i) => {
    const n = i + 1, r = perNumero.get(n);
    return { numero: n, titolo: r?.titolo || '', seguita: !!r?.seguita, data: r?.data_seguita || null, riga: r || null, prova: d.intermediaFino ? (n <= d.intermediaFino ? 'intermedia' : 'finale') : 'unica' };
  });
  const conta = prova => { const l = lezioni.filter(x => prova === 'tutte' || x.prova === prova); return { seguite: l.filter(x => x.seguita).length, totali: l.length }; };
  return { lezioni, tutte: conta('tutte'), intermedia: conta('intermedia'), finale: conta('finale') };
}

// Minuti di studio per materia nell'intervallo: blocchi "study" dell'Agenda collegati
// alla materia, pianificati e registrati.
export function studioPerMateria(voci, logs, progetti, dal, al, tz) {
  const r = new Map();
  for (const p of materie(progetti)) {
    const s = summary(voci.filter(v => v.category === 'study' && v.project_id === p.id), logs, dal, al, tz).byCategory.study;
    r.set(p.id, { pianificate: s.planned, fatte: s.actual });
  }
  return r;
}

export const appelliFuturi = (appelli, oggi) => appelli.filter(a => a.data >= oggi && !a.esito).sort((a, b) => a.data.localeCompare(b.data));
export const iscrizioneUrgente = (a, oggi, giorni = 7) => !a.iscritto && !!a.iscrizione_entro && a.iscrizione_entro >= oggi && a.iscrizione_entro <= shiftDate(oggi, giorni);

// Ripasso a intervalli crescenti: dopo ogni ripasso riuscito l'errore torna tra
// 1, 3, 7, 14 e 30 giorni; al sesto si considera imparato.
export const INTERVALLI_RIPASSO = [1, 3, 7, 14, 30];
export function dopoRipasso(errore, oggi) {
  const ripassi = (errore.ripassi || 0) + 1;
  if (ripassi > INTERVALLI_RIPASSO.length) return { ripassi, risolto: true, prossimo_ripasso: null };
  return { ripassi, risolto: false, prossimo_ripasso: shiftDate(oggi, INTERVALLI_RIPASSO[ripassi - 1]) };
}
export const daRipassare = (errori, oggi) => errori.filter(e => !e.risolto && (!e.prossimo_ripasso || e.prossimo_ripasso <= oggi));

export function migliorSimulazione(sim) {
  return sim.reduce((best, s) => !best || s.corrette / s.domande > best.corrette / best.domande ? s : best, null);
}

// ---------------------------------------------------------------------------------
// Lettura delle schede ufficiali dal documento dell'ateneo (testo del .docx).
// Ogni materia comincia con un titolo tutto maiuscolo; dentro ci sono le sezioni
// standard dei programmi (Obiettivi Formativi, Programma del Corso, …).
const SEZIONI = [
  ['obiettivi', /^obiettivi formativi/i], ['risultati', /^risultati di apprendimento attesi/i],
  ['programma', /^programma del corso/i], ['testi', /^testi consigliati/i], ['calendario', /^calendario$/i],
  ['accertamento', /^modalit[aà] di accertamento/i], ['esame', /^modalit[aà] di esame/i],
  ['propedeuticita', /^propedeuticit[aà]/i], ['prerequisiti', /^prerequisiti/i], ['organizzazione', /^organizzazione didattica$/i],
];
const NON_MATERIE = /^(MODULO\b|ORGANIZZAZIONE DIDATTICA|PROFONDO E MODELLI|LSTM|PROGRAMMA MANCANTE)/;
function eTitoloMateria(riga, seguenti) {
  const s = riga.trim();
  // le voci d'elenco (• MOSFET) e le righe numerate non sono titoli di materie
  if (s.length < 6 || s.length > 140 || s !== s.toUpperCase() || !/[A-ZÀ-Ü]{4}/.test(s) || NON_MATERIE.test(s) || /^=+$/.test(s) || /^[•●▪*\-–\d]/.test(s)) return false;
  // una materia vera ha, poco sotto, almeno una delle sezioni del programma
  return seguenti.some(x => SEZIONI.some(([, re]) => re.test(x.trim())));
}
const pulisciNome = s => {
  const nome = s.trim().replace(/\s*:.*$/, '').replace(/\s+-\s+\S*\d\S*$/, '').trim();
  const corretto = nome.replace(/STUTTURE/g, 'STRUTTURE').replace(/ALANYST/g, 'ANALYST');
  return corretto.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase()).replace(/\b(E|Di|Dei|Delle|Della|Del|Per)\b/g, w => w.toLowerCase()).replace(/\bAi\b/, 'AI').replace(/\bIot\b/, 'IoT');
};
export function leggiSchede(testo) {
  // Word mette a volte un "a capo" speciale (U+2028) dentro i titoli: vale come riga nuova.
  const righe = String(testo || '').replace(/\r/g, '').replace(/[\u2028\u2029]/g, '\n').split('\n')
    // Alcuni lettori di Word uniscono il titolo e la prima sezione ("IOT E SISTEMI CONNESSI Obiettivi
    // Formativi"): se un titolo in maiuscolo finisce con il nome di una sezione, li separo.
    .flatMap(r => { const m = r.match(/^(\s*[A-ZÀ-Ü0-9][A-ZÀ-Ü0-9 '&,.:\-]{4,}?)\s+(Obiettivi Formativi|Risultati di apprendimento attesi;?|Programma del Corso)\s*$/); return m ? [m[1], m[2]] : [r]; });
  const inizi = [];
  righe.forEach((r, i) => { if (eTitoloMateria(r, righe.slice(i + 1, i + 25))) inizi.push(i); });
  return inizi.map((inizio, k) => {
    const fine = k + 1 < inizi.length ? inizi[k + 1] : righe.length;
    const blocco = righe.slice(inizio + 1, fine);
    const titolo = righe[inizio].trim();
    // "PROGRAMMA MANCANTE" può stare nel titolo o nella riga subito sotto
    const incompleta = /MANCANTE/i.test(titolo) || righe.slice(inizio + 1, inizio + 3).some(r => /MANCANTE/i.test(r));
    const scheda = { nome: pulisciNome(titolo), codice: (titolo.match(/\b\d{4,}\w*\b/) || [''])[0], incompleta };
    let corrente = null;
    for (const riga of blocco) {
      const t = riga.trim();
      const sezione = SEZIONI.find(([, re]) => re.test(t));
      if (sezione) { corrente = sezione[0]; scheda[corrente] = scheda[corrente] || ''; continue; }
      if (corrente && t) scheda[corrente] += (scheda[corrente] ? '\n' : '') + t.replace(/^[•●▪\-*]\s*/, '• ');
    }
    // Lezioni: "Lezione 12 — Titolo" (anche ripetute: vale la prima) e numero dichiarato.
    const lezioni = new Map();
    for (const r of blocco) { const m = r.trim().match(/^Lezione\s+(\d{1,3})\s*[—–-]\s*(.+)$/); if (m && !lezioni.has(+m[1])) lezioni.set(+m[1], m[2].trim().slice(0, 300)); }
    const dichiarate = blocco.join(' ').match(/(\d{1,3})\s+lezioni\s+(?:frontali,?\s+)?videoregistrate/i);
    scheda.lezioni = [...lezioni].map(([numero, titolo]) => ({ numero, titolo })).sort((a, b) => a.numero - b.numero);
    scheda.lezioniTotali = Math.max(dichiarate ? Number(dichiarate[1]) : 0, ...scheda.lezioni.map(l => l.numero), 0);
    scheda.intermediaFino = divisioneSuggerita(scheda.nome);
    for (const k of Object.keys(scheda)) if (typeof scheda[k] === 'string') scheda[k] = scheda[k].slice(0, 12000);
    return scheda;
  });
}
