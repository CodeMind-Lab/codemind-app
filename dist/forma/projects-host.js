/* Runs only in the Projects-owned editor frame; no independent database or login. */
'use strict';
(() => {
 const protocol='codemind-forma-editor-v1',origin=location.origin;
 let nonce='',base=null,applying=false,inflight=null,changed=false,ready=false;
 const value=()=>FormaModel.normalize({items:DB.items,settings:DB.settings,graves:DB.graves});
 const post=(type,data={})=>parent.postMessage({protocol,type,nonce,...data},origin);
 function send(){if(!ready||applying)return;changed=true;if(inflight)return;const next=value();if(FormaModel.same(base,next)){changed=false;return;}inflight={id:crypto.randomUUID(),next};changed=false;post('patch',{request_id:inflight.id,archive:next,base});}
 function apply(archive,theme){
  applying=true;const a=FormaModel.normalize(archive);DB.items=a.items;DB.settings={recDefault:90,...a.settings};DB.graves=a.graves;DB.dirty={};scadeCatalogo();
  document.documentElement.setAttribute('data-tema',theme==='dark'?'scuro':'chiaro');renderConFuoco();applying=false;
 }
 window.addEventListener('message',e=>{
  if(e.source!==parent||e.origin!==origin||e.data?.protocol!==protocol)return;
  const data=e.data;
  if(data.type==='init'){
   if(ready)return;nonce=data.nonce;base=FormaModel.normalize(data.archive);apply(base,data.theme);ready=true;
   applying=true;migraPiano();migraElencoTurni();migraTurni();applying=false;
   vai({name:data.tab||'oggi',d:data.date||oggiISO()},false);send();return;
  }
  if(!ready||data.nonce!==nonce)return;
  if(data.type==='nav'){vai({name:data.tab,d:data.date||view.d},false);return;}
  if(data.type==='saved'&&data.request_id===inflight?.id){
   try{const local=value(),next=FormaModel.merge(inflight.next,local,data.archive);base=FormaModel.normalize(data.archive);inflight=null;if(!FormaModel.same(next,local))apply(next,data.theme);if(changed||!FormaModel.same(base,next))send();}
   catch(err){post('error',{message:err.message});}return;
  }
  if(data.type==='sync'){
   if(inflight){changed=true;return;}
   try{const next=FormaModel.merge(base,value(),data.archive);base=FormaModel.normalize(data.archive);apply(next,data.theme);send();}catch(err){post('error',{message:err.message});}return;
  }
  if(data.type==='failed'&&data.request_id===inflight?.id){inflight=null;changed=true;toast('Modifica conservata. Premi Riprova in Projects.');return;}
  if(data.type==='flush'){send();return;}
 });
 window.addEventListener('forma:data-changed',send);
 // Dated turns are edited through Projects' existing week editor.
 document.addEventListener('click',e=>{
  const target=e.target.closest('[data-act="scegli-turno"]');if(target){e.preventDefault();e.stopImmediatePropagation();post('turns',{date:view.d});}
  const action=e.target.closest('[data-act]')?.dataset.act;
  if(action==='aggiorna'){e.preventDefault();e.stopImmediatePropagation();post('reload');}
  if(action==='azzera'){
   e.preventDefault();e.stopImmediatePropagation();
   if(confirm('Svuotare l’archivio Forma collegato a Projects? Esporta prima una copia.')){for(const item of DB.items)DB.graves[item.id]=Date.now();DB.items=[];DB.settings={recDefault:90};save(true);render();}
  }
 },true);
 post('ready');
})();
