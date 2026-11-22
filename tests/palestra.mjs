// Palestra e alimentazione: calcoli sul diario e scritture nell'archivio di Forma.
import assert from 'node:assert/strict';
const memoria = new Map();
globalThis.localStorage = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const { macro, somma, riepilogoGiorno, turnoDi, obiettivoKcal, cfg, catalogo, cerca, recenti, settimana, pesoAttuale, allenamentoDelGiorno, righePiano, gsDiData, lunediDi, prodottoDaOFF, slotOra } = await import('../dist/js/utils/palestra.js?v=75');
const { state } = await import('../dist/js/services/store.js?v=65');
const svc = await import('../dist/js/services/palestraService.js?v=83');

// --- calcoli puri
assert.deepEqual(macro({ q: 150, k: 100, p: 23, c: 0, g: 1.2 }), { k: 150, p: 34.5, c: 0, g: 1.7999999999999998 });
assert.equal(Math.round(somma([{ q: 200, k: 11, p: 1.3, c: 1.4, g: 0.1 }, { q: 10, k: 899, p: 0, c: 0, g: 99.9 }]).k), 112);
assert.equal(gsDiData('2026-11-20'), 'ven'); assert.equal(lunediDi('2026-11-22'), '2026-11-16'); assert.equal(lunediDi('2026-11-16'), '2026-11-16');
assert.equal(slotOra(8), 'colazione'); assert.equal(slotOra(13), 'pranzo'); assert.equal(slotOra(23), 'spuntino3');

const arch = {
  version: 1, settings: {}, graves: {}, items: [
    { id: 'cfg', t: 'cfg', target: { kcal: 2100, kcalOff: 1850 } },
    { id: 'l1', t: 'l', d: '2026-11-20', slot: 'pranzo', n: 'Petto di pollo', q: 150, k: 100, p: 23, c: 0, g: 1.2, updatedAt: 5 },
    { id: 'l2', t: 'l', d: '2026-11-20', slot: 'pranzo', n: 'Olio di oliva extra vergine', q: 10, k: 899, p: 0, c: 0, g: 99.9, updatedAt: 6 },
    { id: 'l3', t: 'l', d: '2026-11-19', slot: 'cena', n: 'Petto di pollo', q: 200, k: 100, p: 23, c: 0, g: 1.2, updatedAt: 1 },
    { id: 'g-2026-11-21', t: 'g', d: '2026-11-21', acqua: 500, passi: 3000, turno: 'cm-work-off' },
    { id: 'gt1', t: 'gt', n: 'Giorno on', righe: [{ slot: 'cena', n: 'Salmone', q: 150, k: 185, p: 20, c: 0, g: 12 }, { slot: 'colazione', n: 'Yogurt greco 0% grassi', q: 170, k: 59, p: 10.3, c: 3.6, g: 0.4 }] },
    { id: 'piano-ven', t: 'p', gs: 'ven', gt: 'gt1' },
    { id: 's1', t: 's', n: 'PPL', giorni: [{ n: 'Push A', eser: [{ n: 'Panca piana', serie: 4, rip: '8-10', peso: 60 }] }] },
    { id: 'allena-ven', t: 'pa', gs: 'ven', sid: 's1', gn: 'Push A' },
    { id: 'w1', t: 'w', d: '2026-11-18', sid: 's1', gn: 'Push A', fine: true, eser: [] },
    { id: 'm1', t: 'm', d: '2026-11-01', peso: 79 }, { id: 'm2', t: 'm', d: '2026-11-19', peso: 78.4 },
    { id: 'a1', t: 'a', n: 'Petto di pollo', k: 110, p: 24, c: 0, g: 1.5, cat: 'Carne', ean: '8001234567892' },
  ],
};
const rg = riepilogoGiorno(arch, '2026-11-20');
assert.equal(rg.righe.length, 2); assert.equal(rg.olio, 10); assert.equal(Math.round(rg.tot.k), 240);
assert.equal(rg.perPasto.find(p => p.id === 'pranzo').righe.length, 2); assert.equal(rg.perPasto.length, 6);
// Il turno viene dall'Agenda; senza voce si usa quello scritto nell'archivio.
const voci = [{ entry_date: '2026-11-20', kind: 'shift', starts_at: '2026-11-20T14:30:00Z', ends_at: '2026-11-20T22:30:00Z' }];
assert.equal(turnoDi(arch, '2026-11-20', voci, 'Europe/Rome'), 'chiusura');
assert.equal(turnoDi(arch, '2026-11-21', [], 'Europe/Rome'), 'off');
assert.equal(obiettivoKcal(arch, 'off'), 1850); assert.equal(obiettivoKcal(arch, 'chiusura'), 2100); assert.equal(cfg(arch).target.prot, 130);
// Catalogo: il tuo "Petto di pollo" sostituisce quello del CREA.
const cat = catalogo(arch), polli = cat.filter(x => x.n === 'Petto di pollo');
assert.equal(polli.length, 1); assert.equal(polli[0].mio, true); assert.ok(cat.length > 800);
assert.equal(cerca(cat, 'petto pollo')[0].n, 'Petto di pollo'); assert.equal(cerca(cat, 'pollo petto')[0].n, 'Pollo, petto, crudo'); assert.ok(cerca(cat, 'parmig').some(x => /Parmigiano/.test(x.n))); assert.deepEqual(cerca(cat, '  '), []);
assert.deepEqual(recenti(arch).map(r => r.n), ['Olio di oliva extra vergine', 'Petto di pollo']); assert.equal(recenti(arch)[1].q, 150);
assert.equal(righePiano(arch, '2026-11-20', 'cena')[0].n, 'Salmone'); assert.equal(righePiano(arch, '2026-11-21').length, 0);
assert.equal(allenamentoDelGiorno(arch, '2026-11-20').giorno.n, 'Push A'); assert.equal(allenamentoDelGiorno(arch, '2026-11-19'), null);
const sett = settimana(arch, '2026-11-16');
assert.equal(sett[3].kcal, 200); assert.equal(sett[2].allenato, true); assert.equal(sett[4].previsto, true); assert.equal(sett[0].kcal, null);
assert.deepEqual(pesoAttuale(arch, '2026-11-20'), { peso: 78.4, d: '2026-11-19', delta: -0.6, dal: '2026-11-01' });
// Open Food Facts: kcal ricavate dai kJ quando mancano, marca nel nome.
const off = prodottoDaOFF({ status: 1, product: { product_name: 'Skyr', brands: 'Exquisa, X', nutriments: { energy_100g: 263.6, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 }, categories_tags: ['en:yogurts'] } }, '4019300005307');
assert.deepEqual(off, { n: 'Skyr · Exquisa', k: 63, p: 11, c: 4, g: 0.2, cat: 'Latticini/Uova', nt: '', ean: '4019300005307' });
assert.equal(prodottoDaOFF({ status: 0 }, '1'), null);

