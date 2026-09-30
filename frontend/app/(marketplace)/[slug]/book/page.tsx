import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, Pencil } from "lucide-react";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BookingForm } from "@/components/marketing/BookingForm";
import { dayLabel, dayOf, instantOf, spanLabel } from "@/components/marketing/availability";
import { getBusiness } from "@/lib/api/marketplace";
import { proPath } from "@/lib/routes";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
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
  // Nothing here decides whether the slot is still free, and it must not try. The server checks
  // that when the request is sent, against the walk that offered it — a second check here would
  // be a second answer to the same question, taken a moment earlier and no more true for it.
  const startsAt = instantOf(firstValue(query.at));
  // What the customer searched for, carried here so the description starts from it.
  const job = firstValue(query.job).trim().slice(0, 200);

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
      <section className="bg-canvas pb-20 pt-8">
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

          {/*
            What is being asked for, stated the way the booking dialogue states it, with the one
            way to change it: back to the calendar, the time still chosen, rather than starting over.
          */}
          <div className="mb-6 mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 shadow-sm">
            <Calendar className="size-4.5 shrink-0 text-brand-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[15px] font-semibold text-brand">
                {dayLabel(dayOf(startsAt, profile.timeZone))},{" "}
                {spanLabel(startsAt, service.estimatedDurationMinutes, profile.timeZone)}
              </p>
              <p className="m-0 mt-0.5 text-[13px] text-muted-ink">
                {service.name} with {profile.displayName} · times are {profile.timeZone}
              </p>
            </div>
            <Link
              href={`${proPath(slug)}?${new URLSearchParams({ service: service.id, at: startsAt, calendar: "1", ...(job ? { job } : {}) })}#when`}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-[13px] font-semibold text-brand-500 no-underline transition-colors hover:border-brand-100 hover:bg-brand-50"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Change
            </Link>
          </div>

          <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
            <BookingForm
              slug={slug}
              businessName={profile.displayName}
              serviceId={service.id}
              serviceName={service.name}
              startsAt={startsAt}
              cancellationFee={profile.pricing.cancellationFee}
              cancellationNoticeHours={profile.pricing.cancellationNoticeHours}
              description={job}
            />
          </div>
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
