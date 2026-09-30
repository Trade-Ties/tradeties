import { BadgeCheck, Calendar, CalendarDays, Globe, MapPin } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { BackToResults } from "@/components/marketing/BackToResults";
import { ServiceSelect } from "@/components/marketing/ServiceSelect";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { amount, colorOf, duration, initialsOf, money, priceOf } from "@/components/marketing/business-format";
import { proPath } from "@/lib/routes";
import type { PublicBusinessProfile, PublicService } from "@/lib/api/marketplace";

type Pricing = PublicBusinessProfile["pricing"];

/**
 * One tradesperson's own page, as the search leads to it: who they are, the appointment the
 * customer picked — titled with what they searched for — and what it costs.
 *
 * <p>A request still names one service, since that sets how long the appointment is. It is asked
 * as a dropdown on the appointment, starting on the one the search matched, rather than as a list
 * of tiles to read through first; each service's price is under "What it costs".
 *
 * <p>Stays a server component: only the two interactive parts ship JavaScript, and `calendar`
 * arrives as a node so the page above decides what suspends while the diary is read.
 */
export function BusinessProfile({
  profile,
  picked,
  month,
  at,
  job,
  calendarAsked,
  calendar,
}: {
  profile: PublicBusinessProfile;
  /** The service the URL names, already checked against `profile.services`, or null. */
  picked: string | null;
  /** The month the URL carries, or null when it carries none. */
  month: string | null;
  /** The time the URL carries, already read as an instant, or null. */
  at: string | null;
  /** What the customer typed into the search, or null when they came some other way. */
  job: string | null;
  /** Whether "Show all availability" was pressed, or the page was opened on the calendar. */
  calendarAsked: boolean;
  calendar: React.ReactNode;
}) {
  const services = profile.services ?? [];
  const licenses = profile.licenses ?? [];
  const trades = profile.trades ?? [];

  const pickedService = services.find((service) => service.id === picked);

  const primary = trades.find((trade) => trade.id === profile.primaryTradeId);
  const others = trades.filter((trade) => trade.id !== profile.primaryTradeId);

  return (
    // The canvas and the white cards on it are the search's own look, so the page a card opens
    // reads as the same place rather than a different site.
    <section className="bg-canvas pb-20 pt-8">
      <div className="mx-auto max-w-[860px] px-6">
        <BackToResults className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-500 no-underline" />

        <div className={`mb-9 p-6 ${CARD}`}>
          <header className="flex flex-wrap items-start gap-5">
            <div
              className="grid size-[68px] shrink-0 place-items-center rounded-full text-[22px] font-bold tracking-[-0.02em] text-white"
              style={{ background: colorOf(profile.slug) }}
            >
              {initialsOf(profile.displayName)}
            </div>

            <div className="min-w-[240px] flex-1">
              <h1 className="mb-1.5 text-[clamp(26px,3vw,34px)] font-extrabold tracking-[-0.03em]">
                {profile.displayName}
              </h1>

              <p className="m-0 flex flex-wrap items-center gap-2 text-[14.5px] text-muted-ink">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-faint" aria-hidden="true" />
                  {profile.city}, {profile.state}
                </span>
                {profile.websiteUrl && (
                  <>
                    <span className="text-[#CBD6E2]">•</span>
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 font-medium text-brand-500"
                    >
                      <Globe className="size-4" aria-hidden="true" />
                      Website
                    </a>
                  </>
                )}
              </p>

              {(primary || others.length > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {primary && (
                    <Badge className="h-auto rounded-full border-transparent bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-500">
                      {primary.displayName}
                    </Badge>
                  )}
                  {others.map((trade) => (
                    <Badge
                      key={trade.id}
                      className="h-auto rounded-full border border-line bg-white px-3 py-1 text-[12px] font-medium text-muted-ink"
                    >
                      {trade.displayName}
                    </Badge>
                  ))}
                </div>
              )}

              {/*
                Said only when it is true. An explicit "not licensed" would be a claim this data
                cannot support — plenty of trades need no licence in plenty of states, and a profile
                completed before the licence step reads exactly the same way.
              */}
              {licenses.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] font-medium text-muted-ink">
                  <span className="inline-flex items-center gap-1">
                    <BadgeCheck className="size-3.5 text-go" aria-hidden="true" />
                    Licensed
                  </span>
                </div>
              )}
            </div>
          </header>

          {profile.description && (
            <p className="m-0 mt-5 max-w-[64ch] whitespace-pre-line border-t border-line pt-5 text-[15px] leading-relaxed text-muted-ink">
              {profile.description}
            </p>
          )}
        </div>

        {at && pickedService && (
          <ChosenTime
            slug={profile.slug}
            service={pickedService}
            at={at}
            job={job}
            timeZone={profile.timeZone}
            calendarAsked={calendarAsked}
            select={
              <ServiceSelect
                slug={profile.slug}
                services={services}
                picked={pickedService.id}
                month={month}
                at={at}
                job={job}
                calendarOpen={calendarAsked}
              />
            }
          />
        )}

        {calendar && pickedService && (
          <Section
            id="when"
            title="When they are free"
            // With no appointment card above, the service is asked here, where the calendar is.
            aside={
              !at && (
                <ServiceSelect
                  slug={profile.slug}
                  services={services}
                  picked={pickedService.id}
                  month={month}
                  at={null}
                  job={job}
                  calendarOpen={calendarAsked}
                />
              )
            }
          >
            {calendar}
          </Section>
        )}

        <Section title="What it costs">
          <dl className={`m-0 grid grid-cols-1 gap-x-8 gap-y-3.5 p-6 sm:grid-cols-2 ${CARD}`}>
            {[...serviceRows(services, profile.pricing), ...terms(profile.pricing)].map((term) => (
              <div key={term.label} className="border-b border-line pb-3.5">
                <dt className="text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{term.label}</dt>
                <dd className="m-0 mt-1 text-[14.5px] text-brand">{term.value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {licenses.length > 0 && (
          <Section title="Licences on file">
            <ul className={`m-0 flex list-none flex-col p-0 ${CARD}`}>
              {licenses.map((license) => (
                <li
                  key={`${license.state}-${license.licenseNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-line px-6 py-4 not-last:border-b"
                >
                  <span className="text-[14.5px]">
                    <strong className="font-semibold">{license.state}</strong> · {license.licenseNumber}
                    {license.licenseType && <span className="text-muted-ink"> · {license.licenseType}</span>}
                  </span>
                  {/* The licence as entered, and nothing about checking it: nothing checks it yet. */}
                  {license.expiresOn && (
                    <span className="text-[13px] text-faint">Expires {expiry(license.expiresOn)}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </section>
  );
}

/**
 * The time picked on a search card, said plainly under the business it is with, with the two
 * things to do about it: request it, or open the whole calendar to choose another. The calendar
 * stays closed until asked for, so the page reads as "this appointment" rather than a diary.
 */
function ChosenTime({
  slug,
  service,
  at,
  job,
  timeZone,
  calendarAsked,
  select,
}: {
  slug: string;
  service: PublicService;
  at: string;
  job: string | null;
  timeZone: string;
  calendarAsked: boolean;
  /** The service dropdown, or nothing when there is only one service to book. */
  select: React.ReactNode;
}) {
  const carried: Record<string, string> = job ? { job } : {};
  const calendar = new URLSearchParams({ service: service.id, at, calendar: "1", ...carried });

  return (
    <div className="mb-9 rounded-3xl border border-brand-100 bg-brand-50 px-6 py-5 shadow-card">
      {/* What they searched for is what they are booking; the service is the business's word for it. */}
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-faint">Your appointment</p>
      <h2 className="m-0 mt-1 text-[20px] font-bold tracking-[-0.02em] text-brand">{job ?? service.name}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="m-0 inline-flex items-center gap-2 text-[15px] font-semibold text-brand">
          <Calendar className="size-4.5 shrink-0 text-brand-500" aria-hidden="true" />
          {dayLabel(dayOf(at, timeZone))}, {spanLabel(at, service.estimatedDurationMinutes, timeZone)}
        </p>
        {select}
      </div>
      <p className="m-0 mt-1 text-[12.5px] text-muted-ink">Times are {timeZone}, the tradesperson&apos;s own clock.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {!calendarAsked && (
          <Link
            href={`${proPath(slug)}?${calendar}#when`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-500 no-underline transition-colors hover:border-brand-100"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Show all availability
          </Link>
        )}
        <Link
          href={`${proPath(slug)}/book?${new URLSearchParams({ service: service.id, at, ...carried })}`}
          className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-white no-underline"
        >
          Request this appointment
        </Link>
      </div>
    </div>
  );
}

/** What the service list is waiting on — and, when a time came with the link, which time it is for. */
/** Each service with its price and how long it takes — what the tiles above the calendar used to say. */
function serviceRows(services: PublicService[], pricing: Pricing): { label: string; value: string }[] {
  return services.map((service) => ({
    label: service.name,
    value: `${priceOf(service, pricing)} · ${duration(service.estimatedDurationMinutes)}`,
  }));
}

/** The booking cards' surface: white, rounded, lifted a little off the canvas. */
const CARD = "rounded-3xl border border-line bg-white shadow-card";

function Section({
  id,
  title,
  aside,
  children,
}: {
  id?: string;
  title: string;
  /** Beside the title, at its right. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-9 scroll-mt-24">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

/**
 * The terms, as rows that exist only when they say something.
 *
 * An hourly rate nobody has set is left out rather than shown as unknown: the search takes the
 * same line, because a row reading "not published" invites a reader to hold it against the
 * business when it is only a step of the wizard they have not reached.
 */
function terms(pricing: Pricing): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  if (pricing.hourlyRate) {
    rows.push({ label: "Hourly rate", value: `${money(pricing.hourlyRate)}/hr` });
  }

  rows.push({ label: "Minimum billed", value: duration(pricing.minimumBillableMinutes) });
  rows.push({ label: "Billed in", value: `${pricing.billingIncrementMinutes} min steps` });

  if (pricing.serviceCallFee) {
    rows.push({
      label: "Service call fee",
      value: pricing.serviceCallFeeWaivedIfHired
        ? `${money(pricing.serviceCallFee)}, waived if you hire them`
        : money(pricing.serviceCallFee),
    });
  }

  rows.push({ label: "Travel", value: travel(pricing) });
  rows.push({ label: "Materials", value: materials(pricing) });

  // Last, and always present. It is the one number a customer has to have read before sending a
  // request: the fee is recorded on the request as it is sent, so what was shown is what binds.
  rows.push({ label: "Cancellation", value: cancellation(pricing) });

  return rows;
}

function travel(pricing: Pricing): string {
  switch (pricing.travelFeeMode) {
    case "INCLUDED":
      return "Included";
    case "FLAT":
      return pricing.travelFlatFee ? `${money(pricing.travelFlatFee)} per visit` : "Flat fee";
    case "PER_MILE": {
      const rate = pricing.travelRatePerMile ? `${money(pricing.travelRatePerMile)} per mile` : "Charged per mile";
      return pricing.freeTravelRadiusMiles
        ? `${rate}, free within ${pricing.freeTravelRadiusMiles} miles`
        : rate;
    }
  }
}

function materials(pricing: Pricing): string {
  switch (pricing.materialPricingMode) {
    case "INCLUDED":
      return "Included";
    case "AT_COST":
      return "Billed at cost";
    case "COST_PLUS_MARKUP":
      return pricing.materialMarkupPercent
        ? `At cost plus ${amount(pricing.materialMarkupPercent)}%`
        : "At cost plus a markup";
    case "NOT_PROVIDED":
      return "You supply the materials";
  }
}

/**
 * Hours rather than "the day before", because that is what the contract stores and what a
 * subtraction can answer. A fee of nothing is said as free — printing $0 makes a reader look for
 * the catch.
 */
function cancellation(pricing: Pricing): string {
  if (Number(pricing.cancellationFee) === 0) {
    return "Free to cancel";
  }

  return pricing.cancellationNoticeHours > 0
    ? `${money(pricing.cancellationFee)} within ${pricing.cancellationNoticeHours} hours of the appointment`
    : `${money(pricing.cancellationFee)} to cancel`;
}

/**
 * A date read as a plain calendar day, not as an instant.
 *
 * `new Date("2027-03-01")` is midnight UTC, which in Denver is the evening of February 28th — so
 * the parts are read back in UTC rather than in whichever zone the renderer happens to sit in.
 * An expiry printed a day early is a licence that looks lapsed while it is not.
 */
function expiry(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" })
    .format(new Date(date));
}
