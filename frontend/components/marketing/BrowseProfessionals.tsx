"use client";

import { useMemo, useState } from "react";
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
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/marketing/FilterPill";
import { ProCard, proCardView } from "@/components/marketing/ProCard";
import { PROS, SERVICES_BY_TRADE, TRADE_ICONS, TRADE_LIST, type Pro } from "@/components/marketing/pros-data";
import { dateMatchesAvailability, parseWhenParam, today, type AvailabilityFilter } from "@/components/marketing/when-filter";

const RATING_OPTIONS = [
  { value: "3.0", label: "3.0+" },
  { value: "4.0", label: "4.0+" },
  { value: "4.5", label: "4.5+" },
  { value: "5.0", label: "5.0+" },
];

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "low to high", label: "Price: low to high" },
  { value: "high to low", label: "Price: high to low" },
  { value: "distance", label: "Distance" },
];

const MAX_RADIUS = 25;
const MAX_RATE = 150;

function matchesAvailability(pro: Pro, availability: AvailabilityFilter, customDate: Date | undefined) {
  return pro.slots.some((s) => dateMatchesAvailability(s.date, availability, customDate));
}

function FilterLabel({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-brand">
      <Icon className="size-4 text-muted-ink" />
      {children}
    </div>
  );
}

export function BrowseProfessionals() {
  // Carried over from the hero search bar's "See who's free" — only ever
  // read to seed initial state below, not kept in sync afterward, same as
  // any other bookmarkable-URL-as-starting-point page.
  const searchParams = useSearchParams();
  const job = searchParams.get("job") ?? "";
  const initialWhen = parseWhenParam(searchParams.get("when"));

  const [companySearch, setCompanySearch] = useState("");
  const [zip, setZip] = useState(searchParams.get("zip") || "80202");
  const [radius, setRadius] = useState(MAX_RADIUS);
  const [trades, setTrades] = useState<string[]>([]);
  const [tradeMenuOpen, setTradeMenuOpen] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState("0");
  const [priceRange, setPriceRange] = useState<number[]>([0, MAX_RATE]);
  const [availability, setAvailability] = useState<AvailabilityFilter>(initialWhen.availability);
  const [customDate, setCustomDate] = useState<Date | undefined>(initialWhen.customDate);
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);
  const [sort, setSort] = useState("Recommended");

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
    trades.forEach((t) => SERVICES_BY_TRADE[t]?.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [trades]);

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
    setCompanySearch("");
    setRadius(MAX_RADIUS);
    setTrades([]);
    setServices([]);
    setVerifiedOnly(false);
    setMinRating("0");
    setPriceRange([0, MAX_RATE]);
    setAvailability("any");
    setCustomDate(undefined);
    setDateCalendarOpen(false);
  };

  const hasActiveFilters =
    companySearch.trim() !== "" ||
    radius < MAX_RADIUS ||
    trades.length > 0 ||
    effectiveServices.length > 0 ||
    verifiedOnly ||
    minRating !== "0" ||
    priceRange[0] > 0 ||
    priceRange[1] < MAX_RATE ||
    availability !== "any";

  const filtered = useMemo(() => {
    const min = Number(minRating);
    const query = companySearch.trim().toLowerCase();
    const results = PROS.filter((p) => {
      if (query && !p.business.toLowerCase().includes(query)) return false;
      if (p.miles > radius) return false;
      if (trades.length > 0 && !trades.includes(p.trade)) return false;
      if (effectiveServices.length > 0 && !effectiveServices.some((s) => p.services.includes(s))) return false;
      if (verifiedOnly && !p.verified) return false;
      if (p.rating < min) return false;
      if (p.rateFrom < priceRange[0] || p.rateFrom > priceRange[1]) return false;
      if (!matchesAvailability(p, availability, customDate)) return false;
      return true;
    });

    const sorted = [...results];
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "low to high":
        sorted.sort((a, b) => a.rateFrom - b.rateFrom);
        break;
      case "high to low":
        sorted.sort((a, b) => b.rateFrom - a.rateFrom);
        break;
      case "distance":
        sorted.sort((a, b) => a.miles - b.miles);
        break;
      default:
        break;
    }
    return sorted;
  }, [companySearch, radius, trades, effectiveServices, verifiedOnly, minRating, priceRange, availability, customDate, sort]);

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
              {filtered.length} {filtered.length === 1 ? "professional matches" : "professionals match"} your filters.
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
            <Select value={sort} onValueChange={(v) => setSort(v ?? "Recommended")}>
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
                  min={1}
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
                      {TRADE_LIST.map((t) => {
                        const Icon = TRADE_ICONS[t];
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

              {/* Rating */}
              <div className="mb-6">
                <FilterLabel icon={Star}>Rating</FilterLabel>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  {RATING_OPTIONS.map((o) => (
                    <FilterPill
                      key={o.value}
                      active={minRating === o.value}
                      onClick={() => setMinRating((prev) => (prev === o.value ? "0" : o.value))}
                    >
                      {o.label}
                    </FilterPill>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div className="mb-6">
                <Label className="mb-2.5 block text-[13.5px] font-semibold text-brand">
                  ${priceRange[0]} – ${priceRange[1]}/hr
                </Label>
                <Slider
                  value={priceRange}
                  onValueChange={(v) => Array.isArray(v) && setPriceRange(v)}
                  min={0}
                  max={MAX_RATE}
                  step={5}
                />
              </div>

              {/* Verified toggle */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-medium text-brand">
                  <ShieldCheck className="size-4 shrink-0 text-muted-ink" />
                  <span className="truncate">Verified only</span>
                </span>
                <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              </div>
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
          {filtered.length === 0 ? (
            <p className="self-start rounded-2xl border border-dashed border-line bg-canvas px-5 py-14 text-center text-[14.5px] text-muted-ink">
              No professionals match your filters.{" "}
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
            <div className="grid grid-cols-[repeat(auto-fill,260px)] items-start gap-5 self-start">
              {filtered.map((p) => (
                <ProCard key={p.name} view={proCardView(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
