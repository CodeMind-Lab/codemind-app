// Scheda A·B·C dentro le Schede: dati letti dalla pagina generata, scheda nell'archivio
// sincronizzata con la fase del calendario, settimana di allenamento che la usa.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const memoria = new Map();
globalThis.localStorage = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const A = await import('../dist/js/utils/schedaAbc.js?v=82');
const U = await import('../dist/js/utils/palestra.js?v=74');
const { state } = await import('../dist/js/services/store.js?v=65');
const P = await import('../dist/js/services/palestraService.js?v=82');

// Dati dalla pagina vera, con stringhe che contengono graffe e virgolette.
const html = readFileSync(new URL('../dist/scheda-abc/index.html', import.meta.url), 'utf8');
const dati = A.estraiDati(html);
assert.ok(dati.fasi.length >= 3);
assert.deepEqual(A.estraiDati('<script>const DATI = {"fasi":[{"id":"x","nome":"}{\\"","sessioni":{}}]};</script>').fasi[0].nome, '}{"');
assert.throws(() => A.estraiDati('<html></html>'), /non trovo i dati/);
assert.throws(() => A.estraiDati('const DATI = {"fasi":['), /incompleti/);

// Fase del calendario: dentro, prima dell'inizio, dopo la fine.
const [f1] = dati.fasi, ultima = dati.fasi[dati.fasi.length - 1];
assert.equal(A.faseDelGiorno(dati, f1.dal).id, f1.id);
assert.equal(A.faseDelGiorno(dati, '2020-01-01').id, f1.id);
assert.equal(A.faseDelGiorno(dati, '2099-01-01').id, ultima.id);

state.mode = 'demo'; state.formaArchive = null; state.sportConnection = null; state.timezone = 'Europe/Rome';
await P.creaArchivio();

// Prima sincronizzazione: scheda con i tre giorni A, B, C; la seconda non scrive.
assert.equal(P.sincronizzaSchedaAbc(dati, f1.dal), true);
assert.equal(P.sincronizzaSchedaAbc(dati, f1.dal), false);
let s = P.archivio().items.find(i => i.id === A.ID_ABC);
assert.equal(s.t, 's'); assert.equal(s.n, 'Scheda A·B·C'); assert.equal(s.abc.fase, f1.id);
assert.deepEqual(s.giorni.map(g => g.n), ['A · Forza', 'B · Volume', 'C · Pompaggio']);
const squat = s.giorni[0].eser[0];
assert.equal(squat.n, f1.sessioni.A.righe[0].nome); assert.equal(squat.serie, f1.sessioni.A.righe[0].serie); assert.equal(squat.rec, f1.sessioni.A.righe[0].rec);
assert.match(squat.note, /RPE/);

// Lunedì: aggiungo l'allenamento e scelgo la scheda A.
P.impostaGiornoSettimana('lun', A.ID_ABC, 'A · Forza');
P.impostaGiornoSettimana('mer', A.ID_ABC, 'B · Volume');
const lunedi = '2026-11-23';
assert.equal(U.allenamentoDelGiorno(P.archivio(), lunedi).giorno.n, 'A · Forza');
const w = P.avviaAllenamento(lunedi, A.ID_ABC, 'A · Forza');
assert.equal(w.sn, 'Scheda A·B·C'); assert.equal(w.eser.length, f1.sessioni.A.righe.length);

// Si cambiano solo i kg; il resto viene dalla pagina.
P.aggiornaEsercizio(A.ID_ABC, 0, 0, { peso: '60' });
assert.throws(() => P.aggiornaEsercizio(A.ID_ABC, 0, 0, { serie: 5 }), /solo i kg/);
assert.throws(() => P.rinominaScheda(A.ID_ABC, 'Altro'), /solo i kg/);
assert.throws(() => P.aggiungiGiorno(A.ID_ABC, 'D'), /solo i kg/);
assert.throws(() => P.eliminaScheda(A.ID_ABC), /solo i kg/);
assert.throws(() => P.aggiungiEsercizio(A.ID_ABC, 0, 'Panca'), /solo i kg/);

// Cambio di fase: esercizi aggiornati, kg tenuti, settimana intatta.
const f2 = dati.fasi[1];
assert.equal(P.sincronizzaSchedaAbc(dati, f2.dal), true);
s = P.archivio().items.find(i => i.id === A.ID_ABC);
assert.equal(s.abc.fase, f2.id);
assert.equal(s.giorni[0].eser[0].serie, f2.sessioni.A.righe[0].serie);
assert.equal(s.giorni[0].eser[0].peso, 60);
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'lun').gn, 'A · Forza');
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'mer').gn, 'B · Volume');

// La copia è una scheda normale, modificabile.
const copia = P.duplicaScheda(A.ID_ABC);
assert.equal(copia.abc, undefined);
P.rinominaScheda(copia.id, 'Mia A·B·C'); P.aggiungiGiorno(copia.id, 'D');
assert.equal(P.sincronizzaSchedaAbc(dati, f2.dal), false);

// Se la pagina perde un giorno, i giorni della settimana che lo usavano tornano a riposo.
const senzaC = structuredClone(dati); for (const f of senzaC.fasi) delete f.sessioni.C;
P.impostaGiornoSettimana('ven', A.ID_ABC, 'C · Pompaggio');
assert.equal(P.sincronizzaSchedaAbc(senzaC, f2.dal), true);
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'ven').sid, '');
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'lun').sid, A.ID_ABC);

await P.salva();
console.log('schedaAbc: ok');
