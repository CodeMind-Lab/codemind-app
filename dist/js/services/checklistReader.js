import {textRows} from '../utils/checklist.js?v=65';
const vendor = new URL('../../assets/import/', import.meta.url);
const scripts = new Map();
async function loadScript(file, globalName) {
  if(globalThis[globalName]) return globalThis[globalName];
  if(!scripts.has(file)) scripts.set(file,new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src=new URL(file,vendor).href;
    script.onload=()=>resolve(globalThis[globalName]);
    script.onerror=()=>{scripts.delete(file);script.remove();reject(Error('Lettore del file non disponibile. Controlla la connessione e riprova.'));};
    document.head.append(script);
  }));
  return scripts.get(file);
}
export async function readChecklistFile(file) {
  if(!file || !file.size) throw Error('Scegli un file non vuoto.');
  if(file.size>10*1024*1024) throw Error('Il file supera il limite di 10 MB.');
  const extension=file.name.split('.').pop().toLowerCase();
  if(['txt','md'].includes(extension)) return {rows:textRows(await file.text()),notice:'Ogni riga diventa un’attività. Escludi eventuali titoli o intestazioni nell’anteprima.'};
  if(['csv','tsv','xlsx','xls','ods'].includes(extension)) {
    const xlsx=await loadScript('xlsx.full.min.js','XLSX');
    const plain=['csv','tsv'].includes(extension);
    const book=xlsx.read(plain ? await file.text() : await file.arrayBuffer(),{type:plain?'string':'array',cellHTML:false,cellFormula:false,sheetRows:1002});
    const sheets=book.SheetNames.map(name=>({name,grid:xlsx.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false,blankrows:false})}));
    return {sheets,notice:'Scegli il foglio, la colonna delle attività e la colonna ID. Controlla le voci prima di importarle.'};
  }
  if(extension==='docx') {
    const mammoth=await loadScript('mammoth.browser.min.js','mammoth');
    const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    return {rows:textRows(result.value),notice:'Ogni paragrafo diventa un’attività. Controlla titoli, tabelle e voci su più righe nell’anteprima.'};
  }
  if(extension==='pdf') {
    const pdfjs=await import('../../assets/import/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',vendor).href;
    const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
    let pdf;
    try {
      pdf=await loading.promise;
      if(pdf.numPages>50) throw Error('Il PDF supera 50 pagine: importa un estratto con la checklist.');
      const lines=[];
      for(let i=1;i<=pdf.numPages;i++) {
        const page=await pdf.getPage(i), text=await page.getTextContent();
        let line='', lastY;
        for(const item of text.items) {
          if(typeof item.str!=='string') continue;
          const y=item.transform?.[5];
          if(line && lastY!==undefined && Math.abs(y-lastY)>3) {lines.push(line);line='';}
          line+=(line?' ':'')+item.str;lastY=y;
          if(item.hasEOL) {lines.push(line);line='';lastY=undefined;}
        }
        if(line) lines.push(line);
      }
      const rows=textRows(lines.join('\n'));
      if(!rows.length) throw Error('Questo PDF non contiene testo leggibile: per una scansione o una foto, copia la checklist nel campo “Incolla elenco” oppure usa un file Excel, Word o di testo.');
      return {rows,notice:'Testo estratto dal PDF: correggi eventuali righe spezzate ed escludi intestazioni e numeri di pagina.'};
    } finally {await loading.destroy();}
  }
  throw Error('Per creare attività usa CSV, Excel (.xlsx o .xls), ODS, Word (.docx), PDF con testo, TXT o Markdown. Per foto e altri file usa “Allega file”.');
}
