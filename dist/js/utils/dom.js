import { esc } from "./helpers.js?v=65";
const dialog = globalThis.document?.querySelector("#modal");
let previousFocus;
export function toast(message) {
  const item = document.createElement("div");
  item.className = "toast-message";
  item.textContent = message;
  document.querySelector("#toast").append(item);
  setTimeout(() => item.remove(), 4500);
}
export function openModal(title, body) {
  previousFocus = document.activeElement;
  dialog.innerHTML = `<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Chiudi finestra">×</button></div><div class="modal-body">${body}</div>`;
  dialog.querySelector("[data-close]").onclick = closeModal;
  if (!dialog.open) dialog.showModal();
  setTimeout(
    () =>
      (dialog.querySelector("[autofocus]") || dialog
        .querySelector("input,select,textarea,button:not([data-close])"))
        ?.focus(),
    0,
  );
}
export function closeModal() {
  dialog.close();
  previousFocus?.focus();
}
export function confirmDelete(message, callback) {
  openModal(
    "Conferma eliminazione",
    `<p>${esc(message)}</p><div class="form-actions"><button class="btn" id="cancel-delete">Annulla</button><button class="btn danger" id="confirm-delete">Elimina definitivamente</button></div><p class="form-error" role="alert"></p>`,
  );
  document.querySelector("#cancel-delete").onclick = closeModal;
  document.querySelector("#confirm-delete").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await callback();
      closeModal();
      toast("Elemento eliminato");
    } catch (error) {
      dialog.querySelector(".form-error").textContent = error.message;
      e.target.disabled = false;
    }
  };
}
export function bindForm(id, callback) {
  const form = document.getElementById(id);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("[type=submit]");
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Salvataggio…";
    form.querySelector(".form-error").textContent = "";
    try {
      await callback(new FormData(form));
      closeModal();
      toast("Salvato correttamente");
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}
export function options(values, current, empty) {
  return `${empty ? `<option value="">${esc(empty)}</option>` : ""}${Object.entries(
    values,
  )
    .map(
      ([key, label]) =>
        `<option value="${esc(key)}" ${key === current ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("")}`;
}
export function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
