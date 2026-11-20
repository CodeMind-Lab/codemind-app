import {state,projectOf} from '../services/store.js?v=65';
import {activeAgendaTimer,startAgendaTimer,stopAgendaTimer,prepareAgendaWeek} from '../services/agendaProductivityService.js?v=65';
import {agendaConflicts,searchAgenda,weekPreparation} from '../utils/agendaProductivity.js?v=65';
import {weekStart,categories,categoryColors,hours,goalProgress,wallTime,toInstant} from '../utils/agenda.js?v=65';
import {shiftDate,today} from '../utils/dates.js?v=65';
import {shiftPresets,shiftPreset,commuteValues} from '../utils/workShifts.js?v=65';
import {esc,uid,icon} from '../utils/helpers.js?v=65';
import {openModal,closeModal,bindForm,field,options,toast} from '../utils/dom.js?v=65';
const dayLabel=date=>new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00Z'));
const dateRange=(a,b)=>`${dayLabel(a)} – ${dayLabel(b)}`;
const intervalLabel=(start,end)=>`${wallTime(start,state.timezone).slice(11)}–${wallTime(end,state.timezone).slice(11)}${wallTime(start,state.timezone).slice(0,10)!==wallTime(end,state.timezone).slice(0,10)?' (+1 giorno)':''}`;
const timerElapsed=t=>{const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(t.started_at))/60000));return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;};
let timerTicker;
export function activeTimerPanel() {
  const timer=activeAgendaTimer(),entry=state.scheduleEntries.find(e=>e.id===timer?.entry_id);
  if(!timer||!entry)return '';
  return `<section class="agenda-running panel" aria-label="Attività in corso"><span class="agenda-running-dot" aria-hidden="true"></span><div><span>IN CORSO · Dalle ${wallTime(timer.started_at,state.timezone).slice(11)}</span><button data-productivity-entry="${entry.id}">${esc(entry.title)}</button></div><strong data-timer-elapsed>${timerElapsed(timer)}</strong><button class="btn primary" data-timer-stop>Termina</button><button class="link" data-timer-correct>Correggi orari</button></section>`;
}
export function timerDetailControl(entry) {
  const timer=activeAgendaTimer();
  if(entry.kind==='off'||!entry.entry_date)return '';
  if(timer?.entry_id===entry.id)return `<div class="agenda-timer-detail"><span class="agenda-running-dot" aria-hidden="true"></span><span>In corso dalle ${wallTime(timer.started_at,state.timezone).slice(11)} · <strong data-timer-elapsed>${timerElapsed(timer)}</strong></span><button class="btn primary" data-timer-stop>Termina</button><button class="link" data-timer-correct>Correggi orari</button></div>`;
  return `<div class="agenda-timer-detail"><button class="btn" data-timer-start="${entry.id}" ${timer||entry.is_completed?'disabled':''}>▷ Inizia</button><span>${timer?'Un’altra attività è in corso.':entry.is_completed?'Riapri l’attività per iniziare.':'Registra l’inizio adesso e la fine quando termini.'}</span></div>`;
}
export function dashboardAgendaGoals() {
  if(state.mode==='cloud'&&!state.agendaAvailable)return '';
  const start=weekStart(today(state.timezone)),goals=state.weeklyGoals.filter(g=>g.week_start===start);
  return `<section class="panel dashboard-agenda-goals" aria-label="Obiettivi settimanali"><div class="panel-head"><div><h2>Obiettivi della settimana</h2><p class="subtext">${dateRange(start,shiftDate(start,6))}</p></div><button class="link" data-goals-week="${start}">Gestisci →</button></div>${goals.length?`<div class="dashboard-goal-grid">${goals.map(g=>{
    const value=goalProgress(g,state.scheduleEntries,state.timeLogs,state.timezone),percent=Math.min(100,Math.round(value/g.target*100));const format=n=>g.unit==='minutes'?hours(n):`${n} sessioni`;
    return `<button class="dashboard-agenda-goal" data-productivity-goal="${g.id}" style="--category-color:${categoryColors[g.category]}"><div><strong>${esc(g.title)}</strong><span>${percent}%</span></div><p>${format(value)} <span>/ ${format(g.target)}</span></p><div class="progress-track" role="progressbar" aria-label="${esc(g.title)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div><small>${g.stretch_target>g.target?`Ideale ${format(g.stretch_target)} · `:''}${g.unit==='minutes'?'Ore registrate':'Completate con ore registrate'}</small></button>`;
  }).join('')}</div>`:'<div class="dashboard-goals-empty"><p>Prepara i tuoi traguardi: Studio 8 ore e Palestra 2–3 sessioni.</p><button class="btn" data-default-goals>Aggiungi Studio e Palestra</button></div>'}</section>`;
}
export function conflictsPanel(start) {
  const conflicts=agendaConflicts(state.scheduleEntries,start,shiftDate(start,6),state.timezone);
  if(!conflicts.length)return '';
  return `<details class="agenda-conflicts panel"><summary><span>! ${conflicts.length} ${conflicts.length===1?'sovrapposizione da controllare':'sovrapposizioni da controllare'}</span><span>Vedi dettagli ⌄</span></summary><p>Controlla questi impegni e scegli se cambiare gli orari.</p><div>${conflicts.map(c=>`<article><span>${dayLabel(wallTime(c.start,state.timezone).slice(0,10))} · ${intervalLabel(c.start,c.end)}</span><div><button data-productivity-entry="${c.a.id}">${esc(c.a.title)}</button><span> ↔ </span><button data-productivity-entry="${c.b.id}">${esc(c.b.title)}</button></div></article>`).join('')}</div></details>`;
}
export function entryConflictNote(entry) {
  const conflicts=agendaConflicts(state.scheduleEntries,null,null,state.timezone).filter(c=>c.a.id===entry.id||c.b.id===entry.id);
  return conflicts.length?`<div class="agenda-conflict-note"><strong>! Orari sovrapposti</strong>${conflicts.map(c=>{const other=c.a.id===entry.id?c.b:c.a;return `<button data-productivity-entry="${other.id}">${esc(other.title)} · ${dayLabel(wallTime(c.start,state.timezone).slice(0,10))}, ${intervalLabel(c.start,c.end)}</button>`;}).join('')}</div>`:'';
}
function timerCorrection(render) {
  const timer=activeAgendaTimer(),entry=state.scheduleEntries.find(e=>e.id===timer?.entry_id);if(!timer||!entry)return;
  openModal('Termina e correggi gli orari',`<form id="agenda-timer-form"><p><strong>${esc(entry.title)}</strong></p><p class="subtext">Il timer resta attivo finché salvi. Correggi gli orari se hai dimenticato di terminarlo.</p><div class="form-grid">${field('Inizio effettivo','started_at',wallTime(timer.started_at,state.timezone),'datetime-local','required')}${field('Fine effettiva','ended_at',wallTime(Date.now(),state.timezone),'datetime-local','required')}<label class="field full">Appunti<textarea name="notes" maxlength="2000"></textarea></label></div><div class="form-actions"><button class="btn primary" type="submit">Salva e termina</button></div><p class="form-error" role="alert"></p></form>`);
  bindForm('agenda-timer-form',async data=>{await stopAgendaTimer(timer,{started_at:toInstant(data.get('started_at'),state.timezone),ended_at:toInstant(data.get('ended_at'),state.timezone),notes:data.get('notes')});render();});
}
export function bindTimerControls(render,openEntry,root=document) {
  root.querySelectorAll('[data-timer-start]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{await startAgendaTimer(b.dataset.timerStart);closeModal();render();toast('Timer avviato. Tocca Termina quando hai finito.');}catch(e){if(activeAgendaTimer()){closeModal();render();toast(e.message);}else{const error=root.querySelector('.form-error');if(error)error.textContent=e.message;else toast(e.message);b.disabled=false;}}});
  root.querySelectorAll('[data-timer-stop]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;b.disabled=true;const timer=activeAgendaTimer();try{await stopAgendaTimer(timer);if(document.querySelector('#modal').open)closeModal();render();toast('Ore registrate. Puoi correggerle dal dettaglio dell’impegno.');}catch(e){timerCorrection(render);const error=document.querySelector('#agenda-timer-form .form-error');if(error)error.textContent=e.message;else toast(e.message);b.disabled=false;}});
  root.querySelectorAll('[data-timer-correct]').forEach(b=>b.onclick=()=>timerCorrection(render));
  root.querySelectorAll('[data-productivity-entry]').forEach(b=>b.onclick=()=>{if(document.querySelector('#modal').open)closeModal();openEntry(b.dataset.productivityEntry);});
}
function searchForm(openEntry) {
  openModal('Cerca nell’Agenda',`<form id="agenda-search-form" role="search"><label class="field">Cerca impegno<input type="search" name="query" placeholder="Titolo o nome del progetto…" maxlength="200" autofocus></label><div class="agenda-search-filters"><label class="field">Categoria<select name="category">${options(categories,'','Tutte')}</select></label><label class="field">Progetto<select name="project_id">${options(Object.fromEntries(state.projects.map(p=>[p.id,p.name])),'','Tutti')}</select></label><label class="field">Stato<select name="status">${options({planned:'Pianificati',completed:'Completati',backlog:'Backlog'},'','Tutti')}</select></label>${field('Dal','from','','date')}${field('Al','to','','date')}</div></form><p class="form-error" data-search-error role="alert"></p><p class="agenda-search-count" data-search-count role="status" aria-live="polite"></p><div class="agenda-search-results" data-search-results></div><button class="btn" data-search-more hidden>Mostra altri risultati</button>`);
  const form=document.querySelector('#agenda-search-form'),list=document.querySelector('[data-search-results]');let limit=40,debounce;
  const update=()=>{
    if(!form.isConnected)return;
    const error=document.querySelector('[data-search-error]');error.textContent='';
    try {
      const results=searchAgenda(state.scheduleEntries,state.projects,Object.fromEntries(new FormData(form)));
      document.querySelector('[data-search-count]').textContent=`${results.length} ${results.length===1?'impegno trovato':'impegni trovati'} · Tutte le settimane`;
      list.innerHTML=results.slice(0,limit).map(e=>`<button data-search-entry="${e.id}" style="--category-color:${categoryColors[e.category]}"><span>${e.entry_date?dayLabel(e.entry_date):'Nel backlog'} · ${e.starts_at?intervalLabel(e.starts_at,e.ends_at):e.kind==='off'?'Giorno libero':'Senza orario'}</span><strong>${esc(e.title)}</strong><small>${categories[e.category]}${e.project_id?` · ${esc(projectOf(e.project_id)?.name||'')}`:''}${e.is_completed?' · Completato':''}</small></button>`).join('') || '<p class="agenda-empty">Nessun impegno corrisponde alla ricerca.</p>';
      list.querySelectorAll('[data-search-entry]').forEach(b=>b.onclick=()=>{closeModal();openEntry(b.dataset.searchEntry);});
      document.querySelector('[data-search-more]').hidden=results.length<=limit;
    }catch(e){error.textContent=e.message;list.innerHTML='';document.querySelector('[data-search-count]').textContent='';document.querySelector('[data-search-more]').hidden=true;}
  };
  form.onsubmit=e=>{e.preventDefault();clearTimeout(debounce);update();};
  form.oninput=()=>{limit=40;clearTimeout(debounce);debounce=setTimeout(update,120);};form.onchange=()=>{limit=40;clearTimeout(debounce);update();};
  document.querySelector('[data-search-more]').onclick=()=>{limit+=40;update();};update();
}
function preparationForm(source,render,openWeek) {
  const end=shiftDate(source,6),entries=state.scheduleEntries.filter(e=>e.kind==='activity'&&e.category!=='work'&&e.entry_date>=source&&e.entry_date<=end).sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||String(a.starts_at).localeCompare(String(b.starts_at)));
  const goals=state.weeklyGoals.filter(g=>g.week_start===source);
  openModal('Prepara la prossima settimana',`<form id="agenda-prepare-form"><fieldset><p class="subtext">Parti da ${dateRange(source,end)}. Scegli cosa copiare e inserisci i nuovi turni; gli impegni esistenti restano al loro posto.</p>${field('Settimana da preparare','target',shiftDate(source,7),'date','required')}<h3>Impegni da copiare</h3><div class="agenda-copy-list">${entries.map(e=>`<label><input type="checkbox" name="entry_ids" value="${e.id}" ${['study','gym','dev'].includes(e.category)?'checked':''}><span><strong>${esc(e.title)}</strong><small>${dayLabel(e.entry_date)} · ${e.starts_at?intervalLabel(e.starts_at,e.ends_at):'Senza orario'}</small></span></label>`).join('')||'<p class="agenda-empty">Nessun impegno da copiare. Puoi preparare turni e obiettivi.</p>'}</div><h3>Obiettivi</h3><div class="agenda-copy-list">${goals.map(g=>`<label><input type="checkbox" name="goal_ids" value="${g.id}" checked><span><strong>${esc(g.title)}</strong><small>${g.unit==='minutes'?hours(g.target):`${g.target} sessioni`}${g.stretch_target>g.target?` · Ideale ${g.unit==='minutes'?hours(g.stretch_target):g.stretch_target}`:''}</small></span></label>`).join('')||'<label><input type="checkbox" name="default_goals" checked><span><strong>Studio e Palestra</strong><small>8 ore · 2–3 sessioni</small></span></label>'}</div><h3>Nuovi turni</h3><p class="subtext">Ogni turno aggiunge anche 30 minuti di andata e ritorno. I turni già presenti vengono mantenuti.</p><div class="agenda-prepare-shifts" data-prepare-shifts></div><div class="agenda-prepare-preview" data-prepare-preview aria-live="polite"></div><div class="form-actions"><button class="btn primary" type="submit">Prepara settimana</button></div><p class="form-error" role="alert"></p></fieldset></form>`);
  const form=document.querySelector('#agenda-prepare-form');let target,requestId,signature,plan;
  const selections=()=>({entryIds:new FormData(form).getAll('entry_ids'),goalIds:new FormData(form).getAll('goal_ids'),defaultGoals:!!form.elements.default_goals?.checked,shifts:[...form.querySelectorAll('[data-prepare-preset]')].filter(s=>s.value&&!s.disabled).map(s=>({date:s.dataset.preparePreset,preset:s.value}))});
  const updateShifts=()=>{
    const old=Object.fromEntries([...form.querySelectorAll('[data-prepare-preset]')].map(s=>[s.dataset.preparePreset,s.value]));
    target=weekStart(form.elements.target.value);form.elements.target.value=target;
    form.querySelector('[data-prepare-shifts]').innerHTML=Array.from({length:7},(_,i)=>{
      const date=shiftDate(target,i),existing=state.scheduleEntries.filter(e=>e.entry_date===date&&['shift','off'].includes(e.kind));
      return `<label><span>${dayLabel(date)}</span><select data-prepare-preset="${date}" aria-label="Turno ${dayLabel(date)}" ${existing.length?'disabled':''}>${existing.length?`<option value="">Già presente · ${existing.length===1?shiftPresets[shiftPreset(existing[0],state.timezone)]?.label||'Personalizzato':'più turni'}</option>`:options(Object.fromEntries(Object.entries(shiftPresets).map(([k,p])=>[k,p.label])),old[date]||'','Non definito')}</select></label>`;
    }).join('');
  };
  const update=()=>{
    const output=form.querySelector('[data-prepare-preview]');
    try {
      plan=weekPreparation(state.scheduleEntries,state.weeklyGoals,source,target,selections().entryIds,selections().goalIds,selections().shifts,state.timezone,selections().defaultGoals);
      const potential=[...plan.activities,...plan.shifts].map((e,i)=>({...e,id:`copy-${i}`}));
      for(const shift of [...potential].filter(e=>e.kind==='shift'))for(const leg of ['outbound','return'])potential.push({...commuteValues(shift,leg,state.timezone),id:`${shift.id}-${leg}`});
      const conflicts=agendaConflicts([...state.scheduleEntries,...potential],target,shiftDate(target,6),state.timezone);
      output.innerHTML=`<strong>${dateRange(target,shiftDate(target,6))}</strong><p>${plan.activities.length} impegni · ${plan.goals.length} obiettivi · ${plan.shifts.length} giorni di lavoro/OFF</p>${plan.skipped.length?`<small>${plan.skipped.length} voci già presenti: saranno mantenute.</small>`:''}${conflicts.length?`<small class="agenda-copy-warning">! ${conflicts.length} sovrapposizioni da controllare nell’Agenda.</small>`:''}<small>Le ore registrate e il completamento restano nella settimana originale.</small>`;
      form.querySelector('[type=submit]').disabled=!(plan.activities.length||plan.goals.length||plan.shifts.length);
    }catch(e){plan=null;output.textContent=e.message;form.querySelector('[type=submit]').disabled=true;}
  };
  form.onchange=e=>{if(e.target.name==='target'&&e.target.value)updateShifts();update();};updateShifts();update();
  bindForm('agenda-prepare-form',async()=>{
    const chosen=selections(),key=JSON.stringify({target,...chosen});if(key!==signature){signature=key;requestId=uid();}
    form.querySelector('fieldset').disabled=true;
    try{const result=await prepareAgendaWeek({requestId,source,target,...chosen});openWeek(target);render();toast(`Settimana preparata: ${result.activities} impegni, ${result.goals} obiettivi, ${result.shifts} turni/OFF.`);}
    finally{form.querySelector('fieldset').disabled=false;}
  });
}
export function bindAgendaProductivity(render,{openEntry,openWeek,openGoal,week}) {
  bindTimerControls(render,openEntry);
  clearInterval(timerTicker);
  if(activeAgendaTimer()&&document.querySelector('[data-timer-elapsed]')) {
    timerTicker=setInterval(()=>{const labels=document.querySelectorAll('[data-timer-elapsed]');const t=activeAgendaTimer();if(!t||!labels.length){clearInterval(timerTicker);return;}labels.forEach(label=>label.textContent=timerElapsed(t));},30000);
  }
  document.querySelectorAll('[data-agenda-search]').forEach(b=>b.onclick=()=>searchForm(openEntry));
  document.querySelectorAll('[data-agenda-prepare]').forEach(b=>b.onclick=()=>preparationForm(week,render,openWeek));
  document.querySelectorAll('[data-goals-week]').forEach(b=>b.onclick=()=>{openWeek(b.dataset.goalsWeek);location.hash='#/today';});
  document.querySelectorAll('[data-productivity-goal]').forEach(b=>b.onclick=()=>openGoal(state.weeklyGoals.find(g=>g.id===b.dataset.productivityGoal)));
  document.querySelector('[data-default-goals]')?.addEventListener('click',async event=>{event.target.disabled=true;const target=weekStart(today(state.timezone));try{await prepareAgendaWeek({requestId:uid(),source:shiftDate(target,-7),target,entryIds:[],goalIds:[],shifts:[],defaultGoals:true});render();}catch(e){toast(e.message);event.target.disabled=false;}});
}
