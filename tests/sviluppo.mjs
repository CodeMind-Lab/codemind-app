// Calcoli di Lavoro Sviluppo: ore per progetto e per cliente dall'Agenda, conti dei preventivi.
import assert from 'node:assert/strict';
import { oreProgetti, perCliente, contoPreventivo, totaliPreventivi, iniziali, ultimoGiorno } from '../dist/js/utils/sviluppo.js?v=65';
const tz='Europe/Rome';
assert.equal(ultimoGiorno('2026-02'),'2026-02-28');assert.equal(ultimoGiorno('2028-02'),'2028-02-29');assert.equal(ultimoGiorno('2026-11'),'2026-11-30');
const progetti=[{id:'p1',name:'Shop',cliente_id:'c1'},{id:'p2',name:'Sito',cliente_id:'c2'},{id:'p3',name:'Forma',cliente_id:null}];
const voce=(id,project_id,data,da,a,category='dev')=>({id,project_id,category,kind:'activity',entry_date:data,starts_at:`${data}T${da}:00Z`,ends_at:`${data}T${a}:00Z`,planned_minutes:0});
const voci=[voce('a','p1','2026-11-10','08:00','10:00'),voce('b','p1','2026-11-12','08:00','09:00'),voce('c','p2','2026-11-12','14:00','15:30'),voce('d',null,'2026-11-13','08:00','08:30'),voce('e','p1','2026-10-30','08:00','10:00'),voce('f','p3','2026-11-14','08:00','09:00','study')];
const logs=[{entry_id:'a',started_at:'2026-11-10T08:00:00Z',ended_at:'2026-11-10T09:45:00Z'},{entry_id:'c',started_at:'2026-11-12T14:00:00Z',ended_at:'2026-11-12T15:30:00Z'}];
const r=oreProgetti(voci,logs,progetti,'2026-11',tz);
assert.deepEqual(r.map(x=>[x.progetto,x.pianificate,x.fatte]),[['Shop',180,105],['Sito',90,90],['Senza progetto',30,0]]);
const c=perCliente(r);assert.equal(c.get('c1').fatte,105);assert.equal(c.get('').pianificate,30);
// Preventivi: acconto, pagato, e solo gli accettati contano come "da incassare".
const prev=[{id:'x',cliente_id:'c1',importo:1200,stato:'accettato'},{id:'y',cliente_id:'c2',importo:450,stato:'accettato'},{id:'z',cliente_id:'c2',importo:300,stato:'inviato'},{id:'w',cliente_id:'c1',importo:200,stato:'rifiutato'}];
const inc=[{preventivo_id:'x',importo:400},{preventivo_id:'y',importo:450}];
assert.deepEqual([contoPreventivo(prev[0],inc).etichetta,contoPreventivo(prev[0],inc).residuo],['Acconto',800]);
assert.equal(contoPreventivo(prev[1],inc).etichetta,'Pagato');assert.equal(contoPreventivo(prev[2],inc).residuo,0);
const t=totaliPreventivi(prev,inc);assert.deepEqual([t.accettati,t.importo,t.incassato,t.daIncassare,t.inAttesa],[2,1650,850,800,300]);
assert.equal(totaliPreventivi(prev,inc,'c2').daIncassare,0);
assert.equal(iniziali('Studio Design'),'SD');assert.equal(iniziali('B&B Esempio'),'BE');assert.equal(iniziali(''),'?');
console.log('PASS: sviluppo: ore pianificate e fatte per progetto e cliente nel mese, preventivi in acconto/pagati, totali da incassare e in attesa.');
