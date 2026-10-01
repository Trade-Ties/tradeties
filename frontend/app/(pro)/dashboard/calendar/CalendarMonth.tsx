"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TimeOffInput } from "@/lib/api/calendar";
import type { WorkingHours } from "@/lib/api/wire";

import { AppointmentRow } from "../AppointmentRow";
import { awayDuring, type StoredTimeOff } from "../blocks";
import { appointmentStart, calendarFile, downloadCalendarFile } from "../calendarFile";
import { DetailPanel } from "../DetailPanel";
import { EntryRow } from "../EntryRow";
import { isOff, knownCustomers, type CalendarEntry, type DemoAppointment } from "../demo-data";
import { prefillFrom, type BookingPrefill, type BookResult, type NewBooking, type ServiceOption } from "../booking";
import { asSentence, BookedNotice } from "../BookedNotice";
import { NewEntryDialog, type Editing, type EntryKind } from "../NewEntryDialog";
import { TimeOffBanner } from "../TimeOffBanner";
import { acceptRequest, declineRequest } from "../actions";
import { DeclineDialog } from "../DeclineDialog";
import type { IncomingRequest } from "../requests";
import { useCalendarWrites } from "../useCalendarWrites";
import { localDay, timeField } from "../wallClock";
import { CalendarWeek } from "./CalendarWeek";

const today = new Date(new Date().setHours(0, 0, 0, 0));
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The calendar and the column beside it — one fixed width in month, week and day, so switching
 * between them leaves the side where it was. Shared by the page's header, so its tabs line up with
 * the column.
 */
const COLUMNS = "lg:grid-cols-[minmax(0,1fr)_440px]";

/**
 * What the right-hand column lists: the day picked in the grid, or every request still waiting
 * for an answer, whichever day it is on — what the dashboard's "Need your response" tile opens.
 */
export type CalendarListView = "day" | "requests";

/** The month with the picked day's list beside it, or the picked day's week hour by hour. */
type CalendarGrid = "month" | "week" | "day";

/** A line in a day's list: a customer's appointment or one of the tradesperson's own entries. */
type DayItem =
  { kind: "appointment"; start: Date; item: DemoAppointment } | { kind: "entry"; start: Date; item: CalendarEntry };

