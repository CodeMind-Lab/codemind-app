const CACHE = "codemind-shell-v75";
const ASSETS = [
 "./",
 "./assets/fonts/OFL-ChakraPetch.txt",
 "./assets/fonts/chakra-petch-400.woff2",
 "./assets/fonts/chakra-petch-500.woff2",
 "./assets/fonts/chakra-petch-600.woff2",
 "./assets/fonts/chakra-petch-700.woff2",
 "./assets/icons/icon-192.png",
 "./assets/icons/icon-512.png",
 "./assets/import/MAMMOTH-LICENSE",
 "./assets/import/PDFJS-LICENSE",
 "./assets/import/VERSIONS.txt",
 "./assets/import/XLSX-LICENSE",
 "./assets/import/mammoth.browser.min.js",
 "./assets/import/pdf.mjs",
 "./assets/import/pdf.worker.mjs",
 "./assets/import/xlsx.full.min.js",
 "./assets/logo.png",
 "./assets/marchio.png",
 "./assets/supabase.js",
 "./css/agenda.css",
 "./css/base.css",
 "./css/bento.css",
 "./css/components.css",
 "./css/layout.css",
 "./css/navigation.css",
 "./css/responsive.css",
 "./css/shifts.css",
 "./css/sport.css",
 "./css/tech.css",
 "./css/variables.css",
 "./css/workspace.css",
 "./forma/app.css",
 "./forma/app.js",
 "./forma/data.js",
 "./forma/font/inter-var.woff2",
 "./forma/forma-model.js",
 "./forma/icons/icon-192-v3.png",
 "./forma/importa.js",
 "./forma/index.html",
 "./forma/projects-host.js",
 "./forma/projects.css",
 "./forma/scanner.js",
 "./index.html",
 "./js/app.js",
 "./js/modules/agenda.js",
 "./js/modules/agendaInteractions.js",
 "./js/modules/agendaProductivity.js",
 "./js/modules/attachments.js",
 "./js/modules/checklistImport.js",
 "./js/modules/dashboard.js",
 "./js/modules/formaWorkspace.js",
 "./js/modules/hotel.js",
 "./js/modules/navigation.js",
 "./js/modules/notebook.js",
 "./js/modules/notes.js",
 "./js/modules/oggi.js",
 "./js/modules/palestra.js",
 "./js/modules/palestraAllena.js",
 "./js/modules/palestraPiano.js",
 "./js/modules/projects.js",
 "./js/modules/quickAdd.js",
 "./js/modules/search.js",
 "./js/modules/settings.js",
 "./js/modules/sezioni.js",
 "./js/modules/shifts.js",
 "./js/modules/sport.js",
 "./js/modules/sviluppo.js",
 "./js/modules/tasks.js",
 "./js/modules/universita.js",
 "./js/modules/university.js",
 "./js/router.js",
 "./js/services/agendaPreferences.js",
 "./js/services/agendaProductivityService.js",
 "./js/services/agendaService.js",
 "./js/services/appUpdate.js",
 "./js/services/attachmentsService.js",
 "./js/services/authService.js",
 "./js/services/autosave.js",
 "./js/services/checklistImportService.js",
 "./js/services/checklistReader.js",
 "./js/services/connection.js",
 "./js/services/dashboardService.js",
 "./js/services/dataService.js",
 "./js/services/formaService.js",
 "./js/services/lavoroService.js",
 "./js/services/notebookService.js",
 "./js/services/notesService.js",
 "./js/services/offline.js",
 "./js/services/palestraService.js",
 "./js/services/sportService.js",
 "./js/services/store.js",
 "./js/services/supabase.js",
 "./js/services/universitaService.js",
 "./js/utils/agenda.js",
 "./js/utils/agendaCalendar.js",
 "./js/utils/agendaProductivity.js",
 "./js/utils/checklist.js",
 "./js/utils/dates.js",
 "./js/utils/dom.js",
 "./js/utils/esporta.js",
 "./js/utils/formaDati.js",
 "./js/utils/helpers.js",
 "./js/utils/hotel.js",
 "./js/utils/noteLinks.js",
 "./js/utils/palestra.js",
 "./js/utils/scanner.js",
 "./js/utils/sport.js",
 "./js/utils/sviluppo.js",
 "./js/utils/universita.js",
 "./js/utils/university.js",
 "./js/utils/workShifts.js",
 "./manifest.json"
];
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(asset => new Request(asset, { cache: "reload" })));
    // A complete new shell can take over even while older tabs are open.
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("codemind-shell-") && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin
  )
    return;
  // config.js (indirizzo e chiave pubblica di Supabase) non è nel repository: lo scrive la
  // pubblicazione. Si tiene in cache alla prima apertura, così l'app parte anche offline.
  if (
    !url.pathname.endsWith("/js/config.js") &&
    !ASSETS.some(
      (asset) =>
        new URL(asset, self.registration.scope).pathname === url.pathname,
    )
  )
    return;
  event.respondWith(
    fetch(event.request, event.request.mode === "navigate" ? { cache: "no-cache" } : undefined)
      .then((response) => {
        if (response.ok && response.type !== "opaqueredirect") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request, {cacheName:CACHE, ignoreSearch:true})
          .then((cached) => cached || Response.error()),
      ),
  );
});
