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
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AppointmentRow } from "../AppointmentRow";
import type { DemoAppointment } from "../demo-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonth({ appointments: initial }: { appointments: DemoAppointment[] }) {
  const [appointments, setAppointments] = useState(initial);
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);

  const confirm = (id: string) =>
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
  const decline = (id: string) => setAppointments((prev) => prev.filter((a) => a.id !== id));

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const dayAppointments = appointments
    .filter((a) => isSameDay(a.date, selected))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
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

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors",
                    !inMonth && "text-faint/60",
                    inMonth && !isSelected && "text-foreground hover:bg-brand-50",
                    isSelected && "bg-brand text-white"
                  )}
                >
                  <span className={isToday && !isSelected ? "font-bold text-brand-500" : "font-medium"}>
                    {format(day, "d")}
                  </span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      dayAppts.length === 0 && "bg-transparent",
                      dayAppts.length > 0 && isSelected && "bg-white",
                      dayAppts.length > 0 && !isSelected && hasPending && "bg-amber-500",
                      dayAppts.length > 0 && !isSelected && !hasPending && "bg-go"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 rounded-3xl border border-line bg-white py-0 shadow-card">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="text-base font-semibold">{format(selected, "EEEE, MMMM d")}</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {dayAppointments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line py-6 text-center text-sm text-muted-ink">
              Nothing booked this day.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayAppointments.map((a) => (
                <AppointmentRow key={a.id} appointment={a} onConfirm={confirm} onDecline={decline} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
