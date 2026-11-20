import {state} from './store.js?v=65';
import {assertAgendaWritable,loadAgenda} from './agendaService.js?v=65';
import {getClient,unwrap,readAll} from './supabase.js?v=65';
import {uid} from '../utils/helpers.js?v=65';
import {weekPreparation} from '../utils/agendaProductivity.js?v=65';
import {syncDemoCommutes} from '../utils/workShifts.js?v=65';
import {minutesBetween} from '../utils/agenda.js?v=65';
export const activeAgendaTimer=()=>state.agendaTimers?.[0] || null;
export async function startAgendaTimer(entryId) {
  assertAgendaWritable();
  const entry=state.scheduleEntries.find(e=>e.id===entryId);
  if(!entry || !entry.entry_date || entry.kind==='off' || entry.is_completed) throw Error('Pianifica o riapri l’attività prima di iniziare.');
  let timer;
  if(state.mode==='cloud') {
    try {timer=unwrap(await (await getClient()).rpc('start_agenda_timer',{event_id:entryId}));}
    catch(error) {try {state.agendaTimers=await readAll('agenda_timers');} catch {} throw error;}
  }
  else {
    const running=activeAgendaTimer();
    if(running&&running.entry_id!==entryId) throw Error('Un’altra attività è in corso. Termina il suo timer prima di iniziare.');
    timer=running || {id:uid(),entry_id:entryId,started_at:new Date().toISOString()};
  }
  state.agendaTimers=[timer];
  return timer;
}
export async function stopAgendaTimer(timer, values={}) {
  assertAgendaWritable();if(!timer)throw Error('Timer non trovato. Aggiorna i dati.');
  const started_at=values.started_at || timer.started_at,ended_at=values.ended_at || new Date().toISOString();
  const duration=minutesBetween(started_at,ended_at);
  if(!Number.isFinite(duration)||duration<1||duration>1440||Date.parse(ended_at)-Date.parse(started_at)<60000) throw Error('Inserisci un intervallo di almeno un minuto, entro 24 ore.');
  if(Date.parse(ended_at)>Date.now()+60000)throw Error('La fine non può essere nel futuro.');
  let log;
  if(state.mode==='cloud') {
    log=unwrap(await (await getClient()).rpc('stop_agenda_timer',{timer_id:timer.id,finish_at:ended_at,begin_at:started_at,log_notes:values.notes || ''}));
    state.timeLogs=[...state.timeLogs.filter(l=>l.id!==log.id),log];
  } else {
    log=state.timeLogs.find(l=>l.source_timer_id===timer.id);
    if(!log) {
      if(!state.agendaTimers.some(t=>t.id===timer.id)) throw Error('Timer non trovato. Aggiorna i dati.');
      const e=state.scheduleEntries.find(e=>e.id===timer.entry_id);
      if(!e||!e.entry_date||e.kind==='off')throw Error('Impegno non disponibile.');
      if(state.timeLogs.some(l=>Date.parse(l.started_at)<Date.parse(ended_at)&&Date.parse(l.ended_at)>Date.parse(started_at)))throw Error('Questo intervallo si sovrappone a ore già registrate. Modifica l’intervallo esistente.');
      const now=new Date().toISOString();log={id:uid(),entry_id:timer.entry_id,started_at,ended_at,notes:String(values.notes||'').slice(0,2000),source_timer_id:timer.id,duration_minutes:duration,created_at:now,updated_at:now};
    }
    state.timeLogs=[...state.timeLogs.filter(l=>l.id!==log.id),log];state.agendaTimers=state.agendaTimers.filter(t=>t.id!==timer.id);
    return log;
  }
  state.agendaTimers=state.agendaTimers.filter(t=>t.id!==timer.id);return log;
}
const preparationRequests=new Map(),preparationReceipts=new Map();
export async function prepareAgendaWeek({requestId,source,target,entryIds,goalIds,shifts,defaultGoals=false}) {
  assertAgendaWritable();if(!requestId)throw Error('Richiesta non valida.');
  const key=`${state.mode}:${state.user?.id || "demo"}:${requestId}`;
  if(state.mode!=="cloud"&&preparationReceipts.has(key))return preparationReceipts.get(key);
  let result;
  if(state.mode==='cloud') {
    let payload=preparationRequests.get(key);
    if(!payload) {
    weekPreparation(state.scheduleEntries,state.weeklyGoals,source,target,entryIds,goalIds,shifts,state.timezone,defaultGoals);
    payload={request_id:requestId,source_week:source,target_week:target,entries:entryIds.map(id=>{const e=state.scheduleEntries.find(e=>e.id===id);return{id,expected_updated_at:e.updated_at};}),goals:goalIds.map(id=>{const g=state.weeklyGoals.find(g=>g.id===id);return{id,expected_updated_at:g.updated_at};}),shifts,default_goals:defaultGoals};
    if(preparationRequests.size>=32)preparationRequests.delete(preparationRequests.keys().next().value);
    preparationRequests.set(key,payload);
    }
    result=unwrap(await(await getClient()).rpc('prepare_agenda_week',{payload}));
    await loadAgenda();if(!state.agendaAvailable)throw Error(state.agendaError);
  } else {
    const plan=weekPreparation(state.scheduleEntries,state.weeklyGoals,source,target,entryIds,goalIds,shifts,state.timezone,defaultGoals);
    const now=new Date().toISOString();let entries=[...state.scheduleEntries];
    const newItem=values=>{const {source_id,expected_updated_at,id,created_at,updated_at,...clean}=values;return {...clean,id:uid(),created_at:now,updated_at:now,completed_at:null};};
    for(const values of plan.activities) entries.push(newItem(values));
    for(const values of plan.shifts) {const parent=newItem({...values,is_completed:false,notes:'',project_id:null});entries.push(parent);entries=syncDemoCommutes(entries,parent,null,state.timezone);}
    const newGoals=plan.goals.map(newItem);
    state.scheduleEntries=entries;state.weeklyGoals=[...state.weeklyGoals,...newGoals];
    result={activities:plan.activities.length,goals:plan.goals.length,shifts:plan.shifts.length,skipped:plan.skipped.length};
  }
  if(preparationReceipts.size>=32)preparationReceipts.delete(preparationReceipts.keys().next().value);
  preparationReceipts.set(key,result);return result;
}
