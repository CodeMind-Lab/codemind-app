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
// Obiettivi del giorno. Due modi (cfg.target.base):
//   'turno' (predefinito, come Forma): kcal nei giorni di turno, kcalOff nei giorni OFF;
//   'allenamento' (piano alimentare): kcal/carb/gras/acqua nei giorni di allenamento,
//   kcalOff/carbOff/grasOff/acquaOff nei giorni di riposo. Le proteine restano uguali.
export function obiettiviGiorno(a, { turno = '', allena = false } = {}) {
  const t = cfg(a).target;
  if (t.base === 'allenamento') {
    return allena ? { ...t, chi: 'allenamento' }
      : { ...t, kcal: t.kcalOff, carb: t.carbOff ?? t.carb, gras: t.grasOff ?? t.gras, acqua: t.acquaOff ?? t.acqua, chi: 'riposo' };
  }
  return turno === 'off' ? { ...t, kcal: t.kcalOff, chi: 'off' } : { ...t, chi: 'turno' };
}
export const obiettivoKcal = (a, turno, allena = false) => obiettiviGiorno(a, { turno, allena }).kcal;

export function slotOra(ora) {
  const h = ora ?? new Date().getHours();
  return h < 10 ? 'colazione' : h < 12 ? 'spuntino1' : h < 15 ? 'pranzo' : h < 18 ? 'spuntino2' : h < 22 ? 'cena' : 'spuntino3';
}

// ------------------------------------------------------------ piano settimanale
// Il giorno della settimana (t:'p') punta a una giornata tipo (t:'gt') con le righe.
// Con la scelta automatica (cfg.pianoTurni) vince la giornata con lo stesso turno e lo stesso
// allenamento/riposo del giorno; se non c'è (turno non inserito) resta il giorno della settimana.
// turno: quello di turnoDi(); undefined = non noto (si usa solo la settimana).
export const pianoAutomatico = a => !!(a?.items || []).find(i => i.t === 'cfg')?.pianoTurni;
const TURNI_PIANO = ['apertura', 'chiusura', 'notte', 'off'];
export function giornataAuto(a, turno, allena) {
  if (!TURNI_PIANO.includes(turno)) return null;
  const vuole = turno === 'notte' ? false : !!allena, conTurno = di(a, 'gt').filter(g => g.turno === turno);
  return conTurno.find(g => !!g.allena === vuole) || conTurno.find(g => !g.allena) || conTurno[0] || null;
}
export function giornataDelPiano(a, d, turno) {
  if (turno !== undefined && pianoAutomatico(a)) { const g = giornataAuto(a, turno, !!allenamentoDelGiorno(a, d)); if (g) return g; }
  const p = di(a, 'p').find(x => x.gs === gsDiData(d));
  return p?.gt ? di(a, 'gt').find(x => x.id === p.gt) || null : null;
}
export const righePiano = (a, d, slot, turno) => (giornataDelPiano(a, d, turno)?.righe || []).filter(r => !slot || r.slot === slot);

