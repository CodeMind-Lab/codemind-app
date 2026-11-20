// Calcoli della sezione Palestra e alimentazione. Leggono l'archivio di Forma
// ({items, settings, graves}) senza modificarlo. Funzioni pure, provate in
// tests/palestra.mjs.
import { ALIMENTI, PASTI, PORZIONI, CATEGORIE, ESERCIZI, GRUPPI_CARDIO } from './formaDati.js?v=73';
import { shiftPreset } from './workShifts.js?v=65';
import { shiftDate } from './dates.js?v=65';

export { PASTI, CATEGORIE, ESERCIZI };

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

// ------------------------------------------------------------ allenamenti
// Gruppi dell'elenco di Forma (Spinta, Tirata, Gambe, Core, Cardio); "Altro" se il nome non c'è.
const GRUPPO_DI = new Map(Object.entries(ESERCIZI).flatMap(([g, l]) => l.map(e => [e.toLowerCase(), g])));
export const gruppoDi = nome => GRUPPO_DI.get(String(nome || '').toLowerCase()) || 'Altro';
const RX_CARDIO = /corsa|cammin|tapis|treadmill|cyclette|\bbike\b|ellittic|vogator|nuoto|salto con la corda|cardio/i;
export const isCardio = e => !!e.cardio || GRUPPI_CARDIO.includes(e.gruppo || gruppoDi(e.n)) || RX_CARDIO.test(e.n || '');
export const nomeGruppo = g => String(g || 'Altro').replace(/\s*\(.*\)$/, '');
// "8–10" → 8: il numero da proporre nella sessione è il minimo dell'intervallo.
export const ripNumero = rip => { const m = /(\d+)/.exec(String(rip ?? '')); return m ? +m[1] : ''; };
export const recSecondi = (v, def = 90) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : def; };
export const fmtRec = sec => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m ? `${m}′${s ? String(s).padStart(2, '0') : ''}` : `${s}″`; };

export function statSessione(w) {
  let serie = 0, volume = 0, ripetizioni = 0, min = 0, km = 0, max = 0;
  for (const e of w.eser || []) {
    for (const s of e.sets || []) { if (!s.ok) continue; serie++; ripetizioni += num(s.r); volume += num(s.r) * num(s.w); max = Math.max(max, num(s.w)); }
    min += num(e.min); km += num(e.km);
  }
  return { serie, volume, ripetizioni, min, km, max, esercizi: (w.eser || []).length, dur: num(w.dur) };
}
export const sessioni = (a, da, al, sid) => di(a, 'w').filter(w => (!da || w.d >= da) && (!al || w.d <= al) && (!sid || (sid === 'libero' ? !w.sid : w.sid === sid)))
  .sort((x, y) => (y.d.localeCompare(x.d)) || (num(y.inizio) - num(x.inizio)));
// Il carico massimo di un esercizio in ogni sessione chiusa, dalla più vecchia.
export function progressi(a, nome, limite = 8) {
  const k = String(nome || '').toLowerCase(), out = [];
  for (const w of sessioni(a).filter(w => w.fine).reverse()) {
    const e = (w.eser || []).find(x => String(x.n).toLowerCase() === k);
    if (!e) continue;
    const ok = (e.sets || []).filter(s => s.ok && num(s.w) > 0);
    if (!ok.length) continue;
    const top = ok.reduce((b, s) => num(s.w) > num(b.w) || (num(s.w) === num(b.w) && num(s.r) > num(b.r)) ? s : b);
    out.push({ d: w.d, kg: num(top.w), rip: num(top.r) });
  }
  return out.slice(-limite);
}
export function eserciziFatti(a) {
  const conta = new Map();
  for (const w of di(a, 'w')) for (const e of w.eser || []) if (!isCardio(e) && (e.sets || []).some(s => s.ok && num(s.w) > 0)) conta.set(e.n, (conta.get(e.n) || 0) + 1);
  return [...conta].sort((x, y) => y[1] - x[1]).map(([n]) => n);
}
export function seriePerGruppo(a, da, al) {
  const g = new Map();
  for (const w of sessioni(a, da, al)) for (const e of w.eser || []) {
    const n = (e.sets || []).filter(s => s.ok).length;
    if (n) { const k = nomeGruppo(e.gruppo || gruppoDi(e.n)); g.set(k, (g.get(k) || 0) + n); }
  }
  return [...g].sort((x, y) => y[1] - x[1]);
}
// Nomi per il completamento: elenco di Forma, più quelli già usati nelle tue schede e sessioni.
export function nomiEsercizi(a) {
  const nomi = new Set(Object.values(ESERCIZI).flat());
  for (const s of di(a, 's')) for (const g of s.giorni || []) for (const e of g.eser || []) if (e.n) nomi.add(e.n);
  for (const w of di(a, 'w')) for (const e of w.eser || []) if (e.n) nomi.add(e.n);
  return [...nomi].sort((x, y) => x.localeCompare(y, 'it'));
}
export const schedeDi = a => di(a, 's').sort((x, y) => String(x.n).localeCompare(String(y.n), 'it'));
export const pianoAllenamento = a => GIORNI_SETT.map(gs => { const p = di(a, 'pa').find(x => x.gs === gs); return { gs, sid: p?.sid || '', gn: p?.gn || '' }; });

