import { editorSession, bindAutosave, readDraft, draftOwner } from "../services/autosave.js?v=65";
import { state } from "../services/store.js?v=65";
import { esc } from "../utils/helpers.js?v=65";
import { noteLinks } from "../utils/noteLinks.js?v=65";
import { openModal } from "../utils/dom.js?v=65";
import { saveNote } from "../services/notesService.js?v=65";
let query = "";
export function notesPage() {
  const list = [...state.notes]
    .filter((n) =>
      (n.title + " " + n.body)
        .toLocaleLowerCase("it")
        .includes(query.toLocaleLowerCase("it")),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return `<div class="page-heading"><div><h1>Note</h1><p class="subtext">Link, appunti e idee da ritrovare quando servono.</p></div><button class="btn primary" data-action="new-note">${readDraft("note:new") ? "Riprendi bozza" : "＋ Nuova nota"}</button></div><form id="notes-search-form" class="notes-search"><label class="sr-only" for="notes-search">Cerca nelle note</label><input id="notes-search" name="query" type="search" placeholder="Cerca titolo, testo o link…" value="${esc(query)}"><button class="btn" type="submit">Cerca</button>${query ? '<button class="btn" type="button" id="notes-clear">Mostra tutte</button>' : ""}<span class="subtext">${list.length} note</span></form><div class="notes-grid">${list.map((n) => `<article class="panel note-card"><div class="panel-head"><h2>${esc(n.title)}</h2><button class="link" data-edit-note="${n.id}" aria-label="Modifica nota: ${esc(n.title)}">Modifica</button></div><div class="note-body">${noteLinks(n.body) || '<span class="muted">Nessun appunto.</span>'}</div><div class="note-footer">Aggiornata il ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: state.timezone }).format(new Date(n.updated_at))}</div></article>`).join("") || `<div class="panel empty"><h2>${query ? "Nessuna nota trovata" : "Uno spazio per le tue idee"}</h2><p class="subtext">${query ? "Prova un altro termine." : "Crea una nota e incolla link, appunti o testi da conservare."}</p></div>`}</div>`;
}
export function noteForm(note, render) {
  const session = editorSession(note ? `note:${note.id}` : 'note:new', {title:note?.title || '',body:note?.body || ''}, note, saveNote);
  const values = session.values;
  openModal(
    note ? "Modifica nota" : "Nuova nota",
    `<form id="note-form"><label class="field">Titolo<input name="title" required maxlength="200" placeholder="Es. Risorse per il prossimo progetto" value="${esc(values.title)}"></label><label class="field">Appunti e link<textarea name="body" rows="10" maxlength="30000" placeholder="Incolla link https://…, idee e appunti…">${esc(values.body)}</textarea></label><p class="subtext">I link http e https diventano cliccabili dopo il salvataggio.</p><div class="form-actions"><span id="note-save-status" role="status"></span><button class="btn primary" type="submit">Salva ora</button></div><p class="form-error" role="alert"></p></form>`,
  );
  const form = document.querySelector('#note-form');
  bindAutosave(form, session, () => ({title:form.elements.title.value,body:form.elements.body.value}), document.querySelector('#note-save-status'), render);
  document.querySelector('#modal').addEventListener('close', async () => { await session.flush(); if (session.owner === draftOwner()) render(); }, {once:true});

}
export function bindNotes(render) {
  document.querySelectorAll("[data-edit-note]").forEach(
    (b) =>
      (b.onclick = () => {
        const note = state.notes.find((n) => n.id === b.dataset.editNote);
        if (note) noteForm(note, render);
      }),
  );
  const form = document.querySelector("#notes-search-form");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      query = form.elements.query.value.trim();
      render();
    };
  const clear = document.querySelector("#notes-clear");
  if (clear)
    clear.onclick = () => {
      query = "";
      render();
    };
}
