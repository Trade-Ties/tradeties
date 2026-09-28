"use client";

import { useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { Calendar, Plus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CALENDAR_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { AppointmentRow } from "./AppointmentRow";
import { appointmentStart } from "./calendarFile";
import { EntryRow } from "./EntryRow";
import { CardHeaderLink } from "./CardHeaderLink";
import { isOff, type CalendarEntry, type DemoAppointment, type TimeOff } from "./demo-data";
import { TimeOffBanner } from "./TimeOffBanner";

const today = new Date(new Date().setHours(0, 0, 0, 0));
// A 7-day strip starting today, not a full month grid — enough to see what's
// coming without turning the dashboard into a scheduling app of its own.
// The full month view lives at CALENDAR_PATH for when that's not enough.
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(today, i));

export function DashboardCalendar({
  appointments,
  entries,
  timeOff,
  onConfirm,
  onDecline,
  onSelect,
  onNew,
  selectedId,
}: {
  appointments: DemoAppointment[];
  /** The tradesperson's own entries — shown, not edited: that is the full calendar's job. */
  entries: CalendarEntry[];
  timeOff: TimeOff[];
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onSelect: (appointment: DemoAppointment) => void;
  /** Opens the form for a new appointment or a block of the tradesperson's own time. */
  onNew: () => void;
  /** id of the appointment currently open in the detail panel, if any. */
  selectedId?: string;
}) {
  // Which day of the week strip is showing in the agenda below — unrelated
  // to selectedId, which is about the detail panel.
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Ordered by when each starts, appointments and entries together.
  const dayItems = [
    ...appointments
      .filter((a) => isSameDay(a.date, selectedDay))
      .map((a) => ({ kind: "appointment" as const, start: appointmentStart(a), item: a })),
    ...entries
      .filter((e) => isSameDay(e.start, selectedDay))
      .map((e) => ({ kind: "entry" as const, start: e.start, item: e })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  const selectedOff = isOff(selectedDay, timeOff);

  return (
    <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Calendar className="size-4 text-brand-500" />
          Schedule
        </CardTitle>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-50"
          >
            <Plus className="size-3" />
            New
          </button>
          <CardHeaderLink href={CALENDAR_PATH}>Full calendar</CardHeaderLink>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="mb-4 grid grid-cols-7 gap-1.5">
          {WEEK.map((day) => {
            const isSelected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, today);
            const dayAppts = appointments.filter((a) => isSameDay(a.date, day));
            const hasPending = dayAppts.some((a) => a.status === "pending");
            const hasAny = dayAppts.length > 0;
            const hasEntry = entries.some((e) => isSameDay(e.start, day));
            const off = isOff(day, timeOff) !== undefined;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={
                  isSelected
                    ? "flex flex-col items-center gap-1 rounded-2xl bg-brand px-1 py-2 text-white"
                    : off
                      ? "flex flex-col items-center gap-1 rounded-2xl bg-slate-100 px-1 py-2 text-faint transition-colors hover:bg-slate-200/70"
                      : "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-foreground transition-colors hover:bg-brand-50"
                }
              >
                <span className={isSelected ? "text-[10px] font-semibold uppercase opacity-80" : "text-[10px] font-semibold uppercase text-muted-ink"}>
                  {format(day, "EEE")}
                </span>
                <span className={isToday && !isSelected ? "text-sm font-bold text-brand-500" : "text-sm font-semibold"}>
                  {format(day, "d")}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      !hasAny && "hidden",
                      hasAny && isSelected && "bg-white",
                      hasAny && !isSelected && hasPending && "bg-amber-500",
                      hasAny && !isSelected && !hasPending && "bg-go"
                    )}
                  />
                  {hasEntry && (
                    <span className={cn("size-1.5 rounded-full", isSelected ? "bg-white/60" : "bg-slate-400")} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedOff && (
          <div className={cn(dayItems.length > 0 && "mb-2")}>
            <TimeOffBanner off={selectedOff} />
          </div>
        )}
        {dayItems.length === 0 && selectedOff ? null : dayItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted-ink">
            Nothing booked {isSameDay(selectedDay, today) ? "today" : `on ${format(selectedDay, "EEE, MMM d")}`}.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayItems.map((line) =>
              line.kind === "appointment" ? (
                <AppointmentRow
                  key={line.item.id}
                  appointment={line.item}
                  onConfirm={onConfirm}
                  onDecline={onDecline}
                  onSelect={onSelect}
                  selected={line.item.id === selectedId}
                />
              ) : (
                <EntryRow key={line.item.id} entry={line.item} />
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
