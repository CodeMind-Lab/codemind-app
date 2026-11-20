import { state } from './store.js?v=65';
const sessions = new Map();
export const draftOwner = () => state.mode === 'cloud' ? `user:${state.user?.id}` : state.mode;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function readDraft(resource) {
  try { return JSON.parse(localStorage.getItem(`cm-draft:${draftOwner()}:${resource}`) || 'null'); }
  catch { return null; }
}
export function editorSession(resource, initial, existing, write) {
  const owner = draftOwner(), key = `cm-draft:${owner}:${resource}`;
  let session = sessions.get(key);
  if (resource === 'note:new' && session?.existing && !session.dirty && !session.saving) { sessions.delete(key); session = null; }
  if (session) {
    session.write = write;
    if (!session.dirty && !session.saving && existing && existing.updated_at !== session.existing?.updated_at) { session.values=initial; session.existing=existing; }
    return session;
  }
  const recovered = readDraft(resource);
  const s = {key,owner,values:recovered?.values || initial,existing:recovered ? recovered.existing : existing,write,
    dirty:!!recovered, saving:false, error:'', storageError:false, timer:null, listeners:new Set(), restored:!!recovered};
  s.notify = () => s.listeners.forEach(fn => fn(s));
  s.persist = () => {
    try { localStorage.setItem(key,JSON.stringify({values:s.values,existing:s.existing || null})); s.storageError=false; }
    catch { s.storageError=true; }
  };
  s.update = values => { s.values={...values}; s.dirty=true; s.error=''; s.persist(); s.notify(); clearTimeout(s.timer); s.timer=setTimeout(() => s.flush(),900); };
  s.flush = async () => {
    clearTimeout(s.timer);
    if (s.saving) return s.pending;
    if (!s.dirty || owner !== draftOwner() || state.mode === 'signed_out') return false;
    const snapshot={...s.values};
    s.saving=true; s.error=''; s.notify();
    s.pending=(async () => {
      try {
        const result=await s.write(snapshot,s.existing);
        s.existing=result;
        s.restored=false;
        s.dirty=!same(snapshot,s.values);
        if (s.dirty) s.persist();
        else { try { localStorage.removeItem(key); } catch {} }
        return true;
      } catch(error) { s.error=error.message; s.persist(); return false; }
      finally { s.saving=false; s.notify(); if(s.dirty && !s.error && owner === draftOwner()) s.timer=setTimeout(() => s.flush(),900); }
    })();
    return s.pending;
  };
  sessions.set(key,s);
  return s;
}
export function autosaveLabel(s) {
  if(s.storageError) return 'Recupero locale non disponibile: mantieni aperta la pagina.';
  if(s.saving) return 'Salvataggio…';
  if(s.error) return 'Non salvato · Bozza conservata in questo browser';
  if(s.dirty) return s.restored ? 'Bozza recuperata · Premi Salva per confermarla' : 'Modifiche da salvare · Bozza protetta';
  if(!s.existing) return 'Salvataggio automatico dopo la scrittura';
  return 'Salvato';
}
export function bindAutosave(form,s,read,status,onSaved=()=>{}) {
  const notify=() => {
    if(!form.isConnected) { s.listeners.delete(notify); return; }
    status.textContent=autosaveLabel(s);
    form.querySelector('.form-error').textContent=s.error;
    form.querySelector('[type=submit]').disabled=s.saving;
    if(!s.dirty && !s.saving && s.existing) onSaved();
  };
  s.listeners.add(notify); notify();
  form.addEventListener('input',()=>s.update(read()));
  form.onsubmit=async e=>{e.preventDefault(); if(!same(s.values,read())) s.update(read()); await s.flush();};
}
if(typeof window!=='undefined') {
  window.addEventListener('online',()=>{ for(const s of sessions.values()) if(s.dirty && !s.restored && s.owner===draftOwner() && (!s.error || s.error.includes('offline'))) s.flush(); });
  window.addEventListener('beforeunload',e=>{if([...sessions.values()].some(s=>s.owner===draftOwner() && s.dirty && s.storageError)){e.preventDefault();e.returnValue='';}});
}
