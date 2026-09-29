"use client";

import { useState, useSyncExternalStore } from "react";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  getISODay,
  getWeek,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Lock, Palmtree } from "lucide-react";

import { toMinutes } from "@/components/profile/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WorkingHours } from "@/lib/api/wire";
import { cn } from "@/lib/utils";

import { appointmentStart } from "../calendarFile";
import { isOff, type CalendarEntry, type DemoAppointment, type TimeOff } from "../demo-data";
import { EntryRow } from "../EntryRow";
import { TimeOffBanner } from "../TimeOffBanner";
import { dayField } from "../wallClock";

const today = new Date(new Date().setHours(0, 0, 0, 0));
const HOUR_HEIGHT = 48;
const DAY_MINUTES = 24 * 60;
/** Anything shorter is drawn this long, or it could be neither read nor hit. */
const SHORTEST_MINUTES = 30;
/** The same template on every row, so the hour labels and the seven days line up down the grid. */
const COLUMNS = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";
/** Time nobody can book — time off and blocked hours — whatever the working hours say. */
const HATCHED = "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-line)_6px_7px)]";

/** Something in a day's column, in minutes after that day's midnight. */
type Placed =
  | { kind: "appointment"; key: string; from: number; to: number; appointment: DemoAppointment }
  | { kind: "entry"; key: string; from: number; to: number; entry: CalendarEntry };

type InLane<T> = T & { lane: number; lanes: number };

/**
 * The week the picked day is in, hour by hour: each day a column with its appointments and
 * blocked hours where they fall, and time off along the top. Hours outside the working day are
 * shaded, so a request at 7 PM stands out as one.
 */
