// Piano alimentare da file: controllo del file, importazione ripetibile, obiettivi da
// allenamento/riposo e giornata tipo scelta dal turno e dall'allenamento del giorno.
import assert from 'node:assert/strict';
const memoria = new Map();
globalThis.localStorage = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const U = await import('../dist/js/utils/palestra.js?v=77');
const { state } = await import('../dist/js/services/store.js?v=65');
const P = await import('../dist/js/services/palestraService.js?v=85');

const piano = () => ({
  formato: 'codemind-piano-alimentare', versione: 1, nome: 'Piano di prova',
  obiettivi: { riposo: { kcal: 1650, prot: 160, carb: 118, gras: 60, acqua: 2500 }, allenamento: { kcal: 2000, prot: 160, carb: 195, gras: 65, acqua: 3000 } },
  profilo: { altezza: 174 },
  alimenti: [
    { id: 'pasta', n: 'Pasta di semola', k: 355, p: 12.6, c: 71.7, g: 1.6, cat: 'Cereali' },
    { id: 'pollo', n: 'Petto di pollo', k: 110, p: 23, c: 0.6, g: 1.3, cat: 'Carne' },
    { id: 'skyr', n: 'Skyr bianco', k: 63, p: 11.1, c: 3.9, g: 0.3, cat: 'Latticini/Uova' },
    { id: 'banana', n: 'Banana', k: 85, p: 0.9, c: 19.9, g: 0, cat: 'Frutta/Verdura' },
  ],
  ricette: [
    { id: 'C1', n: 'Skyr', cat: 'colazione', righe: [{ a: 'skyr', q: 250 }], varianti: [{ tipo: 'PRE', nota: '+ 125 g banana', righe: [{ a: 'skyr', q: 250 }, { a: 'banana', q: 125 }] }] },
    { id: 'P1', n: 'Pasta e pollo', cat: 'pasto', righe: [{ a: 'pasta', q: 35 }, { a: 'pollo', q: 150 }], varianti: [{ tipo: 'POST', righe: [{ a: 'pasta', q: 90 }, { a: 'pollo', q: 150 }] }] },
  ],
  giornate: [
    { id: 'apertura-riposo', n: 'Apertura · Riposo', turno: 'apertura', allena: false, pasti: [{ slot: 'colazione', ora: '06:00', ricetta: 'C1' }, { slot: 'pranzo', ora: '13:00', ricetta: 'P1', alternative: ['C1'] }] },
    { id: 'apertura-allenamento', n: 'Apertura · Allenamento', turno: 'apertura', allena: true, pasti: [{ slot: 'colazione', ricetta: 'C1', variante: 'PRE' }, { slot: 'cena', ricetta: 'P1', variante: 'POST' }] },
    { id: 'notte-riposo', n: 'Notte · Riposo', turno: 'notte', allena: false, pasti: [{ slot: 'spuntino3', ricetta: 'C1' }] },
  ],
});

// --- lettura e controlli
const x = U.leggiPianoAlimentare(piano());
assert.equal(x.alimenti.length, 4); assert.equal(x.ricette.length, 4); assert.equal(x.giornate.length, 3);
assert.deepEqual(x.ricette.map(r => r.n), ['C1 · Skyr', 'C1 PRE · Skyr', 'P1 · Pasta e pollo', 'P1 POST · Pasta e pollo']);
const gAll = x.giornate.find(g => g.allena);
assert.deepEqual(gAll.righe.map(r => [r.slot, r.n, r.q]), [['colazione', 'Skyr bianco', 250], ['colazione', 'Banana', 125], ['cena', 'Pasta di semola', 90], ['cena', 'Petto di pollo', 150]]);
assert.equal(gAll.righe[2].k, 355); assert.equal(gAll.tipo, 'on'); assert.equal(gAll.turno, 'apertura');
assert.deepEqual(x.target, { base: 'allenamento', kcal: 2000, kcalOff: 1650, prot: 160, carb: 195, carbOff: 118, gras: 65, grasOff: 60, acqua: 3000, acquaOff: 2500 });
const rotto = (f, re) => { const d = piano(); f(d); assert.throws(() => U.leggiPianoAlimentare(d), re); };
assert.throws(() => U.leggiPianoAlimentare({ formato: 'altro' }), /non è un piano alimentare/);
rotto(d => { d.versione = 2; }, /Versione/);
rotto(d => { d.alimenti[0].g = 120; }, /grassi di Pasta/);
rotto(d => { d.alimenti[0].p = 50; d.alimenti[0].c = 60; }, /superano 100 g/);
rotto(d => { d.ricette[1].righe[0].a = 'riso'; }, /alimento sconosciuto "riso"/);
rotto(d => { d.giornate[0].pasti[1].ricetta = 'P9'; }, /ricetta P9 non trovata/);
rotto(d => { d.giornate[0].pasti[1].variante = 'PRE'; }, /non ha la versione PRE/);
rotto(d => { d.giornate[0].turno = 'pomeriggio'; }, /turno non valido/);
rotto(d => { d.giornate[0].pasti[1].slot = 'colazione'; }, /stessa fascia/);
rotto(d => { d.giornate[0].pasti[1].alternative = ['X1']; }, /alternativa X1/);

