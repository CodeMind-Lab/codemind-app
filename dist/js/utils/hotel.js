// Calcoli di Lavoro Hotel. Funzioni pure (niente pagina, niente database), così si
// provano nei test e restano uguali sul Mac e sull'iPhone.
//
// Il contratto di Renato è a paga fissa: lo stipendio previsto è il netto mensile più
// le mensilità in più (13ª, 14ª) nei loro mesi. Ore, notturne, festive e straordinari
// servono a controllare la busta paga, non a calcolarla.
import { wallTime, weekStart } from './agenda.js?v=65';
import { shiftDate } from './dates.js?v=65';

export const CONTRATTO_BASE = Object.freeze({
  netto_mensile: null, lordo_mensile: null, mensilita_extra: [], ore_giornaliere: 8, ore_settimanali: 40,
  notte_inizio: '22:00', notte_fine: '06:00', ferie_giorni_anno: null, permessi_ore_anno: null,
  ferie_saldo_iniziale: 0, permessi_saldo_iniziale: 0, anno_saldo: null,
});
export const contrattoDi = c => ({ ...CONTRATTO_BASE, ...(c || {}) });

// Domenica di Pasqua (algoritmo di Meeus/Jones/Butcher): serve per Pasquetta.
export function pasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}
const cacheFestivi = new Map();
// Festività nazionali italiane. Il patrono locale non c'è: cambia da città a città.
export function festivi(anno) {
  if (!cacheFestivi.has(anno)) {
    const p = pasqua(anno);
    const fissi = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].map(x => `${anno}-${x}`);
    cacheFestivi.set(anno, new Set([...fissi, p, shiftDate(p, 1)]));
  }
  return cacheFestivi.get(anno);
}
export const eFestivo = data => festivi(Number(data.slice(0, 4))).has(data);

// Minuti di un turno, di cui notturni e festivi. Si guarda un quarto d'ora alla volta
// nell'ora di Roma: così la Notte 23:30–07:30 e i cambi d'ora vengono giusti da soli.
const PASSO = 15;
export function dettaglioTurno(voce, tz, contratto) {
  const c = contrattoDi(contratto);
  const ni = String(c.notte_inizio).slice(0, 5), nf = String(c.notte_fine).slice(0, 5);
  const inizio = Date.parse(voce.starts_at), fine = Date.parse(voce.ends_at);
  let notte = 0, festivo = 0;
  for (let t = inizio; t < fine; t += PASSO * 60000) {
    const w = wallTime(new Date(t).toISOString(), tz), giorno = w.slice(0, 10), h = w.slice(11, 16);
    if (ni > nf ? (h >= ni || h < nf) : (h >= ni && h < nf)) notte += PASSO;
    if (eFestivo(giorno)) festivo += PASSO;
  }
  return { totale: Math.round((fine - inizio) / 60000), notte, festivo };
}

