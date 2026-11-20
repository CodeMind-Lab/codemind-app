import { state } from "./store.js?v=65";
import { getClient, unwrap } from "./supabase.js?v=65";
import { uid } from "../utils/helpers.js?v=65";

export const TODO_NO_DATE = "9999-12-31";
export const todoDateFromStorage = (date) => date === TODO_NO_DATE ? null : date;

function writable(date, optional = false) {
  if (state.mode === "signed_out") throw Error("Accedi prima di salvare.");
  if (state.mode === "cloud" && !navigator.onLine)
    throw Error("Sei offline. Riconnettiti per salvare.");
  if (optional && (date === null || date === undefined || date === "")) return;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T12:00:00Z")) ||
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !== date
  )
    throw Error("Scegli una data valida.");
}
async function write(table, values, existing, key) {
  if (state.mode === "cloud") {
    const c = await getClient();
    let query;
    if (existing) {
      query = c
        .from(table)
        .update(values)
        .eq("user_id", state.user.id)
        .eq(key, existing[key])
        .eq("updated_at", existing.updated_at)
        .select();
    } else
      query = c
        .from(table)
        .insert({ ...values, user_id: state.user.id })
        .select();
    const result = unwrap(await query);
    if (!result.length)
      throw Error(
        "Questa voce è cambiata su un altro dispositivo. Aggiorna i dati prima di riprovare.",
      );
    return result[0];
  }
  const now = new Date().toISOString();
  return {
    ...existing,
    ...values,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}
export async function saveDailyTodo(values, existing) {
  writable(values.todo_date, true);
  const title = String(values.title || "").trim();
  if (!title || title.length > 200)
    throw Error("Scrivi una voce di massimo 200 caratteri.");
  const storedDate = values.todo_date || TODO_NO_DATE;
  const item = await write(
    "daily_todos",
    {
      id: existing?.id || uid(),
      todo_date: storedDate,
      title,
      is_completed: !!values.is_completed,
    },
    existing,
    "id",
  );
  item.todo_date = todoDateFromStorage(item.todo_date);
  state.dailyTodos = existing
    ? state.dailyTodos.map((x) => (x.id === item.id ? item : x))
    : [...state.dailyTodos, item];
  
  return item;
}
