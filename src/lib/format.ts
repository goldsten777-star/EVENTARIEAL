const TZ = "Asia/Jerusalem";

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined) {
  return formatDate(iso, { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

/** Whole days from today (Israel time) until the given date; negative if past. */
export function daysUntil(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null;
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const a = Date.parse(day(now));
  const b = Date.parse(day(new Date(iso)));
  return Math.round((b - a) / 86_400_000);
}

export function countdownLabel(days: number | null) {
  if (days === null) return null;
  if (days === 0) return "האירוע היום";
  if (days === 1) return "האירוע מחר";
  if (days > 1) return `עוד ${days} ימים לאירוע`;
  if (days === -1) return "האירוע היה אתמול";
  return `האירוע היה לפני ${-days} ימים`;
}

const currency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined) {
  return currency.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("he-IL").format(value ?? 0);
}

/** Clock time in Israel, e.g. "19:42". */
export function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
