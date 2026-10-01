import { ArrowRight, BadgeCheck, Calendar, CalendarDays, CalendarRange, Clock, Globe, MapPin, Navigation, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { AppointmentRequest } from "@/components/marketing/AppointmentRequest";
import { BackToResults } from "@/components/marketing/BackToResults";
import { ServiceSelect } from "@/components/marketing/ServiceSelect";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { amount, cancellation, colorOf, duration, initialsOf, money, priceOf } from "@/components/marketing/business-format";
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
  description,
  calendarAsked,
  calendar,
  upcoming = null,
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
  /** What needs doing, as the booking page's "Change" brings it back, or null. */
  description: string | null;
  /** Whether "Show all availability" was pressed, or the page was opened on the calendar. */
  calendarAsked: boolean;
  calendar: React.ReactNode;
  /** The next open times of the chosen service, for the profile's booking card; null when not read. */
  upcoming?: string[] | null;
}) {
  const services = profile.services ?? [];
  const licenses = profile.licenses ?? [];
  const trades = profile.trades ?? [];

  const pickedService = services.find((service) => service.id === picked);
  // Opened with neither a time nor the calendar asked for: "View full profile", or a shared link.
  const profileMode = !at && !calendarAsked;

  const primary = trades.find((trade) => trade.id === profile.primaryTradeId);
  const others = trades.filter((trade) => trade.id !== profile.primaryTradeId);

  // Whether "About" has anything to say: a backend older than this page sends none of it.
  const hasAbout = Boolean(profile.serviceRadiusMiles || profile.onTradeTiesSince || profile.booking || trades.length > 1);

  const licenseList = licenses.length > 0 && (
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
            {license.expiresOn && <span className="text-[13px] text-faint">Expires {expiry(license.expiresOn)}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );

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
            // The line across the whole card, the text kept to a readable measure inside it.
            <div className="mt-5 border-t border-line pt-5">
              <p className="m-0 max-w-[64ch] whitespace-pre-line text-[15px] leading-relaxed text-muted-ink">
                {profile.description}
              </p>
            </div>
          )}

          {/*
            What the overview card has no room for, on the business's own card: how far they travel,
            how long they have been here, and how far ahead they can be booked — which is why tomorrow
            morning may not be on offer. Each fact only when sent: an older backend sends none.
          */}
          {profileMode && hasAbout && (
            <ul className="m-0 mt-5 grid list-none grid-cols-1 gap-x-8 gap-y-4 border-t border-line p-0 pt-5 sm:grid-cols-2">
              {profile.serviceRadiusMiles && (
                <AboutFact icon={Navigation} label="Travels">
                  Within {profile.serviceRadiusMiles} miles of {profile.city}, {profile.state}
                </AboutFact>
              )}
              {profile.onTradeTiesSince && (
                <AboutFact icon={Sparkles} label="On TradeTies since">
                  {sinceLabel(profile.onTradeTiesSince)}
                </AboutFact>
              )}
              {profile.booking && (
                <>
                  <AboutFact icon={Clock} label="Notice needed">
                    {noticeLabel(profile.booking.minNoticeHours)}
                  </AboutFact>
                  <AboutFact icon={CalendarRange} label="Books ahead">
                    Up to {profile.booking.horizonDays} days
                  </AboutFact>
                </>
              )}
              {trades.length > 1 && (
                <AboutFact icon={Wrench} label="Trades">
                  {trades.map((trade) => trade.displayName).join(", ")}
                </AboutFact>
              )}
            </ul>
          )}
        </div>

        {at && pickedService && (
          <ChosenTime
            slug={profile.slug}
            businessName={profile.displayName}
            service={pickedService}
            at={at}
            job={job}
            description={description}
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

        {profileMode ? (
          /*
            The profile proper — opened from "View full profile" rather than from a time. One
            column, read top to bottom: how to book them first, then what they do, when they work
            and what it costs, and their licence when they hold one.
          */
          <>
            <Section title="Book an appointment">
              <div className="rounded-3xl border border-brand-100 bg-brand-50 p-6 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-[16px] font-semibold text-brand">Book {profile.displayName}</p>
                    <p className="m-0 mt-0.5 text-[13.5px] text-muted-ink">
                      {upcoming && upcoming.length > 0
                        ? `Next open times${pickedService ? ` for ${pickedService.name}` : ""} — pick one, or see them all.`
                        : "See every open time and pick the one that suits you."}
                    </p>
                  </div>
                  <Link
                    href={`${proPath(profile.slug)}?${new URLSearchParams({
                      ...(pickedService ? { service: pickedService.id } : {}),
                      calendar: "1",
                      ...(job ? { job } : {}),
                    })}#when`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-white no-underline"
                  >
                    <CalendarDays className="size-4" aria-hidden="true" />
                    See all available times
                  </Link>
                </div>
                {upcoming && upcoming.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {upcoming.map((at) => (
                      <Link
                        key={at}
                        href={`${proPath(profile.slug)}?${new URLSearchParams({
                          ...(pickedService ? { service: pickedService.id } : {}),
                          at,
                          ...(job ? { job } : {}),
                        })}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-brand-100 bg-white px-1.5 py-2 font-mono text-[12.5px] font-medium text-brand no-underline transition-colors hover:border-brand hover:bg-brand hover:text-white"
                      >
                        {isToday(at, profile.timeZone) && (
                          <span aria-hidden="true" className="animate-tt-pulse size-1.5 shrink-0 rounded-full bg-go" />
                        )}
                        {slotLabel(at, profile.timeZone)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* Each service opens the calendar for itself: picking what to book is the first step of booking it. */}
            {services.length > 0 && (
              <Section title="Services">
                <ul className={`m-0 flex list-none flex-col p-0 ${CARD}`}>
                  {services.map((service) => (
                    <li key={service.id} className="border-line not-last:border-b">
                      <Link
                        href={`${proPath(profile.slug)}?${new URLSearchParams({
                          service: service.id,
                          calendar: "1",
                          ...(job ? { job } : {}),
                        })}#when`}
                        className="group flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-6 py-4 no-underline transition-colors hover:bg-brand-50/60"
                      >
                        <div className="min-w-[200px] flex-1">
                          <p className="m-0 text-[15px] font-semibold text-brand group-hover:text-brand-500">{service.name}</p>
                          {service.description && (
                            <p className="m-0 mt-0.5 text-[13.5px] leading-relaxed text-muted-ink">{service.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="m-0 whitespace-nowrap text-[14px] text-brand">
                            <span className="font-semibold">{priceOf(service, profile.pricing)}</span>
                            <span className="text-muted-ink"> · {duration(service.estimatedDurationMinutes)}</span>
                          </p>
                          <p className="m-0 mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-500">
                            Book this
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/*
              One day to a row, Monday to Sunday, read straight down; a day worked in two stretches —
              a lunch break — shows them one under the other rather than run together on one line.
            */}
            <Section title="Working hours">
              <dl className={`m-0 flex flex-col px-6 py-2 ${CARD}`}>
                {(profile.workingHours ?? []).map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="flex items-start justify-between gap-6 border-line py-3 not-last:border-b"
                  >
                    <dt className="text-[14.5px] font-semibold text-brand">{WEEKDAYS[day.dayOfWeek - 1]}</dt>
                    <dd className="m-0 flex flex-col items-end gap-1 text-[14.5px] tabular-nums">
                      {day.blocks.length === 0 ? (
                        // Flush right, where every day's last time ends.
                        <span className="text-faint">Closed</span>
                      ) : (
                        // Start, dash and end each in a column just wide enough for "12:00 PM", both times
                        // right-aligned in theirs — so every dash sits under the one above it and every
                        // "AM" and "PM" lines up on the right, on every day.
                        day.blocks.map((block) => (
                          <span key={block.startsAt} className="grid grid-cols-[7.4ch_1.75ch_7.4ch] text-brand">
                            <span className="text-right">{clock(block.startsAt)}</span>
                            <span className="text-center">–</span>
                            <span className="text-right">{clock(block.endsAt)}</span>
                          </span>
                        ))
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 mt-2 text-[12.5px] text-muted-ink">
                Times are {profile.timeZone}, the professional&apos;s own clock.
              </p>
            </Section>

            {/* Each service's price is listed under Services above, so only the general terms here. */}
            <Section title="What it costs">
              <dl className={`m-0 grid grid-cols-1 gap-x-8 gap-y-3.5 p-6 sm:grid-cols-2 ${CARD}`}>
                {terms(profile.pricing).map((term) => (
                  <div key={term.label} className="border-b border-line pb-3.5">
                    <dt className="text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{term.label}</dt>
                    <dd className="m-0 mt-1 text-[14.5px] text-brand">{term.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            {/* Not every trade needs one, and without one there is no section at all. */}
            {licenseList}
          </>
        ) : (
          <>
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

            {licenseList}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The time picked — on a search card or in the calendar — said plainly under the business it is
 * with, with what needs doing and the two things to do about it: request it, or open the whole
 * calendar to choose another. The calendar stays closed until asked for, so the page reads as
 * "this appointment" rather than a diary.
 */
function ChosenTime({
  slug,
  businessName,
  service,
  at,
  job,
  description,
  timeZone,
  calendarAsked,
  select,
}: {
  slug: string;
  businessName: string;
  service: PublicService;
  at: string;
  job: string | null;
  description: string | null;
  timeZone: string;
  calendarAsked: boolean;
  /** The service dropdown, or nothing when there is only one service to book. */
  select: React.ReactNode;
}) {
  const calendar = new URLSearchParams({ service: service.id, at, calendar: "1", ...(job ? { job } : {}) });

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
      <p className="m-0 mt-1 text-[12.5px] text-muted-ink">Times are {timeZone}, the professional&apos;s own clock.</p>

      <AppointmentRequest
        slug={slug}
        serviceId={service.id}
        serviceName={service.name}
        businessName={businessName}
        at={at}
        job={job}
        description={description}
        calendarHref={calendarAsked ? null : `${proPath(slug)}?${calendar}#when`}
      />
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

/** "Fri 9:00 AM", or the time alone for today — as the search cards print an opening. */
function slotLabel(at: string, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(at));
  if (isToday(at, timeZone)) return time;
  return `${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(at))} ${time}`;
}

function isToday(at: string, timeZone: string): boolean {
  const day = (when: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(when);
  return day(new Date(at)) === day(new Date());
}

function AboutFact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50">
        <Icon className="size-4 text-brand-500" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{label}</span>
        <span className="block text-[14.5px] text-brand">{children}</span>
      </span>
    </li>
  );
}

/** "2026-09-14" as "September 2026" — read as a calendar day, not shifted by the reader's zone. */
function sinceLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(date));
}

/** Hours of notice in the words somebody would use: none, "a day", "2 days", "6 hours". */
function noticeLabel(hours: number): string {
  if (hours === 0) return "None — same-day bookings welcome";
  if (hours % 24 === 0) return hours === 24 ? "A day's notice" : `${hours / 24} days' notice`;
  return `${hours} hours' notice`;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "08:00" as "8:00 AM", and the end of the day, "24:00", as midnight. */
function clock(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === 24) return "midnight";
  const half = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${half}`;
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
