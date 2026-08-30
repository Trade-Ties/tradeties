import "server-only";

import { publicApiClient } from "./client";
import { attempt, type ApiResult } from "./problem";
import type { components } from "./schema";

export type BusinessSearchResults = components["schemas"]["BusinessSearchResults"];
export type BusinessSearchResult = components["schemas"]["BusinessSearchResult"];
export type TradeMatch = components["schemas"]["TradeMatch"];

/**
 * Tradespeople whose own service area reaches this postal code.
 *
 * <p>Anonymous, because the customer side is: no token is sent and none is needed.
 *
 * A postal code the backend cannot place answers 400 rather than an empty list, and that
 * difference is the point — "we do not know that ZIP" and "nobody serves you" send somebody to
 * two different places, and only one of them is their own address.
 *
 * @param job the problem in the customer's words. Blank is omitted rather than sent, so an empty
 *        search box narrows nothing instead of matching nothing
 */
export function searchBusinesses(
  zip: string,
  job: string | null,
): Promise<ApiResult<BusinessSearchResults>> {
  return attempt("GET /api/v1/businesses", () =>
    publicApiClient().GET("/api/v1/businesses", {
      params: { query: { zip, ...(job?.trim() ? { job: job.trim() } : {}) } },
    }),
  );
}
