"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, CalendarIcon, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterPill } from "@/components/marketing/FilterPill";
import { ProCard, type ProCardSlot, type ProCardView } from "@/components/marketing/ProCard";
import {
  availabilityLabel,
  parseWhenParam,
  today,
  type AvailabilityFilter,
} from "@/components/marketing/when-filter";
import type { components } from "@/lib/api/schema";

type SearchResults = components["schemas"]["BusinessSearchResults"];
type SearchResult = components["schemas"]["BusinessSearchResult"];

/**
 * What the hero search bar leads to: the businesses whose own service area reaches this postal
 * code, nearest first.
 *
 * <p>The list comes from the server and the whole search lives in the URL, so editing it navigates
 * rather than filtering in place. That is not a smaller version of filtering — the search reads a
 * description, matches it to a trade and measures a radius, none of which a browser can redo over
 * the twenty rows it happens to be holding.
 *
 * The `when` answer is carried and shown, and it deliberately does not narrow the list. Each
 * business reports its next three openings, which is not its calendar: a business free on Tuesday
 * may well have its next three on Monday, so hiding it from a Tuesday filter would be a claim the
 * data cannot make. The customer's answer travels to the profile, where the day is chosen against
 * the whole diary.
 */
export function JobSearchResults({
  job,
  zip,
  when,
  found,
}: {
  job: string;
  zip: string;
  when: string;
  found: SearchResults;
}) {
  const router = useRouter();

  const asked = parseWhenParam(when);
  const whenLabel = availabilityLabel(asked.availability, asked.customDate);

  const results = found.results ?? [];
  const trades = found.matchedTrades ?? [];

  // Drafts only. What is displayed is what the URL says, so there is no second copy of the search
  // to fall out of step with it — cancelling is dropping the draft, not restoring a snapshot.
  const [editing, setEditing] = useState(false);
  const [jobDraft, setJobDraft] = useState(job);
  const [zipDraft, setZipDraft] = useState(zip);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityFilter>(asked.availability);
  const [customDateDraft, setCustomDateDraft] = useState<Date | undefined>(asked.customDate);
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);

  const startEditing = () => {
    setJobDraft(job);
    setZipDraft(zip);
    setAvailabilityDraft(asked.availability);
    setCustomDateDraft(asked.customDate);
    setEditing(true);
  };

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (zipDraft.length !== 5) return;

    const params = new URLSearchParams({ zip: zipDraft });
    if (jobDraft.trim()) params.set("job", jobDraft.trim());

    const answer = whenParam(availabilityDraft, customDateDraft);
    if (answer) params.set("when", answer);

    setEditing(false);
    router.push(`/browse?${params}`);
  };

  const pickPresetAvailabilityDraft = (option: Exclude<AvailabilityFilter, "any" | "date">) => {
    setAvailabilityDraft((prev) => (prev === option ? "any" : option));
    setCustomDateDraft(undefined);
    setDateCalendarOpen(false);
  };

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
          {/*
            KNOWN WRONG, until the pager lands. This counts `results`, and `results` is one page
            — so a search that found 26 tradespeople announces 24 of them. `found.total` is the
            number this sentence means, and `found.totalCapped` says whether to print it as
            "240" or "240+"; the API started sending both when paging was added.

            Not fixed here on purpose. A truthful count with no way to reach the rest is the
            worse of the two states: "26 professionals" above 24 cards invites the reader to
            look for two that are nowhere on the page. The heading and the pager are one change,
            and this comment is here so the first is not made without the second.

            The same count is repeated further down, above the grid.
          */}
          <h1 className="mb-1.5 text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.03em]">
            {results.length === 0
              ? `No one travels to ${zip} yet`
              : `${results.length} professional${results.length === 1 ? "" : "s"} near ${zip}`}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] text-muted-ink">
            {job && <span>{job}</span>}
            {job && <span className="text-[#CBD6E2]">•</span>}
            <span>{zip}</span>
            <span className="text-[#CBD6E2]">•</span>
            <Badge className="h-auto border-transparent bg-brand-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-brand-500">
              {whenLabel}
            </Badge>
          </div>

          {job && <Understood job={job} trades={trades} />}
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
                <form onSubmit={runSearch}>
                  <div className="mb-3">
                    <Label
                      htmlFor="job-draft"
                      className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-faint"
                    >
                      What&apos;s wrong?
                    </Label>
                    <Input
                      id="job-draft"
                      value={jobDraft}
                      onChange={(e) => setJobDraft(e.target.value)}
                      maxLength={300}
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
                      value={zipDraft}
                      onChange={(e) => setZipDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
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
                            type="button"
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
                    <Button
                      type="submit"
                      disabled={zipDraft.length !== 5}
                      className="h-auto flex-1 rounded-full py-2.5 text-[14px] font-semibold"
                    >
                      Search again
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditing(false)}
                      className="h-auto flex-1 rounded-full border-line py-2.5 text-[14px] font-semibold text-brand"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="mb-4 text-[15px] font-semibold leading-snug text-brand">
                    {job || "No job description given"}
                  </p>

                  <div className="mb-2 flex items-center gap-2 text-[13.5px] text-muted-ink">
                    <MapPin className="size-4 shrink-0" />
                    {zip}
                  </div>
                  <div className="mb-5 flex items-center gap-2 text-[13.5px] text-muted-ink">
                    <CalendarDays className="size-4 shrink-0" />
                    {whenLabel}
                  </div>

                  <Button
                    type="button"
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
                  {/*
                    The second of the two page-counts named in the heading's comment above, and
                    the more misleading of them: "whose area reaches you" is a claim about the
                    whole search, and this counts one page of it. Both move to `found.total`
                    together with the pager.
                  */}
                  <p className="m-0 text-[15px] font-bold text-brand">
                    {results.length} professional{results.length === 1 ? "" : "s"} whose area reaches you
                  </p>
                  <p className="m-0 text-[13px] text-muted-ink">
                    Nearest first. Each card shows that business&apos;s next openings.
                  </p>
                </div>
              </div>
            </div>

            {results.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
                {trades.length > 0 ? (
                  <>
                    Nobody offering {trades.map((t) => t.displayName).join(" or ")} travels to {zip} yet.{" "}
                    <Link
                      href={`/browse?zip=${zip}`}
                      className="font-semibold text-brand-500 hover:underline"
                    >
                      Search without a description
                    </Link>{" "}
                    to see everyone who does.
                  </>
                ) : (
                  <>
                    No tradesperson travels to {zip} yet. The marketplace is new — this is a gap in who
                    has signed up, not in what you asked.
                  </>
                )}
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,260px)] items-start gap-5">
                {results.map((result) => (
                  <ProCard key={result.slug} view={viewOf(result)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * What the description was read as, in plain words rather than as buttons.
 *
 * Not clickable on purpose. Narrowing to one of several would mean asking the search for a trade,
 * and the contract takes a description — so a chip that looked pressable would either do nothing
 * or quietly run a different search. Saying what happened is honest; the choice becomes a choice
 * when the API can take one.
 */
function Understood({ job, trades }: { job: string; trades: NonNullable<SearchResults["matchedTrades"]> }) {
  if (trades.length === 0) {
    return (
      <p className="mt-2 text-[14.5px] text-muted-ink">
        We could not tell which trade <span className="text-brand">“{job}”</span> needs, so this is
        everyone who travels to you.
      </p>
    );
  }

  return (
    <p className="mt-2 text-[14.5px] text-muted-ink">
      <span className="text-brand">“{job}”</span> read as{" "}
      <span className="font-medium text-brand">{trades.map((t) => t.displayName).join(" · ")}</span>
      {trades.length > 1 ? " — the description fits more than one, so all of them are shown." : null}
    </p>
  );
}

/**
 * The inverse of what the hero search bar sends, so a search edited here leaves the same kind of
 * URL as one started there — and null where there is nothing to say, rather than a parameter
 * meaning "no preference" that the reader of the URL has to know to ignore.
 */
function whenParam(availability: AvailabilityFilter, customDate: Date | undefined): string | null {
  switch (availability) {
    case "today":
      return "today";
    case "tomorrow":
      return "tomorrow";
    case "week":
      return "flexible";
    case "date":
      return customDate ? format(customDate, "yyyy-MM-dd") : null;
    default:
      return null;
  }
}

/** One search result in the card's own terms, with nothing invented to fill a gap. */
function viewOf(result: SearchResult): ProCardView {
  const badges: string[] = [];
  if (result.licensed) badges.push("Licensed");
  if (result.licenseVerified) badges.push("Licence verified");

  return {
    initials: initialsOf(result.displayName),
    color: colorOf(result.slug),
    title: result.displayName,
    subtitle: `${result.city}, ${result.state}`,
    trade: result.primaryTrade ?? undefined,
    distance: miles(result.distanceMiles),
    rateFrom: result.hourlyRate ? rate(result.hourlyRate) : undefined,
    badges,
    slots: (result.nextSlots ?? []).map((slot) => opening(slot, result.timeZone)),
    // Nothing can accept a booking yet, so the times are shown as what they are.
    bookable: false,
  };
}

/**
 * One opening, printed on the tradesperson's own clock.
 *
 * The zone comes from the business, never from the reader: the working day being described is the
 * tradesperson's, and a customer reading it in their own zone would be told an hour nobody agreed
 * to. It is also what makes this deterministic — the server pass and the browser format the same
 * instant against the same zone, so the label survives hydration instead of being rewritten.
 *
 * The weekday is always shown. Deriving "today" would mean reading a clock, and a clock read once
 * on the server and again in the browser is the nondeterminism this exists to avoid — for a badge
 * that a day of required notice makes almost unreachable anyway.
 */
function opening(instant: string, timeZone: string): ProCardSlot {
  const at = new Date(instant);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);

  return { key: instant, label, today: false };
}

/**
 * Whole miles, and "under a mile" below one.
 *
 * A decimal place would be a lie about a number measured between two postal-code centres: honest
 * enough to order a list by, not honest enough to print as 3.4.
 */
function miles(distance: number): string {
  return distance < 1 ? "under a mile" : `${Math.round(distance)} mi`;
}

/** The wire carries four decimal places because money is stored that way; nobody reads $85.0000. */
function rate(amount: string): string {
  const value = Number(amount);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function initialsOf(displayName: string): string {
  const words = displayName.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
}

/**
 * A colour per business, derived from the slug rather than stored.
 *
 * Deterministic on purpose: the same business is the same colour on every render and on both
 * sides of hydration, and a marketplace that has never asked anybody for a brand colour has none
 * to show.
 */
const AVATAR_COLORS = ["#1E4E82", "#0E9F6E", "#B4530A", "#0A2F5C", "#6D3FA8", "#B91C1C", "#CA8A04", "#C2410C"];

function colorOf(slug: string): string {
  const sum = [...slug].reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]!;
}
