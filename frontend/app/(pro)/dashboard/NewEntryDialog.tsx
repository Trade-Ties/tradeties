"use client";

import { useId, useMemo, useState } from "react";
import { addMinutes, format, parse } from "date-fns";

import { toE164 } from "@/components/profile/phone";
import { Button } from "@/components/ui/button";
import {
  DIALOG_WIDE,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckboxField, SelectControl, type SelectOption } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TimeOffConflict, TimeOffInput } from "@/lib/api/calendar";
import type { AppointmentConflict, AppointmentResolution } from "@/lib/api/inbox";
import { cn } from "@/lib/utils";

import type { StoredTimeOff } from "./blocks";
import type { BookingPrefill, BookResult, NewBooking, ServiceOption } from "./booking";
import { appointmentStart } from "./calendarFile";
import type { DemoAppointment, KnownCustomer } from "./demo-data";
import { dayField, timeField, wallClock } from "./wallClock";

/**
 * What is being put in the calendar: a job for a customer the tradesperson booked themselves —
 * somebody who phoned, a regular — or time nobody can book, whole days or a few hours.
 */
export type EntryKind = "appointment" | "timeOff";

/** What the form was opened to change, when it was not opened to add something. */
export type Editing =
  | { kind: "timeOff"; block: StoredTimeOff }
  | { kind: "appointment"; appointment: DemoAppointment };

/** Where saving time off got to: done, requests to put to the tradesperson, or a refusal to show. */
export type TimeOffSaveResult =
  | { kind: "saved" }
  | { kind: "conflicts"; conflicts: TimeOffConflict[] }
  | { kind: "refused"; message: string };

const DEFAULT_DECLINE_REASON = "I'm not available at that time — happy to find another date with you.";

/** What happens to a confirmed appointment in the way: moved to a day and times, or removed. */
interface RoomAnswer {
  action: "MOVE" | "CANCEL";
  date: string;
  start: string;
  end: string;
}

interface Draft {
  kind: EntryKind;
  /** `yyyy-MM-dd` and `HH:mm`: what the browser's own date and time pickers read and write. */
  date: string;
  start: string;
  end: string;
  /** Set once the end is picked by hand, so choosing a service stops moving it. */
  endTouched: boolean;
  serviceId: string;
  // Time off: whole days, both ends included — or from one moment to another
  allDay: boolean;
  fromDate: string;
  toDate: string;
  fromTime: string;
  toTime: string;
  note: string;
  // Appointment
  customerName: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  notify: boolean;
  replaces: boolean;
}

/** The customer's details as the form's fields hold them. */
const customerFields = (c: KnownCustomer) => ({
  customerName: c.name,
  phone: c.phone,
  email: c.email,
  street: c.address.street,
  number: c.address.number,
  city: c.address.city,
  state: c.address.state,
  zip: c.address.zip,
});

const at = (date: string, time: string) => parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
const dayOf = (date: string) => parse(date, "yyyy-MM-dd", new Date());
const endAfter = (date: string, start: string, minutes: number) => timeField(addMinutes(at(date, start), minutes));

