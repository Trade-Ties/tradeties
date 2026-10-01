"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  CalendarIcon,
  ChevronDown,
  ListChecks,
  MapPin,
  RotateCcw,
  Search,
  Wrench,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/marketing/FilterPill";
import { LicensedOnly } from "@/components/marketing/LicensedOnly";
import { BookingModal } from "@/components/marketing/BookingModal";
import { ProCard, type ProCardSlot, type ProCardView } from "@/components/marketing/ProCard";
import { viewOf } from "@/components/marketing/JobSearchResults";
import { TRADE_ICONS } from "@/components/marketing/pros-data";
import { browseBusinesses, type Browsed } from "@/components/marketing/browse-actions";
import { parseWhenParam, today, type AvailabilityFilter } from "@/components/marketing/when-filter";
import { SORT_OPTIONS, sortResults } from "@/components/marketing/sort-results";
import { rememberZip } from "@/lib/zip-memory";



const MAX_RADIUS = 100;

/**
 * The availability filter in the search's words, or null for "any time". The search answers it
 * against each business's whole calendar, which the six times on a card could not.
 */
function whenOf(availability: AvailabilityFilter, customDate: Date | undefined): string | null {
  switch (availability) {
    case "today":
    case "tomorrow":
    case "week":
      return availability;
    case "date":
      return customDate ? format(customDate, "yyyy-MM-dd") : null;
    default:
      return null;
  }
}

function FilterLabel({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-brand">
      <Icon className="size-4 text-muted-ink" />
      {children}
    </div>
  );
}

/**
 * Every professional who reaches a ZIP code, with the filters in the browser.
 *
 * <p>The list is the real search's — every page of it, fetched for the ZIP in the filters and
 * fetched again when that ZIP or the availability changes. The other filters and the sort run over
 * it here, instantly.
 */
