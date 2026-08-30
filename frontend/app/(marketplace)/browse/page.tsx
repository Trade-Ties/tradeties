import { Suspense } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BrowseProfessionals } from "@/components/marketing/BrowseProfessionals";
import { JobSearchResults } from "@/components/marketing/JobSearchResults";
import { INVALID_SELECTION } from "@/lib/api/failure";
import { searchBusinesses } from "@/lib/api/marketplace";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const job = firstValue(params.job);
  const zip = firstValue(params.zip);
  const when = firstValue(params.when);

  // Arriving with any of these means the hero search bar sent you here —
  // show the "results for your job" page instead of the full
  // filter-everything browse page. Visiting /browse directly (e.g. via
  // "Browse all professionals") has none of these set, so it keeps the
  // full experience unchanged.
  const cameFromSearch = job !== "" || zip !== "" || when !== "";

  return (
    <>
      <SiteHeader />
      {cameFromSearch ? (
        <Searched job={job} zip={zip} when={when} />
      ) : (
        // BrowseProfessionals reads its own initial state via
        // useSearchParams(), which the App Router requires a Suspense
        // boundary for.
        <Suspense fallback={<div className="pb-20 pt-10 text-center text-[14.5px] text-muted-ink">Loading…</div>}>
          <BrowseProfessionals />
        </Suspense>
      )}
      <SiteFooter />
    </>
  );
}

/**
 * The search itself, run on the server.
 *
 * Here rather than in the page so that only this part suspends: the header and footer are drawn
 * while the backend is still being asked, instead of the whole route waiting on it.
 *
 * The postal code is checked before the call, not because the backend would not refuse it, but
 * because there is nothing to ask about — a missing ZIP is reached by editing the URL or by a
 * link that lost its query, and it deserves an answer rather than a failed request.
 */
async function Searched({ job, zip, when }: { job: string; zip: string; when: string }) {
  if (zip.length !== 5) {
    return (
      <Empty
        heading="Tell us where you are."
        body="A search needs a ZIP code — it is what decides which tradespeople travel to you."
      />
    );
  }

  const result = await searchBusinesses(zip, job || null);

  // A postal code the backend cannot place is the one failure worth its own words — and it is
  // recognised by its problem type, not by the status. A description over the length the contract
  // allows answers 400 as well, and explaining that as "we do not know your ZIP code" would send
  // somebody to correct an address that was right: the wrong lesson this refusal exists to avoid.
  if (!result.ok) {
    const unknownZip = result.failure.type === INVALID_SELECTION;

    return (
      <Empty
        heading={unknownZip ? `We don${"’"}t know the ZIP code ${zip}.` : "We could not run that search."}
        body={
          unknownZip
            ? "Check the five digits and try again — a mistyped code looks exactly like an area with nobody in it."
            : "That search did not go through. Trying again usually works — the button below starts a fresh one."
        }
      />
    );
  }

  return <JobSearchResults job={job} zip={zip} when={when} found={result.data} />;
}

function Empty({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="pb-20 pt-8">
      <div className="mx-auto max-w-[540px] px-6 py-16 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">{heading}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">{body}</p>
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
