import "server-only";

import { publicApiClient } from "./client";
import { answer, attempt, failureOf, type ApiResult } from "./problem";
import type { components } from "./schema";

export type BusinessSearchResults = components["schemas"]["BusinessSearchResults"];
export type BusinessSearchResult = components["schemas"]["BusinessSearchResult"];
export type TradeMatch = components["schemas"]["TradeMatch"];
export type PublicBusinessProfile = components["schemas"]["PublicBusinessProfile"];
export type PublicService = components["schemas"]["PublicService"];
export type ServiceSuggestion = components["schemas"]["ServiceSuggestion"];

/**
 * Jobs from the catalogue that begin like what the customer has typed.
 *
 * Anonymous like the search, and called on every few keystrokes rather than on submit — which is
 * why it goes through a route handler rather than being read in a server component. The browser
 * cannot reach `API_BASE_URL`; that address is the backend as seen from the Next server.
 *
 * `zip` is optional here as it is in the contract, and passing an empty one is not the same as
 * passing none: without it every suggestion comes back with `offeredNearby` absent, and the
 * client must not draw that as "nobody nearby does this".
 *
 * @param typed what is in the box right now, partial words and all
 * @param zip the customer's postal code once they have typed five digits, or null
 */
export function suggestServices(
  typed: string,
  zip: string | null,
): Promise<ApiResult<ServiceSuggestion[]>> {
  return attempt("GET /api/v1/service-catalog", () =>
    publicApiClient().GET("/api/v1/service-catalog", {
      params: {
        query: {
          q: typed,
          ...(zip ? { zip } : {}),
        },
      },
    }),
  );
}

/**
 * Tradespeople whose own service area reaches this postal code.
 *
 * <p>Anonymous, because the customer side is: no token is sent and none is needed.
 *
 * A postal code the backend cannot place answers 400 rather than an empty list, and that
 * difference is the point — "we do not know that ZIP" and "nobody serves you" send somebody to
 * two different places, and only one of them is their own address.
 *
 * The answer is one page of results, never all of them, and it carries `total` and `totalCapped`
 * alongside. A caller that renders `results.length` as the number of tradespeople found is
 * counting the page rather than the search.
 *
 * @param job the problem in the customer's words. Blank is omitted rather than sent, so an empty
 *        search box narrows nothing instead of matching nothing
 * @param service the `code` of a job the customer picked from the suggestions, or null. It takes
 *        precedence over `job` at the backend — a pick is a choice, where prose is a reading —
 *        and it ranks businesses that list the job above the rest of the trade rather than
 *        hiding the rest
 * @param page which page to ask for, or null for the first. Omitted rather than sent as 1, so the
 *        default lives in one place — the contract — instead of being asserted from here too
 */
export function searchBusinesses(
  zip: string,
  job: string | null,
  service: string | null,
  page: number | null,
): Promise<ApiResult<BusinessSearchResults>> {
  return attempt("GET /api/v1/businesses", () =>
    publicApiClient().GET("/api/v1/businesses", {
      params: {
        query: {
          zip,
          ...(job?.trim() ? { job: job.trim() } : {}),
          ...(service ? { service } : {}),
          ...(page ? { page } : {}),
        },
      },
    }),
  );
}

/**
 * One business by the address it was published under.
 *
 * Anonymous like the search, and the same reasoning: no token is sent, and sending one would put
 * a signed-in tradesperson's identity on an answer that must not depend on it.
 *
 * **A 404 comes back as `null` rather than as a failure, and is not logged as one.** It is an
 * ordinary outcome — a mistyped address, a link to a profile since taken back to draft, or one
 * the marketplace has suspended, which are deliberately the same answer. Treating it as an error
 * would fill the log with other people's typing and leave nothing to notice a real one by.
 * Everything else is still a failure: a page that does not exist and a backend that could not be
 * reached are different news for the reader.
 */
export async function getBusiness(slug: string): Promise<ApiResult<PublicBusinessProfile | null>> {
  const endpoint = "GET /api/v1/businesses/{slug}";

  const answered = await answer(endpoint, () =>
    publicApiClient().GET("/api/v1/businesses/{slug}", { params: { path: { slug } } }),
  );

  if (!answered.reached) {
    return { ok: false, failure: answered.failure };
  }

  if (answered.response.status === 404) {
    return { ok: true, data: null };
  }

  if (!answered.response.ok) {
    return { ok: false, failure: failureOf(endpoint, answered.response, answered.error) };
  }

  return { ok: true, data: answered.data as PublicBusinessProfile };
}
