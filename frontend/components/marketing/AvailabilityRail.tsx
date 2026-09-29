"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookingModal } from "@/components/marketing/BookingModal";
import { ProCard, type ProCardSlot, type ProCardView } from "@/components/marketing/ProCard";
import { viewOf } from "@/components/marketing/JobSearchResults";
import { TRADE_ICONS } from "@/components/marketing/pros-data";
import { cn } from "@/lib/utils";
import { rememberZip } from "@/lib/zip-memory";
import type { components } from "@/lib/api/schema";

type SearchResult = components["schemas"]["BusinessSearchResult"];

/** What the server found, or why there is nothing to show. */
export type OpenSlotsState =
  | { kind: "ask" }
  | { kind: "unknown-zip" }
  | { kind: "failed" }
  | { kind: "found"; results: SearchResult[] };

const ALL = "All";

/**
 * The landing page's rail of real businesses with open times near the visitor's ZIP code.
 *
 * The search runs on the server (see OpenSlots); this draws it and takes a new ZIP, which it
 * remembers and then asks the server to search again for. The trade tabs filter what came back
 * rather than searching again: the search takes a description, not a trade, and the tabs only
 * offer the trades that are actually in the list.
 */
export function AvailabilityRail({ zip, state }: { zip: string | null; state: OpenSlotsState }) {
  const results = state.kind === "found" ? state.results : [];
  const trades = Array.from(new Set(results.map((r) => r.primaryTrade).filter((t): t is string => !!t))).sort(
    (a, b) => a.localeCompare(b)
  );

  const [filter, setFilter] = useState(ALL);
  // A trade that is no longer in the list after the ZIP changed shows everything again.
  const activeFilter = trades.includes(filter) ? filter : ALL;
  const filtered = activeFilter === ALL ? results : results.filter((r) => r.primaryTrade === activeFilter);

  const [editingZip, setEditingZip] = useState(false);

  // Kept after closing, so the dialogue still has something to draw while it fades out.
  const [booking, setBooking] = useState<{ view: ProCardView; slot?: ProCardSlot } | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  // Guess "there's more to see" from the card count before the mount effect can
  // actually measure scrollWidth — avoids a one-frame flash of a disabled arrow.
  const [canScrollRight, setCanScrollRight] = useState(filtered.length > 4);

  const updateScrollState = () => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  // Re-check after the card list changes (e.g. a trade filter click or a new ZIP resizes it),
  // and jump back to the start so the arrows don't get stuck mid-scroll.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    const id = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(id);
  }, [filtered.length, zip]);

  // Keyed on whether the rail exists: it is not drawn until a ZIP has found somebody.
  const hasRail = results.length > 0;
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [hasRail]);

  const page = (direction: 1 | -1) => {
    railRef.current?.scrollBy({ left: direction * railRef.current.clientWidth, behavior: "smooth" });
  };

  return (
    <section id="open-slots" className="border-t border-line bg-canvas pb-12 pt-12">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[clamp(24px,2.8vw,30px)] font-bold tracking-[-0.025em]">
              Open slots near {zip ?? "you"}
              {zip && !editingZip && (
                <button
                  type="button"
                  onClick={() => setEditingZip(true)}
                  // Nudged down to the digits: the heading's line box leaves room for descenders below
                  // them, so its centre sits above theirs.
                  className="inline-flex translate-y-[3px] items-center gap-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-[12.5px] font-semibold tracking-normal text-brand-500 transition-colors hover:border-brand-100 hover:bg-brand-50"
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Change ZIP
                </button>
              )}
            </h2>
            {zip && editingZip ? (
              <ZipForm initial={zip} onDone={() => setEditingZip(false)} className="mt-3" />
            ) : (
              <p className="text-[14.5px] text-muted-ink">
                Straight from their calendars — if you can see it, you can book it.
              </p>
            )}
          </div>
          <Button
            variant="link"
            render={<Link href={zip ? `/browse?zip=${zip}` : "/browse"} />}
            nativeButton={false}
            className="h-auto whitespace-nowrap p-0 text-[14.5px] font-semibold text-brand-500"
          >
            Browse all professionals →
          </Button>
        </div>

        {state.kind === "ask" && (
          <div className="flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-10 text-center">
            <div className="mb-3 grid size-11 place-items-center rounded-full bg-brand-50">
              <MapPin className="size-5 text-brand-500" aria-hidden="true" />
            </div>
            <p className="m-0 text-[16px] font-semibold text-brand">Where do you need the work done?</p>
            <p className="mt-1 mb-5 text-[14px] text-muted-ink">
              Enter your ZIP code to see who&apos;s free soon near you.
            </p>
            <ZipForm initial="" />
          </div>
        )}

        {state.kind === "unknown-zip" && (
          <Notice>We don&apos;t know the ZIP code {zip}. Check the five digits and try another one.</Notice>
        )}

        {state.kind === "failed" && (
          <Notice>We couldn&apos;t load open slots just now. Reloading the page usually works.</Notice>
        )}

        {state.kind === "found" && results.length === 0 && (
          <Notice>No one near {zip} has open times yet. Try a nearby ZIP code.</Notice>
        )}

        {hasRail && (
          <>
            {/*
              Each tab as wide as its name and the same gap after every one. A name of two words is
              broken between them by hand rather than wrapped: a wrapped line keeps the full width it
              was given, so the gap after "General Contractor" would come out wider than the rest.
            */}
            {trades.length > 1 && (
              <div className="rail-scroll mb-6 flex items-start gap-x-6 overflow-x-auto">
                {[ALL, ...trades].map((t) => {
                  const active = t === activeFilter;
                  const Icon = TRADE_ICONS[t] ?? Wrench;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilter(t)}
                      className={cn(
                        "flex min-w-8 flex-none flex-col items-center gap-2 self-stretch border-b-2 px-0.5 pb-3 pt-1 text-center",
                        active
                          ? "border-brand-500 text-brand-500"
                          : "border-transparent text-muted-ink transition-colors hover:text-brand"
                      )}
                    >
                      <Icon className="size-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className={cn("whitespace-pre text-[13px] leading-tight", active ? "font-semibold" : "font-medium")}>
                        {t.replace(" ", "\n")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div
              ref={railRef}
              className="rail-scroll flex snap-x snap-mandatory scroll-smooth gap-4 overflow-x-auto p-1"
            >
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
                    className="w-[271px] shrink-0 snap-start"
                  />
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous professionals"
                disabled={!canScrollLeft}
                onClick={() => page(-1)}
                className="size-9 rounded-full border-line text-muted-ink hover:border-brand-100 hover:bg-brand-50 hover:text-brand disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next professionals"
                disabled={!canScrollRight}
                onClick={() => page(1)}
                className="size-9 rounded-full border-line text-muted-ink hover:border-brand-100 hover:bg-brand-50 hover:text-brand disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        )}
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

/** Holds the section's place while the server searches, so the page below does not jump up. */
export function AvailabilityRailFallback() {
  return (
    <section id="open-slots" className="border-t border-line bg-canvas pb-12 pt-12">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 className="mb-1.5 text-[clamp(24px,2.8vw,30px)] font-bold tracking-[-0.025em]">Open slots near you</h2>
        <p className="text-[14.5px] text-muted-ink">Finding who&apos;s free soon…</p>
        <div className="mt-7 flex gap-4 overflow-hidden p-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[420px] w-[271px] shrink-0 animate-pulse rounded-3xl border border-line bg-white" />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Five digits and a button. Remembers the ZIP, then has the server render the section again for
 * it — the search is the server's, so a refresh rather than a fetch from here.
 */
function ZipForm({ initial, onDone, className }: { initial: string; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const [zip, setZip] = useState(initial);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (zip.length !== 5) return;
    rememberZip(zip);
    startTransition(() => {
      router.refresh();
      onDone?.();
    });
  };

  return (
    <form onSubmit={submit} className={cn("flex items-center gap-2", className)}>
      <Input
        aria-label="ZIP code"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="ZIP code"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
        autoFocus={initial !== ""}
        className="h-10 w-32 rounded-full border-line bg-white px-4 text-[15px] tracking-wide"
      />
      <Button type="submit" disabled={zip.length !== 5 || pending} className="h-10 rounded-full px-5 text-sm font-semibold">
        {pending ? "Searching…" : "Show open slots"}
      </Button>
      {onDone && (
        <Button type="button" variant="ghost" onClick={onDone} className="h-10 rounded-full px-3 text-sm text-muted-ink">
          Cancel
        </Button>
      )}
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-[14.5px] text-muted-ink">
      {children}
    </p>
  );
}
