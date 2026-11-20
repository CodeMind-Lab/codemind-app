export const MAX_ITEMS = 500;
export const normalizeTitle = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');
export function cleanTitle(value) {
  return String(value || '').replace(/^\s*(?:[-*+•▪●◦]\s+|\d+[.)]\s+)/, '').replace(/^\s*(?:\[[ xX✓]\]|[☐☑✅□✓✔])\s*/, '').trim();
}
export function textRows(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  return lines.map(cleanTitle).filter(Boolean).map(title => ({title, description:''}));
}
const titleHeaders = ['attivita','titolo','task','todo','cosa da fare','cose da fare','checklist','voce','azione','activity','title','name','nome'];
export function headerKey(value) { return normalizeTitle(value).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
export function tableDefaults(grid) {
  for(let i=0; i<Math.min(10,grid.length); i++) {
    const column = grid[i].findIndex(v => titleHeaders.includes(headerKey(v)));
    if(column>=0) return {headerRow:i, column, idColumn:grid[i].findIndex(v=>headerKey(v)==='id'), hasHeader:true};
  }
  return {headerRow:0, column:0, idColumn:-1, hasHeader:false};
}
export function tableRows(grid, {headerRow=0,column=0,hasHeader=false,idColumn}={}) {
  const headers = hasHeader ? grid[headerRow].map(headerKey) : [];
  const idIndex = idColumn === undefined ? headers.indexOf('id') : idColumn;
  const extra = headers.map((v,i)=>({v,i})).filter(x=>['descrizione','description','note','notes','sezione','categoria','prerequisiti'].includes(x.v) && x.i!==column && x.i!==idIndex);
  return grid.slice(headerRow+(hasHeader?1:0)).filter(r=>String(r[column]??'').trim()).map(r=>{
    const sourceId = idIndex >= 0 ? String(r[idIndex] ?? '').trim() : '';
    const details = extra.filter(x=>String(r[x.i]??'').trim()).map(x=>`${grid[headerRow][x.i]}: ${r[x.i]}`);
    if(sourceId) details.unshift(`ID: ${sourceId}`);
    return {title:cleanTitle(r[column]),description:details.join('\n'),...(sourceId ? {sourceId} : {})};
  });
}
export function planChecklist(rows, existing=[]) {
  if(rows.length>MAX_ITEMS) throw Error(`Importa al massimo ${MAX_ITEMS} voci per volta.`);
  const seen = new Set(existing.map(t=>normalizeTitle(t.title)));
  return rows.map(row=>{
    const title=cleanTitle(row.title), key=normalizeTitle(title);
    const invalid=!title || title.length>200;
    const duplicate=!invalid && seen.has(key);
    if(!invalid && row.selected!==false) seen.add(key);
    return {...row,title,invalid,duplicate,ready:!invalid&&!duplicate&&row.selected!==false};
  });
}

// Older imports retain the source row order in position; newer ones keep the ID.
export function checklistId(task) {
  return String(task.sourceId || '').trim() || String(task.description || '').match(/^ID:\s*(.+)$/im)?.[1]?.trim() || '';
}
export function compareChecklistTasks(a, b) {
  const aId = checklistId(a), bId = checklistId(b);
  if (Boolean(aId) !== Boolean(bId)) return aId ? -1 : 1;
  const idOrder = aId && bId ? aId.localeCompare(bId, 'it', {numeric:true, sensitivity:'base'}) : 0;
  const position = task => task.position != null && Number.isFinite(Number(task.position)) ? Number(task.position) : Number.MAX_SAFE_INTEGER;
  return idOrder || position(a) - position(b) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id));
}
