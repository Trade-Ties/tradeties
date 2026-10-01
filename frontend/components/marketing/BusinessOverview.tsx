"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, Globe, MapPin, Navigation, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicBusinessProfile } from "@/lib/api/marketplace";
import { loadProfile } from "./booking-popup-actions";
import { cancellation, duration, money, priceOf } from "./business-format";
import type { ProCardView } from "./ProCard";

type WorkingDay = PublicBusinessProfile["workingHours"][number];

/** As many services as the overview lists; the full profile has the rest. */
const SERVICES_SHOWN = 5;

/** ISO order, which is the order the contract sends the week in: 1 is Monday. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * What a card's name opens — enough of the profile to decide on without leaving the page, and not
 * a way to reach the person. No phone, no email, nothing the public profile does not already show.
 *
 * Drawn at once from what the card already holds, and filled in from the public profile when it
 * arrives: the description, the services with their prices, the working week and the terms. A
 * sample listing has no profile behind it, so it stays with what the card knows — and its website
 * stays display text rather than a link, since a made-up domain may belong to somebody real.
 */
export function BusinessOverview({ view }: { view: ProCardView }) {
  const slug = view.booking?.slug;
  // Undefined while it is being read, null once it could not be.
  const [profile, setProfile] = useState<PublicBusinessProfile | null | undefined>(slug ? undefined : null);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    loadProfile(slug).then((found) => {
      if (live) setProfile(found);
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const loading = profile === undefined;
  const trades = profile ? tradesOf(profile) : view.trade ? [view.trade] : [];
  const next = view.slots[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5 pr-8">
        <div
          className="grid size-16 shrink-0 place-items-center rounded-full text-xl font-bold tracking-[-0.02em] text-white"
          style={{ background: view.color }}
        >
          {view.initials}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight tracking-[-0.02em] text-brand">{view.title}</p>
          <p className="truncate text-sm text-muted-ink">{view.subtitle}</p>
        </div>
      </div>

      {trades.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {trades.map((trade, index) => (
            <Badge
              key={trade}
              className={cn(
                "h-auto rounded-full px-3 py-1 text-[11.5px]",
                index === 0
                  ? "border-transparent bg-brand-50 font-semibold text-brand-500"
                  : "border-line bg-white font-medium text-muted-ink"
              )}
            >
              {trade}
            </Badge>
          ))}
        </div>
      )}

      {profile?.description && (
        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-ink">{profile.description}</p>
      )}

      {/* One fact to a line, so a long place wraps without splitting "4 mi away". */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13.5px] text-muted-ink">
        {/* A real business's town is already the line under its name. */}
        {view.location && view.location !== view.subtitle && <Fact icon={MapPin}>{view.location}</Fact>}
        <Fact icon={Navigation}>{view.distance} away</Fact>
        {profile?.websiteUrl ? (
          <Fact icon={Globe}>
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="block truncate font-medium text-brand-500 hover:underline"
            >
              {hostOf(profile.websiteUrl)}
            </a>
          </Fact>
        ) : (
          view.website && (
            <Fact icon={Globe}>
              <span className="truncate">{view.website}</span>
            </Fact>
          )
        )}
        {view.badges.map((badge) => (
          <Fact key={badge} icon={BadgeCheck} iconClassName="text-go">
            {badge}
          </Fact>
        ))}
        {next && (
          <Fact icon={CalendarClock}>
            Next available <span className="font-medium text-brand">{next.dateLabel}, {next.timeLabel}</span>
          </Fact>
        )}
      </ul>

      <Services view={view} profile={profile} loading={loading} />

      {/* The emptiness check is for a backend older than this page, which answers without the week. */}
      {(loading || (profile?.workingHours?.length ?? 0) > 0) && (
        <Section title="Working hours">
          {profile ? <Hours days={profile.workingHours} timeZone={profile.timeZone} /> : <Placeholder rows={3} />}
        </Section>
      )}

      {profile ? (
        <Section title="Pricing">
          <Terms rows={termsOf(profile.pricing)} />
        </Section>
      ) : loading ? (
        <Section title="Pricing">
          <Placeholder rows={2} />
        </Section>
      ) : (
        view.rateFrom !== undefined && (
          <Section title="Pricing">
            <Terms rows={[{ label: "Hourly rate", value: `$${view.rateFrom}/hr` }]} />
          </Section>
        )
      )}
    </div>
  );
}

function Services({
  view,
  profile,
  loading,
}: {
  view: ProCardView;
  profile: PublicBusinessProfile | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Section title="Services">
        <Placeholder rows={3} />
      </Section>
    );
  }

  if (profile) {
    const more = profile.services.length - SERVICES_SHOWN;
    return (
      <Section title="Services">
        <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
          {profile.services.slice(0, SERVICES_SHOWN).map((service) => (
            <li key={service.id} className="flex items-baseline justify-between gap-4 py-2 first:pt-0">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-brand">{service.name}</span>
                <span className="block text-[12px] text-faint">{duration(service.estimatedDurationMinutes)}</span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-brand">
                {priceOf(service, profile.pricing)}
              </span>
            </li>
          ))}
        </ul>
        {more > 0 && (
          <p className="mt-1 text-[12.5px] text-faint">
            and {more} more on the full profile
          </p>
        )}
      </Section>
    );
  }

  if (!view.services || view.services.length === 0) {
    return null;
  }

  return (
    <Section title="Services">
      <div className="flex flex-wrap gap-1.5">
        {view.services.slice(0, SERVICES_SHOWN).map((service) => (
          <span
            key={service}
            className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[12px] font-medium text-muted-ink"
          >
            {service}
          </span>
        ))}
      </div>
    </Section>
  );
}

