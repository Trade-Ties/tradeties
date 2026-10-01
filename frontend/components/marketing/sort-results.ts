import type { components } from "@/lib/api/schema";

type SearchResult = components["schemas"]["BusinessSearchResult"];

/** The "Sort by" choices, shared by the browse page and the search results so the two read alike. */
export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "soonest", label: "Soonest available" },
  { value: "low to high", label: "Price: low to high" },
  { value: "high to low", label: "Price: high to low" },
  { value: "distance", label: "Distance" },
];

/**
 * The results in the order asked for. "Recommended" is the search's own order — nearest first, and
 * whoever lists the picked job ahead of whoever does not — so it changes nothing.
 *
 * A business without a rate sorts last either way: it is neither the cheapest nor the dearest.
 */
export function sortResults(results: SearchResult[], sort: string): SearchResult[] {
  const rate = (r: SearchResult, missing: number) => (r.hourlyRate ? Number(r.hourlyRate) : missing);
  const sorted = [...results];

  switch (sort) {
    case "low to high":
      return sorted.sort((a, b) => rate(a, Infinity) - rate(b, Infinity));
    case "high to low":
      return sorted.sort((a, b) => rate(b, -Infinity) - rate(a, -Infinity));
    case "distance":
      return sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
    // By the first opening on the card; a business with none goes last.
    case "soonest":
      return sorted.sort((a, b) => soonest(a) - soonest(b));
    default:
      return sorted;
  }
}

/** The first opening as a moment, or never for a business that has none to offer. */
function soonest(result: SearchResult): number {
  const first = result.nextSlots?.[0];
  return first ? Date.parse(first) : Infinity;
}
