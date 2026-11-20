import { state } from "./store.js?v=65";
import { getClient, unwrap } from "./supabase.js?v=65";
import { uid } from "../utils/helpers.js?v=65";
export async function saveNote(values, existing) {
  if (state.mode === "signed_out") throw Error("Accedi prima di salvare.");
  if (state.mode === "cloud" && !navigator.onLine)
    throw Error("Sei offline. Riconnettiti per salvare la nota.");
  const title = String(values.title || "").trim(),
    body = String(values.body || "");
  if (!title || title.length > 200)
    throw Error("Scrivi un titolo di massimo 200 caratteri.");
  if (body.length > 30000)
    throw Error("La nota può contenere al massimo 30.000 caratteri.");
  let item;
  if (state.mode === "cloud") {
    const c = await getClient();
    const query = existing
      ? c
          .from("notes")
          .update({ title, body })
          .eq("id", existing.id)
          .eq("updated_at", existing.updated_at)
          .select()
      : c
          .from("notes")
          .insert({ id: uid(), user_id: state.user.id, title, body })
          .select();
    const rows = unwrap(await query);
    if (!rows.length)
      throw Error(
        "La nota è cambiata su un altro dispositivo. Aggiorna i dati prima di riprovare.",
      );
    item = rows[0];
  } else {
    const now = new Date().toISOString();
    item = {
      ...existing,
      id: existing?.id || uid(),
      title,
      body,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
  }
  state.notes = existing
    ? state.notes.map((n) => (n.id === item.id ? item : n))
    : [...state.notes, item];
  
  return item;
}