function draftFor(
  day: Date,
  kind: EntryKind,
  services: ServiceOption[],
  prefill?: BookingPrefill,
  editing?: Editing,
  startTime = "09:00",
): Draft {
  const serviceId =
    services.find((s) => s.id === prefill?.serviceId)?.id ?? (services.length === 1 ? services[0]!.id : "");
  const duration = services.find((s) => s.id === serviceId)?.durationMinutes ?? 60;
  const date = dayField(prefill?.replaces?.date ?? day);

  const draft: Draft = {
    kind,
    date,
    start: startTime,
    end: endAfter(date, startTime, duration),
    endTouched: false,
    serviceId,
    allDay: true,
    fromDate: date,
    toDate: date,
    fromTime: startTime,
    toTime: endAfter(date, startTime, 180),
    note: "",
    customerName: "",
    phone: "",
    email: "",
    street: "",
    number: "",
    city: "",
    state: "",
    zip: "",
    notes: prefill?.notes ?? "",
    ...(prefill ? customerFields(prefill.customer) : {}),
    notify: true,
    replaces: prefill?.replaces !== undefined,
  };

  if (editing?.kind === "timeOff") {
    const { block } = editing;
    const [fromDate, fromTime] = block.allDay ? [block.firstDay!, "09:00"] : block.startsAt!.split("T");
    const [toDate, toTime] = block.allDay ? [block.lastDay!, "12:00"] : block.endsAt!.split("T");

    return { ...draft, kind: "timeOff", allDay: block.allDay, fromDate: fromDate!, toDate: toDate!,
      fromTime: fromTime!, toTime: toTime!, note: block.note ?? "" };
  }

  if (editing?.kind === "appointment") {
    const { appointment } = editing;
    const start = appointmentStart(appointment);

    return {
      ...draft,
      kind: "appointment",
      date: dayField(start),
      start: timeField(start),
      end: timeField(addMinutes(start, appointment.durationMinutes)),
      endTouched: true,
      serviceId: appointment.serviceId ?? "",
      ...customerFields({
        name: appointment.customerName,
        phone: appointment.phone,
        email: appointment.email,
        address: appointment.address,
      }),
      notes: appointment.notes,
      notify: false,
      replaces: false,
    };
  }

  return draft;
}

type Problems = Partial<
  Record<"customerName" | "service" | "time" | "email" | "zip" | "state" | "phone" | "reason" | "moves", string>
>;

/**
 * @param detailsFixed the customer's own details, which are not the form's to check
 * @param serviceFixed a change, which keeps the service it was booked as — possibly one since retired
 */
function problemsIn(d: Draft, detailsFixed: boolean, serviceFixed: boolean): Problems {
  const problems: Problems = {};

  if (d.kind === "timeOff") {
    if (d.allDay) {
      if (d.fromDate === "" || d.toDate === "") problems.time = "Pick the first and the last day.";
      else if (dayOf(d.toDate) < dayOf(d.fromDate)) problems.time = "The last day can't be before the first.";
    } else if (d.fromDate === "" || d.fromTime === "" || d.toDate === "" || d.toTime === "") {
      problems.time = "Pick when it starts and when it ends.";
    } else if (at(d.toDate, d.toTime) <= at(d.fromDate, d.fromTime)) {
      problems.time = "The end has to be after the start.";
    }
    return problems;
  }

  if (d.date === "" || d.start === "" || d.end === "") problems.time = "Pick a day and a time.";
  else if (at(d.date, d.end) <= at(d.date, d.start)) problems.time = "The end has to be after the start.";

  if (!serviceFixed && d.serviceId === "") problems.service = "Which of your services is it?";
  if (detailsFixed) return problems;

  if (d.customerName.trim() === "") problems.customerName = "Who is it for?";
  if (d.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(d.email.trim()))
    problems.email = "That doesn't look like an email.";
  else if (d.notify && d.email.trim() === "")
    problems.email = "Add their email to send the confirmation — or untick sending it below.";
  if (d.phone.trim() !== "" && !/^\+[1-9]\d{1,14}$/.test(toE164(d.phone)))
    problems.phone = "That doesn't look like a phone number.";
  if (d.zip.trim() !== "" && !/^\d{5}$/.test(d.zip.trim())) problems.zip = "5 digits.";
  if (d.state.trim() !== "" && !/^[A-Za-z]{2}$/.test(d.state.trim())) problems.state = "2 letters.";

  return problems;
}

/** "Mon, Oct 12, 9:00 AM" on the clock the request was made on, not the browser's. */
function whenOf(conflict: { startsAt: string; timeZone: string }): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: conflict.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(conflict.startsAt));
}

/**
 * The form behind "New entry": an appointment the tradesperson books for a customer, or time off —
 * on the day the calendar has picked unless they change it. Also the form that changes either.
 *
 * The draft is read from `day` once, when the form mounts, so the caller keys it afresh on each
 * opening — otherwise it would reopen on the last day and the last half-typed name.
 *
 * It saves nothing itself: `onBook` and `onSaveTimeOff` belong to the screen that owns the
 * calendar, which is also what decides whether a save is an addition or a change.
 */
