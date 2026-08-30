import Link from "next/link";

import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SearchResults } from "@/components/marketing/SearchResults";
import { INVALID_SELECTION } from "@/lib/api/failure";
import { searchBusinesses } from "@/lib/api/marketplace";

/**
 * What the hero search leads to.
 *
 * A route of its own rather than results grafted onto `/`, because the whole search lives in the
 * URL: it can be shared, reloaded and reached with the back button, and two people who send each
 * other a link see the same thing. It is also what lets this stay a server component — the answer
 * depends on nothing but the query string.
 *
 * `when` is read off the URL and deliberately not sent to the search. Availability belongs to a
 * slot rather than to a business, and slots are chosen on the profile; carrying the answer forward
 * is honest, filtering a list by it would not be.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const zip = single(params.zip);
  const job = single(params.job);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 py-10">
        {zip ? <Found zip={zip} job={job} /> : <NothingAsked />}
      </main>
    </>
  );
}

async function Found({ zip, job }: { zip: string; job: string | null }) {
  const result = await searchBusinesses(zip, job);

  // A postal code the backend cannot place is the one failure worth its own words — and it is
  // recognised by its problem type, not by the status. A description over the length the contract
  // allows answers 400 as well, and explaining that as "we do not know your ZIP code" would send
  // somebody to correct an address that was right: the wrong lesson this whole refusal exists to
  // avoid teaching.
  if (!result.ok) {
    const unknownZip = result.failure.type === INVALID_SELECTION;

    return (
      <Empty
        heading={
          unknownZip ? `We don${"’"}t know the ZIP code ${zip}.` : "We could not run that search."
        }
        body={
          unknownZip
            ? "Check the five digits and try again — a mistyped code looks exactly like an area with nobody in it."
            : "That search did not go through. Trying again usually works — the button below starts a fresh one."
        }
      />
    );
  }

  return <SearchResults zip={zip} job={job} found={result.data} />;
}

/** Reached by editing the URL, or by a link that lost its query. */
function NothingAsked() {
  return (
    <Empty
      heading="Tell us where you are."
      body="A search needs a ZIP code — it is what decides which tradespeople travel to you."
    />
  );
}

function Empty({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mx-auto max-w-[540px] py-16 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight text-brand">{heading}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">{body}</p>
      <Link
        href="/"
        className="mt-7 inline-block rounded-2xl bg-brand px-6 py-3 text-[15px] font-semibold text-white"
      >
        Start a new search
      </Link>
    </div>
  );
}

/** A query parameter given twice is a hand-edited URL, not a case to design for. */
function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
