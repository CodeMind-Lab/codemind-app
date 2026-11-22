import { state } from '../services/store.js?v=65';
import { formaModel,saveForma,syncFormaTurns,pendingForma,nutritionToday } from '../services/formaService.js?v=65';
import { FORMA_URL,FORMA_ORIGIN } from '../utils/sport.js?v=65';
import { today } from '../utils/dates.js?v=65';
import { weekStart } from '../utils/agenda.js?v=65';
import { openWorkWeek } from './agenda.js?v=68';
import { esc } from '../utils/helpers.js?v=65';
import { toast } from '../utils/dom.js?v=65';
const protocol='codemind-forma-workspace-v1',editorProtocol='codemind-forma-editor-v1';
const ownerKey=()=>state.mode==='cloud'?state.user?.id:state.mode==='demo'?'demo':'';
let tab='summary',renderView,peer,nonce='',peerOwner='',frameNonce='',frameOwner='',activeFrame,updateTimer;
const tabs={summary:'Riepilogo',oggi:'Oggi',cibo:'Alimentazione',allena:'Allenamento',agenda:'Agenda Forma',report:'Report',settings:'Preferenze'};
const theme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
function notifyArchive(saved,request_id){
 if(activeFrame?.isConnected&&frameOwner===ownerKey())activeFrame.contentWindow.postMessage({protocol:editorProtocol,type:request_id?'saved':'sync',nonce:frameNonce,request_id,archive:saved.archive,theme:theme()},location.origin);
 if(peer&&!peer.closed&&peerOwner===ownerKey())peer.postMessage({protocol,type:'saved',nonce,source_id:saved.source_id,archive:saved.archive},FORMA_ORIGIN);
 const status=document.querySelector('#forma-save-status');if(status)status.textContent='Salvato nel tuo workspace';
}
// Dal menu del telefono "Pasti" apre direttamente il diario (#/sport/cibo).
export function apriSchedaForma(chiave){if(tabs[chiave])tab=chiave;}
// Solo la finestra della Forma classica su una sua scheda: la usa la sezione nativa
// Palestra e alimentazione per le schede non ancora rifatte.
export function formaClassica(chiave){if(tabs[chiave])tab=chiave;return '<div class="forma-editor-wrap"><iframe id="forma-editor" src="forma/index.html?v=65" title="Forma · '+esc(tabs[tab])+'" allow="camera" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"></iframe></div>';}
export function formaDashboardNutrition(){
 const data=nutritionToday(today(state.timezone));return data?'<div class="forma-nutrition-home"><span>Alimentazione di oggi</span><strong>'+Math.round(data.total.k)+' <small>kcal registrate</small></strong><p>Proteine '+Math.round(data.total.p)+' g · Carboidrati '+Math.round(data.total.c)+' g · Grassi '+Math.round(data.total.g)+' g</p><a class="link" href="#/sport" data-forma-open-food>Apri alimentazione →</a></div>':'';
}
export function formaWorkspace(summary){
 const connected=!!state.formaArchive;
 return '<div class="forma-workspace '+(connected?'is-complete':'')+'"><section class="panel forma-workspace-heading"><div><h1>Palestra e alimentazione</h1><p>Pasti, schede, allenamenti e misure. I turni arrivano da soli dall’Agenda.</p></div><div class="forma-heading-actions"><button class="btn primary" id="forma-connect">'+(connected?'Allinea con Forma':'Collega Forma completa')+'</button><button class="btn" id="forma-work-turns">Turni Projects</button></div></section>'+
 '<div class="forma-workspace-status"><span id="forma-save-status" role="status">'+(connected?'Archivio collegato · turni sincronizzati con Projects':'Collega il tuo archivio una volta, poi gestiscilo direttamente qui.')+'</span><button class="link" id="forma-retry" '+(!pendingForma()?'hidden':'')+'>Riprova salvataggio</button><button class="link" id="forma-export-pending" '+(!pendingForma()?'hidden':'')+'>Scarica copia delle modifiche</button></div>'+
 '<nav class="forma-tabs" aria-label="Sezioni Forma">'+Object.entries(tabs).map(([key,label])=>'<button class="'+(tab===key?'active':'')+'" data-forma-tab="'+key+'" aria-pressed="'+(tab===key)+'">'+label+'</button>').join('')+'</nav>'+
 (tab==='summary'?summary:connected?'<div class="forma-editor-wrap"><iframe id="forma-editor" src="forma/index.html?v=65" title="Forma · '+esc(tabs[tab])+'" allow="camera" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"></iframe></div>':'<section class="panel forma-empty"><h2>La tua dieta e le tue schede, già pronte.</h2><p>Collega l’archivio che usi in Forma: ritroverai diario, piano, alimenti, ricette, allenamenti e misure. Le schermate di modifica restano quelle di Forma.</p><div class="forma-empty-actions"><button class="btn primary" data-forma-backup>Parti da un backup di Forma</button><button class="btn" data-forma-connect>Collega dal browser</button></div><input type="file" id="forma-backup-file" accept=".json,application/json" hidden><p class="subtext">Il backup si crea nella vecchia Forma da Impostazioni → Esporta tutto (file JSON): funziona anche dall’iPhone. “Collega dal browser” serve se i dati sono già in Forma su questo stesso browser.</p></section>')+'</div>';
}
function connect(){
 peerOwner=ownerKey();if(!peerOwner)return;nonce=crypto.randomUUID();
 peer=window.open(FORMA_URL+'?codemind=workspace','_blank','popup,width=1100,height=850');
 const status=document.querySelector('#forma-save-status');if(status)status.textContent=peer?'Conferma il collegamento completo nella finestra di Forma.':'Consenti l’apertura di Forma nel browser e riprova.';
}
function status(message,failed=false){const el=document.querySelector('#forma-save-status');if(el){el.textContent=message;el.classList.toggle('form-error',failed);}for(const id of ['forma-retry','forma-export-pending']){const b=document.getElementById(id);if(b)b.hidden=!pendingForma();}}
async function saveEditor(data,source,owner){
 status('Salvataggio in corso…');
 try{const saved=await saveForma(data.archive,data.base,state.formaArchive?.source_id);if(owner!==ownerKey())return;notifyArchive(saved,data.request_id);status('Salvato nel tuo workspace');}
 catch(err){if(owner!==ownerKey())return;source.postMessage({protocol:editorProtocol,type:'failed',nonce:frameNonce,request_id:data.request_id},location.origin);status(err.message,true);}
}
globalThis.window?.addEventListener('message',async e=>{
 const data=e.data;
 if(e.origin===location.origin&&e.source===activeFrame?.contentWindow&&data?.protocol===editorProtocol){
  if(frameOwner!==ownerKey())return;
  if(data.type==='ready'){let archive=state.formaArchive.archive;const pending=pendingForma();if(pending&&pending.source_id===state.formaArchive.source_id)try{archive=formaModel.merge(pending.base,pending.archive,archive);}catch(err){status(err.message,true);}
 e.source.postMessage({protocol:editorProtocol,type:'init',nonce:frameNonce,archive,tab,date:today(state.timezone),theme:theme()},location.origin);return;}
  if(data.nonce!==frameNonce)return;
  if(data.type==='patch'){saveEditor(data,e.source,frameOwner);return;}
  if(data.type==='turns'){openWorkWeek(renderView,weekStart(data.date));return;}
  if(data.type==='reload'){e.source.postMessage({protocol:editorProtocol,type:'flush',nonce:frameNonce},location.origin);return;}
  if(data.type==='error')status(data.message,true);return;
 }
 if(e.origin!==FORMA_ORIGIN||e.source!==peer||data?.protocol!==protocol||peerOwner!==ownerKey())return;
 if(data.type==='ready'){peer.postMessage({protocol,type:'connect',nonce},FORMA_ORIGIN);return;}
 if(data.nonce!==nonce)return;
 if(data.type==='archive'){
  const capturedOwner=peerOwner,capturedNonce=nonce;
  try{
   const wasConnected=!!state.formaArchive,saved=await saveForma(data.archive,data.base,data.source_id);
   if(capturedOwner!==ownerKey()||nonce!==capturedNonce)return;
   peer.postMessage({protocol,type:'saved',nonce,source_id:saved.source_id,archive:saved.archive,request_id:data.request_id},FORMA_ORIGIN);
   if(!wasConnected){tab='oggi';renderView?.();}else notifyArchive(saved);
   status('Forma e Projects allineati. Ora puoi modificare tutto qui.');
  }catch(err){if(capturedOwner!==ownerKey()||nonce!==capturedNonce)return;status(err.message,true);peer.postMessage({protocol,type:'error',nonce,message:err.message},FORMA_ORIGIN);}
 }else if(data.type==='cancelled')status('Collegamento annullato. Il tuo archivio resta in Forma.');
 else if(data.type==='conflict')status(data.message,true);
});
globalThis.window?.addEventListener('cm:agenda-updated',()=>{
 clearTimeout(updateTimer);updateTimer=setTimeout(async()=>{try{const saved=await syncFormaTurns();if(saved)notifyArchive(saved);}catch(err){status(err.message,true);}},80);
});
export function bindFormaWorkspace(render){
 renderView=render;
 document.querySelectorAll('#forma-connect,[data-forma-connect]').forEach(b=>b.onclick=connect);
 document.querySelector('#forma-work-turns')?.addEventListener('click',()=>openWorkWeek(render,weekStart(today(state.timezone))));
 document.querySelectorAll('[data-forma-tab]').forEach(b=>b.onclick=()=>{
  tab=b.dataset.formaTab;
  if(activeFrame?.isConnected&&tab!=='summary'){
   document.querySelectorAll('[data-forma-tab]').forEach(t=>{t.classList.toggle('active',t.dataset.formaTab===tab);t.setAttribute('aria-pressed',String(t.dataset.formaTab===tab));});
   activeFrame.title='Forma · '+tabs[tab];activeFrame.contentWindow.postMessage({protocol:editorProtocol,type:'nav',nonce:frameNonce,tab},location.origin);
  }else render();
 });
 const frame=document.getElementById('forma-editor');if(frame&&frame!==activeFrame){activeFrame=frame;frameOwner=ownerKey();frameNonce=crypto.randomUUID();}
 document.querySelector('#forma-retry')?.addEventListener('click',async()=>{const pending=pendingForma();if(!pending)return;try{const saved=await saveForma(pending.archive,pending.base,pending.source_id);notifyArchive(saved);activeFrame?.contentWindow.postMessage({protocol:editorProtocol,type:'flush',nonce:frameNonce},location.origin);status('Modifiche salvate.');}catch(err){status(err.message,true);}});
 document.querySelector('#forma-export-pending')?.addEventListener('click',()=>{const pending=pendingForma();if(!pending)return;const url=URL.createObjectURL(new Blob([JSON.stringify({v:1,app:'forma',...pending.archive},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='forma-modifiche-da-salvare.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 document.querySelectorAll('[data-forma-open-food]').forEach(a=>a.onclick=()=>{tab='cibo';});
 // Primo avvio da un file di backup di Forma: è il modo per portare i dati dalla Forma
 // installata sull'iPhone, che ha una memoria sua e non è raggiungibile dal browser.
 const file=document.getElementById('forma-backup-file');
 document.querySelector('[data-forma-backup]')?.addEventListener('click',()=>file?.click());
 if(file)file.onchange=async()=>{
  const scelto=file.files[0];if(!scelto)return;
  status('Lettura del backup…');
  try{
   const dati=JSON.parse(await scelto.text());
   if(dati?.app!=='forma'||!Array.isArray(dati.items))throw Error('Il file non è un backup di Forma.');
   const archivio={version:1,items:dati.items,settings:{recDefault:90,...(dati.settings||{})},graves:{}};
   await saveForma(archivio,null,crypto.randomUUID());
   tab='oggi';status('Backup caricato: i dati di Forma sono nel tuo workspace.');render();
  }catch(err){status(err.message,true);}
  finally{file.value='';}
 };
}
