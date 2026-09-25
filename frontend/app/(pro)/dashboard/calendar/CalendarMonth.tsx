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
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AppointmentRow } from "../AppointmentRow";
import { appointmentStart, calendarFile, downloadCalendarFile } from "../calendarFile";
import { DetailPanel } from "../DetailPanel";
import { EntryRow } from "../EntryRow";
import { isOff, knownCustomers, type CalendarEntry, type DemoAppointment, type TimeOff } from "../demo-data";
import { prefillFrom, type BookingPrefill, type NewBooking } from "../booking";
import { BookedNotice } from "../BookedNotice";
import { NewEntryDialog, type EntryKind } from "../NewEntryDialog";
import { TimeOffBanner } from "../TimeOffBanner";

const today = new Date(new Date().setHours(0, 0, 0, 0));
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * What the right-hand column lists: the day picked in the grid, or every request still waiting
 * for an answer, whichever day it is on — what the dashboard's "Need your response" tile opens.
 */
export type CalendarListView = "day" | "requests";

/** A line in a day's list: a customer's appointment or one of the tradesperson's own entries. */
type DayItem =
  { kind: "appointment"; start: Date; item: DemoAppointment } | { kind: "entry"; start: Date; item: CalendarEntry };

export function CalendarMonth({
  appointments: initial,
  entries: initialEntries,
  timeOff: initialTimeOff,
  initialView = "day",
  openOnTimeOff = false,
}: {
  appointments: DemoAppointment[];
  entries: CalendarEntry[];
  timeOff: TimeOff[];
  initialView?: CalendarListView;
  /** Opens straight into the form on "Time off" — where "Add time off" elsewhere links to. */
  openOnTimeOff?: boolean;
}) {
  const [appointments, setAppointments] = useState(initial);
  const [entries, setEntries] = useState(initialEntries);
  const [timeOff, setTimeOff] = useState(initialTimeOff);
  const [adding, setAdding] = useState(openOnTimeOff);
  const [formKind, setFormKind] = useState<EntryKind>(openOnTimeOff ? "timeOff" : "appointment");
  // Bumped on every opening, so the form starts empty and on the day picked now.
  const [formKey, setFormKey] = useState(0);
  // Who the form is booking for, when it was opened from their request rather than from scratch.
  const [prefill, setPrefill] = useState<BookingPrefill | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<CalendarListView>(initialView);
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  // An id rather than the appointment itself, so a confirm shows up in the open panel and a
  // decline, which removes the appointment, closes it — both without being told to.
  const [openId, setOpenId] = useState<string | null>(null);
  const open = appointments.find((a) => a.id === openId) ?? null;

  const confirm = (id: string) =>
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
  const decline = (id: string) => setAppointments((prev) => prev.filter((a) => a.id !== id));

  // Either way, show the day it went on, which is not necessarily the one picked when the form
  // opened.
  const showDay = (start: Date) => {
    setSelected(new Date(new Date(start).setHours(0, 0, 0, 0)));
    setMonth(startOfMonth(start));
    setView("day");
  };
  const addEntry = (entry: Omit<CalendarEntry, "id">) => {
    setEntries((prev) => [...prev, { ...entry, id: `e${Date.now()}` }]);
    showDay(entry.start);
  };
  const addAppointment = ({ appointment, notify, replacesId }: NewBooking) => {
    setAppointments((prev) => [...prev.filter((a) => a.id !== replacesId), { ...appointment, id: `a${Date.now()}` }]);
    setOpenId(null);
    setNotice(notify ? `Booked — a confirmation is on its way to ${appointment.email}.` : "Booked.");
    showDay(appointment.date);
  };

  const rebook = (request: DemoAppointment) => {
    setPrefill(prefillFrom(request));
    setFormKey((k) => k + 1);
    setAdding(true);
  };
  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const addTimeOff = (off: Omit<TimeOff, "id">) => {
    setTimeOff((prev) => [...prev, { ...off, id: `t${Date.now()}` }]);
    showDay(off.from);
  };
  const removeTimeOff = (id: string) => setTimeOff((prev) => prev.filter((t) => t.id !== id));

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

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-brand">Calendar</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportAll}
            className="h-9 gap-1.5 rounded-full border-line px-4 text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            <Download className="size-4" />
            Export
          </Button>
          <Button
            onClick={() => {
              setPrefill(undefined);
              setFormKind("appointment");
              setFormKey((k) => k + 1);
              setAdding(true);
            }}
            className="h-9 gap-1.5 rounded-full px-4 text-sm font-semibold"
          >
            <Plus className="size-4" />
            New entry
          </Button>
        </div>
      </div>

      {notice && <BookedNotice onDismiss={() => setNotice(null)}>{notice}</BookedNotice>}

      <NewEntryDialog
        key={formKey}
        open={adding}
        onOpenChange={setAdding}
        day={selected}
        customers={knownCustomers(appointments)}
        prefill={prefill}
        appointments={appointments}
        initialKind={formKind}
        onAddEntry={addEntry}
        onAddAppointment={addAppointment}
        onAddTimeOff={addTimeOff}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
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
        {open !== null ? (
          <DetailPanel
            selection={{ type: "appointment", item: open }}
            onClose={() => setOpenId(null)}
            onConfirm={confirm}
            onDecline={decline}
            onRebook={rebook}
            className=""
          />
        ) : (
          <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
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
                  <TimeOffBanner off={selectedOff} onRemove={removeTimeOff} />
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
                      />
                    ) : (
                      <EntryRow key={line.item.id} entry={line.item} onRemove={removeEntry} />
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
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