// --- scritture (modalità locale, come nei test degli altri servizi)
state.mode = 'demo'; state.formaArchive = null; state.sportConnection = null; state.timezone = 'Europe/Rome';
assert.throws(() => svc.cambiaAcqua('2026-11-20', 250), /backup di Forma/);
await svc.creaArchivio();
assert.equal(svc.archivio().items.find(i => i.t === 'cfg').target.kcal, 2000);
await assert.rejects(svc.creaArchivio(), /esiste già/);
// Tre tocchi di fila: si vedono subito e si salvano una volta sola.
svc.cambiaAcqua('2026-11-20', 250); svc.cambiaAcqua('2026-11-20', 250); svc.cambiaAcqua('2026-11-20', -100);
assert.equal(svc.archivio().items.find(i => i.id === 'g-2026-11-20').acqua, 400);
assert.equal(svc.inAttesa(), true);
const rev = state.formaArchive.revision;
await svc.salva();
assert.equal(state.formaArchive.revision, rev + 1); assert.equal(svc.inAttesa(), false);
assert.equal(state.formaArchive.archive.items.find(i => i.id === 'g-2026-11-20').acqua, 400);
// Diario
const r = svc.aggiungiRiga('2026-11-20', 'pranzo', { n: 'Riso basmati', k: 350, p: 7, c: 78, g: 0.6 }, '80');
assert.equal(r.q, 80);
assert.throws(() => svc.aggiungiRiga('2026-11-20', 'merenda', { n: 'X', k: 1, p: 0, c: 0, g: 0 }, 10), /Scegli il pasto/);
assert.throws(() => svc.aggiungiRiga('2026-11-20', 'cena', { n: 'X', k: 1, p: 0, c: 0, g: 0 }, 0), /grammi/);
assert.throws(() => svc.aggiungiRiga('2026-11-20', 'cena', { n: '', k: 1, p: 0, c: 0, g: 0 }, 10), /nome/);
svc.modificaRiga(r.id, { q: '90,5', slot: 'cena' });
let riga = svc.archivio().items.find(i => i.id === r.id);
assert.equal(riga.q, 90.5); assert.equal(riga.slot, 'cena');
svc.eliminaRiga(r.id);
assert.equal(svc.archivio().items.some(i => i.id === r.id), false); assert.ok(svc.archivio().graves[r.id]);
await svc.salva();
assert.equal(state.formaArchive.archive.items.some(i => i.id === r.id), false);
// Alimenti personali e codice a barre
const mio = svc.salvaAlimento({ n: 'Skyr · Exquisa', k: 63, p: 11, c: 4, g: 0.2, cat: 'Latticini/Uova', ean: '4019300005307' });
assert.equal(svc.alimentoDaCodice(svc.archivio(), '4019300005307').id, mio.id);
assert.throws(() => svc.salvaAlimento({ n: 'skyr · exquisa', k: 63, p: 11, c: 4, g: 0.2 }), /già un alimento/);
assert.throws(() => svc.salvaAlimento({ n: 'Altro skyr', k: 63, p: 11, c: 4, g: 0.2, ean: '123' }), /codice a barre/);
assert.throws(() => svc.salvaAlimento({ n: 'Strano', k: 1200, p: 0, c: 0, g: 0 }), /kcal/);
svc.salvaAlimento({ n: 'Skyr Exquisa', k: 64, p: 11, c: 4, g: 0.2, cat: 'Latticini/Uova', ean: '' }, mio);
const aggiornato = svc.archivio().items.find(i => i.id === mio.id);
assert.equal(aggiornato.n, 'Skyr Exquisa'); assert.equal(aggiornato.ean, undefined);
// Piano: un pasto sostituisce quello già scritto e lo segna come fatto.
svc.salvaObiettivi({ kcal: 2100, kcalOff: 1850, prot: 140, carb: 210, gras: 60, acqua: 2500, passi: 9000, olio: 25, nome: 'Renato', altezza: 178, pesoObiettivo: 75, giroObiettivo: 88 });
assert.equal(cfg(svc.archivio()).target.prot, 140); assert.equal(cfg(svc.archivio()).profilo.altezza, 178);
assert.throws(() => svc.salvaObiettivi({ kcal: 100 }), /kcal/);
await svc.salva();
const conPiano = structuredClone(state.formaArchive.archive);
conPiano.items.push({ id: 'gt1', t: 'gt', n: 'Giorno on', righe: arch.items.find(i => i.id === 'gt1').righe }, { id: 'piano-ven', t: 'p', gs: 'ven', gt: 'gt1' });
state.formaArchive = { ...state.formaArchive, archive: conPiano };
svc.aggiungiRiga('2026-11-20', 'cena', { n: 'Pizza', k: 250, p: 10, c: 30, g: 9 }, 300);
assert.equal(svc.applicaPasto(svc.archivio(), '2026-11-20', 'cena'), 1);
const cena = svc.archivio().items.filter(i => i.t === 'l' && i.d === '2026-11-20' && i.slot === 'cena');
assert.deepEqual(cena.map(i => i.n), ['Salmone']); assert.deepEqual(svc.archivio().items.find(i => i.id === 'g-2026-11-20').pasti, ['cena']);
assert.throws(() => svc.applicaPasto(svc.archivio(), '2026-11-20', 'pranzo'), /non prevede/);
assert.equal(svc.applicaPiano(svc.archivio(), '2026-11-20'), 2);
assert.equal(svc.archivio().items.filter(i => i.t === 'l' && i.d === '2026-11-20').length, 2);
assert.throws(() => svc.applicaPiano(svc.archivio(), '2026-11-21'), /non ha una giornata/);
assert.equal(svc.aggiungiRicetta('2026-11-21', 'pranzo', { n: 'Bowl', righe: [{ n: 'Riso', q: 80, k: 350, p: 7, c: 78, g: 0.6 }, { n: 'Tonno', q: 80, k: 103, p: 25, c: 0, g: 0.3 }] }), 2);
svc.impostaPassi('2026-11-21', '7500');
assert.equal(svc.archivio().items.find(i => i.id === 'g-2026-11-21').passi, 7500);
await svc.salva();
assert.equal(state.formaArchive.archive.items.filter(i => i.t === 'l' && i.d === '2026-11-21').length, 2);
// Offline nel cloud: la modifica resta in attesa sul dispositivo, poi Scarta torna al salvato.
state.mode = 'cloud'; state.user = { id: 'u1' }; Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
svc.cambiaAcqua('2026-11-21', 250);
await assert.rejects(svc.salva(), /offline/);
assert.equal(svc.inAttesa(), true); assert.equal(svc.statoSalvataggio.stato, 'errore');
assert.equal(svc.archivio().items.find(i => i.id === 'g-2026-11-21').acqua, 250);
svc.scarta();
assert.equal(svc.inAttesa(), false); assert.equal(svc.archivio().items.find(i => i.id === 'g-2026-11-21').acqua, 0);
console.log('PASS: Palestra — totali del diario, olio, turno e obiettivo del giorno, catalogo con i tuoi alimenti, ricerca, recenti, piano e allenamento del giorno, peso, Open Food Facts; scritture raggruppate, controlli, alimenti con codice a barre, piano per pasto e per giorno, ricette, attesa offline e scarto.');