export function NewEntryDialog({
  open,
  onOpenChange,
  day,
  startTime,
  customers = [],
  services,
  prefill,
  editing,
  initialKind = "appointment",
  onBook,
  onSaveTimeOff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  /** `HH:mm` — the half hour clicked in the week. Nine in the morning otherwise. */
  startTime?: string;
  /** Offered as the customer's name is typed; picking one fills in the rest. */
  customers?: KnownCustomer[];
  /** The business's active services — an appointment is always booked as one of them. */
  services: ServiceOption[];
  /** Set when booking for somebody in particular — from their request or their conversation. */
  prefill?: BookingPrefill;
  editing?: Editing;
  /** What the form opens on — "Add time off" elsewhere in the portal opens it on time off. */
  initialKind?: EntryKind;
  onBook: (booking: NewBooking) => Promise<BookResult>;
  /** Left out where time off cannot be taken, and the option is not offered. */
  onSaveTimeOff?: (input: TimeOffInput) => Promise<TimeOffSaveResult>;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFor(day, prefill ? "appointment" : initialKind, services, prefill, editing, startTime)
  );
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The requests the time off would cover, once the server has named them.
  const [conflicts, setConflicts] = useState<TimeOffConflict[] | null>(null);
  const [declined, setDeclined] = useState<Record<string, boolean>>({});
  const [declineReason, setDeclineReason] = useState(DEFAULT_DECLINE_REASON);
  // The confirmed appointments the new time would overlap, once the server has named them.
  const [inTheWay, setInTheWay] = useState<AppointmentConflict[] | null>(null);
  const [roomAnswers, setRoomAnswers] = useState<Record<string, RoomAnswer>>({});
  const id = useId();

  const serviceOptions = useMemo<SelectOption<string>[]>(
    () => services.map((s) => ({ value: s.id, label: s.name })),
    [services]
  );

  const appointment = draft.kind === "appointment";
  const timeOff = draft.kind === "timeOff";
  const editingAppointment = editing?.kind === "appointment";
  // The customer's own details stay theirs: on their request, and on a job they sent.
  const detailsFixed =
    (prefill?.replaces !== undefined && draft.replaces) ||
    (editing?.kind === "appointment" && editing.appointment.detailsEditable === false);

  const pendingInTheWay = (conflicts ?? []).filter((c) => c.status === "PENDING");
  const turningDown = pendingInTheWay.some((c) => declined[c.requestId] ?? true);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const movesIncomplete = (inTheWay ?? []).some((c) => {
    const answer = roomAnswers[c.requestId];
    return (
      answer?.action === "MOVE" &&
      (answer.date === "" || answer.start === "" || answer.end === "" ||
        at(answer.date, answer.end) <= at(answer.date, answer.start))
    );
  });

  const problems: Problems = {
    ...problemsIn(draft, detailsFixed, editingAppointment),
    ...(conflicts && turningDown && declineReason.trim() === ""
      ? { reason: "Say what they are told — they read this." }
      : {}),
    ...(movesIncomplete ? { moves: "Give every appointment you move a day, and an end after its start." } : {}),
  };
  const shown = (key: keyof Problems) => (tried ? problems[key] : undefined);

  const durationOf = (serviceId: string) => services.find((s) => s.id === serviceId)?.durationMinutes;

  /** The end follows the start and the service until it has been picked by hand. */
  const moveStart = (start: string) =>
    setDraft((d) => {
      const minutes = durationOf(d.serviceId);
      return { ...d, start, ...(d.endTouched || minutes === undefined || start === "" ? {} : { end: endAfter(d.date, start, minutes) }) };
    });
  const pickService = (serviceId: string) =>
    setDraft((d) => {
      const minutes = durationOf(serviceId);
      return { ...d, serviceId, ...(d.endTouched || minutes === undefined ? {} : { end: endAfter(d.date, d.start, minutes) }) };
    });

  const timeOffInput = (): TimeOffInput => {
    const note = draft.note.trim() || undefined;
    const base: TimeOffInput = draft.allDay
      ? { allDay: true, firstDay: draft.fromDate, lastDay: draft.toDate, note }
      : {
          allDay: false,
          startsAt: wallClock(draft.fromDate, draft.fromTime),
          endsAt: wallClock(draft.toDate, draft.toTime),
          note,
        };

    if (conflicts === null) return base;

    return {
      ...base,
      resolutions: conflicts.map((c) => ({
        requestId: c.requestId,
        action: c.status === "PENDING" && (declined[c.requestId] ?? true) ? "DECLINE" : "KEEP",
      })),
      declineReason: turningDown ? declineReason.trim() : undefined,
    };
  };

  const booking = (): NewBooking => {
    const start = at(draft.date, draft.start);
    const end = at(draft.date, draft.end);
    const service = services.find((s) => s.id === draft.serviceId);

    const resolutions = inTheWay?.map((c): AppointmentResolution => {
      const answer = roomAnswers[c.requestId]!;
      return answer.action === "CANCEL"
        ? { requestId: c.requestId, action: "CANCEL" }
        : {
            requestId: c.requestId,
            action: "MOVE",
            startsAt: wallClock(answer.date, answer.start),
            endsAt: wallClock(answer.date, answer.end),
          };
    });

    return {
      notify: !editingAppointment && draft.notify,
      replacesId: prefill?.replaces && draft.replaces ? prefill.replaces.id : undefined,
      startsAt: wallClock(draft.date, draft.start),
      endsAt: wallClock(draft.date, draft.end),
      resolutions,
      appointment: {
        customerName: draft.customerName.trim(),
        service:
          editing?.kind === "appointment" ? editing.appointment.service : (service?.name ?? prefill?.service ?? ""),
        serviceId: draft.serviceId,
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        address: {
          street: draft.street.trim(),
          number: draft.number.trim(),
          city: draft.city.trim(),
          state: draft.state.trim().toUpperCase(),
          zip: draft.zip.trim(),
        },
        notes: draft.notes.trim(),
        date: new Date(new Date(start).setHours(0, 0, 0, 0)),
        time: format(start, "h:mm a"),
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
        // Booked by the tradesperson, so there is nobody left to confirm it.
        status: "confirmed",
        bookedBy: "pro",
      },
    };
  };

  const submit = async () => {
    setTried(true);
    if (Object.keys(problems).length > 0) return;

    setRefusal(null);
    setSending(true);
    try {
      if (timeOff && onSaveTimeOff) {
        const result = await onSaveTimeOff(timeOffInput());

        if (result.kind === "saved") {
          onOpenChange(false);
        } else if (result.kind === "conflicts") {
          // Answers already given are kept; a request that arrived since starts out declined.
          setDeclined((before) =>
            Object.fromEntries(
              result.conflicts
                .filter((c) => c.status === "PENDING")
                .map((c) => [c.requestId, before[c.requestId] ?? true])
            )
          );
          setConflicts(result.conflicts);
          setTried(false);
        } else {
          setRefusal(result.message);
        }
        return;
      }

      const result = await onBook(booking());

      if (result.kind === "saved") {
        onOpenChange(false);
      } else if (result.kind === "conflicts") {
        setRoomAnswers((before) => roomFor(result.conflicts, before));
        setInTheWay(result.conflicts);
        setTried(false);
      } else {
        setRefusal(result.message);
      }
    } finally {
      setSending(false);
    }
  };

  /**
   * Answers already given are kept. Anything new starts out moved to right after the new
   * appointment, keeping its length — one after the other when there are several.
   */
  const roomFor = (named: AppointmentConflict[], before: Record<string, RoomAnswer>) => {
    let next = draft.end;

    return Object.fromEntries(
      named.map((c) => {
        const kept = before[c.requestId];
        if (kept) return [c.requestId, kept];

        const minutes = Math.round((Date.parse(c.endsAt) - Date.parse(c.startsAt)) / 60_000);
        const answer: RoomAnswer = { action: "MOVE", date: draft.date, start: next, end: endAfter(draft.date, next, minutes) };
        next = answer.end;
        return [c.requestId, answer];
      })
    );
  };

  const answerRoom = (requestId: string, patch: Partial<RoomAnswer>) =>
    setRoomAnswers((all) => ({ ...all, [requestId]: { ...all[requestId]!, ...patch } }));

  /** A customer name the list knows fills in whatever of the rest is still empty — never over what was typed. */
  const pickCustomer = (name: string) => {
    const known = customers.find((c) => c.name === name);
    if (!known) return set({ customerName: name });

    const fields = customerFields(known);
    setDraft((d) => ({
      ...d,
      ...Object.fromEntries(
        Object.entries(fields).filter(([key]) => key === "customerName" || d[key as keyof Draft] === "")
      ),
    }));
  };

  const firstName = draft.customerName.trim().split(" ")[0] || "the customer";
  const listId = `${id}-customers`;

  const title = editing
    ? editing.kind === "appointment"
      ? "Change appointment"
      : "Change time off"
    : prefill
      ? `Book ${prefill.customer.name}`
      : "New calendar entry";

  const submitLabel = conflicts
    ? "Save time off"
    : editing
      ? "Save changes"
      : inTheWay
        ? "Book appointment"
        : timeOff
          ? draft.allDay
            ? "Add time off"
            : "Block this time"
          : draft.notify
            ? "Book & send confirmation"
            : "Book appointment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_WIDE, "max-h-[calc(100dvh-2rem)] overflow-y-auto")}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-5"
        >
          {conflicts ? (
            <>
              <DialogHeader>
                <DialogTitle>Requests in this time</DialogTitle>
                <DialogDescription>
                  {conflicts.length === 1
                    ? "One request falls in this time. Say what happens to it before the time off is saved."
                    : `${conflicts.length} requests fall in this time. Say what happens to each before the time off is saved.`}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                {conflicts.map((c) => (
                  <div
                    key={c.requestId}
                    className={cn(
                      "flex flex-col gap-2 rounded-2xl border px-3.5 py-3",
                      c.status === "PENDING" ? "border-amber-200 bg-amber-50/60" : "border-line bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.customerName}</p>
                        <p className="truncate text-xs text-muted-ink">
                          {c.serviceName} · {whenOf(c)}
                        </p>
                      </div>
                      <span
                        className={
                          c.status === "PENDING"
                            ? "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                            : "shrink-0 rounded-full bg-go-bg px-2 py-0.5 text-[11px] font-semibold text-[#07734F]"
                        }
                      >
                        {c.status === "PENDING" ? "Requested" : "Stays booked"}
                      </span>
                    </div>
                    {c.status === "PENDING" && (
                      <CheckboxField
                        label="Turn this request down"
                        checked={declined[c.requestId] ?? true}
                        onCheckedChange={(checked) => setDeclined((d) => ({ ...d, [c.requestId]: checked }))}
                      />
                    )}
                  </div>
                ))}
              </div>

              {pendingInTheWay.some((c) => !(declined[c.requestId] ?? true)) && (
                <p className="-mt-2 text-xs text-muted-ink">
                  A request left open stays in your inbox, but you can&apos;t accept it while this time off stands.
                </p>
              )}
              {conflicts.some((c) => c.status === "ACCEPTED") && (
                <p className="-mt-2 text-xs text-muted-ink">They stay booked. Move or cancel them with the customer.</p>
              )}

              {turningDown && (
                <FormField id={`${id}-reason`} label="What the customers you turn down are told" problem={shown("reason")}>
                  <Textarea
                    id={`${id}-reason`}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className={TEXTAREA}
                  />
                </FormField>
              )}
            </>
          ) : inTheWay ? (
            <>
              <DialogHeader>
                <DialogTitle>Appointments in this time</DialogTitle>
                <DialogDescription>
                  {inTheWay.length === 1
                    ? "A confirmed appointment holds part of this time. Move it or remove it to make room."
                    : `${inTheWay.length} confirmed appointments hold part of this time. Move or remove each to make room.`}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                {inTheWay.map((c) => {
                  const answer = roomAnswers[c.requestId]!;

                  return (
                    <div key={c.requestId} className="flex flex-col gap-3 rounded-2xl border border-line bg-white px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.customerName}</p>
                          <p className="truncate text-xs text-muted-ink">
                            {c.serviceName} · {whenOf(c)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-go-bg px-2 py-0.5 text-[11px] font-semibold text-[#07734F]">
                          {c.bookedBy === "BUSINESS" ? "Booked by you" : "Confirmed"}
                        </span>
                      </div>

                      {c.bookedBy === "CUSTOMER" && (
                        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                          The customer asked for this appointment — move or remove it only once they have agreed.
                        </p>
                      )}

                      <div role="radiogroup" aria-label={`What happens to ${c.customerName}`} className="flex gap-1 rounded-full bg-brand-50 p-1">
                        <KindOption active={answer.action === "MOVE"} onClick={() => answerRoom(c.requestId, { action: "MOVE" })}>
                          Move
                        </KindOption>
                        <KindOption active={answer.action === "CANCEL"} onClick={() => answerRoom(c.requestId, { action: "CANCEL" })}>
                          Remove
                        </KindOption>
                      </div>

                      {answer.action === "MOVE" && (
                        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                          <FormField id={`${id}-${c.requestId}-date`} label="Day">
                            <Input
                              id={`${id}-${c.requestId}-date`}
                              type="date"
                              value={answer.date}
                              onChange={(e) => answerRoom(c.requestId, { date: e.target.value })}
                              className={FIELD}
                            />
                          </FormField>
                          <FormField id={`${id}-${c.requestId}-start`} label="From">
                            <Input
                              id={`${id}-${c.requestId}-start`}
                              type="time"
                              value={answer.start}
                              onChange={(e) => answerRoom(c.requestId, { start: e.target.value })}
                              className={FIELD}
                            />
                          </FormField>
                          <FormField id={`${id}-${c.requestId}-end`} label="To">
                            <Input
                              id={`${id}-${c.requestId}-end`}
                              type="time"
                              value={answer.end}
                              onChange={(e) => answerRoom(c.requestId, { end: e.target.value })}
                              className={FIELD}
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {shown("moves") && <p className="-mt-2 text-xs text-destructive">{shown("moves")}</p>}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  {appointment
                    ? "Book a job for a customer yourself — agreed on the phone, or for a regular. It goes straight in as confirmed."
                    : draft.allDay
                      ? "Days you're away — a vacation, a trade show. Customers can't book you on any of them."
                      : "A few hours for yourself — a supplier run, a job booked elsewhere. Customers can't book you during it."}
                </DialogDescription>
              </DialogHeader>

              {/* Booking for somebody in particular is always an appointment, and a change keeps its kind. */}
              {!prefill && !editing && (
                <div role="radiogroup" aria-label="Kind of entry" className="flex gap-1 rounded-full bg-brand-50 p-1">
                  <KindOption active={appointment} onClick={() => set({ kind: "appointment" })}>
                    Appointment
                  </KindOption>
                  {onSaveTimeOff && (
                    <KindOption active={timeOff} onClick={() => set({ kind: "timeOff" })}>
                      Time off
                    </KindOption>
                  )}
                </div>
              )}

              {appointment ? (
                <>
                  <FormField id={`${id}-service`} label="Job" problem={shown("service")}>
                    {editing?.kind === "appointment" ? (
                      // Its terms were copied when it was booked; to change the service, remove it and book again.
                      <Input id={`${id}-service`} value={editing.appointment.service} disabled className={FIELD} />
                    ) : (
                      <SelectControl
                        id={`${id}-service`}
                        options={serviceOptions}
                        value={draft.serviceId}
                        onValueChange={pickService}
                        placeholder={services.length === 0 ? "Add a service to your profile first" : "Pick one of your services"}
                        disabled={services.length === 0}
                        aria-invalid={shown("service") ? true : undefined}
                        className={FIELD}
                      />
                    )}
                  </FormField>

                  <fieldset disabled={detailsFixed} className="flex flex-col gap-3 disabled:opacity-60">
                    <FormField id={`${id}-customer`} label="Customer" problem={shown("customerName")}>
                      <Input
                        id={`${id}-customer`}
                        value={draft.customerName}
                        onChange={(e) => pickCustomer(e.target.value)}
                        placeholder="Jane Cooper"
                        maxLength={120}
                        autoComplete="off"
                        list={customers.length > 0 ? listId : undefined}
                        aria-invalid={shown("customerName") ? true : undefined}
                        className={FIELD}
                      />
                      <datalist id={listId}>
                        {customers.map((c) => (
                          <option key={c.name} value={c.name} />
                        ))}
                      </datalist>
                    </FormField>
                    {/* As the booking form asks it: the name on its own line, then phone and email side by side. */}
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                      <FormField id={`${id}-phone`} label="Phone (optional)" problem={shown("phone")}>
                        <Input
                          id={`${id}-phone`}
                          type="tel"
                          value={draft.phone}
                          onChange={(e) => set({ phone: e.target.value })}
                          placeholder="(303) 555-0182"
                          autoComplete="off"
                          aria-invalid={shown("phone") ? true : undefined}
                          className={FIELD}
                        />
                      </FormField>
                      <FormField
                        id={`${id}-email`}
                        label={draft.notify && !editingAppointment ? "Email" : "Email (optional)"}
                        problem={shown("email")}
                      >
                        <Input
                          id={`${id}-email`}
                          type="email"
                          value={draft.email}
                          onChange={(e) => set({ email: e.target.value })}
                          placeholder="jane@email.com"
                          autoComplete="off"
                          aria-invalid={shown("email") ? true : undefined}
                          className={FIELD}
                        />
                      </FormField>
                    </div>

                    <div className="space-y-2">
                      <p className="mb-1.5 text-xs font-semibold text-muted-ink">Address (optional)</p>
                      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                        <Input
                          aria-label="Street"
                          value={draft.street}
                          onChange={(e) => set({ street: e.target.value })}
                          placeholder="Street"
                          className={FIELD}
                        />
                        <Input
                          aria-label="House number"
                          value={draft.number}
                          onChange={(e) => set({ number: e.target.value })}
                          placeholder="No."
                          className={FIELD}
                        />
                      </div>
                      <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2">
                        <Input
                          aria-label="City"
                          value={draft.city}
                          onChange={(e) => set({ city: e.target.value })}
                          placeholder="City"
                          className={FIELD}
                        />
                        <Input
                          aria-label="State"
                          value={draft.state}
                          onChange={(e) => set({ state: e.target.value })}
                          placeholder="State"
                          maxLength={2}
                          aria-invalid={shown("state") ? true : undefined}
                          className={FIELD}
                        />
                        <Input
                          aria-label="ZIP code"
                          inputMode="numeric"
                          value={draft.zip}
                          onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                          placeholder="ZIP"
                          aria-invalid={shown("zip") ? true : undefined}
                          className={FIELD}
                        />
                      </div>
                      {shown("zip") && <p className="text-xs text-destructive">ZIP code: {shown("zip")}</p>}
                      {shown("state") && <p className="text-xs text-destructive">State: {shown("state")}</p>}
                    </div>
                  </fieldset>

                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                      <FormField id={`${id}-date`} label="Day">
                        <Input
                          id={`${id}-date`}
                          type="date"
                          value={draft.date}
                          onChange={(e) => set({ date: e.target.value })}
                          className={FIELD}
                        />
                      </FormField>
                      <FormField id={`${id}-start`} label="From">
                        <Input
                          id={`${id}-start`}
                          type="time"
                          value={draft.start}
                          onChange={(e) => moveStart(e.target.value)}
                          className={FIELD}
                        />
                      </FormField>
                      <FormField id={`${id}-end`} label="To">
                        <Input
                          id={`${id}-end`}
                          type="time"
                          value={draft.end}
                          onChange={(e) => set({ end: e.target.value, endTouched: true })}
                          className={FIELD}
                        />
                      </FormField>
                    </div>
                    {shown("time") && <p className="text-xs text-destructive">{shown("time")}</p>}
                  </div>

                  <FormField id={`${id}-notes`} label="What needs to be done? (optional)">
                    <Textarea
                      id={`${id}-notes`}
                      value={draft.notes}
                      onChange={(e) => set({ notes: e.target.value })}
                      rows={3}
                      maxLength={2000}
                      disabled={detailsFixed}
                      className={TEXTAREA}
                    />
                  </FormField>

                  {!editingAppointment && (
                    <div className="flex flex-col gap-2.5 rounded-2xl bg-brand-50/60 px-4 py-3">
                      <CheckboxField
                        label={`Send ${firstName} a confirmation by email`}
                        checked={draft.notify}
                        onCheckedChange={(notify) => set({ notify })}
                      />
                      <p className="-mt-1 pl-6.5 text-xs text-muted-ink">
                        With the appointment attached for their calendar. It also shows in your conversation with them.
                      </p>
                      {prefill?.replaces && (
                        <CheckboxField
                          label={`Replaces their request for ${format(prefill.replaces.date, "EEE, MMM d")} at ${prefill.replaces.time}`}
                          checked={draft.replaces}
                          onCheckedChange={(replaces) => set({ replaces })}
                        />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <CheckboxField label="All day" checked={draft.allDay} onCheckedChange={(allDay) => set({ allDay })} />

                  <div className="space-y-1.5">
                    {draft.allDay ? (
                      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                        <FormField id={`${id}-from`} label="First day away">
                          <Input
                            id={`${id}-from`}
                            type="date"
                            value={draft.fromDate}
                            onChange={(e) =>
                              // The last day follows the first until it is set on its own, so a one-day
                              // absence is a single pick and a long one never starts out backwards.
                              set({
                                fromDate: e.target.value,
                                toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate,
                              })
                            }
                            className={FIELD}
                          />
                        </FormField>
                        <FormField id={`${id}-to`} label="Last day away">
                          <Input
                            id={`${id}-to`}
                            type="date"
                            value={draft.toDate}
                            min={draft.fromDate}
                            onChange={(e) => set({ toDate: e.target.value })}
                            className={FIELD}
                          />
                        </FormField>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_7rem] gap-3">
                        <FormField id={`${id}-from`} label="From">
                          <Input
                            id={`${id}-from`}
                            type="date"
                            value={draft.fromDate}
                            onChange={(e) =>
                              set({
                                fromDate: e.target.value,
                                toDate: draft.toDate < e.target.value ? e.target.value : draft.toDate,
                              })
                            }
                            className={FIELD}
                          />
                        </FormField>
                        <FormField id={`${id}-from-time`} label="Time">
                          <Input
                            id={`${id}-from-time`}
                            type="time"
                            value={draft.fromTime}
                            onChange={(e) => set({ fromTime: e.target.value })}
                            className={FIELD}
                          />
                        </FormField>
                        <FormField id={`${id}-to`} label="To">
                          <Input
                            id={`${id}-to`}
                            type="date"
                            value={draft.toDate}
                            min={draft.fromDate}
                            onChange={(e) => set({ toDate: e.target.value })}
                            className={FIELD}
                          />
                        </FormField>
                        <FormField id={`${id}-to-time`} label="Time">
                          <Input
                            id={`${id}-to-time`}
                            type="time"
                            value={draft.toTime}
                            onChange={(e) => set({ toTime: e.target.value })}
                            className={FIELD}
                          />
                        </FormField>
                      </div>
                    )}
                    {shown("time") && <p className="text-xs text-destructive">{shown("time")}</p>}
                  </div>

                  <FormField id={`${id}-note`} label="Note for yourself (optional)">
                    <Input
                      id={`${id}-note`}
                      value={draft.note}
                      onChange={(e) => set({ note: e.target.value })}
                      placeholder={draft.allDay ? "Family vacation" : "Supplier pickup"}
                      maxLength={200}
                      className={FIELD}
                    />
                  </FormField>
                </>
              )}
            </>
          )}

          {refusal && (
            <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {refusal}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {conflicts || inTheWay ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full px-5"
                disabled={sending}
                onClick={() => {
                  setConflicts(null);
                  setInTheWay(null);
                  setRefusal(null);
                }}
              >
                Back
              </Button>
            ) : (
              <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>
                Cancel
              </DialogClose>
            )}
            <Button type="submit" className="h-10 rounded-full px-5" disabled={sending}>
              {sending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The booking dialogue's field — white, roomy, rounded — so a form the professional fills in reads
 * like the one their customers do.
 */
const FIELD = "h-11 rounded-xl border-line bg-white px-3.5 text-sm focus-visible:ring-brand-500/30";
const TEXTAREA = "min-h-20 rounded-xl border-line bg-white px-3.5 text-sm focus-visible:ring-brand-500/30";

function FormField({
  id,
  label,
  problem,
  children,
}: {
  id: string;
  label: string;
  problem?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-ink">
        {label}
      </Label>
      {children}
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}

function KindOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-white text-brand shadow-sm" : "text-muted-ink hover:text-brand"
      )}
    >
      {children}
    </button>
  );
}
