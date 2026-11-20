// Calcoli della sezione Palestra e alimentazione. Leggono l'archivio di Forma
// ({items, settings, graves}) senza modificarlo. Funzioni pure, provate in
// tests/palestra.mjs.
import { ALIMENTI, PASTI, PORZIONI, CATEGORIE } from './formaDati.js?v=73';
import { shiftPreset } from './workShifts.js?v=65';
import { shiftDate } from './dates.js?v=65';

export { PASTI, CATEGORIE };

// Numeri di partenza, gli stessi di Forma: valgono finché non scrivi i tuoi obiettivi.
export const TARGET_DEFAULT = Object.freeze({ kcal: 2000, kcalOff: 1900, prot: 130, carb: 200, gras: 65, acqua: 2500, passi: 8000, olio: 25 });
export const PROFILO_DEFAULT = Object.freeze({ nome: '', altezza: 175, pesoObiettivo: 75, giroObiettivo: 90 });
export const GIORNI_SETT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
export const NOMI_GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const r0 = n => Math.round(Number(n) || 0);
export const r1 = n => Math.round((Number(n) || 0) * 10) / 10;
const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };

export const di = (a, t) => (a?.items || []).filter(i => i.t === t);
export const gsDiData = d => GIORNI_SETT[(new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7];
export const lunediDi = d => shiftDate(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));

export function cfg(a) {
  const c = (a?.items || []).find(i => i.t === 'cfg') || {};
  return { target: { ...TARGET_DEFAULT, ...(c.target || {}) }, profilo: { ...PROFILO_DEFAULT, ...(c.profilo || {}) } };
}

// ------------------------------------------------------------ diario
// Il database ha i valori per 100 g, la riga del diario ha i grammi.
export const macro = r => { const f = num(r.q) / 100; return { k: num(r.k) * f, p: num(r.p) * f, c: num(r.c) * f, g: num(r.g) * f }; };
export function somma(righe) {
  const t = { k: 0, p: 0, c: 0, g: 0 };
  for (const r of righe) { const m = macro(r); t.k += m.k; t.p += m.p; t.c += m.c; t.g += m.g; }
  return t;
}
export const RX_OLIO = /\bolio\b/i;
export const righeDi = (a, d) => di(a, 'l').filter(r => r.d === d);
export const giornoDi = (a, d) => (a?.items || []).find(i => i.t === 'g' && i.d === d) || { t: 'g', d, acqua: 0, passi: 0 };

export function riepilogoGiorno(a, d) {
  const righe = righeDi(a, d), g = giornoDi(a, d);
  return {
    righe, tot: somma(righe), acqua: num(g.acqua), passi: num(g.passi),
    olio: righe.filter(r => RX_OLIO.test(r.n)).reduce((s, r) => s + num(r.q), 0),
    perPasto: PASTI.map(p => { const rp = righe.filter(r => r.slot === p.id); return { ...p, righe: rp, tot: somma(rp) }; }),
  };
}

// Il turno di una data: prima quello inserito in Lavoro Hotel (Agenda), poi quello
// rimasto scritto nell'archivio di Forma.
export function turnoDi(a, d, voci = [], tz = 'Europe/Rome') {
  const v = voci.find(x => x.entry_date === d && (x.kind === 'shift' || x.kind === 'off'));
  if (v) return shiftPreset(v, tz);
  const id = giornoDi(a, d).turno;
  if (!id) return '';
  const tn = di(a, 'tn').find(x => x.id === id);
  if (tn?.riposo) return 'off';
  const m = /^cm-work-(\w+)$/.exec(id);
  return m ? m[1] : (tn?.n || '').toLowerCase();
}
export const obiettivoKcal = (a, turno) => { const t = cfg(a).target; return turno === 'off' ? t.kcalOff : t.kcal; };

export function slotOra(ora) {
  const h = ora ?? new Date().getHours();
  return h < 10 ? 'colazione' : h < 12 ? 'spuntino1' : h < 15 ? 'pranzo' : h < 18 ? 'spuntino2' : h < 22 ? 'cena' : 'spuntino3';
}

// ------------------------------------------------------------ piano settimanale
// Il giorno della settimana (t:'p') punta a una giornata tipo (t:'gt') con le righe.
export function giornataDelPiano(a, d) {
  const p = di(a, 'p').find(x => x.gs === gsDiData(d));
  return p?.gt ? di(a, 'gt').find(x => x.id === p.gt) || null : null;
}
export const righePiano = (a, d, slot) => (giornataDelPiano(a, d)?.righe || []).filter(r => !slot || r.slot === slot);

// L'allenamento previsto (t:'pa' punta a una giornata di una scheda t:'s').
export function allenamentoDelGiorno(a, d) {
  const p = di(a, 'pa').find(x => x.gs === gsDiData(d));
  if (!p?.sid || !p.gn) return null;
  const scheda = di(a, 's').find(x => x.id === p.sid);
  const giorno = scheda?.giorni?.find(g => g.n === p.gn);
  return giorno ? { scheda, giorno } : null;
}
export const sessioniDel = (a, d) => di(a, 'w').filter(w => w.d === d);
export function ultimaSessione(a, sid, gn, primaDi) {
  return di(a, 'w').filter(w => w.fine && w.sid === sid && w.gn === gn && (!primaDi || w.d < primaDi))
    .sort((x, y) => (y.d + (y.inizio || 0)).localeCompare(x.d + (x.inizio || 0)))[0] || null;
}

