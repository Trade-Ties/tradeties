"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Pro {
  initials: string;
  color: string;
  name: string;
  business: string;
  trade: string;
  rating: string;
  jobs: number;
  miles: string;
  slots: { label: string; today?: boolean }[];
}

const PROS: Pro[] = [
  {
    initials: "MW", color: "#1E4E82", name: "Marcus Webb", business: "Webb Plumbing Co.",
    trade: "Plumber", rating: "4.9", jobs: 312, miles: "2.4 mi",
    slots: [
      { label: "Today 2:15 PM", today: true },
      { label: "4:00 PM", today: true },
      { label: "5:30 PM", today: true },
    ],
  },
  {
    initials: "DA", color: "#0E9F6E", name: "Denise Alvarez", business: "Front Range Electric",
    trade: "Electrician", rating: "4.8", jobs: 207, miles: "3.1 mi",
    slots: [
      { label: "Today 3:00 PM", today: true },
      { label: "6:15 PM", today: true },
    ],
  },
  {
    initials: "RO", color: "#B4530A", name: "Ray Okonkwo", business: "Okonkwo Heating & Air",
    trade: "HVAC", rating: "5.0", jobs: 89, miles: "5.7 mi",
    slots: [{ label: "Tue 8:00 AM" }, { label: "Tue 10:30 AM" }],
  },
  {
    initials: "TB", color: "#0A2F5C", name: "Tom Brennan", business: "Brennan Carpentry",
    trade: "Carpenter", rating: "4.7", jobs: 156, miles: "4.2 mi",
    slots: [{ label: "Tue 9:00 AM" }, { label: "Wed 1:00 PM" }],
  },
  {
    initials: "AP", color: "#6D3FA8", name: "Ana Petrova", business: "Keystone Lock & Key",
    trade: "Locksmith", rating: "4.9", jobs: 431, miles: "1.8 mi",
    slots: [
      { label: "Today 1:45 PM", today: true },
      { label: "7:00 PM", today: true },
    ],
  },
];

// Chips are built from the trades actually present above, so every filter has a result.
// Swap this for the full TRADE_CATEGORIES list once this rail is backed by real listings.
const TRADE_FILTERS = ["All", ...Array.from(new Set(PROS.map((p) => p.trade)))];

export function AvailabilityRail() {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? PROS : PROS.filter((p) => p.trade === filter);

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

  // Re-check after the card list changes (e.g. a trade filter click resizes it),
  // and jump back to the start so the arrows don't get stuck mid-scroll.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    const id = requestAnimationFrame(updateScrollState);
    return () => cancelAnimationFrame(id);
  }, [filtered.length]);

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
  }, []);

  const page = (direction: 1 | -1) => {
    railRef.current?.scrollBy({ left: direction * railRef.current.clientWidth, behavior: "smooth" });
  };

  return (
    <section id="open-slots" className="border-t border-line bg-canvas pb-12 pt-12">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="mb-1.5 text-[clamp(24px,2.8vw,30px)] font-bold tracking-[-0.025em]">
              Open slots near 80202
            </h2>
            <p className="text-[14.5px] text-muted-ink">
              Straight from their calendars — if you can see it, you can book it.
            </p>
          </div>
          <Button
            variant="link"
            render={<Link href="#" />}
            className="h-auto whitespace-nowrap p-0 text-[14.5px] font-semibold text-brand-500"
          >
            Browse all professionals →
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {TRADE_FILTERS.map((t) => {
            const active = t === filter;
            return (
              <Button
                key={t}
                variant={active ? "default" : "outline"}
                onClick={() => setFilter(t)}
                className={
                  active
                    ? "h-auto rounded-full px-4 py-2 text-[13.5px] font-semibold"
                    : "h-auto rounded-full border-line px-4 py-2 text-[13.5px] font-medium text-muted-ink hover:border-brand-100 hover:bg-brand-50 hover:text-brand"
                }
              >
                {t}
              </Button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-[14.5px] text-muted-ink">
            No one open matching that filter right now.
          </p>
        ) : (
          <>
            <div
              ref={railRef}
              className="rail-scroll flex snap-x snap-mandatory scroll-smooth gap-4 overflow-x-auto p-1"
            >
              {filtered.map((p) => (
                <Card
                  key={p.name}
                  className="flex w-[271px] shrink-0 snap-start flex-col gap-0 rounded-3xl border border-line bg-white p-5 shadow-card ring-0 transition-all duration-200 hover:-translate-y-1 hover:border-brand-100 hover:shadow-lift"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="grid size-[46px] shrink-0 place-items-center rounded-full text-base font-bold tracking-[-0.02em] text-white"
                      style={{ background: p.color }}
                    >
                      {p.initials}
                    </div>
                    <div>
                      <p className="m-0 text-[16.5px] font-bold leading-tight tracking-[-0.02em]">{p.name}</p>
                      <p className="m-0 text-[13.5px] text-muted-ink">{p.business}</p>
                    </div>
                  </div>

                  <Badge className="mb-3.5 h-auto w-fit self-start rounded-full border-transparent bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-500">
                    {p.trade}
                  </Badge>

                  <div className="flex items-center gap-2.5 text-[13.5px] text-muted-ink">
                    <span>★ <strong className="font-semibold text-brand">{p.rating}</strong></span>
                    <span className="text-[#CBD6E2]">•</span>
                    <span>{p.jobs} jobs</span>
                    <span className="text-[#CBD6E2]">•</span>
                    <span>{p.miles}</span>
                  </div>

                  <div className="mb-3.5 mt-2 flex items-center gap-3 border-b border-line pb-3.5 text-[12px] font-medium text-muted-ink">
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="size-3.5 text-go" />
                      Licensed
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck className="size-3.5 text-go" />
                      Identity verified
                    </span>
                  </div>

                  <p className="mb-2 text-xs font-semibold text-faint">Next available</p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {p.slots.map((s) => {
                      const time = s.label.replace(/^Today\s+/, "");
                      return (
                        <Button
                          key={s.label}
                          variant="outline"
                          className={
                            s.today
                              ? "h-auto rounded-[10px] border-[#BFEBD8] bg-go-bg px-2.5 py-2 font-mono text-[12.5px] font-medium text-[#07734F] hover:border-go hover:bg-go hover:text-white"
                              : "h-auto rounded-[10px] border-line bg-white px-2.5 py-2 font-mono text-[12.5px] font-medium text-brand hover:border-brand hover:bg-brand hover:text-white"
                          }
                        >
                          Book {time}
                          <ArrowRight className="ml-0.5 size-3 opacity-0 transition-opacity duration-150 group-hover/button:opacity-100" />
                        </Button>
                      );
                    })}
                  </div>
                </Card>
              ))}
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
    </section>
  );
}
