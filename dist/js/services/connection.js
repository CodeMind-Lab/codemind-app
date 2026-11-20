export function normalizeConnection(values) {
  let url = String(values.url || "")
    .trim()
    .replace(/\/+$/, "");
  const dashboard = url.match(/^https:\/\/supabase\.com\/dashboard\/project\/([a-z0-9-]+)(?:\/[^?#]*)?(?:[?#].*)?$/i);
  if (dashboard) url = `https://${dashboard[1]}.supabase.co`;
  const key = String(values.key || "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))
    throw Error(
      "Inserisci il Project URL HTTPS di Supabase, non la stringa PostgreSQL o l’indirizzo del dashboard.",
    );
  if (key.startsWith("sb_secret_"))
    throw Error(
      "Usa la chiave publishable o anon. Le chiavi secret non sono consentite.",
    );
  if (key.startsWith("sb_publishable_") && key.length > 20) return { url, key };
  try {
    const parts = key.split(".");
    if (parts.length !== 3) throw Error();
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (payload.role === "service_role")
      throw Error(
        "La chiave service_role non è consentita. Usa anon o publishable.",
      );
    if (payload.role !== "anon") throw Error();
  } catch (e) {
    if (e.message.includes("service_role")) throw e;
    throw Error(
      "Chiave non valida: copia la chiave publishable oppure anon dalle API Keys del progetto.",
    );
  }
  return { url, key };
}
export async function verifyConnection(values, request = fetch) {
  const config = normalizeConnection(values);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await request(config.url + "/auth/v1/settings", {
      method: "GET",
      headers: { apikey: config.key },
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (response.status === 401 || response.status === 403)
      throw Error(
        "Supabase non accetta questa chiave. Verifica che URL e chiave pubblica appartengano allo stesso progetto.",
      );
    if (!response.ok)
      throw Error(
        "Il progetto Supabase non è disponibile (HTTP " +
          response.status +
          "). Verifica dal dashboard che sia attivo.",
      );
    const settings = await response.json();
    if (!settings || typeof settings.external !== "object")
      throw Error("Risposta Supabase inattesa. Controlla il Project URL.");
    return config;
  } catch (e) {
    if (e.name === "AbortError")
      throw Error(
        "Supabase non risponde. Controlla la connessione e che il progetto non sia in pausa.",
      );
    if (e instanceof TypeError)
      throw Error(
        "Impossibile raggiungere Supabase. Controlla rete, Project URL ed eventuali blocchi del browser.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
