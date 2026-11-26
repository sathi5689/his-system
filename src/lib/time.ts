// Malaysia time helpers. The database stores UTC; staff always see Asia/Kuala_Lumpur.
export const TZ = "Asia/Kuala_Lumpur";
const MYT_OFFSET = "+08:00"; // Malaysia has no daylight saving

/** YYYY-MM-DD for the given instant in Malaysia time. */
export function mytDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Start and end (UTC instants) of a Malaysia calendar day. */
export function mytDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00${MYT_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Parse a datetime-local value ("2026-11-26T09:30") as Malaysia time. */
export function parseMytLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${MYT_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-MY", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-MY", { timeZone: TZ, dateStyle: "medium" }).format(d);
}

export function fmtTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-MY", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Age in whole years from a date-only DOB (stored at UTC midnight). */
export function ageYears(dob: Date, now: Date = new Date()): number {
  const today = mytDate(now);
  const [y, m, d] = today.split("-").map(Number);
  let age = y - dob.getUTCFullYear();
  if (m < dob.getUTCMonth() + 1 || (m === dob.getUTCMonth() + 1 && d < dob.getUTCDate())) age--;
  return age;
}
