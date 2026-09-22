import Link from "next/link";
import { ArrowLeft, BadgeCheck, Globe, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ServicePicker } from "@/components/marketing/ServicePicker";
import { amount, colorOf, duration, initialsOf, money } from "@/components/marketing/business-format";
import type { PublicBusinessProfile } from "@/lib/api/marketplace";

type Pricing = PublicBusinessProfile["pricing"];

/**
 * One tradesperson's own page: what they do, how long each job takes, and what it costs.
 *
 * <p>The duration on every service is the reason this page is read before any calendar. A slot
 * has no length until a service is chosen, so the openings cannot be drawn until the customer has
 * answered this page — which is also why the services are the first thing on it and not a list
 * under the rates.
 *
 * <p>Stays a server component: only the two interactive parts ship JavaScript, and `calendar`
 * arrives as a node so the page above decides what suspends while the diary is read.
 */
export function BusinessProfile({
  profile,
  picked,
  month,
  calendar,
}: {
  profile: PublicBusinessProfile;
  /** The service the URL names, already checked against `profile.services`, or null. */
  picked: string | null;
  /** The month the URL carries, or null when it carries none. */
  month: string | null;
  calendar: React.ReactNode;
}) {
  const services = profile.services ?? [];
  const licenses = profile.licenses ?? [];
  const trades = profile.trades ?? [];

  const primary = trades.find((trade) => trade.id === profile.primaryTradeId);
  const others = trades.filter((trade) => trade.id !== profile.primaryTradeId);

  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[860px] px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-500 no-underline"
        >
          <ArrowLeft className="size-4" />
          Back to search
        </Link>

        <header className="mb-9 flex flex-wrap items-start gap-5">
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
                {licenses.some((license) => license.verified) && (
                  <span className="inline-flex items-center gap-1">
                    <BadgeCheck className="size-3.5 text-go" aria-hidden="true" />
                    Licence verified
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {profile.description && (
          <p className="mb-9 max-w-[64ch] whitespace-pre-line text-[15.5px] leading-relaxed text-muted-ink">
            {profile.description}
          </p>
        )}

        <Section title={picked ? "What they do" : "What they do — pick one to see their diary"}>
          <ServicePicker
            slug={profile.slug}
            services={services}
            pricing={profile.pricing}
            picked={picked}
            month={month}
          />
        </Section>

        {calendar && <Section title="When they are free">{calendar}</Section>}

        <Section title="What it costs">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {terms(profile.pricing).map((term) => (
              <div key={term.label} className="border-b border-line pb-3.5">
                <dt className="text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{term.label}</dt>
                <dd className="m-0 mt-1 text-[14.5px] text-brand">{term.value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {licenses.length > 0 && (
          <Section title="Licences on file">
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {licenses.map((license) => (
                <li
                  key={`${license.state}-${license.licenseNumber}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4"
                >
                  <span className="text-[14.5px]">
                    <strong className="font-semibold">{license.state}</strong> · {license.licenseNumber}
                    {license.licenseType && <span className="text-muted-ink"> · {license.licenseType}</span>}
                  </span>
                  <span className="text-[13px] text-faint">
                    {/*
                      What TradeTies checked is the licence, and the badge says no more than that.
                      Anything broader would be claiming an identity check nobody has performed.
                    */}
                    {license.verified ? "Checked with the state" : "Not checked by TradeTies"}
                    {license.expiresOn && ` · expires ${expiry(license.expiresOn)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <h2 className="mb-3.5 text-[12px] font-bold uppercase tracking-[0.04em] text-faint">{title}</h2>
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
