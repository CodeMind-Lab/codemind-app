import { normalizeConnection } from "./connection.js?v=65";
let client;
export async function getClient() {
  if (client) return client;
  let config;
  try {
    config = (await import("../config.js")).default;
  } catch {
    config = JSON.parse(localStorage.getItem("cm-supabase") || "null");
  }
  if (!config?.url || !config?.key) return null;
  config = normalizeConnection(config);
  await import("../../assets/supabase.js");
  client = globalThis.supabase.createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
export const unwrap = ({ data, error }) => {
  if (error) {
    if (["PGRST205", "42P01"].includes(error.code))
      throw Error(
        "Database non inizializzato: esegui nel SQL Editor le migrazioni 001, 002, 003 e 004 incluse nella guida. Poi riprova l’accesso.",
      );
    if (error.code === "PGRST116")
      throw Error(
        "Profilo utente assente. Verifica la migrazione iniziale e la creazione dell’utente Supabase.",
      );
    throw Error(error.message);
  }
  return data;
};
export async function readAll(table, select = "*") {
  const client = await getClient();
  let result = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const data = unwrap(
      await client
        .from(table)
        .select(select)
        .range(offset, offset + 499)
        .order("id"),
    );
    result.push(...data);
    if (data.length < 500) return result;
  }
  throw Error(
    "Troppi elementi da caricare. Riduci i dati o usa una versione con paginazione delle viste.",
  );
}
