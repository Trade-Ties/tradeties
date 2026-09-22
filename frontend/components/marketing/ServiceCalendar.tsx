"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  byDay,
  canGoBack,
  canGoForward,
  dayLabel,
  dayOf,
  daysOf,
  monthLabel,
  monthWindow,
  shiftMonth,
  spanLabel,
  timeLabel,
  weekdayOf,
} from "@/components/marketing/availability";
import { duration } from "@/components/marketing/business-format";
import { proPath } from "@/lib/routes";
import type { BusinessAvailability } from "@/lib/api/marketplace";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * One month of this business's openings for the chosen service.
 *
 * <p>The month is in the URL and paging it is a navigation, for the reason the service is: the
 * page is readable from its address alone. The chosen **time** deliberately is not — it is
 * fleeting, and the next slice makes it a field of a form rather than a place you can link to.
 *
 * <p><strong>Nothing drawn here is held.</strong> These are the starts that were free when the
 * page was rendered; the same slot stays on offer to everybody else until the tradesperson
 * accepts a request, which DECISIONS section 1 makes a rule rather than an accident.
 */
export function ServiceCalendar({
  slug,
  serviceId,
  serviceName,
  month,
  availability,
}: {
  slug: string;
  serviceId: string;
  serviceName: string;
  month: string;
  availability: BusinessAvailability;
}) {
  const router = useRouter();

  const { timeZone, appointmentMinutes, from, to, slots, slotsCapped } = availability;
  const days = byDay(slots ?? [], timeZone);

  // A window that closed before it opened, which the contract answers rather than refuses. It has
  // two causes and they are not the same news: a month wholly past the booking horizon, reachable
  // by editing the address, and a notice so long it outruns the horizon — no bookable day at all.
  const closed = to < from;
  const beyond = closed && monthWindow(month).from > to;

  const [pickedDay, setPickedDay] = useState<string | null>(() => days.keys().next().value ?? null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);

  const goTo = (target: string) => {
    router.push(`${proPath(slug)}?${new URLSearchParams({ service: serviceId, month: target })}`);
  };

  const pickDay = (day: string) => {
    setPickedDay(day);
    setPickedTime(null);
  };

  // No `closed` guard on either: both rules already answer a closed window correctly, and adding
  // one would strand somebody who reached a month past the horizon with a dead way back.
  const back = canGoBack(month, from);
  const forward = canGoForward(month, to);
  const times = pickedDay ? (days.get(pickedDay) ?? []) : [];

  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="m-0 text-[17px] font-bold tracking-[-0.02em] text-brand">{monthLabel(month)}</p>
          <p className="m-0 mt-0.5 text-[13px] text-muted-ink">
            {serviceName} · times are {timeZone}, the tradesperson&apos;s own clock
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5">
          <Page label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`} enabled={back} onClick={() => goTo(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Page>
          <Page label={`Next month, ${monthLabel(shiftMonth(month, 1))}`} enabled={forward} onClick={() => goTo(shiftMonth(month, 1))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Page>
        </div>
      </div>

      {closed ? (
        <p className="rounded-2xl border border-dashed border-line bg-canvas px-5 py-10 text-center text-[14.5px] text-muted-ink">
          {beyond
            ? `Their diary does not reach into ${monthLabel(month)} — they take bookings through ${dayLabel(to)}.`
            : "This business is not taking bookings at the moment — the notice they need reaches past how far ahead they fill their diary."}
        </p>
      ) : (
        <>
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: weekdayOf(`${month}-01`) }, (_, i) => (
              <div key={`lead-${i}`} aria-hidden="true" />
            ))}

            {daysOf(month).map((day) => {
              const open = days.get(day)?.length ?? 0;
              const number = Number(day.slice(-2));

              if (open === 0) {
                return (
                  <div key={day} className="py-2.5 text-center text-[14px] text-faint/60">
                    {number}
                  </div>
                );
              }

              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={day === pickedDay}
                  aria-label={`${dayLabel(day)}, ${open} opening${open === 1 ? "" : "s"}`}
                  onClick={() => pickDay(day)}
                  className={
                    day === pickedDay
                      ? "rounded-xl bg-brand py-2.5 text-center text-[14px] font-bold text-white"
                      : "rounded-xl border border-brand-100 bg-brand-50 py-2.5 text-center text-[14px] font-semibold text-brand transition-colors hover:border-brand"
                  }
                >
                  {number}
                </button>
              );
            })}
          </div>

          {slotsCapped && (
            <p className="mt-3 text-[13px] text-muted-ink">
              Later days this month were not read — what is shown is the earlier part of it.
            </p>
          )}

          {days.size === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-line bg-canvas px-5 py-10 text-center text-[14.5px] text-muted-ink">
              Nothing free in {monthLabel(month)} for {serviceName}.
              {forward && " Their diary may reach further — try the next month."}
            </p>
          ) : (
            <div className="mt-6 border-t border-line pt-5">
              <p className="m-0 text-[14.5px] font-semibold text-brand">
                {pickedDay ? dayLabel(pickedDay) : "Pick a day"}
              </p>

              {/*
                The length is stated before a time is picked, not only after. Starts are no longer
                cut back to those ending inside the working day, so the list alone does not hint at
                how long the work is — 11:30 looks exactly as free as 08:00.
              */}
              <p className="m-0 mb-3 mt-0.5 text-[13px] text-muted-ink">
                This job runs {duration(appointmentMinutes)} from whichever time you pick.
              </p>

              <div className="flex flex-wrap gap-2">
                {times.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={slot === pickedTime}
                    onClick={() => setPickedTime(slot)}
                    className={
                      slot === pickedTime
                        ? "rounded-full bg-brand px-3.5 py-2 text-[13.5px] font-semibold text-white"
                        : "rounded-full border border-line bg-white px-3.5 py-2 text-[13.5px] font-medium text-brand transition-colors hover:border-brand-100 hover:bg-brand-50"
                    }
                  >
                    {timeLabel(slot, timeZone)}
                  </button>
                ))}
              </div>

              {pickedTime && (
                <div className="mt-5 rounded-2xl bg-canvas p-5">
                  <p className="m-0 text-[14.5px] font-semibold text-brand">
                    {dayLabel(dayOf(pickedTime, timeZone))} ·{" "}
                    {spanLabel(pickedTime, appointmentMinutes, timeZone)}
                  </p>

                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full cursor-not-allowed rounded-2xl bg-brand/30 px-6 py-3 text-[15px] font-semibold text-white"
                  >
                    Request this appointment
                  </button>

                  <p className="m-0 mt-2.5 text-[13px] leading-relaxed text-muted-ink">
                    Requesting is not switched on yet, so this button does nothing. Nothing on this
                    page is held for you either — the same time stays on offer to everybody until
                    the tradesperson accepts a request for it.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A month step, disabled at the edge of the window the backend actually read rather than hidden.
 * A missing arrow reads as a broken control; a dimmed one reads as the end of the diary.
 */
function Page({
  label,
  enabled,
  onClick,
  children,
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={onClick}
      className={
        enabled
          ? "grid size-9 place-items-center rounded-full border border-line bg-white text-brand transition-colors hover:border-brand hover:bg-brand-50"
          : "grid size-9 cursor-not-allowed place-items-center rounded-full border border-line bg-white text-faint/50"
      }
    >
      {children}
    </button>
  );
}