// --- obiettivi del giorno
const arch = { items: [{ id: 'cfg', t: 'cfg', target: { kcal: 2100, kcalOff: 1850, carb: 200 } }] };
assert.equal(U.obiettiviGiorno(arch, { turno: 'off' }).kcal, 1850); assert.equal(U.obiettiviGiorno(arch, { turno: 'chiusura', allena: true }).kcal, 2100);
arch.items[0].target = { ...arch.items[0].target, ...x.target };
const rip = U.obiettiviGiorno(arch, { turno: 'chiusura', allena: false }), all = U.obiettiviGiorno(arch, { turno: 'off', allena: true });
assert.deepEqual([rip.kcal, rip.prot, rip.carb, rip.gras, rip.acqua, rip.chi], [1650, 160, 118, 60, 2500, 'riposo']);
assert.deepEqual([all.kcal, all.carb, all.gras, all.acqua, all.chi], [2000, 195, 65, 3000, 'allenamento']);
assert.equal(U.obiettivoKcal(arch, 'off', true), 2000);

// --- importazione nell'archivio: nuova, ripetuta, con un tuo alimento dallo stesso nome
state.mode = 'demo'; state.formaArchive = null; state.timezone = 'Europe/Rome';
await P.creaArchivio();
P.salvaAlimento({ n: 'banana', k: 89, p: 1.1, c: 22.8, g: 0.3, cat: 'Frutta/Verdura' });
const mia = P.archivio().items.find(i => i.t === 'a' && i.n === 'banana').id;
let r = P.importaPianoAlimentare(piano());
assert.equal(r.nuovi, 3 + 4 + 3); assert.equal(r.aggiornati, 1); assert.equal(r.ricette, 2); assert.equal(r.versioni, 2);
assert.equal(P.archivio().items.find(i => i.id === mia).k, 85, 'il tuo alimento con lo stesso nome viene aggiornato');
r = P.importaPianoAlimentare(piano());
assert.equal(r.nuovi, 0); assert.equal(r.aggiornati, 11);
assert.equal(P.archivio().items.filter(i => i.t === 'gt').length, 3, 'reimportare non duplica');
const c = U.cfg(P.archivio());
assert.equal(c.target.base, 'allenamento'); assert.equal(c.target.kcalOff, 1650); assert.equal(c.profilo.altezza, 174); assert.equal(c.target.passi, 8000, 'gli altri obiettivi restano');
assert.equal(U.pianoAutomatico(P.archivio()), true);
assert.equal(U.ricette(P.archivio()).length, 4);

// --- giornata scelta dal turno e dall'allenamento (2026-11-23 è lunedì)
const sc = P.archivio().items.find(i => i.t === 's') || P.creaScheda('Prova');
P.aggiungiGiorno(sc.id, 'A'); P.impostaGiornoData('2026-11-23', sc.id, 'A');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-23', 'apertura').n, 'Apertura · Allenamento');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-24', 'apertura').n, 'Apertura · Riposo');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-25', 'notte').n, 'Notte · Riposo');
P.impostaGiornoData('2026-11-26', sc.id, 'A');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-26', 'notte').n, 'Notte · Riposo', 'mai allenamento attorno a una Notte');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-24', 'chiusura'), null, 'turno senza giornata: resta il giorno della settimana');
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-24'), null, 'turno sconosciuto: niente scelta automatica');
assert.deepEqual(U.righePiano(P.archivio(), '2026-11-23', 'cena', 'apertura').map(r => r.q), [90, 150]);
assert.equal(P.applicaPiano(P.archivio(), '2026-11-23', 'apertura'), 4);
assert.equal(P.archivio().items.filter(i => i.t === 'l' && i.d === '2026-11-23').length, 4);
P.impostaPianoAutomatico(false);
assert.equal(U.giornataDelPiano(P.archivio(), '2026-11-23', 'apertura'), null);
// Spesa sulle giornate scelte dai turni.
const g1 = P.archivio().items.find(i => i.id === 'imp-gt-apertura-allenamento').id;
const voci = U.spesa(P.archivio(), ['lun', 'mar'], [{ gs: 'lun', gt: g1 }, { gs: 'mar', gt: g1 }]).flatMap(g => g.voci);
assert.equal(voci.find(v => v.n === 'Pasta di semola').q, 180);
// Obiettivi salvati dal modulo: base allenamento con i valori di riposo.
P.salvaObiettivi({ base: 'allenamento', kcal: 2050, kcalOff: 1700, prot: 160, carb: 200, carbOff: '', gras: 65, grasOff: 60, acqua: 3000, acquaOff: 2500, passi: 8000, olio: 25, altezza: 174, pesoObiettivo: 80, giroObiettivo: 90 });
const t2 = U.cfg(P.archivio()).target;
assert.equal(t2.base, 'allenamento'); assert.equal(t2.carbOff, undefined); assert.equal(U.obiettiviGiorno(P.archivio(), { allena: false }).carb, 200);
console.log('PASS: Piano alimentare — controllo del file, ricette con PRE/POST, importazione ripetibile senza doppioni, alimento omonimo aggiornato, obiettivi allenamento/riposo, giornata dal turno e dall\'allenamento, Notte sempre a riposo, spesa sulle giornate scelte.');
