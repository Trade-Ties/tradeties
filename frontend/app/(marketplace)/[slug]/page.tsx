import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BusinessProfile } from "@/components/marketing/BusinessProfile";
import { ServiceCalendar } from "@/components/marketing/ServiceCalendar";
import { isMonth, monthIn, monthWindow } from "@/components/marketing/availability";
import { getAvailability, getBusiness, type PublicService } from "@/lib/api/marketplace";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * A business's public page, at the address the contract freezes at the first publish:
 * `/{slug}`, at the root.
 *
 * <p>Every other route is a folder of its own and wins over this one, which is why a slug that
 * shares a name with one of them could never be reached here — and why the backend refuses those
 * names (`ReservedSlugs`) rather than this page trying to tell them apart.
 *
 * <p>Read on the server and without a token, like the search. Nothing on it depends on who is
 * looking, which is the property that lets it stay cacheable and the reason a signed-in
 * tradesperson sees exactly what a stranger sees.
 *
 * <p>Which service and which month the calendar shows are read out of the query, not out of a
 * client that fetched them: a request is for exactly one service, so the whole question fits in
 * an address that can be shared and reloaded.
 */
export default async function ProfilePage({
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
        <Unreachable />
        <SiteFooter />
      </>
    );
  }

  // A slug nobody holds, a draft and a suspension are one answer from the backend, and they stay
  // one answer here. Telling them apart would publish a moderation decision to anybody who can
  // type a URL — and to this page they are the same fact anyway: there is nothing to show.
  if (result.data === null) {
    notFound();
  }

  const profile = result.data;

  // Checked against the profile rather than sent on: a service this business does not offer is
  // a 400 at the backend, and it can only arrive from a stale link — which deserves the page
  // without a calendar, not a round trip spent on being refused.
  const asked = firstValue(query.service);
  const service = profile.services.find((offered) => offered.id === asked) ?? null;

  const wanted = firstValue(query.month);
  const month = isMonth(wanted) ? wanted : null;

  // Today where the tradesperson works, never where the reader is. Read once here and handed
  // down as a prop, so there is no second clock in the browser to disagree with this one.
  const showing = month ?? monthIn(profile.timeZone, new Date());

  return (
    <>
      <SiteHeader />
      <BusinessProfile
        profile={profile}
        picked={service?.id ?? null}
        month={month}
        calendar={
          service && (
            // Keyed so a different service or month is a fresh calendar: the chosen time lives in
            // that subtree, and carrying it across would leave an hour selected that belongs to a
            // month nobody is looking at any more.
            <Suspense key={`${service.id}-${showing}`} fallback={<Reading />}>
              <Diary slug={slug} service={service} month={showing} />
            </Suspense>
          )
        }
      />
      <SiteFooter />
    </>
  );
}

/**
 * The diary itself, read on the server.
 *
 * Its own component so that only this part suspends: the profile is on screen while the openings
 * are still being counted, rather than the whole page waiting on them.
 */
async function Diary({
  slug,
  service,
  month,
}: {
  slug: string;
  service: PublicService;
  month: string;
}) {
  const { from, to } = monthWindow(month);
  const result = await getAvailability(slug, service.id, from, to);

  // A 404 here is the profile going down between the two reads. Both that and a backend that
  // refused say the same thing to the reader: there is no diary to show, and it is not their
  // doing. The profile above them is still worth reading.
  if (!result.ok || result.data === null) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-canvas px-6 py-12 text-center text-[14.5px] text-muted-ink">
        We could not read their calendar just now. That is on us — reloading usually works.
      </p>
    );
  }

  return (
    <ServiceCalendar
      slug={slug}
      serviceId={service.id}
      serviceName={service.name}
      month={month}
      availability={result.data}
    />
  );
}

function Reading() {
  return (
    <p className="rounded-3xl border border-line bg-white px-6 py-12 text-center text-[14.5px] text-muted-ink">
      Reading their calendar…
    </p>
  );
}

/**
 * The title is what a shared link shows, so it names the business rather than the site.
 *
 * The profile is fetched a second time here, which the request cache collapses into the one call
 * the page itself makes.
 */
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

  return {
    title: `${result.data.displayName} — ${result.data.city}, ${result.data.state} | TradeTies`,
    description: result.data.description ?? undefined,
  };
}

/**
 * Separate from the not-found page on purpose. "This business does not exist" and "we could not
 * reach TradeTies" send somebody to two different places, and only one of them is worth retrying.
 */
function Unreachable() {
  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">
          We could not load that profile.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
          That is on us, not on the address you typed. Trying again usually works.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
        >
          Start a new search
        </Link>
      </div>
    </section>
  );
}
