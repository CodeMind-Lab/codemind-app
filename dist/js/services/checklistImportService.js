import {universityData} from "../utils/university.js?v=65";
import {state} from './store.js?v=65';
import {getClient,unwrap} from './supabase.js?v=65';
import {loadCloud} from './dataService.js?v=65';
import {uid} from '../utils/helpers.js?v=65';
import {planChecklist} from '../utils/checklist.js?v=65';
export async function importChecklist(rows,projectId,fileName,onProgress) {
  const mode=state.mode, owner=state.user?.id;
  function guard() {
    if(state.mode!==mode || state.user?.id!==owner || mode==='signed_out') throw Error('La sessione è cambiata. Accedi e riapri l’importazione.');
    if(!state.projects.some(p=>p.id===projectId && p.status!=='archived')) throw Error('Scegli un progetto attivo.');
    if(mode==='cloud' && !navigator.onLine) throw Error('Riconnettiti per importare le attività.');
  }
  guard();
  if(mode==='cloud') await loadCloud();
  guard();
  const ready=planChecklist(rows,state.tasks.filter(t=>t.project_id===projectId)).filter(r=>r.ready);
  let count=0;
  const client=mode==='cloud'?await getClient():null;
  const now=new Date().toISOString();
  const start=Math.max(-1,...state.tasks.filter(t=>t.project_id===projectId).map(t=>Number(t.position)||0))+1;
  try {
    for(const row of ready) {
      guard();
      const payload={id:uid(),project_id:projectId,title:row.title,description:row.description||'',status:'todo',priority:'medium',type:universityData(state.projects.find(p=>p.id===projectId))?'study':'other',position:start+count,notes:`Importata da checklist: ${fileName}`,tags:[],checklist:[]};
      if(client) unwrap(await client.rpc('save_task',{payload,expected_updated_at:null}));
      state.tasks.push({...payload,created_at:now,updated_at:now,completed_at:null});
      count++;
      onProgress?.(count,ready.length);
    }
  } catch(error) {
    if(mode==='cloud' && state.mode===mode && state.user?.id===owner) {try {await loadCloud();}catch{}}
    throw Error(`${count} attività aggiunte. ${error.message} Puoi riprovare: le voci già presenti saranno saltate.`);
  }
  if(mode==='cloud') {
    try {await loadCloud();} catch { /* Acknowledged tasks remain visible locally. */ }
  }
  return {count,skipped:rows.length-ready.length};
}
