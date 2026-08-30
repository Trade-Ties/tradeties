"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, CalendarIcon, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterPill } from "@/components/marketing/FilterPill";
import { ProCard } from "@/components/marketing/ProCard";
import { PROS } from "@/components/marketing/pros-data";
import {
  availabilityLabel,
  dateMatchesAvailability,
  parseWhenParam,
  slotTimeBucket,
  today,
  type AvailabilityFilter,
  type TimeBucket,
} from "@/components/marketing/when-filter";

const TIME_OPTIONS: { value: TimeBucket; label: string; hint?: string }[] = [
  { value: "all", label: "All times" },
  { value: "morning", label: "Morning", hint: "Before 12 PM" },
  { value: "afternoon", label: "Afternoon", hint: "12 PM – 5 PM" },
  { value: "evening", label: "Evening", hint: "After 5 PM" },
];

export function JobSearchResults({ job, zip, when }: { job: string; zip: string; when: string }) {
  const initialWhen = parseWhenParam(when);

  // "Committed" values — what's actually displayed and filtered by.
  const [displayJob, setDisplayJob] = useState(job);
  const [displayZip, setDisplayZip] = useState(zip);
  const [availability, setAvailability] = useState<AvailabilityFilter>(initialWhen.availability);
  const [customDate, setCustomDate] = useState<Date | undefined>(initialWhen.customDate);
  const whenLabel = availabilityLabel(availability, customDate);

  const [timeFilter, setTimeFilter] = useState<TimeBucket>("all");

  // "Your job" edit mode. The job/ZIP inputs below are bound straight to
  // displayJob/displayZip — the same state the card shows when not
  // editing — rather than a separate draft that gets seeded from it each
  // time editing opens: one state variable for "what's shown" can't ever
  // render blank when edit mode mounts, whereas a copy-on-open draft is
  // exactly the kind of extra synchronization step that goes stale. Only
  // "When" still uses a draft, since picking a day should preview in the
  // form without immediately re-filtering the results underneath until
  // "Save changes" is pressed. "Cancel" reverts job/ZIP from a snapshot
  // taken when editing opened, so it still discards those too.
  const [editing, setEditing] = useState(false);
  const [jobSnapshot, setJobSnapshot] = useState(job);
  const [zipSnapshot, setZipSnapshot] = useState(zip);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityFilter>(initialWhen.availability);
  const [customDateDraft, setCustomDateDraft] = useState<Date | undefined>(initialWhen.customDate);
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);

  const startEditing = () => {
    setJobSnapshot(displayJob);
    setZipSnapshot(displayZip);
    setAvailabilityDraft(availability);
    setCustomDateDraft(customDate);
    setEditing(true);
  };

  const saveEdits = () => {
    setDisplayJob((v) => v.trim());
    setDisplayZip((v) => v.trim());
    setAvailability(availabilityDraft);
    setCustomDate(customDateDraft);
    setEditing(false);
  };

  const cancelEdits = () => {
    setDisplayJob(jobSnapshot);
    setDisplayZip(zipSnapshot);
    setEditing(false);
  };

  const pickPresetAvailabilityDraft = (option: Exclude<AvailabilityFilter, "any" | "date">) => {
    setAvailabilityDraft((prev) => (prev === option ? "any" : option));
    setCustomDateDraft(undefined);
    setDateCalendarOpen(false);
  };

  const filtered = useMemo(() => {
    return PROS.filter((p) =>
      p.slots.some(
        (s) =>
          dateMatchesAvailability(s.date, availability, customDate) &&
          (timeFilter === "all" || slotTimeBucket(s.time) === timeFilter)
      )
    );
  }, [availability, customDate, timeFilter]);

  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[1180px] px-6">
        <Button
          variant="link"
          render={<Link href="/" />}
          nativeButton={false}
          className="mb-6 h-auto gap-1.5 p-0 text-[14px] font-semibold text-brand-500"
        >
          <ArrowLeft className="size-4" />
          Back to search
        </Button>

        <div className="mb-8">
          <h1 className="mb-1.5 text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.03em]">
            Available professionals for your job
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] text-muted-ink">
            {displayJob && <span>{displayJob}</span>}
            {displayJob && displayZip && <span className="text-[#CBD6E2]">•</span>}
            {displayZip && <span>{displayZip}</span>}
            {(displayJob || displayZip) && <span className="text-[#CBD6E2]">•</span>}
            <Badge className="h-auto border-transparent bg-brand-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-brand-500">
              {whenLabel}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 min-[960px]:grid-cols-[280px_1fr]">
          {/*
            Same shape as /browse's sidebar fix: an unconstrained outer grid
            item so it can stretch to match the (usually taller) results
            column without that stretch reaching the actual card's visual
            box, which is sized to its own content instead.
          */}
          <div>
            <div className="sticky top-[92px] rounded-3xl border border-line bg-white p-5">
              <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.04em] text-faint">Your job</h2>

              {editing ? (
                <div>
                  <div className="mb-3">
                    <Label
                      htmlFor="job-draft"
                      className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-faint"
                    >
                      What&apos;s wrong?
                    </Label>
                    <Input
                      id="job-draft"
                      value={displayJob}
                      onChange={(e) => setDisplayJob(e.target.value)}
                      placeholder="Describe the job"
                    />
                  </div>

                  <div className="mb-3">
                    <Label
                      htmlFor="zip-draft"
                      className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-faint"
                    >
                      ZIP code
                    </Label>
                    <Input
                      id="zip-draft"
                      value={displayZip}
                      onChange={(e) => setDisplayZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="80202"
                    />
                  </div>

                  <div className="mb-4">
                    <Label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
                      When
                    </Label>
                    <div className="mb-2 flex flex-wrap gap-1">
                      <FilterPill active={availabilityDraft === "today"} onClick={() => pickPresetAvailabilityDraft("today")}>
                        Today
                      </FilterPill>
                      <FilterPill
                        active={availabilityDraft === "tomorrow"}
                        onClick={() => pickPresetAvailabilityDraft("tomorrow")}
                      >
                        Tomorrow
                      </FilterPill>
                      <FilterPill active={availabilityDraft === "week"} onClick={() => pickPresetAvailabilityDraft("week")}>
                        This week
                      </FilterPill>
                    </div>
                    <Popover open={dateCalendarOpen} onOpenChange={setDateCalendarOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            variant="outline"
                            className={
                              availabilityDraft === "date"
                                ? "w-full justify-between border-brand bg-brand-50 px-2.5 text-[13.5px] font-medium text-brand"
                                : "w-full justify-between border-line px-2.5 text-[13.5px] font-medium text-muted-ink"
                            }
                          />
                        }
                      >
                        <span>
                          {availabilityDraft === "date" && customDateDraft
                            ? format(customDateDraft, "EEE, MMM d")
                            : "Select a date"}
                        </span>
                        <CalendarIcon className="size-4 shrink-0" />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto rounded-2xl border border-line bg-white p-2 shadow-lift ring-0">
                        <Calendar
                          mode="single"
                          selected={customDateDraft}
                          defaultMonth={customDateDraft ?? today}
                          onSelect={(d) => {
                            if (!d) return;
                            setCustomDateDraft(d);
                            setAvailabilityDraft("date");
                            setDateCalendarOpen(false);
                          }}
                          disabled={{ before: today }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEdits} className="h-auto flex-1 rounded-full py-2.5 text-[14px] font-semibold">
                      Save changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEdits}
                      className="h-auto flex-1 rounded-full border-line py-2.5 text-[14px] font-semibold text-brand"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-[15px] font-semibold leading-snug text-brand">
                    {displayJob || "No job description given"}
                  </p>

                  <div className="mb-2 flex items-center gap-2 text-[13.5px] text-muted-ink">
                    <MapPin className="size-4 shrink-0" />
                    {displayZip || "No ZIP given"}
                  </div>
                  <div className="mb-5 flex items-center gap-2 text-[13.5px] text-muted-ink">
                    <CalendarDays className="size-4 shrink-0" />
                    {whenLabel}
                  </div>

                  <Button
                    variant="outline"
                    onClick={startEditing}
                    className="h-auto w-full rounded-full border-line py-2.5 text-[14px] font-semibold text-brand"
                  >
                    Edit search
                  </Button>

                  <div className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted-ink">
                    Need more filters?{" "}
                    <Link href="/browse" className="font-semibold text-brand-500 hover:underline">
                      Browse all professionals
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="self-start">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-canvas px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-go-bg">
                  <CalendarDays className="size-5 text-go" />
                </div>
                <div>
                  <p className="m-0 text-[15px] font-bold text-brand">
                    {filtered.length} professional{filtered.length === 1 ? "" : "s"} available
                    {whenLabel !== "Any time" && ` ${whenLabel.toLowerCase()}`}
                  </p>
                  <p className="m-0 text-[13px] text-muted-ink">Book in minutes and lock in your slot.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIME_OPTIONS.map((o) => (
                  <FilterPill key={o.value} active={timeFilter === o.value} onClick={() => setTimeFilter(o.value)}>
                    {o.label}
                    {o.hint && <span className="ml-1 font-normal opacity-70">{o.hint}</span>}
                  </FilterPill>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
                No professionals match right now.{" "}
                <button
                  type="button"
                  onClick={() => setTimeFilter("all")}
                  className="font-semibold text-brand-500 hover:underline"
                >
                  Clear time filter
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,260px)] items-start gap-5">
                {filtered.map((p) => (
                  <ProCard key={p.name} pro={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
