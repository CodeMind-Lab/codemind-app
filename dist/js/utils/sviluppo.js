// Calcoli di Lavoro Sviluppo. Funzioni pure, provate in tests/sviluppo.mjs.
// Le ore vengono dall'Agenda: blocchi della categoria "dev" (Sviluppo) collegati a un
// progetto. "Pianificate" sono le ore messe in agenda nel mese, "fatte" quelle
// registrate col timer o a mano (time_logs).
import { summary } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';

export const ultimoGiorno = mese => shiftDate(`${mese}-01`, new Date(Date.UTC(Number(mese.slice(0, 4)), Number(mese.slice(5, 7)), 0)).getUTCDate() - 1);

export function oreProgetti(voci, logs, progetti, mese, tz) {
  const dal = `${mese}-01`, al = ultimoGiorno(mese);
  const dev = voci.filter(v => v.category === 'dev' && v.kind === 'activity');
  const chiavi = new Map();
  for (const v of dev) { const k = v.project_id || ''; if (!chiavi.has(k)) chiavi.set(k, []); chiavi.get(k).push(v); }
  const righe = [...chiavi].map(([id, lista]) => {
    const s = summary(lista, logs, dal, al, tz).byCategory.dev;
    const p = progetti.find(x => x.id === id);
    return { project_id: id || null, progetto: p ? p.name : 'Senza progetto', cliente_id: p?.cliente_id || null, pianificate: s.planned, fatte: s.actual };
  }).filter(r => r.pianificate || r.fatte);
  return righe.sort((a, b) => b.fatte - a.fatte || b.pianificate - a.pianificate);
}

export function perCliente(righe) {
  const m = new Map();
  for (const r of righe) {
    const k = r.cliente_id || '';
    const x = m.get(k) || { cliente_id: r.cliente_id, pianificate: 0, fatte: 0 };
    x.pianificate += r.pianificate; x.fatte += r.fatte; m.set(k, x);
  }
  return m;
}

// Stato "economico" di un preventivo: quanto è entrato e quanto manca.
export function contoPreventivo(p, incassi) {
  const incassato = incassi.filter(i => i.preventivo_id === p.id).reduce((s, i) => s + Number(i.importo), 0);
  const importo = Number(p.importo);
  const residuo = p.stato === 'accettato' ? Math.max(0, importo - incassato) : 0;
  let etichetta = { bozza: 'Bozza', inviato: 'Inviato', accettato: 'Accettato', rifiutato: 'Rifiutato' }[p.stato];
  let classe = { bozza: 'p-x', inviato: 'p-a', accettato: 'p-f', rifiutato: 'p-m' }[p.stato];
  if (p.stato === 'accettato' && incassato >= importo - 0.005 && importo > 0) { etichetta = 'Pagato'; classe = 'p-off'; }
  else if (p.stato === 'accettato' && incassato > 0) { etichetta = 'Acconto'; classe = 'p-m'; }
  return { incassato, residuo, etichetta, classe };
}

export function totaliPreventivi(preventivi, incassi, clienteId = null) {
  const lista = preventivi.filter(p => !clienteId || p.cliente_id === clienteId);
  const accettati = lista.filter(p => p.stato === 'accettato');
  const conti = accettati.map(p => contoPreventivo(p, incassi));
  return {
    accettati: accettati.length,
    importo: accettati.reduce((s, p) => s + Number(p.importo), 0),
    incassato: conti.reduce((s, c) => s + c.incassato, 0),
    daIncassare: conti.reduce((s, c) => s + c.residuo, 0),
    inAttesa: lista.filter(p => p.stato === 'inviato').reduce((s, p) => s + Number(p.importo), 0),
  };
}

export const iniziali = nome => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('').replace(/[^A-Z0-9&]/g, '') || '?';
