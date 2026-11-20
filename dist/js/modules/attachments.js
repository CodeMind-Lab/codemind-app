import {workspaceProjects} from "../utils/university.js?v=65";
import { state } from '../services/store.js?v=65';
import { esc } from '../utils/helpers.js?v=65';
import { openModal, options } from '../utils/dom.js?v=65';
import { listAttachments, uploadAttachment, downloadAttachment, deleteAttachment, fileName } from '../services/attachmentsService.js?v=65';
export function attachmentsSection(projectId, taskId = "") {
  return `<section class="panel attachments" data-attachments="${esc(projectId)}" data-attachment-task="${esc(taskId)}"><div class="attachment-heading"><div><h2>File e checklist</h2><p class="subtext">${taskId ? "Allegati dell’attività" : "Allegati del progetto"} · tutti i formati · massimo 10 MB per file</p></div>${state.mode === 'cloud' ? '<button type="button" class="btn" data-upload>＋ Allega file</button><input type="file" multiple data-files hidden aria-label="Scegli foto o file">' : ''}</div><p data-attachment-status role="status"></p><div data-attachment-list>${state.mode === 'cloud' ? 'Caricamento allegati…' : '<p class="subtext">Collega Supabase e accedi per salvare foto e documenti e ritrovarli su tutti i dispositivi.</p><a class="link" href="#/settings">Apri Impostazioni →</a>'}</div></section>`;
}
const imageType = type => /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(type || '');
const size = n => Number(n) >= 1048576 ? `${(n/1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n||0)/1024))} KB`;
export function bindAttachments(container = document) {
  container.querySelectorAll("[data-attachments]").forEach(bindAttachmentSection);
}
function bindAttachmentSection(root) {
  if (!root || state.mode !== 'cloud') return;
  if (root.dataset.bound) return;
  root.dataset.bound = 'true';
  const id = root.dataset.attachments, taskId = root.dataset.attachmentTask, user = state.user.id;
  const current = () => root.isConnected && state.mode === 'cloud' && state.user?.id === user;
  const list = root.querySelector('[data-attachment-list]'), status = root.querySelector('[data-attachment-status]');
  const input = root.querySelector('[data-files]'), upload = root.querySelector('[data-upload]');
  let busy = false;
  async function refresh() {
    try {
      const items = await listAttachments(id, taskId);
      if (!current()) return;
      list.innerHTML = items.length ? `<div class="attachment-list">${items.map((f, i) => `<div class="attachment-row"><span class="attachment-kind" aria-hidden="true">${imageType(f.metadata?.mimetype) ? '▧' : '▤'}</span><div class="attachment-info"><strong>${esc(fileName(f.name))}</strong><span class="subtext">${size(f.metadata?.size)} · ${new Date(f.created_at).toLocaleDateString('it-IT')}</span></div><div class="attachment-actions">${imageType(f.metadata?.mimetype) ? `<button type="button" class="btn" data-preview="${i}" aria-label="Anteprima ${esc(fileName(f.name))}">Anteprima</button>` : ""}<button type="button" class="btn" data-download="${i}" aria-label="Scarica ${esc(fileName(f.name))}">Scarica</button><button class="btn danger" data-delete="${i}" aria-label="Elimina ${esc(fileName(f.name))}">Elimina</button></div></div>`).join('')}</div>` : '<p class="subtext">Nessun allegato. Importa checklist, PDF, Word, Excel, immagini, archivi o altri file. I documenti restano allegati: non vengono trasformati automaticamente in attività.</p>';
      list.querySelectorAll('[data-download],[data-preview]').forEach(button => button.onclick = async () => {
        const preview = button.hasAttribute('data-preview'), f = items[preview ? button.dataset.preview : button.dataset.download];
        button.disabled = true;
        try {
          const blob = await downloadAttachment(id, f.name);
          if (!current()) return;
          const url = URL.createObjectURL(blob);
          if (preview && imageType(blob.type)) {
            const image = document.createElement('img'); image.className = 'attachment-preview'; image.alt = fileName(f.name); image.src = url;
            image.onload = image.onerror = () => URL.revokeObjectURL(url);
            const old = root.querySelector('.attachment-preview'); if (old) old.remove();
            list.append(image);
          } else {
            const a = document.createElement('a'); a.href = url; a.download = fileName(f.name); a.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
          }
        } catch (e) { status.textContent = e.message; }
        finally { button.disabled = false; }
      });
      list.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
        const f = items[button.dataset.delete];
        if (!window.confirm(`Eliminare l’allegato “${fileName(f.name)}”?`)) return;
        button.disabled = true;
        try { await deleteAttachment(id, f.name); await refresh(); }
        catch (e) { status.textContent = e.message; button.disabled = false; }
      });
    } catch (e) {
      if (!current()) return;
      list.innerHTML = '<button type="button" class="btn" data-retry>Riprova</button>';
      status.textContent = e.message;
      list.querySelector('[data-retry]').onclick = () => {status.textContent = ''; refresh();};
    }
  }
  upload.onclick = () => input.click();
  input.onchange = async () => {
    if (busy) return;
    const files = [...input.files];
    if (!files.length) return;
    busy = true; upload.disabled = true;
    const failed = []; let count = 0;
    for (let i = 0; i < files.length; i++) {
      if (!current()) break;
      status.textContent = `Caricamento ${i+1} di ${files.length}…`;
      try { await uploadAttachment(id, files[i], taskId); count++; }
      catch (e) { failed.push(`${files[i].name}: ${e.message}`); }
    }
    if (current()) {
      await refresh();
      status.textContent = `${count} file caricati.${failed.length ? ' ' + failed.join(' ') : ''}`;
      upload.disabled = false; input.value = '';
    }
    busy = false;
  };
  refresh();
}

export function openFileImport(projectId = "", taskId = "") {
  const projects = workspaceProjects(state.projects,projectId).filter(p => p.status !== 'archived');
  if (!projects.length) {
    openModal('Prima crea un progetto', '<p>Crea un progetto per collegare file e checklist.</p>');
    return;
  }
  openModal('Allega file al progetto o all’attività', `<label class="field">Progetto<select id="file-project">${options(Object.fromEntries(projects.map(p => [p.id,p.name])), projectId || projects[0].id)}</select></label><label class="field">Collega a<select id="file-task"></select></label><div id="file-destination"></div>`);
  const dialog = document.querySelector('#modal');
  const project = dialog.querySelector('#file-project'), task = dialog.querySelector('#file-task');
  function show() {
    dialog.querySelector('#file-destination').innerHTML = attachmentsSection(project.value, task.value);
    bindAttachments(dialog);
  }
  function updateTasks() {
    task.innerHTML = options(Object.fromEntries(state.tasks.filter(t => t.project_id === project.value).map(t => [t.id,t.title])), taskId, 'Intero progetto');
    show();
  }
  project.onchange = updateTasks; task.onchange = show; updateTasks();
}
