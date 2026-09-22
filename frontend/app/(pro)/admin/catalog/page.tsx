import { fetchTrades } from "@/lib/api/business";
import { fetchCatalogSuggestions, type SuggestionStatus } from "@/lib/api/admin";
import { portalToken } from "@/lib/portal/session";
import { SuggestionRow } from "@/components/admin/SuggestionRow";

const TABS: { status: SuggestionStatus; label: string }[] = [
  { status: "NEW", label: "To decide" },
  { status: "PROMOTED", label: "Promoted" },
  { status: "DISMISSED", label: "Dismissed" },
];

/**
 * The queue of phrases the catalogue has no name for.
 *
 * <p>The catalogue's 72 entries were derived from a development seed by somebody who had watched
 * no customers, and it showed — "Toilet is leaking" had no entry, and that was noticed by
 * accident. This page is where noticing stops being accidental: the search and the profile wizard
 * both write down what they could not name, and here somebody reads it and answers.
 *
 * <p>Staff only. The role is granted out of band and the backend is what checks it — a 403 from
 * there is what keeps this page shut, not anything on this side.
 */
export default async function CatalogQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const asked = (await searchParams).status;
  const status: SuggestionStatus = TABS.some((tab) => tab.status === asked)
    ? (asked as SuggestionStatus)
    : "NEW";

  const accessToken = await portalToken();
  const [suggestions, trades] = await Promise.all([
    fetchCatalogSuggestions(accessToken, status),
    fetchTrades(accessToken),
  ]);

  // One guard per read, and they cannot be folded together: narrowing each result separately is
  // what lets the render below reach `.data` at all — the same reason `loadOnboarding` spells its
  // out one at a time.
  if (!suggestions.ok) return <Unavailable detail={suggestions.failure.detail} />;
  if (!trades.ok) return <Unavailable detail={trades.failure.detail} />;

  return (
    <div className="w-full max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Catalogue queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        What customers searched for and tradespeople typed that no job in the catalogue answers.
        Promoting one takes effect straight away — no deployment — so customers are offered it
        while they type and tradespeople can tick it on their own profile.
      </p>

      <nav className="mt-6 flex gap-1 border-b">
        {TABS.map((tab) => (
          <a
            key={tab.status}
            href={`?status=${tab.status}`}
            className={
              tab.status === status
                ? "-mb-px border-b-2 border-foreground px-3 py-2 text-sm font-medium"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {suggestions.data.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {status === "NEW"
            ? "Nothing waiting. Everything people have asked for has a name."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {suggestions.data.map((suggestion) => (
            <SuggestionRow
              key={suggestion.id}
              suggestion={suggestion}
              trades={trades.data}
              decidable={status === "NEW"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Unavailable({ detail }: { detail: string }) {
  return (
    <div className="w-full max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Catalogue queue</h1>
      <p className="mt-4 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
