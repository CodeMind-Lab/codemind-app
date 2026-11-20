// Calcoli di Lavoro Hotel: festivi, notturne, straordinari, stipendio fisso con 13ª e 14ª, saldi.
import assert from 'node:assert/strict';
import { pasqua, festivi, eFestivo, dettaglioTurno, riepilogoMese, stipendioPrevisto, saldi } from '../dist/js/utils/hotel.js?v=65';
import { shiftValues } from '../dist/js/utils/workShifts.js?v=65';
const tz='Europe/Rome';
assert.equal(pasqua(2026),'2026-04-05');assert.equal(pasqua(2027),'2027-03-28');
assert.ok(festivi(2026).has('2026-04-06'));assert.ok(eFestivo('2026-12-25'));assert.ok(!eFestivo('2026-11-20'));
const turno=(data,preset)=>({kind:'shift',...shiftValues(data,{preset},tz)});
const notte=dettaglioTurno(turno('2026-11-21','notte'),tz,{});
assert.deepEqual([notte.totale,notte.notte,notte.festivo],[480,390,0]);
assert.equal(dettaglioTurno(turno('2026-11-20','chiusura'),tz,{}).notte,90);
assert.equal(dettaglioTurno(turno('2026-11-20','apertura'),tz,{}).notte,0);
// Natale in Chiusura: tutto festivo. La notte del 24 tocca il 25 dalle 00:00.
assert.equal(dettaglioTurno(turno('2026-12-25','chiusura'),tz,{}).festivo,480);
assert.equal(dettaglioTurno(turno('2026-12-24','notte'),tz,{}).festivo,450);
// Ora legale: la Notte del 24/10 dura un'ora in più (si torna all'ora solare).
assert.equal(dettaglioTurno(turno('2026-10-24','notte'),tz,{}).totale,540);
// Settimana 16–22/11 con 6 turni da 8 h: 8 h oltre le 40.
const voci=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21'].map((d,i)=>turno(d,['apertura','apertura','chiusura','chiusura','apertura','notte'][i]));
voci.push({kind:'off',entry_date:'2026-11-22'});
const r=riepilogoMese(voci,{},'2026-11',tz,Date.parse('2026-11-20T12:00:00Z'));
assert.equal(r.minuti,48*60);assert.equal(r.straordinari,8*60);assert.equal(r.fatti,4);assert.equal(r.inCalendario,2);assert.equal(r.off,1);
assert.equal(r.notte,90+90+390);
// Stipendio fisso: netto ogni mese, doppio a luglio (14ª) e dicembre (13ª).
const c={netto_mensile:1500,mensilita_extra:[{mese:7,nome:'14ª'},{mese:12,nome:'13ª'}]};
assert.equal(stipendioPrevisto(c,'2026-11').totale,1500);
assert.equal(stipendioPrevisto(c,'2026-12').totale,3000);assert.equal(stipendioPrevisto(c,'2026-07').extra[0].nome,'14ª');
assert.equal(stipendioPrevisto({},'2026-11'),null);
// Saldi: 24 giorni l'anno, saldo iniziale 2026 di 4 giorni, residuo che passa al 2027.
const ct={ferie_giorni_anno:24,permessi_ore_anno:72,ferie_saldo_iniziale:4,permessi_saldo_iniziale:10,anno_saldo:2026};
const assenze=[{data:'2026-08-10',tipo:'ferie'},{data:'2026-08-11',tipo:'ferie'},{data:'2026-12-28',tipo:'ferie'},{data:'2026-11-03',tipo:'permesso',ore:4},{data:'2026-02-02',tipo:'malattia'}];
const s=saldi(ct,assenze,2026,'2026-11-20');
assert.equal(s.ferie.maturate,22);assert.equal(s.ferie.godute,2);assert.equal(s.ferie.pianificate,1);assert.equal(s.ferie.residue,4+22-3);
assert.equal(s.permessi.maturati,66);assert.equal(s.permessi.residui,10+66-4);assert.equal(s.malattia,1);
const s27=saldi(ct,assenze,2027,'2027-01-15');
assert.equal(s27.ferie.iniziali,4+24-3);assert.equal(s27.ferie.maturate,2);
console.log('PASS: hotel: Pasqua e festivi, notturne e festive per turno (anche Notte, Natale e cambio d\'ora), straordinari settimanali, stipendio fisso con 13ª/14ª, saldi di ferie e permessi con riporto.');
