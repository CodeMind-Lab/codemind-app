// Palestra, tappa 2: sessioni di allenamento, schede e settimana di allenamento.
import assert from 'node:assert/strict';
const memoria = new Map();
globalThis.localStorage = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: k => memoria.delete(k) };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const U = await import('../dist/js/utils/palestra.js?v=76');
const { state } = await import('../dist/js/services/store.js?v=65');
const P = await import('../dist/js/services/palestraService.js?v=84');

assert.equal(U.gruppoDi('Squat con bilanciere'), 'Gambe (Legs)'); assert.equal(U.nomeGruppo('Gambe (Legs)'), 'Gambe'); assert.equal(U.gruppoDi('Mio esercizio'), 'Altro');
assert.equal(U.isCardio({ n: 'Corsa' }), true); assert.equal(U.isCardio({ n: 'Panca' }), false); assert.equal(U.isCardio({ n: 'Cyclette leggera' }), true);
assert.equal(U.ripNumero('8–10'), 8); assert.equal(U.ripNumero('Max'), ''); assert.equal(U.fmtRec(90), '1′30'); assert.equal(U.fmtRec(120), '2′'); assert.equal(U.fmtRec(45), '45″');
assert.deepEqual(U.statSessione({ eser: [{ sets: [{ r: 10, w: 60, ok: true }, { r: 8, w: 65, ok: true }, { r: 8, w: 70, ok: false }] }, { min: 20, km: 3 }], dur: 50 }),
  { serie: 2, volume: 1120, ripetizioni: 18, min: 20, km: 3, max: 65, esercizi: 2, dur: 50 });