export function CalendarWeek({
  selected,
  appointments,
  entries,
  timeOff,
  workingHours,
  openId,
  onSelectDay,
  onOpen,
  onAdd,
  onEditBlock,
  onRemoveBlock,
  aside,
}: {
  /** The week shown is the one this day is in; moving a week moves it. */
  selected: Date;
  appointments: DemoAppointment[];
  entries: CalendarEntry[];
  timeOff: TimeOff[];
  /** None entered yet: then no hour is set apart from the others. */
  workingHours: WorkingHours | null;
  /** The appointment open in `aside`, outlined in the grid. */
  openId: string | null;
  onSelectDay: (day: Date) => void;
  onOpen: (appointment: DemoAppointment) => void;
  /** An empty half hour was clicked: the form opens on it. */
  onAdd: (at: Date) => void;
  onEditBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  /** Laid over the right of the grid rather than beside it, so the week keeps its width. */
  aside?: React.ReactNode;
}) {
  // Which stretch of blocked time has its row open. Per day: one stretch can run over several.
  const [peek, setPeek] = useState<string | null>(null);
  const minute = useSyncExternalStore(everyMinute, currentMinute, noMinute);
  const now = minute === null ? null : new Date(minute * 60_000);

  const days = eachDayOfInterval({ start: startOfWeek(selected), end: endOfWeek(selected) });
  const columns = days.map((day) => inLanes(placedOn(day, appointments, entries)));
  const { first, last } = visibleHours(days, columns, workingHours);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const height = hours.length * HOUR_HEIGHT;

  const y = (minutes: number) => ((minutes - first * 60) / 60) * HOUR_HEIGHT;
  /** Where a stretch is drawn, cut to the hours shown — or nowhere, when none of it is. */
  const span = (from: number, to: number) => {
    const top = y(Math.max(from, first * 60));
    const bottom = y(Math.min(to, last * 60));
    return bottom > top ? { top, height: bottom - top } : null;
  };

  const thenClose = (act: (id: string) => void) => (id: string) => {
    setPeek(null);
    act(id);
  };

  return (
    <Card className="gap-0 overflow-visible rounded-3xl border border-line bg-white py-0 shadow-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-5 py-5">
        <CardTitle className="flex items-baseline gap-2 text-base font-semibold">
          {weekTitle(days[0]!, days[6]!)}
          <span className="font-normal text-faint">/</span>
          <span className="text-sm font-medium text-muted-ink">Week {getWeek(selected)}</span>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            onClick={() => onSelectDay(today)}
            className="mr-1 h-8 rounded-full border-line px-3.5 text-xs font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            onClick={() => onSelectDay(subWeeks(selected, 1))}
            className="size-8 rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            onClick={() => onSelectDay(addWeeks(selected, 1))}
            className="size-8 rounded-full text-muted-ink hover:bg-brand-50 hover:text-brand-500"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative px-0">
        {/* Scrolls sideways on a phone rather than squeezing seven days into its width. */}
        <div className="overflow-x-auto rounded-b-3xl">
          <div className="min-w-[42rem]">
            <div className={cn(COLUMNS, "border-b border-line")}>
              <div className="sticky left-0 z-20 bg-white" />
              {days.map((day) => {
                const isSelected = isSameDay(day, selected);
                const isToday = isSameDay(day, today);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => onSelectDay(day)}
                    aria-label={format(day, "EEEE, MMMM d")}
                    aria-pressed={isSelected}
                    className="group flex flex-col items-center gap-0.5 pb-2"
                  >
                    <span className={cn("text-[11px] font-semibold uppercase", isToday ? "text-brand-500" : "text-faint")}>
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-full text-xl font-bold tracking-[-0.02em] transition-colors",
                        isSelected && "bg-brand text-white",
                        !isSelected && isToday && "text-brand-500 group-hover:bg-brand-50",
                        !isSelected && !isToday && isBefore(day, today) && "text-faint group-hover:bg-brand-50",
                        !isSelected && !isToday && !isBefore(day, today) && "text-foreground group-hover:bg-brand-50"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={cn(COLUMNS, "border-b border-line")}>
              <div className="sticky left-0 z-20 bg-white py-2.5 pr-2 text-right text-[11px] font-medium text-faint">
                all day
              </div>
              {days.map((day) => {
                const off = isOff(day, timeOff);
                const key = `${off?.id}:${dayField(day)}`;

                return (
                  <div key={day.toISOString()} className="min-h-9 border-l border-line p-1">
                    {off && (
                      <Popover open={peek === key} onOpenChange={(open) => setPeek(open ? key : null)}>
                        <PopoverTrigger
                          aria-label={`Time off${off.note ? `, ${off.note}` : ""}`}
                          className="flex w-full items-center gap-1 rounded-lg bg-slate-100 px-1.5 py-1 text-left text-[11px] font-semibold text-muted-ink transition-colors hover:bg-slate-200/70"
                        >
                          <Palmtree className="size-3 shrink-0" />
                          <span className="truncate">{off.note ?? "Time off"}</span>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-1.5">
                          <TimeOffBanner off={off} onEdit={thenClose(onEditBlock)} onRemove={thenClose(onRemoveBlock)} />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={COLUMNS}>
              <div className="sticky left-0 z-20 bg-white py-3">
                <div className="relative" style={{ height }}>
                  {hours.map((hour) => (
                    <span
                      key={hour}
                      className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-faint"
                      style={{ top: y(hour * 60) }}
                    >
                      {format(new Date(2000, 0, 1, hour), "h a")}
                    </span>
                  ))}
                </div>
              </div>

              {days.map((day, i) => {
                const off = isOff(day, timeOff) !== undefined;
                const nowAt = now !== null && isSameDay(now, day) ? y(minutesInto(now)) : null;

                return (
                  <div key={day.toISOString()} className="border-l border-line py-3">
                    <div className="relative" style={{ height }}>
                      {closedHours(day, workingHours).map(([from, to]) => {
                        const at = span(from, to);
                        return at && <div key={from} className="absolute inset-x-0 bg-slate-50" style={at} />;
                      })}
                      {off && <div className={cn("absolute inset-0", HATCHED)} />}

                      {hours.map((hour) => (
                        <div
                          key={hour}
                          // On the hour or half past, whichever half was clicked.
                          onClick={(e) =>
                            onAdd(atMinutes(day, hour * 60 + (e.nativeEvent.offsetY < HOUR_HEIGHT / 2 ? 0 : 30)))
                          }
                          className="relative cursor-pointer border-t border-line transition-colors last:border-b hover:bg-brand-50/70"
                          style={{ height: HOUR_HEIGHT }}
                        />
                      ))}

                      {columns[i]!.map((item) => {
                        const at = span(item.from, Math.max(item.to, item.from + SHORTEST_MINUTES));
                        if (!at) return null;

                        const style = { ...at, ...lanePosition(item.lane, item.lanes) };
                        const lines = at.height >= 60 ? 3 : at.height >= 40 ? 2 : 1;

                        return item.kind === "appointment" ? (
                          <AppointmentBlock
                            key={item.key}
                            appointment={item.appointment}
                            style={style}
                            lines={lines}
                            selected={item.appointment.id === openId}
                            onOpen={onOpen}
                          />
                        ) : (
                          <Popover
                            key={item.key}
                            open={peek === item.key}
                            onOpenChange={(open) => setPeek(open ? item.key : null)}
                          >
                            <PopoverTrigger
                              aria-label={`${item.entry.title}, ${format(item.entry.start, "h:mm a")} to ${format(item.entry.end, "h:mm a")}`}
                              style={style}
                              className={cn(
                                "absolute z-10 flex flex-col overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 px-1.5 py-1 text-left text-[11px] leading-snug text-muted-ink transition-shadow hover:shadow-card",
                                HATCHED,
                                lines === 1 && "py-0.5"
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-1 font-semibold text-foreground">
                                <Lock className="size-2.5 shrink-0" />
                                <span className="truncate">{item.entry.title}</span>
                              </span>
                              {lines > 1 && (
                                <span className="truncate">
                                  {format(item.entry.start, "h:mm a")} – {format(item.entry.end, "h:mm a")}
                                </span>
                              )}
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-1.5">
                              <EntryRow
                                entry={item.entry}
                                showDate
                                onEdit={thenClose(onEditBlock)}
                                onRemove={thenClose(onRemoveBlock)}
                              />
                            </PopoverContent>
                          </Popover>
                        );
                      })}

                      {nowAt !== null && nowAt >= 0 && nowAt <= height && (
                        <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-brand-500" style={{ top: nowAt }}>
                          <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-brand-500" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {aside && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-full px-2 sm:w-[376px]">{aside}</div>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentBlock({
  appointment,
  style,
  lines,
  selected,
  onOpen,
}: {
  appointment: DemoAppointment;
  style: React.CSSProperties;
  /** How many of name, time and service the block is tall enough for. */
  lines: 1 | 2 | 3;
  selected: boolean;
  onOpen: (appointment: DemoAppointment) => void;
}) {
  const pending = appointment.status === "pending";

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      style={style}
      aria-label={`${appointment.customerName}, ${appointment.service}, ${format(appointment.date, "EEEE")} ${appointment.time}${pending ? ", requested" : ""}`}
      className={cn(
        "absolute z-10 flex flex-col overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] leading-snug transition-shadow hover:shadow-card",
        // A request is dashed like anything not settled yet: it may still be declined.
        pending ? "border-dashed border-amber-300 bg-amber-50" : "border-go/30 bg-go-bg",
        lines === 1 && "py-0.5",
        selected && "ring-2 ring-brand-500"
      )}
    >
      <span className="truncate font-semibold text-brand">
        {appointment.customerName}
        {lines === 1 && <span className="font-normal text-muted-ink"> · {appointment.time}</span>}
      </span>
      {lines > 1 && (
        <span className={cn("truncate font-medium", pending ? "text-amber-700" : "text-[#07734F]")}>
          {appointment.time}
          {pending && " · Requested"}
        </span>
      )}
      {lines > 2 && <span className="truncate text-muted-ink">{appointment.service}</span>}
    </button>
  );
}

// The minute the now-line is drawn at. Read only in the browser: the server's minute would be
// stale by the time the page is looked at, and would not match the one the browser hydrates with.
const everyMinute = (tick: () => void) => {
  const id = setInterval(tick, 15_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

/** "September 2026", or "Sep – Oct 2026" for a week that runs into the next month. */
function weekTitle(first: Date, last: Date): string {
  if (isSameMonth(first, last)) return format(first, "MMMM yyyy");
  if (isSameYear(first, last)) return `${format(first, "MMM")} – ${format(last, "MMM yyyy")}`;
  return `${format(first, "MMM yyyy")} – ${format(last, "MMM yyyy")}`;
}

const atMinutes = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);

const minutesInto = (at: Date) => at.getHours() * 60 + at.getMinutes();

/** A day's appointments and blocked hours. Blocked time over midnight is drawn in each day it covers. */
function placedOn(day: Date, appointments: DemoAppointment[], entries: CalendarEntry[]): Placed[] {
  const next = addDays(day, 1);

  return [
    ...appointments
      .filter((a) => isSameDay(a.date, day))
      .map((a): Placed => {
        const from = minutesInto(appointmentStart(a));
        return {
          kind: "appointment",
          key: a.id,
          from,
          to: Math.min(from + a.durationMinutes, DAY_MINUTES),
          appointment: a,
        };
      }),
    ...entries
      .filter((e) => e.start < next && e.end > day)
      .map(
        (e): Placed => ({
          kind: "entry",
          key: `${e.id}:${dayField(day)}`,
          from: e.start < day ? 0 : minutesInto(e.start),
          to: e.end >= next ? DAY_MINUTES : minutesInto(e.end),
          entry: e,
        })
      ),
  ];
}

/**
 * Side by side where they overlap — two requests for the same hour are the case that matters —
 * each as wide as the most that overlap at once leave room for.
 */
function inLanes<T extends { from: number; to: number }>(items: T[]): InLane<T>[] {
  const end = (item: T) => Math.max(item.to, item.from + SHORTEST_MINUTES);
  const placed: InLane<T>[] = [];
  let group: InLane<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const item of [...items].sort((a, b) => a.from - b.from || end(b) - end(a))) {
    if (item.from >= groupEnd) closeGroup();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end(item);

    group.push({ ...item, lane, lanes: 0 });
    groupEnd = Math.max(groupEnd, end(item));
  }
  closeGroup();

  return placed;
}

const lanePosition = (lane: number, lanes: number) => ({
  left: `calc(${(lane / lanes) * 100}% + 2px)`,
  width: `calc(${100 / lanes}% - 4px)`,
});

function openHours(day: Date, workingHours: WorkingHours | null): [number, number][] {
  return (workingHours?.days.find((d) => d.dayOfWeek === getISODay(day))?.blocks ?? [])
    .map((block): [number, number] => [toMinutes(block.startsAt), toMinutes(block.endsAt)])
    .sort((a, b) => a[0] - b[0]);
}

/** A closed day is closed all day. With no working hours entered, nothing is set apart. */
function closedHours(day: Date, workingHours: WorkingHours | null): [number, number][] {
  if (workingHours === null) return [];

  const closed: [number, number][] = [];
  let from = 0;
  for (const [start, end] of openHours(day, workingHours)) {
    if (start > from) closed.push([from, start]);
    from = Math.max(from, end);
  }
  if (from < DAY_MINUTES) closed.push([from, DAY_MINUTES]);

  return closed;
}

/**
 * The hours the grid runs over: the working day and anything booked outside it, an hour either
 * side. A stretch running on from the day before, or into the next, does not pull it to midnight.
 */
function visibleHours(days: Date[], columns: Placed[][], workingHours: WorkingHours | null) {
  const edges = days.flatMap((day) => openHours(day, workingHours).flat());

  for (const item of columns.flat()) {
    if (item.kind === "appointment") {
      edges.push(item.from, item.to);
      continue;
    }
    // Midnight at either end is where the day cut it off, not where it starts or ends.
    if (item.from > 0) edges.push(item.from, Math.min(item.from + 60, DAY_MINUTES));
    if (item.to < DAY_MINUTES) edges.push(item.to, Math.max(item.to - 60, 0));
  }

  if (edges.length === 0) return { first: 8, last: 18 };

  return {
    first: Math.max(Math.floor(Math.min(...edges) / 60) - 1, 0),
    last: Math.min(Math.ceil(Math.max(...edges) / 60) + 1, 24),
  };
}