// L'allenamento previsto (t:'pa' punta a una giornata di una scheda t:'s').
// Due livelli: la settimana tipo (voci con gs, valgono ogni settimana) e i giorni di una
// settimana organizzata a parte (voci con la data d e senza gs: Forma classica cerca per gs
// e non le vede). Il giorno con la data vince, anche quando è riposo (sid vuoto).
const tipoDi = (a, gs) => di(a, 'pa').find(x => !x.d && x.gs === gs);
export const pianoDelGiorno = (a, d) => di(a, 'pa').find(x => x.d === d) || tipoDi(a, gsDiData(d)) || null;
export function pianoSettimana(a, lunedi) {
  return GIORNI_SETT.map((gs, i) => {
    const d = shiftDate(lunedi, i), proprio = di(a, 'pa').find(x => x.d === d), p = proprio || tipoDi(a, gs);
    return { gs, d, sid: p?.sid || '', gn: p?.gn || '', proprio: !!proprio };
  });
}
export function allenamentoDelGiorno(a, d) {
  const p = pianoDelGiorno(a, d);
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
export const pianoAllenamento = a => GIORNI_SETT.map(gs => { const p = tipoDi(a, gs); return { gs, sid: p?.sid || '', gn: p?.gn || '' }; });

// ------------------------------------------------------------ piano dei pasti e spesa
// Giornate tipo (t:'gt'): "Giorno on", "Giorno off"… ogni giorno della settimana (t:'p') ne punta una.
export const giornate = a => di(a, 'gt').sort((x, y) => String(x.n || '').localeCompare(String(y.n || ''), 'it', { numeric: true }));
export const pianoPasti = a => GIORNI_SETT.map(gs => { const p = di(a, 'p').find(x => x.gs === gs); return { gs, gt: p?.gt || '' }; });
// Somma per alimento sui giorni scelti: se lunedì e giovedì vogliono 60 g di riso, ne servono 120.
// scelte: [{gs, gt}] per giorno (predefinito il piano della settimana; con la scelta
// automatica la pagina passa le giornate decise dai turni della settimana).
export function spesa(a, giorni, scelte = pianoPasti(a)) {
  const per = new Map(), cat = new Map(catalogo(a).map(x => [x.n.toLowerCase(), x.cat]));
  for (const { gs, gt } of scelte) {
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

// ------------------------------------------------------------ proposta della settimana
// Distribuisce i giorni della scheda (A, B, C…) sulla settimana partendo dai turni:
// prima i giorni OFF, poi apertura, poi chiusura/altro; mai il giorno di notte e meglio
// non il giorno dopo. Evita due giorni di fila (anche domenica→lunedì) finché può.
// turni: 7 valori da lunedì ('off', 'apertura', 'chiusura', 'notte', '' …).
// Restituisce 7 indici nei giorni della scheda, -1 = riposo.
export function proponiSettimana(turni, nGiorni) {
  const fuori = new Array(7).fill(-1);
  if (!(nGiorni > 0)) return fuori;
  const costo = i => {
    const t = turni[i] || '';
    if (t === 'notte') return Infinity;
    return (t === 'off' ? 0 : t === 'apertura' ? 1 : 2) + (turni[(i + 6) % 7] === 'notte' ? 1 : 0);
  };
  const candidati = [0, 1, 2, 3, 4, 5, 6].filter(i => costo(i) !== Infinity).sort((x, y) => costo(x) - costo(y) || x - y);
  const scelti = [];
  for (const i of candidati) if (scelti.length < nGiorni && !scelti.some(j => (i - j + 7) % 7 === 1 || (j - i + 7) % 7 === 1)) scelti.push(i);
  for (const i of candidati) if (scelti.length < nGiorni && !scelti.includes(i)) scelti.push(i);
  scelti.sort((x, y) => x - y).forEach((i, k) => { fuori[i] = k; });
  return fuori;
}

// Nome della settimana rispetto a quella di oggi ("Prossima settimana", "Tra 3 settimane"…)
// e intervallo di date ("23–29 nov", "30 nov – 6 dic").
export function nomeSettimana(lunedi, lunediOggi) {
  const n = Math.round((Date.parse(lunedi + 'T12:00:00Z') - Date.parse(lunediOggi + 'T12:00:00Z')) / 604800000);
  return n === 0 ? 'Questa settimana' : n === 1 ? 'Prossima settimana' : n === -1 ? 'Settimana scorsa' : n > 1 ? `Tra ${n} settimane` : `${-n} settimane fa`;
}
export function dateSettimana(lunedi) {
  const mese = d => new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')).replace('.', '');
  const dom = shiftDate(lunedi, 6), g = d => Number(d.slice(8));
  return lunedi.slice(5, 7) === dom.slice(5, 7) ? `${g(lunedi)}–${g(dom)} ${mese(dom)}` : `${g(lunedi)} ${mese(lunedi)} – ${g(dom)} ${mese(dom)}`;
}

// Titolo dell'impegno Palestra in Agenda quando cambia l'allenamento del giorno. Si aggiorna
// solo se è "Palestra" o "Palestra · <un giorno di scheda>": un titolo scritto a mano resta.
// Restituisce il nuovo titolo, o null se non va toccato.
export function titoloPalestra(titolo, nomiGiorni, gn) {
  const m = /^Palestra(?:\s*·\s*(.+))?$/.exec(String(titolo || '').trim());
  if (!m || (m[1] && !nomiGiorni.includes(m[1].trim()))) return null;
  const nuovo = gn ? `Palestra · ${gn}` : 'Palestra';
  return nuovo === String(titolo).trim() ? null : nuovo;
}

// ------------------------------------------------------------ importazione del piano alimentare
// File JSON "codemind-piano-alimentare" v1 (alimenti per 100 g, ricette con versione PRE/POST,
// giornate tipo per turno e allenamento, obiettivi). Qui si controlla tutto e si preparano le voci
// dell'archivio con ID stabili (imp-…): importare di nuovo lo stesso file aggiorna, non duplica.
const SLOT_PASTI = PASTI.map(p => p.id);
const CAT_RICETTE = ['colazione', 'spuntino', 'pasto'];
const idSicuro = v => /^[a-z0-9][a-z0-9-]{0,40}$/.test(String(v || ''));
function testoImp(v, max, cosa) { const s = String(v ?? '').trim(); if (!s) throw Error(`Manca ${cosa}.`); return s.slice(0, max); }
function numImp(v, min, max, cosa) { const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw Error(`Valore non valido: ${cosa}.`); return n; }
export function leggiPianoAlimentare(dati) {
  if (!dati || dati.formato !== 'codemind-piano-alimentare') throw Error('Questo file non è un piano alimentare di CodeMind.');
  if (dati.versione !== 1) throw Error('Versione del piano non supportata.');
  const nome = testoImp(dati.nome, 120, 'il nome del piano');
  // alimenti
  const alimenti = new Map();
  for (const x of dati.alimenti || []) {
    if (!idSicuro(x.id) || alimenti.has(x.id)) throw Error(`Alimento con codice non valido o doppio: ${x.id}`);
    const n = testoImp(x.n, 80, `il nome dell'alimento ${x.id}`);
    const v = { k: numImp(x.k, 0, 900, `kcal di ${n}`), p: numImp(x.p, 0, 100, `proteine di ${n}`), c: numImp(x.c, 0, 100, `carboidrati di ${n}`), g: numImp(x.g, 0, 100, `grassi di ${n}`) };
    if (v.p + v.c + v.g > 101) throw Error(`I macro di ${n} superano 100 g.`);
    alimenti.set(x.id, { id: 'imp-a-' + x.id, t: 'a', n, ...v, cat: CATEGORIE.includes(x.cat) ? x.cat : 'Altro', nt: String(x.nt || '').slice(0, 120) });
  }
  if (!alimenti.size) throw Error('Il piano non contiene alimenti.');
  const riga = (r, dove) => {
    const al = alimenti.get(r.a);
    if (!al) throw Error(`${dove}: alimento sconosciuto "${r.a}".`);
    return { n: al.n, q: numImp(r.q, 1, 2000, `grammi di ${al.n} in ${dove}`), k: al.k, p: al.p, c: al.c, g: al.g };
  };
  // ricette (e la loro versione PRE/POST come ricetta a parte)
  const ricette = new Map(), voceRicette = [];
  for (const r of dati.ricette || []) {
    if (!/^[A-Z]\d{1,2}$/.test(String(r.id || '')) || ricette.has(r.id)) throw Error(`Ricetta con codice non valido o doppio: ${r.id}`);
    const n = testoImp(r.n, 90, `il nome della ricetta ${r.id}`), dove = `${r.id} ${n}`;
    const righe = (r.righe || []).map(x => riga(x, dove));
    if (!righe.length) throw Error(`La ricetta ${dove} è vuota.`);
    const base = { id: 'imp-r-' + r.id, t: 'r', n: `${r.id} · ${n}`, cod: r.id, cat: CAT_RICETTE.includes(r.cat) ? r.cat : 'pasto', min: Number(r.min) || 0,
      tag: (r.tag || []).map(String).slice(0, 4), liberi: String(r.liberi || '').slice(0, 200), passi: (r.passi || []).map(s => String(s).slice(0, 400)).slice(0, 8), righe };
    const out = { base, varianti: {} };
    for (const v of r.varianti || []) {
      const tipo = String(v.tipo || '').toUpperCase();
      if (!['PRE', 'POST'].includes(tipo)) throw Error(`${dove}: la versione deve essere PRE o POST.`);
      const vr = (v.righe || []).map(x => riga(x, `${dove} ${tipo}`));
      if (!vr.length) throw Error(`${dove}: la versione ${tipo} è vuota.`);
      out.varianti[tipo] = { ...base, id: `${base.id}-${tipo.toLowerCase()}`, n: `${r.id} ${tipo} · ${n}`, var: tipo, nota: String(v.nota || '').slice(0, 120), righe: vr };
    }
    ricette.set(r.id, out);
    voceRicette.push(base, ...Object.values(out.varianti));
  }
  // giornate tipo: le righe sono quelle delle ricette consigliate, con la fascia del pasto
  const giornate = [];
  for (const g of dati.giornate || []) {
    if (!idSicuro(g.id) || giornate.some(x => x.id === 'imp-gt-' + g.id)) throw Error(`Giornata con codice non valido o doppio: ${g.id}`);
    const n = testoImp(g.n, 80, `il nome della giornata ${g.id}`);
    if (!TURNI_PIANO.includes(g.turno)) throw Error(`${n}: turno non valido (apertura, chiusura, notte, off).`);
    const pasti = [], righe = [];
    for (const p of g.pasti || []) {
      if (!SLOT_PASTI.includes(p.slot)) throw Error(`${n}: pasto "${p.slot}" non valido.`);
      if (pasti.some(x => x.slot === p.slot)) throw Error(`${n}: due pasti nella stessa fascia (${p.slot}).`);
      const r = ricette.get(p.ricetta);
      if (!r) throw Error(`${n}: ricetta ${p.ricetta} non trovata.`);
      const vers = p.variante ? r.varianti[String(p.variante).toUpperCase()] : r.base;
      if (!vers) throw Error(`${n}: la ricetta ${p.ricetta} non ha la versione ${p.variante}.`);
      for (const alt of p.alternative || []) if (!ricette.has(alt)) throw Error(`${n}: alternativa ${alt} non trovata.`);
      pasti.push({ slot: p.slot, ora: String(p.ora || '').slice(0, 5), l: String(p.l || '').slice(0, 40), dove: String(p.dove || '').slice(0, 20), ric: p.ricetta, var: vers.var || '', alt: (p.alternative || []).slice(0, 5) });
      for (const x of vers.righe) righe.push({ slot: p.slot, ...x, ric: p.ricetta });
    }
    if (!righe.length) throw Error(`La giornata ${n} è vuota.`);
    giornate.push({ id: 'imp-gt-' + g.id, t: 'gt', n, tipo: g.turno === 'off' ? 'off' : 'on', turno: g.turno, allena: !!g.allena, orari: String(g.orari || '').slice(0, 120), nota: String(g.nota || '').slice(0, 300), pasti, righe });
  }
  // obiettivi (allenamento e riposo) e profilo
  let target = null;
  if (dati.obiettivi) {
    const o = dati.obiettivi, al = o.allenamento || {}, ri = o.riposo || {};
    target = { base: 'allenamento', kcal: numImp(al.kcal, 800, 6000, 'kcal allenamento'), kcalOff: numImp(ri.kcal, 800, 6000, 'kcal riposo'),
      prot: numImp(al.prot, 0, 500, 'proteine'), carb: numImp(al.carb, 0, 1000, 'carboidrati allenamento'), carbOff: numImp(ri.carb, 0, 1000, 'carboidrati riposo'),
      gras: numImp(al.gras, 0, 400, 'grassi allenamento'), grasOff: numImp(ri.gras, 0, 400, 'grassi riposo') };
    if (al.acqua != null) target.acqua = numImp(al.acqua, 0, 10000, 'acqua allenamento');
    if (ri.acqua != null) target.acquaOff = numImp(ri.acqua, 0, 10000, 'acqua riposo');
  }
  const profilo = dati.profilo?.altezza != null ? { altezza: numImp(dati.profilo.altezza, 100, 250, "l'altezza") } : null;
  return { nome, alimenti: [...alimenti.values()], ricette: voceRicette, giornate, target, profilo, automatico: dati.automatico !== false && giornate.some(g => g.turno),
    riepilogo: { alimenti: alimenti.size, ricette: ricette.size, versioni: voceRicette.length - ricette.size, giornate: giornate.map(g => ({ n: g.n, kcal: r0(somma(g.righe).k) })) } };
}