state.mode = 'demo'; state.formaArchive = null; state.sportConnection = null; state.timezone = 'Europe/Rome';
await P.creaArchivio();
// Scheda con due giorni, esercizi, ordine e cardio.
const s = P.creaScheda('PPL');
assert.throws(() => P.creaScheda('  '), /nome della scheda/);
assert.equal(P.aggiungiGiorno(s.id, 'Push A'), 1);
assert.throws(() => P.aggiungiGiorno(s.id, 'Push A'), /già un giorno/);
P.rinominaGiorno(s.id, 0, 'Pull A');
P.aggiungiEsercizio(s.id, 1, 'Panca piana con bilanciere'); P.aggiungiEsercizio(s.id, 1, 'Alzate laterali'); P.aggiungiEsercizio(s.id, 1, 'Corsa');
P.aggiornaEsercizio(s.id, 1, 0, { serie: '4', rip: '8–10', peso: '60', rec: '120', note: 'fermo al petto' });
assert.throws(() => P.aggiornaEsercizio(s.id, 1, 0, { serie: 0 }), /serie/);
P.spostaEsercizio(s.id, 1, 1, -1);
let sch = P.archivio().items.find(i => i.id === s.id);
assert.deepEqual(sch.giorni.map(g => g.n), ['Pull A', 'Push A']);
assert.deepEqual(sch.giorni[1].eser.map(e => e.n), ['Alzate laterali', 'Panca piana con bilanciere', 'Corsa']);
assert.equal(sch.giorni[1].eser[1].peso, 60); assert.equal(sch.giorni[1].eser[1].rec, 120); assert.equal(sch.giorni[1].eser[2].cardio, true);
// Proposta della settimana dai turni: OFF prima, mai la notte, niente giorni di fila se si può.
assert.deepEqual(U.proponiSettimana(['off', 'off', 'notte', 'off', 'chiusura', 'chiusura', 'apertura'], 3), [0, -1, -1, 1, -1, 2, -1]);
assert.deepEqual(U.proponiSettimana(['', '', '', '', '', '', ''], 3), [0, -1, 1, -1, 2, -1, -1]);
assert.deepEqual(U.proponiSettimana(Array(7).fill('off'), 7), [0, 1, 2, 3, 4, 5, 6]);
assert.deepEqual(U.proponiSettimana(Array(7).fill('notte'), 3), Array(7).fill(-1));
assert.deepEqual(U.proponiSettimana(['off'], 0), Array(7).fill(-1));
// Settimana: venerdì Push A; rinominare il giorno aggiorna la settimana, eliminarlo la riporta a riposo.
P.impostaGiornoSettimana('ven', s.id, 'Push A');
assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-11-20').giorno.n, 'Push A');
assert.throws(() => P.impostaGiornoSettimana('ven', s.id, 'Gambe'), /non trovato/);
P.rinominaGiorno(s.id, 1, 'Push');
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'ven').gn, 'Push');
// Settimane organizzate a parte (lunedì 23/11, 30/11, 7/12): il giorno con la data vince sulla settimana tipo.
assert.equal(U.nomeSettimana('2026-11-30', '2026-11-23'), 'Prossima settimana'); assert.equal(U.nomeSettimana('2026-11-16', '2026-11-23'), 'Settimana scorsa'); assert.equal(U.nomeSettimana('2026-12-14', '2026-11-23'), 'Tra 3 settimane');
assert.equal(U.dateSettimana('2026-11-23'), '23–29 nov'); assert.equal(U.dateSettimana('2026-11-30'), '30 nov – 6 dic');
P.impostaGiornoData('2026-11-27', s.id, 'Pull A');
assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-11-27').giorno.n, 'Pull A');
assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-11-20').giorno.n, 'Push');
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'ven').gn, 'Push');
P.impostaGiornoData('2026-12-04', '', '');
assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-12-04'), null);
assert.deepEqual(U.pianoSettimana(P.archivio(), '2026-11-23').map(p => [p.d.slice(8), p.gn, p.proprio]).filter(x => x[1]), [['27', 'Pull A', true]]);
assert.ok(P.archivio().items.filter(x => x.t === 'pa' && x.d).every(x => !('gs' in x)), 'Forma classica cerca per gs: le voci con la data non lo hanno');
assert.throws(() => P.impostaGiornoData('27/11', s.id, 'Push'), /Data non valida/);
P.impostaSettimana('2026-12-07', [{ sid: s.id, gn: 'Push' }, {}, {}, {}, {}, {}, {}]);
assert.deepEqual(U.pianoSettimana(P.archivio(), '2026-12-07').map(p => p.gn), ['Push', '', '', '', '', '', '']);
assert.throws(() => P.impostaSettimana('2026-12-07', [{}]), /7 giorni/);
P.tornaSettimanaTipo('2026-12-07');
assert.equal(U.pianoSettimana(P.archivio(), '2026-12-07').some(p => p.proprio), false);
assert.equal(U.pianoSettimana(P.archivio(), '2026-12-07')[4].gn, 'Push');
P.usaComeTipo('2026-11-23');
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'ven').gn, 'Pull A');
assert.equal(U.pianoSettimana(P.archivio(), '2026-11-23').some(p => p.proprio), false);
assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-12-04'), null, 'le altre settimane organizzate a parte restano');
P.tornaSettimanaTipo('2026-11-30'); P.impostaGiornoSettimana('ven', s.id, 'Push');
assert.equal(P.archivio().items.filter(x => x.t === 'pa' && x.d).length, 0);
// Titolo dell'impegno Palestra in Agenda: cambia solo se è generico o un giorno di scheda.
const nomiG = ['A · Forza', 'B · Volume'];
assert.equal(U.titoloPalestra('Palestra', nomiG, 'A · Forza'), 'Palestra · A · Forza');
assert.equal(U.titoloPalestra('Palestra · A · Forza', nomiG, 'B · Volume'), 'Palestra · B · Volume');
assert.equal(U.titoloPalestra('Palestra · A · Forza', nomiG, ''), 'Palestra');
assert.equal(U.titoloPalestra('Palestra · A · Forza', nomiG, 'A · Forza'), null);
assert.equal(U.titoloPalestra('Palestra · gambe con Marco', nomiG, 'A · Forza'), null);
assert.equal(U.titoloPalestra('Corsa al parco', nomiG, 'A · Forza'), null);
// Agenda: la riga Allenamento legge lo stesso piano e scrive solo per la data scelta.
{
  globalThis.location ??= { hash: '' };
  const AG = await import('../dist/js/modules/agendaAllenamento.js?v=2');
  const giorni = Array.from({ length: 7 }, (_, i) => `2026-11-${16 + i}`);
  const riga = () => [...AG.rigaAllenamentiFasce(giorni, '2026-11-22').matchAll(/data-agenda-allena="([\d-]+)"[^>]*>([^<]*)</g)].map(m => [m[1].slice(8), m[2]]);
  assert.equal(riga().length, 7);
  assert.deepEqual(riga().find(x => x[0] === '20'), ['20', 'Push'], 'venerdì dalla settimana tipo');
  P.impostaGiornoData('2026-11-18', s.id, 'Pull A');
  assert.deepEqual(riga().find(x => x[0] === '18'), ['18', 'Pull A'], 'scelta dall\'Agenda');
  assert.equal(U.pianoSettimana(P.archivio(), '2026-11-16')[2].gn, 'Pull A', 'la stessa scelta in Palestra');
  assert.equal(U.allenamentoDelGiorno(P.archivio(), '2026-11-25'), null, 'solo quella data, non ogni mercoledì');
  P.togliGiornoData('2026-11-18');
  assert.deepEqual(riga().find(x => x[0] === '18'), ['18', 'Riposo']);
  assert.throws(() => P.togliGiornoData('ieri'), /Data non valida/);
  assert.match(AG.rigaAllenamentiOre(giorni, '2026-11-22'), /calendar-allena is-today/);
}
// Sessione dal giorno della scheda: serie pronte con ripetizioni minime e peso.
const w = P.avviaAllenamento('2026-11-20', s.id, 'Push');
assert.equal(w.eser.length, 3); assert.equal(w.eser[1].sets.length, 4); assert.deepEqual(w.eser[1].sets[0], { r: 8, w: 60, ok: false }); assert.deepEqual(w.eser[2].sets, []);
P.aggiornaSerie(w.id, 1, 0, { w: '62,5', r: '9', ok: true });
P.aggiornaSerie(w.id, 1, 1, { ok: true });
assert.throws(() => P.aggiornaSerie(w.id, 1, 9, { ok: true }), /Serie non trovata/);
assert.throws(() => P.aggiornaSerie(w.id, 1, 2, { w: 'tanto' }), /numero/);
P.aggiungiSerie(w.id, 1);
let sess = P.archivio().items.find(i => i.id === w.id);
assert.equal(sess.eser[1].sets.length, 5); assert.deepEqual(sess.eser[1].sets[4], { r: 8, w: 60, ok: false });
P.togliSerie(w.id, 1, 4); P.aggiornaCardio(w.id, 2, { min: '20', km: '3,5' });
P.aggiungiEsercizioSessione(w.id, 'Dip alle parallele'); P.togliEsercizioSessione(w.id, 0);
sess = P.archivio().items.find(i => i.id === w.id);
assert.deepEqual(sess.eser.map(e => e.n), ['Panca piana con bilanciere', 'Corsa', 'Dip alle parallele']);
const st = U.statSessione(sess);
assert.equal(st.serie, 2); assert.equal(st.volume, 62.5 * 9 + 60 * 8); assert.equal(st.km, 3.5);
// Chiusura: durata dall'orologio, ma non oltre 5 ore.
sess.inizio = Date.now() - 52 * 60000;
const chiusa = P.terminaSessione(w.id);
assert.equal(chiusa.fine, true); assert.ok(chiusa.dur >= 52 && chiusa.dur <= 53);
const lunga = P.avviaAllenamento('2026-11-21', '', '');
assert.equal(lunga.gn, 'Allenamento libero'); P.archivio().items.find(i => i.id === lunga.id).inizio = Date.now() - 9 * 3600000;
assert.equal(P.terminaSessione(lunga.id).dur, undefined);
P.impostaDurata(lunga.id, 45); assert.equal(P.archivio().items.find(i => i.id === lunga.id).dur, 45);
P.eliminaSessione(lunga.id);
await P.salva();
const a = state.formaArchive.archive;
assert.equal(U.sessioni(a).length, 1); assert.equal(U.sessioni(a, '2026-11-21').length, 0); assert.equal(U.sessioni(a, '', '', 'libero').length, 0);
assert.deepEqual(U.progressi(a, 'panca piana con bilanciere'), [{ d: '2026-11-20', kg: 62.5, rip: 9 }]);
assert.deepEqual(U.eserciziFatti(a), ['Panca piana con bilanciere']);
assert.deepEqual(U.seriePerGruppo(a, '2026-11-16', '2026-11-22'), [['Spinta', 2]]);
assert.equal(U.ultimaSessione(a, s.id, 'Push', '2026-11-21').id, w.id); assert.equal(U.ultimaSessione(a, s.id, 'Push', '2026-11-20'), null);
assert.ok(U.nomiEsercizi(a).includes('Squat con bilanciere'));
// Duplica ed elimina: la settimana torna a riposo, le sessioni restano.
const copia = P.duplicaScheda(s.id); assert.equal(copia.n, 'PPL (copia)');
P.rinominaScheda(s.id, 'PPL 4 giorni'); P.eliminaScheda(s.id);
assert.equal(U.pianoAllenamento(P.archivio()).find(p => p.gs === 'ven').sid, '');
assert.equal(U.sessioni(P.archivio()).length, 1); assert.deepEqual(U.schedeDi(P.archivio()).map(x => x.n), ['PPL (copia)']);
P.eliminaGiorno(copia.id, 0); assert.deepEqual(P.archivio().items.find(i => i.id === copia.id).giorni.map(g => g.n), ['Push']);
await P.salva();
console.log('PASS: Palestra allenamenti — gruppi, cardio, recupero, statistiche; schede con giorni, esercizi, ordine e controlli; settimana collegata ai nomi; sessione da scheda con serie, cardio, esercizi aggiunti e tolti; durata con limite di 5 ore; progressi, serie per gruppo, ultima sessione; duplica ed elimina senza perdere lo storico.');