// ------------------------------------------------------------ misure e settimana
export function pesoAttuale(a, oggi) {
  const m = di(a, 'm').filter(x => num(x.peso) > 0 && (!oggi || x.d <= oggi)).sort((x, y) => x.d.localeCompare(y.d));
  if (!m.length) return null;
  const ult = m[m.length - 1], limite = shiftDate(ult.d, -14);
  const prima = [...m].reverse().find(x => x.d <= limite);
  return { peso: num(ult.peso), d: ult.d, delta: prima ? r1(num(ult.peso) - num(prima.peso)) : null, dal: prima?.d || null };
}
export function settimana(a, lunedi) {
  return GIORNI_SETT.map((gs, i) => {
    const d = shiftDate(lunedi, i), righe = righeDi(a, d);
    return { d, gs, nome: NOMI_GIORNI[i], kcal: righe.length ? r0(somma(righe).k) : null, allenato: sessioniDel(a, d).some(w => w.fine), previsto: !!allenamentoDelGiorno(a, d) };
  });
}

// ------------------------------------------------------------ catalogo e ricerca
// Prima i tuoi alimenti, poi quelli del CREA. A parità di nome vince il tuo.
export function catalogo(a) {
  const miei = di(a, 'a').map(x => ({ n: x.n, k: num(x.k), p: num(x.p), c: num(x.c), g: num(x.g), cat: x.cat || 'Altro', nt: x.nt || '', ean: x.ean || '', id: x.id, mio: true }));
  const nomi = new Set(miei.map(x => x.n.toLowerCase()));
  return [...miei, ...ALIMENTI.filter(x => !nomi.has(x.n.toLowerCase())).map(x => ({ ...x, cat: x.cat || 'Altro' }))];
}
export const normalizza = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Tutte le parole cercate devono comparire; prima chi comincia con la ricerca, poi i tuoi.
export function cerca(elenco, testo, limite = 40) {
  const parole = normalizza(testo).split(/\s+/).filter(Boolean);
  if (!parole.length) return [];
  return elenco.map(x => ({ x, n: normalizza(x.n) })).filter(({ n }) => parole.every(p => n.includes(p)))
    .sort((a, b) => (b.n.startsWith(parole[0]) - a.n.startsWith(parole[0])) || (b.x.mio - a.x.mio) || a.n.length - b.n.length)
    .slice(0, limite).map(({ x }) => x);
}
// Gli ultimi alimenti usati, una volta sola ciascuno, con la quantità dell'ultima volta.
export function recenti(a, limite = 20) {
  const visti = new Set(), out = [];
  for (const r of di(a, 'l').sort((x, y) => (y.d.localeCompare(x.d)) || ((y.updatedAt || 0) - (x.updatedAt || 0)))) {
    const k = r.n.toLowerCase();
    if (visti.has(k)) continue;
    visti.add(k); out.push({ n: r.n, k: num(r.k), p: num(r.p), c: num(r.c), g: num(r.g), q: num(r.q) });
    if (out.length >= limite) break;
  }
  return out;
}
export const ricette = a => di(a, 'r').filter(r => (r.righe || []).length).sort((x, y) => x.n.localeCompare(y.n, 'it'));
export function porzioniDi(nome) {
  return PORZIONI[nome] || [];
}

// ------------------------------------------------------------ Open Food Facts
export function categoriaDaOFF(tags) {
  const t = (tags || []).join(' ');
  if (/dairy|milk|yogurt|cheese|egg|latt|formagg|uov/i.test(t)) return 'Latticini/Uova';
  if (/meat|poultry|chicken|beef|pork|ham|salumi|carn/i.test(t)) return 'Carne';
  if (/fish|seafood|tuna|salmon|pesc|tonn/i.test(t)) return 'Pesce';
  if (/cereal|bread|pasta|rice|flour|pane|ris|farin|biscot/i.test(t)) return 'Cereali';
  if (/legume|bean|lentil|chickpea|fagiol|lentic|cec/i.test(t)) return 'Legumi';
  if (/fruit|vegetable|frutt|verdur|ortagg/i.test(t)) return 'Frutta/Verdura';
  if (/oil|nut|seed|olio|frutta-secca|semi/i.test(t)) return 'Grassi';
  return 'Altro';
}
// Dalla risposta di Open Food Facts a un alimento per 100 g (null se il prodotto non c'è).
export function prodottoDaOFF(risposta, codice) {
  if (risposta?.status !== 1 || !risposta.product) return null;
  const pr = risposta.product, nut = pr.nutriments || {};
  let kcal = num(nut['energy-kcal_100g']);
  if (!kcal) kcal = num(nut.energy_100g) / 4.184; // a volte c'è solo in kJ
  const marca = (pr.brands || '').split(',')[0].trim(), nome = (pr.product_name_it || pr.product_name || '').trim();
  if (!nome) return null;
  return {
    n: nome + (marca && !nome.toLowerCase().includes(marca.toLowerCase()) ? ' · ' + marca : ''),
    k: r1(kcal), p: r1(num(nut.proteins_100g)), c: r1(num(nut.carbohydrates_100g)), g: r1(num(nut.fat_100g)),
    cat: categoriaDaOFF(pr.categories_tags), nt: pr.quantity || '', ean: codice,
  };
}
export const codiceValido = s => /^\d{8}$|^\d{12,14}$/.test(String(s || '').trim());
