"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProCard, proCardView } from "@/components/marketing/ProCard";
import { PROS, TRADE_ICONS, TRADE_LIST } from "@/components/marketing/pros-data";

const TRADE_FILTERS = ["All", ...TRADE_LIST];

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
            render={<Link href="/browse" />}
            nativeButton={false}
            className="h-auto whitespace-nowrap p-0 text-[14.5px] font-semibold text-brand-500"
          >
            Browse all professionals →
          </Button>
        </div>

        <div className="rail-scroll mb-6 flex items-start gap-7 overflow-x-auto">
          {TRADE_FILTERS.map((t) => {
            const active = t === filter;
            const Icon = TRADE_ICONS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={
                  active
                    ? "flex flex-none flex-col items-center gap-2 border-b-2 border-brand-500 px-0.5 pb-3 pt-1 text-brand-500"
                    : "flex flex-none flex-col items-center gap-2 border-b-2 border-transparent px-0.5 pb-3 pt-1 text-muted-ink transition-colors hover:text-brand"
                }
              >
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                <span className={active ? "text-[13px] font-semibold" : "text-[13px] font-medium"}>{t}</span>
              </button>
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
                <ProCard key={p.name} view={proCardView(p)} className="w-[271px] shrink-0 snap-start" />
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
