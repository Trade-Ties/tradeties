import Link from "next/link";
import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from "date-fns";
import { ArrowRight, BadgeCheck, Check, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";
import { DIALOG_CALENDAR_WEEKS } from "@/components/marketing/availability";
import { scheduleFor, type Pro, type ProSlot } from "@/components/marketing/pros-data";
import { BusinessOverview } from "./BusinessOverview";

const today = new Date(new Date().setHours(0, 0, 0, 0));

/** Two columns of three: as many as a card holds without the times turning into a list. */
const SLOTS_SHOWN = 6;

/** Services on the card itself; any more, up to the five a result carries, open on hover. */
const SERVICES_SHOWN = 3;

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
  /**
   * The weekday alone, "Wed" — or empty for a time today, which the line above the times says instead.
   * Drawn in a column of its own beside `timeLabel`, so the days and the times of a card each
   * line up rather than a centred "Wed 9:00 AM" sitting a character off "Sat 10:15 AM".
   */
  dayLabel: string;
  /**
   * The full, spelled-out date and time, for the slot link's accessible name — "Thursday,
   * September 24" / "2:15 PM" rather than the button's compact "2:15 PM" (today) or "Thu 2:15 PM"
   * (other days), which read the same on every card of the grid. Split in two so a reader can
   * join them with its own wording instead of parsing `label` back apart.
   */
  dateLabel: string;
  timeLabel: string;
  /** An opening the reader can still take today; the card then carries a live "Available today" badge. */
  today: boolean;
  /**
   * The business's page with this time already chosen. Absent for the sample listings, whose
   * times belong to nobody, and a slot without it is drawn as a time rather than a link.
   */
  href?: string;
}

/** One column of the booking dialogue's calendar — a day, and whatever times it has open. */
export interface ProCardDay {
  key: string;
  /** "Wed", or "Today". */
  weekday: string;
  /** "30" */
  dayOfMonth: string;
  /** "Sep 30", for the range above the columns. */
  shortDate: string;
  /** Earlier in this week than today — drawn greyed out, so the week reads whole. */
  past: boolean;
  slots: ProCardSlot[];
}

export interface ProCardView {
  initials: string;
  color: string;
  /** The line in bold: a person for a sample listing, the business itself for a real result. */
  title: string;
  subtitle: string;
  trade?: string;
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
  /** Neighborhood/city — present for a real result too (it has `city`/`state`), unlike the fields below. */
  location?: string;
  /** Display only, never a real link — absent for a real result, which has no site on file yet. */
  website?: string;
  /**
   * What it offers, by name. The card lists three and the rest on hover; a real result sends five,
   * with the job searched for first when the business lists it.
   */
  services?: string[];
  /**
   * The business's own name for the job the customer searched for, when it lists that job — the
   * one thing on the card that answers their search rather than describing the business.
   */
  offers?: string;
  slots: ProCardSlot[];
  /**
   * Every day ahead, empty ones included, for the booking dialogue's calendar. Only the sample
   * listings have one: a real result's "all times" is its own page.
   */
  calendar?: ProCardDay[];
  /**
   * What the booking popup needs to send a real request, for a card that stands for a real
   * business. Absent for the sample listings, whose popup is a demo that sends nothing.
   */
  booking?: { slug: string; serviceId?: string };
  /**
   * The business's own page, for a card that stands for a real one.
   *
   * Absent for the sample listings, which stand for nobody and have no page to open. A card
   * without it is exactly the card that existed before, rather than one linking somewhere
   * apologetic.
   */
  href?: string;
}

/** The sample listings, in the shape above. */
export function proCardView(pro: Pro): ProCardView {
  const schedule = scheduleFor(pro);
  return {
    initials: pro.initials,
    color: pro.color,
    title: pro.name,
    subtitle: pro.business,
    trade: pro.trade,
    distance: `${pro.miles} mi`,
    rateFrom: String(pro.rateFrom),
    badges: pro.licensed ? ["Licensed"] : [],
    location: pro.location,
    website: pro.website,
    services: pro.services,
    slots: schedule.slice(0, SLOTS_SHOWN).map(sampleSlot),
    calendar: Array.from({ length: DIALOG_CALENDAR_WEEKS * 7 }, (_, index) => {
      const date = addDays(startOfWeek(today), index);
      const offset = differenceInCalendarDays(date, today);
      return {
        key: date.toISOString(),
        weekday: offset === 0 ? "Today" : format(date, "EEE"),
        dayOfMonth: format(date, "d"),
        shortDate: format(date, "MMM d"),
        past: offset < 0,
        slots: schedule.filter((slot) => isSameDay(slot.date, date)).map(sampleSlot),
      };
    }),
  };
}

