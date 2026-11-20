import '../../forma/forma-model.js?v=65';
import { state } from './store.js?v=65';
import { getClient,unwrap,readAll } from './supabase.js?v=65';
import { saveSportSnapshot } from './sportService.js?v=65';
import { shiftPreset } from '../utils/workShifts.js?v=65';
export const formaModel=globalThis.FormaModel;
let epoch=0,queue=Promise.resolve();
const owner=()=>state.mode==='cloud'?state.user?.id:state.mode==='demo'?'demo':'';
const pendingKey=id=>'cm-forma-pending:'+id;
export function clearForma(){epoch++;state.formaArchive=null;state.formaError='';}
export function projectTurns(){
 const dates=new Map();for(const x of state.scheduleEntries.filter(x=>['shift','off'].includes(x.kind))){const preset=shiftPreset(x,state.timezone);if(dates.has(x.entry_date))dates.set(x.entry_date,null);else dates.set(x.entry_date,preset&&preset!=='custom'?{date:x.entry_date,preset}:null);}
 return [...dates.values()].filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
}
export async function loadForma(){
 const who=owner(),version=epoch;
 try{const rows=await readAll('forma_archives');if(version!==epoch||who!==owner())return;state.formaArchive=rows[0]||null;state.formaError='';}
 catch{if(version===epoch&&who===owner())state.formaError='L’archivio Forma non è disponibile. Aggiorna i dati e riprova.';}
}
// Toglie le modifiche in attesa di questo account (scelta "Scarta" dopo un conflitto).
export function scartaPendingForma(){const who=owner();if(who)localStorage.removeItem(pendingKey(who));}
export function pendingForma(){try{return JSON.parse(localStorage.getItem(pendingKey(owner()))||'null');}catch{return null;}}
export function saveForma(value,base,source_id){
 const normalized=formaModel.normalize(value),who=owner(),version=epoch;
 if(!who)throw Error('Accedi prima di salvare.');
 if(!/^[a-zA-Z0-9_-]{8,100}$/.test(source_id||''))throw Error('Identificativo Forma non valido.');
 if(state.formaArchive&&state.formaArchive.source_id!==source_id)throw Error('Questo archivio Forma è diverso da quello collegato.');
 if(state.sportConnection&&state.sportConnection.source_id!==source_id)throw Error('Questo archivio Forma è diverso da quello collegato.');
 const request={archive:normalized,base:base?formaModel.normalize(base):null,source_id};
 localStorage.setItem(pendingKey(who),JSON.stringify(request));
 const run=async()=>{
  if(version!==epoch||who!==owner())throw Error('L’account è cambiato. Riapri Forma dal tuo account.');
  if(state.sportConnection&&state.sportConnection.source_id!==source_id)throw Error('Questo archivio Forma è diverso da quello collegato.');
  if(state.formaArchive&&state.formaArchive.source_id!==source_id)throw Error('Questo archivio Forma è diverso da quello collegato.');
  let saved;
  if(state.mode==='cloud'){
   if(!navigator.onLine)throw Error('Sei offline. La modifica è conservata su questo dispositivo: premi Riprova quando torni online.');
   for(let retry=0;retry<3;retry++){
    const previous=state.formaArchive;
    const merged=previous?formaModel.merge(request.base,request.archive,previous.archive):request.archive;
    try{saved=unwrap(await(await getClient()).rpc('save_forma_archive',{payload:{archive_id:previous?.id||null,source_id,archive:merged},expected_revision:previous?.revision||null}));break;}
    catch(err){if(!err.message.includes('FORMA_CONFLICT')||retry===2)throw err;await loadForma();}
   }
  }else{
   const previous=state.formaArchive,merged=previous?formaModel.merge(request.base,request.archive,previous.archive):request.archive;
   saved={id:previous?.id||crypto.randomUUID(),source_id,archive:formaModel.applyTurns(merged,projectTurns(),previous?.managed_turns),managed_turns:projectTurns(),revision:(previous?.revision||0)+1,updated_at:new Date().toISOString()};
  }
  if(version!==epoch||who!==owner())throw Error('L’account è cambiato durante il salvataggio.');
  state.formaArchive=saved;
  await saveSportSnapshot(formaModel.sport(saved.archive,source_id));
  if(version!==epoch||who!==owner())throw Error('L’account è cambiato durante il salvataggio.');
  if(localStorage.getItem(pendingKey(who))===JSON.stringify(request))localStorage.removeItem(pendingKey(who));
  state.formaError='';return saved;
 };
 const result=queue.then(run);queue=result.catch(()=>{});return result;
}
export async function syncFormaTurns(){
 if(!state.formaArchive)return null;
 if(state.mode==='cloud'){await loadForma();return state.formaArchive;}
 const previous=state.formaArchive,turns=projectTurns(),archive=formaModel.applyTurns(previous.archive,turns,previous.managed_turns);
 if(!formaModel.same(archive,previous.archive)||!formaModel.same(turns,previous.managed_turns)){state.formaArchive={...previous,archive,managed_turns:turns,revision:previous.revision+1};}
 return state.formaArchive;
}
export function nutritionToday(date){
 const archive=state.formaArchive?.archive;if(!archive)return null;
 const rows=archive.items.filter(i=>i.t==='l'&&i.d===date),sum={k:0,p:0,c:0,g:0};for(const row of rows)for(const key of Object.keys(sum))sum[key]+=(Number(row[key])||0)*(Number(row.q)||0)/100;
 return {total:sum,rows:rows.length};
}
