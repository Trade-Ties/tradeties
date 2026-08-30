import { Suspense } from "react";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { BrowseProfessionals } from "@/components/marketing/BrowseProfessionals";
import { JobSearchResults } from "@/components/marketing/JobSearchResults";

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
  // show the simplified "results for your job" page instead of the full
  // filter-everything browse page. Visiting /browse directly (e.g. via
  // "Browse all professionals") has none of these set, so it keeps the
  // full experience unchanged.
  const cameFromSearch = job !== "" || zip !== "" || when !== "";

  return (
    <>
      <SiteHeader />
      {cameFromSearch ? (
        <JobSearchResults job={job} zip={zip} when={when} />
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