// ------------------------------------------------------------ piano dei pasti e spesa
// Giornate tipo (t:'gt'): "Giorno on", "Giorno off"… ogni giorno della settimana (t:'p') ne punta una.
export const giornate = a => di(a, 'gt').sort((x, y) => String(x.n || '').localeCompare(String(y.n || ''), 'it', { numeric: true }));
export const pianoPasti = a => GIORNI_SETT.map(gs => { const p = di(a, 'p').find(x => x.gs === gs); return { gs, gt: p?.gt || '' }; });
// Somma per alimento sui giorni scelti: se lunedì e giovedì vogliono 60 g di riso, ne servono 120.
export function spesa(a, giorni) {
  const per = new Map(), cat = new Map(catalogo(a).map(x => [x.n.toLowerCase(), x.cat]));
  for (const { gs, gt } of pianoPasti(a)) {
    if (!giorni.includes(gs) || !gt) continue;
    for (const r of di(a, 'gt').find(x => x.id === gt)?.righe || []) {
      const k = r.n.toLowerCase(), v = per.get(k) || { n: r.n, q: 0, giorni: new Set(), cat: cat.get(k) || 'Altro' };
      v.q += num(r.q); v.giorni.add(gs); per.set(k, v);
    }
  }
  return CATEGORIE.map(c => ({ cat: c, voci: [...per.values()].filter(v => v.cat === c).sort((x, y) => x.n.localeCompare(y.n, 'it')) })).filter(g => g.voci.length);
}

// ------------------------------------------------------------ misure e report
export const misure = a => di(a, 'm').filter(m => m.d).sort((x, y) => y.d.localeCompare(x.d));
// Settimane da lunedì a domenica, dalla più recente: medie dei giorni con il diario compilato.
export function reportSettimane(a, lunedi, quante = 8) {
  return Array.from({ length: quante }, (_, i) => {
    const da = shiftDate(lunedi, -7 * i), al = shiftDate(da, 6), giorni = settimana(a, da), scritti = giorni.filter(g => g.kcal != null);
    const tot = scritti.reduce((t, g) => { const s = somma(righeDi(a, g.d)); return { k: t.k + s.k, p: t.p + s.p }; }, { k: 0, p: 0 });
    const ses = sessioni(a, da, al).filter(w => w.fine), vol = ses.reduce((t, w) => t + statSessione(w).volume, 0);
    const pesi = di(a, 'm').filter(m => m.d >= da && m.d <= al && num(m.peso) > 0).sort((x, y) => x.d.localeCompare(y.d));
    return { da, al, giorni: scritti.length, kcal: scritti.length ? tot.k / scritti.length : null, prot: scritti.length ? tot.p / scritti.length : null,
      allenamenti: ses.length, volume: vol, peso: pesi.length ? num(pesi[pesi.length - 1].peso) : null };
  });
}
