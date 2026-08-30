import { Card } from "@/components/ui/card";
import type { BusinessSearchResult, BusinessSearchResults } from "@/lib/api/marketplace";

/**
 * The answer to one search: what was found, and what the description was understood as.
 *
 * The second is not decoration. A customer who typed "kitchen sink is leaking under the cabinet"
 * and sees four plumbers has no way of knowing whether the sentence was read the way they meant
 * it — and a short list means something different depending on the answer.
 */
export function SearchResults({
  zip,
  job,
  found,
}: {
  zip: string;
  job: string | null;
  found: BusinessSearchResults;
}) {
  const trades = found.matchedTrades ?? [];
  const results = found.results ?? [];

  return (
    <>
      <header className="border-b border-line pb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-brand">
          {results.length === 0
            ? `No one available near ${zip}`
            : `${results.length} ${results.length === 1 ? "tradesperson" : "tradespeople"} near ${zip}`}
        </h1>

        {job ? <Understood job={job} trades={trades} /> : null}
      </header>

      {results.length === 0 ? (
        <p className="max-w-[540px] py-12 text-[15px] leading-relaxed text-muted-ink">
          {trades.length > 0
            ? `Nobody offering ${trades.map((t) => t.displayName).join(" or ")} travels to ${zip} yet.
               Searching without a description shows everyone who does.`
            : `No tradesperson travels to ${zip} yet. The marketplace is new — this is a gap in who has
               signed up, not in what you asked.`}
        </p>
      ) : (
        <ul className="grid gap-3 py-7 sm:grid-cols-2">
          {results.map((result) => (
            <li key={result.slug}>
              <Result result={result} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * What the description was read as, in plain words rather than as buttons.
 *
 * They are not clickable on purpose. Narrowing to one of several would mean asking the search for
 * a trade, and the contract takes a description — so a chip that looked pressable would either do
 * nothing or quietly re-run a different search. Saying what happened is honest; the choice becomes
 * a choice when the API can take one.
 */
function Understood({ job, trades }: { job: string; trades: BusinessSearchResults["matchedTrades"] }) {
  if (trades.length === 0) {
    return (
      <p className="mt-2 text-[14.5px] text-muted-ink">
        We could not tell which trade <span className="text-brand">“{job}”</span> needs, so this is
        everyone who travels to you.
      </p>
    );
  }

  return (
    <p className="mt-2 text-[14.5px] text-muted-ink">
      <span className="text-brand">“{job}”</span> read as{" "}
      <span className="font-medium text-brand">{trades.map((t) => t.displayName).join(" · ")}</span>
      {trades.length > 1 ? " — the description fits more than one, so all of them are shown." : null}
    </p>
  );
}

/**
 * Deliberately not a link. The public profile at `/pro/{slug}` does not exist yet, and a card that
 * navigates to a 404 is worse than one that does not navigate — the slug is carried in the data
 * and this becomes a link the day there is somewhere to go.
 */
function Result({ result }: { result: BusinessSearchResult }) {
  return (
    <Card className="h-full gap-0 rounded-2xl border-line p-5">
      <p className="text-[16.5px] font-semibold text-brand">{result.displayName}</p>

      {result.primaryTrade ? (
        <p className="mt-1 text-[14px] text-muted-ink">{result.primaryTrade}</p>
      ) : null}

      <p className="mt-4 text-[13.5px] text-faint">
        {result.city}, {result.state} · {miles(result.distanceMiles)}
      </p>
    </Card>
  );
}

/**
 * Whole miles, and "under a mile" below one.
 *
 * A decimal place would be a lie about a number measured between two postal-code centres: the
 * distance is honest enough to order a list by and not honest enough to print as 3.4.
 */
function miles(distance: number): string {
  return distance < 1 ? "under a mile away" : `${Math.round(distance)} miles away`;
}
