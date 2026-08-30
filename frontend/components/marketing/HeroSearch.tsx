"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { CalendarIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_JOB_SUGGESTIONS } from "@/components/marketing/job-suggestions";

// Computed at render time (client-only component) so this always reflects the
// visitor's own local date rather than a hardcoded or server-clock value.
const today = new Date(new Date().setHours(0, 0, 0, 0));
const tomorrow = addDays(today, 1);

type WhenMode = "today" | "tomorrow" | "flexible" | "custom";

const WHEN_OPTIONS: { mode: Exclude<WhenMode, "custom">; label: string; sublabel: string }[] = [
  { mode: "today", label: "Today", sublabel: format(today, "EEE, MMM d") },
  { mode: "tomorrow", label: "Tomorrow", sublabel: format(tomorrow, "EEE, MMM d") },
  { mode: "flexible", label: "I'm flexible", sublabel: "Any day works" },
];

export function HeroSearch() {
  const router = useRouter();
  const [job, setJob] = useState("");
  const [zip, setZip] = useState("");

  const [whenMode, setWhenMode] = useState<WhenMode>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [whenOpen, setWhenOpen] = useState(false);
  const [whenView, setWhenView] = useState<"options" | "calendar">("options");

  const whenLabel =
    whenMode === "today"
      ? "Today"
      : whenMode === "tomorrow"
        ? "Tomorrow"
        : whenMode === "flexible"
          ? "I'm flexible"
          : customDate
            ? format(customDate, "EEE, MMM d")
            : "Choose a date";

  const selectWhen = (mode: Exclude<WhenMode, "custom">) => {
    setWhenMode(mode);
    setWhenOpen(false);
  };

  /**
   * The ZIP is the only field the search cannot do without, and it is checked here rather than
   * left to the server: a round trip to be told "five digits, please" is a worse answer than the
   * field simply not submitting.
   *
   * `when` travels in the URL and is not sent to the search. Availability is a property of a slot,
   * not of a business, and slots are chosen on the profile — so this carries the customer's answer
   * forward to where it is asked again, instead of pretending the list was filtered by it.
   */
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    if (zip.length !== 5) return;

    const params = new URLSearchParams({ zip });
    if (job.trim()) params.set("job", job.trim());
    params.set("when", whenMode === "custom" && customDate ? format(customDate, "yyyy-MM-dd") : whenMode);

    router.push(`/search?${params}`);
  };

  return (
    <>
      <form onSubmit={search} className="animate-tt-rise ml-0 grid max-w-[980px] grid-cols-1 items-center gap-1.5 rounded-3xl border border-line bg-white p-2.5 shadow-lift [animation-delay:200ms] min-[880px]:grid-cols-[2.1fr_1fr_1.15fr_auto] min-[880px]:gap-1 min-[880px]:p-2">
        <div className="min-w-0 rounded-2xl px-[18px] py-2.5 transition-colors focus-within:bg-brand-50">
          <Label
            htmlFor="job"
            className="mb-0.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint"
          >
            What&apos;s wrong?
          </Label>
          <Input
            id="job"
            type="text"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            maxLength={300}
            placeholder={DEFAULT_JOB_SUGGESTIONS.placeholder}
            className="h-auto w-full border-0 bg-transparent p-0 text-[15.5px] font-medium text-brand shadow-none outline-none placeholder:font-normal placeholder:text-faint focus-visible:ring-0"
          />
        </div>

        <div className="min-w-0 rounded-2xl px-[18px] py-2.5 transition-colors focus-within:bg-brand-50 min-[880px]:shadow-[inset_1px_0_0_var(--color-line)] min-[880px]:focus-within:shadow-none">
          <Label
            htmlFor="zip"
            className="mb-0.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint"
          >
            ZIP code
          </Label>
          <Input
            id="zip"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            placeholder="80202"
            className="h-auto w-full border-0 bg-transparent p-0 text-[15.5px] font-medium text-brand shadow-none outline-none placeholder:font-normal placeholder:text-faint focus-visible:ring-0"
          />
        </div>

        <div className="min-w-0 rounded-2xl px-[18px] py-2.5 transition-colors focus-within:bg-brand-50 min-[880px]:shadow-[inset_1px_0_0_var(--color-line)] min-[880px]:focus-within:shadow-none">
          <Label
            htmlFor="when-trigger"
            className="mb-0.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint"
          >
            When
          </Label>
          <Popover
            open={whenOpen}
            onOpenChange={(open) => {
              setWhenOpen(open);
              if (!open) setWhenView("options");
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  id="when-trigger"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-1.5 border-0 bg-transparent p-0 text-[15.5px] font-medium text-brand hover:bg-transparent"
                />
              }
            >
              <CalendarIcon className="size-4 shrink-0 text-faint" />
              {whenLabel}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[250px] rounded-2xl border border-line bg-white p-2 shadow-lift ring-0"
            >
              {whenView === "options" ? (
                <div className="flex flex-col gap-0.5">
                  {WHEN_OPTIONS.map((o) => {
                    const active = whenMode === o.mode;
                    return (
                      <button
                        key={o.mode}
                        type="button"
                        onClick={() => selectWhen(o.mode)}
                        className={
                          active
                            ? "flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left"
                            : "flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50"
                        }
                      >
                        <span>
                          <span className="block text-[14.5px] font-semibold text-brand">{o.label}</span>
                          <span className="block text-[12px] text-faint">{o.sublabel}</span>
                        </span>
                        {active && <Check className="size-4 shrink-0 text-brand-500" />}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setWhenView("calendar")}
                    className={
                      whenMode === "custom"
                        ? "flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left"
                        : "flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50"
                    }
                  >
                    <span>
                      <span className="block text-[14.5px] font-semibold text-brand">Choose a date</span>
                      <span className="block text-[12px] text-faint">
                        {whenMode === "custom" && customDate ? format(customDate, "EEE, MMM d, yyyy") : "Pick an exact day"}
                      </span>
                    </span>
                    {whenMode === "custom" ? (
                      <Check className="size-4 shrink-0 text-brand-500" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-faint" />
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setWhenView("options")}
                    className="mb-1 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-ink transition-colors hover:bg-brand-50 hover:text-brand"
                  >
                    <ChevronLeft className="size-3.5" />
                    Back
                  </button>
                  <Calendar
                    mode="single"
                    selected={customDate}
                    defaultMonth={customDate ?? today}
                    onSelect={(d) => {
                      if (!d) return;
                      setCustomDate(d);
                      setWhenMode("custom");
                      setWhenOpen(false);
                    }}
                    disabled={{ before: today }}
                    autoFocus
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <Button
          type="submit"
          disabled={zip.length !== 5}
          className="h-auto whitespace-nowrap rounded-2xl px-7 py-4 text-[15.5px] font-semibold"
        >
          See who&apos;s free
        </Button>
      </form>

      <div className="animate-tt-rise mt-[22px] flex flex-wrap items-center gap-2 [animation-delay:280ms]">
        <span className="mr-1 text-[13.5px] text-faint">Common jobs</span>
        {DEFAULT_JOB_SUGGESTIONS.jobs.map((label) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            onClick={() => setJob(label)}
            className="h-auto rounded-full border-line px-[15px] py-[7px] text-[13.5px] font-medium text-muted-ink hover:border-brand-100 hover:bg-brand-50 hover:text-brand"
          >
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}
