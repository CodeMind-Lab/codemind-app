import { apriSchedaForma, formaWorkspace,bindFormaWorkspace,formaDashboardNutrition } from './formaWorkspace.js?v=65';
import { state } from '../services/store.js?v=65';
import { saveSportSnapshot, importSportItems, disconnectSport } from '../services/sportService.js?v=65';
import { FORMA_URL, FORMA_ORIGIN, SPORT_PROTOCOL, sportWeek, sportImportItems } from '../utils/sport.js?v=65';
import { weekStart, hours, timeLabel } from '../utils/agenda.js?v=65';
import { today, shiftDate } from '../utils/dates.js?v=65';
import { shiftPreset } from '../utils/workShifts.js?v=65';
import { esc, icon } from '../utils/helpers.js?v=65';
import { openModal, closeModal, toast } from '../utils/dom.js?v=65';
let selectedWeek='', popup, nonce, owner, renderView, timeout, saving=false, pendingSnapshot;
const ownerKey=()=>state.mode==='cloud' ? state.user?.id : state.mode==='demo' ? 'demo' : '';
const currentWeek=()=>selectedWeek || weekStart(today(state.timezone));
const dateLabel=d=>new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00Z'));
const weekLabel=week=>dateLabel(week)+' – '+dateLabel(shiftDate(week,6));
const snapshot=()=>state.sportConnection?.snapshot;
const dayNames=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
function chart(data) {
  const max=Math.max(30,...data.days.map(d=>d.workouts.filter(w=>w.completed).reduce((n,w)=>n+w.duration_minutes,0)));
  return '<div class="sport-chart" role="img" aria-label="'+esc(data.days.map((d,i)=>dayNames[i]+': '+d.workouts.filter(w=>w.completed).reduce((n,w)=>n+w.duration_minutes,0)+' minuti registrati in Forma').join(', '))+'">'+data.days.map((d,i)=>{
    const minutes=d.workouts.filter(w=>w.completed).reduce((n,w)=>n+w.duration_minutes,0);
    return '<div class="sport-chart-column"><strong>'+(minutes ? minutes+'′' : '—')+'</strong><div class="sport-chart-track"><span style="height:'+minutes/max*100+'%"></span></div><small>'+dayNames[i]+'</small></div>';
  }).join('')+'</div>';
}
export function sportDashboardPanel() {
  const data=sportWeek(snapshot(),weekStart(today(state.timezone)));
  return '<section class="panel sport-home"><div class="panel-head"><h2>'+icon('sport')+' Sport · Forma</h2><a class="link" href="#/sport">Apri →</a></div>'+
    (snapshot()?'<div class="sport-home-stats"><strong>'+data.sessions+'<small>sessioni questa settimana</small></strong><strong>'+hours(data.minutes)+'<small>durata registrata in Forma</small></strong></div>'+chart(data):
    '<div class="personal-body"><p class="personal-summary">Allenamenti e Agenda, insieme.</p><p class="personal-excerpt">Collega Forma per vedere le sessioni qui e usare i turni già inseriti.</p><a class="btn" href="#/sport">Collega Forma</a></div>')+formaDashboardNutrition()+'</section>';
}
function sportSummary() {
  const week=currentWeek(), data=sportWeek(snapshot(),week), connected=!!snapshot();
  return '<div class="sport-page"><div class="page-heading"><div><span class="page-eyebrow">CODEMIND.LAB × FORMA</span><h2>Spazio allo sport.</h2><p class="subtext">Allenamenti, turni e obiettivi, nella tua settimana.</p></div><a class="btn" href="'+FORMA_URL+'" target="_blank" rel="noopener">Apri Forma ↗</a></div>'+
    '<section class="panel sport-connection"><span class="sport-brand" aria-hidden="true">'+icon('sport')+'</span><div><span class="sport-status">'+(connected?'Collegato a Forma':'Il tuo prossimo collegamento')+'</span><h2>'+ (connected?'Il tuo allenamento, a colpo d’occhio.':'La tua routine trova spazio in Agenda.')+'</h2><p>Gestisci schede e sessioni in Forma. Porta il programma nell’Agenda e riutilizza i turni di lavoro già inseriti.</p><small>'+(connected?'Ultimo riepilogo: '+esc(new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:state.timezone}).format(new Date(state.sportConnection.synced_at))):'Usa il browser in cui hai già i dati di Forma.')+'</small></div><div class="sport-connect-actions"><button class="btn primary" id="sport-connect">'+(connected?'Aggiorna da Forma':'Collega Forma')+'</button>'+(connected?'<button class="link" id="sport-disconnect">Scollega</button>':'')+'<span id="sport-connect-status" role="status">Alimentazione e misure restano in Forma.</span></div></section>'+
    (state.sportError?'<p class="form-error" role="alert">'+esc(state.sportError)+'</p>':'')+
    '<div class="sport-week-toolbar"><div><h2>La tua settimana</h2><p class="subtext">'+weekLabel(week)+'</p></div><div class="heading-actions"><button class="icon-btn" data-sport-week="-1" aria-label="Settimana sport precedente">‹</button><button class="btn" id="sport-this-week">Questa settimana</button><button class="icon-btn" data-sport-week="1" aria-label="Settimana sport successiva">›</button></div></div>'+
    '<div class="sport-summary-grid"><section class="panel sport-week-graph"><div class="panel-head"><div><h2>Il tempo per te</h2><p class="subtext">Durata delle sessioni completate in Forma</p></div><strong>'+hours(data.minutes)+'</strong></div>'+chart(data)+'</section><section class="panel sport-goal-card"><span class="page-eyebrow">COSTANZA, UNA SESSIONE ALLA VOLTA</span><div class="sport-goal-number">'+data.sessions+'<small>sessioni completate</small></div><p>'+data.workouts.filter(w=>w.completed&&!w.duration_minutes).length+' sessioni senza durata registrata.</p><a class="link" href="#/today">Vedi l’obiettivo Palestra in Agenda →</a><small>Il consuntivo Agenda si aggiorna quando aggiungi le sessioni qui sotto.</small></section></div>'+
    '<section class="panel sport-program"><div class="panel-head"><div><h2>Programma e sessioni</h2><p class="subtext">Il programma segue i giorni assegnati alle schede di Forma.</p></div><button class="btn primary" id="sport-import" '+(!connected?'disabled':'')+'>Aggiungi alla settimana</button></div><div class="sport-days">'+data.days.map((d,i)=>'<div class="sport-day '+(d.date===today(state.timezone)?'is-today':'')+'"><span class="sport-day-label">'+dayNames[i]+' <strong>'+Number(d.date.slice(8))+'</strong></span>'+
      (d.workouts.length?d.workouts.map(w=>'<div class="sport-session '+(w.completed?'done':'')+'"><strong>'+esc(w.title)+'</strong><small>'+(w.completed?'✓ Completato':'In corso')+(w.duration_minutes?' · '+w.duration_minutes+' min':'')+'</small></div>').join(''):d.plan?'<div class="sport-session planned"><strong>'+esc(d.plan.title)+'</strong><small>In programma · orario da scegliere</small></div>':'<span class="sport-day-empty">Spazio libero</span>')+'</div>').join('')+'</div><p class="sport-program-foot">Controlla le proposte prima di aggiungerle: puoi collegare una sessione a una Palestra già in Agenda. Ore e attività già registrate restano intatte.</p></section>'+
    '<section class="panel sport-shift-help"><span class="sport-brand" aria-hidden="true">'+icon('calendar')+'</span><div><h2>I turni si scrivono una volta.</h2><p>Inseriscili nella scheda Turni. Quando aggiorni il collegamento, Forma ti mostra i giorni da applicare: Apertura, Chiusura, Notte e OFF. Il tragitto rimane nell’Agenda, 30 minuti per tratta.</p></div><a class="btn" href="#/dashboard">Apri Turni →</a></section></div>';
}
async function receiveSnapshot(value) {
  pendingSnapshot=value;
  if(saving) return;saving=true;
  try {
    while(pendingSnapshot) {
      const latest=pendingSnapshot;pendingSnapshot=null;
      if(owner!==ownerKey()) return;
      await saveSportSnapshot(latest);
    }
    if(owner===ownerKey()) {if(!document.querySelector('#modal')?.open && !document.activeElement?.matches('input,textarea,select'))renderView?.();toast('Riepilogo Forma aggiornato');}
  } catch(e) {toast(e.message);}
  finally {saving=false;}
}
globalThis.window?.addEventListener('message',e=>{
  if(e.origin!==FORMA_ORIGIN || e.source!==popup || !owner || owner!==ownerKey() || e.data?.protocol!==SPORT_PROTOCOL) return;
  if(e.data.type==='ready') {
    const week=currentWeek(), turns=state.scheduleEntries.filter(x=>(x.kind==='shift'||x.kind==='off') && x.entry_date>=week && x.entry_date<=shiftDate(week,6));
    const byDate=new Map();for(const turn of turns) {const preset=shiftPreset(turn,state.timezone);if(preset!=='custom') {if(byDate.has(turn.entry_date)) byDate.set(turn.entry_date,null);else byDate.set(turn.entry_date,{date:turn.entry_date,preset});}}
    popup.postMessage({protocol:SPORT_PROTOCOL,type:'connect',nonce,turns:[...byDate.values()].filter(Boolean)},FORMA_ORIGIN);
  } else if(e.data.nonce===nonce && e.data.type==='snapshot') {
    clearTimeout(timeout); receiveSnapshot(e.data.snapshot);
  } else if(e.data.nonce===nonce && e.data.type==='cancelled') {
    clearTimeout(timeout);document.querySelector('#sport-connect-status')?.replaceChildren(document.createTextNode('Collegamento annullato. Puoi riprovare quando vuoi.'));
  }
});
function connect() {
  owner=ownerKey();if(!owner) return;
  nonce=crypto.randomUUID();
  popup=window.open(FORMA_URL+'?codemind=1','_blank','popup,width=1100,height=850');
  const status=document.querySelector('#sport-connect-status');
  if(!popup) {status.textContent='Consenti l’apertura di Forma nel browser, poi riprova.';return;}
  status.textContent='Conferma il collegamento nella finestra di Forma.';
  clearTimeout(timeout);timeout=setTimeout(()=>{if(owner===ownerKey()) {const s=document.querySelector('#sport-connect-status');if(s)s.textContent='Se il collegamento non compare, aggiorna Forma dalle sue Impostazioni e riprova.';}},20000);
}
function reviewImport() {
  const proposals=sportImportItems(snapshot(),currentWeek(),state.scheduleEntries,state.sportImports);
  if(!proposals.length) {toast('Questa settimana è già collegata oppure non contiene allenamenti da aggiungere.');return;}
  if(proposals.length>100) {toast('Questa settimana contiene molte sessioni: importa prima un gruppo più piccolo.');return;}
  openModal('Allenamenti in Agenda','<p class="subtext">Seleziona cosa aggiungere alla settimana '+weekLabel(currentWeek())+'. Le sessioni già importate vengono saltate.</p><form id="sport-import-form"><div class="sport-import-list">'+proposals.map((item,i)=>
    '<div class="sport-import-row" data-sport-proposal="'+i+'"><label class="sport-import-choice"><input type="checkbox" name="pick-'+i+'" checked><span><strong>'+esc(item.title)+'</strong><small>'+dateLabel(item.date)+' · '+(item.completed?'Completato in Forma':'Da pianificare')+'</small></span></label>'+
    '<label class="field">Collega a<select name="link-'+i+'"><option value="">Nuova attività in Agenda</option>'+item.candidates.map(e=>'<option value="'+e.id+'" '+(e.id===item.link_id?'selected':'')+'>'+esc(e.title)+(e.starts_at?' · '+timeLabel(e.starts_at,state.timezone):'')+'</option>').join('')+'</select></label>'+
    (item.completed?'<small class="sport-import-note">'+(item.started_at?'Intervallo registrato: '+timeLabel(item.started_at,state.timezone)+'–'+timeLabel(item.ended_at,state.timezone):'Orari effettivi mancanti: la sessione conta per Palestra, le ore restano da registrare.')+'</small>':'<label class="field">Minuti previsti<input name="minutes-'+i+'" type="number" value="60" min="0" max="1440"></label>')+'</div>').join('')+'</div><p class="subtext">Le attività senza orario appariranno sopra il calendario: scegli l’ora direttamente in Agenda. Gli intervalli che si sovrappongono a ore già registrate non vengono aggiunti.</p><p class="form-error" role="alert"></p><div class="form-actions"><button class="btn" type="button" id="sport-cancel-import">Annulla</button><button class="btn primary" type="submit">Conferma in Agenda</button></div></form>');
  document.querySelector('#sport-cancel-import').onclick=closeModal;
  document.querySelector('#sport-import-form').onsubmit=async e=>{
    e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
    try {
      const selected=proposals.flatMap((item,i)=>{
        if(!form.elements['pick-'+i].checked)return [];
        const linkId=form.elements['link-'+i].value,entry=state.scheduleEntries.find(x=>x.id===linkId);
        const minutes=item.completed?0:Number(form.elements['minutes-'+i].value);
        if(!Number.isInteger(minutes)||minutes<0||minutes>1440)throw Error('Inserisci una durata prevista valida.');
        return [{...item,planned_minutes:minutes,link_id:linkId||null,expected_updated_at:entry?.updated_at||null}];
      });
      const result=await importSportItems(selected);closeModal();renderView?.();
      toast(result.imported+' allenamenti collegati'+(result.missing_times?' · '+result.missing_times+' sessioni con ore da controllare in Agenda.':'.'));
    } catch(error) {form.querySelector('.form-error').textContent=error.message;button.disabled=false;}
  };
}
export function sportPage(scheda){if(scheda)apriSchedaForma(scheda);return formaWorkspace(sportSummary());}
export function bindSport(render) {
  bindFormaWorkspace(render);
  renderView=render;
  const button=document.querySelector('#sport-connect');if(!button)return;
  button.onclick=connect;
  const disconnect=document.querySelector('#sport-disconnect');
  if(disconnect) disconnect.onclick=()=>{
    openModal('Scollega Forma','<p>Rimuovi il riepilogo collegato a questo workspace. Tutti gli allenamenti in Forma e le attività già aggiunte in Agenda restano salvati.</p><div class="form-actions"><button class="btn" id="sport-keep">Annulla</button><button class="btn danger" id="sport-confirm-disconnect">Scollega</button></div><p class="form-error" role="alert"></p>');
    document.querySelector('#sport-keep').onclick=closeModal;
    document.querySelector('#sport-confirm-disconnect').onclick=async e=>{
      e.target.disabled=true;
      try {owner='';nonce='';clearTimeout(timeout);pendingSnapshot=null;await disconnectSport();closeModal();render();toast('Forma scollegata. Lo storico resta salvato.');}
      catch(error){document.querySelector('#modal .form-error').textContent=error.message;e.target.disabled=false;}
    };
  };
  document.querySelectorAll('[data-sport-week]').forEach(b=>b.onclick=()=>{selectedWeek=shiftDate(currentWeek(),Number(b.dataset.sportWeek)*7);render();});
  document.querySelector('#sport-this-week').onclick=()=>{selectedWeek=weekStart(today(state.timezone));render();};
  document.querySelector('#sport-import').onclick=reviewImport;
}
