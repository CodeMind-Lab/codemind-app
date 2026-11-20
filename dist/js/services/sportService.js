import { state } from './store.js?v=65';
import { getClient, unwrap, readAll } from './supabase.js?v=65';
import { assertAgendaWritable, loadAgenda } from './agendaService.js?v=65';
import { normalizeSportSnapshot } from '../utils/sport.js?v=65';
import { uid } from '../utils/helpers.js?v=65';
let connectionEpoch=0;
export function clearSport() { connectionEpoch++; state.sportConnection=null; state.sportImports=[]; state.sportError=''; }
export async function loadSport() {
  try {
    const [connections,imports] = await Promise.all([readAll('sport_connections'),readAll('sport_imports')]);
    state.sportConnection=connections[0] || null; state.sportImports=imports; state.sportError='';
  } catch { clearSport(); state.sportError='Il collegamento Sport non è disponibile. Aggiorna i dati e riprova.'; }
}
export async function saveSportSnapshot(value) {
  assertAgendaWritable();
  const snapshot=normalizeSportSnapshot(value,state.timezone), owner=state.mode==='cloud'?state.user?.id:'demo', epoch=connectionEpoch;
  if (state.sportConnection && state.sportConnection.source_id!==snapshot.source_id) throw Error('Questo archivio Forma è diverso da quello collegato. Usa il dispositivo o l’account con cui hai effettuato il primo collegamento.');
  if (state.mode==='cloud') {
    const saved=unwrap(await (await getClient()).rpc('save_sport_snapshot',{payload:{...snapshot,connection_id:state.sportConnection?.id || null}}));
    if(connectionEpoch!==epoch || state.mode!=='cloud' || state.user?.id!==owner)return;
    state.sportConnection=saved;
  } else {
    state.sportConnection={id:state.sportConnection?.id || uid(),source_id:snapshot.source_id,snapshot,synced_at:new Date().toISOString()};
    
  }
  state.sportError='';
}
export async function importSportItems(items) {
  assertAgendaWritable();
  if (!state.sportConnection || !items.length) throw Error('Seleziona almeno un allenamento.');
  const payload=items.map(({key,date,title,completed,planned_minutes,started_at,ended_at,link_id,expected_updated_at}) => ({key,date,title,completed,planned_minutes,started_at,ended_at,link_id,expected_updated_at}));
  let result;
  if (state.mode==='cloud') {
    result=unwrap(await (await getClient()).rpc('import_sport_agenda',{payload}));
    await Promise.all([loadSport(),loadAgenda()]);
  } else {
    // Demo uses the same all-or-nothing validation as the authenticated RPC.
    const entries=structuredClone(state.scheduleEntries),logs=structuredClone(state.timeLogs),receipts=structuredClone(state.sportImports);
    result={imported:0,skipped:0,logs:0,missing_times:0}; const used=new Set();
    for (const item of payload) {
      if(receipts.some(x => x.source_key===item.key)) {result.skipped++;continue;}
      let entry=item.link_id ? entries.find(e => e.id===item.link_id && e.category==='gym' && e.entry_date===item.date) : null;
      if(item.link_id && (!entry || (entry.updated_at || null)!==item.expected_updated_at)) throw Error('L’attività scelta è cambiata. Aggiorna i dati e riprova.');
      if(entry && (used.has(entry.id) || (item.completed && entry.sport_session_key))) throw Error('Collega ogni sessione a un’attività diversa.');
      if(entry && item.completed && state.agendaTimers.some(t => t.entry_id===entry.id)) throw Error('Termina il timer della palestra prima di collegare la sessione.');
      const now=new Date().toISOString();
      if(!entry) {entry={id:uid(),title:item.title,category:'gym',kind:'activity',entry_date:item.date,starts_at:null,ends_at:null,planned_minutes:item.completed?0:item.planned_minutes,notes:'Da Forma · allenamento collegato',project_id:null,is_completed:false,created_at:now,updated_at:now}; entries.push(entry);}
      used.add(entry.id);
      if(item.completed) {entry.is_completed=true;entry.completed_at ||= now;entry.sport_session_key=item.key;entry.updated_at=now;}
      receipts.push({id:uid(),source_key:item.key,entry_id:entry.id});result.imported++;
      if(item.completed && !logs.some(l => l.entry_id===entry.id)) {
        if(item.started_at && !logs.some(l => Date.parse(l.started_at)<Date.parse(item.ended_at) && Date.parse(l.ended_at)>Date.parse(item.started_at))) {logs.push({id:uid(),entry_id:entry.id,started_at:item.started_at,ended_at:item.ended_at,duration_minutes:Math.round((Date.parse(item.ended_at)-Date.parse(item.started_at))/60000),notes:'Da Forma · intervallo registrato',created_at:now,updated_at:now}); result.logs++;}
        else result.missing_times++;
      }
    }
    Object.assign(state,{scheduleEntries:entries,timeLogs:logs,sportImports:receipts});
  }
  return result;
}

export async function disconnectSport() {
  assertAgendaWritable(); connectionEpoch++;
  if(state.mode==='cloud' && state.sportConnection) unwrap(await (await getClient()).from('sport_connections').delete().eq('id',state.sportConnection.id).eq('user_id',state.user.id));
  state.sportConnection=null; state.sportError='';
}
