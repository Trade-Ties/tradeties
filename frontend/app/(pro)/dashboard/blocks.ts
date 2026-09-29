import { addMinutes } from "date-fns";

import type { TimeOff as StoredTimeOff } from "@/lib/api/calendar";

import { appointmentStart } from "./calendarFile";
import { isOff, type CalendarEntry, type DemoAppointment, type TimeOff } from "./demo-data";
import { localDay, localMoment } from "./wallClock";

export type { StoredTimeOff };

/**
 * Stored entries as the calendar draws them: whole days as a banner over each day away, a stretch
 * of hours as a row in its day's list. Both kinds are one resource on the server.
 */
export function daysAway(blocks: StoredTimeOff[]): TimeOff[] {
  return blocks
    .filter((block) => block.allDay && block.firstDay && block.lastDay)
    .map((block) => ({
      id: block.id,
      from: localDay(block.firstDay!),
      to: localDay(block.lastDay!),
      note: block.note ?? undefined,
    }));
}

export function hoursBlocked(blocks: StoredTimeOff[]): CalendarEntry[] {
  return blocks
    .filter((block) => !block.allDay && block.startsAt && block.endsAt)
    .map((block) => ({
      id: block.id,
      title: block.note ?? "Blocked",
      start: localMoment(block.startsAt!),
      end: localMoment(block.endsAt!),
    }));
}

/**
 * Whether time off covers any of an appointment. A pending request left open in time off cannot
 * be accepted while it stands — the server refuses — so the row says so before anybody tries.
 */
export function awayDuring(appointment: DemoAppointment, timeOff: TimeOff[], entries: CalendarEntry[]): boolean {
  const start = appointmentStart(appointment);
  const end = addMinutes(start, appointment.durationMinutes);

  return (
    isOff(appointment.date, timeOff) !== undefined ||
    entries.some((entry) => entry.start < end && start < entry.end)
  );
}

/** Soonest first, like the list the server answers with. */
export function withBlock(blocks: StoredTimeOff[], saved: StoredTimeOff): StoredTimeOff[] {
  const startOf = (block: StoredTimeOff) => (block.allDay ? `${block.firstDay}T00:00` : block.startsAt!);

  return [...blocks.filter((block) => block.id !== saved.id), saved].sort((a, b) =>
    startOf(a).localeCompare(startOf(b)),
  );
}
