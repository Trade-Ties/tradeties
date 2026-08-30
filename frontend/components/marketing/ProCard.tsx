import { format, isSameDay } from "date-fns";
import { ArrowRight, BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Pro } from "@/components/marketing/pros-data";

const today = new Date(new Date().setHours(0, 0, 0, 0));

/**
 * What the card draws, independent of where it came from.
 *
 * Two sources feed it: the sample listings behind the homepage rail and the full browse page, and
 * the live search, which knows strictly less about each business. Every field the search cannot
 * answer is optional here and is left out rather than filled in — a rating this marketplace does
 * not collect must not appear as a zero, and a card that reserves a row for it would say the
 * business has none.
 */
/**
 * One opening, already printed.
 *
 * <p>The label is formatted by whoever supplied it, because only they know which clock it should
 * be read on: a real result carries the zone the business works in, and the sample listings carry
 * a time of day that was written down rather than computed. A card that formatted these itself
 * would print them in whichever zone it happened to be running in — the server's during the first
 * pass and the reader's afterwards, which is two different strings for one slot.
 */
export interface ProCardSlot {
  key: string;
  label: string;
  /** Draws the slot in the "go" colour, for an opening the reader can still take today. */
  today: boolean;
}

export interface ProCardView {
  initials: string;
  color: string;
  /** The line in bold: a person for a sample listing, the business itself for a real result. */
  title: string;
  subtitle: string;
  trade?: string;
  /** Absent for a real result — there are no reviews in this marketplace to average. */
  rating?: number;
  /** Absent for a real result — no completed-job counter exists. */
  jobs?: number;
  /**
   * Already worded. The sample listings quote a decimal; a real distance is measured between two
   * postal-code centres and is honest to about a mile, so it says "3 miles" or "under a mile" and
   * never 3.4 — a precision the number does not have.
   */
  distance: string;
  /** Already formatted, for the same reason: the wire carries four decimal places of money. */
  rateFrom?: string;
  /** Trust badges, already worded. Empty draws no row at all rather than an empty one. */
  badges: string[];
  slots: ProCardSlot[];
  /**
   * Whether a slot can actually be taken. False renders the times as what they are — the next
   * openings — instead of as a button that promises a booking nothing can yet accept.
   */
  bookable: boolean;
}

/** The sample listings, in the shape above. */
export function proCardView(pro: Pro): ProCardView {
  return {
    initials: pro.initials,
    color: pro.color,
    title: pro.name,
    subtitle: pro.business,
    trade: pro.trade,
    rating: pro.rating,
    jobs: pro.jobs,
    distance: `${pro.miles} mi`,
    rateFrom: String(pro.rateFrom),
    badges: pro.verified ? ["Licensed", "Identity verified"] : ["Licensed"],
    slots: pro.slots.map((slot) => ({
      key: slot.date.toISOString() + slot.time,
      // The day is on `date` and the time of day is on `time`; only a slot on another day needs
      // to say which one.
      label: isSameDay(slot.date, today) ? slot.time : `${format(slot.date, "EEE")} ${slot.time}`,
      today: isSameDay(slot.date, today),
    })),
    bookable: true,
  };
}

// Shared between the homepage's availability rail, the /browse grid and the live search results,
// so the card's design only has to be maintained in one place. `className` lets each caller own
// sizing (fixed-width + snap for the rail, full-width for the grid) without touching the card's
// own visual styling.
export function ProCard({ view, className }: { view: ProCardView; className?: string }) {
  const facts = [
    view.rating === undefined ? null : (
      <span key="rating">
        ★ <strong className="font-semibold text-brand">{view.rating.toFixed(1)}</strong>
      </span>
    ),
    view.jobs === undefined ? null : <span key="jobs">{view.jobs} jobs</span>,
    <span key="distance">{view.distance}</span>,
  ].filter((fact) => fact !== null);

  return (
    <Card
      className={cn(
        "flex flex-col gap-0 rounded-3xl border border-line bg-white p-5 shadow-card ring-0 transition-all duration-200 hover:-translate-y-1 hover:border-brand-100 hover:shadow-lift",
        className
      )}
    >
      {/*
        min-h-16: reserves room for a two-line business name (e.g. "Gutierrez
        General Contracting") even when a pro's name fits on one line, so
        the trade badge and everything under it always starts at the same
        height across cards instead of shifting up for the shorter ones.
      */}
      <div className="mb-4 flex min-h-16 items-center gap-3">
        <div
          className="grid size-[46px] shrink-0 place-items-center rounded-full text-base font-bold tracking-[-0.02em] text-white"
          style={{ background: view.color }}
        >
          {view.initials}
        </div>
        <div>
          <p className="m-0 text-[16.5px] font-bold leading-tight tracking-[-0.02em]">{view.title}</p>
          <p className="m-0 text-[13.5px] text-muted-ink">{view.subtitle}</p>
        </div>
      </div>

      {view.trade && (
        <Badge className="mb-3.5 h-auto w-fit self-start rounded-full border-transparent bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-500">
          {view.trade}
        </Badge>
      )}

      {/* Separators between whatever facts exist, never around a gap where one does not. */}
      <div className="flex items-center gap-2.5 text-[13.5px] text-muted-ink">
        {facts.map((fact, index) => (
          <span key={index} className="contents">
            {index > 0 && <span className="text-[#CBD6E2]">•</span>}
            {fact}
          </span>
        ))}
      </div>

      {view.badges.length > 0 && (
        <div className="mb-3.5 mt-2 flex items-center gap-3 border-b border-line pb-3.5 text-[12px] font-medium text-muted-ink">
          {view.badges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5 text-go" />
              {badge}
            </span>
          ))}
        </div>
      )}

      <p className="mb-2 text-xs font-semibold text-faint">
        {view.rateFrom !== undefined && (
          <>
            From <span className="font-bold text-brand">${view.rateFrom}</span>/hr ·{" "}
          </>
        )}
        {view.slots.length === 0 ? "No openings listed" : "Next available"}
      </p>
      {/*
        flex-col, not flex-wrap: with wrap, whether a row held one button or
        two depended on how wide that particular pro's time labels happened
        to be ("Tue 10:30 AM" vs "3:00 PM"), so slot 1/2/3 landed at
        different heights on different cards. flex-col forces one slot per
        row unconditionally, so slot 1 is always row 1 across every card.
        min-h reserves a full 3-row card (the max any pro lists — sliced
        below as a safety cap) even when a pro only has 1 or 2, so every
        card ends the same height either way.
      */}
      <div className="mt-auto flex min-h-[116px] flex-col gap-1.5">
        {view.slots.slice(0, 3).map((slot) => (
          <Button
            key={slot.key}
            type="button"
            variant="outline"
            disabled={!view.bookable}
            className={
              slot.today
                ? "h-auto rounded-[10px] border-[#BFEBD8] bg-go-bg px-2.5 py-2 font-mono text-[12.5px] font-medium text-[#07734F] hover:border-go hover:bg-go hover:text-white"
                : "h-auto rounded-[10px] border-line bg-white px-2.5 py-2 font-mono text-[12.5px] font-medium text-brand hover:border-brand hover:bg-brand hover:text-white"
            }
          >
            {view.bookable ? `Book ${slot.label}` : slot.label}
            {view.bookable && (
              <ArrowRight className="ml-0.5 size-3 opacity-0 transition-opacity duration-150 group-hover/button:opacity-100" />
            )}
          </Button>
        ))}
      </div>
    </Card>
  );
}
