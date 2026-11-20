import { verifyConnection } from "../services/connection.js?v=65";
import { updateApp } from "../services/appUpdate.js?v=68";
import { state } from "../services/store.js?v=65";
import { options, toast, openModal, bindForm } from "../utils/dom.js?v=65";
import { esc } from "../utils/helpers.js?v=65";
import { getClient } from "../services/supabase.js?v=65";
import {
  signIn,
  signOut,
  resetPassword,
  changePassword,
} from "../services/authService.js?v=65";
import { loadCloud, updateProfile } from "../services/dataService.js?v=65";
export function applyTheme(value) {
  localStorage.setItem("cm-theme", value);
  document.documentElement.dataset.theme =
    value === "system"
      ? matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light"
      : value;
}
export function settingsPage() {
  return `<div class="page-heading"><div><h1>Impostazioni</h1><p class="subtext">Aspetto, account e connessione.</p></div></div><div class="settings-grid"><section class="panel"><div class="panel-head"><h2>Preferenze</h2></div><div class="settings-content"><label class="setting-row"><span>Tema</span><select id="theme-setting">${options({ system: "Sistema", light: "Chiaro", dark: "Scuro" }, localStorage.getItem("cm-theme") || "system")}</select></label><label class="field">Fuso orario<select id="timezone-setting">${options(Object.fromEntries(["Europe/Rome", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"].map((t) => [t, t])), state.timezone)}</select></label><p class="subtext">Il fuso determina Oggi e i periodi delle statistiche.</p></div></section><section class="panel"><div class="panel-head"><h2>${state.mode === "cloud" ? "Account Supabase" : "Collega Supabase"}</h2></div><div class="settings-content">${state.mode === "cloud" ? `<p>${esc(state.user.email)}</p><p class="subtext">I dati sono salvati nel tuo database e disponibili sui dispositivi collegati.</p><div class="form-actions"><button class="btn" data-action="refresh">Aggiorna dati</button><button class="btn" id="password-change">Cambia password</button><button class="btn danger" id="signout">Esci</button></div>` : `<p style="font-size:14px">Per salvare i tuoi progetti nel cloud, configura Supabase e applica le quattro migrazioni incluse nella guida.</p><form id="connection-form" style="margin-top:18px"><label class="field">URL progetto<input name="url" type="url" placeholder="https://progetto.supabase.co" required></label><label class="field" style="margin-top:12px">Chiave publishable / anon<input name="key" type="password" autocomplete="off" required placeholder="sb_publishable_…"></label><p class="subtext">Usa solo la chiave pubblica. Mai service_role o secret.</p><div class="form-actions"><button class="btn primary" type="submit">Configura connessione</button></div><p class="form-error" role="alert"></p></form><p class="subtext">Dopo la verifica, accedi con email e password dell’utente creato in Supabase. Puoi incollare il Project URL oppure il link del pannello Supabase: verrà riconosciuto automaticamente. La chiave pubblica collega il progetto; non sostituisce l’accesso.</p><a class="link" href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Apri Supabase ↗</a><button class="link" id="show-login" style="margin-top:14px">Accedi a una connessione già configurata →</button>`}</div></section>${state.mode === "demo" ? `<section class="panel"><div class="panel-head"><h2>Dati di esempio su questo dispositivo</h2></div><div class="settings-content"><p class="subtext">La demo non è collegata al cloud. Normalmente le modifiche sono temporanee.</p></div></section>` : ""}<section class="panel"><div class="panel-head"><h2>App e aggiornamenti</h2></div><div class="settings-content"><p style="font-size:14px">Su iPhone: apri il sito in Safari, tocca Condividi e “Aggiungi alla schermata Home”. Su Mac: in Safari scegli “Aggiungi al Dock”.</p><p class="subtext">Offline puoi aprire la struttura dell’app già visitata. Il salvataggio cloud richiede una connessione.</p><div class="form-actions"><button class="btn primary" id="update-app" type="button">Aggiorna app</button><button class="btn" id="install-app" type="button" hidden>Installa l’app</button></div><p class="subtext" id="app-update-status" role="status" hidden></p></div></section></div>`;
}
export function loginModal(render) {
  openModal(
    "Accedi al tuo workspace",
    `<form id="login-form"><label class="field">Email<input name="email" type="email" autocomplete="username" required></label><label class="field" style="margin-top:14px">Password<input name="password" type="password" autocomplete="current-password" required></label><div class="form-actions"><button class="link" type="button" id="forgot-password">Password dimenticata?</button><button class="btn primary" type="submit">Accedi</button></div><p class="form-error" role="alert"></p></form>`,
  );
  bindForm("login-form", async (data) => {
    if (!(await getClient()))
      throw Error("Configura prima URL e chiave pubblica nelle Impostazioni.");
    await signIn(String(data.get("email")), String(data.get("password")));
    await loadCloud();
    render();
  });
  document.querySelector("#forgot-password").onclick = async () => {
    const form = document.querySelector("#login-form"),
      email = form.elements.email.value;
    if (!email) {
      form.querySelector(".form-error").textContent =
        "Inserisci prima la tua email.";
      return;
    }
    try {
      await resetPassword(email);
      toast("Se l’account esiste, riceverai il link di recupero.");
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
    }
  };
}
export function passwordModal() {
  openModal(
    "Imposta una nuova password",
    `<form id="password-form"><label class="field">Nuova password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><div class="form-actions"><button class="btn primary" type="submit">Aggiorna password</button></div><p class="form-error" role="alert"></p></form>`,
  );
  bindForm("password-form", (data) =>
    changePassword(String(data.get("password"))),
  );
}
export function bindSettings(render, installEvent) {
  const theme = document.querySelector("#theme-setting");
  if (theme)
    theme.onchange = async () => {
      applyTheme(theme.value);
      try {
        await updateProfile({ theme: theme.value });
      } catch (e) {
        toast(e.message);
      }
    };
  const tz = document.querySelector("#timezone-setting");
  if (tz)
    tz.onchange = async () => {
      try {
        await updateProfile({ timezone: tz.value });
        render();
      } catch (e) {
        toast(e.message);
      }
    };
  const form = document.querySelector("#connection-form");
  if (form)
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector("[type=submit]");
      if (button.disabled) return;
      const error = form.querySelector(".form-error");
      error.textContent = "";
      button.disabled = true;
      button.textContent = "Verifica connessione…";
      try {
        const config = await verifyConnection(
          Object.fromEntries(new FormData(form)),
        );
        localStorage.setItem("cm-supabase", JSON.stringify(config));
        sessionStorage.setItem("cm-connection-ready", "yes");
        location.hash = "#/settings";
        location.reload();
      } catch (e) {
        error.textContent = e.message;
        button.disabled = false;
        button.textContent = "Configura connessione";
      }
    };
  const login = document.querySelector("#show-login");
  if (login) login.onclick = () => loginModal(render);
  const logout = document.querySelector("#signout");
  if (logout)
    logout.onclick = async () => {
      try {
        await signOut();
        state.tasks = [];
        state.projects = [];
        state.mode = "signed_out";
        location.reload();
      } catch (e) {
        toast(e.message);
      }
    };
  const change = document.querySelector("#password-change");
  if (change) change.onclick = passwordModal;
  const update = document.querySelector("#update-app");
  if (update)
    update.onclick = async () => {
      const status = document.querySelector("#app-update-status");
      update.disabled = true;
      status.hidden = false;
      status.textContent = "Cerco aggiornamenti…";
      try {
        await updateApp();
      } catch (error) {
        status.textContent = error.message;
        update.disabled = false;
      }
    };
  const install = document.querySelector("#install-app");
  if (install && installEvent) {
    install.hidden = false;
    install.onclick = () => installEvent.prompt();
  }
}
