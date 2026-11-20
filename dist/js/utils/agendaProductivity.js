import {weekStart, validDate, wallTime, toInstant, minutesBetween} from './agenda.js?v=65';
import {shiftDate} from './dates.js?v=65';
import {shiftValues, commuteValues} from './workShifts.js?v=65';

// Sweep actual instants, so adjacent events, overnight shifts and DST agree.
export function agendaConflicts(entries, from, to, timezone='Europe/Rome') {
  const left=from ? Date.parse(toInstant(from+'T00:00',timezone)) : -Infinity;
  const right=to ? Date.parse(toInstant(shiftDate(to,1)+'T00:00',timezone)) : Infinity;
  const sorted=entries.filter(e=>e.kind!=='off' && !e.is_completed && e.starts_at && e.ends_at)
    .map(entry=>({entry,start:Math.max(left,Date.parse(entry.starts_at)),end:Math.min(right,Date.parse(entry.ends_at))}))
    .filter(e=>e.end>e.start).sort((a,b)=>a.start-b.start || a.entry.id.localeCompare(b.entry.id));
  let active=[]; const conflicts=[];
  for(const item of sorted) {
    active=active.filter(other=>other.end>item.start);
    for(const other of active) if(other.entry.id!==item.entry.id) conflicts.push({a:other.entry,b:item.entry,start:item.start,end:Math.min(item.end,other.end)});
    active.push(item);
  }
  return conflicts;
}
export function candidateConflicts(values, existing, entries, timezone) {
  if(!values.starts_at || !values.ends_at || values.kind==='off') return [];
  const candidate={...values,id:existing?.id || 'candidate'};
  const rest=existing ? entries.filter(e=>e.id!==existing.id && e.shift_id!==existing.id) : [...entries];
  const additions=[candidate];
  if(candidate.kind==='shift') for(const leg of ['outbound','return']) additions.push({...commuteValues(candidate,leg,timezone),id:`candidate-${leg}`});
  const ids=new Set(additions.map(e=>e.id));
  return agendaConflicts([...rest,...additions],null,null,timezone).filter(c=>ids.has(c.a.id)||ids.has(c.b.id));
}
const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it');
export function searchAgenda(entries, projects, {query='',category='',project_id='',status='',from='',to=''}={}) {
  if((from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to)) throw Error('Controlla le date della ricerca.');
  const names=new Map(projects.map(p=>[p.id,p.name]));const words=normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(e=> (!category||e.category===category) && (!project_id||e.project_id===project_id) &&
    (!status || (status==='completed' ? e.is_completed : status==='backlog' ? !e.entry_date : !e.is_completed&&!!e.entry_date)) &&
    (!from || e.entry_date>=from) && (!to || !!e.entry_date&&e.entry_date<=to) &&
    words.every(word=>normalize(`${e.title} ${names.get(e.project_id)||''}`).includes(word)))
    .sort((a,b)=>String(b.entry_date||'0000').localeCompare(String(a.entry_date||'0000')) || String(a.starts_at||'').localeCompare(String(b.starts_at||'')) || a.title.localeCompare(b.title,'it'));
}
export const entryFingerprint=e=>JSON.stringify([e.title,e.category,e.kind,e.entry_date,e.starts_at?Date.parse(e.starts_at):null,e.ends_at?Date.parse(e.ends_at):null,e.project_id||null]);
export const goalFingerprint=g=>JSON.stringify([g.title,g.category,g.unit,g.project_id||null]);
export function copiedActivity(entry, source, target, timezone) {
  const delta=Math.round((Date.parse(target+'T12:00Z')-Date.parse(source+'T12:00Z'))/86400000);
  const move=value=>{const wall=wallTime(value,timezone);return toInstant(shiftDate(wall.slice(0,10),delta)+wall.slice(10),timezone);};
  const starts_at=entry.starts_at?move(entry.starts_at):null,ends_at=entry.ends_at?move(entry.ends_at):null;
  return {title:entry.title,category:entry.category,kind:'activity',entry_date:shiftDate(entry.entry_date,delta),starts_at,ends_at,planned_minutes:starts_at?minutesBetween(starts_at,ends_at):entry.planned_minutes,project_id:entry.project_id||null,notes:entry.notes||'',is_completed:false};
}
export function weekPreparation(entries, goals, source, target, entryIds, goalIds, shifts, timezone, defaultGoals=false) {
  if(!validDate(source)||!validDate(target)||weekStart(source)!==source||weekStart(target)!==target||source===target) throw Error('Scegli due settimane diverse, da lunedì.');
  if(entryIds.length>300||goalIds.length>100||shifts.length>7) throw Error('Troppe voci da copiare.');
  const present=new Set(entries.map(entryFingerprint));const goalKeys=new Set(goals.filter(g=>g.week_start===target).map(goalFingerprint));
  const activities=[],newGoals=[],work=[],skipped=[];
  for(const id of new Set(entryIds)) {
    const e=entries.find(e=>e.id===id);
    if(!e||e.kind!=='activity'||e.category==='work'||!e.entry_date||e.entry_date<source||e.entry_date>shiftDate(source,6)) throw Error('Un impegno sorgente non è più disponibile. Aggiorna i dati.');
    const copied=copiedActivity(e,source,target,timezone),key=entryFingerprint(copied);
    if(present.has(key)) skipped.push(e.title);else {present.add(key);activities.push({...copied,source_id:e.id,expected_updated_at:e.updated_at});}
  }
  for(const id of new Set(goalIds)) {
    const g=goals.find(g=>g.id===id&&g.week_start===source);if(!g)throw Error('Un obiettivo sorgente è cambiato. Aggiorna i dati.');
    const key=goalFingerprint(g);
    if(goalKeys.has(key))skipped.push(g.title);else {goalKeys.add(key);newGoals.push({...g,week_start:target,source_id:g.id,expected_updated_at:g.updated_at});}
  }
  if(defaultGoals) for(const g of [{title:'Studio',category:'study',unit:'minutes',target:480,stretch_target:480,project_id:null},{title:'Palestra',category:'gym',unit:'sessions',target:2,stretch_target:3,project_id:null}]) {
    const key=goalFingerprint(g);if(goalKeys.has(key))skipped.push(g.title);else {goalKeys.add(key);newGoals.push({...g,week_start:target});}
  }
  const dates=new Set();
  for(const {date,preset} of shifts) {
    if(!validDate(date)||date<target||date>shiftDate(target,6)||dates.has(date)) throw Error('Giorni dei turni non validi.');dates.add(date);
    if(entries.some(e=>e.entry_date===date&&['shift','off'].includes(e.kind))) throw Error('Un turno è già presente: aggiorna l’anteprima.');
    const values=shiftValues(date,{preset},timezone);
    work.push({...values,category:'work',planned_minutes:values.starts_at?minutesBetween(values.starts_at,values.ends_at):0,is_completed:false});
  }
  return {activities,goals:newGoals,shifts:work,skipped};
}
