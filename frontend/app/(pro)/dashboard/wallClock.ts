import { format } from "date-fns";

/**
 * The business's wall clock, spelled the way the contract's `LocalDateTime` spells it:
 * `YYYY-MM-DDTHH:mm`, no offset. Everything the dashboard writes is in this form, so the zone is
 * applied once, on the server — never the browser's, which is the wrong clock for a tradesperson
 * away from home.
 */

/** An instant read on the business's clock. */
export function wallClockOf(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/**
 * A `YYYY-MM-DD` as a local `Date`, built from its numbers rather than parsed: `new Date("2026-10-05")`
 * is midnight UTC, which in Denver is the evening before.
 */
export function localDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date!);
}

/** A `YYYY-MM-DDTHH:mm` as a local `Date`, for the same reason. */
export function localMoment(value: string): Date {
  const [day, time] = value.split("T");
  const [hours, minutes] = time!.split(":").map(Number);
  const at = localDay(day!);
  at.setHours(hours!, minutes!, 0, 0);
  return at;
}

/** A form's day and time fields as one `LocalDateTime`. */
export function wallClock(date: string, time: string): string {
  return `${date}T${time}`;
}

export function dayField(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function timeField(date: Date): string {
  return format(date, "HH:mm");
}
