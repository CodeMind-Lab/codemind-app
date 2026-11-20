export const today = (timezone = "Europe/Rome") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
};
export const shiftDate = (date, days) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const dateLabel = (date, timezone = "Europe/Rome") =>
  !date
    ? "Nessuna scadenza"
    : date === today(timezone)
      ? "Oggi"
      : date === shiftDate(today(timezone), 1)
        ? "Domani"
        : new Intl.DateTimeFormat("it-IT", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(date + "T12:00:00Z"));
export const longDate = (timezone = "Europe/Rome") =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date());

export function localISODate(value, timezone) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
export function completionCount(tasks, from, to, timezone) {
  return tasks.filter((t) => {
    const day = localISODate(t.completed_at, timezone);
    return t.status === "completed" && day && day >= from && day <= to;
  }).length;
}
