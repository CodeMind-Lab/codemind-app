// "Scheda A·B·C" dentro le Schede di Palestra. La pagina dist/scheda-abc/index.html è
// generata dal piano fitness (build_pagina.py) e non si tocca a mano: i dati si leggono
// da lì, dall'oggetto `const DATI = {...}` che lo script ci scrive dentro. Così, quando
// la pagina viene rigenerata, anche la scheda nell'app si aggiorna da sola.
//
// Nell'archivio di Forma diventa una scheda normale (t:'s') con id fisso e tre giorni
// dal nome fisso ("A · Forza", "B · Volume", "C · Pompaggio"): la settimana di
// allenamento la può usare come tutte le altre e non si rompe quando cambia la fase.
import { gruppoDi } from './palestra.js?v=74';

export const ID_ABC = 'scheda-abc';
export const NOME_ABC = 'Scheda A·B·C';
export const PAGINA_ABC = 'scheda-abc/index.html';

// Estrae l'oggetto DATI dall'HTML della pagina contando le graffe (le stringhe possono
// contenere graffe e virgolette: si saltano).
export function estraiDati(html) {
  const inizio = String(html || '').indexOf('const DATI =');
  if (inizio < 0) throw Error('Nella pagina Scheda A·B·C non trovo i dati.');
  const da = html.indexOf('{', inizio);
  let livello = 0, inStringa = false, escape = false;
  for (let i = da; i < html.length; i++) {
    const c = html[i];
    if (inStringa) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') inStringa = false; continue; }
    if (c === '"') inStringa = true;
    else if (c === '{') livello++;
    else if (c === '}' && --livello === 0) {
      const dati = JSON.parse(html.slice(da, i + 1));
      if (!Array.isArray(dati?.fasi) || !dati.fasi.length) throw Error('I dati della Scheda A·B·C non hanno fasi.');
      return dati;
    }
  }
  throw Error('I dati della Scheda A·B·C sono incompleti.');
}

// La fase del calendario: quella che contiene il giorno, altrimenti la prima (prima
// dell'inizio) o l'ultima (dopo la fine). È la stessa regola della pagina A·B·C.
export function faseDelGiorno(dati, d) {
  const f = dati.fasi.find(x => d >= x.dal && d <= x.al);
  if (f) return f;
  return d < dati.fasi[0].dal ? dati.fasi[0] : dati.fasi[dati.fasi.length - 1];
}

const nomeGiorno = (lettera, s) => `${lettera} · ${s?.nome || 'Sessione ' + lettera}`.slice(0, 60);

// I giorni della scheda per una fase. I kg non sono nel piano: si tengono quelli che hai
// già scritto nella scheda (per nome dell'esercizio), così passano da una fase all'altra.
export function giorniAbc(fase, precedente = null) {
  const pesi = new Map();
  for (const g of precedente?.giorni || []) for (const e of g.eser || []) if (e.peso !== '' && e.peso != null) pesi.set(String(e.n).toLowerCase(), e.peso);
  return Object.entries(fase.sessioni || {}).sort(([x], [y]) => x.localeCompare(y)).map(([lettera, s]) => ({
    n: nomeGiorno(lettera, s),
    eser: (s.righe || []).map(r => {
      const n = String(r.nome || '').trim().slice(0, 120);
      const note = [r.num && `${r.num}`, r.rpe && `RPE ${r.rpe}`, r.nota].filter(Boolean).join(' · ').slice(0, 200);
      return { n, gruppo: gruppoDi(n), serie: Math.max(1, Math.min(20, Number(r.serie) || 3)), rip: String(r.rip ?? '').slice(0, 20), peso: pesi.get(n.toLowerCase()) ?? '', rec: Number(r.rec) || '', note };
    })
  }));
}

// Quello che la scheda nell'archivio deve contenere: se è già così, non si salva niente.
export function contenutoAbc(fase, precedente = null) {
  return { n: NOME_ABC, abc: { fase: fase.id, nome: fase.nome, settimane: fase.settimane || '', durate: Object.fromEntries(Object.entries(fase.sessioni || {}).map(([k, s]) => [k, Number(s.durata) || 0])) }, giorni: giorniAbc(fase, precedente) };
}
// L'archivio salva le chiavi in ordine alfabetico: il confronto non deve badare all'ordine.
const ordinato = v => Array.isArray(v) ? v.map(ordinato) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordinato(v[k])])) : v;
export const uguale = (x, y) => JSON.stringify(ordinato(x)) === JSON.stringify(ordinato(y));
