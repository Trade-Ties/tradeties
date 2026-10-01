"use server";

import { INVALID_SELECTION } from "@/lib/api/failure";
import { searchBusinesses, type BusinessSearchResult } from "@/lib/api/marketplace";

/** Every page the search will hand out: its cap is ten pages, and an eleventh is refused. */
const MOST_PAGES = 10;

export type Browsed =
  | { ok: true; results: BusinessSearchResult[] }
  | { ok: false; unknownZip: boolean };

/**
 * Everybody who reaches a ZIP code, for the browse page to filter in the browser — every page of the
 * search rather than the first, because the page's filters and sort run over the whole list.
 *
 * <p>`when` goes to the search rather than being worked out here: only the backend can say whether a
 * business is free on a day, against its whole calendar rather than the handful of times a card
 * carries.
 */
export async function browseBusinesses(zip: string, when: string | null): Promise<Browsed> {
  const results: BusinessSearchResult[] = [];

  for (let page = 1; page <= MOST_PAGES; page++) {
    const found = await searchBusinesses(zip, null, null, page === 1 ? null : page, when);
    if (!found.ok) {
      // A later page failing still leaves the earlier ones worth showing.
      if (page > 1) break;
      return { ok: false, unknownZip: found.failure.type === INVALID_SELECTION };
    }

    const batch = found.data.results ?? [];
    results.push(...batch);
    if (batch.length < found.data.pageSize) break;
  }

  return { ok: true, results };
}
