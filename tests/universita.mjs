// Università: lettura delle schede dal documento, registro lezioni, ripassi, appelli.
import assert from 'node:assert/strict';
import { leggiSchede, divisioneSuggerita, registro, dopoRipasso, daRipassare, appelliFuturi, iscrizioneUrgente, migliorSimulazione, normalizzaNome } from '../dist/js/utils/universita.js?v=65';
import { encodeUniversity } from '../dist/js/utils/university.js?v=65';
const testo = [
  'FONDAMENTI DI ELETTRONICA :', 'Obiettivi Formativi', 'Basi di elettronica analogica.', 'Programma del Corso', '• Diodi', '• MOSFET',
  'Testi consigliati', 'Sedra, Smith.', 'Modalità di esame', 'Scritto online e in presenza.', 'Organizzazione didattica', 'Sono previste 30 lezioni videoregistrate.',
  'ALGORITMI E STRUTTURE DATI :  PROGRAMMA MANCANTE', '', 'MACCHINE PENSANTI - 0082509INGINF05I', 'Risultati di apprendimento attesi', 'Capire gli agenti.',
  'MODULO 1 — AGENTI', 'Lezione 1 — Introduzione', 'Lezione 2 — Agenti razionali', 'Lezione 1 — Doppione da ignorare', 'Propedeuticità', 'Nessuna.',
  'IOT E SISTEMI CONNESSI Obiettivi Formativi', 'Sistemi dinamici.', 'Organizzazione didattica', '20 lezioni frontali videoregistrate.',
].join('\n');
const s = leggiSchede(testo);
assert.deepEqual(s.map(x => x.nome), ['Fondamenti di Elettronica', 'Algoritmi e Strutture Dati', 'Macchine Pensanti', 'IoT e Sistemi Connessi']);
assert.equal(s[3].obiettivi, 'Sistemi dinamici.'); assert.equal(s[3].lezioniTotali, 20);
assert.equal(s[0].lezioniTotali, 30); assert.equal(s[0].intermediaFino, 20); assert.match(s[0].programma, /• Diodi\n• MOSFET/);
assert.equal(s[0].esame, 'Scritto online e in presenza.'); assert.equal(s[1].incompleta, true); assert.equal(s[1].lezioniTotali, 0);
assert.equal(s[2].codice, '0082509INGINF05I'); assert.deepEqual(s[2].lezioni, [{ numero: 1, titolo: 'Introduzione' }, { numero: 2, titolo: 'Agenti razionali' }]);
assert.equal(divisioneSuggerita('Statistica e Data Analyst'), 36); assert.equal(divisioneSuggerita('Machine Learning e Artificial Intelligence'), 34); assert.equal(divisioneSuggerita('Cybersecurity'), null);
assert.equal(normalizzaNome('Machine Learning e AI - 0082509INGINF05I'), 'machine learning e ai');
// Registro: 30 lezioni, intermedia fino alla 20.
const materia = { id: 'm', name: 'Elettronica', notes: encodeUniversity({ studyStatus: 'studying', lezioniTotali: 30, intermediaFino: 20 }) };
const r = registro(materia, [{ materia_id: 'm', numero: 3, seguita: true }, { materia_id: 'm', numero: 25, seguita: true, titolo: 'ADC' }, { materia_id: 'x', numero: 1, seguita: true }]);
assert.equal(r.lezioni.length, 30); assert.deepEqual([r.tutte.seguite, r.intermedia.seguite, r.intermedia.totali, r.finale.seguite, r.finale.totali], [2, 1, 20, 1, 10]);
assert.equal(r.lezioni[24].titolo, 'ADC'); assert.equal(r.lezioni[24].prova, 'finale');
// Ripasso: 1, 3, 7, 14, 30 giorni, poi imparato.
let e = { ripassi: 0 }; const date = [];
for (let i = 0; i < 5; i++) { e = { ...e, ...dopoRipasso(e, '2026-11-20') }; date.push(e.prossimo_ripasso); }
assert.deepEqual(date, ['2026-11-21', '2026-11-23', '2026-11-27', '2026-12-04', '2026-12-20']);
assert.equal(dopoRipasso(e, '2026-11-20').risolto, true);
assert.equal(daRipassare([{ prossimo_ripasso: '2026-11-20' }, { prossimo_ripasso: '2026-11-21' }, { prossimo_ripasso: null }, { risolto: true }], '2026-11-20').length, 2);
// Appelli: futuri senza esito, iscrizione che scade entro 7 giorni.
const appelli = [{ data: '2026-12-15', iscrizione_entro: '2026-11-25', iscritto: false, esito: '' }, { data: '2026-11-10', esito: 'superato' }, { data: '2027-01-12', iscrizione_entro: '2026-12-20', iscritto: false, esito: '' }];
assert.equal(appelliFuturi(appelli, '2026-11-20').length, 2);
assert.deepEqual(appelli.map(a => iscrizioneUrgente(a, '2026-11-20')), [true, false, false]);
assert.equal(migliorSimulazione([{ corrette: 14, domande: 24 }, { corrette: 6, domande: 7 }, { corrette: 19, domande: 24 }]).corrette, 6);
console.log('PASS: università: schede lette dal documento (anche a capo di Word e programma mancante), lezioni e divisione intermedia/finale, registro, ripassi a intervalli, appelli e iscrizioni, migliore simulazione.');
