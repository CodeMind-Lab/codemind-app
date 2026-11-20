import {workspaceProjects} from "../utils/university.js?v=65";
import {state} from '../services/store.js?v=65';
import {openModal,closeModal,options,toast} from '../utils/dom.js?v=65';
import {esc} from '../utils/helpers.js?v=65';
import {readChecklistFile} from '../services/checklistReader.js?v=65';
import {importChecklist} from '../services/checklistImportService.js?v=65';
import {MAX_ITEMS,textRows,tableDefaults,tableRows,planChecklist,checklistId,compareChecklistTasks} from '../utils/checklist.js?v=65';
export function openChecklistImport(projectId,onDone) {
  const projects=workspaceProjects(state.projects,projectId).filter(p=>p.status!=='archived');
  if(!projects.length) {openModal('Prima crea un progetto','<p>Crea un progetto, poi importa la checklist per aggiungere le cose da fare.</p>');return;}
  const selected=projects.some(p=>p.id===projectId)?projectId:projects[0].id;
  openModal('Importa checklist come attività', `<form id="checklist-import-form">
    <p>Ogni voce selezionata diventa un’attività <strong>Da fare</strong> nel progetto scelto.</p>
    <label class="field">Progetto di destinazione<select id="checklist-project">${options(Object.fromEntries(projects.map(p=>[p.id,p.name])),selected)}</select></label>
    <label class="field">File della checklist<input id="checklist-file" type="file" accept=".csv,.tsv,.xlsx,.xls,.ods,.docx,.pdf,.txt,.md"></label>
    <p class="subtext">Excel, CSV, Word (.docx), PDF con testo, TXT e Markdown · massimo 10 MB e ${MAX_ITEMS} voci. Il file viene letto sul dispositivo.</p>
    <details><summary>Oppure incolla elenco</summary><label class="field">Una voce per riga<textarea id="checklist-paste" rows="5" placeholder="Preparare i contenuti&#10;Controllare le immagini&#10;Pubblicare il progetto"></textarea></label><button class="btn" type="button" id="checklist-use-text">Leggi elenco</button></details>
    <div id="checklist-table-options" class="form-grid" hidden></div>
    <p id="checklist-notice" class="subtext"></p>
    <div id="checklist-preview" hidden><div class="heading-actions"><button class="btn" type="button" id="checklist-select-all">Seleziona tutte</button><button class="btn" type="button" id="checklist-select-none">Deseleziona tutte</button></div><div class="checklist-import-scroll"><table><thead><tr><th>Importa</th><th>ID</th><th>Cosa da fare</th><th>Esito</th></tr></thead><tbody id="checklist-rows"></tbody></table></div></div>
    <p id="checklist-summary" role="status">Scegli un file per vedere l’anteprima.</p>
    <p class="form-error" role="alert"></p>
    <p class="subtext">Le attività esistenti rimangono invariate. Le voci con lo stesso titolo nello stesso progetto vengono saltate.</p>
    <div class="form-actions"><button class="btn" type="button" id="checklist-cancel">Annulla</button><button class="btn primary" type="submit" disabled id="checklist-submit">Aggiungi attività</button></div>
  </form>`);
  const dialog=document.querySelector('#modal'), form=dialog.querySelector('#checklist-import-form');
  const find=id=>form.querySelector('#checklist-'+id);
  const project=find('project'), preview=find('preview'), submit=find('submit'), summary=find('summary'), error=form.querySelector('.form-error');
  const sessionMode=state.mode,sessionOwner=state.user?.id;
  let rows=[],fileName='',documentData=null,reading=0,busy=false;
  const alive=()=>form.isConnected&&state.mode===sessionMode&&state.user?.id===sessionOwner;
  function plan(){return planChecklist(rows,state.tasks.filter(t=>t.project_id===project.value));}
  function update() {
    const result=plan(), ready=result.filter(r=>r.ready).length;
    result.forEach((row,i)=>{const cell=find('rows').querySelector(`[data-result="${i}"]`); if(cell) cell.textContent=row.selected===false?'Esclusa':row.invalid?'Titolo richiesto, massimo 200 caratteri':row.duplicate?'Già presente / duplicato':'Da aggiungere';});
    summary.textContent=`${ready} attività da aggiungere · ${result.filter(r=>r.duplicate&&r.selected!==false).length} duplicati saltati · ${result.filter(r=>r.invalid&&r.selected!==false).length} voci da correggere`;
    submit.disabled=busy||!ready||result.some(r=>r.invalid&&r.selected!==false);
    submit.textContent=busy?'Importazione…':`Aggiungi ${ready} attività`;
  }
  function showRows(next) {
    if(next.length>MAX_ITEMS) throw Error(`La checklist contiene più di ${MAX_ITEMS} voci. Dividi il file in parti più piccole.`);
    if(!next.length) throw Error('Nessuna voce trovata. Controlla il file o incolla l’elenco.');
    rows=next.map((r,i)=>({...r,position:i,selected:true})).sort(compareChecklistTasks);
    find('rows').innerHTML=rows.map((r,i)=>`<tr><td><input type="checkbox" checked data-include="${i}" aria-label="Importa voce ${i+1}"></td><td class="nowrap">${esc(checklistId(r)) || "—"}</td><td><input type="text" data-title="${i}" value="${esc(r.title)}" aria-label="Titolo voce ${i+1}">${r.description?`<small class="subtext">${esc(r.description.replace(/^ID:[^\n]*\n?/im,""))}</small>`:''}</td><td data-result="${i}"></td></tr>`).join('');
    preview.hidden=false;update();
  }
  find('rows').oninput=e=>{if(e.target.hasAttribute('data-title')){rows[Number(e.target.dataset.title)].title=e.target.value;update();}};
  find('rows').onchange=e=>{if(e.target.hasAttribute('data-include')){rows[Number(e.target.dataset.include)].selected=e.target.checked;update();}};
  for(const [id,value] of [['select-all',true],['select-none',false]]) find(id).onclick=()=>{rows.forEach(r=>r.selected=value);find('rows').querySelectorAll('[data-include]').forEach(el=>el.checked=value);update();};
  project.onchange=()=>{if(rows.length) update();};
  function clear() {rows=[];preview.hidden=true;find('table-options').hidden=true;find('notice').textContent='';error.textContent='';submit.disabled=true;summary.textContent='Lettura della checklist…';}
  function tableControls() {
    const controls=find('table-options'); controls.hidden=false;
    controls.innerHTML=`<label class="field">Foglio<select id="checklist-sheet">${options(Object.fromEntries(documentData.sheets.map((s,i)=>[i,s.name])),0)}</select></label><label class="field">Colonna delle attività<select id="checklist-column"></select></label><label class="field">Colonna ID<select id="checklist-id-column" aria-label="Colonna ID della checklist"></select></label><p class="subtext">L’ID resta associato alla voce e non cambia quando modifichi il titolo. L’anteprima è ordinata per ID crescente.</p><label class="field">Riga iniziale<input id="checklist-header-row" type="number" min="1" value="1"></label><label class="field"><span>Intestazione</span><span><input type="checkbox" id="checklist-has-header"> La riga iniziale contiene i nomi delle colonne</span></label>`;
    function grid(){return documentData.sheets[Number(find('sheet').value)].grid;}
    function readTable() {error.textContent='';try {const g=grid(),headerRow=Number(find('header-row').value)-1;if(!Number.isInteger(headerRow)||headerRow<0||headerRow>=g.length) throw Error('Scegli una riga iniziale valida.');showRows(tableRows(g,{headerRow,column:Number(find('column').value),idColumn:Number(find('id-column').value),hasHeader:find('has-header').checked}));} catch(e) {rows=[];preview.hidden=true;submit.disabled=true;summary.textContent='Controlla foglio, colonna e riga iniziale.';error.textContent=e.message;}}
    function chooseSheet(){const g=grid(),defaults=tableDefaults(g);find('header-row').value=defaults.headerRow+1;find('has-header').checked=defaults.hasHeader;const width=Math.max(1,...g.slice(0,20).map(r=>r.length));find('column').innerHTML=options(Object.fromEntries(Array.from({length:width},(_,i)=>[i,`Colonna ${i+1}${g[defaults.headerRow]?.[i]?' · '+String(g[defaults.headerRow][i]).slice(0,60):''}`])),String(defaults.column));find('id-column').innerHTML=options({'-1':'Nessuna colonna ID',...Object.fromEntries(Array.from({length:width},(_,i)=>[i,`Colonna ${i+1}${g[defaults.headerRow]?.[i]?' · '+String(g[defaults.headerRow][i]).slice(0,60):''}`]))},String(defaults.idColumn));readTable();}
    find('sheet').onchange=chooseSheet;find('column').onchange=readTable;find('id-column').onchange=readTable;find('header-row').onchange=readTable;find('has-header').onchange=readTable;chooseSheet();
  }
  find('file').onchange=async()=>{
    const ticket=++reading,file=find('file').files?.[0];clear();if(!file){summary.textContent='Scegli un file.';return;}
    try {const data=await readChecklistFile(file);if(ticket!==reading||!alive())return;documentData=data;fileName=file.name;find('notice').textContent=data.notice;if(data.sheets)tableControls();else showRows(data.rows);}
    catch(e){if(ticket===reading&&alive()){error.textContent=e.message;summary.textContent='Il file non è stato importato.';}}
  };
  find('use-text').onclick=()=>{++reading;clear();fileName='elenco incollato';try{showRows(textRows(find('paste').value));}catch(e){error.textContent=e.message;summary.textContent='Controlla l’elenco.';}};
  find('cancel').onclick=()=>{if(!busy)closeModal();};
  const cancelWhileBusy=e=>{if(busy)e.preventDefault();};dialog.addEventListener('cancel',cancelWhileBusy);dialog.addEventListener('close',()=>dialog.removeEventListener('cancel',cancelWhileBusy),{once:true});
  form.onsubmit=async e=>{
    e.preventDefault();if(submit.disabled||busy)return;
    if(!alive()){error.textContent='La sessione è cambiata. Riapri l’importazione.';return;}
    busy=true;error.textContent='';
    const controls=[...form.querySelectorAll('input,select,textarea,button'),dialog.querySelector('[data-close]')];controls.forEach(el=>el.disabled=true);
    try {
      const result=await importChecklist(rows,project.value,fileName,(current,total)=>{summary.textContent=`Aggiunte ${current} di ${total} attività…`;});
      busy=false;closeModal();onDone?.();toast(`${result.count} attività aggiunte al progetto${result.skipped?` · ${result.skipped} voci saltate`:''}.`);
    } catch(exception) {error.textContent=exception.message;}
    finally {busy=false;controls.forEach(el=>el.disabled=false);if(form.isConnected&&dialog.open)update();}
  };
}
