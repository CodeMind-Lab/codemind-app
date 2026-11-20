import { state } from "../services/store.js?v=65";
import { esc } from "../utils/helpers.js?v=65";
import { bindForm, openModal, toast } from "../utils/dom.js?v=65";
import { saveDailyTodo } from "../services/notebookService.js?v=65";

const todoDrafts = new Map();
let todoDateDraft = "";
export function clearNotebookDrafts() {
  todoDrafts.clear();
  todoDateDraft = "";
}
window.addEventListener("beforeunload", (e) => {
  if ([...todoDrafts.values()].some(Boolean)) {
    e.preventDefault();
    e.returnValue = "";
  }
});
// To-do list personale: cose da fare senza un progetto, con una data facoltativa.
// Il Diario che stava qui è stato tolto il 20/11/2026 (la tabella resta nel database).
export function notebookPage() {
  const date = "";
  const list = [...state.dailyTodos]
    .sort(
      (a, b) =>
        Number(a.is_completed) - Number(b.is_completed) ||
        a.created_at.localeCompare(b.created_at),
    );
  const done = list.filter((x) => x.is_completed).length;
  return `<div class="page-heading"><div><h1>To-do</h1><p class="subtext">Tutte le cose da fare. Aggiungi una data solo se ti serve.</p></div></div>
  <div class="notebook-single todo-page">${`<section class="panel notebook-todos"><div class="panel-head"><div><h2>To do list</h2><p class="subtext">Piccole cose da fare, senza un progetto.</p></div><span class="badge">${done}/${list.length}</span></div><div class="notebook-progress" role="progressbar" aria-label="To-do completati" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${list.length || 1}"><span style="width:${list.length ? (done / list.length) * 100 : 0}%"></span></div>
  <form id="daily-todo-form" class="notebook-add"><label class="sr-only" for="daily-todo-title">Nuova cosa da fare</label><input id="daily-todo-title" name="title" placeholder="Aggiungi una cosa da fare…" required maxlength="200" value="${esc(todoDrafts.get(date) || "")}"><label class="todo-optional-date">Data facoltativa<input type="date" name="todo_date" value="${esc(todoDateDraft)}"></label><button class="btn primary" type="submit">Aggiungi</button><p class="form-error" role="alert"></p></form>
  <div class="notebook-todo-list">${list.map((x) => `<div class="notebook-todo ${x.is_completed ? "is-done" : ""}"><button class="check-button ${x.is_completed ? "done" : ""}" data-daily-toggle="${x.id}" aria-label="${x.is_completed ? "Riapri" : "Completa"} to-do: ${esc(x.title)}">${x.is_completed ? "✓" : ""}</button><span>${esc(x.title)}${x.todo_date ? `<small class="todo-item-date">${esc(x.todo_date.split("-").reverse().join("/"))}</small>` : ""}</span><button class="link" data-daily-edit="${x.id}" aria-label="Modifica to-do: ${esc(x.title)}">Modifica</button></div>`).join("") || '<div class="empty">Una lista pulita per iniziare.<br><span class="subtext">Aggiungi la prima cosa da fare.</span></div>'}</div><p class="notebook-hint">La lista resta aperta. Puoi aggiungere o togliere la data da “Modifica”.</p></section>`}</div>`;
}
export function bindNotebook(render) {
  if (!document.querySelector("#daily-todo-form")) return;
  const date = "";
  const addForm = document.querySelector("#daily-todo-form");
  if (addForm) {
    addForm.elements.todo_date.onchange = () => { todoDateDraft = addForm.elements.todo_date.value; };
    addForm.elements.title.oninput = (e) =>
      todoDrafts.set(date, e.target.value);
    addForm.onsubmit = async (e) => {
      e.preventDefault();
      const b = addForm.querySelector("[type=submit]");
      if (b.disabled) return;
      b.disabled = true;
      try {
        await saveDailyTodo({
          title: addForm.elements.title.value,
          todo_date: addForm.elements.todo_date.value || null,
          is_completed: false,
        });
        todoDrafts.delete(date);
        todoDateDraft = "";
        render();
        document.querySelector("#daily-todo-title")?.focus();
      } catch (err) {
        addForm.querySelector(".form-error").textContent = err.message;
        b.disabled = false;
      }
    };
    document.querySelectorAll("[data-daily-toggle]").forEach(
      (b) =>
        (b.onclick = async () => {
          const item = state.dailyTodos.find(
            (x) => x.id === b.dataset.dailyToggle,
          );
          b.disabled = true;
          try {
            await saveDailyTodo(
              { ...item, is_completed: !item.is_completed },
              item,
            );
            render();
          } catch (err) {
            toast(err.message);
            b.disabled = false;
          }
        }),
    );
    document.querySelectorAll("[data-daily-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          const item = state.dailyTodos.find(
            (x) => x.id === b.dataset.dailyEdit,
          );
          openModal(
            "Modifica to-do",
            `<form id="edit-daily-form"><label class="field">Cosa da fare<input name="title" maxlength="200" required value="${esc(item.title)}"></label><label class="field">Data facoltativa<input type="date" name="todo_date" value="${item.todo_date || ""}"></label><div class="form-actions"><button class="btn primary" type="submit">Salva</button></div><p class="form-error" role="alert"></p></form>`,
          );
          bindForm("edit-daily-form", async (data) => {
            await saveDailyTodo(
              {
                ...item,
                title: String(data.get("title")),
                todo_date: String(data.get("todo_date") || "") || null,
              },
              item,
            );
            render();
          });
        }),
    );
  }
}
