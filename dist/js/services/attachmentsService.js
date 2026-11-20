import { state } from './store.js?v=65';
import { getClient } from './supabase.js?v=65';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUCKET = 'project-attachments';
async function context(projectId, taskId) {
  if (state.mode !== 'cloud' || !state.user) throw Error('Collega Supabase e accedi per salvare gli allegati.');
  if (!navigator.onLine) throw Error('Sei offline. Riconnettiti per aprire o caricare gli allegati.');
  if (!state.projects.some(p => p.id === projectId)) throw Error('Progetto non disponibile.');
  if (taskId && !state.tasks.some(t => t.id === taskId && t.project_id === projectId)) throw Error('Attività non disponibile in questo progetto.');
  return { bucket: (await getClient()).storage.from(BUCKET), prefix: `${state.user.id}/${projectId}` };
}
function check(result) {
  if (result.error) {
    const message = result.error.message || '';
    if (/bucket|row.level|policy|not found/i.test(message)) throw Error('Archivio allegati non attivo. Esegui la configurazione 005 degli allegati in Supabase, poi riprova.');
    throw Error('Operazione sugli allegati non riuscita. Controlla la connessione e riprova.');
  }
  return result.data;
}
export function attachmentTask(name) { return name.slice(37).match(/^task_([0-9a-f-]{36})_/i)?.[1] || null; }
export function fileName(name) {
  name = name.slice(0,37) + name.slice(37).replace(/^task_[0-9a-f-]{36}_/i, '');
  try { return new TextDecoder().decode(Uint8Array.from(atob(name.slice(37).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch { return name.slice(37); }
}
export async function listAttachments(projectId, taskId) {
  const { bucket, prefix } = await context(projectId, taskId);
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const page = check(await bucket.list(prefix, {limit: 100, offset, sortBy: {column: 'name', order: 'asc'}}));
    items.push(...page.filter(x => x.id));
    if (page.length < 100) break;
  }
  return items.filter(f => !taskId || attachmentTask(f.name) === taskId).sort((a,b) => b.created_at.localeCompare(a.created_at));
}
export async function uploadAttachment(projectId, file, taskId) {
  if (!file.size) throw Error('Il file è vuoto.');
  if (file.size > MAX_FILE_SIZE) throw Error('Il file supera il limite di 10 MB.');
  if (file.name.length > 180) throw Error('Accorcia il nome del file a massimo 180 caratteri.');
  const {bucket, prefix} = await context(projectId, taskId);
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(file.name))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const name = `${crypto.randomUUID()}-${taskId ? `task_${taskId}_` : ""}${encoded}`;
  check(await bucket.upload(`${prefix}/${name}`, file, {upsert: false, contentType: file.type || 'application/octet-stream'}));
}
export async function downloadAttachment(projectId, name) {
  if (name.includes('/')) throw Error('Allegato non valido.');
  const {bucket, prefix} = await context(projectId);
  return check(await bucket.download(`${prefix}/${name}`));
}
export async function deleteAttachment(projectId, name) {
  if (name.includes('/')) throw Error('Allegato non valido.');
  const {bucket, prefix} = await context(projectId);
  check(await bucket.remove([`${prefix}/${name}`]));
}
