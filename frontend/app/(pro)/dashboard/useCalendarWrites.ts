"use client";

import { useState } from "react";
import { format } from "date-fns";

import type { TimeOffInput } from "@/lib/api/calendar";

import {
  bookAppointment,
  changeAppointment,
  deleteTimeOff,
  removeAppointment as removeAppointmentAction,
  saveTimeOff as saveTimeOffAction,
} from "./actions";
import { daysAway, hoursBlocked, withBlock, type StoredTimeOff } from "./blocks";
import { appointmentBody, changeBody, type BookResult, type NewBooking } from "./booking";
import type { DemoAppointment } from "./demo-data";
import type { TimeOffSaveResult } from "./NewEntryDialog";
import { asAppointment, incoming, type IncomingRequest } from "./requests";
import { localDay, localMoment } from "./wallClock";

/** An appointment at the wall-clock span it was moved to, drawn the way `asAppointment` draws one. */
function movedTo(appointment: DemoAppointment, startsAt: string, endsAt: string): DemoAppointment {
  const start = localMoment(startsAt);

  return {
    ...appointment,
    date: localDay(startsAt.slice(0, 10)),
    time: format(start, "h:mm a"),
    durationMinutes: Math.round((localMoment(endsAt).getTime() - start.getTime()) / 60_000),
  };
}

/**
 * The calendar writes both the dashboard and the full calendar make, and the local state that
 * has to follow each. Nothing moves until the server has said it was written.
 */
export function useCalendarWrites(requests: IncomingRequest[], initialBlocks: StoredTimeOff[]) {
  // Days built here rather than on the server, for the reason `requests.ts` gives.
  const [appointments, setAppointments] = useState(() => requests.map(asAppointment));
  const [blocks, setBlocks] = useState(initialBlocks);

  /** Declined requests leave the list with the time off that turned them down. */
  const saveTimeOff = async (input: TimeOffInput, existing?: StoredTimeOff): Promise<TimeOffSaveResult> => {
    const answer = await saveTimeOffAction(input, existing && { id: existing.id, version: existing.version });

    if (answer.kind === "saved") {
      const declined = new Set(
        (input.resolutions ?? []).filter((r) => r.action === "DECLINE").map((r) => r.requestId)
      );
      setBlocks((prev) => withBlock(prev, answer.timeOff));
      setAppointments((prev) => prev.filter((a) => !declined.has(a.id)));
      return { kind: "saved" };
    }

    return answer.kind === "conflicts"
      ? { kind: "conflicts", conflicts: answer.conflicts }
      : { kind: "refused", message: answer.message };
  };

  /** @returns a sentence to show, or null once it is gone */
  const removeTimeOff = async (id: string): Promise<string | null> => {
    const answer = await deleteTimeOff(id);
    if (!answer.ok) return answer.message;

    setBlocks((prev) => prev.filter((b) => b.id !== id));
    return null;
  };

  /**
   * Books an appointment, or changes the one named by `changingId`. What comes back is the
   * appointment as stored — including the customer's own details when it replaced their request.
   * The appointments that made room for it follow the answers given: removed ones leave the list,
   * moved ones take their new time.
   */
  const book = async (
    booking: NewBooking,
    changingId?: string
  ): Promise<{ kind: "saved"; booked: DemoAppointment } | Exclude<BookResult, { kind: "saved" }>> => {
    const answer = changingId
      ? await changeAppointment(changingId, changeBody(booking))
      : await bookAppointment(appointmentBody(booking));

    if (answer.kind !== "saved") return answer;

    const booked = asAppointment(incoming(answer.request));
    const answers = new Map((booking.resolutions ?? []).map((r) => [r.requestId, r]));

    setAppointments((prev) => [
      ...prev
        .filter((a) => a.id !== booked.id && a.id !== booking.replacesId && answers.get(a.id)?.action !== "CANCEL")
        .map((a) => {
          const moved = answers.get(a.id);
          return moved?.action === "MOVE" && moved.startsAt && moved.endsAt
            ? movedTo(a, moved.startsAt, moved.endsAt)
            : a;
        }),
      booked,
    ]);
    return { kind: "saved", booked };
  };

  /** @returns a sentence to show, or null once it is out of the calendar */
  const removeAppointment = async (id: string): Promise<string | null> => {
    const answer = await removeAppointmentAction(id);
    if (!answer.ok) return answer.message;

    setAppointments((prev) => prev.filter((a) => a.id !== id));
    return null;
  };

  return {
    appointments,
    setAppointments,
    blocks,
    timeOff: daysAway(blocks),
    entries: hoursBlocked(blocks),
    saveTimeOff,
    removeTimeOff,
    book,
    removeAppointment,
  };
}
