/**
 * Conversions between <input type="datetime-local"> values ("2027-03-12T19:30"),
 * which are always meant as Israel time, and ISO timestamps stored in the
 * database. Independent of the server's own time zone (Vercel runs in UTC).
 */
const TZ = "Asia/Jerusalem";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Offset of Israel time from UTC at the given instant, in minutes (+120 or +180). */
function offsetMinutes(date: Date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function isValidLocalDateTime(value: string) {
  const m = LOCAL.exec(value);
  if (!m) return false;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && h < 24 && mi < 60;
}

/** "2027-03-12T19:30" (Israel time) → "2027-03-12T17:30:00.000Z" */
export function israelLocalToIso(value: string): string {
  const m = LOCAL.exec(value);
  if (!m) throw new Error(`Invalid local date-time: ${value}`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // two passes settle the offset even right next to a DST switch
  let ts = guess - offsetMinutes(new Date(guess)) * 60_000;
  ts = guess - offsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts).toISOString();
}

/** ISO timestamp → "2027-03-12T19:30" in Israel time, for datetime-local inputs. */
export function isoToIsraelLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = zonedParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}