export function CalendarMonth({
  sent,
  blocks,
  services,
  workingHours,
  initialView = "day",
  openOnTimeOff = false,
}: {
  /** What customers asked for. Named apart from the `requests` view below, which is a day's rows. */
  sent: IncomingRequest[];
  /** Time off and blocked hours, as stored. */
  blocks: StoredTimeOff[];
  services: ServiceOption[];
  /** Shades the hours outside them in the week. */
  workingHours: WorkingHours | null;
  initialView?: CalendarListView;
  /** Opens straight into the form on "Time off" — where "Add time off" elsewhere links to. */
  openOnTimeOff?: boolean;
}) {
  const writes = useCalendarWrites(sent, blocks);
  const { appointments, setAppointments, entries, timeOff } = writes;
  const [refusal, setRefusal] = useState<{ message: string; gone: boolean } | null>(null);
  const [declining, setDeclining] = useState<DemoAppointment | null>(null);
  const [adding, setAdding] = useState(openOnTimeOff);
  const [formKind, setFormKind] = useState<EntryKind>(openOnTimeOff ? "timeOff" : "appointment");
  // Bumped on every opening, so the form starts empty and on the day picked now.
  const [formKey, setFormKey] = useState(0);
  // Who the form is booking for, when it was opened from their request rather than from scratch.
  const [prefill, setPrefill] = useState<BookingPrefill | undefined>();
  // What the form changes, when it was opened on an entry rather than to add one.
  const [editing, setEditing] = useState<Editing | undefined>();
  // The half hour clicked in the week, which the form starts at.
  const [formTime, setFormTime] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [grid, setGrid] = useState<CalendarGrid>("month");
  const [view, setView] = useState<CalendarListView>(initialView);
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  // An id rather than the appointment itself, so a confirm shows up in the open panel and a
  // decline, which removes the appointment, closes it — both without being told to.
  const [openId, setOpenId] = useState<string | null>(null);
  const open = appointments.find((a) => a.id === openId) ?? null;

  /** Nothing moves until the server says it was written — see the dashboard's own note. */
  const confirm = async (id: string) => {
    const answer = await acceptRequest(id);

    if (answer.ok) {
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
    } else {
      setRefusal(answer);
    }
  };

  /** Turning a job down needs a reason, so the button opens the box rather than doing it. */
  const decline = (id: string) => {
    const request = appointments.find((a) => a.id === id);
    if (request) {
      setDeclining(request);
    }
  };

  const sendDecline = async (id: string, reason: string) => {
    const answer = await declineRequest(id, reason);

    if (!answer.ok) {
      setRefusal(answer);
      return;
    }

    setDeclining(null);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  // Either way, show the day it went on, which is not necessarily the one picked when the form
  // opened.
  const showDay = (start: Date) => {
    setSelected(new Date(new Date(start).setHours(0, 0, 0, 0)));
    setMonth(startOfMonth(start));
    setView("day");
  };

  const openForm = (
    next: { kind?: EntryKind; prefill?: BookingPrefill; editing?: Editing; startTime?: string } = {}
  ) => {
    setPrefill(next.prefill);
    setEditing(next.editing);
    setFormTime(next.startTime);
    setFormKind(next.kind ?? "appointment");
    setFormKey((k) => k + 1);
    setAdding(true);
  };

  const book = async (booking: NewBooking): Promise<BookResult> => {
    const changing = editing?.kind === "appointment" ? editing.appointment.id : undefined;
    const result = await writes.book(booking, changing);

    if (result.kind !== "saved") return result;

    setOpenId(null);
    setNotice(
      changing
        ? "Saved."
        : booking.notify
          ? `Booked — a confirmation is on its way to ${booking.appointment.email}.`
          : "Booked."
    );
    showDay(result.booked.date);
    return { kind: "saved" };
  };

  const saveTimeOff = async (input: TimeOffInput) => {
    const result = await writes.saveTimeOff(input, editing?.kind === "timeOff" ? editing.block : undefined);

    if (result.kind === "saved") {
      showDay(localDay(input.allDay ? input.firstDay! : input.startsAt!.slice(0, 10)));
    }
    return result;
  };

  const rebook = (request: DemoAppointment) => openForm({ prefill: prefillFrom(request) });

  const addAt = (at: Date) => {
    setOpenId(null);
    setSelected(startOfDay(at));
    openForm({ startTime: timeField(at) });
  };

  // The month the week was in, so switching over keeps the same days in sight.
  const showGrid = (next: CalendarGrid) => {
    if (next === "month") setMonth(startOfMonth(selected));
    setGrid(next);
  };

  /** Whole days and a few hours are one kind of entry on the server, and one form. */
  const editBlock = (id: string) => {
    const block = writes.blocks.find((b) => b.id === id);
    if (block) openForm({ kind: "timeOff", editing: { kind: "timeOff", block } });
  };

  const removeBlock = async (id: string) => {
    const message = await writes.removeTimeOff(id);
    if (message !== null) setRefusal({ message, gone: false });
  };

  const removeBooked = async (id: string) => {
    const message = await writes.removeAppointment(id);

    if (message !== null) {
      setRefusal({ message, gone: false });
      return;
    }

    setOpenId(null);
    setNotice("Removed from your calendar.");
  };

  const exportAll = () => downloadCalendarFile("tradeties-calendar.ics", calendarFile(appointments, entries, timeOff));
  const selectedOff = isOff(selected, timeOff);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // By when each starts rather than by the time as written, which sorts "1:30 PM" before "9:00 AM".
  const byStart = (a: DayItem, b: DayItem) => a.start.getTime() - b.start.getTime();

  const dayItems: DayItem[] = [
    ...appointments
      .filter((a) => isSameDay(a.date, selected))
      .map((a): DayItem => ({ kind: "appointment", start: appointmentStart(a), item: a })),
    ...entries
      .filter((e) => isSameDay(e.start, selected))
      .map((e): DayItem => ({ kind: "entry", start: e.start, item: e })),
  ].sort(byStart);

  // Soonest first: the one that has to be answered before the others.
  const requests: DayItem[] = appointments
    .filter((a) => a.status === "pending")
    .map((a): DayItem => ({ kind: "appointment", start: appointmentStart(a), item: a }))
    .sort(byStart);

  const listed = view === "day" ? dayItems : requests;

  // The column beside the calendar in every view: the picked day's list (or the requests), or the
  // appointment opened from it.
  const side =
    open !== null ? (
      <DetailPanel
        selection={{ type: "appointment", item: open }}
        onClose={() => setOpenId(null)}
        onConfirm={confirm}
        onDecline={decline}
        onRebook={rebook}
        onChange={(appointment) => openForm({ editing: { kind: "appointment", appointment } })}
        onRemove={removeBooked}
        className="h-full"
        boxClassName="lg:static lg:h-full"
      />
    ) : (
      <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card h-full">
        <CardHeader className="flex flex-col gap-3 px-5 pt-5">
          <div role="tablist" aria-label="Show" className="flex w-full gap-1 rounded-full bg-brand-50 p-1">
            <ViewTab active={view === "day"} onClick={() => setView("day")}>
              {format(selected, "MMM d")}
            </ViewTab>
            <ViewTab active={view === "requests"} onClick={() => setView("requests")}>
              Requests{requests.length > 0 && ` (${requests.length})`}
            </ViewTab>
          </div>
          <CardTitle className="text-base font-semibold">
            {view === "day" ? format(selected, "EEEE, MMMM d") : "Needs your response"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {view === "day" && selectedOff && (
            <div className={cn(listed.length > 0 && "mb-2")}>
              <TimeOffBanner off={selectedOff} onEdit={editBlock} onRemove={removeBlock} />
            </div>
          )}
          {listed.length === 0 && view === "day" && selectedOff ? null : listed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted-ink">
              {view === "day" ? "Nothing booked this day." : "You're all caught up — no requests waiting."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {listed.map((line) =>
                line.kind === "appointment" ? (
                  <AppointmentRow
                    key={line.item.id}
                    appointment={line.item}
                    onConfirm={confirm}
                    onDecline={decline}
                    onSelect={(appointment) => setOpenId(appointment.id)}
                    showDate={view === "requests"}
                    away={awayDuring(line.item, timeOff, entries)}
                  />
                ) : (
                  <EntryRow key={line.item.id} entry={line.item} onEdit={editBlock} onRemove={removeBlock} />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );

  return (
    <>
      {/*
        On the same columns as what is under it, so the layout tabs start where the side column
        does and the buttons end where it ends.
      */}
      <div className={cn("mb-8 grid grid-cols-1 items-end gap-x-4 gap-y-3", COLUMNS)}>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-brand">Calendar</h1>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Calendar layout" className="flex gap-1 rounded-full bg-brand-50 p-1">
            <ViewTab active={grid === "month"} onClick={() => showGrid("month")}>
              Month
            </ViewTab>
            <ViewTab active={grid === "week"} onClick={() => showGrid("week")}>
              Week
            </ViewTab>
            <ViewTab active={grid === "day"} onClick={() => showGrid("day")}>
              Day
            </ViewTab>
          </div>
          <Button
            variant="outline"
            onClick={exportAll}
            className="h-9 gap-1.5 rounded-full border-line px-4 text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            <Download className="size-4" />
            Export
          </Button>
          <Button onClick={() => openForm()} className="h-9 gap-1.5 rounded-full px-4 text-sm font-semibold">
            <Plus className="size-4" />
            New entry
          </Button>
        </div>
      </div>

      {notice && <BookedNotice onDismiss={() => setNotice(null)}>{notice}</BookedNotice>}

      {refusal && (
        <BookedNotice tone="warning" onDismiss={() => setRefusal(null)}>
          {asSentence(refusal.message)}
          {refusal.gone && " Reload to see what is still open."}
        </BookedNotice>
      )}

      <DeclineDialog
        key={declining?.id ?? "none"}
        request={declining}
        onOpenChange={(open) => !open && setDeclining(null)}
        onDecline={sendDecline}
      />

      <NewEntryDialog
        key={formKey}
        open={adding}
        onOpenChange={setAdding}
        day={selected}
        startTime={formTime}
        customers={knownCustomers(appointments)}
        services={services}
        prefill={prefill}
        editing={editing}
        initialKind={formKind}
        onBook={book}
        onSaveTimeOff={saveTimeOff}
      />

      {grid === "week" || grid === "day" ? (
        // The same side as the month's — the day's list, or the open appointment — beside the grid
        // rather than over it, from the start. Both as tall as the taller, ending level.
        <div className={cn("grid grid-cols-1 gap-4 lg:items-stretch", COLUMNS)}>
          <div className="min-w-0">
            <CalendarWeek
              layout={grid}
              selected={selected}
              appointments={appointments}
              entries={entries}
              timeOff={timeOff}
              workingHours={workingHours}
              openId={openId}
              onSelectDay={setSelected}
              onOpen={(appointment) => setOpenId(appointment.id)}
              onAdd={addAt}
              onEditBlock={editBlock}
              onRemoveBlock={removeBlock}
            />
          </div>
          <div>{side}</div>
        </div>
      ) : (
        // Both columns as tall as the taller one, ending level: a long panel or list makes the page
        // longer rather than scrolling inside, and the month stretches to meet it.
        <div className={cn("grid grid-cols-1 items-start gap-4 lg:items-stretch", COLUMNS)}>
          <Card className="h-full gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
              <CardTitle className="text-base font-semibold">{format(month, "MMMM yyyy")}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  className="size-8 rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="size-8 rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-faint">
                {WEEKDAY_LABELS.map((d) => (
                  <span key={d} className="py-1.5">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const inMonth = isSameMonth(day, month);
                  const isSelected = isSameDay(day, selected);
                  const isToday = isSameDay(day, today);
                  const dayAppts = appointments.filter((a) => isSameDay(a.date, day));
                  const hasPending = dayAppts.some((a) => a.status === "pending");
                  const hasConfirmed = dayAppts.some((a) => a.status === "confirmed");
                  const hasEntry = entries.some((e) => isSameDay(e.start, day));
                  const off = isOff(day, timeOff) !== undefined;
                  const offOnly = off && !hasPending && !hasConfirmed;

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelected(day);
                        setView("day");
                        setOpenId(null);
                      }}
                      // Twice to put something on it: the form opens on that day.
                      onDoubleClick={() => {
                        setSelected(day);
                        setOpenId(null);
                        openForm();
                      }}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors",
                        !inMonth && "text-faint/60",
                        inMonth && !isSelected && !off && "text-foreground hover:bg-brand-50",
                        // Away: greyed, still selectable to see what is on it.
                        inMonth && !isSelected && off && "bg-slate-100 text-faint hover:bg-slate-200/70",
                        isSelected && "bg-brand text-white"
                      )}
                    >
                      <span className={isToday && !isSelected ? "font-bold text-brand-500" : "font-medium"}>
                        {format(day, "d")}
                      </span>
                      {/* One dot per kind of thing on the day: a request, a confirmed job, your own entry.
                          A day away says so instead — unless something booked is still on it. */}
                      {offOnly && (
                        <span
                          className={cn(
                            "h-1.5 text-[9px] leading-[6px] font-semibold uppercase",
                            isSelected ? "text-white/80" : "text-faint"
                          )}
                        >
                          Off
                        </span>
                      )}
                      <span className={cn("flex h-1.5 gap-0.5", offOnly && "hidden")}>
                        {hasPending && <Dot className={isSelected ? "bg-white" : "bg-amber-500"} />}
                        {hasConfirmed && <Dot className={isSelected ? "bg-white" : "bg-go"} />}
                        {hasEntry && <Dot className={isSelected ? "bg-white/60" : "bg-slate-400"} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* The same panel the dashboard opens, in place of the day's list rather than beside it:
            a third column does not fit this page's width. Closing it goes back to the list. */}
          <div>{side}</div>
        </div>
      )}
    </>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("size-1.5 rounded-full", className)} />;
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-white text-brand shadow-sm" : "text-muted-ink hover:text-brand"
      )}
    >
      {children}
    </button>
  );
}