// --- tappa 3: giornate tipo, piano, spesa, misure, report
const gt = P.creaGiornata('Giorno di turno', 'on');
P.aggiungiRigaGiornata(gt.id, 'pranzo', { n: 'Riso basmati', k: 350, p: 7, c: 78, g: 0.6 }, 80);
P.aggiungiRigaGiornata(gt.id, 'cena', { n: 'Salmone', k: 185, p: 18.4, c: 1, g: 12 }, 150);
assert.throws(() => P.aggiungiRigaGiornata(gt.id, 'merenda', { n: 'X', k: 1, p: 0, c: 0, g: 0 }, 10), /pasto/);
P.modificaRigaGiornata(gt.id, 0, { q: 90 });
P.impostaPianoGiorno('lun', gt.id); P.impostaPianoGiorno('gio', gt.id);
assert.equal(U.righePiano(P.archivio(), '2026-11-16', 'pranzo')[0].q, 90);
const lista = U.spesa(P.archivio(), ['lun', 'gio', 'ven']);
assert.deepEqual(lista.flatMap(g => g.voci.map(v => [v.n, v.q, v.giorni.size])), [['Salmone', 300, 2], ['Riso basmati', 180, 2]]);
assert.equal(lista.flatMap(g => g.voci).find(v => v.n === 'Riso basmati').q, 180);
P.segnaPreso('Riso basmati', true); assert.equal(P.archivio().settings.spesaPresi['Riso basmati'], true);
P.impostaGiorniSpesa(['gio', 'lun', 'x']); assert.deepEqual(P.archivio().settings.spesaGiorni, ['lun', 'gio']);
P.azzeraSpesa(); assert.deepEqual(P.archivio().settings.spesaPresi, {});
const copiaGt = P.duplicaGiornata(gt.id); P.eliminaGiornata(gt.id);
assert.equal(U.pianoPasti(P.archivio()).find(p => p.gs === 'lun').gt, ''); assert.equal(U.giornate(P.archivio()).length, 1);
P.togliRigaGiornata(copiaGt.id, 1); assert.equal(P.archivio().items.find(i => i.id === copiaGt.id).righe.length, 1);
P.aggiungiRiga('2026-11-18', 'pranzo', { n: 'Pasta', k: 353, p: 12, c: 72, g: 1.5 }, 90);
assert.equal(P.giornataDalDiario('2026-11-18', 'Mercoledì').righe[0].n, 'Pasta');
assert.throws(() => P.giornataDalDiario('2026-11-10', 'Vuota'), /vuoto/);
// Misure: una per giorno, i campi vuoti si tolgono.
P.salvaMisura({ d: '2026-11-02', peso: '79', giro: '90', mg: '' });
P.salvaMisura({ d: '2026-11-19', peso: '78,4', giro: '', mg: '18' });
P.salvaMisura({ d: '2026-11-19', peso: '78,2', giro: '', mg: '' });
assert.throws(() => P.salvaMisura({ d: '2026-11-19', peso: '', giro: '', mg: '' }), /almeno/);
assert.throws(() => P.salvaMisura({ d: '2026-11-19', peso: '500' }), /peso/);
const ms = U.misure(P.archivio());
assert.equal(ms.length, 2); assert.equal(ms[0].peso, 78.2); assert.equal(ms[0].mg, undefined);
P.eliminaMisura(ms[1].id); assert.equal(U.misure(P.archivio()).length, 1);
P.salvaMisura({ d: '2026-11-02', peso: '79' });
const rep = U.reportSettimane(P.archivio(), '2026-11-16', 3);
assert.equal(rep[0].da, '2026-11-16'); assert.equal(rep[0].giorni, 1); assert.equal(Math.round(rep[0].kcal), 318); assert.equal(rep[0].allenamenti, 1); assert.equal(rep[0].peso, 78.2); assert.equal(rep[2].peso, 79);
await P.salva();
console.log('PASS: Palestra piano e misure — giornate tipo, righe, piano della settimana, spesa sommata per giorni, spunte, giornata dal diario, misure una per giorno, report settimanali.');