export function BrowseProfessionals({ initialZip }: { initialZip: string }) {
  // Carried over from the hero search bar's "See who's free" — only ever
  // read to seed initial state below, not kept in sync afterward, same as
  // any other bookmarkable-URL-as-starting-point page.
  const searchParams = useSearchParams();
  const job = searchParams.get("job") ?? "";
  const initialWhen = parseWhenParam(searchParams.get("when"));

  const [companySearch, setCompanySearch] = useState("");
  const [zip, setZip] = useState(searchParams.get("zip") || initialZip);
  // The same dialogue the homepage rail opens, so a time does the same thing wherever a card is.
  const [booking, setBooking] = useState<{ view: ProCardView; slot?: ProCardSlot } | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [radius, setRadius] = useState(MAX_RADIUS);
  const [trades, setTrades] = useState<string[]>([]);
  const [tradeMenuOpen, setTradeMenuOpen] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [priceFloor, setPriceFloor] = useState(0);
  // Null for no upper limit, so the top of the range follows the dearest business in the list.
  const [priceCap, setPriceCap] = useState<number | null>(null);
  const [availability, setAvailability] = useState<AvailabilityFilter>(initialWhen.availability);
  const [customDate, setCustomDate] = useState<Date | undefined>(initialWhen.customDate);
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);
  const [sort, setSort] = useState("recommended");

  // The list for this ZIP and window. Keyed by what was asked, so a reply that arrives after the
  // question changed is told apart from the current one rather than shown under it.
  const when = whenOf(availability, customDate);
  const asked = zip.length === 5 ? `${zip}|${when ?? ""}` : null;
  const [found, setFound] = useState<{ asked: string; answer: Browsed } | null>(null);

  useEffect(() => {
    if (!asked) return;
    let live = true;
    browseBusinesses(zip, when).then((answer) => {
      if (!live) return;
      setFound({ asked, answer });
      if (answer.ok) rememberZip(zip);
    });
    return () => {
      live = false;
    };
  }, [asked, zip, when]);

  const loading = asked !== null && found?.asked !== asked;
  const answer = !loading && asked !== null ? found?.answer : undefined;
  const all = useMemo(() => (answer?.ok ? answer.results : []), [answer]);

  // The trades and services actually in the list, so no filter offers something that finds nobody.
  const tradeList = useMemo(
    () => Array.from(new Set(all.flatMap((r) => (r.primaryTrade ? [r.primaryTrade] : [])))).sort((a, b) => a.localeCompare(b)),
    [all]
  );
  const maxRate = Math.ceil(Math.max(0, ...all.flatMap((r) => (r.hourlyRate ? [Number(r.hourlyRate)] : []))));
  const priceTop = priceCap === null ? maxRate : Math.min(priceCap, maxRate);
  const priceBottom = Math.min(priceFloor, priceTop);
  const priceNarrowed = priceBottom > 0 || priceTop < maxRate;

  const toggleTrade = (trade: string, checked: boolean) => {
    setTrades((prev) => (checked ? [...prev, trade] : prev.filter((t) => t !== trade)));
    // Closes on every pick, not just the first — picking a second trade
    // means reopening the dropdown, which is the tradeoff of closing it
    // immediately rather than leaving it open for a multi-pick session.
    setTradeMenuOpen(false);
  };

  // Only meaningful once a trade is picked (the Service filter itself is
  // hidden until then) — narrowed to whichever trade(s) are selected.
  const availableServices = useMemo(() => {
    const set = new Set<string>();
    all.filter((r) => r.primaryTrade && trades.includes(r.primaryTrade)).forEach((r) => r.services.forEach((s) => set.add(s)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all, trades]);

  const toggleService = (svc: string, checked: boolean) => {
    setServices((prev) => (checked ? [...prev, svc] : prev.filter((s) => s !== svc)));
  };

  // Derived, not synced via an effect: a trade change can make some picked
  // services no longer offered under it, so drop those from filtering and
  // display until they're valid again — the raw selection stays in
  // `services` and reapplies on its own if a matching trade comes back.
  const effectiveServices = services.filter((s) => availableServices.includes(s));

  const pickPresetAvailability = (option: Exclude<AvailabilityFilter, "any" | "date">) => {
    setAvailability((prev) => (prev === option ? "any" : option));
    setCustomDate(undefined);
    setDateCalendarOpen(false);
  };

  const resetFilters = () => {
    setLicensedOnly(false);
    setCompanySearch("");
    setRadius(MAX_RADIUS);
    setTrades([]);
    setServices([]);
    setPriceFloor(0);
    setPriceCap(null);
    setAvailability("any");
    setCustomDate(undefined);
    setDateCalendarOpen(false);
  };

  const hasActiveFilters =
    licensedOnly ||
    companySearch.trim() !== "" ||
    radius < MAX_RADIUS ||
    trades.length > 0 ||
    effectiveServices.length > 0 ||
    priceNarrowed ||
    availability !== "any";

  const filtered = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const results = all.filter((r) => {
      if (query && !r.displayName.toLowerCase().includes(query)) return false;
      if (r.distanceMiles > radius) return false;
      if (trades.length > 0 && !(r.primaryTrade && trades.includes(r.primaryTrade))) return false;
      if (effectiveServices.length > 0 && !effectiveServices.some((s) => r.services.includes(s))) return false;
      if (licensedOnly && !r.licensed) return false;
      // No rate on file cannot be said to fall inside a range, so a narrowed one leaves it out.
      if (priceNarrowed && (!r.hourlyRate || Number(r.hourlyRate) < priceBottom || Number(r.hourlyRate) > priceTop))
        return false;
      // Asked about a day, the search said who has a time in it.
      if (r.freeInWindow === false) return false;
      return true;
    });

    return sortResults(results, sort);
  }, [all, licensedOnly, companySearch, radius, trades, effectiveServices, priceNarrowed, priceBottom, priceTop, sort]);

  return (
    <section className="pb-20 pt-10">
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

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="mb-1.5 text-[clamp(26px,3.2vw,34px)] font-extrabold tracking-[-0.03em]">
              Browse professionals{zip ? ` near ${zip}` : ""}
            </h1>
            <p className="text-[14.5px] text-muted-ink">
              {loading
                ? "Finding professionals…"
                : `${filtered.length} ${filtered.length === 1 ? "professional matches" : "professionals match"} your filters.`}
              {job && (
                <>
                  {" "}
                  Showing results for &ldquo;<span className="font-medium text-brand">{job}</span>&rdquo;.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[13.5px] font-medium text-muted-ink">Sort by</Label>
            <Select items={SORT_OPTIONS} value={sort} onValueChange={(v) => setSort(v ?? "recommended")}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 min-[960px]:grid-cols-[280px_1fr]">
          {/*
            This outer div is the grid item — it stretches to match the
            results column's (usually much taller) height, same as the
            page-level sticky fix. The actual filter panel is the div
            inside it: sticky within that tall containing block, but
            sized to its own content so it doesn't visually stretch into
            one giant mostly-empty box.
          */}
          <div>
            <div className="sticky top-[92px] rounded-3xl border border-line bg-white p-5">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[15px] font-bold">Filters</h2>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
                  >
                    <RotateCcw className="size-3.5" />
                    Clear all
                  </button>
                )}
              </div>

              {/* Company search */}
              <div className="mb-6">
                <FilterLabel icon={Search}>Search</FilterLabel>
                <Input
                  aria-label="Search by company name"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Company name"
                  className="border-line"
                />
              </div>

              {/* Location + radius */}
              <div className="mb-6">
                <FilterLabel icon={MapPin}>Location</FilterLabel>
                <Input
                  aria-label="ZIP code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  placeholder="ZIP code"
                  className="mb-3 border-line"
                />
                <p className="mb-1.5 text-[13px] text-muted-ink">Within {radius} mi</p>
                <Slider
                  value={[radius]}
                  onValueChange={(v) => setRadius(Array.isArray(v) ? v[0] : v)}
                  min={0}
                  max={MAX_RADIUS}
                  step={1}
                />
              </div>

              {/* Trade — compact dropdown */}
              <div className="mb-6">
                <FilterLabel icon={Wrench}>Trade</FilterLabel>
                <Popover open={tradeMenuOpen} onOpenChange={setTradeMenuOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full justify-between border-line px-2.5 text-[14px] font-medium text-brand"
                      />
                    }
                  >
                    <span>{trades.length === 0 ? "All trades" : `${trades.length} selected`}</span>
                    <ChevronDown className="size-4 text-muted-ink" />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[240px] rounded-2xl border border-line bg-white p-2 shadow-lift ring-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      {tradeList.map((t) => {
                        const Icon = TRADE_ICONS[t] ?? Wrench;
                        return (
                          <label
                            key={t}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium text-brand hover:bg-brand-50"
                          >
                            <Checkbox
                              checked={trades.includes(t)}
                              onCheckedChange={(checked) => toggleTrade(t, checked === true)}
                            />
                            <Icon className="size-4 text-muted-ink" />
                            {t}
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Service — only makes sense once a trade narrows what's on offer.
                  Multi-select like Trade, but doesn't auto-close on pick: you're
                  usually after more than one specific service at a time. */}
              {trades.length > 0 && (
                <div className="mb-6">
                  <FilterLabel icon={ListChecks}>Service</FilterLabel>
                  <Popover open={serviceMenuOpen} onOpenChange={setServiceMenuOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full justify-between border-line px-2.5 text-[14px] font-medium text-brand"
                        />
                      }
                    >
                      <span>{effectiveServices.length === 0 ? "All services" : `${effectiveServices.length} selected`}</span>
                      <ChevronDown className="size-4 text-muted-ink" />
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[240px] rounded-2xl border border-line bg-white p-2 shadow-lift ring-0"
                    >
                      <div className="flex flex-col gap-0.5">
                        {availableServices.map((s) => (
                          <label
                            key={s}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium text-brand hover:bg-brand-50"
                          >
                            <Checkbox
                              checked={services.includes(s)}
                              onCheckedChange={(checked) => toggleService(s, checked === true)}
                            />
                            {s}
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Availability */}
              <div className="mb-6">
                <FilterLabel icon={CalendarDays}>Availability</FilterLabel>
                <div className="mb-2 flex flex-wrap gap-1">
                  <FilterPill active={availability === "today"} onClick={() => pickPresetAvailability("today")}>
                    Today
                  </FilterPill>
                  <FilterPill active={availability === "tomorrow"} onClick={() => pickPresetAvailability("tomorrow")}>
                    Tomorrow
                  </FilterPill>
                  <FilterPill active={availability === "week"} onClick={() => pickPresetAvailability("week")}>
                    This week
                  </FilterPill>
                </div>

                <Popover
                  open={dateCalendarOpen}
                  onOpenChange={setDateCalendarOpen}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={
                          availability === "date"
                            ? "w-full justify-between border-brand bg-brand-50 px-2.5 text-[13.5px] font-medium text-brand"
                            : "w-full justify-between border-line px-2.5 text-[13.5px] font-medium text-muted-ink"
                        }
                      />
                    }
                  >
                    <span>{availability === "date" && customDate ? format(customDate, "EEE, MMM d") : "Select a date"}</span>
                    <CalendarIcon className="size-4 shrink-0" />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto rounded-2xl border border-line bg-white p-2 shadow-lift ring-0"
                  >
                    <Calendar
                      mode="single"
                      selected={customDate}
                      defaultMonth={customDate ?? today}
                      onSelect={(d) => {
                        if (!d) return;
                        setCustomDate(d);
                        setAvailability("date");
                        setDateCalendarOpen(false);
                      }}
                      disabled={{ before: today }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Price range */}
              <div className="">
                <Label className="mb-2.5 block text-[13.5px] font-semibold text-brand">
                  ${priceBottom} – ${priceTop}/hr
                </Label>
                <Slider
                  value={[priceBottom, priceTop]}
                  onValueChange={(v) => {
                    if (!Array.isArray(v)) return;
                    setPriceFloor(v[0]);
                    setPriceCap(v[1] >= maxRate ? null : v[1]);
                  }}
                  min={0}
                  max={Math.max(maxRate, 1)}
                  // Whole dollars: a coarser step would not land on a top rate that is not a multiple of it.
                  step={1}
                />
              </div>

              <LicensedOnly checked={licensedOnly} onChange={setLicensedOnly} className="mt-6" />
            </div>
          </div>

          {/*
            self-start on both branches: the outer 2-column grid (sidebar +
            this) defaults to stretching every item to match the tallest one
            in its row — which meant this whole results area, cards
            included, was inheriting the filter sidebar's height. Each
            card's own mt-auto then pushed its "Book" buttons down to match
            that inherited height, leaving the huge internal gap. self-start
            opts this column out of that stretch and back to its own
            natural content height.
          */}
          {asked === null ? (
            <p className="self-start rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
              Enter your ZIP code under Location to see the professionals who travel to you.
            </p>
          ) : loading ? (
            <p className="self-start rounded-2xl border border-line bg-white px-5 py-14 text-center text-[14.5px] text-muted-ink">
              Finding professionals near {zip}…
            </p>
          ) : answer && !answer.ok ? (
            <p className="self-start rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
              {answer.unknownZip
                ? `We don't know the ZIP code ${zip}. Check the five digits and try again.`
                : "We couldn't load professionals just now. Reloading the page usually works."}
            </p>
          ) : filtered.length === 0 ? (
            <p className="self-start rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
              {all.length === 0 ? `No professional travels to ${zip} yet.` : "No professionals match your filters."}{" "}
              <button
                type="button"
                onClick={resetFilters}
                className="font-semibold text-brand-500 hover:underline"
              >
                Clear filters
              </button>
            </p>
          ) : (
            // A fixed 260px track, not minmax(...,1fr) — 1fr was an earlier
            // bug: whenever only one column fit, that single card stretched
            // to fill the *entire* row width instead of staying its normal
            // size. With a literal fixed size, auto-fill just repeats as
            // many 260px columns as fit and leaves any leftover width as
            // blank space, so a card is always the same size no matter how
            // few results there are. 260px specifically: 3×260px + 2×20px
            // gaps = 820px, which is exactly this results column's width
            // at the page's max content width — so a full row of 3 lines
            // up flush with the right edge, same as the Sort control above.
            <div className="grid grid-cols-[repeat(auto-fill,260px)] gap-5 self-start">
              {filtered.map((result) => {
                const view = viewOf(result);
                return (
                  <ProCard
                    key={result.slug}
                    view={view}
                    onBook={(slot) => {
                      setBooking({ view, slot });
                      setBookingOpen(true);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        {booking && (
          <BookingModal
            key={`${booking.view.title} ${booking.slot?.key ?? "calendar"}`}
            view={booking.view}
            initialSlot={booking.slot}
          />
        )}
      </Dialog>
    </section>
  );
}
