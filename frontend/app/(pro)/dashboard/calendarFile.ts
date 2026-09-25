import { addDays, addMinutes, format, parse } from "date-fns";

import { addressLine, type CalendarEntry, type DemoAppointment, type TimeOff } from "./demo-data";

/**
 * Calendar files (iCalendar, RFC 5545) — what "Add to calendar" and "Export" download, and what
 * Google Calendar, Apple Calendar and Outlook all import.
 *
 * The subscribable feed will serve this same format from the backend once appointments are
 * stored there; a download is the part that works without one.
 */

interface CalendarEvent {
  /** Stable across exports, so importing the same appointment twice updates it instead of copying it. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  /** A request that has not been confirmed is on the calendar as a maybe. */
  tentative?: boolean;
  /** Whole days rather than a time: `start` is the first day and `end` the day after the last. */
  allDay?: boolean;
}

/** When an appointment starts: its day at its "1:30 PM". */
export function appointmentStart(appointment: Pick<DemoAppointment, "date" | "time">): Date {
  return parse(appointment.time, "h:mm a", appointment.date);
}

function fromAppointment(appointment: DemoAppointment): CalendarEvent {
  const start = appointmentStart(appointment);
  const pending = appointment.status === "pending";

  return {
    uid: `appointment-${appointment.id}@tradeties.com`,
    start,
    end: addMinutes(start, appointment.durationMinutes),
    summary: `${appointment.service} – ${appointment.customerName}${pending ? " (requested)" : ""}`,
    location: addressLine(appointment.address) || undefined,
    description:
      [
        appointment.notes,
        [appointment.phone && `Phone: ${appointment.phone}`, appointment.email && `Email: ${appointment.email}`]
          .filter(Boolean)
          .join("\n"),
      ]
        .filter(Boolean)
        .join("\n\n") || undefined,
    tentative: pending,
  };
}

function fromEntry(entry: CalendarEntry): CalendarEvent {
  return {
    uid: `entry-${entry.id}@tradeties.com`,
    start: entry.start,
    end: entry.end,
    summary: entry.title,
    description: entry.notes,
  };
}

function fromTimeOff(off: TimeOff): CalendarEvent {
  return {
    uid: `time-off-${off.id}@tradeties.com`,
    start: off.from,
    // The format's end of an all-day event is exclusive: the morning after the last day away.
    end: addDays(off.to, 1),
    summary: off.note ? `Time off – ${off.note}` : "Time off",
    allDay: true,
  };
}

/** `20260925T143000Z`: the moment in UTC, which every calendar app converts to its own zone. */
function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Commas, semicolons and backslashes are syntax in the format, and a line break is spelled out. */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Lines longer than 75 bytes are folded onto the next line behind a space, as the format
 * requires. Counted in bytes, not characters, and never inside a character: a customer's name
 * can hold letters that take two or more.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

function eventLines(event: CalendarEvent, stamp: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    // A day is not a moment, so it is not converted to UTC: 12 October is 12 October everywhere.
    event.allDay ? `DTSTART;VALUE=DATE:${format(event.start, "yyyyMMdd")}` : `DTSTART:${utcStamp(event.start)}`,
    event.allDay ? `DTEND;VALUE=DATE:${format(event.end, "yyyyMMdd")}` : `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    `STATUS:${event.tentative ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
  ];
}

/** The file itself: line breaks are CRLF, as the format requires. */
export function calendarFile(
  appointments: DemoAppointment[],
  entries: CalendarEntry[] = [],
  timeOff: TimeOff[] = []
): string {
  const stamp = utcStamp(new Date());
  const events = [...appointments.map(fromAppointment), ...entries.map(fromEntry), ...timeOff.map(fromTimeOff)];

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TradeTies//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:TradeTies",
    ...events.flatMap((event) => eventLines(event, stamp)),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

/** Hands the browser a calendar file to save, which opening then imports. */
export function downloadCalendarFile(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