/**
 * The week as the business declared it, Monday first, with runs of days that keep the same hours
 * folded into one line — "Mon – Fri", not five rows saying the same thing. Today, on the business's
 * own calendar, is the line in bold.
 *
 * Declared hours, not free ones: whether a slot inside them is still open is the booking
 * calendar's to say.
 */
function Hours({ days, timeZone }: { days: WorkingDay[]; timeZone: string }) {
  const today = WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date())) + 1;

  const runs: { first: number; last: number; hours: string[] }[] = [];
  for (const day of [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
    const hours = day.blocks.map((block) => `${clock(block.startsAt)} – ${clock(block.endsAt)}`);
    const last = runs[runs.length - 1];
    if (last && last.last === day.dayOfWeek - 1 && last.hours.join() === hours.join()) {
      last.last = day.dayOfWeek;
    } else {
      runs.push({ first: day.dayOfWeek, last: day.dayOfWeek, hours });
    }
  }

  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13.5px]">
      {runs.map((run) => {
        const current = run.first <= today && today <= run.last;
        return (
          <div key={run.first} className="contents">
            <dt className={cn(current ? "font-semibold text-brand" : "text-muted-ink")}>
              {run.first === run.last ? WEEKDAYS[run.first - 1] : `${WEEKDAYS[run.first - 1]} – ${WEEKDAYS[run.last - 1]}`}
            </dt>
            <dd className={cn("m-0 tabular-nums", current ? "font-semibold text-brand" : "text-muted-ink")}>
              {run.hours.length === 0
                ? "Closed"
                : run.hours.map((hours) => (
                    <span key={hours} className="block">
                      {hours}
                    </span>
                  ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Terms({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13.5px]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-ink">{row.label}</dt>
          <dd className="m-0 font-medium text-brand">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The three terms a customer weighs before asking: the rate, what turning up costs, and what
 * cancelling would. The full profile has the rest — minimums, travel and materials.
 */
function termsOf(pricing: PublicBusinessProfile["pricing"]): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  if (pricing.hourlyRate) {
    rows.push({ label: "Hourly rate", value: `${money(pricing.hourlyRate)}/hr` });
  }
  if (pricing.serviceCallFee) {
    rows.push({
      label: "Service call",
      value: pricing.serviceCallFeeWaivedIfHired
        ? `${money(pricing.serviceCallFee)}, waived if you hire them`
        : money(pricing.serviceCallFee),
    });
  }
  rows.push({ label: "Cancellation", value: cancellation(pricing) });

  return rows;
}

/** The primary trade first, then the others as the profile lists them. */
function tradesOf(profile: PublicBusinessProfile): string[] {
  const primary = profile.trades.find((trade) => trade.id === profile.primaryTradeId);
  const others = profile.trades.filter((trade) => trade.id !== profile.primaryTradeId);
  return [...(primary ? [primary] : []), ...others].map((trade) => trade.displayName);
}

/** "08:00" → "8:00 AM"; "24:00", the end of a day that runs to midnight, → "12:00 AM". */
function clock(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const hour = hours % 24;
  return `${hour % 12 || 12}:${String(minutes).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** "https://www.lodo-electric.com/about" → "lodo-electric.com": what a reader recognises. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</p>
      {children}
    </div>
  );
}

function Fact({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0 text-faint", iconClassName)} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Placeholder({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-canvas" style={{ width: `${85 - index * 15}%` }} />
      ))}
    </div>
  );
}
