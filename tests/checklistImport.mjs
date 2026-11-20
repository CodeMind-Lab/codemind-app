import './datiDiProva.mjs';
import assert from 'node:assert/strict';
import {textRows,tableDefaults,tableRows,planChecklist} from '../dist/js/utils/checklist.js';
assert.deepEqual(textRows('- [ ] Prima\r\n2. Seconda\n☑ Terza').map(r=>r.title),['Prima','Seconda','Terza']);
const grid=[['ID','Attività','Descrizione'],['1','Prima','Dettagli'],['2','Seconda','']];
assert.deepEqual(tableDefaults(grid),{headerRow:0,column:1,idColumn:0,hasHeader:true});
assert.deepEqual(tableRows(grid,tableDefaults(grid)),[{title:'Prima',sourceId:'1',description:'ID: 1\nDescrizione: Dettagli'},{title:'Seconda',sourceId:'2',description:'ID: 2'}]);
const plan=planChecklist([{title:' Prima '},{title:'nuova'},{title:'NUOVA'},{title:'no',selected:false},{title:'x'.repeat(201)}],[{title:'prima'}]);
assert.equal(plan.filter(r=>r.ready).length,1);assert.equal(plan.filter(r=>r.duplicate).length,2);assert.equal(plan[4].invalid,true);
assert.equal(planChecklist([{title:'a',selected:false},{title:'a'}]).filter(r=>r.ready).length,1);
assert.throws(()=>planChecklist(Array.from({length:501},()=>({title:'x'}))),/500/);
// Cloud simulation: second write fails, retry must not repeat first write.
import fs from 'node:fs';
const owner='owner',project='project';
const state={mode:'cloud',user:{id:owner},projects:[{id:project,status:'active'}],tasks:[]};
const stored=[];let fail=true,calls=0;
const client={rpc:async(_,arg)=>{calls++;if(fail&&calls===2)return {error:{message:'rete'}};stored.push({...arg.payload});return {data:{},error:null};}};
globalThis.__checklistTest={state,client,loadCloud:async()=>{state.tasks=stored.map(x=>({...x}));},persistDemo:()=>{}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
let source=fs.readFileSync('dist/js/services/checklistImportService.js','utf8')
 .replace(/import \{universityData\}[^;]+;/, `import {universityData} from '${new URL('../dist/js/utils/university.js', import.meta.url).href}';`)
 .replace(/import \{state\}[^;]+;/,'const {state}=globalThis.__checklistTest;')
 .replace(/import \{getClient,unwrap\}[^;]+;/,'const getClient=async()=>globalThis.__checklistTest.client; const unwrap=r=>{if(r.error)throw Error(r.error.message);return r.data;};')
 .replace(/import \{loadCloud\}[^;]+;/,'const {loadCloud}=globalThis.__checklistTest;')
 .replace(/import \{uid\}[^;]+;/,'const uid=()=>crypto.randomUUID();')
 .replace(/import \{planChecklist\}[^;]+;/,`const planChecklist=${planChecklist.toString()}; const MAX_ITEMS=500; const cleanTitle=${(await import('../dist/js/utils/checklist.js')).cleanTitle.toString()}; const normalizeTitle=${(await import('../dist/js/utils/checklist.js')).normalizeTitle.toString()};`);
const {importChecklist}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
await assert.rejects(importChecklist([{title:'Uno',sourceId:'DLD-001',description:'ID: DLD-001'},{title:'Due',sourceId:'DLD-002',description:'ID: DLD-002'}],project,'file'),/1 attività aggiunte/);
assert.equal(stored.length,1);fail=false;
assert.equal((await importChecklist([{title:'Uno',sourceId:'DLD-001',description:'ID: DLD-001'},{title:'Due',sourceId:'DLD-002',description:'ID: DLD-002'}],project,'file')).count,1);
assert.equal(stored.length,2);assert.equal(stored[0].description,'ID: DLD-001');assert.equal(stored[1].description,'ID: DLD-002');assert.ok(stored.every(x=>x.status==='todo'&&x.project_id===project));
state.mode='signed_out';await assert.rejects(importChecklist([{title:'x'}],project,'file'),/sessione/);
console.log('PASS: checklist parsing, column detection, duplicates, selection, limits, cloud partial failure and retry without duplicates.');
