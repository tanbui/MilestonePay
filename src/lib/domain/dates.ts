import type { ISODate, ISODateTime } from "./types";

const DAY_MS = 86_400_000;

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA time zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

/** Monday on or before the given date. */
export function startOfWeek(date: ISODate): ISODate {
  const day = new Date(toUTC(date)).getUTCDay(); // 0 = Sunday
  const offset = (day + 6) % 7;
  return addDays(date, -offset);
}

/** "Nov 3" */
export function formatShortDate(date: ISODate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(toUTC(date)));
}

/** "Monday, Nov 9" */
export function formatLongDate(date: ISODate): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(toUTC(date)));
}

/** "9:42 AM" in the given zone. */
export function formatTime(at: ISODateTime, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(at));
}

/** Calendar date of an instant in the given zone. */
export function dateOf(at: ISODateTime, timeZone: string): ISODate {
  return todayInZone(timeZone, new Date(at));
}

/** "9:42 AM", "Yesterday 4:18 PM" or "Nov 2" relative to `today`. */
export function formatRelative(at: ISODateTime, today: ISODate, timeZone: string): string {
  const day = dateOf(at, timeZone);
  const delta = diffDays(today, day);
  if (delta === 0) return formatTime(at, timeZone);
  if (delta === 1) return `Yesterday ${formatTime(at, timeZone)}`;
  return formatShortDate(day);
}

/** Offset of `timeZone` from UTC at the given instant, in minutes. */
function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - utcMs) / 60_000);
}

/** The instant of a wall-clock time on a calendar date in `timeZone`. */
export function zonedTime(date: ISODate, hour: number, minute: number, timeZone: string): ISODateTime {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const offset = zoneOffsetMinutes(guess, timeZone);
  return new Date(guess - offset * 60_000).toISOString();
}

/** "Nov 16 – Dec 4" */
export function formatRange(start: ISODate, end: ISODate): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}
