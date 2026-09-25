import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BookingForm } from "@/components/marketing/BookingForm";
import { dayLabel, dayOf, spanLabel } from "@/components/marketing/availability";
import { getBusiness } from "@/lib/api/marketplace";
import { proPath } from "@/lib/routes";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Nothing here decides whether the slot is still free, and it must not try. The server checks
 * that when the request is sent, against the walk that offered it — a second check here would be
 * a second answer to the same question, taken a moment earlier and no more true for it.
 */
function instantOrNull(value: string): string | null {
  if (value === "") {
    return null;
  }

  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * Where a chosen time turns into a request.
 *
 * <p>A page rather than a dialogue on the profile, because the form is nine fields and a customer
 * filling one in has stopped browsing. Its whole input is in the address — the business, the
 * service and the start — so the step is reachable, shareable and survives a reload, exactly as
 * the calendar before it is.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const result = await getBusiness(slug);

  if (!result.ok) {
    return (
      <>
        <SiteHeader />
        <Unreachable slug={slug} />
        <SiteFooter />
      </>
    );
  }

  if (result.data === null) {
    notFound();
  }

  const profile = result.data;
  const service = profile.services.find((offered) => offered.id === firstValue(query.service));
  const startsAt = instantOrNull(firstValue(query.at));

  // Arriving without a service or without a time is not an error, it is an unfinished step —
  // reached by a bookmark, or by an address somebody trimmed. The calendar is where both are
  // answered, so that is where this sends them rather than showing a form it cannot fill in.
  if (!service || !startsAt) {
    return (
      <>
        <SiteHeader />
        <Incomplete slug={slug} name={profile.displayName} />
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <section className="pb-20 pt-8">
        <div className="mx-auto max-w-[680px] px-6">
          <Link
            href={`${proPath(slug)}?service=${service.id}`}
            className="mb-6 inline-block text-[14px] font-semibold text-brand-500 no-underline"
          >
            ← Back to {profile.displayName}
          </Link>

          <h1 className="mb-1.5 text-[clamp(24px,3vw,30px)] font-extrabold tracking-[-0.03em]">
            Request this appointment
          </h1>
          <p className="mb-7 text-[15px] leading-relaxed text-muted-ink">
            {service.name} with {profile.displayName} on{" "}
            <span className="font-semibold text-brand">{dayLabel(dayOf(startsAt, profile.timeZone))}</span>,{" "}
            <span className="font-semibold text-brand">
              {spanLabel(startsAt, service.estimatedDurationMinutes, profile.timeZone)}
            </span>{" "}
            ({profile.timeZone}).
          </p>

          <BookingForm
            slug={slug}
            businessName={profile.displayName}
            serviceId={service.id}
            serviceName={service.name}
            startsAt={startsAt}
            cancellationFee={profile.pricing.cancellationFee}
            cancellationNoticeHours={profile.pricing.cancellationNoticeHours}
          />
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getBusiness(slug);

  if (!result.ok || result.data === null) {
    return { title: "TradeTies" };
  }

  return { title: `Request an appointment with ${result.data.displayName} | TradeTies` };
}

function Incomplete({ slug, name }: { slug: string; name: string }) {
  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">
          Pick a service and a time first.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
          A request is for one job at one time, so {name} needs both before you can send one.
        </p>
        <Link
          href={proPath(slug)}
          className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
        >
          Open their calendar
        </Link>
      </div>
    </section>
  );
}

function Unreachable({ slug }: { slug: string }) {
  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">
          We could not load that page.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
          That is on us, not on the address you typed. Nothing has been sent — trying again usually
          works.
        </p>
        <Link
          href={proPath(slug)}
          className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
        >
          Back to the profile
        </Link>
      </div>
    </section>
  );
}
