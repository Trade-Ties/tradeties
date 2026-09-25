/**
 * Calendar arithmetic for the slot picker: months, day keys, and the labels drawn from them.
 *
 * Shared between the server component that builds the window it asks for and the client component
 * that draws the answer, so the two cannot disagree about which days a month holds.
 *
 * **Every day here is a day in the business's own zone**, spelled `YYYY-MM-DD` the way the
 * contract spells it. Nine in the morning is nine where the tradesperson works; a slot read
 * against the reader's clock is the wrong hour for anybody who is not standing where they usually
 * stand.
 */

/** A month as it travels in the URL. */
export type Month = string;

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * Days are parsed as UTC midnight and every part is read back in UTC, never through the local
 * zone: `new Date("2026-03-01")` is the evening of February 28th in Denver, and a grid built on
 * that is a month shifted by a day.
 */
function atUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function partsOf(instant: Date, timeZone: string): (type: string) => string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  return (type) => parts.find((part) => part.type === type)!.value;
}

/** Which calendar day an instant falls on, for the business rather than for the reader. */
export function dayOf(instant: string, timeZone: string): string {
  const at = partsOf(new Date(instant), timeZone);
  return `${at("year")}-${at("month")}-${at("day")}`;
}

/** The month a clock reading falls in, for the business rather than for the server it ran on. */
export function monthIn(timeZone: string, now: Date): Month {
  const at = partsOf(now, timeZone);
  return `${at("year")}-${at("month")}`;
}

function split(month: Month): { year: number; index: number } {
  const [year, ordinal] = month.split("-");
  return { year: Number(year), index: Number(ordinal) - 1 };
}

function spell(year: number, index: number): Month {
  const at = new Date(Date.UTC(year, index, 1));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: Month, by: number): Month {
  const { year, index } = split(month);
  return spell(year, index + by);
}

/**
 * The window to ask the backend for: the whole month, first day to last.
 *
 * Never wider than a month on purpose. The backend caps a window at 31 days, so a wider question
 * would come back shortened for two reasons at once and a shortened `to` would stop meaning
 * "this is how far ahead they book" — which is the one thing `canGoForward` reads it as.
 */
export function monthWindow(month: Month): { from: string; to: string } {
  const { year, index } = split(month);
  const last = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();

  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Every day of the month, in order. */
export function daysOf(month: Month): string[] {
  const { to } = monthWindow(month);
  const last = Number(to.slice(-2));

  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** Sunday is 0, as the grid draws it. */
export function weekdayOf(day: string): number {
  return atUtc(day).getUTCDay();
}

/**
 * Whether the month before this one holds anything.
 *
 * The backend moves `from` later when the notice the tradesperson requires reaches into the
 * window. Coming back untouched therefore says the notice ended before this month began — so
 * there are bookable days behind it. Moved says the notice swallowed the start of this month, and
 * everything before it with the same stroke.
 */
export function canGoBack(month: Month, from: string): boolean {
  return from === monthWindow(month).from;
}

/**
 * Whether the month after this one is worth offering.
 *
 * A `to` that comes back untouched says the booking horizon did not end inside this month. A
 * horizon landing exactly on the last of the month reads the same way, so the next month is
 * offered once and turns out empty — an honest empty month, and the price of not spending a
 * second request to rule it out.
 */
export function canGoForward(month: Month, to: string): boolean {
  return to === monthWindow(month).to;
}

/** Start times by the day they fall on, soonest first within each day, as the backend ordered them. */
export function byDay(slots: string[], timeZone: string): Map<string, string[]> {
  const days = new Map<string, string[]>();

  for (const slot of slots) {
    const day = dayOf(slot, timeZone);
    const found = days.get(day);

    if (found) {
      found.push(slot);
    } else {
      days.set(day, [slot]);
    }
  }

  return days;
}

export function monthLabel(month: Month): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" })
    .format(atUtc(`${month}-01`));
}

export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(atUtc(day));
}

export function timeLabel(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" })
    .format(new Date(instant));
}

/**
 * The span an appointment occupies, which is what turns a start time into something a customer
 * can plan around. The length is `appointmentMinutes` off the answer, never the duration on the
 * profile — the same number, but only one of them is the one the slots were computed from.
 */
export function spanLabel(instant: string, minutes: number, timeZone: string): string {
  const start = new Date(instant);
  const end = new Date(start.getTime() + minutes * 60_000);

  const format = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

  return `${format.format(start)} – ${format.format(end)}`;
}
