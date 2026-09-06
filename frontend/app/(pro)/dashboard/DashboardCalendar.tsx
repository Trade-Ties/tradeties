"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ArrowRight, Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CALENDAR_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { AppointmentRow } from "./AppointmentRow";
import type { DemoAppointment } from "./demo-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));
// A 7-day strip starting today, not a full month grid — enough to see what's
// coming without turning the dashboard into a scheduling app of its own.
// The full month view lives at CALENDAR_PATH for when that's not enough.
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(today, i));

export function DashboardCalendar({
  appointments,
  onConfirm,
  onDecline,
  onSelect,
  selectedId,
}: {
  appointments: DemoAppointment[];
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onSelect: (appointment: DemoAppointment) => void;
  /** id of the appointment currently open in the detail panel, if any. */
  selectedId?: string;
}) {
  // Which day of the week strip is showing in the agenda below — unrelated
  // to selectedId, which is about the detail panel.
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const dayAppointments = appointments
    .filter((a) => isSameDay(a.date, selectedDay))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Calendar className="size-4 text-brand-500" />
          Schedule
        </CardTitle>
        <Link
          href={CALENDAR_PATH}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-auto gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand-500 hover:bg-brand-50")}
        >
          Full calendar
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="mb-4 grid grid-cols-7 gap-1.5">
          {WEEK.map((day) => {
            const isSelected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, today);
            const dayAppts = appointments.filter((a) => isSameDay(a.date, day));
            const hasPending = dayAppts.some((a) => a.status === "pending");
            const hasAny = dayAppts.length > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={
                  isSelected
                    ? "flex flex-col items-center gap-1 rounded-2xl bg-brand px-1 py-2 text-white"
                    : "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-foreground transition-colors hover:bg-brand-50"
                }
              >
                <span className={isSelected ? "text-[10px] font-semibold uppercase opacity-80" : "text-[10px] font-semibold uppercase text-muted-ink"}>
                  {format(day, "EEE")}
                </span>
                <span className={isToday && !isSelected ? "text-sm font-bold text-brand-500" : "text-sm font-semibold"}>
                  {format(day, "d")}
                </span>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    !hasAny && "bg-transparent",
                    hasAny && isSelected && "bg-white",
                    hasAny && !isSelected && hasPending && "bg-amber-500",
                    hasAny && !isSelected && !hasPending && "bg-go"
                  )}
                />
              </button>
            );
          })}
        </div>

        {dayAppointments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted-ink">
            Nothing booked {isSameDay(selectedDay, today) ? "today" : `on ${format(selectedDay, "EEE, MMM d")}`}.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayAppointments.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                onConfirm={onConfirm}
                onDecline={onDecline}
                onSelect={onSelect}
                selected={a.id === selectedId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