// Riepilogo di un mese ("2026-11"): ore fatte e in calendario, notturne, festive,
// straordinari. Gli straordinari si contano per settimana (lunedì–domenica) oltre le
// ore settimanali del contratto, più eventuali ore oltre le ore giornaliere in un turno;
// una settimana a cavallo tra due mesi va nel mese in cui finisce.
export function riepilogoMese(voci, contratto, mese, tz, adesso = Date.now()) {
  const c = contrattoDi(contratto);
  const turni = voci.filter(v => v.kind === 'shift' && v.starts_at && v.ends_at);
  const delMese = turni.filter(v => v.entry_date?.startsWith(mese)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const r = { turni: [], minuti: 0, minutiFatti: 0, notte: 0, festivo: 0, straordinari: 0, fatti: 0, inCalendario: 0, off: 0 };
  for (const v of delMese) {
    const d = dettaglioTurno(v, tz, c), fatto = Date.parse(v.ends_at) <= adesso;
    const oltre = Math.max(0, d.totale - c.ore_giornaliere * 60);
    r.turni.push({ voce: v, ...d, fatto, oltreGiorno: oltre });
    r.minuti += d.totale; r.notte += d.notte; r.festivo += d.festivo; r.straordinari += oltre;
    if (fatto) { r.minutiFatti += d.totale; r.fatti++; } else r.inCalendario++;
  }
  r.off = voci.filter(v => v.kind === 'off' && v.entry_date?.startsWith(mese)).length;
  // settimane che finiscono in questo mese
  const settimane = new Map();
  for (const v of turni) {
    const lun = weekStart(v.entry_date), dom = shiftDate(lun, 6);
    if (!dom.startsWith(mese)) continue;
    settimane.set(lun, (settimane.get(lun) || 0) + Math.min(dettaglioTurno(v, tz, c).totale, c.ore_giornaliere * 60));
  }
  r.settimane = [...settimane].map(([lun, minuti]) => ({ lun, minuti, oltre: Math.max(0, minuti - c.ore_settimanali * 60) }));
  r.straordinari += r.settimane.reduce((s, x) => s + x.oltre, 0);
  return r;
}

// Stipendio previsto di un mese: netto fisso più le mensilità in più che cadono lì.
export function stipendioPrevisto(contratto, mese) {
  const c = contrattoDi(contratto);
  if (c.netto_mensile == null) return null;
  const numero = Number(mese.slice(5, 7)), base = Number(c.netto_mensile);
  const extra = (c.mensilita_extra || []).filter(m => Number(m.mese) === numero).map(m => ({ nome: m.nome, importo: base }));
  return { base, extra, totale: base + extra.reduce((s, x) => s + x.importo, 0) };
}

// Ferie (giorni) e permessi (ore) dell'anno: saldo di partenza, maturati fino a fine
// del mese corrente, goduti finora, già segnati più avanti e residui. Il residuo di un
// anno diventa il saldo dell'anno dopo.
export function saldi(contratto, assenze, anno, oggi) {
  const c = contrattoDi(contratto);
  const annoBase = c.anno_saldo || anno;
  const calcola = a => {
    const inizioFerie = a <= annoBase ? Number(c.ferie_saldo_iniziale || 0) : calcola(a - 1).ferie.residue;
    const inizioPermessi = a <= annoBase ? Number(c.permessi_saldo_iniziale || 0) : calcola(a - 1).permessi.residui;
    const meseOggi = Number(oggi.slice(0, 4)) > a ? 12 : Number(oggi.slice(0, 4)) < a ? 0 : Number(oggi.slice(5, 7));
    const dellAnno = assenze.filter(x => x.data.startsWith(String(a)));
    const passate = dellAnno.filter(x => x.data <= oggi), future = dellAnno.filter(x => x.data > oggi);
    const conta = (lista, tipo) => lista.filter(x => x.tipo === tipo).length;
    const ore = (lista, tipo) => lista.filter(x => x.tipo === tipo).reduce((s, x) => s + Number(x.ore || 0), 0);
    const ferieMaturate = Number(c.ferie_giorni_anno || 0) * meseOggi / 12;
    const permessiMaturati = Number(c.permessi_ore_anno || 0) * meseOggi / 12;
    return {
      ferie: { iniziali: inizioFerie, maturate: ferieMaturate, godute: conta(passate, 'ferie'), pianificate: conta(future, 'ferie'), residue: inizioFerie + ferieMaturate - conta(passate, 'ferie') - conta(future, 'ferie') },
      permessi: { iniziali: inizioPermessi, maturati: permessiMaturati, goduti: ore(passate, 'permesso'), pianificati: ore(future, 'permesso'), residui: inizioPermessi + permessiMaturati - ore(passate, 'permesso') - ore(future, 'permesso') },
      malattia: conta(dellAnno, 'malattia'),
    };
  };
  return calcola(anno);
}

export const minutiInOre = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`; };
export const euro = n => n == null ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