function sampleSlot(slot: ProSlot): ProCardSlot {
  return {
    key: slot.date.toISOString() + slot.time,
    // The day is on `date` and the time of day is on `time`; only a slot on another day needs
    // to say which one.
    label: isSameDay(slot.date, today) ? slot.time : `${format(slot.date, "EEE")} ${slot.time}`,
    dayLabel: isSameDay(slot.date, today) ? "" : format(slot.date, "EEE"),
    dateLabel: format(slot.date, "EEEE, MMMM d"),
    timeLabel: slot.time,
    today: isSameDay(slot.date, today),
  };
}

// Shared between the homepage's availability rail, the /browse grid and the live search results,
// so the card's design only has to be maintained in one place. `className` lets each caller own
// sizing (fixed-width + snap for the rail, full-width for the grid) without touching the card's
// own visual styling.
//
// `onBook` makes the times buttons that open the booking dialogue on them, and a click anywhere
// else on the card opens it with no time chosen yet, on its calendar. Without it a real card's
// times link to the business's page instead, as on the search results.
export function ProCard({
  view,
  className,
  onBook,
}: {
  view: ProCardView;
  className?: string;
  onBook?: (slot?: ProCardSlot) => void;
}) {
  const availableToday = view.slots.some((slot) => slot.today);
  const bookFromCard = onBook
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        // React bubbles clicks out of portals, so the profile dialogue would count as the card.
        if (e.currentTarget.contains(e.target as Node)) onBook();
      }
    : undefined;

  return (
    <Card
      onClick={bookFromCard}
      className={cn(
        "relative flex flex-col gap-0 rounded-3xl border border-line bg-white p-5 shadow-card ring-0 transition-all duration-200 hover:-translate-y-1 hover:border-brand-100 hover:shadow-lift",
        bookFromCard && "cursor-pointer",
        className
      )}
    >
      {/*
        min-h-16: reserves room for a two-line business name (e.g. "Gutierrez
        General Contracting") even when a pro's name fits on one line, so
        the trade badge and everything under it always starts at the same
        height across cards instead of shifting up for the shorter ones.
      */}
      {/*
        Above the card-wide link below, which would otherwise take the click. Kept from reaching
        the card as well, whose own click opens the booking dialogue instead of the profile.
      */}
      <Dialog>
        <DialogTrigger
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 mb-4 flex min-h-16 w-fit cursor-pointer items-center gap-3 rounded-2xl text-left text-brand outline-none hover:text-brand-500 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="grid size-[46px] shrink-0 place-items-center rounded-full text-base font-bold tracking-[-0.02em] text-white"
            style={{ background: view.color }}
          >
            {view.initials}
          </span>
          <span>
            <span className="block text-[16.5px] font-bold leading-tight tracking-[-0.02em]">{view.title}</span>
            <span className="block text-[13.5px] text-muted-ink">{view.subtitle}</span>
          </span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          {/* The overview below names them again, in the size it gives them. */}
          <DialogTitle className="sr-only">{view.title}</DialogTitle>
          <BusinessOverview view={view} />
          {view.href && (
            <Link
              href={view.href}
              className={cn(buttonVariants(), "mt-5 h-10 w-full rounded-full text-sm font-semibold no-underline")}
            >
              View full profile
            </Link>
          )}
        </DialogContent>
      </Dialog>

      {view.trade && (
        <Badge className="mb-3.5 h-auto w-fit self-start rounded-full border-transparent bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-500">
          {view.trade}
        </Badge>
      )}

      {/*
        Where they are and how far. Only the first part of the place — "Capitol Hill", not "Capitol
        Hill, Denver, CO" — so it fits beside the distance; the profile dialogue has it in full. A real
        result's town is already the line under its name, so it is not said twice here.
      */}
      <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-muted-ink">
        <MapPin className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
        {view.location && view.location !== view.subtitle && (
          <>
            <span className="truncate">{view.location.split(",")[0]}</span>
            <span className="text-[#CBD6E2]">•</span>
          </>
        )}
        <span className="shrink-0">{view.distance} away</span>
      </div>

      {/*
        The badge line is drawn at full height even when empty. The services under it take the rows
        their names need; whatever that leaves over falls above the price, which is pinned to the
        foot of the card, so the times line up across a row however the chips wrapped.
      */}
      <div className="mb-4 mt-2">
        <div className="flex items-center gap-3 text-[12px] font-medium text-muted-ink">
          {view.badges.length === 0 && (
            <span aria-hidden="true" className="invisible inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5" />
              Licensed
            </span>
          )}
          {view.badges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5 text-go" />
              {badge}
            </span>
          ))}
        </div>

        {view.offers && (
          <p className="m-0 mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-go-bg px-2.5 py-1 text-[12px] font-semibold text-[#07734F]">
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Offers {view.offers}</span>
          </p>
        )}

        {/* Without the job it offers: that is already said, just above. */}
        <ServiceList services={(view.services ?? []).filter((service) => service !== view.offers)} />
      </div>

      <div className="mt-auto border-t border-line pt-3.5">
        {/*
          "Next available", or — when one of the times is today — a live "Available today" in its
          place: the landing page's "free" badge in small, the same green and pulse, with the same
          dot on each of today's times below. One fixed height either way, so the line, the divider
          above it and the times below sit level across a row whichever a card says.
        */}
        <p className="mb-2 flex h-5 items-center gap-1 text-xs font-semibold whitespace-nowrap text-faint">
          {/* One piece of text, so the line's gap falls after the dot rather than inside the price. */}
          {view.rateFrom !== undefined && (
            <span>
              From <span className="font-bold text-brand">${view.rateFrom}</span>/hr ·
            </span>
          )}
          {view.slots.length === 0 ? (
            "No openings listed"
          ) : availableToday ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-go-bg px-2 py-0.5 text-[11.5px] font-semibold text-[#07734F]">
              <span aria-hidden="true" className="animate-tt-pulse size-1.5 rounded-full bg-go" />
              Available today
            </span>
          ) : (
            <span className="text-foreground">Next available</span>
          )}
        </p>

        {/*
          A fixed two-column grid rather than flex-wrap: with wrap, how many times
          shared a row depended on how wide that pro's labels happened to be
          ("Tue 10:30 AM" vs "3:00 PM"), so slot 3 landed in a different place on
          every card. Two columns, filled left to right, put slot N in the same
          spot on every card of the grid. min-h reserves all three rows even for a
          pro with fewer times, so every card ends at the same height.
        */}
        <div className="grid min-h-[116px] grid-cols-2 content-start gap-1.5">
          {view.slots.slice(0, SLOTS_SHOWN).map((slot) => {
            // Tighter than a full-width row: two to a line leaves about 110px each, which
            // "Fri 10:30 AM" in the mono face fills. The word "Book" is in the accessible name.
            // One look for every time, tinted like the calendar's open days so it reads as something to
            // press. Today is said in words above them rather than in a colour of its own: green beside
            // blue reads as "available" beside "not", and red-green is the pair colour blindness loses.
            const slotClassName =
              "h-auto min-w-0 rounded-[10px] border-brand-100 bg-brand-50 px-1.5 py-2 font-mono text-[12px] font-medium text-brand hover:border-brand hover:bg-brand hover:text-white";

            if (onBook) {
              return (
                <Button
                  key={slot.key}
                  type="button"
                  variant="outline"
                  aria-label={`Book ${slot.dateLabel}, ${slot.timeLabel} with ${view.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBook(slot);
                  }}
                  className={slotClassName}
                >
                  <SlotText slot={slot} />
                </Button>
              );
            }

            if (!slot.href) {
              return (
                <Button key={slot.key} type="button" variant="outline" disabled className={slotClassName}>
                  <SlotText slot={slot} />
                </Button>
              );
            }

            // Not the booking itself: the business's page, with this time picked in its calendar.
            // A request needs a service, and only that page can ask for one when the search named
            // none.
            // A plain link in the button's clothes, since `Button` would announce it as a button.
            return (
              <Link
                key={slot.key}
                href={slot.href}
                aria-label={`${slot.dateLabel}, ${slot.timeLabel} with ${view.title}`}
                className={cn(buttonVariants({ variant: "outline" }), "relative z-10 no-underline", slotClassName)}
              >
                <SlotText slot={slot} />
              </Link>
            );
          })}
        </div>
      </div>

      {/*
        The way to every time, not only the six that fit. For a real business that is its page,
        whose calendar lists them all once a service is picked. The link's ::after stretches over
        the whole card, so a click anywhere that is not a time or the name lands here — one link
        rather than a click handler on the card, which keeps a middle click and "open in new tab"
        working. A sample listing has no page, so its booking dialogue, which lists every time it
        holds, stands in.
      */}
      {view.href && !onBook ? (
        <Link
          // The business's page with its calendar open, and straight down to it.
          href={`${view.href}${view.href.includes("?") ? "&" : "?"}calendar=1#when`}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500 no-underline after:absolute after:inset-0 after:rounded-3xl"
        >
          View all available times
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : (
        onBook && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            className="mt-3 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-brand-500 hover:underline"
          >
            View all available times
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        )
      )}
    </Card>
  );
}

/**
 * A time as two columns: the weekday, left-aligned in the width of three letters, and the time,
 * right-aligned in the width of "10:15 AM". In the monospaced face that lines every day up with
 * every other day and every time with every other time, across the whole card.
 *
 * A time today has no weekday, so it takes both columns and sits centred in them, rather than
 * hanging right beside an empty gap.
 */
function SlotText({ slot }: { slot: ProCardSlot }) {
  return (
    <span className="inline-grid grid-cols-[3ch_8ch] gap-x-[1ch]">
      {slot.dayLabel ? (
        <>
          <span className="text-left">{slot.dayLabel}</span>
          <span className="text-right">{slot.timeLabel}</span>
        </>
      ) : (
        <span className="col-span-2 inline-flex items-center justify-center gap-1.5">
          <span aria-hidden="true" className="animate-tt-pulse size-1.5 shrink-0 rounded-full bg-go" />
          {slot.timeLabel}
        </span>
      )}
    </span>
  );
}

/**
 * The first three services as a list, and — when there are more — a "+2 more" under them whose
 * hover shows every one. On hover rather than in place, so the card never changes height under
 * the pointer and pushes its row about.
 */
function ServiceList({ services }: { services: string[] }) {
  if (services.length === 0) return null;
  const rest = services.length - SERVICES_SHOWN;
  if (rest <= 0) return <Bullets services={services} className="mt-3" />;

  return (
    <PreviewCard>
      <PreviewCardTrigger
        // Above the card-wide link, and not a click on the card: hovering is all this is for.
        render={
          <div className="relative z-10 mt-3 w-fit max-w-full cursor-default" onClick={(e) => e.stopPropagation()} />
        }
      >
        <Bullets services={services.slice(0, SERVICES_SHOWN)} />
        <p className="m-0 mt-1 pl-3 text-[12px] font-semibold text-brand-500">+ {rest} more</p>
      </PreviewCardTrigger>
      <PreviewCardContent className="w-64 p-4">
        <p className="m-0 mb-2.5 text-[11px] font-semibold tracking-wide text-faint uppercase">Services</p>
        <Bullets services={services} />
      </PreviewCardContent>
    </PreviewCard>
  );
}

function Bullets({ services, className }: { services: string[]; className?: string }) {
  return (
    <ul aria-label="Services" className={cn("m-0 flex list-none flex-col gap-1 p-0", className)}>
      {services.map((service) => (
        <li key={service} className="flex min-w-0 items-center gap-2 text-[12.5px] leading-[18px] text-foreground">
          <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-brand-500/60" />
          <span className="truncate">{service}</span>
        </li>
      ))}
    </ul>
  );
}
