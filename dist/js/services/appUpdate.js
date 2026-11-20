import { toast } from "../utils/dom.js?v=65";

let registrationTask, updateTask;

function register() {
  return registrationTask ??= navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .catch(error => {
      registrationTask = undefined;
      throw error;
    });
}

// Sul Mac, mentre si modifica l'app da localhost, il service worker servirebbe i
// file vecchi dalla sua cache: lì non lo si attiva. Online (GitHub Pages) funziona
// come sempre. Per provare l'offline in locale basta aggiungere ?offline all'indirizzo.
const sviluppoLocale = ["localhost", "127.0.0.1"].includes(location.hostname) && !location.search.includes("offline");

export function startAppUpdates() {
  if (!("serviceWorker" in navigator) || sviluppoLocale) return;
  const workers = navigator.serviceWorker;
  let controller = workers.controller;
  workers.addEventListener("controllerchange", () => {
    const previous = controller;
    controller = workers.controller;
    if (previous && controller && previous !== controller && !updateTask)
      toast("Nuova versione pronta. In Impostazioni, premi Aggiorna app.");
  });
  register().catch(() => toast("Installazione offline non disponibile in questo browser."));
}

function waitForActivation(worker) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(Error("L’aggiornamento richiede più tempo. Riprova tra poco.")), 25000);
    function finish(error) {
      clearTimeout(timeout);
      worker.removeEventListener("statechange", check);
      if (error) reject(error);
      else resolve();
    }
    function check() {
      if (worker.state === "activated") finish();
      if (worker.state === "redundant") finish(Error("Aggiornamento non completato. Riprova."));
    }
    worker.addEventListener("statechange", check);
    check();
  });
}

async function checkAndReload() {
  if (!navigator.onLine) throw Error("Sei offline. Riconnettiti a internet e riprova.");
  if ("serviceWorker" in navigator) {
    let registration;
    try {
      registration = await register();
      await registration.update();
    } catch {
      throw Error("Impossibile controllare gli aggiornamenti. Verifica la connessione e riprova.");
    }
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker && worker.state !== "activated") await waitForActivation(worker);
  }
  location.reload();
}

export function updateApp() {
  return updateTask ??= checkAndReload().finally(() => { updateTask = undefined; });
}
